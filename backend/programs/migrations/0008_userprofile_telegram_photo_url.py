from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("programs", "0007_userprofile"),
    ]

    operations = [
        migrations.AddField(
            model_name="userprofile",
            name="telegram_photo_url",
            field=models.CharField(
                blank=True,
                default="",
                max_length=500,
                verbose_name="URL фото Telegram",
            ),
        ),
    ]
