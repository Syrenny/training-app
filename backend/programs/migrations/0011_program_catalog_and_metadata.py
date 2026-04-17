from django.db import migrations, models
import django.db.models.deletion


def populate_default_program(apps, schema_editor):
    Program = apps.get_model("programs", "Program")
    UserProfile = apps.get_model("programs", "UserProfile")
    Week = apps.get_model("programs", "Week")
    WorkoutCompletion = apps.get_model("programs", "WorkoutCompletion")
    ProgramSnapshot = apps.get_model("programs", "ProgramSnapshot")

    default_program, _ = Program.objects.get_or_create(
        slug="base-program",
        defaults={"name": "Базовая программа", "description": ""},
    )

    Week.objects.filter(program__isnull=True).update(program=default_program)
    WorkoutCompletion.objects.filter(program__isnull=True).update(program=default_program)
    ProgramSnapshot.objects.filter(program__isnull=True).update(program=default_program)
    UserProfile.objects.filter(selected_program__isnull=True).update(selected_program=default_program)


def clear_default_program(apps, schema_editor):
    Program = apps.get_model("programs", "Program")
    Program.objects.filter(slug="base-program").delete()


class Migration(migrations.Migration):
    dependencies = [
        ("programs", "0010_programsnapshot_commit_message"),
    ]

    operations = [
        migrations.CreateModel(
            name="Program",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("slug", models.SlugField(max_length=100, unique=True, verbose_name="Slug")),
                ("name", models.CharField(max_length=200, unique=True, verbose_name="Название")),
                ("description", models.TextField(blank=True, default="", verbose_name="Описание")),
            ],
            options={
                "verbose_name": "Программа",
                "verbose_name_plural": "Программы",
                "ordering": ["name"],
            },
        ),
        migrations.AddField(
            model_name="userprofile",
            name="selected_program",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="selected_by_users",
                to="programs.program",
                verbose_name="Выбранная программа",
            ),
        ),
        migrations.AddField(
            model_name="week",
            name="program",
            field=models.ForeignKey(
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="weeks",
                to="programs.program",
                verbose_name="Программа",
            ),
        ),
        migrations.AddField(
            model_name="day",
            name="title",
            field=models.CharField(blank=True, default="", max_length=200, verbose_name="Заголовок"),
        ),
        migrations.AddField(
            model_name="dayexercise",
            name="notes",
            field=models.TextField(blank=True, default="", verbose_name="Заметки"),
        ),
        migrations.AddField(
            model_name="workoutcompletion",
            name="program",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="completions",
                to="programs.program",
                verbose_name="Программа",
            ),
        ),
        migrations.AddField(
            model_name="programsnapshot",
            name="program",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="snapshots",
                to="programs.program",
                verbose_name="Программа",
            ),
        ),
        migrations.AddField(
            model_name="exerciseset",
            name="load_value_max",
            field=models.DecimalField(
                blank=True,
                decimal_places=1,
                max_digits=6,
                null=True,
                verbose_name="Максимальное значение нагрузки",
            ),
        ),
        migrations.AddField(
            model_name="exerciseset",
            name="reps_max",
            field=models.PositiveIntegerField(blank=True, null=True, verbose_name="Максимум повторений"),
        ),
        migrations.CreateModel(
            name="DayTextBlock",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                (
                    "kind",
                    models.CharField(
                        choices=[("REST", "День отдыха"), ("INFO", "Информация")],
                        default="INFO",
                        max_length=10,
                        verbose_name="Тип",
                    ),
                ),
                ("content", models.TextField(verbose_name="Текст")),
                ("order", models.PositiveIntegerField(default=1, verbose_name="Порядок")),
                (
                    "day",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="text_blocks",
                        to="programs.day",
                        verbose_name="После дня",
                    ),
                ),
            ],
            options={
                "verbose_name": "Текстовый блок дня",
                "verbose_name_plural": "Текстовые блоки дня",
                "ordering": ["order", "id"],
            },
        ),
        migrations.AlterField(
            model_name="week",
            name="number",
            field=models.PositiveIntegerField(verbose_name="Номер недели"),
        ),
        migrations.RunPython(populate_default_program, clear_default_program),
        migrations.AlterField(
            model_name="week",
            name="program",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name="weeks",
                to="programs.program",
                verbose_name="Программа",
            ),
        ),
        migrations.AlterUniqueTogether(
            name="week",
            unique_together={("program", "number")},
        ),
        migrations.AlterUniqueTogether(
            name="workoutcompletion",
            unique_together={("telegram_id", "program", "week_number", "weekday")},
        ),
        migrations.AlterUniqueTogether(
            name="programsnapshot",
            unique_together={("telegram_id", "program", "version")},
        ),
    ]
