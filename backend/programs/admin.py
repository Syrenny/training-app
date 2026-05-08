from django import forms
from django.contrib import admin, messages
from django.db.models import Count
from django.http import Http404
from django.template.response import TemplateResponse
from django.urls import path
from django.urls import reverse
from django.utils.html import format_html
from django.utils.http import urlencode
from adminsortable2.admin import SortableAdminBase, SortableInlineAdminMixin, SortableTabularInline
import nested_admin

from .admin_program_editor import ProgramEditorForm, build_program_editor_state
from .models import (
    AccessoryWeight,
    CycleOneRepMax,
    Day,
    DayExercise,
    DayTextBlock,
    DayTextBlockKind,
    Exercise,
    ExerciseSet,
    LoadType,
    OneRepMax,
    Program,
    ProgramOneRepMaxExercise,
    TrainingCycle,
    UserProfile,
    Week,
    Weekday,
    WorkoutCompletion,
)
from .program_clone import clone_program_structure, duplicate_program


def changelist_link(url_name, label, filters):
    url = reverse(url_name)
    query = urlencode(filters)
    return format_html('<a href="{}?{}">{}</a>', url, query, label)


class ProgramOneRepMaxExerciseInline(SortableInlineAdminMixin, admin.TabularInline):
    model = ProgramOneRepMaxExercise
    extra = 0
    fields = ["order", "exercise", "label"]
    ordering = ["order", "id"]
    autocomplete_fields = ["exercise"]


class WeekInline(SortableInlineAdminMixin, admin.TabularInline):
    model = Week
    extra = 0
    fields = ["number", "title"]
    ordering = ["number"]
    show_change_link = True


class DayInline(SortableInlineAdminMixin, admin.TabularInline):
    model = Day
    extra = 0
    fields = ["weekday", "order", "title"]
    ordering = ["order"]
    show_change_link = True


class DayTextBlockInline(SortableInlineAdminMixin, admin.TabularInline):
    model = DayTextBlock
    extra = 0
    fields = ["order", "kind", "content"]
    ordering = ["order", "id"]


class ExerciseSetInline(SortableInlineAdminMixin, admin.TabularInline):
    model = ExerciseSet
    extra = 0
    fields = [
        "order",
        "load_type",
        "load_value",
        "load_value_max",
        "reps",
        "reps_max",
        "sets",
    ]
    ordering = ["order"]


class DayExerciseInlineForm(forms.ModelForm):
    class Meta:
        model = DayExercise
        fields = ["order", "exercise", "one_rep_max_exercise", "notes"]
        widgets = {
            "notes": forms.Textarea(attrs={"rows": 1}),
        }


class DayExerciseInline(SortableTabularInline):
    model = DayExercise
    form = DayExerciseInlineForm
    extra = 0
    fields = ["order_index", "exercise", "one_rep_max_exercise", "notes", "edit_link"]
    ordering = ["order"]
    readonly_fields = ["order_index", "edit_link"]

    def get_formset(self, request, obj=None, **kwargs):
        formset = super().get_formset(request, obj, **kwargs)
        for field_name in ("exercise", "one_rep_max_exercise"):
            if field_name not in formset.form.base_fields:
                continue
            widget = formset.form.base_fields[field_name].widget
            for attr_name in (
                "can_add_related",
                "can_change_related",
                "can_delete_related",
                "can_view_related",
            ):
                if hasattr(widget, attr_name):
                    setattr(widget, attr_name, False)
        return formset

    @admin.display(description="Порядок", ordering="order")
    def order_index(self, obj):
        if not obj.pk:
            return ""
        return obj.order

    @admin.display(description="")
    def edit_link(self, obj):
        if not obj.pk:
            return ""
        return format_html(
            '<a class="button" href="{}">Изменить</a>',
            reverse("admin:programs_dayexercise_change", args=[obj.pk]),
        )


class NestedProgramOneRepMaxExerciseInline(nested_admin.NestedTabularInline):
    model = ProgramOneRepMaxExercise
    extra = 0
    fields = ["order", "exercise", "label"]
    ordering = ["order", "id"]
    sortable_field_name = "order"


class NestedExerciseSetInline(nested_admin.NestedTabularInline):
    model = ExerciseSet
    extra = 0
    fields = ["order", "load_type", "load_value", "load_value_max", "reps", "reps_max", "sets"]
    ordering = ["order"]
    sortable_field_name = "order"


class NestedDayTextBlockInline(nested_admin.NestedTabularInline):
    model = DayTextBlock
    extra = 0
    fields = ["order", "kind", "content"]
    ordering = ["order", "id"]
    sortable_field_name = "order"


class NestedDayExerciseInline(nested_admin.NestedTabularInline):
    model = DayExercise
    form = DayExerciseInlineForm
    extra = 0
    fields = ["order", "exercise", "one_rep_max_exercise", "notes"]
    ordering = ["order"]
    sortable_field_name = "order"
    inlines = [NestedExerciseSetInline]


class NestedDayInline(nested_admin.NestedStackedInline):
    model = Day
    extra = 0
    fields = ["weekday", "order", "title"]
    ordering = ["order"]
    sortable_field_name = "order"
    inlines = [NestedDayExerciseInline, NestedDayTextBlockInline]


