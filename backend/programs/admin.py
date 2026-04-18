from django.contrib import admin

from .models import (
    AccessoryWeight,
    CycleOneRepMax,
    Day,
    DayExercise,
    Exercise,
    ExerciseSet,
    ProgramAdaptation,
    ProgramSnapshot,
    TrainingCycle,
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
    list_display = ["telegram_id", "cycle", "week_number", "weekday", "completed_at"]
    list_filter = ["cycle", "week_number", "weekday"]
    ordering = ["-completed_at"]


@admin.register(ProgramSnapshot)
class ProgramSnapshotAdmin(admin.ModelAdmin):
    list_display = ["telegram_id", "version", "commit_message", "created_at", "source_snapshot_version"]
    list_filter = ["telegram_id"]
    ordering = ["telegram_id", "-version"]


@admin.register(AccessoryWeight)
class AccessoryWeightAdmin(admin.ModelAdmin):
    list_display = ["telegram_id", "exercise", "weight", "sets_display", "recorded_date", "week"]
    list_filter = ["exercise", "week"]
    ordering = ["-recorded_date"]


@admin.register(TrainingCycle)
class TrainingCycleAdmin(admin.ModelAdmin):
    list_display = ["telegram_id", "program", "started_at", "completed_at"]
    list_filter = ["program", "completed_at"]
    ordering = ["-started_at"]


@admin.register(CycleOneRepMax)
class CycleOneRepMaxAdmin(admin.ModelAdmin):
    list_display = ["cycle", "exercise", "label", "value"]
    list_filter = ["cycle__program"]
    ordering = ["-cycle_id", "exercise__name"]


@admin.register(ProgramAdaptation)
class ProgramAdaptationAdmin(admin.ModelAdmin):
    list_display = [
        "telegram_id",
        "program",
        "cycle",
        "scope",
        "action",
        "slot_key",
        "created_at",
    ]
    list_filter = ["program", "scope", "action"]
    ordering = ["-created_at"]
