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
    selected_program = models.ForeignKey(
        "Program",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="selected_by_users",
        verbose_name="Выбранная программа",
    )

    class Meta:
        verbose_name = "Профиль пользователя"
        verbose_name_plural = "Профили пользователей"

    def __str__(self):
        return f"{self.user.username} (tg:{self.telegram_id})"


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


class Program(models.Model):
    slug = models.SlugField(max_length=100, unique=True, verbose_name="Slug")
    name = models.CharField(max_length=200, unique=True, verbose_name="Название")
    description = models.TextField(blank=True, default="", verbose_name="Описание")

    class Meta:
        ordering = ["name"]
        verbose_name = "Программа"
        verbose_name_plural = "Программы"

    def __str__(self):
        return self.name


class ProgramOneRepMaxExercise(models.Model):
    program = models.ForeignKey(
        Program,
        on_delete=models.CASCADE,
        related_name="one_rep_max_exercises",
        verbose_name="Программа",
    )
    exercise = models.ForeignKey(
        "Exercise",
        on_delete=models.CASCADE,
        related_name="program_one_rep_max_configs",
        verbose_name="Упражнение 1ПМ",
    )
    label = models.CharField(max_length=200, blank=True, default="", verbose_name="Подпись")
    order = models.PositiveIntegerField(default=1, verbose_name="Порядок")

    class Meta:
        ordering = ["order", "id"]
        unique_together = [("program", "exercise")]
        verbose_name = "Упражнение 1ПМ программы"
        verbose_name_plural = "Упражнения 1ПМ программы"

    def __str__(self):
        return f"{self.program.name}: {self.label or self.exercise.name}"


class Week(models.Model):
    program = models.ForeignKey(
        Program, on_delete=models.CASCADE, related_name="weeks", verbose_name="Программа"
    )
    number = models.PositiveIntegerField(verbose_name="Номер недели")
    title = models.CharField(max_length=100, blank=True, verbose_name="Название")

    class Meta:
        ordering = ["number"]
        unique_together = [("program", "number")]
        verbose_name = "Неделя"
        verbose_name_plural = "Недели"

    def __str__(self):
        return f"{self.program.name}: {self.title or f'Неделя {self.number}'}"


class Day(models.Model):
    week = models.ForeignKey(
        Week, on_delete=models.CASCADE, related_name="days", verbose_name="Неделя"
    )
    weekday = models.CharField(
        max_length=3, choices=Weekday.choices, verbose_name="День недели"
    )
    order = models.PositiveIntegerField(default=1, verbose_name="Порядок")
    title = models.CharField(max_length=200, blank=True, default="", verbose_name="Заголовок")

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
    one_rep_max_exercise = models.ForeignKey(
        Exercise,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="percent_source_for_day_exercises",
        verbose_name="Упражнение 1ПМ",
    )
    order = models.PositiveIntegerField(default=1, verbose_name="Порядок")
    superset_group = models.PositiveIntegerField(
        null=True, blank=True, verbose_name="Группа суперсета"
    )
    notes = models.TextField(blank=True, default="", verbose_name="Заметки")

    class Meta:
        ordering = ["order"]
        verbose_name = "Упражнение в дне"
        verbose_name_plural = "Упражнения в дне"

    def __str__(self):
        return f"{self.order}. {self.exercise.name}"


class OneRepMax(models.Model):
    telegram_id = models.BigIntegerField(db_index=True, verbose_name="Telegram ID")
    program = models.ForeignKey(
        Program,
        on_delete=models.CASCADE,
        related_name="one_rep_max_values",
        verbose_name="Программа",
    )
    exercise = models.ForeignKey(
        Exercise,
        on_delete=models.CASCADE,
        related_name="one_rep_max_values",
        verbose_name="Упражнение 1ПМ",
    )
    value = models.PositiveIntegerField(
        default=0,
        validators=[MaxValueValidator(999)],
        verbose_name="Разовый максимум (кг)",
    )

    class Meta:
        ordering = ["telegram_id", "program_id", "exercise_id"]
        unique_together = [("telegram_id", "program", "exercise")]
        verbose_name = "Разовый максимум"
        verbose_name_plural = "Разовые максимумы"

    def __str__(self):
        return (
            f"1ПМ (tg:{self.telegram_id}, {self.program.name}, "
            f"{self.exercise.name}) = {self.value}"
        )


