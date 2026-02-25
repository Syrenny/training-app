# Implementation Plan: Автоматический подсчёт веса

**Branch**: `004-weight-calc` | **Date**: 2026-02-25 | **Spec**: [spec.md](spec.md)

## Summary

Добавление модели OneRepMax (привязка к Telegram user_id), REST API для CRUD 1ПМ, фронтенд-страница ввода 1ПМ с навигацией через сайдбар (shadcn Sheet), расчёт и отображение рассчитанного веса в бейджах подходов (формула: floor(1ПМ × % / 100 / 2.5) × 2.5).

## Technical Context

**Language/Version**: Python 3.13 (Django 6), TypeScript 5.9 (React 19)
**Primary Dependencies**: Django REST Framework (existing), shadcn/ui (existing), Zustand (existing), lucide-react (existing)
**Storage**: SQLite (existing, via Django ORM)
**Testing**: Django TestCase (backend), manual visual (frontend)
**Target Platform**: Telegram Mini App (mobile)
**Project Type**: Full-stack web application (Django + React SPA)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Точность предметной области | ✅ PASS | Формула округления вниз до 2.5 кг задокументирована. Сопоставление категория→1ПМ чётко определено. |
| II. TDD | ✅ PASS | Backend-тесты для модели и API эндпоинтов. Параметрические тесты расчёта весов. |
| III. UX для зала | ✅ PASS | Сайдбар + простая страница ввода. Вес отображается прямо в бейдже подхода. |
| IV. Простота (YAGNI) | ✅ PASS | Минимум: 1 модель, 1 API viewset, 1 страница ввода, модификация SetDisplay. Никаких новых зависимостей. |

## Project Structure

### Documentation (this feature)

```text
specs/004-weight-calc/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── one-rep-max-api.md
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```text
backend/
├── programs/
│   ├── models.py              # MODIFY: add OneRepMax model
│   ├── serializers.py         # MODIFY: add OneRepMaxSerializer
│   ├── views.py               # MODIFY: add OneRepMaxView
│   ├── urls.py                # MODIFY: add /api/one-rep-max/ route
│   └── authentication.py      # EXISTING: TelegramInitDataAuthentication (reuse)
└── tests/
    └── test_one_rep_max.py    # NEW: tests for model + API + weight calculation

frontend/
├── src/
│   ├── lib/
│   │   ├── api.ts             # MODIFY: add OneRepMax types + fetch/save functions
│   │   └── store.ts           # MODIFY: add oneRepMax state + actions
│   ├── components/
│   │   ├── SetDisplay.tsx     # MODIFY: show calculated weight in badge
│   │   ├── Sidebar.tsx        # NEW: shadcn Sheet sidebar with navigation
│   │   └── OneRepMaxPage.tsx  # NEW: 1RM input form (3 fields)
│   └── pages/
│       └── ProgramPage.tsx    # MODIFY: add sidebar trigger button
└── src/components/ui/
    └── sheet.tsx              # NEW: shadcn Sheet component (via npx shadcn add)
```
