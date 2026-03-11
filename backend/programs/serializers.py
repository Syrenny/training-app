from rest_framework import serializers

from .models import AccessoryWeight, Day, DayExercise, Exercise, ExerciseSet, OneRepMax, Week, WorkoutCompletion


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
    day_id = serializers.IntegerField(source="day.id", read_only=True)

    class Meta:
        model = WorkoutCompletion
        fields = ["day_id", "completed_at"]


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
