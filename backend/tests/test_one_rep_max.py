import math

from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from programs.models import OneRepMax


def calc_weight(one_rep_max: int, percent: float) -> float:
    """Mirror of frontend weight calculation formula."""
    return math.floor(one_rep_max * percent / 100 / 2.5) * 2.5


class OneRepMaxModelTest(TestCase):
    def test_create(self):
        orm = OneRepMax.objects.create(telegram_id=123, bench=100, squat=150, deadlift=200)
        self.assertEqual(orm.bench, 100)
        self.assertEqual(orm.squat, 150)
        self.assertEqual(orm.deadlift, 200)

    def test_defaults(self):
        orm = OneRepMax.objects.create(telegram_id=456)
        self.assertEqual(orm.bench, 0)
        self.assertEqual(orm.squat, 0)
        self.assertEqual(orm.deadlift, 0)

    def test_unique_telegram_id(self):
        OneRepMax.objects.create(telegram_id=789)
        with self.assertRaises(Exception):
            OneRepMax.objects.create(telegram_id=789)


@override_settings(TELEGRAM_BOT_TOKEN="")
class OneRepMaxAPITest(TestCase):
    def setUp(self):
        self.client = APIClient()
        # Authenticate as a fake Telegram user
        self.client.force_authenticate(user={"id": 111, "first_name": "Test"})

    def test_get_defaults(self):
        response = self.client.get("/api/one-rep-max/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data, {"bench": 0, "squat": 0, "deadlift": 0})

    def test_put_creates(self):
        response = self.client.put(
            "/api/one-rep-max/",
            {"bench": 100, "squat": 150, "deadlift": 200},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["bench"], 100)
        self.assertEqual(response.data["squat"], 150)
        self.assertEqual(response.data["deadlift"], 200)

        # Verify persisted
        orm = OneRepMax.objects.get(telegram_id=111)
        self.assertEqual(orm.bench, 100)

    def test_put_updates(self):
        OneRepMax.objects.create(telegram_id=111, bench=80)
        response = self.client.put(
            "/api/one-rep-max/",
            {"bench": 120},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["bench"], 120)

    def test_put_partial(self):
        OneRepMax.objects.create(telegram_id=111, bench=100, squat=150, deadlift=200)
        response = self.client.put(
            "/api/one-rep-max/",
            {"squat": 160},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["squat"], 160)
        self.assertEqual(response.data["bench"], 100)  # unchanged
        self.assertEqual(response.data["deadlift"], 200)  # unchanged

    def test_put_validation_over_999(self):
        response = self.client.put(
            "/api/one-rep-max/",
            {"bench": 1000},
            format="json",
        )
        self.assertEqual(response.status_code, 400)

    def test_get_after_put(self):
        self.client.put(
            "/api/one-rep-max/",
            {"bench": 90, "squat": 120, "deadlift": 180},
            format="json",
        )
        response = self.client.get("/api/one-rep-max/")
        self.assertEqual(response.data["bench"], 90)
        self.assertEqual(response.data["squat"], 120)
        self.assertEqual(response.data["deadlift"], 180)


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
