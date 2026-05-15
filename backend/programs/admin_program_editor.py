import json

from django import forms
from django.core.exceptions import ValidationError
from django.db import transaction

from .models import (
    Day,
    DayExercise,
    DayTextBlockKind,
    DayTextBlock,
    Exercise,
    ExerciseSet,
    LoadType,
    Program,
    ProgramOneRepMaxExercise,
    UserProfile,
    Week,
    Weekday,
)
from .program_snapshot import build_base_program_payload
from .serializers import ProgramStructureInputSerializer


def _json_loads(raw_value, *, default):
    if not raw_value:
        return default
    try:
        return json.loads(raw_value)
    except json.JSONDecodeError as exc:
        raise ValidationError(f"Некорректный JSON: {exc.msg}.") from exc


def _flatten_errors(detail):
    if isinstance(detail, dict):
        messages = []
        for key, value in detail.items():
            for item in _flatten_errors(value):
                messages.append(f"{key}: {item}")
        return messages
    if isinstance(detail, list):
        messages = []
        for value in detail:
            messages.extend(_flatten_errors(value))
        return messages
    return [str(detail)]


def _get_editor_source_program(program):
    if (
        program.weeks.exists()
        or program.one_rep_max_exercises.exists()
        or program.source_program_id is None
    ):
        return program
    return program.source_program


def serialize_program_structure_for_editor(program):
    payload = build_base_program_payload(_get_editor_source_program(program))
    weeks = []
    for week in payload.get("weeks", []):
        days = []
        for day in week.get("days", []):
            days.append(
                {
                    "weekday": day["weekday"],
                    "title": day.get("title", ""),
                    "text_blocks": [
                        {
                            "kind": item["kind"],
                            "content": item["content"],
                        }
                        for item in day.get("text_blocks", [])
                    ],
                    "exercises": [
                        {
                            "exercise": item["exercise_id"],
                            "one_rep_max_exercise": item.get("one_rep_max_exercise_id"),
                            "superset_group": item.get("superset_group"),
                            "notes": item.get("notes", ""),
                            "sets": [
                                {
                                    "load_type": set_item["load_type"],
                                    "load_value": set_item.get("load_value"),
                                    "load_value_max": set_item.get("load_value_max"),
                                    "reps": set_item["reps"],
                                    "reps_max": set_item.get("reps_max"),
                                    "sets": set_item["sets"],
                                }
                                for set_item in item.get("sets", [])
                            ],
                        }
                        for item in day.get("exercises", [])
                    ],
                }
            )
        weeks.append({"title": week.get("title", ""), "days": days})
    return {"weeks": weeks}


def serialize_one_rep_max_config_for_editor(program):
    source_program = _get_editor_source_program(program)
    return [
        {
            "exercise_id": item.exercise_id,
            "label": item.label,
        }
        for item in source_program.one_rep_max_exercises.select_related(
            "exercise"
        ).order_by("order", "id")
    ]


def build_program_editor_state(program, *, one_rep_max_json=None, structure_json=None):
    try:
        one_rep_max_config = _json_loads(
            one_rep_max_json,
            default=serialize_one_rep_max_config_for_editor(program),
        )
    except ValidationError:
        one_rep_max_config = serialize_one_rep_max_config_for_editor(program)

    try:
        structure = _json_loads(
            structure_json,
            default=serialize_program_structure_for_editor(program),
        )
    except ValidationError:
        structure = serialize_program_structure_for_editor(program)

    return {
        "one_rep_max_config": one_rep_max_config,
        "structure": structure,
    }


def create_default_set():
    return {
        "load_type": LoadType.PERCENT,
        "load_value": 0,
        "load_value_max": None,
        "reps": 5,
        "reps_max": None,
        "sets": 1,
    }


def create_default_exercise():
    first_exercise = Exercise.objects.order_by("category", "name").first()
    return {
        "exercise": first_exercise.id if first_exercise else None,
        "one_rep_max_exercise": None,
        "superset_group": None,
        "notes": "",
        "sets": [create_default_set()],
    }


def create_default_text_block():
    return {
        "kind": DayTextBlockKind.INFO,
        "content": "",
    }


def create_default_day():
    return {
        "weekday": Weekday.MON,
        "title": "",
        "exercises": [create_default_exercise()],
        "text_blocks": [],
    }


def create_default_week():
    return {
        "title": "",
        "days": [],
    }


def create_default_orm():
    first_exercise = Exercise.objects.order_by("category", "name").first()
    return {
        "exercise_id": first_exercise.id if first_exercise else None,
        "label": "",
    }