class NestedWeekInline(nested_admin.NestedStackedInline):
    model = Week
    extra = 0
    fields = ["number", "title"]
    ordering = ["number"]
    sortable_field_name = "number"
    inlines = [NestedDayInline]


@admin.register(Program)
class ProgramAdmin(nested_admin.NestedModelAdmin):
    list_display = [
        "name",
        "owner",
        "source_program",
        "week_count",
        "day_count",
        "exercise_count",
        "weeks_link",
        "configs_link",
    ]
    search_fields = ["name", "slug", "description", "owner__user__username", "owner__telegram_username"]
    prepopulated_fields = {"slug": ("name",)}
    actions = ["duplicate_selected_programs"]
    autocomplete_fields = ["owner", "source_program"]
    inlines = [NestedProgramOneRepMaxExerciseInline, NestedWeekInline]

    fieldsets = (
        (None, {"fields": ("name", "slug", "description")}),
        ("Источник", {"fields": ("owner", "source_program")}),
    )

    def get_urls(self):
        urls = super().get_urls()
        custom_urls = [
            path(
                "<path:object_id>/editor/",
                self.admin_site.admin_view(self.editor_view),
                name="programs_program_editor",
            ),
        ]
        return custom_urls + urls

    def editor_view(self, request, object_id):
        program = self.get_object(request, object_id)
        if program is None:
            raise Http404("Программа не найдена.")

        if request.method == "POST":
            form = ProgramEditorForm(request.POST, instance=program)
            if form.is_valid():
                form.save()
                self.message_user(request, "Программа сохранена через единый редактор.", level=messages.SUCCESS)
                form = ProgramEditorForm(instance=program)
        else:
            form = ProgramEditorForm(instance=program)

        editor_state = build_program_editor_state(
            program,
            one_rep_max_json=form.data.get("one_rep_max_config") if form.is_bound else None,
            structure_json=form.data.get("structure") if form.is_bound else None,
        )
        context = {
            **self.admin_site.each_context(request),
            "opts": self.model._meta,
            "original": program,
            "title": f"Редактор программы: {program.name}",
            "form": form,
            "editor_state": editor_state,
            "exercise_catalog": [
                {
                    "id": exercise.id,
                    "name": exercise.name,
                    "category": exercise.category,
                    "category_label": exercise.get_category_display(),
                }
                for exercise in Exercise.objects.order_by("category", "name")
            ],
            "weekday_choices": [{"value": value, "label": label} for value, label in Weekday.choices],
            "load_type_choices": [{"value": value, "label": label} for value, label in LoadType.choices],
            "text_block_kind_choices": [
                {"value": value, "label": label} for value, label in DayTextBlockKind.choices
            ],
        }
        return TemplateResponse(request, "admin/programs/program/editor.html", context)

    def get_queryset(self, request):
        return super().get_queryset(request).select_related("owner", "source_program").annotate(
            week_total=Count("weeks", distinct=True),
            day_total=Count("weeks__days", distinct=True),
            exercise_total=Count("weeks__days__exercises", distinct=True),
        )

    @admin.display(ordering="week_total", description="Недель")
    def week_count(self, obj):
        return obj.week_total

    @admin.display(ordering="day_total", description="Дней")
    def day_count(self, obj):
        return obj.day_total

    @admin.display(ordering="exercise_total", description="Упражнений")
    def exercise_count(self, obj):
        return obj.exercise_total

    @admin.display(description="Недели")
    def weeks_link(self, obj):
        return changelist_link(
            "admin:programs_week_changelist",
            "Открыть недели",
            {"program__id__exact": obj.id},
        )

    @admin.display(description="1ПМ конфиг")
    def configs_link(self, obj):
        return changelist_link(
            "admin:programs_programonerepmaxexercise_changelist",
            "Открыть конфиг",
            {"program__id__exact": obj.id},
        )

    @admin.action(description="Дублировать программу целиком")
    def duplicate_selected_programs(self, request, queryset):
        created = 0
        for program in queryset:
            duplicate_program(program)
            created += 1
        self.message_user(
            request,
            f"Создано копий программ: {created}.",
            level=messages.SUCCESS,
        )

    def save_model(self, request, obj, form, change):
        super().save_model(request, obj, form, change)
        if (
            obj.source_program_id
            and not obj.weeks.exists()
            and not obj.one_rep_max_exercises.exists()
        ):
            clone_program_structure(obj.source_program, obj)
            self.message_user(
                request,
                "Структура программы скопирована из source_program.",
                level=messages.SUCCESS,
            )


@admin.register(ProgramOneRepMaxExercise)
class ProgramOneRepMaxExerciseAdmin(admin.ModelAdmin):
    list_display = ["program", "exercise", "label", "order"]
    search_fields = ["program__name", "exercise__name", "label"]
    ordering = ["program__name", "order", "id"]


