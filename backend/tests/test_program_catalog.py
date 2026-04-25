from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from programs.models import (
    Day,
    DayExercise,
    DayTextBlock,
    DayTextBlockKind,
    Exercise,
    ExerciseCategory,
    ExerciseSet,
    LoadType,
    Program,
    ProgramOneRepMaxExercise,
    UserProfile,
    Week,
    Weekday,
)


class ProgramCatalogAccessTest(TestCase):
    def setUp(self):
        user_model = get_user_model()
        self.user = user_model.objects.create_user(username="catalog-owner")
        self.profile = UserProfile.objects.create(
            user=self.user,
            telegram_id=501,
            first_name="Catalog",
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

        self.other_user = user_model.objects.create_user(username="catalog-other")
        self.other_profile = UserProfile.objects.create(
            user=self.other_user,
            telegram_id=502,
            first_name="Other",
        )
        self.other_client = APIClient()
        self.other_client.force_authenticate(user=self.other_user)

        self.base_program = Program.objects.create(
            slug="catalog-base",
            name="Catalog Base",
            description="Base description",
        )
        self.exercise = Exercise.objects.create(
            name="Каталожный жим",
            category=ExerciseCategory.BENCH,
        )
        ProgramOneRepMaxExercise.objects.create(
            program=self.base_program,
            exercise=self.exercise,
            label="Жим",
            order=1,
        )
        week = Week.objects.create(program=self.base_program, number=1, title="1 неделя")
        day = Day.objects.create(
            week=week,
            weekday=Weekday.MON,
            order=1,
            title="Силовой день",
        )
        day_exercise = DayExercise.objects.create(
            day=day,
            exercise=self.exercise,
            one_rep_max_exercise=self.exercise,
            order=1,
            notes="Оставить технику",
        )
        ExerciseSet.objects.create(
            day_exercise=day_exercise,
            load_type=LoadType.PERCENT,
            load_value=75,
            reps=5,
            sets=5,
            order=1,
        )
        DayTextBlock.objects.create(
            day=day,
            kind=DayTextBlockKind.INFO,
            content="Не забыть разминку",
            order=1,
        )

    def test_create_custom_program_from_base_program(self):
        response = self.client.post(
            "/api/programs/create/",
            {
                "name": "Мой жимовой цикл",
                "description": "Копия под себя",
                "source_program_id": self.base_program.id,
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        self.assertTrue(response.json()["is_custom"])
        self.assertEqual(response.json()["source_program_id"], self.base_program.id)

        created = Program.objects.get(name="Мой жимовой цикл")
        self.assertEqual(created.owner, self.profile)
        self.assertEqual(created.source_program, self.base_program)
        self.assertEqual(created.one_rep_max_exercises.count(), 1)
        self.assertEqual(created.weeks.count(), 1)

        cloned_week = created.weeks.get(number=1)
        self.assertEqual(cloned_week.title, "1 неделя")
        cloned_day = cloned_week.days.get(weekday=Weekday.MON)
        self.assertEqual(cloned_day.title, "Силовой день")
        self.assertEqual(cloned_day.text_blocks.count(), 1)
        self.assertEqual(cloned_day.exercises.count(), 1)
        self.assertEqual(cloned_day.exercises.first().sets.count(), 1)
        self.assertEqual(cloned_day.exercises.first().notes, "Оставить технику")

        self.profile.refresh_from_db()
        self.assertEqual(self.profile.selected_program, created)

    def test_program_list_returns_only_base_and_own_programs(self):
        own_program = Program.objects.create(
            slug="catalog-own",
            name="Own Program",
            owner=self.profile,
            source_program=self.base_program,
        )
        Program.objects.create(
            slug="catalog-other-custom",
            name="Other Custom",
            owner=self.other_profile,
            source_program=self.base_program,
        )

        response = self.client.get("/api/programs/")
        self.assertEqual(response.status_code, 200)
        names = [item["name"] for item in response.json()]
        self.assertIn(self.base_program.name, names)
        self.assertIn(own_program.name, names)
        self.assertNotIn("Other Custom", names)

    def test_program_selection_rejects_foreign_custom_program(self):
        foreign_program = Program.objects.create(
            slug="catalog-foreign",
            name="Foreign Custom",
            owner=self.other_profile,
            source_program=self.base_program,
        )

        response = self.client.put(
            "/api/programs/selected/",
            {"program_id": foreign_program.id},
            format="json",
        )
        self.assertEqual(response.status_code, 404)

    def test_original_program_for_custom_program_returns_base_template(self):
        custom_program = Program.objects.create(
            slug="catalog-own",
            name="Own Program",
            owner=self.profile,
            source_program=self.base_program,
        )
        custom_week = Week.objects.create(
            program=custom_program,
            number=1,
            title="1 неделя",
        )
        custom_day = Day.objects.create(
            week=custom_week,
            weekday=Weekday.TUE,
            order=1,
            title="Мой день",
        )
        DayExercise.objects.create(
            day=custom_day,
            exercise=self.exercise,
            one_rep_max_exercise=self.exercise,
            order=1,
        )
        self.profile.selected_program = custom_program
        self.profile.save(update_fields=["selected_program"])

        response = self.client.get("/api/program/original/")

        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["program"]["id"], custom_program.id)
        self.assertEqual(data["program"]["source_program_id"], self.base_program.id)
        self.assertEqual(data["weeks"][0]["days"][0]["weekday"], "MON")
