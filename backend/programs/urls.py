from django.urls import path

from .views import (
    AccessoryWeightHistoryView,
    AccessoryWeightLatestView,
    AccessoryWeightView,
    AuthSessionView,
    CompletionDetailView,
    CompletionListView,
    LogoutView,
    OneRepMaxView,
    TelegramLoginView,
    WeekDetailView,
    WeekListView,
)

urlpatterns = [
    path("auth/session/", AuthSessionView.as_view(), name="auth-session"),
    path("auth/telegram/", TelegramLoginView.as_view(), name="auth-telegram"),
    path("auth/logout/", LogoutView.as_view(), name="auth-logout"),
    path("weeks/", WeekListView.as_view(), name="week-list"),
    path("weeks/<int:number>/", WeekDetailView.as_view(), name="week-detail"),
    path("one-rep-max/", OneRepMaxView.as_view(), name="one-rep-max"),
    path("completions/", CompletionListView.as_view(), name="completion-list"),
    path("completions/<int:day_id>/", CompletionDetailView.as_view(), name="completion-detail"),
    path("accessory-weights/latest/", AccessoryWeightLatestView.as_view(), name="accessory-weight-latest"),
    path("accessory-weights/<int:exercise_id>/", AccessoryWeightView.as_view(), name="accessory-weight-upsert"),
    path("accessory-weights/<int:exercise_id>/history/", AccessoryWeightHistoryView.as_view(), name="accessory-weight-history"),
]
