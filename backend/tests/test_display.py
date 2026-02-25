from decimal import Decimal

from django.test import TestCase

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


class ExerciseSetDisplayTest(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.week = Week.objects.create(number=1)
        cls.day = Day.objects.create(week=cls.week, weekday=Weekday.MON, order=1)
        cls.exercise = Exercise.objects.create(
            name="Приседания", category=ExerciseCategory.SQUAT
        )
        cls.day_exercise = DayExercise.objects.create(
            day=cls.day, exercise=cls.exercise, order=1
        )

    def _create_set(self, **kwargs):
        defaults = {
            "day_exercise": self.day_exercise,
            "load_type": LoadType.PERCENT,
            "reps": 4,
            "sets": 1,
            "order": 1,
        }
        defaults.update(kwargs)
        return ExerciseSet(**defaults)

    def test_percent_single_set(self):
        s = self._create_set(
            load_type=LoadType.PERCENT, load_value=Decimal("50"), reps=6, sets=1
        )
        self.assertEqual(s.display, "50%×6")

    def test_percent_multiple_sets(self):
        s = self._create_set(
            load_type=LoadType.PERCENT, load_value=Decimal("75"), reps=4, sets=4
        )
        self.assertEqual(s.display, "75%×4×4")

    def test_percent_three_sets(self):
        s = self._create_set(
            load_type=LoadType.PERCENT, load_value=Decimal("75"), reps=3, sets=5
        )
        self.assertEqual(s.display, "75%×3×5")

    def test_kg_multiple_sets(self):
        s = self._create_set(
            load_type=LoadType.KG, load_value=Decimal("40"), reps=4, sets=2
        )
        self.assertEqual(s.display, "40кг×4×2")

    def test_kg_single_set(self):
        s = self._create_set(
            load_type=LoadType.KG, load_value=Decimal("40"), reps=4, sets=1
        )
        self.assertEqual(s.display, "40кг×4")

    def test_individual_weight(self):
        s = self._create_set(
            load_type=LoadType.INDIVIDUAL, load_value=None, reps=10, sets=3
        )
        self.assertEqual(s.display, "🏋×10×3")

    def test_individual_single_set(self):
        s = self._create_set(
            load_type=LoadType.INDIVIDUAL, load_value=None, reps=10, sets=1
        )
        self.assertEqual(s.display, "🏋×10")

    def test_bodyweight(self):
        s = self._create_set(
            load_type=LoadType.BODYWEIGHT, load_value=None, reps=12, sets=3
        )
        self.assertEqual(s.display, "12×3")

    def test_bodyweight_single_set(self):
        s = self._create_set(
            load_type=LoadType.BODYWEIGHT, load_value=None, reps=15, sets=1
        )
        self.assertEqual(s.display, "15")

    def test_sets_one_omits_suffix(self):
        """When sets=1, the ×1 suffix must be omitted."""
        s = self._create_set(
            load_type=LoadType.PERCENT, load_value=Decimal("60"), reps=5, sets=1
        )
        self.assertNotIn("×1", s.display)
        self.assertEqual(s.display, "60%×5")

    def test_decimal_value_integer(self):
        """Whole-number decimals should display without .0"""
        s = self._create_set(
            load_type=LoadType.PERCENT, load_value=Decimal("70.0"), reps=4, sets=1
        )
        self.assertEqual(s.display, "70%×4")

    def test_decimal_value_fractional(self):
        """Non-integer decimals should keep decimal part."""
        s = self._create_set(
            load_type=LoadType.KG, load_value=Decimal("2.5"), reps=20, sets=4
        )
        self.assertEqual(s.display, "2.5кг×20×4")
