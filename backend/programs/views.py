from rest_framework import generics
from rest_framework.permissions import AllowAny

from .models import Week
from .serializers import WeekDetailSerializer, WeekListSerializer


class WeekListView(generics.ListAPIView):
    queryset = Week.objects.all()
    serializer_class = WeekListSerializer
    permission_classes = [AllowAny]


class WeekDetailView(generics.RetrieveAPIView):
    queryset = Week.objects.prefetch_related(
        "days__exercises__exercise",
        "days__exercises__sets",
    )
    serializer_class = WeekDetailSerializer
    permission_classes = [AllowAny]
    lookup_field = "number"
