from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("programs", "0015_programadaptation_cancellation_fields"),
    ]

    operations = [
        migrations.AlterField(
            model_name="program",
            name="name",
            field=models.CharField(max_length=200, verbose_name="Название"),
        ),
        migrations.AddField(
            model_name="program",
            name="owner",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="custom_programs",
                to="programs.userprofile",
                verbose_name="Владелец",
            ),
        ),
        migrations.AddField(
            model_name="program",
            name="source_program",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="derived_programs",
                to="programs.program",
                verbose_name="Базовая программа-источник",
            ),
        ),
    ]
