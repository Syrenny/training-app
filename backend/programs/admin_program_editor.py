import json

from django import forms
from django.core.exceptions import ValidationError
from django.db import transaction

from .models import (
    Day,
    DayExercise,
    DayTextBlock,
    Exercise,
    ExerciseSet,
    Program,
    ProgramOneRepMaxExercise,
    UserProfile,
    Week,
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
    if program.weeks.exists() or program.one_rep_max_exercises.exists() or program.source_program_id is None:
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
        for item in source_program.one_rep_max_exercises.select_related("exercise").order_by("order", "id")
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
        self.fields["owner"].queryset = UserProfile.objects.select_related("user").order_by("user__username")
        self.fields["source_program"].queryset = Program.objects.order_by("name").exclude(pk=instance.pk)

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
        missing_ids = [exercise_id for exercise_id in exercise_ids if exercise_id not in exercises]
        if missing_ids:
            raise ValidationError(f"Не найдены упражнения: {', '.join(str(item) for item in missing_ids)}.")

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

        serializer = ProgramStructureInputSerializer(data={"weeks": raw_structure.get("weeks", [])})
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

        for week_index, week_data in enumerate(normalized_payload.get("weeks", []), start=1):
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
                for exercise_index, exercise_data in enumerate(day_data.get("exercises", []), start=1):
                    day_exercise = DayExercise.objects.create(
                        day=day,
                        exercise=exercises[exercise_data["exercise_id"]],
                        one_rep_max_exercise=exercises.get(exercise_data.get("one_rep_max_exercise_id")),
                        order=exercise_index,
                        superset_group=exercise_data.get("superset_group"),
                        notes=exercise_data.get("notes", ""),
                    )
                    for set_index, set_data in enumerate(exercise_data.get("sets", []), start=1):
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

                for text_block_index, text_block in enumerate(day_data.get("text_blocks", []), start=1):
                    DayTextBlock.objects.create(
                        day=day,
                        kind=text_block["kind"],
                        content=text_block["content"],
                        order=text_block_index,
                    )

        return program
