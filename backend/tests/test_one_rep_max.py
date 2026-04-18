import math

from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from programs.models import (
    CycleOneRepMax,
    Exercise,
    ExerciseCategory,
    OneRepMax,
    Program,
    ProgramOneRepMaxExercise,
    TrainingCycle,
)


def calc_weight(one_rep_max: int, percent: float) -> float:
    return math.floor(one_rep_max * percent / 100 / 2.5) * 2.5


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


class OneRepMaxModelTest(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.program = Program.objects.create(slug="test-one-rep-max", name="Test One Rep Max")
        cls.squat, _ = Exercise.objects.get_or_create(
            name="Приседания",
            defaults={"category": ExerciseCategory.SQUAT},
        )
        cls.bench, _ = Exercise.objects.get_or_create(
            name="Жим лёжа",
            defaults={"category": ExerciseCategory.BENCH},
        )

    def test_create(self):
        orm = OneRepMax.objects.create(
            telegram_id=123,
            program=self.program,
            exercise=self.squat,
            value=150,
        )
        self.assertEqual(orm.value, 150)
        self.assertEqual(orm.program, self.program)
        self.assertEqual(orm.exercise, self.squat)

    def test_defaults(self):
        orm = OneRepMax.objects.create(
            telegram_id=456,
            program=self.program,
            exercise=self.bench,
        )
        self.assertEqual(orm.value, 0)

    def test_unique_per_program_and_exercise(self):
        OneRepMax.objects.create(telegram_id=789, program=self.program, exercise=self.bench)
        with self.assertRaises(Exception):
            OneRepMax.objects.create(telegram_id=789, program=self.program, exercise=self.bench)


@override_settings(TELEGRAM_BOT_TOKEN="")
class OneRepMaxAPITest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.client.force_authenticate(user={"id": 111, "first_name": "Test"})
        self.program = Program.objects.get(slug="base-program")

    def test_get_defaults_before_cycle_start(self):
        response = self.client.get("/api/one-rep-max/")
        self.assertEqual(response.status_code, 200)
        self.assertIsNone(response.data["cycle_id"])
        self.assertEqual(response.data["program_id"], self.program.id)

    def test_start_cycle_persists_initial_cycle_one_rep_max(self):
        items = build_start_items(self.program)
        response = self.client.post(
            "/api/training-cycle/start/",
            {"program_id": self.program.id, "items": items},
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        cycle = TrainingCycle.objects.get(telegram_id=111, completed_at__isnull=True)
        self.assertEqual(CycleOneRepMax.objects.filter(cycle=cycle).count(), len(items))

        get_response = self.client.get("/api/one-rep-max/")
        self.assertEqual(get_response.status_code, 200)
        self.assertEqual(get_response.data["cycle_id"], cycle.id)
        values = {item["exercise_id"]: item["value"] for item in get_response.data["items"]}
        self.assertEqual(values, {item["exercise_id"]: item["value"] for item in items})

    def test_put_is_locked_for_active_cycle(self):
        items = build_start_items(self.program)
        self.client.post(
            "/api/training-cycle/start/",
            {"program_id": self.program.id, "items": items},
            format="json",
        )
        response = self.client.put(
            "/api/one-rep-max/",
            {"items": items},
            format="json",
        )
        self.assertEqual(response.status_code, 409)

    def test_cycle_start_requires_full_one_rep_max_set(self):
        items = build_start_items(self.program)
        response = self.client.post(
            "/api/training-cycle/start/",
            {"program_id": self.program.id, "items": items[:1]},
            format="json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("exercise_ids", response.json())


class WeightCalculationTest(TestCase):
    def test_100kg_70percent(self):
        self.assertEqual(calc_weight(100, 70), 70.0)

    def test_200kg_72percent(self):
        self.assertEqual(calc_weight(200, 72), 142.5)

    def test_90kg_55percent(self):
        self.assertEqual(calc_weight(90, 55), 47.5)

    def test_150kg_80percent(self):
        self.assertEqual(calc_weight(150, 80), 120.0)

    def test_100kg_75percent(self):
        self.assertEqual(calc_weight(100, 75), 75.0)

    def test_zero_1rm(self):
        self.assertEqual(calc_weight(0, 70), 0.0)

    def test_small_result(self):
        self.assertEqual(calc_weight(10, 20), 0.0)

    def test_exact_2_5_multiple(self):
        self.assertEqual(calc_weight(100, 50), 50.0)
