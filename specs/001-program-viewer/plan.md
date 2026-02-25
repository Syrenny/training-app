# Implementation Plan: Просмотр программы тренировок

**Branch**: `001-program-viewer` | **Date**: 2026-02-25 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-program-viewer/spec.md`

## Summary

Простое приложение для отображения программы тренировок
в Telegram Mini App. Бэкенд на Django (DRF) хранит программу
в БД и предоставляет JSON API. Фронтенд на React (Vite +
shadcn + Tailwind) отображает недели, дни и упражнения.
Telegram Bot запускает Mini App через кнопку. Администратор
управляет контентом через Django Admin.

## Technical Context

**Language/Version**: Python 3.11+ (backend), TypeScript (frontend)
**Primary Dependencies**: Django 5.x, Django REST Framework,
  python-telegram-bot, React 18, Vite, shadcn/ui, Tailwind CSS
**Storage**: SQLite (MVP), миграция на PostgreSQL через Django ORM
**Testing**: pytest + Django TestCase (backend),
  Vitest (frontend)
**Target Platform**: Telegram Mini App (mobile webview)
**Project Type**: Web application (Telegram Bot + Mini App)
**Performance Goals**: < 3 сек загрузка программы, < 1 сек навигация
**Constraints**: Один scrollable контейнер, touch target >= 44px,
  русский язык интерфейса
**Scale/Scope**: 1 администратор, ~100 пользователей,
  ~4-8 недель программы, ~20 упражнений

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Принцип | Статус | Комментарий |
|---------|--------|-------------|
| I. Точность предметной области | ✅ PASS | 4 типа нагрузки покрывают все нотации PDF. Нотация хранится структурированно (не текстом). Display-формат формируется по правилам из contracts/api.md. |
| II. TDD | ✅ PASS | Тесты предусмотрены в tasks. Параметрические тесты для display-форматирования с данными из PDF. |
| III. UX для зала | ✅ PASS | shadcn + Tailwind, tg.expand(), touch targets, один scrollable контейнер, тема Telegram. |
| IV. Простота (YAGNI) | ✅ PASS | MVP: только просмотр. Нет калькулятора 1ПМ, нет персонализации, нет трекинга. SQLite. Минимум зависимостей. |

## Project Structure

### Documentation (this feature)

```text
specs/001-program-viewer/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── api.md
└── tasks.md              # (created by /speckit.tasks)
```

### Source Code (repository root)

```text
backend/
├── manage.py
├── config/
│   ├── settings.py
│   ├── urls.py
│   └── wsgi.py
├── programs/
│   ├── models.py          # Week, Day, Exercise, DayExercise, ExerciseSet
│   ├── admin.py           # Django Admin with inlines
│   ├── serializers.py     # DRF serializers
│   ├── views.py           # API views (WeekList, WeekDetail)
│   ├── urls.py            # /api/weeks/, /api/weeks/<number>/
│   └── authentication.py  # TelegramInitDataAuthentication
├── bot/
│   ├── management/
│   │   └── commands/
│   │       └── runbot.py  # Django management command
│   └── handlers.py        # /start handler with WebApp button
├── requirements.txt
└── .env.example

frontend/
├── src/
│   ├── App.tsx
│   ├── main.tsx
│   ├── lib/
│   │   ├── api.ts         # fetch с X-Telegram-Init-Data
│   │   └── telegram.ts    # tg.ready(), tg.expand(), theme sync
│   ├── components/
│   │   ├── WeekSelector.tsx
│   │   ├── DayTabs.tsx
│   │   ├── ExerciseList.tsx
│   │   ├── ExerciseCard.tsx
│   │   └── SetDisplay.tsx
│   └── pages/
│       └── ProgramPage.tsx
├── index.html
├── package.json
├── vite.config.ts
├── tailwind.config.ts
├── components.json        # shadcn config
└── tsconfig.json

tests/
├── backend/
│   ├── test_models.py
│   ├── test_api.py
│   ├── test_display.py    # параметрические тесты нотации
│   └── test_auth.py
└── frontend/
    └── (vitest tests)
```

**Structure Decision**: Web application (Option 2) — backend/ + frontend/.
Django подаёт собранный React-билд через static files.
Единый деплой, без CORS.

## Complexity Tracking

Нет нарушений конституции — таблица не заполняется.
