from django.conf import settings
from telegram import KeyboardButton, ReplyKeyboardMarkup, Update, WebAppInfo
from telegram.ext import ContextTypes


async def start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle /start command."""
    keyboard = ReplyKeyboardMarkup(
        [
            [
                KeyboardButton(
                    "Программа тренировок",
                    web_app=WebAppInfo(url=settings.TELEGRAM_WEBAPP_URL),
                )
            ]
        ],
        resize_keyboard=True,
    )
    await update.message.reply_text(
        "Привет! Открой приложение через меню бота, чтобы посмотреть программу тренировок.",
        reply_markup=keyboard,
    )
