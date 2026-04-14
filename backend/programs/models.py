from django.conf import settings
from django.core.validators import MaxValueValidator
from django.db import models


class UserProfile(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="profile",
        verbose_name="Пользователь",
    )
    telegram_id = models.BigIntegerField(unique=True, db_index=True, verbose_name="Telegram ID")
    telegram_username = models.CharField(
        max_length=255,
        blank=True,
        default="",
        verbose_name="Telegram username",
    )
    first_name = models.CharField(max_length=255, blank=True, default="", verbose_name="Имя")
    last_name = models.CharField(max_length=255, blank=True, default="", verbose_name="Фамилия")
    telegram_photo_url = models.CharField(
        max_length=500,
        blank=True,
        default="",
        verbose_name="URL фото Telegram",
    )

    class Meta:
        verbose_name = "Профиль пользователя"
        verbose_name_plural = "Профили пользователей"

    def __str__(self):
        return f"{self.user.username} (tg:{self.telegram_id})"


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
    TUE = "TUE", "Вторник"
    WED = "WED", "Среда"
    THU = "THU", "Четверг"
    FRI = "FRI", "Пятница"
    SAT = "SAT", "Суббота"
    SUN = "SUN", "Воскресенье"


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
        short = {
            "MON": "Пн",
            "TUE": "Вт",
            "WED": "Ср",
            "THU": "Чт",
            "FRI": "Пт",
            "SAT": "Сб",
            "SUN": "Вс",
        }
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
    superset_group = models.PositiveIntegerField(
        null=True, blank=True, verbose_name="Группа суперсета"
    )

    class Meta:
        ordering = ["order"]
        verbose_name = "Упражнение в дне"
        verbose_name_plural = "Упражнения в дне"

    def __str__(self):
        return f"{self.order}. {self.exercise.name}"


class WorkoutCompletion(models.Model):
    telegram_id = models.BigIntegerField(db_index=True, verbose_name="Telegram ID")
    day = models.ForeignKey(
        Day,
        on_delete=models.CASCADE,
        related_name="completions",
        verbose_name="День",
        null=True,
        blank=True,
    )
    week_number = models.PositiveIntegerField(
        null=True,
        blank=True,
        verbose_name="Номер недели",
    )
    weekday = models.CharField(
        max_length=3,
        choices=Weekday.choices,
        null=True,
        blank=True,
        verbose_name="День недели",
    )
    completed_at = models.DateTimeField(auto_now_add=True, verbose_name="Завершено")

    class Meta:
        unique_together = [("telegram_id", "week_number", "weekday")]
        verbose_name = "Завершение тренировки"
        verbose_name_plural = "Завершения тренировок"

    def __str__(self):
        if self.day_id:
            return f"tg:{self.telegram_id} — {self.day} — {self.completed_at:%Y-%m-%d}"
        return (
            f"tg:{self.telegram_id} — неделя {self.week_number} — "
            f"{self.weekday} — {self.completed_at:%Y-%m-%d}"
        )


class ProgramSnapshot(models.Model):
    telegram_id = models.BigIntegerField(db_index=True, verbose_name="Telegram ID")
    version = models.PositiveIntegerField(verbose_name="Версия")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Создано")
    commit_message = models.CharField(
        max_length=255,
        blank=True,
        default="",
        verbose_name="Комментарий к версии",
    )
    payload = models.JSONField(default=dict, verbose_name="Снапшот программы")
    source_snapshot_version = models.PositiveIntegerField(
        null=True,
        blank=True,
        verbose_name="Исходная версия",
    )

    class Meta:
        ordering = ["-version"]
        unique_together = [("telegram_id", "version")]
        verbose_name = "Снапшот программы"
        verbose_name_plural = "Снапшоты программы"

    def __str__(self):
        suffix = self.commit_message or "без комментария"
        return f"tg:{self.telegram_id} — версия {self.version}: {suffix}"


class AccessoryWeight(models.Model):
    telegram_id = models.BigIntegerField(db_index=True, verbose_name="Telegram ID")
    exercise = models.ForeignKey(
        Exercise,
        on_delete=models.CASCADE,
        related_name="accessory_weights",
        verbose_name="Упражнение",
    )
    weight = models.DecimalField(
        max_digits=6, decimal_places=1, verbose_name="Вес (кг)"
    )
    sets_display = models.CharField(
        max_length=200, blank=True, default="", verbose_name="Подходы (снапшот)"
    )
    recorded_date = models.DateField(verbose_name="Дата записи")
    week = models.ForeignKey(
        Week,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="accessory_weights",
        verbose_name="Неделя",
    )

    class Meta:
        unique_together = [("telegram_id", "exercise", "recorded_date")]
        ordering = ["-recorded_date"]
        verbose_name = "Вес подсобки"
        verbose_name_plural = "Веса подсобок"

    def __str__(self):
        return f"tg:{self.telegram_id} — {self.exercise.name} — {self.weight}кг ({self.recorded_date})"


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
