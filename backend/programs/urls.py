from django.urls import path

from .views import OneRepMaxView, WeekDetailView, WeekListView

urlpatterns = [
    path("weeks/", WeekListView.as_view(), name="week-list"),
    path("weeks/<int:number>/", WeekDetailView.as_view(), name="week-detail"),
    path("one-rep-max/", OneRepMaxView.as_view(), name="one-rep-max"),
]
