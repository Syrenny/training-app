from django.core.management.base import BaseCommand
from django.db import transaction

from programs.models import (
    Day,
    DayExercise,
    DayTextBlock,
    DayTextBlockKind,
    Exercise,
    ExerciseCategory,
    ExerciseSet,
    LoadType,
    OneRepMax,
    Program,
    Week,
)

# Shorthand aliases
P = LoadType.PERCENT
I = LoadType.INDIVIDUAL
BW = LoadType.BODYWEIGHT
S = ExerciseCategory.SQUAT
B = ExerciseCategory.BENCH
D = ExerciseCategory.DEADLIFT
A = ExerciseCategory.ACCESSORY
REST = DayTextBlockKind.REST
INFO = DayTextBlockKind.INFO

# fmt: off
WEEK_1 = {
    "MON": [
        ("Приседания", S, [(P,50,6,1),(P,60,5,1),(P,70,4,1),(P,75,4,4)]),
        ("Жим лёжа", B, [(P,50,5,1),(P,60,5,1),(P,70,4,1),(P,75,3,5)]),
        ("Разводка лёжа на скамье", A, [(I,None,10,3)]),
        ("Приседания в глубину", S, [(I,None,10,2),(I,None,6,4)]),
        ("Гиперэкстензия", A, [(I,None,12,3)]),
        ("Пресс", A, [(I,None,20,4)]),
    ],
    "WED": [
        ("Приседания в глубину", S, [(I,None,8,1),(I,None,5,3)]),
        ("Жим штанги стоя", B, [(P,20,8,1),(P,25,6,2),(P,30,5,3)]),
        ("Становая тяга", D, [(P,50,8,1),(P,60,6,1),(P,75,6,4)]),
        ("Пресс с весом", A, [(I,None,20,4)]),
        ("Гиперэкстензия", A, [(BW,None,15,4)]),
        ("Горизонтальная тяга блока к поясу", A, [(I,None,10,4)]),
    ],
    "FRI": [
        ("Приседания", S, [(P,50,6,1),(P,60,5,1),(P,70,4,2),(P,75,3,5)]),
        ("Жим лёжа", B, [(P,50,6,1),(P,60,6,1),(P,70,6,1),(P,75,5,3)]),
        ("Приседания", S, [(P,60,6,4)]),
        ("Разводка лёжа на скамье", A, [(I,None,10,3)]),
        ("Пресс", A, [(I,None,20,4)]),
        ("Подъём штанги на бицепс", A, [(I,None,10,3)]),
    ],
}

WEEK_2 = {
    "MON": [
        ("Жим лёжа", B, [(P,50,6,1),(P,60,6,1),(P,70,4,2),(P,80,3,5)]),
        ("Приседания", S, [(P,50,6,1),(P,60,6,1),(P,70,3,2),(P,80,2,4)]),
        ("Жим лежа узким хватом", B, [(P,55,5,5)]),
        ("Подъём штанги на бицепс", A, [(I,None,6,5)]),
        ("Пресс", A, [(I,None,20,4)]),
    ],
    "WED": [
        ("Приседания в глубину", S, [(I,None,6,1),(I,None,6,1),(I,None,5,5)]),
        ("Становая тяга", D, [(P,50,6,1),(P,60,6,1),(P,70,5,4)]),
        ("Жим штанги сидя", B, [(P,50,4,5)]),
        ("Мертвая тяга", D, [(P,65,6,4)]),
        ("Гиперэкстензия", A, [(I,None,8,4)]),
        ("Подтягивания узким хватом", A, [(I,None,6,1)]),
    ],
    "FRI": [
        ("Приседания", S, [(P,50,6,1),(P,60,6,1),(P,70,4,2),(P,80,3,5)]),
        ("Жим лёжа", B, [(P,50,6,1),(P,60,5,1),(P,70,3,2),(P,80,3,5)]),
        ("Разводка лёжа на скамье", A, [(I,None,8,3)]),
        ("Жим гантелей лежа", A, [(I,None,6,4)]),
        ("Приседания в глубину", S, [(I,None,8,3)]),
        ("Молотки", A, [(I,None,10,3)]),
        ("Пресс", A, [(I,None,20,4)]),
    ],
}

