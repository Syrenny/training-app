from decimal import Decimal

from django.test import TestCase
from rest_framework.test import APIClient

from programs.models import AccessoryWeight, Exercise, ExerciseCategory, Program, Week


class AccessoryWeightAPITest(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.program, _ = Program.objects.get_or_create(
            slug="base-program",
            defaults={"name": "Базовая программа"},
        )
        cls.week = Week.objects.create(program=cls.program, number=1, title="1 неделя")
        cls.exercise = Exercise.objects.create(
            name="Тестовая подсобка с заметкой",
            category=ExerciseCategory.ACCESSORY,
        )

    def setUp(self):
        self.client = APIClient()
        self.client.force_authenticate(user={"id": 42, "first_name": "Test"})

    def test_put_saves_note_with_weight_record(self):
        response = self.client.put(
            f"/api/accessory-weights/{self.exercise.id}/",
            {
                "weight": 22.5,
                "week_number": 1,
                "sets_display": "🏋×12×3",
                "note": "Тяжело, но техника ок",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["note"], "Тяжело, но техника ок")

        record = AccessoryWeight.objects.get(telegram_id=42, exercise=self.exercise)
        self.assertEqual(record.weight, Decimal("22.5"))
        self.assertEqual(record.note, "Тяжело, но техника ок")
        self.assertEqual(record.week, self.week)

    def test_history_patch_updates_note_for_existing_record(self):
        record = AccessoryWeight.objects.create(
            telegram_id=42,
            exercise=self.exercise,
            weight=Decimal("25.0"),
            sets_display="🏋×10×4",
            note="Старый текст",
            recorded_date="2026-04-28",
            week=self.week,
        )

        response = self.client.patch(
            f"/api/accessory-weights/{self.exercise.id}/history/",
            {
                "recorded_date": record.recorded_date.isoformat(),
                "note": "Обновил заметку к логу",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["note"], "Обновил заметку к логу")

        record.refresh_from_db()
        self.assertEqual(record.note, "Обновил заметку к логу")

    def test_history_returns_note_field(self):
        AccessoryWeight.objects.create(
            telegram_id=42,
            exercise=self.exercise,
            weight=Decimal("27.5"),
            sets_display="🏋×8×4",
            note="Контрольная запись",
            recorded_date="2026-04-27",
            week=self.week,
        )

        response = self.client.get(
            f"/api/accessory-weights/{self.exercise.id}/history/"
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()[0]["note"], "Контрольная запись")
