from django.core.validators import MaxValueValidator
from django.db import models


class OneRepMax(models.Model):
    telegram_id = models.BigIntegerField(unique=True, db_index=True, verbose_name="Telegram ID")
    bench = models.PositiveIntegerField(
        default=0, validators=[MaxValueValidator(999)], verbose_name="Жим лёжа (кг)"
    )
    squat = models.PositiveIntegerField(
        default=0, validators=[MaxValueValidator(999)], verbose_name="Присед (кг)"
    )
    deadlift = models.PositiveIntegerField(
        default=0, validators=[MaxValueValidator(999)], verbose_name="Тяга (кг)"
    )

    class Meta:
        verbose_name = "Разовый максимум"
        verbose_name_plural = "Разовые максимумы"

    def __str__(self):
        return f"1ПМ (tg:{self.telegram_id}): жим={self.bench}, присед={self.squat}, тяга={self.deadlift}"


class Weekday(models.TextChoices):
    MON = "MON", "Понедельник"
    WED = "WED", "Среда"
    FRI = "FRI", "Пятница"


class ExerciseCategory(models.TextChoices):
    BENCH = "BENCH", "Жим"
    SQUAT = "SQUAT", "Присед"
    DEADLIFT = "DEADLIFT", "Тяга"
    ACCESSORY = "ACCESSORY", "Подсобка"


class LoadType(models.TextChoices):
    PERCENT = "PERCENT", "Процент от максимума"
    KG = "KG", "Фиксированный вес (кг)"
    INDIVIDUAL = "INDIVIDUAL", "Индивидуальный вес"
    BODYWEIGHT = "BODYWEIGHT", "Собственный вес"


class Week(models.Model):
    number = models.PositiveIntegerField(unique=True, verbose_name="Номер недели")
    title = models.CharField(max_length=100, blank=True, verbose_name="Название")

    class Meta:
        ordering = ["number"]
        verbose_name = "Неделя"
        verbose_name_plural = "Недели"

    def __str__(self):
        return self.title or f"Неделя {self.number}"


class Day(models.Model):
    week = models.ForeignKey(
        Week, on_delete=models.CASCADE, related_name="days", verbose_name="Неделя"
    )
    weekday = models.CharField(
        max_length=3, choices=Weekday.choices, verbose_name="День недели"
    )
    order = models.PositiveIntegerField(default=1, verbose_name="Порядок")

    class Meta:
        ordering = ["order"]
        unique_together = [("week", "weekday")]
        verbose_name = "День"
        verbose_name_plural = "Дни"

    def __str__(self):
        return f"{self.week} — {self.get_weekday_display()}"

    @property
    def weekday_display(self):
        short = {"MON": "Пн", "WED": "Ср", "FRI": "Пт"}
        return short.get(self.weekday, self.weekday)


class Exercise(models.Model):
    name = models.CharField(max_length=200, unique=True, verbose_name="Название")
    category = models.CharField(
        max_length=10, choices=ExerciseCategory.choices, verbose_name="Категория"
    )

    class Meta:
        ordering = ["name"]
        verbose_name = "Упражнение"
        verbose_name_plural = "Упражнения"

    def __str__(self):
        return self.name


class DayExercise(models.Model):
    day = models.ForeignKey(
        Day, on_delete=models.CASCADE, related_name="exercises", verbose_name="День"
    )
    exercise = models.ForeignKey(
        Exercise, on_delete=models.CASCADE, verbose_name="Упражнение"
    )
    order = models.PositiveIntegerField(default=1, verbose_name="Порядок")

    class Meta:
        ordering = ["order"]
        verbose_name = "Упражнение в дне"
        verbose_name_plural = "Упражнения в дне"

    def __str__(self):
        return f"{self.order}. {self.exercise.name}"


class ExerciseSet(models.Model):
    day_exercise = models.ForeignKey(
        DayExercise,
        on_delete=models.CASCADE,
        related_name="sets",
        verbose_name="Упражнение",
    )
    load_type = models.CharField(
        max_length=10, choices=LoadType.choices, verbose_name="Тип нагрузки"
    )
    load_value = models.DecimalField(
        max_digits=6,
        decimal_places=1,
        null=True,
        blank=True,
        verbose_name="Значение нагрузки",
    )
    reps = models.PositiveIntegerField(verbose_name="Повторения")
    sets = models.PositiveIntegerField(default=1, verbose_name="Подходы")
    order = models.PositiveIntegerField(default=1, verbose_name="Порядок")

    class Meta:
        ordering = ["order"]
        verbose_name = "Подход"
        verbose_name_plural = "Подходы"

    def __str__(self):
        return self.display

    @property
    def display(self):
        parts = []
        if self.load_type == LoadType.PERCENT:
            value = (
                int(self.load_value)
                if self.load_value == int(self.load_value)
                else self.load_value
            )
            parts.append(f"{value}%")
        elif self.load_type == LoadType.KG:
            value = (
                int(self.load_value)
                if self.load_value == int(self.load_value)
                else self.load_value
            )
            parts.append(f"{value}кг")
        elif self.load_type == LoadType.INDIVIDUAL:
            parts.append("🏋")

        parts.append(str(self.reps))

        if self.sets > 1:
            parts.append(str(self.sets))

        return "×".join(parts)
