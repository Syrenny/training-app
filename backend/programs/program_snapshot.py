from __future__ import annotations

import re
from decimal import Decimal

from .models import (
    Exercise,
    Program,
    Week,
    Weekday,
)

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


def format_number_range(min_value, max_value):
    first = decimal_to_json(min_value)
    last = decimal_to_json(max_value)
    if last is None or last == first:
        return str(first)
    return f"{first}-{last}"


def render_set_display(load_type, load_value, reps, sets, *, load_value_max=None, reps_max=None):
    parts = []
    if load_type == "PERCENT":
        parts.append(f"{format_number_range(load_value, load_value_max)}%")
    elif load_type == "KG":
        parts.append(f"{format_number_range(load_value, load_value_max)}кг")
    elif load_type == "INDIVIDUAL":
        parts.append("🏋")

    parts.append(format_number_range(reps, reps_max))

    if sets > 1:
        parts.append(str(sets))

    return "×".join(parts)


def serialize_program_summary(program):
    if program is None:
        return None
    return {
        "id": program.id,
        "slug": program.slug,
        "name": program.name,
        "description": program.description,
        "is_custom": program.owner_id is not None,
        "source_program_id": program.source_program_id,
        "source_program_name": program.source_program.name if program.source_program_id else None,
        "one_rep_max_exercises": [
            {
                "exercise_id": item.exercise_id,
                "label": item.label,
                "order": item.order,
                "exercise": {
                    "id": item.exercise.id,
                    "name": item.exercise.name,
                    "category": item.exercise.category,
                },
            }
            for item in program.one_rep_max_exercises.select_related("exercise").all().order_by("order", "id")
        ],
    }


def get_default_program():
    return Program.objects.filter(owner__isnull=True).order_by("id").first()


def build_base_program_payload(program=None):
    active_program = program or get_default_program()
    if active_program is None:
        return {"weeks": []}

    weeks = Week.objects.prefetch_related(
        "days__exercises__exercise",
        "days__exercises__one_rep_max_exercise",
        "days__exercises__sets",
        "days__text_blocks",
    ).filter(program=active_program)
    result = []
    for week_index, week in enumerate(weeks, start=1):
        days = []
        for day in week.days.all():
            exercises = []
            for exercise in day.exercises.all():
                exercises.append(
                    {
                        "slot_key": f"{week_index}:{day.weekday}:{exercise.order}",
                        "exercise_id": exercise.exercise_id,
                        "one_rep_max_exercise_id": exercise.one_rep_max_exercise_id,
                        "superset_group": exercise.superset_group,
                        "notes": exercise.notes,
                        "sets": [
                            {
                                "load_type": set_item.load_type,
                                "load_value": decimal_to_json(set_item.load_value),
                                "load_value_max": decimal_to_json(set_item.load_value_max),
                                "reps": set_item.reps,
                                "reps_max": set_item.reps_max,
                                "sets": set_item.sets,
                            }
                            for set_item in exercise.sets.all()
                        ],
                    }
                )
            days.append(
                {
                    "weekday": day.weekday,
                    "title": day.title,
                    "exercises": exercises,
                    "text_blocks": [
                        {
                            "kind": item.kind,
                            "content": item.content,
                        }
                        for item in day.text_blocks.all()
                    ],
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


def collect_exercise_ids(payload):
    ids = set()
    for week in payload.get("weeks", []):
        for day in week.get("days", []):
            for exercise in day.get("exercises", []):
                exercise_id = exercise.get("exercise_id")
                if exercise_id is not None:
                    ids.add(exercise_id)
    return ids


def build_program_response(payload, *, program=None, version=None, created_at=None, commit_message=None):
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
                    load_value_max = decimal_to_json(set_item.get("load_value_max"))
                    set_items.append(
                        {
                            "id": f"{day_id}:{exercise_index}:{set_index}",
                            "order": set_index,
                            "load_type": set_item["load_type"],
                            "load_value": load_value,
                            "load_value_max": load_value_max,
                            "reps": set_item["reps"],
                            "reps_max": set_item.get("reps_max"),
                            "sets": set_item["sets"],
                            "display": render_set_display(
                                set_item["load_type"],
                                load_value,
                                set_item["reps"],
                                set_item["sets"],
                                load_value_max=load_value_max,
                                reps_max=set_item.get("reps_max"),
                            ),
                        }
                    )

                exercise_items.append(
                    {
                        "id": f"{day_id}:{exercise_index}",
                        "order": exercise_index,
                        "slot_key": exercise_item.get("slot_key", f"{week_number}:{weekday}:{exercise_index}"),
                        "exercise": {
                            "id": exercise.id,
                            "name": exercise.name,
                            "category": exercise.category,
                            "one_rep_max_exercise_id": exercise_item.get("one_rep_max_exercise_id"),
                        },
                        "sets": set_items,
                        "superset_group": exercise_item.get("superset_group"),
                        "notes": exercise_item.get("notes", ""),
                    }
                )

            days.append(
                {
                    "id": day_id,
                    "order": day_index,
                    "weekday": weekday,
                    "weekday_display": WEEKDAY_SHORT_LABELS.get(weekday, weekday),
                    "title": day.get("title", ""),
                    "exercises": exercise_items,
                    "text_blocks": day.get("text_blocks", []),
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
        "program": serialize_program_summary(program),
        "version": version,
        "updated_at": created_at.isoformat() if created_at else None,
        "commit_message": commit_message,
        "weeks": weeks,
    }
