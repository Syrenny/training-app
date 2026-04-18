from rest_framework import serializers

from .models import (
    AccessoryWeight,
    AdaptationAction,
    AdaptationScope,
    CycleOneRepMax,
    Day,
    DayExercise,
    DayTextBlock,
    DayTextBlockKind,
    Exercise,
    ExerciseCategory,
    ExerciseSet,
    LoadType,
    OneRepMax,
    Program,
    ProgramAdaptation,
    ProgramOneRepMaxExercise,
    TrainingCycle,
    Week,
    Weekday,
    WorkoutCompletion,
)
from .program_snapshot import WEEKDAY_SORT_ORDER, decimal_to_json, normalize_week_title


class OneRepMaxItemSerializer(serializers.Serializer):
    exercise_id = serializers.IntegerField()
    exercise_name = serializers.CharField()
    category = serializers.ChoiceField(choices=ExerciseCategory.choices)
    label = serializers.CharField()
    value = serializers.IntegerField(min_value=0, max_value=999)


class OneRepMaxResponseSerializer(serializers.Serializer):
    cycle_id = serializers.IntegerField(allow_null=True)
    program_id = serializers.IntegerField(allow_null=True)
    items = OneRepMaxItemSerializer(many=True)


class OneRepMaxUpdateItemSerializer(serializers.Serializer):
    exercise_id = serializers.IntegerField()
    value = serializers.IntegerField(min_value=0, max_value=999)


class OneRepMaxUpdateSerializer(serializers.Serializer):
    items = OneRepMaxUpdateItemSerializer(many=True)

    def validate_items(self, value):
        exercise_ids = [item["exercise_id"] for item in value]
        if len(exercise_ids) != len(set(exercise_ids)):
            raise serializers.ValidationError("Упражнения 1ПМ не должны повторяться.")
        return value


class ExerciseSetSerializer(serializers.ModelSerializer):
    display = serializers.CharField(read_only=True)

    class Meta:
        model = ExerciseSet
        fields = [
            "id",
            "order",
            "load_type",
            "load_value",
            "load_value_max",
            "reps",
            "reps_max",
            "sets",
            "display",
        ]


class ExerciseSerializer(serializers.ModelSerializer):
    class Meta:
        model = Exercise
        fields = ["id", "name", "category"]


class DayExerciseSerializer(serializers.ModelSerializer):
    exercise = ExerciseSerializer(read_only=True)
    sets = ExerciseSetSerializer(many=True, read_only=True)
    one_rep_max_exercise_id = serializers.IntegerField(read_only=True)
    slot_key = serializers.SerializerMethodField()

    class Meta:
        model = DayExercise
        fields = [
            "id",
            "order",
            "slot_key",
            "exercise",
            "sets",
            "superset_group",
            "notes",
            "one_rep_max_exercise_id",
        ]

    def get_slot_key(self, obj):
        return f"{obj.day.week.number}:{obj.day.weekday}:{obj.order}"


class DayTextBlockSerializer(serializers.ModelSerializer):
    class Meta:
        model = DayTextBlock
        fields = ["kind", "content", "order"]


class DaySerializer(serializers.ModelSerializer):
    exercises = DayExerciseSerializer(many=True, read_only=True)
    weekday_display = serializers.CharField(read_only=True)
    text_blocks = DayTextBlockSerializer(many=True, read_only=True)

    class Meta:
        model = Day
        fields = ["id", "weekday", "weekday_display", "title", "exercises", "text_blocks"]


class WeekListSerializer(serializers.ModelSerializer):
    class Meta:
        model = Week
        fields = ["id", "number", "title"]


class WorkoutCompletionSerializer(serializers.ModelSerializer):
    completed_at = serializers.DateTimeField(read_only=True)

    class Meta:
        model = WorkoutCompletion
        fields = ["week_number", "weekday", "completed_at"]


class ProgramSerializer(serializers.ModelSerializer):
    one_rep_max_exercises = serializers.SerializerMethodField()

    class Meta:
        model = Program
        fields = ["id", "slug", "name", "description", "one_rep_max_exercises"]

    def get_one_rep_max_exercises(self, obj):
        items = obj.one_rep_max_exercises.select_related("exercise").all()
        return ProgramOneRepMaxExerciseSerializer(items, many=True).data


class ProgramOneRepMaxExerciseSerializer(serializers.ModelSerializer):
    exercise = ExerciseSerializer(read_only=True)
    exercise_id = serializers.IntegerField(read_only=True)

    class Meta:
        model = ProgramOneRepMaxExercise
        fields = ["exercise_id", "label", "order", "exercise"]


class AccessoryWeightSerializer(serializers.ModelSerializer):
    week_number = serializers.IntegerField(source="week.number", read_only=True, default=None)

    class Meta:
        model = AccessoryWeight
        fields = ["weight", "sets_display", "recorded_date", "week_number"]


