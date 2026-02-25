from django.conf import settings
from telegram import KeyboardButton, ReplyKeyboardMarkup, Update, WebAppInfo
from telegram.ext import ContextTypes


async def start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle /start command — send keyboard with Mini App button."""
    webapp_button = KeyboardButton(
        text="Программа тренировок",
        web_app=WebAppInfo(url=settings.TELEGRAM_WEBAPP_URL),
    )
    markup = ReplyKeyboardMarkup(
        keyboard=[[webapp_button]],
        resize_keyboard=True,
    )
    await update.message.reply_text(
        "Привет! Нажми кнопку ниже, чтобы открыть программу тренировок.",
        reply_markup=markup,
    )
