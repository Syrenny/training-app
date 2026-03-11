from datetime import date

from django.db.models import Max, Subquery, OuterRef
from rest_framework import generics, status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import AccessoryWeight, Day, Exercise, OneRepMax, Week, WorkoutCompletion
from .serializers import (
    AccessoryWeightSerializer,
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
        completions = WorkoutCompletion.objects.filter(telegram_id=telegram_id).values_list(
            "day_id", "completed_at"
        )
        result = {day_id: completed_at.strftime("%Y-%m-%d") for day_id, completed_at in completions}
        return Response({"completions": result})


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


class AccessoryWeightView(APIView):
    permission_classes = [AllowAny]

    def _get_telegram_id(self, request):
        user = request.user
        if isinstance(user, dict) and user.get("id"):
            return user["id"]
        return None

    def put(self, request, exercise_id):
        telegram_id = self._get_telegram_id(request)
        if not telegram_id:
            return Response(
                {"detail": "Telegram user ID not found."},
                status=status.HTTP_401_UNAUTHORIZED,
            )
        try:
            exercise = Exercise.objects.get(pk=exercise_id)
        except Exercise.DoesNotExist:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

        weight = request.data.get("weight")
        if weight is None:
            return Response(
                {"detail": "weight is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        sets_display = request.data.get("sets_display", "")

        week_number = request.data.get("week_number")
        week = None
        if week_number is not None:
            try:
                week = Week.objects.get(number=week_number)
            except Week.DoesNotExist:
                pass

        obj, _ = AccessoryWeight.objects.update_or_create(
            telegram_id=telegram_id,
            exercise=exercise,
            recorded_date=date.today(),
            defaults={"weight": weight, "sets_display": sets_display, "week": week},
        )
        return Response(AccessoryWeightSerializer(obj).data)


class AccessoryWeightLatestView(APIView):
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

        # Get latest record per exercise
        latest_dates = (
            AccessoryWeight.objects.filter(
                telegram_id=telegram_id,
                exercise=OuterRef("exercise"),
            )
            .order_by("-recorded_date")
            .values("recorded_date")[:1]
        )

        records = (
            AccessoryWeight.objects.filter(
                telegram_id=telegram_id,
                recorded_date=Subquery(latest_dates),
            )
            .select_related("exercise", "week")
        )

        result = {}
        for rec in records:
            result[rec.exercise_id] = {
                "weight": str(rec.weight),
                "recorded_date": rec.recorded_date.isoformat(),
            }

        return Response(result)


class AccessoryWeightHistoryView(APIView):
    permission_classes = [AllowAny]

    def _get_telegram_id(self, request):
        user = request.user
        if isinstance(user, dict) and user.get("id"):
            return user["id"]
        return None

    def get(self, request, exercise_id):
        telegram_id = self._get_telegram_id(request)
        if not telegram_id:
            return Response(
                {"detail": "Telegram user ID not found."},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        records = (
            AccessoryWeight.objects.filter(
                telegram_id=telegram_id,
                exercise_id=exercise_id,
            )
            .select_related("week")
            .order_by("-recorded_date")
        )

        return Response(AccessoryWeightSerializer(records, many=True).data)


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
