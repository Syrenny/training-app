from __future__ import annotations

import re
from decimal import Decimal

from .models import Exercise, ProgramSnapshot, Week, Weekday

WEEKDAY_SHORT_LABELS = {
    Weekday.MON: "Пн",
    Weekday.TUE: "Вт",
    Weekday.WED: "Ср",
    Weekday.THU: "Чт",
    Weekday.FRI: "Пт",
    Weekday.SAT: "Сб",
    Weekday.SUN: "Вс",
}

WEEKDAY_SORT_ORDER = {
    Weekday.MON: 0,
    Weekday.TUE: 1,
    Weekday.WED: 2,
    Weekday.THU: 3,
    Weekday.FRI: 4,
    Weekday.SAT: 5,
    Weekday.SUN: 6,
}

AUTO_WEEK_TITLE_RE = re.compile(r"^(?:\d+\s+неделя|Неделя\s+\d+)$")


def decimal_to_json(value):
    if value is None:
        return None
    if isinstance(value, Decimal):
        if value == value.to_integral():
            return int(value)
        return float(value)
    return value


def render_set_display(load_type, load_value, reps, sets):
    parts = []
    if load_type == "PERCENT":
        parts.append(f"{decimal_to_json(load_value)}%")
    elif load_type == "KG":
        parts.append(f"{decimal_to_json(load_value)}кг")
    elif load_type == "INDIVIDUAL":
        parts.append("🏋")

    parts.append(str(reps))

    if sets > 1:
        parts.append(str(sets))

    return "×".join(parts)


def build_base_program_payload():
    weeks = Week.objects.prefetch_related(
        "days__exercises__exercise",
        "days__exercises__sets",
    ).all()
    result = []
    for week_index, week in enumerate(weeks, start=1):
        days = []
        for day in week.days.all():
            exercises = []
            for exercise in day.exercises.all():
                exercises.append(
                    {
                        "exercise_id": exercise.exercise_id,
                        "superset_group": exercise.superset_group,
                        "sets": [
                            {
                                "load_type": set_item.load_type,
                                "load_value": decimal_to_json(set_item.load_value),
                                "reps": set_item.reps,
                                "sets": set_item.sets,
                            }
                            for set_item in exercise.sets.all()
                        ],
                    }
                )
            days.append(
                {
                    "weekday": day.weekday,
                    "exercises": exercises,
                }
            )
        result.append(
            {
                "number": week_index,
                "title": normalize_week_title(week.title, week_index),
                "days": days,
            }
        )
    return {"weeks": result}


def normalize_week_title(title, week_number):
    normalized = (title or "").strip()
    if not normalized or AUTO_WEEK_TITLE_RE.match(normalized):
        return f"{week_number} неделя"
    return normalized


def get_latest_snapshot(telegram_id):
    return ProgramSnapshot.objects.filter(telegram_id=telegram_id).order_by("-version").first()


def get_program_payload_for_user(telegram_id):
    snapshot = get_latest_snapshot(telegram_id)
    if snapshot is None:
        return None, build_base_program_payload()
    return snapshot, snapshot.payload


def collect_exercise_ids(payload):
    ids = set()
    for week in payload.get("weeks", []):
        for day in week.get("days", []):
            for exercise in day.get("exercises", []):
                exercise_id = exercise.get("exercise_id")
                if exercise_id is not None:
                    ids.add(exercise_id)
    return ids


def build_program_response(payload, *, version=None, created_at=None, commit_message=None):
    exercise_ids = collect_exercise_ids(payload)
    exercises = Exercise.objects.in_bulk(exercise_ids)

    weeks = []
    for week_index, week in enumerate(payload.get("weeks", []), start=1):
        week_number = int(week.get("number") or week_index)
        days = []
        for day_index, day in enumerate(week.get("days", []), start=1):
            weekday = day["weekday"]
            day_id = f"{week_number}:{weekday}"
            exercise_items = []
            for exercise_index, exercise_item in enumerate(day.get("exercises", []), start=1):
                exercise = exercises[exercise_item["exercise_id"]]
                set_items = []
                for set_index, set_item in enumerate(exercise_item.get("sets", []), start=1):
                    load_value = decimal_to_json(set_item.get("load_value"))
                    set_items.append(
                        {
                            "id": f"{day_id}:{exercise_index}:{set_index}",
                            "order": set_index,
                            "load_type": set_item["load_type"],
                            "load_value": load_value,
                            "reps": set_item["reps"],
                            "sets": set_item["sets"],
                            "display": render_set_display(
                                set_item["load_type"],
                                load_value,
                                set_item["reps"],
                                set_item["sets"],
                            ),
                        }
                    )

                exercise_items.append(
                    {
                        "id": f"{day_id}:{exercise_index}",
                        "order": exercise_index,
                        "exercise": {
                            "id": exercise.id,
                            "name": exercise.name,
                            "category": exercise.category,
                        },
                        "sets": set_items,
                        "superset_group": exercise_item.get("superset_group"),
                    }
                )

            days.append(
                {
                    "id": day_id,
                    "order": day_index,
                    "weekday": weekday,
                    "weekday_display": WEEKDAY_SHORT_LABELS.get(weekday, weekday),
                    "exercises": exercise_items,
                }
            )

        weeks.append(
            {
                "id": week_number,
                "number": week_number,
                "title": normalize_week_title(week.get("title"), week_number),
                "days": days,
            }
        )

    return {
        "version": version,
        "updated_at": created_at.isoformat() if created_at else None,
        "commit_message": commit_message,
        "weeks": weeks,
    }


def count_program_entities(payload):
    week_count = len(payload.get("weeks", []))
    day_count = 0
    exercise_count = 0
    set_count = 0
    for week in payload.get("weeks", []):
        for day in week.get("days", []):
            day_count += 1
            for exercise in day.get("exercises", []):
                exercise_count += 1
                set_count += len(exercise.get("sets", []))
    return {
        "week_count": week_count,
        "day_count": day_count,
        "exercise_count": exercise_count,
        "set_count": set_count,
    }
