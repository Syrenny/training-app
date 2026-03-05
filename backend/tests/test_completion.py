from django.test import TestCase
from rest_framework.test import APIClient

from programs.models import Day, Week, Weekday, WorkoutCompletion


class CompletionAPITest(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.week = Week.objects.create(number=1, title="Неделя 1")
        cls.day = Day.objects.create(week=cls.week, weekday=Weekday.MON, order=1)
        cls.other_day = Day.objects.create(week=cls.week, weekday=Weekday.WED, order=2)

    def setUp(self):
        self.client = APIClient()
        self.client.force_authenticate(user={"id": 42, "first_name": "Test"})

    # --- GET /api/completions/ ---

    def test_get_empty_list(self):
        """GET returns empty list when no completions exist."""
        response = self.client.get("/api/completions/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"completed_day_ids": []})

    def test_get_returns_completed_day_ids(self):
        """GET returns list of completed day IDs for the current user."""
        WorkoutCompletion.objects.create(telegram_id=42, day=self.day)
        response = self.client.get("/api/completions/")
        self.assertEqual(response.status_code, 200)
        self.assertIn(self.day.id, response.json()["completed_day_ids"])

    def test_get_only_returns_current_user_completions(self):
        """GET does not return another user's completions."""
        WorkoutCompletion.objects.create(telegram_id=99, day=self.day)
        response = self.client.get("/api/completions/")
        self.assertEqual(response.json()["completed_day_ids"], [])

    # --- POST /api/completions/<day_id>/ ---

    def test_post_creates_completion(self):
        """POST marks a day as completed and returns 201."""
        response = self.client.post(f"/api/completions/{self.day.id}/")
        self.assertEqual(response.status_code, 201)
        data = response.json()
        self.assertEqual(data["day_id"], self.day.id)
        self.assertIn("completed_at", data)
        self.assertTrue(WorkoutCompletion.objects.filter(telegram_id=42, day=self.day).exists())

    def test_post_idempotent(self):
        """Second POST returns 200 and does not duplicate the record."""
        self.client.post(f"/api/completions/{self.day.id}/")
        response = self.client.post(f"/api/completions/{self.day.id}/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(WorkoutCompletion.objects.filter(telegram_id=42, day=self.day).count(), 1)

    def test_post_invalid_day_returns_404(self):
        """POST to a non-existent day_id returns 404."""
        response = self.client.post("/api/completions/99999/")
        self.assertEqual(response.status_code, 404)

    # --- DELETE /api/completions/<day_id>/ ---

    def test_delete_removes_completion(self):
        """DELETE removes an existing completion and returns 204."""
        WorkoutCompletion.objects.create(telegram_id=42, day=self.day)
        response = self.client.delete(f"/api/completions/{self.day.id}/")
        self.assertEqual(response.status_code, 204)
        self.assertFalse(WorkoutCompletion.objects.filter(telegram_id=42, day=self.day).exists())

    def test_delete_idempotent(self):
        """DELETE when not completed still returns 204 (idempotent)."""
        response = self.client.delete(f"/api/completions/{self.day.id}/")
        self.assertEqual(response.status_code, 204)

    def test_delete_invalid_day_returns_404(self):
        """DELETE to a non-existent day_id returns 404."""
        response = self.client.delete("/api/completions/99999/")
        self.assertEqual(response.status_code, 404)

    # --- Auth ---

    def test_unauthenticated_get_returns_401(self):
        """GET without auth returns 401."""
        client = APIClient()
        response = client.get("/api/completions/")
        self.assertEqual(response.status_code, 401)

    def test_unauthenticated_post_returns_401(self):
        """POST without auth returns 401."""
        client = APIClient()
        response = client.post(f"/api/completions/{self.day.id}/")
        self.assertEqual(response.status_code, 401)

    def test_unauthenticated_delete_returns_401(self):
        """DELETE without auth returns 401."""
        client = APIClient()
        response = client.delete(f"/api/completions/{self.day.id}/")
        self.assertEqual(response.status_code, 401)
