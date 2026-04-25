from django.db import transaction
from django.utils.text import slugify

from .models import Day, DayExercise, DayTextBlock, ExerciseSet, Program, ProgramOneRepMaxExercise, Week


def build_duplicate_program_slug(source_program, *, suffix="copy"):
    base = slugify(source_program.slug or source_program.name)[:80]
    if not base:
        base = "program"
    slug = f"{base}-{suffix}"
    index = 2
    while Program.objects.filter(slug=slug).exists():
        slug = f"{base}-{suffix}-{index}"
        index += 1
    return slug


def build_duplicate_program_name(source_program, *, suffix="копия"):
    base = source_program.name.strip() or "Программа"
    name = f"{base} ({suffix})"
    index = 2
    while Program.objects.filter(name=name, owner=source_program.owner).exists():
        name = f"{base} ({suffix} {index})"
        index += 1
    return name


def clone_program_structure(source_program, target_program):
    if source_program is None:
        return

    for item in source_program.one_rep_max_exercises.select_related("exercise").order_by("order", "id"):
        ProgramOneRepMaxExercise.objects.create(
            program=target_program,
            exercise=item.exercise,
            label=item.label,
            order=item.order,
        )

    weeks = source_program.weeks.prefetch_related(
        "days__exercises__sets",
        "days__exercises__exercise",
        "days__exercises__one_rep_max_exercise",
        "days__text_blocks",
    ).order_by("number")
    for week in weeks:
        cloned_week = Week.objects.create(
            program=target_program,
            number=week.number,
            title=week.title,
        )
        for day in week.days.all():
            cloned_day = Day.objects.create(
                week=cloned_week,
                weekday=day.weekday,
                order=day.order,
                title=day.title,
            )
            for exercise in day.exercises.all():
                cloned_exercise = DayExercise.objects.create(
                    day=cloned_day,
                    exercise=exercise.exercise,
                    one_rep_max_exercise=exercise.one_rep_max_exercise,
                    order=exercise.order,
                    superset_group=exercise.superset_group,
                    notes=exercise.notes,
                )
                for set_item in exercise.sets.all():
                    ExerciseSet.objects.create(
                        day_exercise=cloned_exercise,
                        load_type=set_item.load_type,
                        load_value=set_item.load_value,
                        load_value_max=set_item.load_value_max,
                        reps=set_item.reps,
                        reps_max=set_item.reps_max,
                        sets=set_item.sets,
                        order=set_item.order,
                    )
            for text_block in day.text_blocks.all():
                DayTextBlock.objects.create(
                    day=cloned_day,
                    kind=text_block.kind,
                    content=text_block.content,
                    order=text_block.order,
                )


@transaction.atomic
def duplicate_program(source_program, *, owner=None, source_program_ref=None, suffix="копия"):
    duplicated = Program.objects.create(
        slug=build_duplicate_program_slug(source_program),
        name=build_duplicate_program_name(source_program, suffix=suffix),
        description=source_program.description,
        owner=owner if owner is not None else source_program.owner,
        source_program=source_program_ref if source_program_ref is not None else source_program.source_program,
    )
    clone_program_structure(source_program, duplicated)
    return duplicated
