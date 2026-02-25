# Data Model: Автоматический подсчёт веса

## Entity: OneRepMax

Хранит разовые максимумы пользователя для трёх базовых движений.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | AutoField (PK) | auto | Primary key |
| telegram_id | BigIntegerField | unique, indexed | Telegram user ID |
| bench | PositiveIntegerField | default=0, max=999 | 1ПМ жима лёжа (кг) |
| squat | PositiveIntegerField | default=0, max=999 | 1ПМ приседа (кг) |
| deadlift | PositiveIntegerField | default=0, max=999 | 1ПМ становой тяги (кг) |

### Validation Rules

- `telegram_id`: обязательное, уникальное, целое число > 0
- `bench`, `squat`, `deadlift`: целые числа 0–999 (0 означает "не введён")
- Один набор 1ПМ на пользователя (singleton per telegram_id)

### Relationships

- Нет FK-связей с другими моделями
- Связь с пользователем через `telegram_id` (внешний ключ к Telegram, не к Django User)
- Сопоставление с упражнениями через `ExerciseCategory`:
  - `BENCH` → `OneRepMax.bench`
  - `SQUAT` → `OneRepMax.squat`
  - `DEADLIFT` → `OneRepMax.deadlift`
  - `ACCESSORY` → не используется

### Lifecycle

- Создаётся при первом PUT-запросе (get_or_create)
- Обновляется при каждом сохранении формы 1ПМ
- Не удаляется (нет сценария удаления)
