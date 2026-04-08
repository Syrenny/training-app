#!/bin/sh
set -eu

echo "Starting Telegram bot..."
exec uv run python manage.py runbot