@admin.register(Week)
class WeekAdmin(SortableAdminBase, admin.ModelAdmin):
    list_display = ["program", "number", "title", "days_link"]
    search_fields = ["program__name", "title"]
    ordering = ["program__name", "number"]
    inlines = [DayInline]

    @admin.display(description="Дни")
    def days_link(self, obj):
        return changelist_link(
            "admin:programs_day_changelist",
            "Открыть дни",
            {"week__id__exact": obj.id},
        )


@admin.register(Day)
class DayAdmin(SortableAdminBase, admin.ModelAdmin):
    list_display = ["program_name", "week", "weekday", "title", "order", "exercises_link"]
    search_fields = ["title", "week__program__name"]
    ordering = ["week__program__name", "week__number", "order"]
    inlines = [DayExerciseInline, DayTextBlockInline]

    class Media:
        css = {"all": ("admin/programs/day_admin.css",)}

    @admin.display(ordering="week__program__name", description="Программа")
    def program_name(self, obj):
        return obj.week.program.name

    @admin.display(description="Упражнения")
    def exercises_link(self, obj):
        return changelist_link(
            "admin:programs_dayexercise_changelist",
            "Открыть упражнения",
            {"day__id__exact": obj.id},
        )


@admin.register(DayTextBlock)
class DayTextBlockAdmin(admin.ModelAdmin):
    list_display = ["day", "kind", "order", "short_content"]
    search_fields = ["content", "day__week__program__name"]
    ordering = ["day__week__program__name", "day__week__number", "day__order", "order"]

    @admin.display(description="Текст")
    def short_content(self, obj):
        if len(obj.content) <= 80:
            return obj.content
        return f"{obj.content[:77]}..."


@admin.register(Exercise)
class ExerciseAdmin(admin.ModelAdmin):
    list_display = ["name", "category"]
    search_fields = ["name"]


@admin.register(DayExercise)
class DayExerciseAdmin(SortableAdminBase, admin.ModelAdmin):
    list_display = ["day", "exercise", "one_rep_max_exercise", "order", "superset_display"]
    search_fields = ["day__week__program__name", "exercise__name", "notes"]
    ordering = ["day__week__program__name", "day__week__number", "day__order", "order"]
    inlines = [ExerciseSetInline]

    def get_queryset(self, request):
        return super().get_queryset(request).select_related("day__week__program", "exercise", "one_rep_max_exercise")

    def get_list_display(self, request):
        if self._get_filtered_day(request) is not None:
            return ["exercise", "one_rep_max_exercise", "order", "superset_display"]
        return super().get_list_display(request)

    def changelist_view(self, request, extra_context=None):
        extra_context = extra_context or {}
        day = self._get_filtered_day(request)
        if day is not None:
            extra_context["title"] = f"Упражнения: {day}"
        return super().changelist_view(request, extra_context=extra_context)

    def _get_filtered_day(self, request):
        day_id = request.GET.get("day__id__exact")
        if not day_id:
            return None
        try:
            return Day.objects.select_related("week__program").get(pk=day_id)
        except (Day.DoesNotExist, ValueError, TypeError):
            return None

    @admin.display(boolean=True, description="Суперсет")
    def superset_display(self, obj):
        return obj.superset_group is not None


@admin.register(ExerciseSet)
class ExerciseSetAdmin(admin.ModelAdmin):
    list_display = [
        "day_exercise",
        "load_type",
        "load_value",
        "load_value_max",
        "reps",
        "reps_max",
        "sets",
        "order",
    ]
    search_fields = ["day_exercise__day__week__program__name", "day_exercise__exercise__name"]
    ordering = ["day_exercise__day__week__program__name", "day_exercise__day__week__number", "order"]


@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = ["user", "telegram_id", "telegram_username", "selected_program"]
    search_fields = ["user__username", "telegram_username", "first_name", "last_name", "telegram_id"]


@admin.register(OneRepMax)
class OneRepMaxAdmin(admin.ModelAdmin):
    list_display = ["telegram_id", "program", "exercise", "value"]
    search_fields = ["telegram_id", "program__name", "exercise__name"]
    ordering = ["telegram_id", "program__name", "exercise__name"]


@admin.register(WorkoutCompletion)
class WorkoutCompletionAdmin(admin.ModelAdmin):
    list_display = ["telegram_id", "cycle", "program", "week_number", "weekday", "completed_at"]
    search_fields = ["telegram_id", "program__name"]
    ordering = ["-completed_at"]


@admin.register(AccessoryWeight)
class AccessoryWeightAdmin(admin.ModelAdmin):
    list_display = ["telegram_id", "exercise", "weight", "sets_display", "recorded_date", "week"]
    search_fields = ["telegram_id", "exercise__name"]
    ordering = ["-recorded_date"]


@admin.register(TrainingCycle)
class TrainingCycleAdmin(admin.ModelAdmin):
    list_display = ["telegram_id", "program", "started_at", "completed_at"]
    search_fields = ["telegram_id", "program__name", "completion_feeling"]
    ordering = ["-started_at"]


@admin.register(CycleOneRepMax)
class CycleOneRepMaxAdmin(admin.ModelAdmin):
    list_display = ["cycle", "exercise", "label", "value"]
    search_fields = ["cycle__program__name", "exercise__name", "label"]
    ordering = ["-cycle_id", "exercise__name"]
