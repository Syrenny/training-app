import hashlib
import hmac
import json
from urllib.parse import parse_qs, unquote

from django.conf import settings
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed


class TelegramInitDataAuthentication(BaseAuthentication):
    """Validates Telegram Mini App initData via HMAC-SHA256."""

    def authenticate(self, request):
        init_data = request.headers.get("X-Telegram-Init-Data", "")
        if not init_data:
            return None

        if not self.validate_init_data(init_data, settings.TELEGRAM_BOT_TOKEN):
            raise AuthenticationFailed("Invalid Telegram initData")

        params = dict(
            chunk.split("=", 1)
            for chunk in unquote(init_data).split("&")
            if "=" in chunk
        )
        user_data = json.loads(params.get("user", "{}"))
        return (user_data, None)

    @staticmethod
    def validate_init_data(init_data: str, bot_token: str) -> bool:
        if not bot_token:
            return False

        parsed = unquote(init_data)
        pairs = []
        hash_value = ""

        for chunk in parsed.split("&"):
            key, _, value = chunk.partition("=")
            if key == "hash":
                hash_value = value
            else:
                pairs.append(f"{key}={value}")

        if not hash_value:
            return False

        pairs.sort()
        data_check_string = "\n".join(pairs)

        secret_key = hmac.new(
            b"WebAppData", bot_token.encode(), hashlib.sha256
        ).digest()

        computed_hash = hmac.new(
            secret_key, data_check_string.encode(), hashlib.sha256
        ).hexdigest()

        return hmac.compare_digest(computed_hash, hash_value)
