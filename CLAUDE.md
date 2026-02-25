# training-app Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-02-25

## Active Technologies
- Python 3.13 (Django 6.x), Node.js 22 (React 18 + Vite) + gunicorn, whitenoise, python-telegram-bot, uv (002-docker-deploy)
- SQLite (persistent volume) (002-docker-deploy)
- Python 3.13 (Django 6), TypeScript 5.9 (React 19) + Django REST Framework (existing), shadcn/ui (existing), Zustand (existing), lucide-react (existing) (004-weight-calc)
- SQLite (existing, via Django ORM) (004-weight-calc)

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
- 004-weight-calc: Added Python 3.13 (Django 6), TypeScript 5.9 (React 19) + Django REST Framework (existing), shadcn/ui (existing), Zustand (existing), lucide-react (existing)
- 002-docker-deploy: Added Python 3.13 (Django 6.x), Node.js 22 (React 18 + Vite) + gunicorn, whitenoise, python-telegram-bot, uv

- 001-program-viewer: Added Python 3.11+ (backend), TypeScript (frontend) + Django 5.x, Django REST Framework,

<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