class TrainingCycle(models.Model):
    telegram_id = models.BigIntegerField(db_index=True, verbose_name="Telegram ID")
    program = models.ForeignKey(
        Program,
        on_delete=models.CASCADE,
        related_name="training_cycles",
        verbose_name="Программа",
    )
    program_payload = models.JSONField(default=dict, verbose_name="Снапшот программы")
    started_at = models.DateTimeField(auto_now_add=True, verbose_name="Начало цикла")
    completed_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="Завершение цикла",
    )
    completion_reason = models.CharField(
        max_length=255,
        blank=True,
        default="",
        verbose_name="Причина завершения",
    )
    completion_feeling = models.TextField(
        blank=True,
        default="",
        verbose_name="Ощущения от программы",
    )

    class Meta:
        ordering = ["-started_at", "-id"]
        verbose_name = "Тренировочный цикл"
        verbose_name_plural = "Тренировочные циклы"

    def __str__(self):
        return (
            f"tg:{self.telegram_id} — {self.program.name} — "
            f"{self.started_at:%Y-%m-%d}"
        )

    @property
    def is_active(self):
        return self.completed_at is None


class CycleOneRepMax(models.Model):
    cycle = models.ForeignKey(
        TrainingCycle,
        on_delete=models.CASCADE,
        related_name="one_rep_max_values",
        verbose_name="Тренировочный цикл",
    )
    exercise = models.ForeignKey(
        Exercise,
        on_delete=models.CASCADE,
        related_name="cycle_one_rep_max_values",
        verbose_name="Упражнение 1ПМ",
    )
    label = models.CharField(max_length=200, blank=True, default="", verbose_name="Подпись")
    value = models.PositiveIntegerField(
        default=0,
        validators=[MaxValueValidator(999)],
        verbose_name="Разовый максимум (кг)",
    )

    class Meta:
        ordering = ["cycle_id", "exercise_id"]
        unique_together = [("cycle", "exercise")]
        verbose_name = "1ПМ тренировочного цикла"
        verbose_name_plural = "1ПМ тренировочных циклов"

    def __str__(self):
        return f"Цикл {self.cycle_id}: {self.label or self.exercise.name} = {self.value}"


class AdaptationScope(models.TextChoices):
    ONLY_HERE = "ONLY_HERE", "Только здесь"
    CURRENT_CYCLE = "CURRENT_CYCLE", "До конца текущего цикла"
    FUTURE_CYCLES = "FUTURE_CYCLES", "Во всех будущих циклах"


class AdaptationAction(models.TextChoices):
    DELETE = "DELETE", "Удалить"
    REPLACE = "REPLACE", "Заменить"


