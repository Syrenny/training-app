import hashlib
import hmac
import time

from django.contrib.auth import get_user_model

from .models import UserProfile


def sync_telegram_user(user_data: dict, *, username_prefix: str = "tg"):
    telegram_id = user_data.get("id")
    if not telegram_id:
        return None

    User = get_user_model()
    username = f"{username_prefix}-{telegram_id}"
    defaults = {
        "first_name": user_data.get("first_name", "")[:150],
        "last_name": user_data.get("last_name", "")[:150],
    }
    user, _ = User.objects.get_or_create(username=username, defaults=defaults)

    updated_fields = []
    if defaults["first_name"] and user.first_name != defaults["first_name"]:
        user.first_name = defaults["first_name"]
        updated_fields.append("first_name")
    if user.last_name != defaults["last_name"]:
        user.last_name = defaults["last_name"]
        updated_fields.append("last_name")
    if updated_fields:
        user.save(update_fields=updated_fields)

    UserProfile.objects.update_or_create(
        user=user,
        defaults={
            "telegram_id": telegram_id,
            "telegram_username": user_data.get("username", "")[:255],
            "first_name": user_data.get("first_name", "")[:255],
            "last_name": user_data.get("last_name", "")[:255],
        },
    )
    return user


def get_request_telegram_id(request):
    user = getattr(request, "user", None)
    if getattr(user, "is_authenticated", False):
        profile = getattr(user, "profile", None)
        if profile and profile.telegram_id:
            return profile.telegram_id

    if isinstance(user, dict) and user.get("id"):
        return user["id"]

    return None


def validate_telegram_login_data(
    auth_data: dict,
    bot_token: str,
    max_age_seconds: int = 86400,
):
    if not bot_token:
        return None

    hash_value = auth_data.get("hash", "")
    auth_date = auth_data.get("auth_date")
    telegram_id = auth_data.get("id")
    if not hash_value or not auth_date or not telegram_id:
        return None

    try:
        normalized = {
            "id": int(telegram_id),
            "auth_date": int(auth_date),
            "first_name": auth_data.get("first_name", ""),
            "last_name": auth_data.get("last_name", ""),
            "username": auth_data.get("username", ""),
            "photo_url": auth_data.get("photo_url", ""),
            "hash": hash_value,
        }
    except (TypeError, ValueError):
        return None

    if max_age_seconds > 0 and abs(time.time() - normalized["auth_date"]) > max_age_seconds:
        return None

    data_check_string = "\n".join(
        f"{key}={value}"
        for key, value in sorted(normalized.items())
        if key != "hash" and value not in ("", None)
    )
    secret_key = hashlib.sha256(bot_token.encode()).digest()
    computed_hash = hmac.new(
        secret_key,
        data_check_string.encode(),
        hashlib.sha256,
    ).hexdigest()

    if not hmac.compare_digest(computed_hash, hash_value):
        return None

    return normalized
