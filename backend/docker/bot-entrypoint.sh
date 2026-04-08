#!/bin/sh
set -eu

echo "Starting Telegram bot..."
exec python manage.py runbot
