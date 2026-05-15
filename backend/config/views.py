from pathlib import Path

from django.conf import settings
from django.http import HttpRequest, HttpResponse
from django.views import View


def get_frontend_index_path() -> Path:
    return Path(settings.BASE_DIR) / "static" / "frontend" / "index.html"


class FrontendAppView(View):
    def get(
        self, request: HttpRequest, *args: object, **kwargs: object
    ) -> HttpResponse:
        frontend_index_path = get_frontend_index_path()
        if not frontend_index_path.exists():
            return HttpResponse(
                "Frontend build is missing. Build the frontend bundle before serving the SPA.",
                content_type="text/plain; charset=utf-8",
                status=503,
            )

        return HttpResponse(
            frontend_index_path.read_text(encoding="utf-8"),
            content_type="text/html; charset=utf-8",
        )
