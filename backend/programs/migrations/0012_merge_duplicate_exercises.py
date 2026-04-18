from django.db import migrations


EXERCISE_MERGES = [
    ("Приседания со штангой на спине", "Приседания", "SQUAT"),
    ("Молотковые сгибания на бицепс", "Молотки", "ACCESSORY"),
    ("Подтягивания с весом", "Подтягивания", "ACCESSORY"),
    ("Отжимания на брусьях с весом", "Отжимания на брусьях", "ACCESSORY"),
]


def merge_snapshot_payload_exercise_ids(payload, source_id, target_id):
    changed = False

    for week in payload.get("weeks", []):
        for day in week.get("days", []):
            for exercise in day.get("exercises", []):
                if exercise.get("exercise_id") == source_id:
                    exercise["exercise_id"] = target_id
                    changed = True

    return changed


def merge_accessory_weights(AccessoryWeight, source_id, target_id):
    source_weights = AccessoryWeight.objects.filter(exercise_id=source_id).order_by(
        "telegram_id",
        "recorded_date",
        "id",
    )

    for source_weight in source_weights:
        target_weight = AccessoryWeight.objects.filter(
            telegram_id=source_weight.telegram_id,
            exercise_id=target_id,
            recorded_date=source_weight.recorded_date,
        ).first()

        if target_weight is None:
            source_weight.exercise_id = target_id
            source_weight.save(update_fields=["exercise"])
            continue

        updated_fields = []
        if not target_weight.sets_display and source_weight.sets_display:
            target_weight.sets_display = source_weight.sets_display
            updated_fields.append("sets_display")
        if target_weight.week_id is None and source_weight.week_id is not None:
            target_weight.week_id = source_weight.week_id
            updated_fields.append("week")

        if updated_fields:
            target_weight.save(update_fields=updated_fields)

        source_weight.delete()


def merge_duplicate_exercises(apps, schema_editor):
    Exercise = apps.get_model("programs", "Exercise")
    DayExercise = apps.get_model("programs", "DayExercise")
    AccessoryWeight = apps.get_model("programs", "AccessoryWeight")
    ProgramSnapshot = apps.get_model("programs", "ProgramSnapshot")

    for source_name, target_name, target_category in EXERCISE_MERGES:
        source_exercise = Exercise.objects.filter(name=source_name).first()
        target_exercise = Exercise.objects.filter(name=target_name).first()

        if source_exercise is None and target_exercise is None:
            continue

        if target_exercise is None:
            target_exercise = Exercise.objects.create(
                name=target_name,
                category=target_category,
            )
        if target_exercise.category != target_category:
            target_exercise.category = target_category
            target_exercise.save(update_fields=["category"])

        if source_exercise is None or source_exercise.id == target_exercise.id:
            continue

        DayExercise.objects.filter(exercise_id=source_exercise.id).update(
            exercise_id=target_exercise.id
        )
        merge_accessory_weights(AccessoryWeight, source_exercise.id, target_exercise.id)

        for snapshot in ProgramSnapshot.objects.all():
            payload = snapshot.payload or {}
            if merge_snapshot_payload_exercise_ids(
                payload,
                source_exercise.id,
                target_exercise.id,
            ):
                snapshot.payload = payload
                snapshot.save(update_fields=["payload"])

        source_exercise.delete()


class Migration(migrations.Migration):
    dependencies = [
        ("programs", "0011_program_catalog_and_metadata"),
    ]

    operations = [
        migrations.RunPython(merge_duplicate_exercises, migrations.RunPython.noop),
    ]
