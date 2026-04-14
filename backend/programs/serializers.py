from rest_framework import serializers

from .models import (
    AccessoryWeight,
    Day,
    DayExercise,
    Exercise,
    ExerciseSet,
    LoadType,
    OneRepMax,
    Week,
    Weekday,
    WorkoutCompletion,
)
from .program_snapshot import WEEKDAY_SORT_ORDER, decimal_to_json, normalize_week_title


class OneRepMaxSerializer(serializers.ModelSerializer):
    class Meta:
        model = OneRepMax
        fields = ["bench", "squat", "deadlift"]

    def validate_bench(self, value):
        if value > 999:
            raise serializers.ValidationError("Значение не может превышать 999.")
        return value

    def validate_squat(self, value):
        if value > 999:
            raise serializers.ValidationError("Значение не может превышать 999.")
        return value

    def validate_deadlift(self, value):
        if value > 999:
            raise serializers.ValidationError("Значение не может превышать 999.")
        return value


class ExerciseSetSerializer(serializers.ModelSerializer):
    display = serializers.CharField(read_only=True)

    class Meta:
        model = ExerciseSet
        fields = ["id", "order", "load_type", "load_value", "reps", "sets", "display"]


class ExerciseSerializer(serializers.ModelSerializer):
    class Meta:
        model = Exercise
        fields = ["id", "name", "category"]


class DayExerciseSerializer(serializers.ModelSerializer):
    exercise = ExerciseSerializer(read_only=True)
    sets = ExerciseSetSerializer(many=True, read_only=True)

    class Meta:
        model = DayExercise
        fields = ["id", "order", "exercise", "sets", "superset_group"]


class DaySerializer(serializers.ModelSerializer):
    exercises = DayExerciseSerializer(many=True, read_only=True)
    weekday_display = serializers.CharField(read_only=True)

    class Meta:
        model = Day
        fields = ["id", "weekday", "weekday_display", "exercises"]


class WeekListSerializer(serializers.ModelSerializer):
    class Meta:
        model = Week
        fields = ["id", "number", "title"]


class WorkoutCompletionSerializer(serializers.ModelSerializer):
    completed_at = serializers.DateTimeField(read_only=True)

    class Meta:
        model = WorkoutCompletion
        fields = ["week_number", "weekday", "completed_at"]


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
    reps = serializers.IntegerField(min_value=1)
    sets = serializers.IntegerField(min_value=1)

    def validate(self, attrs):
        load_type = attrs["load_type"]
        load_value = attrs.get("load_value")
        if load_type in (LoadType.PERCENT, LoadType.KG) and load_value is None:
            raise serializers.ValidationError("Для этого типа нагрузки нужно значение.")
        if load_type in (LoadType.INDIVIDUAL, LoadType.BODYWEIGHT) and load_value is not None:
            raise serializers.ValidationError("Для этого типа нагрузки значение не используется.")
        return attrs


class ProgramExerciseInputSerializer(serializers.Serializer):
    exercise = serializers.PrimaryKeyRelatedField(queryset=Exercise.objects.all())
    superset_group = serializers.IntegerField(required=False, allow_null=True, min_value=1)
    sets = ProgramSetInputSerializer(many=True, allow_empty=False)


class ProgramDayInputSerializer(serializers.Serializer):
    weekday = serializers.ChoiceField(choices=Weekday.choices)
    exercises = ProgramExerciseInputSerializer(many=True, required=False)


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
                            "exercises": [
                                {
                                    "exercise_id": exercise["exercise"].id,
                                    "superset_group": exercise.get("superset_group"),
                                    "sets": [
                                        {
                                            "load_type": set_item["load_type"],
                                            "load_value": decimal_to_json(set_item.get("load_value")),
                                            "reps": set_item["reps"],
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
