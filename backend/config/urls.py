from django.contrib import admin
from django.urls import include, path, re_path

from .views import FrontendAppView

urlpatterns = [
    path("_nested_admin/", include("nested_admin.urls")),
    path("admin/", admin.site.urls),
    path("api/", include("programs.urls")),
    re_path(r"^(?!admin|api).*$", FrontendAppView.as_view()),
]