WEEK_3 = {
    "MON": [
        ("Приседания", S, [(P,50,5,1),(P,60,5,1),(P,70,3,2),(P,80,2,2),(P,85,2,5)]),
        ("Жим лёжа", B, [(P,50,6,1),(P,60,5,1),(P,70,3,2),(P,80,3,1),(P,85,2,5)]),
        ("Разводка лёжа на скамье", A, [(I,None,8,3)]),
        ("Приседания в глубину", S, [(P,45,6,5)]),
        ("Разгибания на трицепс в блоке", A, [(I,None,8,3)]),
        ("Подъём штанги на бицепс прямой хват", A, [(I,None,8,4)], 1),
        ("Подъём штанги на бицепс обратный хват", A, [(I,None,8,4)], 1),
        ("Пресс", A, [(I,None,20,4)]),
    ],
    "WED": [
        ("Становая тяга", D, [(P,50,6,1),(P,60,6,1),(P,70,6,1),(P,80,4,4)]),
        ("Жим лёжа", B, [(P,40,5,3)]),
        ("Тяга верхнего блока к груди", A, [(I,None,10,4)], 1),
        ("Горизонтальная тяга блока к поясу", A, [(I,None,10,4)], 1),
        ("Гиперэкстензия", A, [(I,None,8,3)]),
        ("Пресс", A, [(I,None,20,4)]),
    ],
    "FRI": [
        ("Приседания", S, [(P,50,6,1),(P,60,6,1),(P,75,3,1),(P,75,5,1),(P,75,7,1),(P,75,9,1),(P,75,8,1),(P,75,6,1),(P,75,4,1)]),
        ("Жим лёжа", B, [(P,50,5,1),(P,60,5,1),(P,70,5,5)]),
        ("Разводка лёжа на скамье", A, [(I,None,6,3)]),
        ("Жим лежа средний хват", B, [(P,60,5,3)]),
        ("Наклоны с гантелью", S, [(P,40,5,4)]),
        ("Молотки", A, [(I,None,6,3)]),
        ("Пресс", A, [(I,None,20,4)]),
    ],
}

WEEK_4 = {
    "MON": [
        ("Приседания", S, [(P,50,5,1),(P,60,5,1),(P,70,3,2),(P,75,3,1),(P,80,2,1),(P,85,2,2),(P,80,2,2)]),
        ("Жим лёжа", B, [(P,50,6,1),(P,60,6,1),(P,70,5,2),(P,80,3,1),(P,82.5,3,1),(P,85,2,3)]),
        ("Приседания", S, [(P,60,6,4)]),
        ("Жим гантелей лежа", A, [(I,None,8,4)]),
        ("Подъём штанги на бицепс", A, [(I,None,8,5)]),
        ("Пресс", A, [(I,None,20,4)]),
    ],
    "WED": [
        ("Становая тяга", D, [(P,50,6,1),(P,60,5,1),(P,70,3,2),(P,80,2,5)]),
        ("Жим гантелей скамья 30°", B, [(P,60,4,6)]),
        ("Тяга с плинтов", D, [(P,60,5,1),(P,70,5,1),(P,80,4,1),(P,85,3,1),(P,90,3,2)]),
        ("Жим лёжа", B, [(P,50,5,1),(P,60,5,1),(P,70,4,4)]),
        ("Разгибание бедра в тренажере", A, [(I,None,10,5)]),
        ("Подтягивания широкий хват", A, [(I,None,5,1)]),
        ("Пресс", A, [(I,None,20,4)]),
    ],
    "FRI": [
        ("Жим лёжа", B, [(P,50,5,1),(P,60,5,1),(P,70,3,2),(P,75,3,5)]),
        ("Приседания", S, [(P,50,5,1),(P,60,5,1),(P,70,3,2),(P,75,3,5)]),
        ("Негативный жим", B, [(P,60,5,1),(P,70,5,1),(P,85,3,3)]),
        ("Разводка лёжа на скамье", A, [(I,None,8,3)]),
        ("Сгибания на бицепс обратным хватом", A, [(I,None,8,4)]),
        ("Горизонтальная тяга блока к поясу", A, [(I,None,8,4)]),
    ],
}

