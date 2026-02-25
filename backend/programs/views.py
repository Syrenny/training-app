from rest_framework import generics, status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import OneRepMax, Week
from .serializers import OneRepMaxSerializer, WeekDetailSerializer, WeekListSerializer


class OneRepMaxView(APIView):
    permission_classes = [AllowAny]

    def _get_telegram_id(self, request):
        user = request.user
        if isinstance(user, dict) and user.get("id"):
            return user["id"]
        return None

    def get(self, request):
        telegram_id = self._get_telegram_id(request)
        if not telegram_id:
            return Response(
                {"detail": "Telegram user ID not found."},
                status=status.HTTP_401_UNAUTHORIZED,
            )
        try:
            orm = OneRepMax.objects.get(telegram_id=telegram_id)
        except OneRepMax.DoesNotExist:
            return Response({"bench": 0, "squat": 0, "deadlift": 0})
        return Response(OneRepMaxSerializer(orm).data)

    def put(self, request):
        telegram_id = self._get_telegram_id(request)
        if not telegram_id:
            return Response(
                {"detail": "Telegram user ID not found."},
                status=status.HTTP_401_UNAUTHORIZED,
            )
        orm, _ = OneRepMax.objects.get_or_create(telegram_id=telegram_id)
        serializer = OneRepMaxSerializer(orm, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


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