def _read_int(post_data, name, default=0):
    try:
        return int(post_data.get(name, default))
    except (TypeError, ValueError):
        return default


def parse_server_render_editor_state(post_data):
    one_rep_max_config = []
    orm_total = _read_int(post_data, "orm-TOTAL_FORMS")
    for orm_index in range(orm_total):
        prefix = f"orm-{orm_index}"
        exercise_id = post_data.get(f"{prefix}-exercise_id")
        one_rep_max_config.append(
            {
                "exercise_id": int(exercise_id)
                if exercise_id not in (None, "")
                else None,
                "label": post_data.get(f"{prefix}-label", ""),
            }
        )

    weeks = []
    week_total = _read_int(post_data, "weeks-TOTAL_FORMS")
    for week_index in range(week_total):
        week_prefix = f"weeks-{week_index}"
        week = {
            "title": post_data.get(f"{week_prefix}-title", ""),
            "days": [],
        }

        day_total = _read_int(post_data, f"{week_prefix}-days-TOTAL_FORMS")
        for day_index in range(day_total):
            day_prefix = f"{week_prefix}-days-{day_index}"
            day = {
                "weekday": post_data.get(f"{day_prefix}-weekday", Weekday.MON),
                "title": post_data.get(f"{day_prefix}-title", ""),
                "exercises": [],
                "text_blocks": [],
            }

            exercise_total = _read_int(post_data, f"{day_prefix}-exercises-TOTAL_FORMS")
            for exercise_index in range(exercise_total):
                exercise_prefix = f"{day_prefix}-exercises-{exercise_index}"
                exercise_id = post_data.get(f"{exercise_prefix}-exercise")
                orm_exercise_id = post_data.get(
                    f"{exercise_prefix}-one_rep_max_exercise"
                )
                superset_group = post_data.get(f"{exercise_prefix}-superset_group")
                exercise = {
                    "exercise": int(exercise_id)
                    if exercise_id not in (None, "")
                    else None,
                    "one_rep_max_exercise": int(orm_exercise_id)
                    if orm_exercise_id not in (None, "")
                    else None,
                    "superset_group": int(superset_group)
                    if superset_group not in (None, "")
                    else None,
                    "notes": post_data.get(f"{exercise_prefix}-notes", ""),
                    "sets": [],
                }

                set_total = _read_int(post_data, f"{exercise_prefix}-sets-TOTAL_FORMS")
                for set_index in range(set_total):
                    set_prefix = f"{exercise_prefix}-sets-{set_index}"
                    load_value = post_data.get(f"{set_prefix}-load_value")
                    load_value_max = post_data.get(f"{set_prefix}-load_value_max")
                    reps = post_data.get(f"{set_prefix}-reps")
                    reps_max = post_data.get(f"{set_prefix}-reps_max")
                    sets = post_data.get(f"{set_prefix}-sets")
                    exercise["sets"].append(
                        {
                            "load_type": post_data.get(
                                f"{set_prefix}-load_type", LoadType.PERCENT
                            ),
                            "load_value": load_value if load_value != "" else None,
                            "load_value_max": load_value_max
                            if load_value_max != ""
                            else None,
                            "reps": int(reps) if reps not in (None, "") else 1,
                            "reps_max": int(reps_max)
                            if reps_max not in (None, "")
                            else None,
                            "sets": int(sets) if sets not in (None, "") else 1,
                        }
                    )

                day["exercises"].append(exercise)

            text_total = _read_int(post_data, f"{day_prefix}-text_blocks-TOTAL_FORMS")
            for text_index in range(text_total):
                text_prefix = f"{day_prefix}-text_blocks-{text_index}"
                day["text_blocks"].append(
                    {
                        "kind": post_data.get(
                            f"{text_prefix}-kind", DayTextBlockKind.INFO
                        ),
                        "content": post_data.get(f"{text_prefix}-content", ""),
                    }
                )

            week["days"].append(day)

        weeks.append(week)

    return {
        "one_rep_max_config": one_rep_max_config,
        "structure": {"weeks": weeks},
    }


