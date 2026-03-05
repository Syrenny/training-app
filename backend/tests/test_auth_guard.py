import pytest
from django.test import RequestFactory
from unittest.mock import patch

from programs.authentication import TelegramInitDataAuthentication
from rest_framework.exceptions import AuthenticationFailed


@pytest.fixture
def auth():
    return TelegramInitDataAuthentication()


@pytest.fixture
def factory():
    return RequestFactory()


class TestDevBypass:
    def test_no_headers_debug_true_returns_none(self, auth, factory):
        """No headers with DEBUG=True should return None (let DRF handle as anonymous)."""
        request = factory.get("/api/one-rep-max/")
        with patch("programs.authentication.settings.DEBUG", True):
            result = auth.authenticate(request)
        assert result is None

    def test_dev_mode_header_debug_true_returns_dev_user(self, auth, factory):
        """X-Dev-Mode: 1 with DEBUG=True should return dev user with id=1."""
        request = factory.get("/api/one-rep-max/", HTTP_X_DEV_MODE="1")
        with patch("programs.authentication.settings.DEBUG", True):
            result = auth.authenticate(request)
        assert result is not None
        user, token = result
        assert user["id"] == 1
        assert user["first_name"] == "Dev"
        assert token is None

    def test_dev_mode_header_debug_false_is_ignored(self, auth, factory):
        """X-Dev-Mode: 1 with DEBUG=False should NOT grant access (returns None, not dev user)."""
        request = factory.get("/api/one-rep-max/", HTTP_X_DEV_MODE="1")
        with patch("programs.authentication.settings.DEBUG", False):
            result = auth.authenticate(request)
        # Should not return dev user — fall through to normal auth (returns None for missing initData)
        assert result is None or (result is not None and result[0].get("id") != 1)
