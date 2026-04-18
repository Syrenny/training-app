import math

from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from programs.models import Exercise, ExerciseCategory, OneRepMax, Program


def calc_weight(one_rep_max: int, percent: float) -> float:
    """Mirror of frontend weight calculation formula."""
    return math.floor(one_rep_max * percent / 100 / 2.5) * 2.5


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
        # Authenticate as a fake Telegram user
        self.client.force_authenticate(user={"id": 111, "first_name": "Test"})
        self.program = Program.objects.get(slug="base-program")
        self.bench = Exercise.objects.get(name="Жим лёжа")
        self.squat = Exercise.objects.get(name="Приседания")

    def test_get_defaults(self):
        response = self.client.get("/api/one-rep-max/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["program_id"], self.program.id)
        values = {item["exercise_id"]: item["value"] for item in response.data["items"]}
        self.assertEqual(values[self.bench.id], 0)
        self.assertEqual(values[self.squat.id], 0)

    def test_put_creates(self):
        response = self.client.put(
            "/api/one-rep-max/",
            {
                "items": [
                    {"exercise_id": self.bench.id, "value": 100},
                    {"exercise_id": self.squat.id, "value": 150},
                ]
            },
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        values = {item["exercise_id"]: item["value"] for item in response.data["items"]}
        self.assertEqual(values[self.bench.id], 100)
        self.assertEqual(values[self.squat.id], 150)

        # Verify persisted
        orm = OneRepMax.objects.get(
            telegram_id=111,
            program=self.program,
            exercise=self.bench,
        )
        self.assertEqual(orm.value, 100)

    def test_put_updates(self):
        OneRepMax.objects.create(
            telegram_id=111,
            program=self.program,
            exercise=self.bench,
            value=80,
        )
        response = self.client.put(
            "/api/one-rep-max/",
            {"items": [{"exercise_id": self.bench.id, "value": 120}]},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        values = {item["exercise_id"]: item["value"] for item in response.data["items"]}
        self.assertEqual(values[self.bench.id], 120)

    def test_put_partial(self):
        OneRepMax.objects.create(
            telegram_id=111,
            program=self.program,
            exercise=self.bench,
            value=100,
        )
        OneRepMax.objects.create(
            telegram_id=111,
            program=self.program,
            exercise=self.squat,
            value=150,
        )
        response = self.client.put(
            "/api/one-rep-max/",
            {"items": [{"exercise_id": self.squat.id, "value": 160}]},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        values = {item["exercise_id"]: item["value"] for item in response.data["items"]}
        self.assertEqual(values[self.squat.id], 160)
        self.assertEqual(values[self.bench.id], 100)

    def test_put_validation_over_999(self):
        response = self.client.put(
            "/api/one-rep-max/",
            {"items": [{"exercise_id": self.bench.id, "value": 1000}]},
            format="json",
        )
        self.assertEqual(response.status_code, 400)

    def test_get_after_put(self):
        self.client.put(
            "/api/one-rep-max/",
            {
                "items": [
                    {"exercise_id": self.bench.id, "value": 90},
                    {"exercise_id": self.squat.id, "value": 120},
                ]
            },
            format="json",
        )
        response = self.client.get("/api/one-rep-max/")
        values = {item["exercise_id"]: item["value"] for item in response.data["items"]}
        self.assertEqual(values[self.bench.id], 90)
        self.assertEqual(values[self.squat.id], 120)


class WeightCalculationTest(TestCase):
    """Parametric tests for weight calculation formula: floor(1RM * % / 100 / 2.5) * 2.5"""

    def test_100kg_70percent(self):
        self.assertEqual(calc_weight(100, 70), 70.0)

    def test_200kg_72percent(self):
        # 200 * 0.72 = 144 → floor(144/2.5)*2.5 = floor(57.6)*2.5 = 57*2.5 = 142.5
        self.assertEqual(calc_weight(200, 72), 142.5)

    def test_90kg_55percent(self):
        # 90 * 0.55 = 49.5 → floor(49.5/2.5)*2.5 = floor(19.8)*2.5 = 19*2.5 = 47.5
        self.assertEqual(calc_weight(90, 55), 47.5)

    def test_150kg_80percent(self):
        # 150 * 0.80 = 120 → floor(120/2.5)*2.5 = floor(48)*2.5 = 48*2.5 = 120.0
        self.assertEqual(calc_weight(150, 80), 120.0)

    def test_100kg_75percent(self):
        self.assertEqual(calc_weight(100, 75), 75.0)

    def test_zero_1rm(self):
        self.assertEqual(calc_weight(0, 70), 0.0)

    def test_small_result(self):
        # 10 * 20 / 100 = 2 → floor(2/2.5)*2.5 = 0*2.5 = 0
        self.assertEqual(calc_weight(10, 20), 0.0)

    def test_exact_2_5_multiple(self):
        # 100 * 50 / 100 = 50 → floor(50/2.5)*2.5 = 20*2.5 = 50
        self.assertEqual(calc_weight(100, 50), 50.0)
