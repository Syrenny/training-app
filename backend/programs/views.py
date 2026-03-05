from rest_framework import generics, status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Day, OneRepMax, Week, WorkoutCompletion
from .serializers import (
    OneRepMaxSerializer,
    WeekDetailSerializer,
    WeekListSerializer,
    WorkoutCompletionSerializer,
)


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


class CompletionListView(APIView):
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
        ids = list(
            WorkoutCompletion.objects.filter(telegram_id=telegram_id).values_list("day_id", flat=True)
        )
        return Response({"completed_day_ids": ids})


class CompletionDetailView(APIView):
    permission_classes = [AllowAny]

    def _get_telegram_id(self, request):
        user = request.user
        if isinstance(user, dict) and user.get("id"):
            return user["id"]
        return None

    def post(self, request, day_id):
        telegram_id = self._get_telegram_id(request)
        if not telegram_id:
            return Response(
                {"detail": "Telegram user ID not found."},
                status=status.HTTP_401_UNAUTHORIZED,
            )
        try:
            day = Day.objects.get(pk=day_id)
        except Day.DoesNotExist:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

        completion, created = WorkoutCompletion.objects.get_or_create(
            telegram_id=telegram_id, day=day
        )
        serializer = WorkoutCompletionSerializer(completion)
        return Response(
            serializer.data,
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )

    def delete(self, request, day_id):
        telegram_id = self._get_telegram_id(request)
        if not telegram_id:
            return Response(
                {"detail": "Telegram user ID not found."},
                status=status.HTTP_401_UNAUTHORIZED,
            )
        if not Day.objects.filter(pk=day_id).exists():
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

        WorkoutCompletion.objects.filter(telegram_id=telegram_id, day_id=day_id).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


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
