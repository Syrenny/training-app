# Implementation Plan: Деплой приложения

**Branch**: `002-docker-deploy` | **Date**: 2026-02-25 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/002-docker-deploy/spec.md`

## Summary

Контейнеризация Django + React + Bot приложения с помощью multi-stage Dockerfile и автоматический деплой через GitHub Actions на VPS. Один контейнер запускает gunicorn (фон) и Telegram-бота (foreground) через bash entrypoint. Секреты передаются через GitHub Secrets → переменные окружения при docker run.

## Technical Context

**Language/Version**: Python 3.13 (Django 6.x), Node.js 22 (React 18 + Vite)
**Primary Dependencies**: gunicorn, whitenoise, python-telegram-bot, uv
**Storage**: SQLite (persistent volume)
**Testing**: Django test framework (manage.py test), pytest (bot tests)
**Target Platform**: Linux VPS (single server)
**Project Type**: web-service + telegram bot (single container)
**Performance Goals**: N/A (single user / small scale)
**Constraints**: SQLite = single container, no parallel writes
**Scale/Scope**: 1 VPS, 1 user, <100 req/day

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Точность предметной области | N/A | Деплой не затрагивает логику расчётов |
| II. TDD | PASS | Backend тесты запускаются в CI перед деплоем (FR-007, FR-008) |
| III. UX для зала | N/A | Деплой не меняет интерфейс |
| IV. Простота (YAGNI) | PASS | Один контейнер, один VPS, bash entrypoint вместо supervisord, whitenoise вместо nginx |

**Gate result**: PASS — нет нарушений.

## Project Structure

### Documentation (this feature)

```text
specs/002-docker-deploy/
├── plan.md              # This file
├── research.md          # Phase 0 output (completed)
├── quickstart.md        # Phase 1 output
└── checklists/
    └── requirements.md  # Specification quality checklist
```

### Source Code (repository root)

```text
Dockerfile                          # Multi-stage build (Node → Python)
entrypoint.sh                       # Bash script: migrate → collectstatic → gunicorn + bot
.dockerignore                       # Exclude .git, node_modules, __pycache__, etc.
.github/
└── workflows/
    └── deploy.yml                  # CI/CD: test → build & push → SSH deploy
```

**Structure Decision**: 4 новых файла в корне репозитория. Никаких изменений в существующей структуре backend/frontend. Dockerfile собирает frontend в первом stage и копирует результат в Python-образ.

## Complexity Tracking

Нет нарушений конституции — таблица не требуется.
