from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from programs.models import (
    Day,
    DayExercise,
    Exercise,
    ExerciseCategory,
    ExerciseSet,
    LoadType,
    Program,
    ProgramAdaptation,
    ProgramOneRepMaxExercise,
    TrainingCycle,
    UserProfile,
    Week,
    Weekday,
    WorkoutCompletion,
)
from programs.program_snapshot import find_slot_index


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


def get_slot_payload(payload, week_number, weekday, slot_key):
    day_exercises, exercise_index = find_slot_index(payload, week_number, weekday, slot_key)
    if day_exercises is None or exercise_index is None:
        return None
    return day_exercises[exercise_index]


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
            {"reason": "Цикл выполнен", "feeling": "Нормально зашел"},
            format="json",
        )
        self.assertEqual(finish.status_code, 200)
        self.assertFalse(finish.json()["is_active"])

    def test_start_is_blocked_when_active_cycle_exists(self):
        payload = {"program_id": self.program.id, "items": build_start_items(self.program)}
        self.client.post("/api/training-cycle/start/", payload, format="json")
        second = self.client.post("/api/training-cycle/start/", payload, format="json")
        self.assertEqual(second.status_code, 409)


class TrainingCycleSelectionGuardTest(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(username="guard")
        self.profile = UserProfile.objects.create(user=self.user, telegram_id=88)
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
        self.program = Program.objects.create(slug="selection-guard", name="Selection Guard")
        exercise = Exercise.objects.create(name="Тестовая тяга", category=ExerciseCategory.DEADLIFT)
        ProgramOneRepMaxExercise.objects.create(program=self.program, exercise=exercise, label="Тестовая тяга")

    def test_program_selection_is_locked_during_active_cycle(self):
        start_client = APIClient()
        start_client.force_authenticate(user={"id": 88, "first_name": "Guard"})
        start_client.post(
            "/api/training-cycle/start/",
            {"program_id": self.program.id, "items": build_start_items(self.program)},
            format="json",
        )
        response = self.client.put(
            "/api/programs/selected/",
            {"program_id": self.program.id},
            format="json",
        )
        self.assertEqual(response.status_code, 409)


class ProgramAdaptationTest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.client.force_authenticate(user={"id": 99, "first_name": "Adapt"})
        self.program = Program.objects.create(slug="adapt-program", name="Adapt Program")
        exercise = Exercise.objects.create(name="Тестовый присед", category=ExerciseCategory.SQUAT)
        self.replacement_one = Exercise.objects.create(
            name="Фронтальный присед",
            category=ExerciseCategory.SQUAT,
        )
        self.replacement_two = Exercise.objects.create(
            name="Гакк-присед",
            category=ExerciseCategory.ACCESSORY,
        )
        ProgramOneRepMaxExercise.objects.create(program=self.program, exercise=exercise, label="Тестовый присед")
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
            load_value=75,
            reps=4,
            sets=4,
            order=1,
        )
        start = self.client.post(
            "/api/training-cycle/start/",
            {"program_id": self.program.id, "items": build_start_items(self.program)},
            format="json",
        )
        self.assertEqual(start.status_code, 201)
        self.cycle = TrainingCycle.objects.get(telegram_id=99, completed_at__isnull=True)
        self.week_number = None
        self.weekday = None
        self.exercise = None
        for week in self.cycle.program_payload["weeks"]:
            for day in week["days"]:
                if day["exercises"]:
                    self.week_number = week["number"]
                    self.weekday = day["weekday"]
                    self.exercise = day["exercises"][0]
                    break
            if self.exercise is not None:
                break
        self.assertIsNotNone(self.exercise)

    def create_adaptation(self, **overrides):
        payload = {
            "program_id": self.program.id,
            "scope": "CURRENT_CYCLE",
            "action": "DELETE",
            "slot_key": self.exercise["slot_key"],
            "week_number": self.week_number,
            "weekday": self.weekday,
            "original_exercise_id": self.exercise["exercise_id"],
            "reason": "",
        }
        payload.update(overrides)
        return self.client.post("/api/program/adaptations/", payload, format="json")

    def test_future_cycle_adaptation_is_saved(self):
        response = self.create_adaptation(
            scope="FUTURE_CYCLES",
            reason="Хочу убрать",
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(
            ProgramAdaptation.objects.filter(telegram_id=99, scope="FUTURE_CYCLES").count(),
            1,
        )

    def test_current_cycle_adaptation_updates_payload(self):
        response = self.create_adaptation(
            reason="Удаляю в этом цикле",
        )
        self.assertEqual(response.status_code, 201)
        self.cycle.refresh_from_db()
        slot_keys = []
        for week in self.cycle.program_payload["weeks"]:
            for day in week["days"]:
                slot_keys.extend(item["slot_key"] for item in day["exercises"])
        self.assertNotIn(self.exercise["slot_key"], slot_keys)

    def test_cancel_unused_current_cycle_adaptation_restores_payload(self):
        response = self.create_adaptation(reason="Удаляю по ошибке")
        self.assertEqual(response.status_code, 201)
        adaptation_id = response.json()["id"]

        cancel = self.client.post(
            f"/api/program/adaptations/{adaptation_id}/cancel/",
            {},
            format="json",
        )
        self.assertEqual(cancel.status_code, 204)
        self.assertFalse(ProgramAdaptation.objects.filter(pk=adaptation_id).exists())

        self.cycle.refresh_from_db()
        restored = get_slot_payload(self.cycle.program_payload, self.week_number, self.weekday, self.exercise["slot_key"])
        self.assertIsNotNone(restored)
        self.assertEqual(restored["exercise_id"], self.exercise["exercise_id"])

    def test_cancel_used_current_cycle_adaptation_requires_reason(self):
        response = self.create_adaptation(reason="Временно убираю")
        self.assertEqual(response.status_code, 201)
        adaptation_id = response.json()["id"]

        WorkoutCompletion.objects.create(
            telegram_id=99,
            cycle=self.cycle,
            program=self.program,
            week_number=self.week_number,
            weekday=self.weekday,
        )

        missing_reason = self.client.post(
            f"/api/program/adaptations/{adaptation_id}/cancel/",
            {},
            format="json",
        )
        self.assertEqual(missing_reason.status_code, 400)

        with_reason = self.client.post(
            f"/api/program/adaptations/{adaptation_id}/cancel/",
            {"reason": "Тренировка уже проведена, фиксирую историю"},
            format="json",
        )
        self.assertEqual(with_reason.status_code, 200)
        adaptation = ProgramAdaptation.objects.get(pk=adaptation_id)
        self.assertIsNotNone(adaptation.canceled_at)
        self.assertEqual(adaptation.cancellation_reason, "Тренировка уже проведена, фиксирую историю")

    def test_replaced_exercise_requires_only_here_for_second_replacement(self):
        first = self.create_adaptation(
            action="REPLACE",
            replacement_exercise_id=self.replacement_one.id,
            reason="Меняю на фронтальный присед",
        )
        self.assertEqual(first.status_code, 201)

        conflict = self.create_adaptation(
            action="REPLACE",
            replacement_exercise_id=self.replacement_two.id,
            scope="CURRENT_CYCLE",
            original_exercise_id=self.replacement_one.id,
            reason="Пытаюсь поменять еще раз",
        )
        self.assertEqual(conflict.status_code, 409)

        override = self.create_adaptation(
            action="REPLACE",
            replacement_exercise_id=self.replacement_two.id,
            scope="ONLY_HERE",
            original_exercise_id=self.replacement_one.id,
            reason="Только на эту тренировку",
        )
        self.assertEqual(override.status_code, 201)
        self.cycle.refresh_from_db()
        slot = get_slot_payload(self.cycle.program_payload, self.week_number, self.weekday, self.exercise["slot_key"])
        self.assertIsNotNone(slot)
        self.assertEqual(slot["exercise_id"], self.replacement_two.id)

    def test_current_cycle_override_wins_over_future_replacement(self):
        override_client = APIClient()
        override_client.force_authenticate(user={"id": 100, "first_name": "Override"})

        future = override_client.post(
            "/api/program/adaptations/",
            {
                "program_id": self.program.id,
                "scope": "FUTURE_CYCLES",
                "action": "REPLACE",
                "slot_key": self.exercise["slot_key"],
                "week_number": self.week_number,
                "weekday": self.weekday,
                "original_exercise_id": self.exercise["exercise_id"],
                "replacement_exercise_id": self.replacement_one.id,
                "reason": "На будущие циклы",
            },
            format="json",
        )
        self.assertEqual(future.status_code, 201)

        start = override_client.post(
            "/api/training-cycle/start/",
            {"program_id": self.program.id, "items": build_start_items(self.program)},
            format="json",
        )
        self.assertEqual(start.status_code, 201)
        cycle = TrainingCycle.objects.get(telegram_id=100, completed_at__isnull=True)
        slot = get_slot_payload(cycle.program_payload, self.week_number, self.weekday, self.exercise["slot_key"])
        self.assertEqual(slot["exercise_id"], self.replacement_one.id)

        current = override_client.post(
            "/api/program/adaptations/",
            {
                "program_id": self.program.id,
                "scope": "CURRENT_CYCLE",
                "action": "REPLACE",
                "slot_key": self.exercise["slot_key"],
                "week_number": self.week_number,
                "weekday": self.weekday,
                "original_exercise_id": self.replacement_one.id,
                "replacement_exercise_id": self.replacement_two.id,
                "reason": "Только в активном цикле",
            },
            format="json",
        )
        self.assertEqual(current.status_code, 409)

        only_here = override_client.post(
            "/api/program/adaptations/",
            {
                "program_id": self.program.id,
                "scope": "ONLY_HERE",
                "action": "REPLACE",
                "slot_key": self.exercise["slot_key"],
                "week_number": self.week_number,
                "weekday": self.weekday,
                "original_exercise_id": self.replacement_one.id,
                "replacement_exercise_id": self.replacement_two.id,
                "reason": "Узкая замена поверх общей",
            },
            format="json",
        )
        self.assertEqual(only_here.status_code, 201)
        cycle.refresh_from_db()
        slot = get_slot_payload(cycle.program_payload, self.week_number, self.weekday, self.exercise["slot_key"])
        self.assertEqual(slot["exercise_id"], self.replacement_two.id)