class ProgramAdaptation(models.Model):
    telegram_id = models.BigIntegerField(db_index=True, verbose_name="Telegram ID")
    program = models.ForeignKey(
        Program,
        on_delete=models.CASCADE,
        related_name="adaptations",
        verbose_name="Программа",
    )
    cycle = models.ForeignKey(
        TrainingCycle,
        on_delete=models.CASCADE,
        related_name="adaptations",
        null=True,
        blank=True,
        verbose_name="Тренировочный цикл",
    )
    scope = models.CharField(
        max_length=20,
        choices=AdaptationScope.choices,
        verbose_name="Область действия",
    )
    action = models.CharField(
        max_length=10,
        choices=AdaptationAction.choices,
        verbose_name="Действие",
    )
    slot_key = models.CharField(max_length=100, verbose_name="Ключ позиции")
    week_number = models.PositiveIntegerField(verbose_name="Номер недели")
    weekday = models.CharField(
        max_length=3,
        choices=Weekday.choices,
        verbose_name="День недели",
    )
    original_exercise = models.ForeignKey(
        Exercise,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="original_program_adaptations",
        verbose_name="Исходное упражнение",
    )
    replacement_exercise = models.ForeignKey(
        Exercise,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="replacement_program_adaptations",
        verbose_name="Заменяющее упражнение",
    )
    reason = models.TextField(blank=True, default="", verbose_name="Причина адаптации")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Создано")

    class Meta:
        ordering = ["-created_at", "-id"]
        verbose_name = "Адаптация программы"
        verbose_name_plural = "Адаптации программы"

    def __str__(self):
        return (
            f"tg:{self.telegram_id} — {self.program.name} — "
            f"{self.get_action_display()} ({self.get_scope_display()})"
        )


class WorkoutCompletion(models.Model):
    telegram_id = models.BigIntegerField(db_index=True, verbose_name="Telegram ID")
    cycle = models.ForeignKey(
        TrainingCycle,
        on_delete=models.CASCADE,
        related_name="completions",
        null=True,
        blank=True,
        verbose_name="Тренировочный цикл",
    )
    program = models.ForeignKey(
        Program,
        on_delete=models.CASCADE,
        related_name="completions",
        verbose_name="Программа",
        null=True,
        blank=True,
    )
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
        unique_together = [("cycle", "week_number", "weekday")]
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
    program = models.ForeignKey(
        Program,
        on_delete=models.CASCADE,
        related_name="snapshots",
        verbose_name="Программа",
        null=True,
        blank=True,
    )
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
        unique_together = [("telegram_id", "program", "version")]
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
    load_value_max = models.DecimalField(
        max_digits=6,
        decimal_places=1,
        null=True,
        blank=True,
        verbose_name="Максимальное значение нагрузки",
    )
    reps = models.PositiveIntegerField(verbose_name="Повторения")
    reps_max = models.PositiveIntegerField(
        null=True,
        blank=True,
        verbose_name="Максимум повторений",
    )
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
            value = self._format_load_value(self.load_value)
            max_value = self._format_load_value(self.load_value_max)
            parts.append(f"{value}-{max_value}%" if max_value is not None else f"{value}%")
        elif self.load_type == LoadType.KG:
            value = self._format_load_value(self.load_value)
            max_value = self._format_load_value(self.load_value_max)
            parts.append(f"{value}-{max_value}кг" if max_value is not None else f"{value}кг")
        elif self.load_type == LoadType.INDIVIDUAL:
            parts.append("🏋")

        parts.append(
            f"{self.reps}-{self.reps_max}" if self.reps_max and self.reps_max != self.reps else str(self.reps)
        )

        if self.sets > 1:
            parts.append(str(self.sets))

        return "×".join(parts)

    @staticmethod
    def _format_load_value(value):
        if value is None:
            return None
        return int(value) if value == int(value) else value


class DayTextBlockKind(models.TextChoices):
    REST = "REST", "День отдыха"
    INFO = "INFO", "Информация"


class DayTextBlock(models.Model):
    day = models.ForeignKey(
        Day,
        on_delete=models.CASCADE,
        related_name="text_blocks",
        verbose_name="После дня",
    )
    kind = models.CharField(
        max_length=10,
        choices=DayTextBlockKind.choices,
        default=DayTextBlockKind.INFO,
        verbose_name="Тип",
    )
    content = models.TextField(verbose_name="Текст")
    order = models.PositiveIntegerField(default=1, verbose_name="Порядок")

    class Meta:
        ordering = ["order", "id"]
        verbose_name = "Текстовый блок дня"
        verbose_name_plural = "Текстовые блоки дня"

    def __str__(self):
        return f"{self.day}: {self.get_kind_display()}"