WEEK_5 = {
    "MON": [
        ("Приседания", S, [(P,50,5,1),(P,60,4,1),(P,70,3,2),(P,80,2,6)]),
        ("Жим лёжа", B, [(P,50,6,1),(P,60,5,1),(P,70,3,2),(P,80,3,6)]),
        ("Разводка гантелей лёжа", A, [(I,None,8,4)]),
        ("Приседания в глубину", S, [(P,45,6,5)]),
        ("Жим лёжа", B, [(P,50,5,1),(P,55,5,1),(P,60,5,1),(P,65,5,1),(P,70,5,1),(P,75,5,1)]),
        ("Горизонтальная тяга блока к поясу", A, [(I,None,10,4)]),
        ("Подъём штанги на бицепс", A, [(I,None,10,5)]),
    ],
    "WED": [
        ("Становая тяга", D, [(P,50,6,1),(P,60,6,1),(P,70,5,1),(P,75,4,4)]),
        ("Жим лёжа", B, [(P,50,6,1),(P,60,5,1),(P,65,5,1),(P,70,4,1),(P,75,3,1),(P,80,3,1),(P,75,3,1),(P,70,4,1),(P,65,5,1),(P,60,6,1),(P,55,7,1),(P,50,8,1)]),
        ("Разводка гантелей лёжа", A, [(I,None,10,3)]),
        ("Тяга с плинтов", D, [(P,60,6,1),(P,70,6,1),(P,80,5,1),(P,90,4,4)]),
        ("Разгибания на трицепс в блоке", A, [(I,None,8,4)]),
        ("Подтягивания узким хватом", A, [(I,None,8,5)]),
        ("Пресс", A, [(I,None,20,4)]),
    ],
    "FRI": [
        ("Приседания", S, [(P,50,6,1),(P,60,5,1),(P,70,3,2),(P,80,2,5)]),
        ("Жим лёжа", B, [(P,50,5,1),(P,60,5,1),(P,70,4,2),(P,80,3,5)]),
        ("Разводка гантелей лёжа", A, [(I,None,10,3)]),
        ("Приседания", S, [(P,60,5,1),(P,65,5,1),(P,75,4,4)]),
        ("Гиперэкстензия", A, [(I,None,12,4)]),
        ("Сгибания на бицепс обратным хватом", A, [(I,None,6,6)]),
        ("Пресс", A, [(I,None,20,4)]),
    ],
}

WEEK_6 = {
    "MON": [
        ("Приседания", S, [(P,50,6,1),(P,60,5,1),(P,70,3,2),(P,80,2,7)]),
        ("Жим лёжа", B, [(P,50,6,1),(P,60,6,1),(P,70,4,2),(P,80,3,1),(P,85,2,2),(P,80,3,2)]),
        ("Разводка скамья 30°", A, [(I,None,6,4)]),
        ("Жим лежа средний хват", B, [(P,50,5,1),(P,60,5,1),(P,65,5,1),(P,70,5,1),(P,75,5,1)]),
        ("Подъём штанги на бицепс прямой хват", A, [(I,None,6,4)], 1),
        ("Подъём штанги на бицепс обратный хват", A, [(I,None,6,4)], 1),
    ],
    "WED": [
        ("Становая тяга", D, [(P,50,6,1),(P,60,6,1),(P,70,5,1),(P,80,4,4)]),
        ("Жим гантелей скамья 30°", B, [(P,50,5,1),(P,55,5,1),(P,60,5,1),(P,65,5,4)]),
        ("Тяга с плинтов", D, [(P,60,6,1),(P,70,5,1),(P,80,4,1),(P,90,4,4)]),
        ("Тяга верхнего блока к груди", A, [(I,None,10,1),(I,None,8,5)], 1),
        ("Горизонтальная тяга блока к поясу", A, [(I,None,10,1),(I,None,8,5)], 1),
        ("Гиперэкстензия", A, [(I,None,20,2)]),
        ("Пресс", A, [(I,None,20,4)]),
    ],
    "FRI": [
        ("Приседания", S, [(P,50,4,1),(P,60,4,1),(P,75,5,1),(P,75,7,1),(P,75,9,1),(P,75,8,1),(P,75,6,1),(P,75,4,1)]),
        ("Жим лёжа", B, [(P,50,6,1),(P,60,5,1),(P,65,5,1),(P,70,5,1),(P,75,5,1),(P,80,5,2)]),
        ("Разводка лёжа на скамье", A, [(I,None,6,3)]),
        ("Разгибания на трицепс в блоке", A, [(I,None,6,5)]),
        ("Сгибания на бицепс обратным хватом", A, [(I,None,8,4)]),
        ("Пресс", A, [(I,None,20,4)]),
    ],
}

