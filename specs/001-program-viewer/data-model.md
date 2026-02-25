# Data Model: 001-program-viewer

**Date**: 2026-02-25

## Entities

### Week (Неделя)

| Field       | Type    | Constraints                    |
|-------------|---------|--------------------------------|
| id          | PK      | auto                           |
| number      | integer | unique, >= 1                   |
| title       | string  | optional, max 100 chars        |

**Relationships**: has many → Day

### Day (День)

| Field       | Type    | Constraints                    |
|-------------|---------|--------------------------------|
| id          | PK      | auto                           |
| week        | FK      | → Week, on_delete=CASCADE      |
| weekday     | enum    | MON / WED / FRI                |
| order       | integer | ordering within week, >= 1     |

**Constraints**: unique_together(week, weekday)

**Relationships**: has many → DayExercise

### Exercise (Упражнение)

| Field       | Type    | Constraints                    |
|-------------|---------|--------------------------------|
| id          | PK      | auto                           |
| name        | string  | unique, max 200 chars          |
| category    | enum    | BENCH / SQUAT / DEADLIFT / ACCESSORY |

**Notes**: Справочник упражнений. Одно упражнение может
использоваться в разных днях и неделях.

### DayExercise (Упражнение в дне)

| Field       | Type    | Constraints                    |
|-------------|---------|--------------------------------|
| id          | PK      | auto                           |
| day         | FK      | → Day, on_delete=CASCADE       |
| exercise    | FK      | → Exercise, on_delete=CASCADE  |
| order       | integer | ordering within day, >= 1      |

**Notes**: Связь упражнения с конкретным днём.
Одно упражнение может появляться несколько раз в одном дне
(например, Приседания как #1 и #3 в Пятницу).

**Relationships**: has many → ExerciseSet

### ExerciseSet (Подход)

| Field       | Type    | Constraints                    |
|-------------|---------|--------------------------------|
| id          | PK      | auto                           |
| day_exercise| FK      | → DayExercise, on_delete=CASCADE |
| load_type   | enum    | PERCENT / KG / INDIVIDUAL / BODYWEIGHT |
| load_value  | decimal | nullable (null for BODYWEIGHT/INDIVIDUAL) |
| reps        | integer | >= 1                           |
| sets        | integer | >= 1                           |
| order       | integer | ordering within exercise, >= 1 |

**Notes**:
- `load_type=PERCENT` + `load_value=75` → `75%×reps×sets`
- `load_type=KG` + `load_value=40` → `40кг×reps×sets`
- `load_type=INDIVIDUAL` + `load_value=null` → `🏋×reps×sets`
- `load_type=BODYWEIGHT` + `load_value=null` → `reps×sets`
- Несколько подходов через `;` (например, `50%×6; 60%×5`)
  хранятся как отдельные записи ExerciseSet с разным `order`.

## Entity Relationship Diagram

```
Week (1) ──→ (*) Day (1) ──→ (*) DayExercise (1) ──→ (*) ExerciseSet
                                       │
                                       └──→ Exercise (справочник)
```

## Enums

### Weekday
- `MON` — Понедельник
- `WED` — Среда
- `FRI` — Пятница

### ExerciseCategory
- `BENCH` — Жим
- `SQUAT` — Присед
- `DEADLIFT` — Тяга
- `ACCESSORY` — Подсобка

### LoadType
- `PERCENT` — Процент от максимума
- `KG` — Фиксированный вес в кг
- `INDIVIDUAL` — Индивидуально подобранный вес (🏋)
- `BODYWEIGHT` — Собственный вес / без отягощения
