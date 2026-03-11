from django.urls import path

from .views import (
    AccessoryWeightHistoryView,
    AccessoryWeightLatestView,
    AccessoryWeightView,
    CompletionDetailView,
    CompletionListView,
    OneRepMaxView,
    WeekDetailView,
    WeekListView,
)

urlpatterns = [
    path("weeks/", WeekListView.as_view(), name="week-list"),
    path("weeks/<int:number>/", WeekDetailView.as_view(), name="week-detail"),
    path("one-rep-max/", OneRepMaxView.as_view(), name="one-rep-max"),
    path("completions/", CompletionListView.as_view(), name="completion-list"),
    path("completions/<int:day_id>/", CompletionDetailView.as_view(), name="completion-detail"),
    path("accessory-weights/latest/", AccessoryWeightLatestView.as_view(), name="accessory-weight-latest"),
    path("accessory-weights/<int:exercise_id>/", AccessoryWeightView.as_view(), name="accessory-weight-upsert"),
    path("accessory-weights/<int:exercise_id>/history/", AccessoryWeightHistoryView.as_view(), name="accessory-weight-history"),
]
