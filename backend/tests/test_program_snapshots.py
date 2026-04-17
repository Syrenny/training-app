from django.test import TestCase
from rest_framework.test import APIClient

from programs.models import Day, DayExercise, Exercise, ExerciseCategory, ExerciseSet, LoadType, Program, ProgramSnapshot, Week, Weekday


class ProgramSnapshotAPITest(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.program, _ = Program.objects.get_or_create(
            slug="base-program",
            defaults={"name": "Базовая программа"},
        )
        cls.week = Week.objects.create(program=cls.program, number=1, title="1 неделя")
        cls.day = Day.objects.create(week=cls.week, weekday=Weekday.MON, order=1)
        cls.squat = Exercise.objects.create(
            name="Приседания",
            category=ExerciseCategory.SQUAT,
        )
        cls.bench = Exercise.objects.create(
            name="Жим лёжа",
            category=ExerciseCategory.BENCH,
        )
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
        self.client = APIClient()
        self.authenticated = APIClient()
        self.authenticated.force_authenticate(user={"id": 42, "first_name": "Test"})

    def test_get_program_returns_base_program_without_snapshot(self):
        response = self.client.get("/api/program/")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIsNone(data["version"])
        self.assertIsNone(data["commit_message"])
        self.assertEqual(data["program"]["name"], "Базовая программа")
        self.assertEqual(len(data["weeks"]), 1)
        self.assertEqual(data["weeks"][0]["days"][0]["weekday"], "MON")
        self.assertEqual(data["weeks"][0]["days"][0]["exercises"][0]["exercise"]["name"], "Приседания")

    def test_get_original_program_returns_base_program_even_with_snapshot(self):
        self.authenticated.post(
            "/api/program/snapshots/",
            {
                "commit_message": "Изменил базовую программу",
                "weeks": [
                    {
                        "days": [
                            {
                                "weekday": "SUN",
                                "exercises": [
                                    {
                                        "exercise": self.bench.id,
                                        "sets": [
                                            {
                                                "load_type": "KG",
                                                "load_value": 90,
                                                "reps": 2,
                                                "sets": 2,
                                            }
                                        ],
                                    }
                                ],
                            }
                        ]
                    }
                ],
            },
            format="json",
        )

        response = self.authenticated.get("/api/program/original/")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIsNone(data["version"])
        self.assertIsNone(data["commit_message"])
        self.assertEqual(len(data["weeks"]), 1)
        self.assertEqual(data["weeks"][0]["days"][0]["weekday"], "MON")
        self.assertEqual(data["weeks"][0]["days"][0]["exercises"][0]["exercise"]["name"], "Приседания")

    def test_post_snapshot_creates_new_version(self):
        payload = {
            "commit_message": "Добавил вторник",
            "weeks": [
                {
                    "days": [
                        {
                            "weekday": "TUE",
                            "exercises": [
                                {
                                    "exercise": self.bench.id,
                                    "sets": [
                                        {
                                            "load_type": "PERCENT",
                                            "load_value": 70,
                                            "reps": 3,
                                            "sets": 5,
                                        }
                                    ],
                                }
                            ],
                        }
                    ]
                }
            ]
        }

        response = self.authenticated.post("/api/program/snapshots/", payload, format="json")
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()["version"], 1)
        self.assertEqual(response.json()["commit_message"], "Добавил вторник")
        snapshot = ProgramSnapshot.objects.get(telegram_id=42, program=self.program, version=1)
        self.assertEqual(snapshot.commit_message, "Добавил вторник")
        self.assertEqual(snapshot.payload["weeks"][0]["days"][0]["weekday"], "TUE")

    def test_program_history_returns_snapshots(self):
        for index, weekday in enumerate(("MON", "WED"), start=1):
            self.authenticated.post(
                "/api/program/snapshots/",
                {
                    "commit_message": f"Версия {index}",
                    "weeks": [
                        {
                            "days": [
                                {
                                    "weekday": weekday,
                                    "exercises": [
                                        {
                                            "exercise": self.squat.id,
                                            "sets": [
                                                {
                                                    "load_type": "PERCENT",
                                                    "load_value": 75,
                                                    "reps": 4,
                                                    "sets": 4,
                                                }
                                            ],
                                        }
                                    ],
                                }
                            ]
                        }
                    ]
                },
                format="json",
            )

        response = self.authenticated.get("/api/program/history/")
        self.assertEqual(response.status_code, 200)
        history = response.json()
        self.assertEqual(len(history), 2)
        self.assertEqual(history[0]["version"], 2)
        self.assertEqual(history[0]["commit_message"], "Версия 2")
        self.assertEqual(history[0]["day_count"], 1)

    def test_program_history_detail_returns_snapshot(self):
        self.authenticated.post(
            "/api/program/snapshots/",
            {
                "commit_message": "Силовая воскресенья",
                "weeks": [
                    {
                        "days": [
                            {
                                "weekday": "SUN",
                                "exercises": [
                                    {
                                        "exercise": self.bench.id,
                                        "sets": [
                                            {
                                                "load_type": "KG",
                                                "load_value": 80,
                                                "reps": 2,
                                                "sets": 3,
                                            }
                                        ],
                                    }
                                ],
                            }
                        ]
                    }
                ]
            },
            format="json",
        )
        response = self.authenticated.get("/api/program/history/1/")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["version"], 1)
        self.assertEqual(data["commit_message"], "Силовая воскресенья")
        self.assertEqual(data["weeks"][0]["days"][0]["weekday"], "SUN")

    def test_snapshot_requires_commit_message(self):
        response = self.authenticated.post(
            "/api/program/snapshots/",
            {
                "weeks": [],
            },
            format="json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("commit_message", response.json())

    def test_exercise_catalog_lists_available_exercises(self):
        response = self.client.get("/api/exercises/")
        self.assertEqual(response.status_code, 200)
        names = [item["name"] for item in response.json()]
        self.assertEqual(names, ["Жим лёжа", "Приседания"])
