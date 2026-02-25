#!/bin/bash
set -e

echo "Running migrations..."
uv run python manage.py migrate --noinput

echo "Starting gunicorn..."
uv run gunicorn config.wsgi:application \
    --bind 0.0.0.0:8000 \
    --workers 2 \
    --access-logfile - \
    --error-logfile - &

echo "Starting Telegram bot..."
uv run python manage.py runbot
