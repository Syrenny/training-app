import json

from django import forms
from django.contrib import admin, messages
from django.db.models import Count
from django.http import Http404
from django.shortcuts import redirect
from django.template.response import TemplateResponse
from django.urls import path, reverse
from django.utils.html import format_html
from django.utils.http import urlencode
from adminsortable2.admin import SortableAdminBase

from .admin_program_editor import (
    ProgramEditorForm,
    ProgramWeekSelectorForm,
    build_server_render_editor_context,
    get_editor_selection,
    perform_editor_action,
    save_active_week_day,
)
from .models import (
    Day,
    DayExercise,
    DayTextBlock,
    Exercise,
    ExerciseSet,
    Program,
    ProgramOneRepMaxExercise,
    Week,
)
from .program_clone import clone_program_structure, duplicate_program


def changelist_link(url_name, label, filters):
    url = reverse(url_name)
    query = urlencode(filters)
    return format_html('<a href="{}?{}">{}</a>', url, query, label)


class DayExerciseAdminForm(forms.ModelForm):
    class Meta:
        model = DayExercise
        fields = ["day", "order", "exercise", "one_rep_max_exercise", "superset_group", "notes"]
        widgets = {
            "notes": forms.Textarea(attrs={"rows": 1}),
        }


@admin.register(Program)
class ProgramAdmin(admin.ModelAdmin):
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
    autocomplete_fields = ["source_program"]

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

    def get_fieldsets(self, request, obj=None):
        fieldsets = [
            (None, {"fields": ("name", "slug", "description")}),
            ("Источник", {"fields": ("owner", "source_program")}),
        ]
        if obj is not None:
            fieldsets.append(("Редактор", {"fields": ("editor_link",)}))
        return fieldsets

    def get_readonly_fields(self, request, obj=None):
        readonly_fields = list(super().get_readonly_fields(request, obj))
        if obj is not None:
            readonly_fields.append("editor_link")
        return readonly_fields

    def editor_view(self, request, object_id):
        program = self.get_object(request, object_id)
        if program is None:
            raise Http404("Программа не найдена.")

        week_id = request.GET.get("week")
        day_id = request.GET.get("day")
        form = ProgramEditorForm(instance=program)

        if request.method == "POST":
            action = request.POST.get("_action")
            if action:
                if action == "select-week":
                    selected_week = request.POST.get("active_week")
                    weeks, active_week, active_day = get_editor_selection(program, selected_week, None)
                    target_week = active_week.id if active_week else None
                    target_day = active_day.id if active_day else None
                else:
                    target_week, target_day = perform_editor_action(program, action, week_id, day_id)
                url = reverse("admin:programs_program_editor", args=[program.pk])
                params = {}
                if target_week:
                    params["week"] = target_week
                if target_day:
                    params["day"] = target_day
                if params:
                    return redirect(f"{url}?{urlencode(params)}")
                return redirect(url)
            else:
                if save_active_week_day(program, week_id, day_id, request.POST):
                    self.message_user(request, "Программа сохранена через единый редактор.", level=messages.SUCCESS)
                    url = reverse("admin:programs_program_editor", args=[program.pk])
                    params = {}
                    if week_id:
                        params["week"] = week_id
                    if day_id:
                        params["day"] = day_id
                    if params:
                        return redirect(f"{url}?{urlencode(params)}")
                    return redirect(url)
                render_tree = build_server_render_editor_context(program, week_id, day_id, bound_data=request.POST)
        else:
            render_tree = build_server_render_editor_context(program, week_id, day_id)

        context = {
            **self.admin_site.each_context(request),
            "opts": self.model._meta,
            "original": program,
            "title": f"Редактор программы: {program.name}",
            "form": form,
            "render_tree": render_tree,
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

    @admin.display(description="Единый редактор")
    def editor_link(self, obj):
        if not obj.pk:
            return "Сохраните программу, чтобы открыть редактор."
        return format_html(
            '<a class="button" href="{}">Открыть редактор программы</a>',
            reverse("admin:programs_program_editor", args=[obj.pk]),
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
        if obj.source_program_id and not obj.weeks.exists() and not obj.one_rep_max_exercises.exists():
            clone_program_structure(obj.source_program, obj)
            self.message_user(
                request,
                "Структура программы скопирована из source_program.",
                level=messages.SUCCESS,
            )


@admin.register(ProgramOneRepMaxExercise)
class ProgramOneRepMaxExerciseAdmin(SortableAdminBase, admin.ModelAdmin):
    list_display = ["program", "exercise", "label", "order"]
    search_fields = ["program__name", "exercise__name", "label"]
    ordering = ["program__name", "order", "id"]
    autocomplete_fields = ["program", "exercise"]


@admin.register(Week)
class WeekAdmin(SortableAdminBase, admin.ModelAdmin):
    list_display = ["program", "number", "title", "days_link"]
    search_fields = ["program__name", "title"]
    ordering = ["program__name", "number"]
    autocomplete_fields = ["program"]

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
    autocomplete_fields = ["week"]

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
class DayTextBlockAdmin(SortableAdminBase, admin.ModelAdmin):
    list_display = ["day", "kind", "order", "short_content"]
    search_fields = ["content", "day__week__program__name"]
    ordering = ["day__week__program__name", "day__week__number", "day__order", "order"]
    autocomplete_fields = ["day"]

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
    form = DayExerciseAdminForm
    list_display = ["day", "exercise", "one_rep_max_exercise", "order", "superset_display"]
    search_fields = ["day__week__program__name", "exercise__name", "notes"]
    ordering = ["day__week__program__name", "day__week__number", "day__order", "order"]
    autocomplete_fields = ["day", "exercise", "one_rep_max_exercise"]

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
class ExerciseSetAdmin(SortableAdminBase, admin.ModelAdmin):
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
    autocomplete_fields = ["day_exercise"]
