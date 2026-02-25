from rest_framework import serializers

from .models import Day, DayExercise, Exercise, ExerciseSet, OneRepMax, Week


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
        fields = ["id", "order", "exercise", "sets"]


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


class WeekDetailSerializer(serializers.ModelSerializer):
    days = DaySerializer(many=True, read_only=True)

    class Meta:
        model = Week
        fields = ["id", "number", "title", "days"]
