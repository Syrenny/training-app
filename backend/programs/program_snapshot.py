from __future__ import annotations

from copy import deepcopy
import re
from decimal import Decimal

from .models import (
    AdaptationAction,
    AdaptationScope,
    Exercise,
    Program,
    ProgramAdaptation,
    ProgramSnapshot,
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
ADAPTATION_SCOPE_PRIORITY = {
    AdaptationScope.FUTURE_CYCLES: 0,
    AdaptationScope.CURRENT_CYCLE: 1,
    AdaptationScope.ONLY_HERE: 2,
}


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
    return Program.objects.order_by("id").first()


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


def get_latest_snapshot(telegram_id):
    return ProgramSnapshot.objects.filter(telegram_id=telegram_id).order_by("-version").first()


def get_latest_snapshot_for_program(telegram_id, program):
    return (
        ProgramSnapshot.objects.filter(telegram_id=telegram_id, program=program)
        .order_by("-version")
        .first()
    )


def get_program_payload_for_user(telegram_id, program):
    snapshot = get_latest_snapshot_for_program(telegram_id, program)
    if snapshot is None:
        return None, build_base_program_payload(program)
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


def merge_program_payload_metadata(base_payload, next_payload):
    base_weeks = {
        int(week.get("number") or index): week
        for index, week in enumerate(base_payload.get("weeks", []), start=1)
    }

    merged_weeks = []
    for week_index, week in enumerate(next_payload.get("weeks", []), start=1):
        week_number = int(week.get("number") or week_index)
        base_week = base_weeks.get(week_number, {})
        base_days = {
            day.get("weekday"): day
            for day in base_week.get("days", [])
            if day.get("weekday") is not None
        }

        merged_days = []
        for day in week.get("days", []):
            weekday = day.get("weekday")
            base_day = base_days.get(weekday, {})
            base_exercises = {}
            for exercise in base_day.get("exercises", []):
                base_exercises.setdefault(exercise.get("exercise_id"), []).append(exercise)

            merged_exercises = []
            for exercise in day.get("exercises", []):
                matched = None
                exercise_id = exercise.get("exercise_id")
                if exercise_id in base_exercises and base_exercises[exercise_id]:
                    matched = base_exercises[exercise_id].pop(0)

                merged_sets = []
                base_sets = matched.get("sets", []) if matched else []
                for set_index, set_item in enumerate(exercise.get("sets", [])):
                    base_set = base_sets[set_index] if set_index < len(base_sets) else {}
                    merged_sets.append(
                        {
                            **set_item,
                            "load_value_max": set_item.get("load_value_max", base_set.get("load_value_max")),
                            "reps_max": set_item.get("reps_max", base_set.get("reps_max")),
                        }
                    )

                merged_exercises.append(
                    {
                        **exercise,
                        "one_rep_max_exercise_id": exercise.get(
                            "one_rep_max_exercise_id",
                            matched.get("one_rep_max_exercise_id") if matched else None,
                        ),
                        "notes": exercise.get("notes", matched.get("notes", "") if matched else ""),
                        "sets": merged_sets,
                    }
                )

            merged_days.append(
                {
                    **day,
                    "title": day.get("title", base_day.get("title", "")),
                    "text_blocks": day.get("text_blocks", base_day.get("text_blocks", [])),
                    "exercises": merged_exercises,
                }
            )

        merged_weeks.append(
            {
                **week,
                "days": merged_days,
            }
        )

    return {"weeks": merged_weeks}


def find_day_exercises(payload, week_number, weekday):
    week = next(
        (
            item
            for item in payload.get("weeks", [])
            if int(item.get("number") or 0) == week_number
        ),
        None,
    )
    if week is None:
        return None

    day = next(
        (item for item in week.get("days", []) if item.get("weekday") == weekday),
        None,
    )
    if day is None:
        return None

    return day.get("exercises", [])


def find_slot_index(payload, week_number, weekday, slot_key):
    day_exercises = find_day_exercises(payload, week_number, weekday)
    if day_exercises is None:
        return None, None

    exercise_index = next(
        (
            index
            for index, item in enumerate(day_exercises)
            if item.get("slot_key") == slot_key
        ),
        None,
    )
    return day_exercises, exercise_index


def iter_payload_slots(payload):
    for week_index, week in enumerate(payload.get("weeks", []), start=1):
        week_number = int(week.get("number") or week_index)
        for day in week.get("days", []):
            weekday = day.get("weekday")
            day_exercises = day.get("exercises", [])
            for exercise_index, item in enumerate(day_exercises):
                yield week_number, weekday, day_exercises, exercise_index, item


def find_matching_slot_indexes(
    payload,
    *,
    scope,
    week_number,
    weekday,
    slot_key,
    original_exercise_id=None,
):
    if scope == AdaptationScope.ONLY_HERE or original_exercise_id is None:
        day_exercises, exercise_index = find_slot_index(payload, week_number, weekday, slot_key)
        if day_exercises is None or exercise_index is None:
            return []
        return [(week_number, weekday, day_exercises, exercise_index)]

    matches = []
    for current_week_number, current_weekday, day_exercises, exercise_index, item in iter_payload_slots(payload):
        if item.get("exercise_id") == original_exercise_id:
            matches.append((current_week_number, current_weekday, day_exercises, exercise_index))
    return matches


def sort_adaptations_for_application(adaptations):
    return sorted(
        [item for item in adaptations if getattr(item, "canceled_at", None) is None],
        key=lambda item: (
            ADAPTATION_SCOPE_PRIORITY.get(item.scope, 0),
            item.created_at,
            item.id,
        ),
    )


def insert_slot_payload(day_exercises, slot_payload):
    next_item = deepcopy(slot_payload)
    target_key = str(next_item.get("slot_key") or "")

    try:
        target_order = int(target_key.split(":")[-1])
    except (TypeError, ValueError):
        target_order = None

    if target_order is None:
        day_exercises.append(next_item)
        return

    insert_index = len(day_exercises)
    for index, item in enumerate(day_exercises):
        try:
            current_order = int(str(item.get("slot_key") or "").split(":")[-1])
        except (TypeError, ValueError):
            continue
        if current_order > target_order:
            insert_index = index
            break

    day_exercises.insert(insert_index, next_item)


def revert_cycle_adaptation(payload, adaptation):
    previous_slot_payload = adaptation.previous_slot_payload
    if previous_slot_payload is None:
        raise ValueError("Missing previous slot payload.")

    day_exercises, exercise_index = find_slot_index(
        payload,
        adaptation.week_number,
        adaptation.weekday,
        adaptation.slot_key,
    )
    if day_exercises is None:
        raise ValueError("Adaptation target day not found.")

    previous_slot_key = previous_slot_payload.get("slot_key")
    if previous_slot_key != adaptation.slot_key:
        previous_slot_payload = {
            **previous_slot_payload,
            "slot_key": adaptation.slot_key,
        }

    if exercise_index is None:
        insert_slot_payload(day_exercises, previous_slot_payload)
        return

    day_exercises[exercise_index] = deepcopy(previous_slot_payload)


def apply_adaptations_to_payload(payload, adaptations):
    next_payload = deepcopy(payload)
    ordered_adaptations = sort_adaptations_for_application(adaptations)
    exercises = Exercise.objects.in_bulk(
        {
            adaptation.replacement_exercise_id
            for adaptation in ordered_adaptations
            if adaptation.replacement_exercise_id
        }
    )

    for adaptation in ordered_adaptations:
        matches = find_matching_slot_indexes(
            next_payload,
            scope=adaptation.scope,
            week_number=adaptation.week_number,
            weekday=adaptation.weekday,
            slot_key=adaptation.slot_key,
            original_exercise_id=adaptation.original_exercise_id,
        )
        if not matches:
            continue

        if adaptation.action == AdaptationAction.DELETE:
            matches_by_day = {}
            for _, _, day_exercises, exercise_index in matches:
                _, indices = matches_by_day.setdefault(id(day_exercises), (day_exercises, []))
                indices.append(exercise_index)
            for day_exercises, indices in matches_by_day.values():
                for exercise_index in sorted(indices, reverse=True):
                    day_exercises.pop(exercise_index)
            continue

        replacement_exercise = exercises.get(adaptation.replacement_exercise_id)
        if replacement_exercise is None:
            continue

        for _, _, day_exercises, exercise_index in matches:
            target = day_exercises[exercise_index]
            target["exercise_id"] = replacement_exercise.id
            if replacement_exercise.category == "ACCESSORY":
                target["one_rep_max_exercise_id"] = None

    return next_payload


def build_program_payload_with_future_adaptations(telegram_id, program):
    payload = build_base_program_payload(program)
    adaptations = list(
        ProgramAdaptation.objects.filter(
            telegram_id=telegram_id,
            program=program,
            scope=AdaptationScope.FUTURE_CYCLES,
            canceled_at__isnull=True,
        )
        .select_related("replacement_exercise")
    )
    if not adaptations:
        return payload
    return apply_adaptations_to_payload(payload, adaptations)
