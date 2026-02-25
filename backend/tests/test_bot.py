import os

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from telegram import KeyboardButton, ReplyKeyboardMarkup, WebAppInfo

from bot.handlers import start


@pytest.fixture
def update():
    update = AsyncMock()
    update.effective_chat.id = 12345
    update.message = AsyncMock()
    return update


@pytest.fixture
def context():
    ctx = MagicMock()
    ctx.bot = AsyncMock()
    return ctx


@pytest.mark.asyncio
async def test_start_sends_reply_keyboard_with_webapp(update, context):
    """Test /start sends ReplyKeyboardMarkup with WebAppInfo button."""
    with patch("bot.handlers.settings") as mock_settings:
        mock_settings.TELEGRAM_WEBAPP_URL = "https://example.com"
        await start(update, context)

    update.message.reply_text.assert_called_once()
    call_args = update.message.reply_text.call_args

    # Check message text
    text = call_args[0][0] if call_args[0] else call_args.kwargs.get("text", "")
    assert "Привет" in text

    # Check reply_markup
    markup = call_args.kwargs.get("reply_markup")
    assert isinstance(markup, ReplyKeyboardMarkup)

    # Find the WebApp button
    webapp_button = None
    for row in markup.keyboard:
        for button in row:
            if isinstance(button, KeyboardButton) and button.web_app:
                webapp_button = button
                break

    assert webapp_button is not None, "WebApp button not found in keyboard"
    assert webapp_button.text == "Программа тренировок"
    assert isinstance(webapp_button.web_app, WebAppInfo)
    assert webapp_button.web_app.url == "https://example.com"


@pytest.mark.asyncio
async def test_start_resize_keyboard(update, context):
    """Test /start keyboard has resize_keyboard=True."""
    with patch("bot.handlers.settings") as mock_settings:
        mock_settings.TELEGRAM_WEBAPP_URL = "https://example.com"
        await start(update, context)

    call_args = update.message.reply_text.call_args
    markup = call_args.kwargs.get("reply_markup")
    assert markup.resize_keyboard is True