class WeekDetailSerializer(serializers.ModelSerializer):
    days = DaySerializer(many=True, read_only=True)

    class Meta:
        model = Week
        fields = ["id", "number", "title", "days"]


class ProgramSetInputSerializer(serializers.Serializer):
    load_type = serializers.ChoiceField(choices=LoadType.choices)
    load_value = serializers.DecimalField(
        max_digits=6,
        decimal_places=1,
        required=False,
        allow_null=True,
    )
    load_value_max = serializers.DecimalField(
        max_digits=6,
        decimal_places=1,
        required=False,
        allow_null=True,
    )
    reps = serializers.IntegerField(min_value=1)
    reps_max = serializers.IntegerField(required=False, allow_null=True, min_value=1)
    sets = serializers.IntegerField(min_value=1)

    def validate(self, attrs):
        load_type = attrs["load_type"]
        load_value = attrs.get("load_value")
        load_value_max = attrs.get("load_value_max")
        reps_max = attrs.get("reps_max")
        if load_type in (LoadType.PERCENT, LoadType.KG) and load_value is None:
            raise serializers.ValidationError("Для этого типа нагрузки нужно значение.")
        if load_type in (LoadType.INDIVIDUAL, LoadType.BODYWEIGHT) and load_value is not None:
            raise serializers.ValidationError("Для этого типа нагрузки значение не используется.")
        if load_type in (LoadType.INDIVIDUAL, LoadType.BODYWEIGHT) and load_value_max is not None:
            raise serializers.ValidationError("Для этого типа нагрузки диапазон не используется.")
        if load_value is not None and load_value_max is not None and load_value_max < load_value:
            raise serializers.ValidationError("Максимальная нагрузка не может быть меньше минимальной.")
        if reps_max is not None and reps_max < attrs["reps"]:
            raise serializers.ValidationError("Максимум повторений не может быть меньше минимума.")
        return attrs


class ProgramExerciseInputSerializer(serializers.Serializer):
    exercise = serializers.PrimaryKeyRelatedField(queryset=Exercise.objects.all())
    one_rep_max_exercise = serializers.PrimaryKeyRelatedField(
        queryset=Exercise.objects.all(),
        required=False,
        allow_null=True,
    )
    superset_group = serializers.IntegerField(required=False, allow_null=True, min_value=1)
    notes = serializers.CharField(required=False, allow_blank=True)
    sets = ProgramSetInputSerializer(many=True, allow_empty=False)


class ProgramTextBlockInputSerializer(serializers.Serializer):
    kind = serializers.ChoiceField(choices=DayTextBlockKind.choices)
    content = serializers.CharField(allow_blank=False)


class ProgramDayInputSerializer(serializers.Serializer):
    weekday = serializers.ChoiceField(choices=Weekday.choices)
    title = serializers.CharField(required=False, allow_blank=True, max_length=200)
    exercises = ProgramExerciseInputSerializer(many=True, required=False)
    text_blocks = ProgramTextBlockInputSerializer(many=True, required=False)


class ProgramWeekInputSerializer(serializers.Serializer):
    title = serializers.CharField(required=False, allow_blank=True, max_length=100)
    days = ProgramDayInputSerializer(many=True, required=False)

    def validate(self, attrs):
        weekdays = [day["weekday"] for day in attrs.get("days", [])]
        if len(set(weekdays)) != len(weekdays):
            raise serializers.ValidationError("Дни недели внутри недели не должны повторяться.")
        attrs["days"] = sorted(
            attrs.get("days", []),
            key=lambda day: WEEKDAY_SORT_ORDER.get(day["weekday"], 99),
        )
        return attrs


class ProgramSnapshotInputSerializer(serializers.Serializer):
    commit_message = serializers.CharField(max_length=255, allow_blank=False, trim_whitespace=True)
    source_snapshot_version = serializers.IntegerField(required=False, allow_null=True, min_value=1)
    weeks = ProgramWeekInputSerializer(many=True)

    def validate(self, attrs):
        normalized_weeks = []
        for week_index, week in enumerate(attrs["weeks"], start=1):
            normalized_weeks.append(
                {
                    "number": week_index,
                    "title": normalize_week_title(week.get("title"), week_index),
                    "days": [
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
                                    "exercise_id": exercise["exercise"].id,
                                    "one_rep_max_exercise_id": (
                                        exercise["one_rep_max_exercise"].id
                                        if exercise.get("one_rep_max_exercise")
                                        else None
                                    ),
                                    "superset_group": exercise.get("superset_group"),
                                    "notes": exercise.get("notes", ""),
                                    "sets": [
                                        {
                                            "load_type": set_item["load_type"],
                                            "load_value": decimal_to_json(set_item.get("load_value")),
                                            "load_value_max": decimal_to_json(set_item.get("load_value_max")),
                                            "reps": set_item["reps"],
                                            "reps_max": set_item.get("reps_max"),
                                            "sets": set_item["sets"],
                                        }
                                        for set_item in exercise["sets"]
                                    ],
                                }
                                for exercise in day.get("exercises", [])
                            ],
                        }
                        for day in week.get("days", [])
                    ],
                }
            )
        attrs["normalized_payload"] = {"weeks": normalized_weeks}
        return attrs