WEEK_7 = {
    "MON": [
        ("Приседания", S, [(P,50,5,1),(P,60,5,1),(P,70,3,2),(P,80,3,2),(P,85,2,2),(P,80,3,2)]),
        ("Жим лёжа", B, [(P,50,5,1),(P,60,4,1),(P,70,3,2),(P,80,3,2),(P,85,2,2),(P,80,3,2)]),
        ("Разводка лёжа на скамье", A, [(I,None,6,5)]),
        ("Полуприсед", S, [(P,60,5,1),(P,70,5,1),(P,80,5,1),(P,85,5,1),(P,95,4,4)]),
        ("Жим лежа средний хват", B, [(P,50,6,1),(P,60,5,1),(P,75,5,4)]),
        ("Пресс", A, [(I,None,20,4)]),
    ],
    "WED": [
        ("Становая тяга с подставками", D, [(P,50,6,1),(P,55,5,1),(P,60,4,4)]),
        ("Жим штанги лежа на скамье 30°", B, [(P,50,6,1),(P,60,5,1),(P,65,5,1),(P,70,5,3)]),
        ("Тяга с плинтов", D, [(P,60,6,1),(P,75,5,1),(P,80,4,1),(P,95,3,3)]),
        ("Разгибания на трицепс в блоке", A, [(I,None,10,3)]),
        ("Гиперэкстензия", A, [(I,None,8,4)]),
        ("Пресс", A, [(I,None,20,4)]),
    ],
    "FRI": [
        ("Приседания", S, [(P,50,6,1),(P,60,5,1),(P,70,4,2),(P,75,4,1),(P,85,3,2),(P,80,3,2)]),
        ("Жим лёжа", B, [(P,50,5,1),(P,60,4,1),(P,70,3,2),(P,80,3,1),(P,85,2,2),(P,90,1,2),(P,85,2,1)]),
        ("Разводка лёжа на скамье", A, [(I,None,6,5)]),
        ("Приседания", S, [(P,70,5,5)]),
        ("Жим гантелей лежа", A, [(I,None,5,5)]),
        ("Горизонтальная тяга блока к поясу", A, [(I,None,8,6)]),
        ("Пресс", A, [(I,None,20,4)]),
    ],
}

WEEK_8 = {
    "MON": [
        ("Приседания", S, [(P,50,5,1),(P,60,4,1),(P,70,3,2),(P,80,3,2),(P,85,2,1),(P,90,1,2),(P,85,2,2)]),
        ("Жим лёжа", B, [(P,50,5,1),(P,70,4,1),(P,80,3,2),(P,85,2,3),(P,90,2,1)]),
        ("Разводка лёжа на скамье", A, [(I,None,8,3)]),
        ("Полуприсед", S, [(P,50,5,1),(P,75,4,1),(P,90,3,3)]),
        ("Разгибания на трицепс в блоке", A, [(I,None,8,4)]),
        ("Подъём штанги на бицепс", A, [(I,None,8,5)]),
        ("Пресс", A, [(I,None,20,4)]),
    ],
    "WED": [
        ("Становая тяга", D, [(P,50,6,1),(P,60,6,1),(P,70,6,1),(P,75,6,3)]),
        ("Жим штанги лежа на скамье 30°", B, [(P,50,6,1),(P,60,5,1),(P,65,5,3)]),
        ("Мертвая тяга", D, [(P,50,6,1),(P,65,5,5)]),
        ("Жим лежа узким хватом", B, [(P,65,6,4)]),
        ("Подтягивания узким хватом", A, [(BW,None,10,4)]),
        ("Пресс", A, [(I,None,20,4)]),
    ],
    "FRI": [
        ("Приседания", S, [(P,50,5,1),(P,60,5,1),(P,70,5,1),(P,80,5,3)]),
        ("Жим лёжа", B, [(P,50,5,1),(P,60,5,1),(P,70,4,1),(P,80,4,4)]),
        ("Разгибания на трицепс в блоке", A, [(I,None,8,5)]),
        ("Разводка лёжа на скамье", A, [(I,None,10,4)]),
        ("Молотки", A, [(I,None,10,4)]),
        ("Пресс", A, [(I,None,20,4)]),
    ],
}