def merge_active_week_post_into_editor_state(
    editor_state, post_data, active_week_index
):
    state = json.loads(json.dumps(editor_state))
    weeks = state.get("structure", {}).get("weeks", [])
    if not weeks or active_week_index < 0 or active_week_index >= len(weeks):
        return state

    week_prefix = f"weeks-{active_week_index}"
    week = {
        "title": post_data.get(f"{week_prefix}-title", ""),
        "days": [],
    }

    day_total = _read_int(post_data, f"{week_prefix}-days-TOTAL_FORMS")
    for day_index in range(day_total):
        day_prefix = f"{week_prefix}-days-{day_index}"
        day = {
            "weekday": post_data.get(f"{day_prefix}-weekday", Weekday.MON),
            "title": post_data.get(f"{day_prefix}-title", ""),
            "exercises": [],
            "text_blocks": [],
        }

        exercise_total = _read_int(post_data, f"{day_prefix}-exercises-TOTAL_FORMS")
        for exercise_index in range(exercise_total):
            exercise_prefix = f"{day_prefix}-exercises-{exercise_index}"
            exercise_id = post_data.get(f"{exercise_prefix}-exercise")
            orm_exercise_id = post_data.get(f"{exercise_prefix}-one_rep_max_exercise")
            superset_group = post_data.get(f"{exercise_prefix}-superset_group")
            exercise = {
                "exercise": int(exercise_id) if exercise_id not in (None, "") else None,
                "one_rep_max_exercise": int(orm_exercise_id)
                if orm_exercise_id not in (None, "")
                else None,
                "superset_group": int(superset_group)
                if superset_group not in (None, "")
                else None,
                "notes": post_data.get(f"{exercise_prefix}-notes", ""),
                "sets": [],
            }

            set_total = _read_int(post_data, f"{exercise_prefix}-sets-TOTAL_FORMS")
            for set_index in range(set_total):
                set_prefix = f"{exercise_prefix}-sets-{set_index}"
                load_value = post_data.get(f"{set_prefix}-load_value")
                load_value_max = post_data.get(f"{set_prefix}-load_value_max")
                reps = post_data.get(f"{set_prefix}-reps")
                reps_max = post_data.get(f"{set_prefix}-reps_max")
                sets = post_data.get(f"{set_prefix}-sets")
                exercise["sets"].append(
                    {
                        "load_type": post_data.get(
                            f"{set_prefix}-load_type", LoadType.PERCENT
                        ),
                        "load_value": load_value if load_value != "" else None,
                        "load_value_max": load_value_max
                        if load_value_max != ""
                        else None,
                        "reps": int(reps) if reps not in (None, "") else 1,
                        "reps_max": int(reps_max)
                        if reps_max not in (None, "")
                        else None,
                        "sets": int(sets) if sets not in (None, "") else 1,
                    }
                )

            day["exercises"].append(exercise)

        text_total = _read_int(post_data, f"{day_prefix}-text_blocks-TOTAL_FORMS")
        for text_index in range(text_total):
            text_prefix = f"{day_prefix}-text_blocks-{text_index}"
            day["text_blocks"].append(
                {
                    "kind": post_data.get(f"{text_prefix}-kind", DayTextBlockKind.INFO),
                    "content": post_data.get(f"{text_prefix}-content", ""),
                }
            )

        week["days"].append(day)

    state["structure"]["weeks"][active_week_index] = week
    return state


def apply_server_render_editor_action(editor_state, action):
    if not action:
        return editor_state

    state = json.loads(json.dumps(editor_state))
    parts = action.split(":")
    action_name = parts[0]

    if action_name == "add-week":
        state["structure"]["weeks"].append(create_default_week())
        return state
    if action_name == "remove-week" and len(parts) == 2:
        week_index = int(parts[1])
        if 0 <= week_index < len(state["structure"]["weeks"]):
            del state["structure"]["weeks"][week_index]
        return state
    if action_name == "add-day" and len(parts) == 2:
        week_index = int(parts[1])
        if 0 <= week_index < len(state["structure"]["weeks"]):
            state["structure"]["weeks"][week_index]["days"].append(create_default_day())
        return state
    if action_name == "remove-day" and len(parts) == 3:
        week_index = int(parts[1])
        day_index = int(parts[2])
        days = state["structure"]["weeks"][week_index]["days"]
        if 0 <= day_index < len(days):
            del days[day_index]
        return state
    if action_name == "add-exercise" and len(parts) == 3:
        week_index = int(parts[1])
        day_index = int(parts[2])
        state["structure"]["weeks"][week_index]["days"][day_index]["exercises"].append(
            create_default_exercise()
        )
        return state
    if action_name == "remove-exercise" and len(parts) == 4:
        week_index = int(parts[1])
        day_index = int(parts[2])
        exercise_index = int(parts[3])
        exercises = state["structure"]["weeks"][week_index]["days"][day_index][
            "exercises"
        ]
        if 0 <= exercise_index < len(exercises):
            del exercises[exercise_index]
        return state
    if action_name == "add-set" and len(parts) == 4:
        week_index = int(parts[1])
        day_index = int(parts[2])
        exercise_index = int(parts[3])
        state["structure"]["weeks"][week_index]["days"][day_index]["exercises"][
            exercise_index
        ]["sets"].append(create_default_set())
        return state
    if action_name == "remove-set" and len(parts) == 5:
        week_index = int(parts[1])
        day_index = int(parts[2])
        exercise_index = int(parts[3])
        set_index = int(parts[4])
        sets = state["structure"]["weeks"][week_index]["days"][day_index]["exercises"][
            exercise_index
        ]["sets"]
        if 0 <= set_index < len(sets):
            del sets[set_index]
        return state
    if action_name == "add-text-block" and len(parts) == 3:
        week_index = int(parts[1])
        day_index = int(parts[2])
        state["structure"]["weeks"][week_index]["days"][day_index][
            "text_blocks"
        ].append(create_default_text_block())
        return state
    if action_name == "remove-text-block" and len(parts) == 4:
        week_index = int(parts[1])
        day_index = int(parts[2])
        text_index = int(parts[3])
        text_blocks = state["structure"]["weeks"][week_index]["days"][day_index][
            "text_blocks"
        ]
        if 0 <= text_index < len(text_blocks):
            del text_blocks[text_index]
        return state
    if action_name == "add-orm":
        state["one_rep_max_config"].append(create_default_orm())
        return state
    if action_name == "remove-orm" and len(parts) == 2:
        orm_index = int(parts[1])
        if 0 <= orm_index < len(state["one_rep_max_config"]):
            del state["one_rep_max_config"][orm_index]
        return state

    return state


