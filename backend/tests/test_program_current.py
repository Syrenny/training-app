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
    TrainingCycle,
    UserProfile,
    Week,
    Weekday,
)


class ProgramCurrentViewTest(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.program = Program.objects.create(slug="live-program", name="Живая программа")
        cls.week = Week.objects.create(program=cls.program, number=1, title="1 неделя")
        cls.day = Day.objects.create(week=cls.week, weekday=Weekday.MON, order=1)
        cls.squat = Exercise.objects.create(name="Тестовые приседания live", category=ExerciseCategory.SQUAT)
        cls.bench = Exercise.objects.create(name="Тестовый жим live", category=ExerciseCategory.BENCH)
        day_exercise = DayExercise.objects.create(day=cls.day, exercise=cls.squat, order=1)
        ExerciseSet.objects.create(
            day_exercise=day_exercise,
            load_type=LoadType.PERCENT,
            load_value=50,
            reps=5,
            sets=5,
            order=1,
        )

    def setUp(self):
        user_model = get_user_model()
        self.user = user_model.objects.create_user(username="live-program-user")
        self.profile = UserProfile.objects.create(
            user=self.user,
            telegram_id=42,
            selected_program=self.program,
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def test_get_program_returns_live_program_structure_without_cycle(self):
        response = self.client.get("/api/program/")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["weeks"][0]["days"][0]["weekday"], "MON")
        self.assertEqual(
            data["weeks"][0]["days"][0]["exercises"][0]["exercise"]["name"],
            "Тестовые приседания live",
        )

    def test_get_program_reflects_admin_changes_even_with_active_cycle(self):
        TrainingCycle.objects.create(
            telegram_id=self.profile.telegram_id,
            program=self.program,
        )

        new_day = Day.objects.create(
            week=self.week,
            weekday=Weekday.WED,
            order=2,
            title="Новый день",
        )
        new_exercise = DayExercise.objects.create(
            day=new_day,
            exercise=self.bench,
            one_rep_max_exercise=self.bench,
            order=1,
        )
        ExerciseSet.objects.create(
            day_exercise=new_exercise,
            load_type=LoadType.KG,
            load_value=80,
            reps=3,
            sets=3,
            order=1,
        )

        response = self.client.get("/api/program/")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        weekdays = [day["weekday"] for day in data["weeks"][0]["days"]]
        self.assertEqual(weekdays, ["MON", "WED"])
        self.assertEqual(data["weeks"][0]["days"][1]["exercises"][0]["exercise"]["name"], "Тестовый жим live")

    def test_snapshot_endpoints_are_not_available(self):
        self.assertEqual(self.client.get("/api/program/history/").status_code, 404)
        self.assertEqual(self.client.post("/api/program/snapshots/", {}, format="json").status_code, 404)