WEEK_9 = {
    "MON": [
        ("Приседания", S, [(P,50,5,1),(P,60,4,1),(P,70,3,2),(P,80,3,1),(P,90,2,2)]),
        ("Жим лёжа", B, [(P,50,5,1),(P,55,5,1),(P,60,6,1),(P,65,5,1),(P,70,5,1),(P,75,4,1),(P,80,3,1),(P,82,3,1),(P,85,2,1),(P,80,4,1),(P,75,5,1),(P,70,6,1),(P,65,7,1),(P,60,8,1)]),
        ("Разводка лёжа на скамье", A, [(I,None,10,3)]),
        ("Приседания", S, [(P,60,5,1),(P,75,5,5)]),
        ("Гиперэкстензия", A, [(I,None,6,5)]),
        ("Подъём штанги на бицепс", A, [(I,None,12,4)]),
        ("Пресс", A, [(I,None,20,4)]),
    ],
    "WED": [
        ("Становая тяга", D, [(P,50,6,1),(P,60,6,1),(P,70,5,1),(P,80,4,1),(P,85,3,5)]),
        ("Жим штанги лежа на скамье 30°", B, [(P,50,5,1),(P,60,5,1),(P,65,4,1),(P,70,4,1),(P,75,4,2)]),
        ("Приседания в глубину", S, [(P,30,8,3)]),
        ("Горизонтальная тяга блока к поясу", A, [(I,None,10,4)], 1),
        ("Тяга верхнего блока к груди", A, [(I,None,8,4)], 1),
        ("Пресс", A, [(I,None,20,4)]),
    ],
    "FRI": [
        ("Приседания", S, [(P,50,5,1),(P,60,4,1),(P,70,3,2),(P,80,3,6)]),
        ("Жим лёжа", B, [(P,50,5,1),(P,60,4,1),(P,70,3,2),(P,80,3,2),(P,85,2,3)]),
        ("Разводка лёжа на скамье", A, [(I,None,8,4)]),
        ("Негативный жим", B, [(P,70,4,1),(P,90,2,1),(P,100,2,3),(P,110,1,1)]),
        ("Наклоны", S, [(P,40,5,5)]),
        ("Молотки", A, [(I,None,10,5)]),
        ("Пресс", A, [(I,None,20,4)]),
    ],
}

WEEK_10 = {
    "MON": [
        ("Приседания", S, [(P,50,4,1),(P,55,4,1),(P,60,4,1),(P,65,4,1),(P,70,4,2)]),
        ("Жим лёжа", B, [(P,50,4,1),(P,55,4,1),(P,60,4,1),(P,65,4,1),(P,70,4,3)]),
        ("Разводка лёжа на скамье", A, [(I,None,5,3)]),
        ("Разгибания на трицепс в блоке", A, [(I,None,6,4)]),
        ("Подъём штанги на бицепс", A, [(I,None,8,4)]),
        ("Пресс", A, [(I,None,20,4)]),
    ],
    "WED": [
        ("Становая тяга", D, [(P,50,5,1),(P,60,3,1),(P,70,2,1),(P,75,2,4)]),
        ("Жим штанги лежа на скамье 30°", B, [(P,50,5,1),(P,55,5,1),(P,60,4,4)]),
        ("Тяга верхнего блока к груди", A, [(I,None,8,3)]),
        ("Пресс", A, [(I,None,20,4)]),
    ],
    "FRI": [
        ("Приседания", S, [(P,65,4,3)]),
        ("Жим лёжа", B, [(P,60,4,4)]),
    ],
}
# fmt: on

ALL_WEEKS = {
    1: ("1 неделя", WEEK_1),
    2: ("2 неделя", WEEK_2),
    3: ("3 неделя", WEEK_3),
    4: ("4 неделя", WEEK_4),
    5: ("5 неделя", WEEK_5),
    6: ("6 неделя", WEEK_6),
    7: ("7 неделя", WEEK_7),
    8: ("8 неделя", WEEK_8),
    9: ("9 неделя", WEEK_9),
    10: ("10 неделя", WEEK_10),
}


def set_item(load_type, load_value, reps, sets, *, load_value_max=None, reps_max=None):
    return {
        "load_type": load_type,
        "load_value": load_value,
        "load_value_max": load_value_max,
        "reps": reps,
        "reps_max": reps_max,
        "sets": sets,
    }


def build_notes(warmup_sets, note, *, rpe=None):
    parts = [f"Разминочные подходы: {warmup_sets}."]
    if rpe not in (None, "N/A"):
        parts.append(f"RPE: {str(rpe).replace('.', ',')}.")
    parts.append(note)
    return "\n".join(parts)


