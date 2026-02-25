# Quickstart: 001-program-viewer

## Prerequisites

- Python 3.11+
- Node.js 20+
- Telegram Bot Token (from @BotFather)

## Backend Setup

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Environment
cp .env.example .env
# Edit .env: set TELEGRAM_BOT_TOKEN

# Database
python manage.py migrate
python manage.py createsuperuser

# Run server
python manage.py runserver
```

## Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

## Telegram Bot

```bash
cd backend
python manage.py runbot
```

## Data Entry

1. Open http://localhost:8000/admin/
2. Log in with superuser credentials
3. Add Weeks → Days → Exercises → Sets
   following the reference program (docs/reference/program.pdf)

## Verify

1. Open Telegram → find the bot → /start
2. Press "Программа тренировок" button
3. Mini App opens with Week 1 program
4. Switch between days (Пн, Ср, Пт)
5. Verify exercises match the reference PDF

## Build for Production

```bash
cd frontend
npm run build
# Output goes to backend/static/frontend/

cd ../backend
python manage.py collectstatic
```
