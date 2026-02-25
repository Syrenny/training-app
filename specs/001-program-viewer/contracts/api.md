# API Contracts: 001-program-viewer

**Date**: 2026-02-25
**Base URL**: `/api/`
**Auth**: `X-Telegram-Init-Data` header (HMAC-SHA256 validation)

## Endpoints

### GET /api/weeks/

Список всех недель программы.

**Response** `200 OK`:

```json
[
  {
    "id": 1,
    "number": 1,
    "title": "1 неделя"
  },
  {
    "id": 2,
    "number": 2,
    "title": "2 неделя"
  }
]
```

**Response** `200 OK` (пустая программа):

```json
[]
```

---

### GET /api/weeks/{week_number}/

Полная программа на неделю с днями и упражнениями.

**Path params**: `week_number` (integer, >= 1)

**Response** `200 OK`:

```json
{
  "id": 1,
  "number": 1,
  "title": "1 неделя",
  "days": [
    {
      "id": 1,
      "weekday": "MON",
      "weekday_display": "Пн",
      "exercises": [
        {
          "id": 1,
          "order": 1,
          "exercise": {
            "id": 1,
            "name": "Приседания",
            "category": "SQUAT"
          },
          "sets": [
            {
              "id": 1,
              "order": 1,
              "load_type": "PERCENT",
              "load_value": 50,
              "reps": 6,
              "sets": 1,
              "display": "50%×6"
            },
            {
              "id": 2,
              "order": 2,
              "load_type": "PERCENT",
              "load_value": 60,
              "reps": 5,
              "sets": 1,
              "display": "60%×5"
            },
            {
              "id": 3,
              "order": 3,
              "load_type": "PERCENT",
              "load_value": 70,
              "reps": 4,
              "sets": 1,
              "display": "70%×4"
            },
            {
              "id": 4,
              "order": 4,
              "load_type": "PERCENT",
              "load_value": 75,
              "reps": 4,
              "sets": 4,
              "display": "75%×4×4"
            }
          ]
        },
        {
          "id": 5,
          "order": 5,
          "exercise": {
            "id": 6,
            "name": "Гиперэкстензия",
            "category": "ACCESSORY"
          },
          "sets": [
            {
              "id": 10,
              "order": 1,
              "load_type": "BODYWEIGHT",
              "load_value": null,
              "reps": 12,
              "sets": 3,
              "display": "12×3"
            }
          ]
        }
      ]
    }
  ]
}
```

**Response** `404 Not Found`:

```json
{
  "detail": "Неделя не найдена."
}
```

---

## Display Format Rules

Поле `display` в ExerciseSet формируется по правилам:

| load_type    | load_value | Формат              | Пример     |
|--------------|------------|---------------------|------------|
| PERCENT      | 75         | `{value}%×{reps}×{sets}` | `75%×4×4`  |
| PERCENT      | 75         | `{value}%×{reps}` (sets=1) | `75%×4`  |
| KG           | 40         | `{value}кг×{reps}×{sets}` | `40кг×4×2` |
| INDIVIDUAL   | null       | `🏋×{reps}×{sets}`  | `🏋×10×3`  |
| BODYWEIGHT   | null       | `{reps}×{sets}`     | `12×3`     |

Если `sets=1`, суффикс `×1` опускается.
