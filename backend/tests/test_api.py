from decimal import Decimal

from django.test import TestCase
from rest_framework.test import APIClient

from programs.models import (
    Day,
    DayExercise,
    Exercise,
    ExerciseCategory,
    ExerciseSet,
    LoadType,
    Week,
    Weekday,
)


class WeekListAPITest(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_empty_program_returns_empty_list(self):
        """T015: GET /api/weeks/ returns [] when no weeks exist."""
        response = self.client.get("/api/weeks/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), [])

    def test_returns_all_weeks_ordered(self):
        """T029: GET /api/weeks/ returns all weeks in order."""
        Week.objects.create(number=2, title="2 неделя")
        Week.objects.create(number=1, title="1 неделя")
        Week.objects.create(number=3, title="3 неделя")

        response = self.client.get("/api/weeks/")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(len(data), 3)
        self.assertEqual([w["number"] for w in data], [1, 2, 3])


class WeekDetailAPITest(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.week = Week.objects.create(number=1, title="1 неделя")
        cls.day = Day.objects.create(
            week=cls.week, weekday=Weekday.MON, order=1
        )
        cls.exercise = Exercise.objects.create(
            name="Приседания", category=ExerciseCategory.SQUAT
        )
        cls.day_exercise = DayExercise.objects.create(
            day=cls.day, exercise=cls.exercise, order=1
        )
        ExerciseSet.objects.create(
            day_exercise=cls.day_exercise,
            load_type=LoadType.PERCENT,
            load_value=Decimal("50"),
            reps=6,
            sets=1,
            order=1,
        )
        ExerciseSet.objects.create(
            day_exercise=cls.day_exercise,
            load_type=LoadType.PERCENT,
            load_value=Decimal("60"),
            reps=5,
            sets=1,
            order=2,
        )

    def setUp(self):
        self.client = APIClient()

    def test_week_detail_structure(self):
        """T014: Response structure matches contracts/api.md."""
        response = self.client.get("/api/weeks/1/")
        self.assertEqual(response.status_code, 200)
        data = response.json()

        self.assertEqual(data["number"], 1)
        self.assertEqual(data["title"], "1 неделя")
        self.assertIn("days", data)

        day = data["days"][0]
        self.assertEqual(day["weekday"], "MON")
        self.assertEqual(day["weekday_display"], "Пн")
        self.assertIn("exercises", day)

        ex = day["exercises"][0]
        self.assertEqual(ex["exercise"]["name"], "Приседания")
        self.assertEqual(ex["exercise"]["category"], "SQUAT")
        self.assertIn("sets", ex)

        s = ex["sets"][0]
        self.assertEqual(s["load_type"], "PERCENT")
        self.assertEqual(s["display"], "50%×6")
        self.assertEqual(s["reps"], 6)
        self.assertEqual(s["sets"], 1)

    def test_week_detail_404(self):
        response = self.client.get("/api/weeks/999/")
        self.assertEqual(response.status_code, 404)

    def test_sets_ordered(self):
        response = self.client.get("/api/weeks/1/")
        data = response.json()
        sets = data["days"][0]["exercises"][0]["sets"]
        self.assertEqual(len(sets), 2)
        self.assertEqual(sets[0]["display"], "50%×6")
        self.assertEqual(sets[1]["display"], "60%×5")
