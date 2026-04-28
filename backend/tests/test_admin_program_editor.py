import json

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse

from programs.admin_program_editor import ProgramEditorForm, build_program_editor_state
from programs.models import (
    Day,
    DayExercise,
    DayTextBlock,
    DayTextBlockKind,
    Exercise,
    ExerciseCategory,
    ExerciseSet,
    LoadType,
    Program,
    ProgramOneRepMaxExercise,
    Week,
    Weekday,
)


class ProgramEditorFormTest(TestCase):
    def setUp(self):
        self.bench = Exercise.objects.create(name="Жим лежа", category=ExerciseCategory.BENCH)
        self.squat = Exercise.objects.create(name="Присед", category=ExerciseCategory.SQUAT)
        self.row = Exercise.objects.create(name="Тяга штанги", category=ExerciseCategory.ACCESSORY)
        self.program = Program.objects.create(slug="editor-program", name="Редактор")

        week = Week.objects.create(program=self.program, number=1, title="Старая неделя")
        day = Day.objects.create(week=week, weekday=Weekday.MON, order=1, title="Старый день")
        day_exercise = DayExercise.objects.create(day=day, exercise=self.bench, order=1)
        ExerciseSet.objects.create(
            day_exercise=day_exercise,
            load_type=LoadType.KG,
            load_value=100,
            reps=5,
            sets=5,
            order=1,
        )
        DayTextBlock.objects.create(
            day=day,
            kind=DayTextBlockKind.INFO,
            content="Старый блок",
            order=1,
        )
        ProgramOneRepMaxExercise.objects.create(
            program=self.program,
            exercise=self.bench,
            label="Старый 1ПМ",
            order=1,
        )

    def test_editor_form_rebuilds_program_structure(self):
        form = ProgramEditorForm(
            data={
                "name": "Новый цикл",
                "slug": "new-program",
                "description": "Обновленная структура",
                "owner": "",
                "source_program": "",
                "one_rep_max_config": json.dumps(
                    [
                        {"exercise_id": self.bench.id, "label": "Жим"},
                        {"exercise_id": self.squat.id, "label": "Присед"},
                    ]
                ),
                "structure": json.dumps(
                    {
                        "weeks": [
                            {
                                "title": "Интенсивность",
                                "days": [
                                    {
                                        "weekday": Weekday.MON,
                                        "title": "Тяжелый верх",
                                        "exercises": [
                                            {
                                                "exercise": self.bench.id,
                                                "one_rep_max_exercise": self.bench.id,
                                                "superset_group": None,
                                                "notes": "Держать паузу",
                                                "sets": [
                                                    {
                                                        "load_type": LoadType.PERCENT,
                                                        "load_value": 75,
                                                        "load_value_max": 80,
                                                        "reps": 5,
                                                        "reps_max": 6,
                                                        "sets": 4,
                                                    }
                                                ],
                                            }
                                        ],
                                        "text_blocks": [
                                            {
                                                "kind": DayTextBlockKind.INFO,
                                                "content": "Разминка перед жимом",
                                            }
                                        ],
                                    },
                                    {
                                        "weekday": Weekday.WED,
                                        "title": "Ноги",
                                        "exercises": [
                                            {
                                                "exercise": self.squat.id,
                                                "one_rep_max_exercise": self.squat.id,
                                                "superset_group": 1,
                                                "notes": "",
                                                "sets": [
                                                    {
                                                        "load_type": LoadType.KG,
                                                        "load_value": 120,
                                                        "load_value_max": None,
                                                        "reps": 3,
                                                        "reps_max": None,
                                                        "sets": 5,
                                                    }
                                                ],
                                            },
                                            {
                                                "exercise": self.row.id,
                                                "one_rep_max_exercise": None,
                                                "superset_group": 1,
                                                "notes": "В суперсете",
                                                "sets": [
                                                    {
                                                        "load_type": LoadType.BODYWEIGHT,
                                                        "load_value": None,
                                                        "load_value_max": None,
                                                        "reps": 12,
                                                        "reps_max": None,
                                                        "sets": 3,
                                                    }
                                                ],
                                            },
                                        ],
                                        "text_blocks": [],
                                    },
                                ],
                            }
                        ]
                    }
                ),
            },
            instance=self.program,
        )

        self.assertTrue(form.is_valid(), form.errors)
        form.save()

        self.program.refresh_from_db()
        self.assertEqual(self.program.name, "Новый цикл")
        self.assertEqual(self.program.slug, "new-program")
        self.assertEqual(self.program.description, "Обновленная структура")

        self.assertEqual(self.program.one_rep_max_exercises.count(), 2)
        self.assertEqual(
            list(self.program.one_rep_max_exercises.order_by("order").values_list("label", flat=True)),
            ["Жим", "Присед"],
        )

        self.assertEqual(self.program.weeks.count(), 1)
        week = self.program.weeks.get(number=1)
        self.assertEqual(week.title, "Интенсивность")
        self.assertEqual(list(week.days.values_list("weekday", flat=True)), [Weekday.MON, Weekday.WED])

        monday = week.days.get(weekday=Weekday.MON)
        self.assertEqual(monday.title, "Тяжелый верх")
        self.assertEqual(monday.text_blocks.get().content, "Разминка перед жимом")
        monday_exercise = monday.exercises.get(order=1)
        self.assertEqual(monday_exercise.exercise, self.bench)
        self.assertEqual(monday_exercise.one_rep_max_exercise, self.bench)
        monday_set = monday_exercise.sets.get(order=1)
        self.assertEqual(monday_set.load_type, LoadType.PERCENT)
        self.assertEqual(monday_set.reps_max, 6)

        wednesday = week.days.get(weekday=Weekday.WED)
        second_exercise = wednesday.exercises.get(order=2)
        self.assertEqual(second_exercise.exercise, self.row)
        self.assertEqual(second_exercise.superset_group, 1)
        self.assertEqual(second_exercise.sets.get(order=1).load_type, LoadType.BODYWEIGHT)

    def test_editor_form_rejects_duplicate_one_rep_max_exercises(self):
        form = ProgramEditorForm(
            data={
                "name": self.program.name,
                "slug": self.program.slug,
                "description": "",
                "owner": "",
                "source_program": "",
                "one_rep_max_config": json.dumps(
                    [
                        {"exercise_id": self.bench.id, "label": "Жим"},
                        {"exercise_id": self.bench.id, "label": "Жим еще раз"},
                    ]
                ),
                "structure": json.dumps({"weeks": []}),
            },
            instance=self.program,
        )

        self.assertFalse(form.is_valid())
        self.assertIn("Упражнения 1ПМ не должны повторяться.", form.errors["one_rep_max_config"])

    def test_editor_uses_source_program_when_custom_program_is_still_empty(self):
        source_program = Program.objects.create(slug="source-program", name="Источник")
        ProgramOneRepMaxExercise.objects.create(
            program=source_program,
            exercise=self.squat,
            label="Присед источник",
            order=1,
        )
        week = Week.objects.create(program=source_program, number=1, title="Неделя источника")
        day = Day.objects.create(week=week, weekday=Weekday.FRI, order=1, title="День источника")
        day_exercise = DayExercise.objects.create(
            day=day,
            exercise=self.squat,
            one_rep_max_exercise=self.squat,
            order=1,
        )
        ExerciseSet.objects.create(
            day_exercise=day_exercise,
            load_type=LoadType.PERCENT,
            load_value=70,
            reps=4,
            sets=4,
            order=1,
        )

        empty_program = Program.objects.create(
            slug="empty-derived",
            name="Пустая производная",
            source_program=source_program,
        )

        state = build_program_editor_state(empty_program)

        self.assertEqual(state["one_rep_max_config"][0]["label"], "Присед источник")
        self.assertEqual(state["structure"]["weeks"][0]["title"], "Неделя источника")
        self.assertEqual(state["structure"]["weeks"][0]["days"][0]["weekday"], Weekday.FRI)


