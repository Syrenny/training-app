from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from programs.models import (
    CycleOneRepMax,
    Day,
    DayExercise,
    Exercise,
    ExerciseCategory,
    ExerciseSet,
    LoadType,
    Program,
    ProgramOneRepMaxExercise,
    TrainingCycle,
    UserProfile,
    Week,
    Weekday,
    WorkoutCompletion,
)


def build_start_items(program):
    configs = (
        ProgramOneRepMaxExercise.objects.filter(program=program)
        .select_related("exercise")
        .order_by("order", "id")
    )
    return [
        {"exercise_id": item.exercise_id, "value": 100 + index * 10}
        for index, item in enumerate(configs, start=1)
    ]


class TrainingCycleFlowTest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.client.force_authenticate(user={"id": 77, "first_name": "Cycle"})
        self.program = Program.objects.create(slug="cycle-flow", name="Cycle Flow")
        exercise = Exercise.objects.create(name="Тестовый жим", category=ExerciseCategory.BENCH)
        ProgramOneRepMaxExercise.objects.create(program=self.program, exercise=exercise, label="Тестовый жим")
        week = Week.objects.create(program=self.program, number=1, title="1 неделя")
        day = Day.objects.create(week=week, weekday=Weekday.MON, order=1)
        day_exercise = DayExercise.objects.create(
            day=day,
            exercise=exercise,
            one_rep_max_exercise=exercise,
            order=1,
        )
        ExerciseSet.objects.create(
            day_exercise=day_exercise,
            load_type=LoadType.PERCENT,
            load_value=70,
            reps=5,
            sets=5,
            order=1,
        )

    def test_start_and_finish_cycle(self):
        start = self.client.post(
            "/api/training-cycle/start/",
            {"program_id": self.program.id, "items": build_start_items(self.program)},
            format="json",
        )
        self.assertEqual(start.status_code, 201)
        self.assertTrue(start.json()["cycle"]["is_active"])

        finish = self.client.post(
            "/api/training-cycle/finish/",
            {"notes": "Нормально зашел"},
            format="json",
        )
        self.assertEqual(finish.status_code, 200)
        self.assertFalse(finish.json()["is_active"])

    def test_start_is_blocked_when_active_cycle_exists(self):
        payload = {"program_id": self.program.id, "items": build_start_items(self.program)}
        self.client.post("/api/training-cycle/start/", payload, format="json")
        second = self.client.post("/api/training-cycle/start/", payload, format="json")
        self.assertEqual(second.status_code, 409)

    def test_finished_cycle_can_be_deleted_from_history(self):
        start = self.client.post(
            "/api/training-cycle/start/",
            {"program_id": self.program.id, "items": build_start_items(self.program)},
            format="json",
        )
        self.assertEqual(start.status_code, 201)
        cycle_id = start.json()["cycle"]["id"]
        cycle = TrainingCycle.objects.get(pk=cycle_id)
        WorkoutCompletion.objects.create(
            telegram_id=77,
            cycle=cycle,
            program=self.program,
            week_number=1,
            weekday=Weekday.MON,
        )

        finish = self.client.post(
            "/api/training-cycle/finish/",
            {"notes": "Нормально зашел"},
            format="json",
        )
        self.assertEqual(finish.status_code, 200)

        delete_response = self.client.delete(f"/api/training-cycle/history/{cycle_id}/")
        self.assertEqual(delete_response.status_code, 204)
        self.assertFalse(TrainingCycle.objects.filter(pk=cycle_id).exists())
        self.assertFalse(CycleOneRepMax.objects.filter(cycle_id=cycle_id).exists())
        self.assertFalse(WorkoutCompletion.objects.filter(cycle_id=cycle_id).exists())

    def test_active_cycle_cannot_be_deleted_from_history(self):
        start = self.client.post(
            "/api/training-cycle/start/",
            {"program_id": self.program.id, "items": build_start_items(self.program)},
            format="json",
        )
        self.assertEqual(start.status_code, 201)
        cycle_id = start.json()["cycle"]["id"]

        delete_response = self.client.delete(f"/api/training-cycle/history/{cycle_id}/")
        self.assertEqual(delete_response.status_code, 409)
        self.assertTrue(TrainingCycle.objects.filter(pk=cycle_id).exists())

    def test_finish_cycle_without_notes_is_allowed(self):
        start = self.client.post(
            "/api/training-cycle/start/",
            {"program_id": self.program.id, "items": build_start_items(self.program)},
            format="json",
        )
        self.assertEqual(start.status_code, 201)

        finish = self.client.post("/api/training-cycle/finish/", {}, format="json")

        self.assertEqual(finish.status_code, 200)
        self.assertEqual(finish.json()["completion_reason"], "")
        self.assertEqual(finish.json()["completion_feeling"], "")


class ProgramSelectionTest(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(username="guard")
        self.profile = UserProfile.objects.create(user=self.user, telegram_id=88)
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
        self.program = Program.objects.create(slug="selection-guard", name="Selection Guard")
        exercise = Exercise.objects.create(name="Тестовая тяга", category=ExerciseCategory.DEADLIFT)
        ProgramOneRepMaxExercise.objects.create(program=self.program, exercise=exercise, label="Тестовая тяга")
        self.program_two = Program.objects.create(slug="selection-second", name="Selection Second")
        second_exercise = Exercise.objects.create(name="Тестовый присед", category=ExerciseCategory.SQUAT)
        ProgramOneRepMaxExercise.objects.create(
            program=self.program_two,
            exercise=second_exercise,
            label="Тестовый присед",
        )

    def test_program_selection_is_allowed_any_time(self):
        self.client.post(
            "/api/training-cycle/start/",
            {"program_id": self.program.id, "items": build_start_items(self.program)},
            format="json",
        )
        response = self.client.put(
            "/api/programs/selected/",
            {"program_id": self.program.id},
            format="json",
        )
        self.assertEqual(response.status_code, 200)

    def test_program_selection_switches_active_cycle_context(self):
        first_start = self.client.post(
            "/api/training-cycle/start/",
            {"program_id": self.program.id, "items": build_start_items(self.program)},
            format="json",
        )
        self.assertEqual(first_start.status_code, 201)
        first_cycle_id = first_start.json()["cycle"]["id"]

        self.client.put(
            "/api/programs/selected/",
            {"program_id": self.program_two.id},
            format="json",
        )
        second_start = self.client.post(
            "/api/training-cycle/start/",
            {"program_id": self.program_two.id, "items": build_start_items(self.program_two)},
            format="json",
        )
        self.assertEqual(second_start.status_code, 201)
        second_cycle_id = second_start.json()["cycle"]["id"]

        active_for_second = self.client.get("/api/training-cycle/active/")
        self.assertEqual(active_for_second.status_code, 200)
        self.assertEqual(active_for_second.json()["cycle"]["id"], second_cycle_id)

        self.client.put(
            "/api/programs/selected/",
            {"program_id": self.program.id},
            format="json",
        )
        active_for_first = self.client.get("/api/training-cycle/active/")
        self.assertEqual(active_for_first.status_code, 200)
        self.assertEqual(active_for_first.json()["cycle"]["id"], first_cycle_id)
