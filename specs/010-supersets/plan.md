# Implementation Plan: Отображение суперсетов

**Branch**: `010-supersets` | **Date**: 2026-03-11
**Input**: Упражнения, входящие в суперсет, должны визуально группироваться вместе

## Summary

Сейчас все упражнения в дне отображаются как плоский список отдельных карточек. Необходимо добавить поддержку суперсетов: несколько упражнений, объединённых в группу, должны визуально отображаться как единый блок с общей нумерацией (например, «2a», «2b»).

## Текущее состояние

- **Модель `DayExercise`** (`backend/programs/models.py:97`): имеет только `order` (int) — нет механизма группировки.
- **API**: возвращает плоский массив `exercises[]` в `DaySerializer`.
- **Фронтенд `ExerciseList`** (`frontend/src/components/ExerciseList.tsx`): `exercises.map(…)` — рендерит каждое упражнение как отдельную `ExerciseCard`.
- **`ExerciseCard`** (`frontend/src/components/ExerciseCard.tsx`): отображает `order` как простой номер (`{order}.`).

## Решение

### Подход: поле `superset_group` на `DayExercise`

Добавить nullable integer поле `superset_group` в модель `DayExercise`.
- `superset_group = NULL` → обычное упражнение, отображается как раньше.
- `superset_group = N` → упражнение входит в суперсет с номером N (в рамках одного дня).
- Все `DayExercise` с одинаковым `(day_id, superset_group)` — одна группа.
- Внутри группы порядок определяется существующим полем `order`.

**Почему не отдельная модель**: минимум изменений, не нужен новый FK, не ломает существующие данные (миграция — просто добавление nullable поля).

---

## Изменения по слоям

### 1. Backend — модель (`backend/programs/models.py`)

```python
class DayExercise(models.Model):
    day = models.ForeignKey(Day, ...)
    exercise = models.ForeignKey(Exercise, ...)
    order = models.PositiveIntegerField(default=1, verbose_name="Порядок")
    superset_group = models.PositiveIntegerField(
        null=True, blank=True, verbose_name="Группа суперсета"
    )
```

- Миграция: `python manage.py makemigrations && python manage.py migrate`
- Существующие данные не ломаются (`superset_group=NULL` по умолчанию).

### 2. Backend — admin (`backend/programs/admin.py`)

Добавить `superset_group` в `DayExerciseInline.fields` и `DayExerciseAdmin.list_display`:

```python
class DayExerciseInline(admin.TabularInline):
    model = DayExercise
    extra = 1
    fields = ["order", "exercise", "superset_group"]
    show_change_link = True
```

Это позволит тренеру задавать суперсеты через Django Admin.

### 3. Backend — сериализатор (`backend/programs/serializers.py`)

Добавить `superset_group` в `DayExerciseSerializer.fields`:

```python
class DayExerciseSerializer(serializers.ModelSerializer):
    exercise = ExerciseSerializer(read_only=True)
    sets = ExerciseSetSerializer(many=True, read_only=True)

    class Meta:
        model = DayExercise
        fields = ["id", "order", "exercise", "sets", "superset_group"]
```

API-ответ не меняет структуру — просто добавляется новое поле `superset_group: number | null`.

### 4. Frontend — типы (`frontend/src/lib/api.ts`)

```typescript
export interface DayExerciseData {
  id: number;
  order: number;
  exercise: ExerciseData;
  sets: ExerciseSetData[];
  superset_group: number | null;
}
```

### 5. Frontend — группировка (`frontend/src/components/ExerciseList.tsx`)

Добавить утилиту группировки перед рендерингом:

```typescript
type ExerciseItem =
  | { type: "single"; exercise: DayExerciseData }
  | { type: "superset"; group: number; exercises: DayExerciseData[] };

function groupExercises(exercises: DayExerciseData[]): ExerciseItem[] {
  const items: ExerciseItem[] = [];
  let i = 0;
  while (i < exercises.length) {
    const ex = exercises[i];
    if (ex.superset_group != null) {
      const group: DayExerciseData[] = [];
      const groupId = ex.superset_group;
      while (i < exercises.length && exercises[i].superset_group === groupId) {
        group.push(exercises[i]);
        i++;
      }
      items.push({ type: "superset", group: groupId, exercises: group });
    } else {
      items.push({ type: "single", exercise: ex });
      i++;
    }
  }
  return items;
}
```

Рендеринг:

```tsx
{groupExercises(exercises).map((item) =>
  item.type === "single" ? (
    <ExerciseCard key={item.exercise.id} dayExercise={item.exercise} />
  ) : (
    <SupersetCard key={`ss-${item.group}`} exercises={item.exercises} />
  )
)}
```

### 6. Frontend — новый компонент `SupersetCard` (`frontend/src/components/SupersetCard.tsx`)

Визуальная группировка суперсета:

```tsx
export function SupersetCard({ exercises }: { exercises: DayExerciseData[] }) {
  const groupOrder = exercises[0].order;
  const letters = "abcdefghij";

  return (
    <Card className="mb-3 border-l-4 border-l-primary">
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <Badge variant="outline" className="text-xs">Суперсет</Badge>
        </div>
        {exercises.map((dayExercise, idx) => (
          <div key={dayExercise.id}>
            {/* Нумерация: 2a, 2b, 2c... */}
            <div className="flex items-start gap-2 mb-1">
              <span className="text-muted-foreground text-sm font-medium">
                {groupOrder}{letters[idx]}.
              </span>
              <span className="font-semibold">{dayExercise.exercise.name}</span>
              <Badge variant="secondary" className="text-xs ml-auto shrink-0">
                {categoryLabels[dayExercise.exercise.category]}
              </Badge>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {dayExercise.sets.map((set) => (
                <SetDisplay key={set.id} set={set} category={dayExercise.exercise.category} />
              ))}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
```

**Визуальные отличия суперсета от обычных упражнений:**
- Общая карточка с акцентной левой границей (`border-l-4 border-l-primary`)
- Бейдж «Суперсет»
- Нумерация с буквами: `2a.`, `2b.` вместо `2.`, `3.`

### 7. Backend — seeddata (если есть)

Обновить команду `seeddata`, чтобы создать пример суперсета для проверки.

---

## Последовательность реализации

| # | Задача | Слой | Файлы |
|---|--------|------|-------|
| 1 | Добавить поле `superset_group` в модель + миграция | Backend | `models.py` |
| 2 | Добавить `superset_group` в admin | Backend | `admin.py` |
| 3 | Добавить `superset_group` в сериализатор | Backend | `serializers.py` |
| 4 | Обновить тип `DayExerciseData` | Frontend | `api.ts` |
| 5 | Создать компонент `SupersetCard` | Frontend | `SupersetCard.tsx` (NEW) |
| 6 | Добавить группировку в `ExerciseList` | Frontend | `ExerciseList.tsx` |
| 7 | Обновить seeddata с примером суперсета | Backend | `seeddata.py` |

## Что НЕ входит в скоуп

- Drag-and-drop перестановка упражнений в суперсете
- Создание/редактирование суперсетов из фронтенда (только через Django Admin)
- Трисеты, гигантские сеты — технически работают (3+ упражнений в одной группе), но UI оптимизирован под пары