class ProgramOrmEditorItemForm(forms.Form):
    exercise_id = forms.ModelChoiceField(
        queryset=Exercise.objects.order_by("category", "name"),
        label="Упражнение",
    )
    label = forms.CharField(max_length=200, required=False, label="Подпись")


class ProgramWeekEditorItemForm(forms.Form):
    title = forms.CharField(max_length=100, required=False, label="Заголовок недели")


class ProgramDayEditorItemForm(forms.Form):
    weekday = forms.ChoiceField(choices=Weekday.choices, label="День недели")
    title = forms.CharField(max_length=200, required=False, label="Заголовок дня")


class ProgramExerciseEditorItemForm(forms.Form):
    exercise = forms.ModelChoiceField(
        queryset=Exercise.objects.order_by("category", "name"),
        label="Упражнение",
    )
    one_rep_max_exercise = forms.ModelChoiceField(
        queryset=Exercise.objects.order_by("category", "name"),
        required=False,
        label="Привязка к 1ПМ",
    )
    superset_group = forms.IntegerField(
        required=False, min_value=1, label="Группа суперсета"
    )
    notes = forms.CharField(
        required=False,
        label="Заметки",
        widget=forms.Textarea(attrs={"rows": 2}),
    )


class ProgramExerciseSetEditorItemForm(forms.Form):
    load_type = forms.ChoiceField(choices=LoadType.choices, label="Тип нагрузки")
    load_value = forms.DecimalField(
        required=False, decimal_places=1, max_digits=6, label="От"
    )
    load_value_max = forms.DecimalField(
        required=False, decimal_places=1, max_digits=6, label="До"
    )
    reps = forms.IntegerField(min_value=1, label="Повторения")
    reps_max = forms.IntegerField(required=False, min_value=1, label="До повторений")
    sets = forms.IntegerField(min_value=1, label="Подходов")


class ProgramTextBlockEditorItemForm(forms.Form):
    kind = forms.ChoiceField(choices=DayTextBlockKind.choices, label="Тип блока")
    content = forms.CharField(label="Текст", widget=forms.Textarea(attrs={"rows": 3}))


