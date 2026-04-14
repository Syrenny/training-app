from django.contrib import admin

from .models import (
    AccessoryWeight,
    Day,
    DayExercise,
    Exercise,
    ExerciseSet,
    ProgramSnapshot,
    Week,
    WorkoutCompletion,
)


class ExerciseSetInline(admin.TabularInline):
    model = ExerciseSet
    extra = 1
    fields = ["order", "load_type", "load_value", "reps", "sets"]


class DayExerciseInline(admin.TabularInline):
    model = DayExercise
    extra = 1
    fields = ["order", "exercise", "superset_group"]
    show_change_link = True


class DayInline(admin.TabularInline):
    model = Day
    extra = 0
    fields = ["weekday", "order"]
    show_change_link = True


@admin.register(Week)
class WeekAdmin(admin.ModelAdmin):
    list_display = ["number", "title"]
    ordering = ["number"]
    inlines = [DayInline]


@admin.register(Day)
class DayAdmin(admin.ModelAdmin):
    list_display = ["week", "weekday", "order"]
    list_filter = ["week"]
    ordering = ["week__number", "order"]
    inlines = [DayExerciseInline]


@admin.register(Exercise)
class ExerciseAdmin(admin.ModelAdmin):
    list_display = ["name", "category"]
    list_filter = ["category"]
    search_fields = ["name"]


@admin.register(DayExercise)
class DayExerciseAdmin(admin.ModelAdmin):
    list_display = ["day", "exercise", "order", "superset_group"]
    list_filter = ["day__week", "day__weekday"]
    ordering = ["day__week__number", "day__order", "order"]
    inlines = [ExerciseSetInline]


@admin.register(ExerciseSet)
class ExerciseSetAdmin(admin.ModelAdmin):
    list_display = ["day_exercise", "load_type", "load_value", "reps", "sets", "order"]
    list_filter = ["load_type"]


@admin.register(WorkoutCompletion)
class WorkoutCompletionAdmin(admin.ModelAdmin):
    list_display = ["telegram_id", "week_number", "weekday", "completed_at"]
    list_filter = ["week_number", "weekday"]
    ordering = ["-completed_at"]


@admin.register(ProgramSnapshot)
class ProgramSnapshotAdmin(admin.ModelAdmin):
    list_display = ["telegram_id", "version", "created_at", "source_snapshot_version"]
    list_filter = ["telegram_id"]
    ordering = ["telegram_id", "-version"]


@admin.register(AccessoryWeight)
class AccessoryWeightAdmin(admin.ModelAdmin):
    list_display = ["telegram_id", "exercise", "weight", "sets_display", "recorded_date", "week"]
    list_filter = ["exercise", "week"]
    ordering = ["-recorded_date"]
