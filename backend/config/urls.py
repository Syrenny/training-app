from django.contrib import admin
from django.urls import include, path, re_path
from django.views.generic import TemplateView

urlpatterns = [
    path("_nested_admin/", include("nested_admin.urls")),
    path("admin/", admin.site.urls),
    path("api/", include("programs.urls")),
    re_path(r"^(?!admin|api).*$", TemplateView.as_view(template_name="index.html")),
]