class ProgramWeekSelectorForm(forms.Form):
    active_week = forms.ChoiceField(label="Неделя")

    def __init__(self, *args, weeks, active_week=0, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields["active_week"].choices = [
            (str(week.id), week.title or f"Неделя {week.number}") for week in weeks
        ]
        self.initial["active_week"] = str(active_week) if active_week else ""


class ProgramWeekEditorModelForm(forms.ModelForm):
    class Meta:
        model = Week
        fields = ["title"]
        labels = {"title": "Заголовок недели"}


class ProgramDayEditorModelForm(forms.ModelForm):
    class Meta:
        model = Day
        fields = ["weekday", "title"]
        labels = {"title": "Заголовок дня"}


class ProgramDayExerciseEditorModelForm(forms.ModelForm):
    class Meta:
        model = DayExercise
        fields = ["exercise", "one_rep_max_exercise", "superset_group", "notes"]
        widgets = {"notes": forms.Textarea(attrs={"rows": 2})}


class ProgramExerciseSetEditorModelForm(forms.ModelForm):
    class Meta:
        model = ExerciseSet
        fields = [
            "load_type",
            "load_value",
            "load_value_max",
            "reps",
            "reps_max",
            "sets",
        ]


class ProgramDayTextBlockEditorModelForm(forms.ModelForm):
    class Meta:
        model = DayTextBlock
        fields = ["kind", "content"]
        widgets = {"content": forms.Textarea(attrs={"rows": 3})}


def _renumber_weeks(program):
    for index, week in enumerate(program.weeks.order_by("number", "id"), start=1):
        if week.number != index:
            Week.objects.filter(pk=week.pk).update(number=index)


def _renumber_days(week):
    for index, day in enumerate(week.days.order_by("order", "id"), start=1):
        if day.order != index:
            Day.objects.filter(pk=day.pk).update(order=index)


def _renumber_exercises(day):
    for index, exercise in enumerate(day.exercises.order_by("order", "id"), start=1):
        if exercise.order != index:
            DayExercise.objects.filter(pk=exercise.pk).update(order=index)


def _renumber_sets(day_exercise):
    for index, set_item in enumerate(
        day_exercise.sets.order_by("order", "id"), start=1
    ):
        if set_item.order != index:
            ExerciseSet.objects.filter(pk=set_item.pk).update(order=index)


def _renumber_text_blocks(day):
    for index, text_block in enumerate(
        day.text_blocks.order_by("order", "id"), start=1
    ):
        if text_block.order != index:
            DayTextBlock.objects.filter(pk=text_block.pk).update(order=index)


def _get_next_available_weekday(week):
    used = set(week.days.values_list("weekday", flat=True))
    for value, _label in Weekday.choices:
        if value not in used:
            return value
    return None


def get_editor_selection(program, week_id=None, day_id=None):
    weeks = list(program.weeks.order_by("number", "id").prefetch_related("days"))
    if not weeks:
        return weeks, None, None

    active_week = next(
        (week for week in weeks if str(week.id) == str(week_id)), weeks[0]
    )
    days = list(active_week.days.order_by("order", "id"))
    if not days:
        return weeks, active_week, None

    active_day = next((day for day in days if str(day.id) == str(day_id)), days[0])
    return weeks, active_week, active_day


def perform_editor_action(program, action, active_week_id=None, active_day_id=None):
    weeks, active_week, active_day = get_editor_selection(
        program, active_week_id, active_day_id
    )

    if action == "add-week":
        week = Week.objects.create(
            program=program, number=program.weeks.count() + 1, title=""
        )
        return week.id, None

    if action == "select-week":
        return active_week_id, None

    if action and action.startswith("remove-week:"):
        week_id = int(action.split(":")[1])
        week = program.weeks.filter(pk=week_id).first()
        if week:
            week.delete()
            _renumber_weeks(program)
        weeks, active_week, active_day = get_editor_selection(program)
        return (
            active_week.id if active_week else None,
            active_day.id if active_day else None,
        )

    if action and action.startswith("add-day:"):
        week_id = int(action.split(":")[1])
        week = program.weeks.filter(pk=week_id).first()
        if week:
            weekday = _get_next_available_weekday(week)
            if weekday:
                day = Day.objects.create(
                    week=week,
                    weekday=weekday,
                    order=week.days.count() + 1,
                    title="",
                )
                return week.id, day.id
        return (
            active_week.id if active_week else None,
            active_day.id if active_day else None,
        )

    if action and action.startswith("remove-day:"):
        day_id = int(action.split(":")[1])
        day = (
            Day.objects.filter(pk=day_id, week__program=program)
            .select_related("week")
            .first()
        )
        if day:
            week = day.week
            day.delete()
            _renumber_days(week)
            remaining_day = week.days.order_by("order", "id").first()
            return week.id, remaining_day.id if remaining_day else None
        return (
            active_week.id if active_week else None,
            active_day.id if active_day else None,
        )

    if action and action.startswith("add-exercise:"):
        day_id = int(action.split(":")[1])
        day = Day.objects.filter(pk=day_id, week__program=program).first()
        first_exercise = Exercise.objects.order_by("category", "name").first()
        if day and first_exercise:
            day_exercise = DayExercise.objects.create(
                day=day,
                exercise=first_exercise,
                order=day.exercises.count() + 1,
            )
            ExerciseSet.objects.create(
                day_exercise=day_exercise,
                load_type=LoadType.PERCENT,
                load_value=0,
                reps=5,
                sets=1,
                order=1,
            )
            return day.week_id, day.id
        return (
            active_week.id if active_week else None,
            active_day.id if active_day else None,
        )

    if action and action.startswith("remove-exercise:"):
        exercise_id = int(action.split(":")[1])
        day_exercise = (
            DayExercise.objects.filter(pk=exercise_id, day__week__program=program)
            .select_related("day")
            .first()
        )
        if day_exercise:
            day = day_exercise.day
            day_exercise.delete()
            _renumber_exercises(day)
            return day.week_id, day.id
        return (
            active_week.id if active_week else None,
            active_day.id if active_day else None,
        )

    if action and action.startswith("add-set:"):
        exercise_id = int(action.split(":")[1])
        day_exercise = DayExercise.objects.filter(
            pk=exercise_id, day__week__program=program
        ).first()
        if day_exercise:
            ExerciseSet.objects.create(
                day_exercise=day_exercise,
                load_type=LoadType.PERCENT,
                load_value=0,
                reps=5,
                sets=1,
                order=day_exercise.sets.count() + 1,
            )
            return day_exercise.day.week_id, day_exercise.day_id
        return (
            active_week.id if active_week else None,
            active_day.id if active_day else None,
        )

    if action and action.startswith("remove-set:"):
        set_id = int(action.split(":")[1])
        set_item = (
            ExerciseSet.objects.filter(
                pk=set_id, day_exercise__day__week__program=program
            )
            .select_related("day_exercise__day")
            .first()
        )
        if set_item:
            day_exercise = set_item.day_exercise
            day = day_exercise.day
            set_item.delete()
            _renumber_sets(day_exercise)
            return day.week_id, day.id
        return (
            active_week.id if active_week else None,
            active_day.id if active_day else None,
        )

    if action and action.startswith("add-text-block:"):
        day_id = int(action.split(":")[1])
        day = Day.objects.filter(pk=day_id, week__program=program).first()
        if day:
            DayTextBlock.objects.create(
                day=day,
                kind=DayTextBlockKind.INFO,
                content="",
                order=day.text_blocks.count() + 1,
            )
            return day.week_id, day.id
        return (
            active_week.id if active_week else None,
            active_day.id if active_day else None,
        )

    if action and action.startswith("remove-text-block:"):
        text_id = int(action.split(":")[1])
        text_block = (
            DayTextBlock.objects.filter(pk=text_id, day__week__program=program)
            .select_related("day")
            .first()
        )
        if text_block:
            day = text_block.day
            text_block.delete()
            _renumber_text_blocks(day)
            return day.week_id, day.id
        return (
            active_week.id if active_week else None,
            active_day.id if active_day else None,
        )

    return (
        active_week.id if active_week else None,
        active_day.id if active_day else None,
    )


def build_server_render_editor_context(
    program, active_week_id=None, active_day_id=None, bound_data=None
):
    weeks, active_week, active_day = get_editor_selection(
        program, active_week_id, active_day_id
    )
    week_selector_form = (
        ProgramWeekSelectorForm(
            data=bound_data if bound_data and "active_week" in bound_data else None,
            weeks=weeks,
            active_week=active_week.id if active_week else None,
        )
        if weeks
        else None
    )

    active_week_form = None
    active_day_form = None
    exercise_items = []
    text_block_items = []

    if active_week:
        active_week_form = ProgramWeekEditorModelForm(
            bound_data if bound_data else None,
            instance=active_week,
            prefix=f"week-{active_week.id}",
        )

    if active_day:
        active_day_form = ProgramDayEditorModelForm(
            bound_data if bound_data else None,
            instance=active_day,
            prefix=f"day-{active_day.id}",
        )

        exercises = (
            active_day.exercises.select_related("exercise", "one_rep_max_exercise")
            .prefetch_related("sets")
            .order_by("order", "id")
        )
        for exercise in exercises:
            exercise_form = ProgramDayExerciseEditorModelForm(
                bound_data if bound_data else None,
                instance=exercise,
                prefix=f"exercise-{exercise.id}",
            )
            set_forms = [
                ProgramExerciseSetEditorModelForm(
                    bound_data if bound_data else None,
                    instance=set_item,
                    prefix=f"set-{set_item.id}",
                )
                for set_item in exercise.sets.order_by("order", "id")
            ]
            exercise_items.append(
                {"object": exercise, "form": exercise_form, "set_forms": set_forms}
            )

        for text_block in active_day.text_blocks.order_by("order", "id"):
            text_block_form = ProgramDayTextBlockEditorModelForm(
                bound_data if bound_data else None,
                instance=text_block,
                prefix=f"text-{text_block.id}",
            )
            text_block_items.append({"object": text_block, "form": text_block_form})

    return {
        "weeks": weeks,
        "active_week": active_week,
        "active_day": active_day,
        "week_selector_form": week_selector_form,
        "active_week_form": active_week_form,
        "active_day_form": active_day_form,
        "exercise_items": exercise_items,
        "text_block_items": text_block_items,
    }


def save_active_week_day(program, active_week_id, active_day_id, post_data):
    weeks, active_week, active_day = get_editor_selection(
        program, active_week_id, active_day_id
    )
    if not active_week:
        return True

    forms_to_save = []
    week_form = ProgramWeekEditorModelForm(
        post_data, instance=active_week, prefix=f"week-{active_week.id}"
    )
    if not week_form.is_valid():
        return False
    forms_to_save.append(week_form)

    if active_day:
        day_form = ProgramDayEditorModelForm(
            post_data, instance=active_day, prefix=f"day-{active_day.id}"
        )
        if not day_form.is_valid():
            return False
        forms_to_save.append(day_form)

        for exercise in active_day.exercises.order_by("order", "id"):
            exercise_form = ProgramDayExerciseEditorModelForm(
                post_data,
                instance=exercise,
                prefix=f"exercise-{exercise.id}",
            )
            if not exercise_form.is_valid():
                return False
            forms_to_save.append(exercise_form)
            for set_item in exercise.sets.order_by("order", "id"):
                set_form = ProgramExerciseSetEditorModelForm(
                    post_data,
                    instance=set_item,
                    prefix=f"set-{set_item.id}",
                )
                if not set_form.is_valid():
                    return False
                forms_to_save.append(set_form)

        for text_block in active_day.text_blocks.order_by("order", "id"):
            text_form = ProgramDayTextBlockEditorModelForm(
                post_data,
                instance=text_block,
                prefix=f"text-{text_block.id}",
            )
            if not text_form.is_valid():
                return False
            forms_to_save.append(text_form)

    for item_form in forms_to_save:
        item_form.save()
    return True


class ProgramEditorForm(forms.Form):
    name = forms.CharField(max_length=200, label="Название")
    slug = forms.SlugField(max_length=100, label="Slug")
    description = forms.CharField(
        label="Описание",
        required=False,
        widget=forms.Textarea(attrs={"rows": 3}),
    )
    owner = forms.ModelChoiceField(
        queryset=UserProfile.objects.none(),
        required=False,
        label="Владелец",
    )
    source_program = forms.ModelChoiceField(
        queryset=Program.objects.none(),
        required=False,
        label="Базовая программа-источник",
    )
    one_rep_max_config = forms.CharField(widget=forms.HiddenInput())
    structure = forms.CharField(widget=forms.HiddenInput())

    def __init__(self, *args, instance, **kwargs):
        super().__init__(*args, **kwargs)
        self.instance = instance
        self.fields["owner"].queryset = UserProfile.objects.select_related(
            "user"
        ).order_by("user__username")
        self.fields["source_program"].queryset = Program.objects.order_by(
            "name"
        ).exclude(pk=instance.pk)

        if not self.is_bound:
            self.initial.update(
                {
                    "name": instance.name,
                    "slug": instance.slug,
                    "description": instance.description,
                    "owner": instance.owner_id,
                    "source_program": instance.source_program_id,
                    "one_rep_max_config": json.dumps(
                        serialize_one_rep_max_config_for_editor(instance),
                        ensure_ascii=False,
                    ),
                    "structure": json.dumps(
                        serialize_program_structure_for_editor(instance),
                        ensure_ascii=False,
                    ),
                }
            )

    def clean_slug(self):
        slug = self.cleaned_data["slug"]
        if Program.objects.exclude(pk=self.instance.pk).filter(slug=slug).exists():
            raise ValidationError("Программа с таким slug уже существует.")
        return slug

    def clean_source_program(self):
        source_program = self.cleaned_data.get("source_program")
        if source_program and source_program.pk == self.instance.pk:
            raise ValidationError("Программа не может ссылаться сама на себя.")
        return source_program

    def clean_one_rep_max_config(self):
        raw_items = _json_loads(self.data.get("one_rep_max_config"), default=[])
        if not isinstance(raw_items, list):
            raise ValidationError("Конфиг 1ПМ должен быть списком.")

        exercise_ids = []
        for item in raw_items:
            if not isinstance(item, dict):
                raise ValidationError("Каждая запись 1ПМ должна быть объектом.")
            exercise_id = item.get("exercise_id")
            if exercise_id in (None, ""):
                raise ValidationError("Для каждой записи 1ПМ нужно выбрать упражнение.")
            try:
                exercise_ids.append(int(exercise_id))
            except (TypeError, ValueError) as exc:
                raise ValidationError("ID упражнения 1ПМ должен быть числом.") from exc

        if len(exercise_ids) != len(set(exercise_ids)):
            raise ValidationError("Упражнения 1ПМ не должны повторяться.")

        exercises = Exercise.objects.in_bulk(exercise_ids)
        missing_ids = [
            exercise_id for exercise_id in exercise_ids if exercise_id not in exercises
        ]
        if missing_ids:
            raise ValidationError(
                f"Не найдены упражнения: {', '.join(str(item) for item in missing_ids)}."
            )

        normalized = []
        for order, item in enumerate(raw_items, start=1):
            exercise_id = int(item["exercise_id"])
            normalized.append(
                {
                    "exercise": exercises[exercise_id],
                    "label": str(item.get("label", "")).strip(),
                    "order": order,
                }
            )
        return normalized

    def clean_structure(self):
        raw_structure = _json_loads(self.data.get("structure"), default={"weeks": []})
        if not isinstance(raw_structure, dict):
            raise ValidationError("Структура программы должна быть объектом.")

        serializer = ProgramStructureInputSerializer(
            data={"weeks": raw_structure.get("weeks", [])}
        )
        if not serializer.is_valid():
            raise ValidationError(_flatten_errors(serializer.errors))
        return serializer.validated_data["normalized_payload"]

    @transaction.atomic
    def save(self):
        program = self.instance
        program.name = self.cleaned_data["name"]
        program.slug = self.cleaned_data["slug"]
        program.description = self.cleaned_data["description"]
        program.owner = self.cleaned_data["owner"]
        program.source_program = self.cleaned_data["source_program"]
        program.save()

        ProgramOneRepMaxExercise.objects.filter(program=program).delete()
        for item in self.cleaned_data["one_rep_max_config"]:
            ProgramOneRepMaxExercise.objects.create(
                program=program,
                exercise=item["exercise"],
                label=item["label"],
                order=item["order"],
            )

        Week.objects.filter(program=program).delete()

        normalized_payload = self.cleaned_data["structure"]
        payload_exercise_ids = set()
        for week in normalized_payload.get("weeks", []):
            for day in week.get("days", []):
                for exercise in day.get("exercises", []):
                    payload_exercise_ids.add(exercise["exercise_id"])
                    if exercise.get("one_rep_max_exercise_id"):
                        payload_exercise_ids.add(exercise["one_rep_max_exercise_id"])
        exercises = Exercise.objects.in_bulk(payload_exercise_ids)

        for week_index, week_data in enumerate(
            normalized_payload.get("weeks", []), start=1
        ):
            week = Week.objects.create(
                program=program,
                number=week_index,
                title=week_data.get("title", ""),
            )
            for day_index, day_data in enumerate(week_data.get("days", []), start=1):
                day = Day.objects.create(
                    week=week,
                    weekday=day_data["weekday"],
                    order=day_index,
                    title=day_data.get("title", ""),
                )
                for exercise_index, exercise_data in enumerate(
                    day_data.get("exercises", []), start=1
                ):
                    day_exercise = DayExercise.objects.create(
                        day=day,
                        exercise=exercises[exercise_data["exercise_id"]],
                        one_rep_max_exercise=exercises.get(
                            exercise_data.get("one_rep_max_exercise_id")
                        ),
                        order=exercise_index,
                        superset_group=exercise_data.get("superset_group"),
                        notes=exercise_data.get("notes", ""),
                    )
                    for set_index, set_data in enumerate(
                        exercise_data.get("sets", []), start=1
                    ):
                        ExerciseSet.objects.create(
                            day_exercise=day_exercise,
                            load_type=set_data["load_type"],
                            load_value=set_data.get("load_value"),
                            load_value_max=set_data.get("load_value_max"),
                            reps=set_data["reps"],
                            reps_max=set_data.get("reps_max"),
                            sets=set_data["sets"],
                            order=set_index,
                        )

                for text_block_index, text_block in enumerate(
                    day_data.get("text_blocks", []), start=1
                ):
                    DayTextBlock.objects.create(
                        day=day,
                        kind=text_block["kind"],
                        content=text_block["content"],
                        order=text_block_index,
                    )

        return program
