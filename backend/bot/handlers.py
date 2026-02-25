from telegram import ReplyKeyboardRemove, Update
from telegram.ext import ContextTypes


async def start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle /start command."""
    await update.message.reply_text(
        "Привет! Открой приложение через меню бота, чтобы посмотреть программу тренировок.",
        reply_markup=ReplyKeyboardRemove(),
    )
