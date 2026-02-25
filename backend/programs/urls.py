from django.urls import path

from .views import WeekDetailView, WeekListView

urlpatterns = [
    path("weeks/", WeekListView.as_view(), name="week-list"),
    path("weeks/<int:number>/", WeekDetailView.as_view(), name="week-detail"),
]
