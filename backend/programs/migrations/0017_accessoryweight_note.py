from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("programs", "0016_program_owner_and_source"),
    ]

    operations = [
        migrations.AddField(
            model_name="accessoryweight",
            name="note",
            field=models.TextField(blank=True, default="", verbose_name="Заметка"),
        ),
    ]
