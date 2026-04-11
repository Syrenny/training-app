import json
from datetime import date
from urllib.parse import unquote

from django.conf import settings
from django.contrib.auth import login, logout
from django.db.models import Max, Subquery, OuterRef
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt, ensure_csrf_cookie
from rest_framework import generics, status
from rest_framework.authentication import SessionAuthentication
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .authentication import TelegramInitDataAuthentication
from .auth_utils import (
    get_request_telegram_id,
    sync_telegram_user,
    validate_telegram_login_data,
)
from .models import AccessoryWeight, Day, Exercise, OneRepMax, Week, WorkoutCompletion
from .serializers import (
    AccessoryWeightSerializer,
    OneRepMaxSerializer,
    WeekDetailSerializer,
    WeekListSerializer,
    WorkoutCompletionSerializer,
)


@method_decorator(ensure_csrf_cookie, name="dispatch")
class AuthSessionView(APIView):
    authentication_classes = [SessionAuthentication]
    permission_classes = [AllowAny]

    def get(self, request):
        if request.user.is_authenticated:
            profile = getattr(request.user, "profile", None)
            return Response(
                {
                    "authenticated": True,
                    "telegram_bot_username": settings.TELEGRAM_BOT_USERNAME,
                    "user": {
                        "id": request.user.id,
                        "telegram_id": getattr(profile, "telegram_id", None),
                        "first_name": profile.first_name or request.user.first_name,
                        "last_name": profile.last_name or request.user.last_name,
                        "telegram_username": getattr(profile, "telegram_username", ""),
                        "telegram_photo_url": getattr(profile, "telegram_photo_url", ""),
                    },
                }
            )
        return Response(
            {
                "authenticated": False,
                "telegram_bot_username": settings.TELEGRAM_BOT_USERNAME,
                "user": None,
            }
        )


def _serialize_auth_user(user):
    profile = getattr(user, "profile", None)
    return {
        "authenticated": True,
        "telegram_bot_username": settings.TELEGRAM_BOT_USERNAME,
        "user": {
            "id": user.id,
            "telegram_id": getattr(profile, "telegram_id", None),
            "first_name": getattr(profile, "first_name", "") or user.first_name,
            "last_name": getattr(profile, "last_name", "") or user.last_name,
            "telegram_username": getattr(profile, "telegram_username", ""),
            "telegram_photo_url": getattr(profile, "telegram_photo_url", ""),
        },
    }


@method_decorator(csrf_exempt, name="dispatch")
class TelegramLoginView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request):
        if settings.DEBUG and request.headers.get("X-Dev-Mode") == "1":
            user = sync_telegram_user({"id": 1, "first_name": "Dev"}, username_prefix="dev")
        else:
            init_data = request.data.get("init_data", "")
            auth_data = request.data.get("auth_data")

            if init_data:
                if not TelegramInitDataAuthentication.validate_init_data(
                    init_data, settings.TELEGRAM_BOT_TOKEN
                ):
                    return Response(
                        {"detail": "Invalid Telegram initData"},
                        status=status.HTTP_401_UNAUTHORIZED,
                    )
                params = dict(
                    chunk.split("=", 1)
                    for chunk in unquote(init_data).split("&")
                    if "=" in chunk
                )
                user_data = json.loads(params.get("user", "{}"))
                user = sync_telegram_user(user_data)
            elif auth_data:
                verified = validate_telegram_login_data(
                    auth_data,
                    settings.TELEGRAM_BOT_TOKEN,
                    settings.TELEGRAM_LOGIN_MAX_AGE_SECONDS,
                )
                if verified is None:
                    return Response(
                        {"detail": "Invalid Telegram login data"},
                        status=status.HTTP_401_UNAUTHORIZED,
                    )
                user = sync_telegram_user(verified)
            else:
                return Response(
                    {"detail": "init_data or auth_data is required."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if user is None:
                return Response(
                    {"detail": "Telegram user data is invalid"},
                    status=status.HTTP_401_UNAUTHORIZED,
                )

        login(request, user)
        return Response(_serialize_auth_user(user))


class LogoutView(APIView):
    authentication_classes = [SessionAuthentication]
    permission_classes = [AllowAny]

    def post(self, request):
        logout(request)
        return Response(status=status.HTTP_204_NO_CONTENT)


class OneRepMaxView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        telegram_id = get_request_telegram_id(request)
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
        telegram_id = get_request_telegram_id(request)
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

    def get(self, request):
        telegram_id = get_request_telegram_id(request)
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

    def post(self, request, day_id):
        telegram_id = get_request_telegram_id(request)
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
        telegram_id = get_request_telegram_id(request)
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

    def put(self, request, exercise_id):
        telegram_id = get_request_telegram_id(request)
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

    def get(self, request):
        telegram_id = get_request_telegram_id(request)
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

    def get(self, request, exercise_id):
        telegram_id = get_request_telegram_id(request)
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
