import django.core.validators
import django.db.models.deletion
from django.db import migrations, models


PROGRAM_ONE_REP_MAX_CONFIGS = {
    "base-program": {
        "one_rep_max_exercises": [
            ("Приседания", "SQUAT", "Приседания"),
            ("Жим лёжа", "BENCH", "Жим лёжа"),
            ("Жим штанги стоя", "BENCH", "Жим штанги стоя"),
            ("Становая тяга", "DEADLIFT", "Становая тяга"),
        ],
        "category_sources": {
            "SQUAT": "Приседания",
            "BENCH": "Жим лёжа",
            "DEADLIFT": "Становая тяга",
        },
        "source_overrides": {
            "Жим штанги стоя": "Жим штанги стоя",
            "Жим штанги сидя": "Жим штанги стоя",
            "Жим лежа узким хватом": "Жим лёжа",
            "Жим лежа средний хват": "Жим лёжа",
            "Жим штанги лежа на скамье 30°": "Жим лёжа",
            "Жим гантелей скамья 30°": "Жим лёжа",
            "Негативный жим": "Жим лёжа",
            "Приседания в глубину": "Приседания",
            "Полуприсед": "Приседания",
            "Наклоны с гантелью": "Приседания",
            "Наклоны": "Приседания",
            "Мертвая тяга": "Становая тяга",
            "Тяга с плинтов": "Становая тяга",
            "Становая тяга с подставками": "Становая тяга",
        },
    },
    "jeff-nippard-powerbuilding": {
        "one_rep_max_exercises": [
            ("Приседания", "SQUAT", "Приседания"),
            ("Жим штанги лежа", "BENCH", "Жим штанги лежа"),
            ("Жим штанги стоя", "BENCH", "Жим штанги стоя"),
            ("Становая тяга", "DEADLIFT", "Становая тяга"),
        ],
        "category_sources": {
            "SQUAT": "Приседания",
            "BENCH": "Жим штанги лежа",
            "DEADLIFT": "Становая тяга",
        },
        "source_overrides": {
            "Жим штанги стоя": "Жим штанги стоя",
            "Жим штанги лежа с паузой": "Жим штанги лежа",
            "Становая тяга с паузой": "Становая тяга",
        },
    },
}


LEGACY_TO_PROGRAM_VALUE_SOURCES = {
    "Приседания": "squat",
    "Жим лёжа": "bench",
    "Жим штанги лежа": "bench",
    "Жим штанги стоя": None,
    "Становая тяга": "deadlift",
}


def ensure_program_one_rep_max_config(apps, program, config):
    Exercise = apps.get_model("programs", "Exercise")
    ProgramOneRepMaxExercise = apps.get_model("programs", "ProgramOneRepMaxExercise")

    source_map = {}
    for order, (exercise_name, category, label) in enumerate(
        config["one_rep_max_exercises"], start=1
    ):
        exercise, _ = Exercise.objects.get_or_create(
            name=exercise_name,
            defaults={"category": category},
        )
        if exercise.category != category:
            exercise.category = category
            exercise.save(update_fields=["category"])

        ProgramOneRepMaxExercise.objects.update_or_create(
            program_id=program.id,
            exercise_id=exercise.id,
            defaults={"label": label, "order": order},
        )
        source_map[exercise.name] = exercise

    return source_map


def resolve_source_name(exercise_name, category, config):
    return config["source_overrides"].get(exercise_name) or config["category_sources"].get(category)


