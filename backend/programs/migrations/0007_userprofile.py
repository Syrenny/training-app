from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("programs", "0006_add_sets_display_to_accessoryweight"),
    ]

    operations = [
        migrations.CreateModel(
            name="UserProfile",
            fields=[
                (
                    "id",
                    models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID"),
                ),
                ("telegram_id", models.BigIntegerField(db_index=True, unique=True, verbose_name="Telegram ID")),
                (
                    "telegram_username",
                    models.CharField(blank=True, default="", max_length=255, verbose_name="Telegram username"),
                ),
                ("first_name", models.CharField(blank=True, default="", max_length=255, verbose_name="Имя")),
                ("last_name", models.CharField(blank=True, default="", max_length=255, verbose_name="Фамилия")),
                (
                    "user",
                    models.OneToOneField(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="profile",
                        to=settings.AUTH_USER_MODEL,
                        verbose_name="Пользователь",
                    ),
                ),
            ],
            options={
                "verbose_name": "Профиль пользователя",
                "verbose_name_plural": "Профили пользователей",
            },
        ),
    ]
