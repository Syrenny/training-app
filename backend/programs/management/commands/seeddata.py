from django.core.management.base import BaseCommand
from django.db import transaction

from programs.models import Day, DayExercise, DayTextBlock, Exercise, ExerciseSet, OneRepMax, Program, Week
from programs.seed_configs import BUNDLED_PROGRAMS
from programs.seed_configs.common import EXERCISE_NAME_ALIASES

LEGACY_WEEKDAY_ORDER = {"MON": 1, "WED": 2, "FRI": 3}
DEV_DEFAULT_ONE_REP_MAX = {
    "Приседания": 120,
    "Жим лёжа": 100,
    "Жим штанги лежа": 100,
    "Жим штанги стоя": 60,
    "Становая тяга": 140,
}


class Command(BaseCommand):
    help = "Seed the database with all bundled training programs"

    def add_arguments(self, parser):
        parser.add_argument(
            "--force",
            action="store_true",
            help="Rebuild bundled source programs from scratch",
        )
        parser.add_argument(
            "--dev-user",
            action="store_true",
            help="Create OneRepMax records for dev user (telegram_id=1)",
        )

    def handle(self, *args, **options):
        if options["force"]:
            self.stdout.write(
                self.style.WARNING(
                    "Rebuilding bundled source programs only. User snapshots will be preserved..."
                )
            )

        results = []
        with transaction.atomic():
            for config in BUNDLED_PROGRAMS:
                program, _ = Program.objects.update_or_create(
                    slug=config["slug"],
                    defaults={
                        "name": config["name"],
                        "description": config.get("description", ""),
                    },
                )
                self.reset_program_structure(program)
                one_rep_max_sources = self.seed_program_one_rep_max_exercises(program, config)
                created_count = self.seed_program(program, config, one_rep_max_sources)
                results.append((program.name, created_count))

            if options["dev_user"]:
                self.seed_dev_user_one_rep_max()

        summary = "; ".join(f"{name} — {count} недель пересобрано" for name, count in results)
        self.stdout.write(self.style.SUCCESS(f"Done: {summary}"))

        if options["dev_user"]:
            self.stdout.write(self.style.SUCCESS("Dev user OneRepMax created/updated (telegram_id=1)"))

    def reset_program_structure(self, program):
        self.stdout.write(f"  {program.name}: удаляю старую исходную структуру")
        program.weeks.all().delete()
        program.one_rep_max_exercises.all().delete()

    def get_or_update_exercise(self, name, category):
        name = EXERCISE_NAME_ALIASES.get(name, name)
        exercise, created = Exercise.objects.get_or_create(
            name=name,
            defaults={"category": category},
        )
        if not created and exercise.category != category:
            exercise.category = category
            exercise.save(update_fields=["category"])
        return exercise

    def seed_program_one_rep_max_exercises(self, program, config):
        source_map = {}
        for order, item in enumerate(config.get("one_rep_max_exercises", []), start=1):
            exercise = self.get_or_update_exercise(item["name"], item["category"])
            program.one_rep_max_exercises.create(
                exercise=exercise,
                label=item.get("label", exercise.name),
                order=order,
            )
            source_map[exercise.name] = exercise
        return source_map

    def resolve_one_rep_max_exercise(self, exercise_name, category, config, source_map):
        source_name = config.get("one_rep_max_sources", {}).get(exercise_name)
        if source_name is None:
            source_name = config.get("one_rep_max_category_sources", {}).get(category)
        if source_name is None:
            return None
        return source_map.get(source_name)

    def seed_program(self, program, config, one_rep_max_sources):
        if config["format"] == "legacy":
            return self.seed_legacy_program(program, config["weeks"], config, one_rep_max_sources)
        return self.seed_structured_program(program, config["weeks"], config, one_rep_max_sources)

    def seed_legacy_program(self, program, weeks_data, config, one_rep_max_sources):
        created_count = 0

        for week_number, (title, days_data) in weeks_data.items():
            week = Week.objects.create(
                program=program,
                number=week_number,
                title=title,
            )

            for weekday_code, exercises_data in days_data.items():
                day = Day.objects.create(
                    week=week,
                    weekday=weekday_code,
                    order=LEGACY_WEEKDAY_ORDER[weekday_code],
                )

                for ex_order, ex_tuple in enumerate(exercises_data, start=1):
                    ex_name = ex_tuple[0]
                    ex_category = ex_tuple[1]
                    sets_data = ex_tuple[2]
                    superset_group = ex_tuple[3] if len(ex_tuple) > 3 else None

                    exercise = self.get_or_update_exercise(ex_name, ex_category)
                    day_exercise = DayExercise.objects.create(
                        day=day,
                        exercise=exercise,
                        one_rep_max_exercise=self.resolve_one_rep_max_exercise(
                            exercise.name,
                            ex_category,
                            config,
                            one_rep_max_sources,
                        ),
                        order=ex_order,
                        superset_group=superset_group,
                    )

                    for set_order, (load_type, load_value, reps, sets) in enumerate(
                        sets_data, start=1
                    ):
                        ExerciseSet.objects.create(
                            day_exercise=day_exercise,
                            load_type=load_type,
                            load_value=load_value,
                            reps=reps,
                            sets=sets,
                            order=set_order,
                        )

            created_count += 1
            self.stdout.write(f"  {program.name}: неделя {week_number} создана")

        return created_count

    def seed_structured_program(self, program, weeks_data, config, one_rep_max_sources):
        created_count = 0

        for week_number, week_data in weeks_data.items():
            week = Week.objects.create(
                program=program,
                number=week_number,
                title=week_data["title"],
            )

            for day_order, day_data in enumerate(week_data["days"], start=1):
                day = Day.objects.create(
                    week=week,
                    weekday=day_data["weekday"],
                    order=day_order,
                    title=day_data.get("title", ""),
                )

                for ex_order, exercise_data in enumerate(day_data.get("exercises", []), start=1):
                    exercise = self.get_or_update_exercise(
                        exercise_data["name"],
                        exercise_data["category"],
                    )
                    day_exercise = DayExercise.objects.create(
                        day=day,
                        exercise=exercise,
                        one_rep_max_exercise=self.resolve_one_rep_max_exercise(
                            exercise.name,
                            exercise.category,
                            config,
                            one_rep_max_sources,
                        ),
                        order=ex_order,
                        superset_group=exercise_data.get("superset_group"),
                        notes=exercise_data.get("notes", ""),
                    )

                    for set_order, set_data in enumerate(exercise_data.get("sets", []), start=1):
                        ExerciseSet.objects.create(
                            day_exercise=day_exercise,
                            load_type=set_data["load_type"],
                            load_value=set_data.get("load_value"),
                            load_value_max=set_data.get("load_value_max"),
                            reps=set_data["reps"],
                            reps_max=set_data.get("reps_max"),
                            sets=set_data["sets"],
                            order=set_order,
                        )

                for block_order, block_data in enumerate(day_data.get("text_blocks", []), start=1):
                    DayTextBlock.objects.create(
                        day=day,
                        kind=block_data["kind"],
                        content=block_data["content"],
                        order=block_order,
                    )

            created_count += 1
            self.stdout.write(f"  {program.name}: неделя {week_number} создана")

        return created_count

    def seed_dev_user_one_rep_max(self):
        for program in Program.objects.prefetch_related("one_rep_max_exercises__exercise"):
            for item in program.one_rep_max_exercises.all():
                OneRepMax.objects.update_or_create(
                    telegram_id=1,
                    program=program,
                    exercise=item.exercise,
                    defaults={"value": DEV_DEFAULT_ONE_REP_MAX.get(item.exercise.name, 0)},
                )
