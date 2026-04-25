from django.test import TestCase
from rest_framework.test import APIClient

from programs.models import (
    Program,
    Week,
    Weekday,
    WorkoutCompletion,
)


class CompletionAPITest(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.program, _ = Program.objects.get_or_create(
            slug="base-program",
            defaults={"name": "Базовая программа"},
        )
        cls.week = Week.objects.create(program=cls.program, number=1, title="Неделя 1")

    def setUp(self):
        self.client = APIClient()
        self.client.force_authenticate(user={"id": 42, "first_name": "Test"})

    # --- GET /api/completions/ ---

    def test_get_empty_list(self):
        """GET returns empty list when no completions exist."""
        response = self.client.get("/api/completions/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"completions": []})

    def test_get_returns_completions_with_dates(self):
        """GET returns week/day coordinates for the current user."""
        WorkoutCompletion.objects.create(
            telegram_id=42,
            program=self.program,
            week_number=1,
            weekday=Weekday.MON,
        )
        response = self.client.get("/api/completions/")
        self.assertEqual(response.status_code, 200)
        completions = response.json()["completions"]
        self.assertEqual(
            completions,
            [
                {
                    "week_number": 1,
                    "weekday": "MON",
                    "completed_at": completions[0]["completed_at"],
                }
            ],
        )

    def test_get_only_returns_current_user_completions(self):
        """GET does not return another user's completions."""
        WorkoutCompletion.objects.create(
            telegram_id=99,
            program=self.program,
            week_number=1,
            weekday=Weekday.MON,
        )
        response = self.client.get("/api/completions/")
        self.assertEqual(response.json()["completions"], [])

    # --- POST /api/completions/<week_number>/<weekday>/ ---

    def test_post_creates_completion(self):
        """POST marks a day as completed and returns 201."""
        response = self.client.post("/api/completions/1/MON/")
        self.assertEqual(response.status_code, 201)
        data = response.json()
        self.assertEqual(data["week_number"], 1)
        self.assertEqual(data["weekday"], "MON")
        self.assertIn("completed_at", data)
        self.assertTrue(
            WorkoutCompletion.objects.filter(
                telegram_id=42,
                program=self.program,
                week_number=1,
                weekday=Weekday.MON,
            ).exists()
        )

    def test_post_idempotent(self):
        """Second POST returns 200 and does not duplicate the record."""
        self.client.post("/api/completions/1/MON/")
        response = self.client.post("/api/completions/1/MON/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            WorkoutCompletion.objects.filter(
                telegram_id=42,
                program=self.program,
                week_number=1,
                weekday=Weekday.MON,
            ).count(),
            1,
        )

    def test_post_invalid_weekday_returns_404(self):
        """POST with an invalid weekday returns 404."""
        response = self.client.post("/api/completions/1/XXX/")
        self.assertEqual(response.status_code, 404)

    # --- DELETE /api/completions/<week_number>/<weekday>/ ---

    def test_delete_removes_completion(self):
        """DELETE removes an existing completion and returns 204."""
        WorkoutCompletion.objects.create(
            telegram_id=42,
            program=self.program,
            week_number=1,
            weekday=Weekday.MON,
        )
        response = self.client.delete("/api/completions/1/MON/")
        self.assertEqual(response.status_code, 204)
        self.assertFalse(
            WorkoutCompletion.objects.filter(
                telegram_id=42,
                program=self.program,
                week_number=1,
                weekday=Weekday.MON,
            ).exists()
        )

    def test_delete_idempotent(self):
        """DELETE when not completed still returns 204 (idempotent)."""
        response = self.client.delete("/api/completions/1/MON/")
        self.assertEqual(response.status_code, 204)

    def test_delete_invalid_weekday_returns_404(self):
        """DELETE with an invalid weekday returns 404."""
        response = self.client.delete("/api/completions/1/XXX/")
        self.assertEqual(response.status_code, 404)

    def test_delete_all_resets_current_program_completions(self):
        WorkoutCompletion.objects.create(
            telegram_id=42,
            program=self.program,
            week_number=1,
            weekday=Weekday.MON,
        )
        response = self.client.delete("/api/completions/")
        self.assertEqual(response.status_code, 204)
        self.assertFalse(
            WorkoutCompletion.objects.filter(
                telegram_id=42,
                program=self.program,
            ).exists()
        )

    # --- Auth ---

    def test_unauthenticated_get_returns_401(self):
        """GET without auth returns 401."""
        client = APIClient()
        response = client.get("/api/completions/")
        self.assertEqual(response.status_code, 401)

    def test_unauthenticated_post_returns_401(self):
        """POST without auth returns 401."""
        client = APIClient()
        response = client.post("/api/completions/1/MON/")
        self.assertEqual(response.status_code, 401)

    def test_unauthenticated_delete_returns_401(self):
        """DELETE without auth returns 401."""
        client = APIClient()
        response = client.delete("/api/completions/1/MON/")
        self.assertEqual(response.status_code, 401)
