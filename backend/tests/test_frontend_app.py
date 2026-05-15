from pathlib import Path

from django.conf import settings
from django.test import SimpleTestCase


class FrontendAppViewTest(SimpleTestCase):
    def test_root_serves_built_frontend_index(self) -> None:
        response = self.client.get("/")

        expected_html = (
            Path(settings.BASE_DIR) / "static" / "frontend" / "index.html"
        ).read_text(encoding="utf-8")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Content-Type"], "text/html; charset=utf-8")
        self.assertEqual(response.content.decode("utf-8"), expected_html)

    def test_spa_route_uses_same_frontend_index(self) -> None:
        response = self.client.get("/profile")

        expected_html = (
            Path(settings.BASE_DIR) / "static" / "frontend" / "index.html"
        ).read_text(encoding="utf-8")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.content.decode("utf-8"), expected_html)