POWERBUILDING_WEEK_1 = {
    1: {
        "title": "1 неделя",
        "days": [
            {
                "weekday": "MON",
                "title": "Фулбоди 1: присед, жим стоя",
                "exercises": [
                    {
                        "name": "Приседания со штангой на спине",
                        "category": S,
                        "sets": [set_item(P, 75, 5, 1, load_value_max=80)],
                        "notes": build_notes(
                            4,
                            "Сконцентрируйтесь на технике и взрывном усилии.",
                            rpe=7.5,
                        ),
                    },
                    {
                        "name": "Приседания со штангой на спине",
                        "category": S,
                        "sets": [set_item(P, 70, 8, 2)],
                        "notes": build_notes(
                            0,
                            "Сохраняйте одинаковый наклон корпуса и технику во всех повторениях.",
                        ),
                    },
                    {
                        "name": "Жим штанги стоя",
                        "category": B,
                        "sets": [set_item(P, 70, 8, 3)],
                        "notes": build_notes(
                            2,
                            "Полностью перезапускайте каждое повторение, без touch-and-press.",
                        ),
                    },
                    {
                        "name": "Подъем корпуса в GHR",
                        "category": A,
                        "sets": [set_item(I, None, 8, 3, reps_max=10)],
                        "notes": build_notes(
                            1,
                            "Держите таз ровно. Если нет тренажера GHR, замените на нордические сгибания.",
                            rpe=7,
                        ),
                    },
                    {
                        "name": "Тяга Хелмса",
                        "category": A,
                        "sets": [set_item(I, None, 12, 3, reps_max=15)],
                        "notes": build_notes(
                            1,
                            "Строгая техника. Ведите локти вверх и назад примерно под углом 45 градусов.",
                            rpe=9,
                        ),
                    },
                    {
                        "name": "Молотковые сгибания на бицепс",
                        "category": A,
                        "sets": [set_item(I, None, 20, 3, reps_max=25)],
                        "notes": build_notes(
                            0,
                            "Держите локти зафиксированными и сильно сжимайте рукоять гантели.",
                            rpe=10,
                        ),
                    },
                ],
            },
            {
                "weekday": "TUE",
                "title": "Фулбоди 2: тяга, жим лежа",
                "exercises": [
                    {
                        "name": "Становая тяга",
                        "category": D,
                        "sets": [set_item(P, 80, 4, 3)],
                        "notes": build_notes(
                            4,
                            "Тяните классикой или сумо, в зависимости от того, где вы сильнее.",
                        ),
                    },
                    {
                        "name": "Жим штанги лежа",
                        "category": B,
                        "sets": [set_item(P, 82.5, 3, 1, load_value_max=87.5)],
                        "notes": build_notes(
                            4,
                            "Топ-сет. Оставляйте 1, максимум 2 повтора в запасе. Тяжелый подход.",
                            rpe=8.5,
                        ),
                    },
                    {
                        "name": "Жим штанги лежа",
                        "category": B,
                        "sets": [set_item(P, 67.5, 10, 2)],
                        "notes": build_notes(
                            0,
                            "На каждом повторении делайте быструю паузу на груди примерно в 1 секунду.",
                        ),
                    },
                    {
                        "name": "Отведение бедра",
                        "category": A,
                        "sets": [set_item(I, None, 15, 3, reps_max=20)],
                        "notes": build_notes(
                            0,
                            "Можно делать в тренажере, с резинкой или с отягощением. Вверху удерживайте 1 секунду.",
                            rpe=9,
                        ),
                    },
                    {
                        "name": "Подтягивания с весом",
                        "category": A,
                        "sets": [set_item(I, None, 5, 3, reps_max=8)],
                        "notes": build_notes(
                            1,
                            "Хват примерно в полтора раза шире плеч, тянитесь грудью к перекладине.",
                            rpe=8,
                        ),
                    },
                    {
                        "name": "Французский жим лежа на полу",
                        "category": A,
                        "sets": [set_item(I, None, 10, 3, reps_max=12)],
                        "notes": build_notes(
                            1,
                            "Уводите штангу за голову, слегка касайтесь пола за собой в нижней точке.",
                            rpe=8,
                        ),
                    },
                    {
                        "name": "Подъем на носки стоя",
                        "category": A,
                        "sets": [set_item(I, None, 8, 3, reps_max=10)],
                        "notes": build_notes(
                            1,
                            "Внизу делайте паузу 1-2 секунды и работайте в полной амплитуде.",
                            rpe=9,
                        ),
                    },
                ],
                "text_blocks": [
                    {
                        "kind": REST,
                        "content": "Рекомендуемый день отдыха: 1-2 дня без тренировок, в зависимости от вашего расписания.",
                    },
                ],
            },
            {
                "weekday": "THU",
                "title": "Фулбоди 3: присед, брусья",
                "exercises": [
                    {
                        "name": "Приседания со штангой на спине",
                        "category": S,
                        "sets": [set_item(P, 80, 4, 3)],
                        "notes": build_notes(
                            4,
                            "Сохраняйте плотное давление верхом спины в штангу.",
                        ),
                    },
                    {
                        "name": "Отжимания на брусьях с весом",
                        "category": A,
                        "sets": [set_item(I, None, 8, 3)],
                        "notes": build_notes(
                            2,
                            "Если нет доступа к брусьям, замените на жим гантелей лежа на полу.",
                            rpe=8,
                        ),
                    },
                    {
                        "name": "Подъем ног в висе",
                        "category": A,
                        "sets": [set_item(BW, None, 10, 3, reps_max=12)],
                        "notes": build_notes(
                            0,
                            "Подтягивайте колени к груди, двигайтесь подконтрольно. Для усложнения сильнее выпрямляйте ноги.",
                            rpe=9,
                        ),
                    },
                    {
                        "name": "Пуловер на широчайшие",
                        "category": A,
                        "sets": [set_item(I, None, 12, 3, reps_max=15)],
                        "notes": build_notes(
                            1,
                            "Можно делать с гантелью, на блоке с канатом или с резинкой. Растягивайте и прожимайте широчайшие.",
                            rpe=8,
                        ),
                    },
                    {
                        "name": "Сгибание рук с гантелями на наклонной скамье",
                        "category": A,
                        "sets": [set_item(I, None, 12, 3, reps_max=15)],
                        "notes": build_notes(
                            1,
                            "Делайте по одной руке, а не поочередно, и начинайте со слабой руки.",
                            rpe=9,
                        ),
                    },
                    {
                        "name": "Тяга к лицу",
                        "category": A,
                        "sets": [set_item(I, None, 15, 4, reps_max=20)],
                        "notes": build_notes(
                            0,
                            "Можно использовать блок с канатом или резинку. Ведя движение, сводите лопатки.",
                            rpe=9,
                        ),
                    },
                ],
            },
            {
                "weekday": "FRI",
                "title": "Фулбоди 4: тяга, жим лежа",
                "exercises": [
                    {
                        "name": "Становая тяга с паузой",
                        "category": D,
                        "sets": [set_item(P, 75, 2, 4)],
                        "notes": build_notes(
                            4,
                            "Делайте паузу на 3 секунды сразу после отрыва блинов от пола.",
                        ),
                    },
                    {
                        "name": "Жим штанги лежа с паузой",
                        "category": B,
                        "sets": [set_item(P, 75, 5, 3)],
                        "notes": build_notes(
                            3,
                            "Фиксируйте штангу на груди на 2-3 секунды.",
                        ),
                    },
                    {
                        "name": "Тяга T-грифа с упором грудью или тяга Пендлея",
                        "category": A,
                        "sets": [set_item(I, None, 10, 3)],
                        "notes": build_notes(
                            1,
                            "Следите, чтобы не перегружать поясницу. Работайте легко и минимизируйте читинг.",
                            rpe=7,
                        ),
                    },
                    {
                        "name": "Нордические сгибания",
                        "category": A,
                        "sets": [set_item(BW, None, 6, 3, reps_max=8)],
                        "notes": build_notes(
                            0,
                            "При необходимости замените на сгибания ног лежа.",
                            rpe=8,
                        ),
                    },
                    {
                        "name": "Шраги с гантелями",
                        "category": A,
                        "sets": [set_item(I, None, 20, 3, reps_max=25)],
                        "notes": build_notes(
                            0,
                            "Внизу почувствуйте растяжение трапеций, вверху сильно сократите их.",
                            rpe=9,
                        ),
                    },
                ],
                "text_blocks": [
                    {
                        "kind": REST,
                        "content": "Рекомендуемый день отдыха: 1-2 дня без тренировок, в зависимости от вашего расписания.",
                    },
                    {
                        "kind": INFO,
                        "content": "Если у вас есть возможность добавить пятый тренировочный день и вы хотите сделать акцент на гипертрофии рук, можно добавить отдельный день рук и гипертрофии.",
                    },
                ],
            },
        ],
    }
}

