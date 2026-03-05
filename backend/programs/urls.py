from django.urls import path

from .views import CompletionDetailView, CompletionListView, OneRepMaxView, WeekDetailView, WeekListView

urlpatterns = [
    path("weeks/", WeekListView.as_view(), name="week-list"),
    path("weeks/<int:number>/", WeekDetailView.as_view(), name="week-detail"),
    path("one-rep-max/", OneRepMaxView.as_view(), name="one-rep-max"),
    path("completions/", CompletionListView.as_view(), name="completion-list"),
    path("completions/<int:day_id>/", CompletionDetailView.as_view(), name="completion-detail"),
]
