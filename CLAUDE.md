# training-app Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-02-25

## Active Technologies
- Python 3.13 (Django 6.x), Node.js 22 (React 18 + Vite) + gunicorn, whitenoise, python-telegram-bot, uv (002-docker-deploy)
- SQLite (persistent volume) (002-docker-deploy)
- Python 3.13 (Django 6), TypeScript 5.9 (React 19) + Django REST Framework (existing), shadcn/ui (existing), Zustand (existing), lucide-react (existing) (004-weight-calc)
- SQLite (existing, via Django ORM) (004-weight-calc)
- TypeScript 5.9 (React 19 + Vite 7) + Radix UI (tabs, select), Zustand 5, Tailwind CSS 4, shadcn/ui (005-day-swipe)
- N/A (frontend-only feature; existing Zustand persist to localStorage) (005-day-swipe)
- TypeScript 5.9 (React 19 + Vite 7) + Swiper.js 12.1.2, Zustand 5, Tailwind CSS 4, shadcn/ui (006-fix-swipe)
- N/A (frontend-only, no data changes) (006-fix-swipe)
- TypeScript 5.9 (React 19 + Vite 7) + Motion 12.x (007-framer-swipe — ROLLED BACK; Swiper.js 12.1.2 still in use)
- Python 3.13 (backend) · TypeScript 5.9 / React 19 (frontend) + Django 6 + DRF (backend) · Zustand 5 + Tailwind CSS 4 + shadcn/ui (frontend) (008-workout-completion)
- SQLite via Django ORM (008-workout-completion)
- Python 3.13 (backend) · TypeScript 5.9 / React 19 (frontend) + Django 6 + DRF (backend) · Zustand 5 + Tailwind CSS 4 + shadcn/ui (frontend) (009-auth-guard)

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
- 009-auth-guard: Added Python 3.13 (backend) · TypeScript 5.9 / React 19 (frontend) + Django 6 + DRF (backend) · Zustand 5 + Tailwind CSS 4 + shadcn/ui (frontend)
- 008-workout-completion: Added Python 3.13 (backend) · TypeScript 5.9 / React 19 (frontend) + Django 6 + DRF (backend) · Motion 12.x + Zustand 5 + Tailwind CSS 4 + shadcn/ui (frontend)
- 007-framer-swipe: ROLLED BACK — Motion 12.x migration reverted, Swiper.js 12.1.2 remains active


<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