WEEKDAY_ORDER = {"MON": 1, "WED": 2, "FRI": 3}


class Command(BaseCommand):
    help = "Seed the database with all bundled training programs"

    def add_arguments(self, parser):
        parser.add_argument(
            "--force",
            action="store_true",
            help="Rebuild bundled source programs from scratch",
        )
        parser.add_argument(
            "--dev-user",
            action="store_true",
            help="Create OneRepMax record for dev user (telegram_id=1)",
        )

    def handle(self, *args, **options):
        if options["force"]:
            self.stdout.write(
                self.style.WARNING(
                    "Rebuilding bundled source programs only. User snapshots will be preserved..."
                )
            )

        with transaction.atomic():
            base_program, _ = Program.objects.update_or_create(
                slug="base-program",
                defaults={"name": "Базовая программа"},
            )
            powerbuilding_program, _ = Program.objects.update_or_create(
                slug="jeff-nippard-powerbuilding",
                defaults={"name": "Jeff Nippard Powerbuilding"},
            )

            self.reset_program_structure(base_program)
            self.reset_program_structure(powerbuilding_program)

            base_created = self.seed_legacy_program(base_program, ALL_WEEKS)
            power_created = self.seed_structured_program(
                powerbuilding_program,
                POWERBUILDING_WEEK_1,
            )

        self.stdout.write(
            self.style.SUCCESS(
                "Done: "
                f"базовая программа — {base_created} недель пересобрано; "
                f"Jeff Nippard Powerbuilding — {power_created} недель пересобрано"
            )
        )

        if options["dev_user"]:
            OneRepMax.objects.update_or_create(
                telegram_id=1,
                defaults={"bench": 100, "squat": 120, "deadlift": 140},
            )
            self.stdout.write(self.style.SUCCESS("Dev user OneRepMax created/updated (telegram_id=1)"))

    def reset_program_structure(self, program):
        self.stdout.write(f"  {program.name}: удаляю старую исходную структуру")
        program.weeks.all().delete()

    def get_or_update_exercise(self, name, category):
        exercise, created = Exercise.objects.get_or_create(
            name=name,
            defaults={"category": category},
        )
        if not created and exercise.category != category:
            exercise.category = category
            exercise.save(update_fields=["category"])
        return exercise

    def seed_legacy_program(self, program, weeks_data):
        created_count = 0

        for week_number, (title, days_data) in weeks_data.items():
            week = Week.objects.create(
                program=program,
                number=week_number,
                title=title,
            )

            for weekday_code, exercises_data in days_data.items():
                day = Day.objects.create(
                    week=week,
                    weekday=weekday_code,
                    order=WEEKDAY_ORDER[weekday_code],
                )

                for ex_order, ex_tuple in enumerate(exercises_data, start=1):
                    ex_name = ex_tuple[0]
                    ex_category = ex_tuple[1]
                    sets_data = ex_tuple[2]
                    superset_group = ex_tuple[3] if len(ex_tuple) > 3 else None

                    exercise = self.get_or_update_exercise(ex_name, ex_category)
                    day_exercise = DayExercise.objects.create(
                        day=day,
                        exercise=exercise,
                        order=ex_order,
                        superset_group=superset_group,
                    )

                    for set_order, (load_type, load_value, reps, sets) in enumerate(
                        sets_data, start=1
                    ):
                        ExerciseSet.objects.create(
                            day_exercise=day_exercise,
                            load_type=load_type,
                            load_value=load_value,
                            reps=reps,
                            sets=sets,
                            order=set_order,
                        )

            created_count += 1
            self.stdout.write(f"  {program.name}: неделя {week_number} создана")

        return created_count

    def seed_structured_program(self, program, weeks_data):
        created_count = 0

        for week_number, week_data in weeks_data.items():
            week = Week.objects.create(
                program=program,
                number=week_number,
                title=week_data["title"],
            )

            for day_order, day_data in enumerate(week_data["days"], start=1):
                day = Day.objects.create(
                    week=week,
                    weekday=day_data["weekday"],
                    order=day_order,
                    title=day_data.get("title", ""),
                )

                for ex_order, exercise_data in enumerate(day_data.get("exercises", []), start=1):
                    exercise = self.get_or_update_exercise(
                        exercise_data["name"],
                        exercise_data["category"],
                    )
                    day_exercise = DayExercise.objects.create(
                        day=day,
                        exercise=exercise,
                        order=ex_order,
                        superset_group=exercise_data.get("superset_group"),
                        notes=exercise_data.get("notes", ""),
                    )

                    for set_order, set_data in enumerate(exercise_data.get("sets", []), start=1):
                        ExerciseSet.objects.create(
                            day_exercise=day_exercise,
                            load_type=set_data["load_type"],
                            load_value=set_data.get("load_value"),
                            load_value_max=set_data.get("load_value_max"),
                            reps=set_data["reps"],
                            reps_max=set_data.get("reps_max"),
                            sets=set_data["sets"],
                            order=set_order,
                        )

                for block_order, block_data in enumerate(day_data.get("text_blocks", []), start=1):
                    DayTextBlock.objects.create(
                        day=day,
                        kind=block_data["kind"],
                        content=block_data["content"],
                        order=block_order,
                    )

            created_count += 1
            self.stdout.write(f"  {program.name}: неделя {week_number} создана")

        return created_count
