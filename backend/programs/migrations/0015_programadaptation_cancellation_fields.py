from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("programs", "0014_trainingcycle_programadaptation_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="programadaptation",
            name="canceled_at",
            field=models.DateTimeField(blank=True, null=True, verbose_name="Отменено"),
        ),
        migrations.AddField(
            model_name="programadaptation",
            name="cancellation_reason",
            field=models.TextField(blank=True, default="", verbose_name="Причина отмены"),
        ),
        migrations.AddField(
            model_name="programadaptation",
            name="previous_slot_payload",
            field=models.JSONField(
                blank=True,
                default=None,
                null=True,
                verbose_name="Состояние позиции до адаптации",
            ),
        ),
    ]