class TrainingCycleSummarySerializer(serializers.ModelSerializer):
    program_id = serializers.IntegerField(source="program.id", read_only=True)
    program_name = serializers.CharField(source="program.name", read_only=True)
    is_active = serializers.BooleanField(read_only=True)

    class Meta:
        model = TrainingCycle
        fields = [
            "id",
            "program_id",
            "program_name",
            "started_at",
            "completed_at",
            "completion_reason",
            "completion_feeling",
            "is_active",
        ]


class TrainingCycleStartSerializer(serializers.Serializer):
    program_id = serializers.IntegerField(min_value=1)
    items = OneRepMaxUpdateItemSerializer(many=True)

    def validate_items(self, value):
        exercise_ids = [item["exercise_id"] for item in value]
        if len(exercise_ids) != len(set(exercise_ids)):
            raise serializers.ValidationError("Упражнения 1ПМ не должны повторяться.")
        return value


class TrainingCycleFinishSerializer(serializers.Serializer):
    reason = serializers.CharField(max_length=255, allow_blank=False, trim_whitespace=True)
    feeling = serializers.CharField(allow_blank=False, trim_whitespace=True)


class ProgramAdaptationCreateSerializer(serializers.Serializer):
    program_id = serializers.IntegerField(min_value=1)
    scope = serializers.ChoiceField(choices=AdaptationScope.choices)
    action = serializers.ChoiceField(choices=AdaptationAction.choices)
    slot_key = serializers.CharField(max_length=100)
    week_number = serializers.IntegerField(min_value=1)
    weekday = serializers.ChoiceField(choices=Weekday.choices)
    original_exercise_id = serializers.IntegerField(required=False, allow_null=True)
    replacement_exercise_id = serializers.IntegerField(required=False, allow_null=True)
    reason = serializers.CharField(required=False, allow_blank=True)

    def validate(self, attrs):
        action = attrs["action"]
        replacement_exercise_id = attrs.get("replacement_exercise_id")
        if action == AdaptationAction.REPLACE and replacement_exercise_id is None:
            raise serializers.ValidationError(
                {"replacement_exercise_id": "Для замены нужно выбрать упражнение."}
            )
        if action == AdaptationAction.DELETE and replacement_exercise_id is not None:
            raise serializers.ValidationError(
                {"replacement_exercise_id": "Для удаления заменяющее упражнение не нужно."}
            )
        return attrs


class ProgramAdaptationCancelSerializer(serializers.Serializer):
    reason = serializers.CharField(required=False, allow_blank=True, trim_whitespace=True)


class ProgramAdaptationSerializer(serializers.ModelSerializer):
    program_id = serializers.IntegerField(source="program.id", read_only=True)
    program_name = serializers.CharField(source="program.name", read_only=True)
    cycle_id = serializers.IntegerField(source="cycle.id", read_only=True, allow_null=True)
    original_exercise_id = serializers.IntegerField(
        source="original_exercise.id",
        read_only=True,
        allow_null=True,
    )
    original_exercise_name = serializers.CharField(
        source="original_exercise.name",
        read_only=True,
        allow_null=True,
    )
    replacement_exercise_id = serializers.IntegerField(
        source="replacement_exercise.id",
        read_only=True,
        allow_null=True,
    )
    replacement_exercise_name = serializers.CharField(
        source="replacement_exercise.name",
        read_only=True,
        allow_null=True,
    )
    scope_label = serializers.CharField(source="get_scope_display", read_only=True)
    action_label = serializers.CharField(source="get_action_display", read_only=True)
    is_canceled = serializers.SerializerMethodField()

    class Meta:
        model = ProgramAdaptation
        fields = [
            "id",
            "program_id",
            "program_name",
            "cycle_id",
            "scope",
            "scope_label",
            "action",
            "action_label",
            "slot_key",
            "week_number",
            "weekday",
            "original_exercise_id",
            "original_exercise_name",
            "replacement_exercise_id",
            "replacement_exercise_name",
            "reason",
            "is_canceled",
            "canceled_at",
            "cancellation_reason",
            "created_at",
        ]

    def get_is_canceled(self, obj):
        return obj.canceled_at is not None
