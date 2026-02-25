from django.conf import settings
from django.core.management.base import BaseCommand
from telegram.ext import ApplicationBuilder, CommandHandler

from bot.handlers import start


class Command(BaseCommand):
    help = "Start the Telegram bot with polling"

    def handle(self, *args, **options):
        token = settings.TELEGRAM_BOT_TOKEN
        if not token:
            self.stderr.write(
                self.style.ERROR(
                    "TELEGRAM_BOT_TOKEN is not set. Add it to .env file."
                )
            )
            return

        self.stdout.write(self.style.SUCCESS("Starting Telegram bot..."))

        app = ApplicationBuilder().token(token).build()
        app.add_handler(CommandHandler("start", start))

        app.run_polling()