class ProgramEditorAdminViewTest(TestCase):
    def setUp(self):
        user_model = get_user_model()
        self.admin_user = user_model.objects.create_superuser(
            username="admin-editor",
            email="admin@example.com",
            password="secret123",
        )
        self.program = Program.objects.create(slug="admin-program", name="Admin Program")
        self.client.force_login(self.admin_user)

    def test_program_editor_view_is_available_in_admin(self):
        response = self.client.get(reverse("admin:programs_program_editor", args=[self.program.pk]))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'id="program-editor-form"', html=False)

    def test_program_editor_renders_week_tabs_when_program_has_weeks(self):
        week = Week.objects.create(program=self.program, number=1, title="Первая неделя")
        Day.objects.create(week=week, weekday=Weekday.MON, order=1, title="День")

        response = self.client.get(reverse("admin:programs_program_editor", args=[self.program.pk]))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'id="program-week-tabs"', html=False)
        self.assertContains(response, "Первая неделя")

    def test_program_editor_renders_visual_hierarchy_classes(self):
        exercise = Exercise.objects.create(name="Жим стоя", category=ExerciseCategory.BENCH)
        week = Week.objects.create(program=self.program, number=1, title="Неделя")
        day = Day.objects.create(week=week, weekday=Weekday.MON, order=1, title="День")
        day_exercise = DayExercise.objects.create(day=day, exercise=exercise, order=1)
        ExerciseSet.objects.create(
            day_exercise=day_exercise,
            load_type=LoadType.KG,
            load_value=60,
            reps=8,
            sets=3,
            order=1,
        )

        response = self.client.get(reverse("admin:programs_program_editor", args=[self.program.pk]))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "editor-node-day")
        self.assertContains(response, "editor-node-exercise")
        self.assertContains(response, "editor-node-set")

    def test_change_form_clones_source_program_for_empty_program(self):
        exercise = Exercise.objects.create(name="Становая", category=ExerciseCategory.DEADLIFT)
        source_program = Program.objects.create(slug="source-admin", name="Source Admin")
        ProgramOneRepMaxExercise.objects.create(
            program=source_program,
            exercise=exercise,
            label="Тяга",
            order=1,
        )
        week = Week.objects.create(program=source_program, number=1, title="1 неделя")
        day = Day.objects.create(week=week, weekday=Weekday.MON, order=1, title="Тяговый день")
        day_exercise = DayExercise.objects.create(day=day, exercise=exercise, order=1)
        ExerciseSet.objects.create(
            day_exercise=day_exercise,
            load_type=LoadType.KG,
            load_value=140,
            reps=3,
            sets=3,
            order=1,
        )

        target_program = Program.objects.create(slug="empty-admin", name="Empty Admin")

        response = self.client.post(
            reverse("admin:programs_program_change", args=[target_program.pk]),
            {
                "name": target_program.name,
                "slug": target_program.slug,
                "description": "",
                "owner": "",
                "source_program": source_program.pk,
                "_save": "Save",
            },
            follow=True,
        )

        self.assertEqual(response.status_code, 200)
        target_program.refresh_from_db()
        self.assertEqual(target_program.source_program, source_program)
        self.assertEqual(target_program.weeks.count(), 1)
        self.assertEqual(target_program.one_rep_max_exercises.count(), 1)