def migrate_one_rep_max_to_program_specific(apps, schema_editor):
    Program = apps.get_model("programs", "Program")
    Exercise = apps.get_model("programs", "Exercise")
    DayExercise = apps.get_model("programs", "DayExercise")
    ProgramSnapshot = apps.get_model("programs", "ProgramSnapshot")
    OneRepMax = apps.get_model("programs", "OneRepMax")

    exercise_names = dict(Exercise.objects.values_list("id", "name"))

    for slug, config in PROGRAM_ONE_REP_MAX_CONFIGS.items():
        program = Program.objects.filter(slug=slug).first()
        if program is None:
            continue

        source_map = ensure_program_one_rep_max_config(apps, program, config)

        for day_exercise in (
            DayExercise.objects.filter(day__week__program_id=program.id)
            .select_related("exercise")
            .all()
        ):
            source_name = resolve_source_name(
                day_exercise.exercise.name,
                day_exercise.exercise.category,
                config,
            )
            day_exercise.one_rep_max_exercise_id = (
                source_map[source_name].id if source_name in source_map else None
            )
            day_exercise.save(update_fields=["one_rep_max_exercise"])

        for snapshot in ProgramSnapshot.objects.filter(program_id=program.id):
            payload = snapshot.payload or {}
            changed = False
            for week in payload.get("weeks", []):
                for day in week.get("days", []):
                    for exercise in day.get("exercises", []):
                        exercise_name = exercise_names.get(exercise.get("exercise_id"))
                        if not exercise_name:
                            continue
                        source_name = resolve_source_name(
                            exercise_name,
                            Exercise.objects.get(pk=exercise["exercise_id"]).category,
                            config,
                        )
                        source_exercise = source_map.get(source_name)
                        source_id = source_exercise.id if source_exercise else None
                        if exercise.get("one_rep_max_exercise_id") != source_id:
                            exercise["one_rep_max_exercise_id"] = source_id
                            changed = True
            if changed:
                snapshot.payload = payload
                snapshot.save(update_fields=["payload"])

    legacy_rows = list(OneRepMax.objects.filter(program__isnull=True, exercise__isnull=True))
    programs = {program.slug: program for program in Program.objects.filter(slug__in=PROGRAM_ONE_REP_MAX_CONFIGS)}

    for row in legacy_rows:
        for slug, config in PROGRAM_ONE_REP_MAX_CONFIGS.items():
            program = programs.get(slug)
            if program is None:
                continue
            source_map = ensure_program_one_rep_max_config(apps, program, config)
            for exercise_name, _category, _label in config["one_rep_max_exercises"]:
                source_field = LEGACY_TO_PROGRAM_VALUE_SOURCES.get(exercise_name)
                value = getattr(row, source_field, 0) if source_field else 0
                OneRepMax.objects.create(
                    telegram_id=row.telegram_id,
                    program_id=program.id,
                    exercise_id=source_map[exercise_name].id,
                    value=value,
                )
        row.delete()


class Migration(migrations.Migration):
    dependencies = [
        ("programs", "0012_merge_duplicate_exercises"),
    ]

    operations = [
        migrations.CreateModel(
            name="ProgramOneRepMaxExercise",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("label", models.CharField(blank=True, default="", max_length=200, verbose_name="Подпись")),
                ("order", models.PositiveIntegerField(default=1, verbose_name="Порядок")),
                (
                    "exercise",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="program_one_rep_max_configs",
                        to="programs.exercise",
                        verbose_name="Упражнение 1ПМ",
                    ),
                ),
                (
                    "program",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="one_rep_max_exercises",
                        to="programs.program",
                        verbose_name="Программа",
                    ),
                ),
            ],
            options={
                "verbose_name": "Упражнение 1ПМ программы",
                "verbose_name_plural": "Упражнения 1ПМ программы",
                "ordering": ["order", "id"],
            },
        ),
        migrations.AlterField(
            model_name="onerepmax",
            name="telegram_id",
            field=models.BigIntegerField(db_index=True, verbose_name="Telegram ID"),
        ),
        migrations.AddField(
            model_name="dayexercise",
            name="one_rep_max_exercise",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="percent_source_for_day_exercises",
                to="programs.exercise",
                verbose_name="Упражнение 1ПМ",
            ),
        ),
        migrations.AddField(
            model_name="onerepmax",
            name="exercise",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="one_rep_max_values",
                to="programs.exercise",
                verbose_name="Упражнение 1ПМ",
            ),
        ),
        migrations.AddField(
            model_name="onerepmax",
            name="program",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="one_rep_max_values",
                to="programs.program",
                verbose_name="Программа",
            ),
        ),
        migrations.AddField(
            model_name="onerepmax",
            name="value",
            field=models.PositiveIntegerField(
                default=0,
                validators=[django.core.validators.MaxValueValidator(999)],
                verbose_name="Разовый максимум (кг)",
            ),
        ),
        migrations.RunPython(migrate_one_rep_max_to_program_specific, migrations.RunPython.noop),
        migrations.RemoveField(
            model_name="onerepmax",
            name="bench",
        ),
        migrations.RemoveField(
            model_name="onerepmax",
            name="deadlift",
        ),
        migrations.RemoveField(
            model_name="onerepmax",
            name="squat",
        ),
        migrations.AlterField(
            model_name="onerepmax",
            name="exercise",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name="one_rep_max_values",
                to="programs.exercise",
                verbose_name="Упражнение 1ПМ",
            ),
        ),
        migrations.AlterField(
            model_name="onerepmax",
            name="program",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name="one_rep_max_values",
                to="programs.program",
                verbose_name="Программа",
            ),
        ),
        migrations.AlterUniqueTogether(
            name="programonerepmaxexercise",
            unique_together={("program", "exercise")},
        ),
        migrations.AlterModelOptions(
            name="onerepmax",
            options={
                "ordering": ["telegram_id", "program_id", "exercise_id"],
                "verbose_name": "Разовый максимум",
                "verbose_name_plural": "Разовые максимумы",
            },
        ),
        migrations.AlterUniqueTogether(
            name="onerepmax",
            unique_together={("telegram_id", "program", "exercise")},
        ),
    ]
