from programs.models import DayTextBlockKind, ExerciseCategory, LoadType

P = LoadType.PERCENT
I = LoadType.INDIVIDUAL
BW = LoadType.BODYWEIGHT
S = ExerciseCategory.SQUAT
B = ExerciseCategory.BENCH
D = ExerciseCategory.DEADLIFT
A = ExerciseCategory.ACCESSORY
REST = DayTextBlockKind.REST
INFO = DayTextBlockKind.INFO

EXERCISE_NAME_ALIASES = {
    "Приседания со штангой на спине": "Приседания",
    "Молотковые сгибания на бицепс": "Молотки",
    "Подтягивания с весом": "Подтягивания",
    "Отжимания на брусьях с весом": "Отжимания на брусьях",
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
