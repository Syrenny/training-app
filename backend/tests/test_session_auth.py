import hashlib
import hmac
import time

from django.test import TestCase, override_settings
from rest_framework.test import APIClient


@override_settings(DEBUG=True, TELEGRAM_BOT_TOKEN="", TELEGRAM_BOT_USERNAME="test_bot")
class SessionAuthAPITest(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_session_endpoint_returns_unauthenticated_by_default(self):
        response = self.client.get("/api/auth/session/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["authenticated"], False)
        self.assertEqual(response.json()["telegram_bot_username"], "test_bot")

    def test_dev_login_creates_session_and_profile(self):
        response = self.client.post("/api/auth/telegram/", HTTP_X_DEV_MODE="1")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["authenticated"], True)
        self.assertEqual(response.json()["user"]["telegram_id"], 1)

        session_response = self.client.get("/api/auth/session/")
        self.assertEqual(session_response.status_code, 200)
        self.assertEqual(session_response.json()["authenticated"], True)
        self.assertEqual(session_response.json()["user"]["telegram_id"], 1)

    def test_logout_clears_session(self):
        self.client.post("/api/auth/telegram/", HTTP_X_DEV_MODE="1")
        response = self.client.post("/api/auth/logout/")
        self.assertEqual(response.status_code, 204)

        session_response = self.client.get("/api/auth/session/")
        self.assertEqual(session_response.status_code, 200)
        self.assertEqual(session_response.json()["authenticated"], False)


@override_settings(
    DEBUG=False,
    TELEGRAM_BOT_TOKEN="test-token",
    TELEGRAM_BOT_USERNAME="test_bot",
)
class TelegramWebsiteLoginAPITest(TestCase):
    def setUp(self):
        self.client = APIClient()

    def _build_auth_data(self):
        auth_data = {
            "id": 42,
            "first_name": "Alice",
            "last_name": "Tester",
            "username": "alice",
            "photo_url": "https://t.me/i/userpic/320/alice.jpg",
            "auth_date": int(time.time()),
        }
        data_check_string = "\n".join(
            f"{key}={value}" for key, value in sorted(auth_data.items())
        )
        secret_key = hashlib.sha256("test-token".encode()).digest()
        auth_data["hash"] = hmac.new(
            secret_key,
            data_check_string.encode(),
            hashlib.sha256,
        ).hexdigest()
        return auth_data

    def test_widget_login_creates_session(self):
        response = self.client.post(
            "/api/auth/telegram/",
            {"auth_data": self._build_auth_data()},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["authenticated"], True)
        self.assertEqual(response.json()["user"]["telegram_id"], 42)
        self.assertEqual(response.json()["user"]["telegram_username"], "alice")
        self.assertEqual(
            response.json()["user"]["telegram_photo_url"],
            "https://t.me/i/userpic/320/alice.jpg",
        )

        session_response = self.client.get("/api/auth/session/")
        self.assertEqual(session_response.status_code, 200)
        self.assertEqual(session_response.json()["authenticated"], True)
        self.assertEqual(session_response.json()["user"]["first_name"], "Alice")
        self.assertEqual(session_response.json()["user"]["last_name"], "Tester")
        self.assertEqual(session_response.json()["user"]["telegram_username"], "alice")
        self.assertEqual(
            session_response.json()["user"]["telegram_photo_url"],
            "https://t.me/i/userpic/320/alice.jpg",
        )
