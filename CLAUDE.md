# training-app Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-02-25

## Active Technologies
- Python 3.13 (Django 6.x), Node.js 22 (React 18 + Vite) + gunicorn, whitenoise, python-telegram-bot, uv (002-docker-deploy)
- SQLite (persistent volume) (002-docker-deploy)
- Python 3.13 (Django 6), TypeScript 5.9 (React 19) + Django REST Framework (existing), shadcn/ui (existing), Zustand (existing), lucide-react (existing) (004-weight-calc)
- SQLite (existing, via Django ORM) (004-weight-calc)
- TypeScript 5.9 (React 19 + Vite 7) + Radix UI (tabs, select), Zustand 5, Tailwind CSS 4, shadcn/ui (005-day-swipe)
- N/A (frontend-only feature; existing Zustand persist to localStorage) (005-day-swipe)

- Python 3.11+ (backend), TypeScript (frontend) + Django 5.x, Django REST Framework, (001-program-viewer)

## Project Structure

```text
src/
tests/
```

## Commands

cd src [ONLY COMMANDS FOR ACTIVE TECHNOLOGIES][ONLY COMMANDS FOR ACTIVE TECHNOLOGIES] pytest [ONLY COMMANDS FOR ACTIVE TECHNOLOGIES][ONLY COMMANDS FOR ACTIVE TECHNOLOGIES] ruff check .

## Code Style

Python 3.11+ (backend), TypeScript (frontend): Follow standard conventions

## Recent Changes
- 005-day-swipe: Added TypeScript 5.9 (React 19 + Vite 7) + Radix UI (tabs, select), Zustand 5, Tailwind CSS 4, shadcn/ui
- 004-weight-calc: Added Python 3.13 (Django 6), TypeScript 5.9 (React 19) + Django REST Framework (existing), shadcn/ui (existing), Zustand (existing), lucide-react (existing)
- 002-docker-deploy: Added Python 3.13 (Django 6.x), Node.js 22 (React 18 + Vite) + gunicorn, whitenoise, python-telegram-bot, uv


<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
