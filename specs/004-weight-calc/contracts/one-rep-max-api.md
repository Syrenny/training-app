# API Contract: One Rep Max

## GET /api/one-rep-max/

Получить 1ПМ текущего пользователя.

**Authentication**: `X-Telegram-Init-Data` header (existing)

**Response 200**:
```json
{
  "bench": 100,
  "squat": 150,
  "deadlift": 200
}
```

**Response 200 (no data yet)**:
```json
{
  "bench": 0,
  "squat": 0,
  "deadlift": 0
}
```

**Response 401**: Missing or invalid Telegram init data

---

## PUT /api/one-rep-max/

Обновить 1ПМ текущего пользователя (создаёт запись, если не существует).

**Authentication**: `X-Telegram-Init-Data` header (existing)

**Request Body**:
```json
{
  "bench": 100,
  "squat": 150,
  "deadlift": 200
}
```

**Validation**:
- Все поля: integer, 0–999
- Частичное обновление допускается (PATCH-семантика через PUT)

**Response 200**:
```json
{
  "bench": 100,
  "squat": 150,
  "deadlift": 200
}
```

**Response 400**: Validation error (non-integer, out of range)
**Response 401**: Missing or invalid Telegram init data

---

## Weight Calculation (Frontend)

Формула расчёта веса выполняется на фронтенде:

```
calculatedWeight = Math.floor(oneRepMax × percent / 100 / 2.5) * 2.5
```

Mapping категории → поле 1ПМ:
- `BENCH` → `bench`
- `SQUAT` → `squat`
- `DEADLIFT` → `deadlift`
- `ACCESSORY` → расчёт не производится
