import json
from datetime import date
from urllib.parse import unquote

from django.conf import settings
from django.contrib.auth import login, logout
from django.db.models import OuterRef, Q, Subquery
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
from .models import (
    AccessoryWeight,
    Exercise,
    OneRepMax,
    Program,
    ProgramSnapshot,
    Week,
    Weekday,
    WorkoutCompletion,
)
from .program_snapshot import (
    build_base_program_payload,
    build_program_response,
    count_program_entities,
    get_default_program,
    get_latest_snapshot,
    get_program_payload_for_user,
    merge_program_payload_metadata,
)
from .serializers import (
    AccessoryWeightSerializer,
    ExerciseSerializer,
    OneRepMaxSerializer,
    ProgramSerializer,
    ProgramSnapshotInputSerializer,
    WeekDetailSerializer,
    WeekListSerializer,
    WorkoutCompletionSerializer,
)


def get_active_program(request):
    default_program = get_default_program()
    user = getattr(request, "user", None)
    if not getattr(user, "is_authenticated", False):
        return default_program

    profile = getattr(user, "profile", None)
    if profile is None:
        return default_program

    if profile.selected_program_id is None and default_program is not None:
        profile.selected_program = default_program
        profile.save(update_fields=["selected_program"])
        return default_program

    return profile.selected_program or default_program


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
        program = get_active_program(request)
        completions = (
            WorkoutCompletion.objects.filter(telegram_id=telegram_id, program=program)
            .select_related("day__week")
            .order_by("completed_at")
        )
        latest_by_day = {}
        for item in completions:
            week_number = item.week_number or (item.day.week.number if item.day_id else None)
            weekday = item.weekday or (item.day.weekday if item.day_id else None)
            if week_number is None or weekday is None:
                continue
            latest_by_day[(week_number, weekday)] = item.completed_at.strftime("%Y-%m-%d")

        result = [
            {
                "week_number": week_number,
                "weekday": weekday,
                "completed_at": completed_at,
            }
            for (week_number, weekday), completed_at in sorted(latest_by_day.items())
        ]
        return Response({"completions": result})

    def delete(self, request):
        telegram_id = get_request_telegram_id(request)
        if not telegram_id:
            return Response(
                {"detail": "Telegram user ID not found."},
                status=status.HTTP_401_UNAUTHORIZED,
            )
        WorkoutCompletion.objects.filter(
            telegram_id=telegram_id,
            program=get_active_program(request),
        ).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class CompletionDetailView(APIView):
    permission_classes = [AllowAny]

    def post(self, request, week_number, weekday):
        telegram_id = get_request_telegram_id(request)
        if not telegram_id:
            return Response(
                {"detail": "Telegram user ID not found."},
                status=status.HTTP_401_UNAUTHORIZED,
            )
        if weekday not in Weekday.values:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        program = get_active_program(request)

        completion = WorkoutCompletion.objects.filter(
            telegram_id=telegram_id,
            program=program,
        ).filter(
            Q(week_number=week_number, weekday=weekday)
            | Q(day__week__program=program, day__week__number=week_number, day__weekday=weekday)
        ).first()
        created = completion is None
        if completion is None:
            completion = WorkoutCompletion.objects.create(
                telegram_id=telegram_id,
                program=program,
                week_number=week_number,
                weekday=weekday,
            )
        else:
            changed = False
            if completion.week_number != week_number:
                completion.week_number = week_number
                changed = True
            if completion.weekday != weekday:
                completion.weekday = weekday
                changed = True
            if completion.day_id is not None:
                completion.day = None
                changed = True
            if changed:
                completion.save(update_fields=["week_number", "weekday", "day"])
        serializer = WorkoutCompletionSerializer(completion)
        return Response(
            serializer.data,
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )

    def delete(self, request, week_number, weekday):
        telegram_id = get_request_telegram_id(request)
        if not telegram_id:
            return Response(
                {"detail": "Telegram user ID not found."},
                status=status.HTTP_401_UNAUTHORIZED,
            )
        if weekday not in Weekday.values:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        program = get_active_program(request)

        WorkoutCompletion.objects.filter(
            telegram_id=telegram_id,
            program=program,
        ).filter(
            Q(week_number=week_number, weekday=weekday)
            | Q(day__week__program=program, day__week__number=week_number, day__weekday=weekday)
        ).delete()
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
        program = get_active_program(request)
        if week_number is not None:
            week = Week.objects.filter(program=program, number=week_number).first()

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
    serializer_class = WeekListSerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        return Week.objects.filter(program=get_active_program(self.request))


class WeekDetailView(generics.RetrieveAPIView):
    serializer_class = WeekDetailSerializer
    permission_classes = [AllowAny]
    lookup_field = "number"

    def get_queryset(self):
        return Week.objects.filter(program=get_active_program(self.request)).prefetch_related(
            "days__exercises__exercise",
            "days__exercises__sets",
            "days__text_blocks",
        )


class ExerciseCatalogView(generics.ListAPIView):
    queryset = Exercise.objects.all()
    serializer_class = ExerciseSerializer
    permission_classes = [AllowAny]


class ProgramCurrentView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        program = get_active_program(request)
        telegram_id = get_request_telegram_id(request)
        if not telegram_id:
            return Response(
                build_program_response(build_base_program_payload(program), program=program)
            )

        snapshot, payload = get_program_payload_for_user(telegram_id, program)
        if snapshot is None:
            return Response(build_program_response(payload, program=program))

        return Response(
            build_program_response(
                payload,
                program=program,
                version=snapshot.version,
                created_at=snapshot.created_at,
                commit_message=snapshot.commit_message,
            )
        )


class ProgramOriginalView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        program = get_active_program(request)
        return Response(
            build_program_response(build_base_program_payload(program), program=program)
        )


class ProgramSnapshotCreateView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        telegram_id = get_request_telegram_id(request)
        if not telegram_id:
            return Response(
                {"detail": "Telegram user ID not found."},
                status=status.HTTP_401_UNAUTHORIZED,
            )
        program = get_active_program(request)

        serializer = ProgramSnapshotInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        latest = ProgramSnapshot.objects.filter(
            telegram_id=telegram_id,
            program=program,
        ).order_by("-version").first()
        next_version = (latest.version if latest else 0) + 1
        current_snapshot, current_payload = get_program_payload_for_user(telegram_id, program)
        payload = merge_program_payload_metadata(
            current_payload,
            serializer.validated_data["normalized_payload"],
        )

        snapshot = ProgramSnapshot.objects.create(
            telegram_id=telegram_id,
            program=program,
            version=next_version,
            commit_message=serializer.validated_data["commit_message"],
            payload=payload,
            source_snapshot_version=serializer.validated_data.get("source_snapshot_version")
            or (current_snapshot.version if current_snapshot else None),
        )
        return Response(
            build_program_response(
                snapshot.payload,
                program=program,
                version=snapshot.version,
                created_at=snapshot.created_at,
                commit_message=snapshot.commit_message,
            ),
            status=status.HTTP_201_CREATED,
        )


class ProgramHistoryListView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        telegram_id = get_request_telegram_id(request)
        if not telegram_id:
            return Response(
                {"detail": "Telegram user ID not found."},
                status=status.HTTP_401_UNAUTHORIZED,
            )
        program = get_active_program(request)

        snapshots = ProgramSnapshot.objects.filter(
            telegram_id=telegram_id,
            program=program,
        ).order_by("-version")
        result = []
        for snapshot in snapshots:
            result.append(
                {
                    "version": snapshot.version,
                    "created_at": snapshot.created_at.isoformat(),
                    "commit_message": snapshot.commit_message,
                    "source_snapshot_version": snapshot.source_snapshot_version,
                    **count_program_entities(snapshot.payload),
                }
            )
        return Response(result)


class ProgramHistoryDetailView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, version):
        telegram_id = get_request_telegram_id(request)
        if not telegram_id:
            return Response(
                {"detail": "Telegram user ID not found."},
                status=status.HTTP_401_UNAUTHORIZED,
            )
        program = get_active_program(request)

        snapshot = ProgramSnapshot.objects.filter(
            telegram_id=telegram_id,
            program=program,
            version=version,
        ).first()
        if snapshot is None:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

        return Response(
            build_program_response(
                snapshot.payload,
                program=program,
                version=snapshot.version,
                created_at=snapshot.created_at,
                commit_message=snapshot.commit_message,
            )
        )


class ProgramListView(generics.ListAPIView):
    queryset = Program.objects.all()
    serializer_class = ProgramSerializer
    permission_classes = [AllowAny]


class ProgramSelectionView(APIView):
    permission_classes = [AllowAny]

    def put(self, request):
        if not request.user.is_authenticated:
            return Response(
                {"detail": "Authentication required."},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        profile = getattr(request.user, "profile", None)
        if profile is None:
            return Response({"detail": "User profile not found."}, status=status.HTTP_400_BAD_REQUEST)

        program_id = request.data.get("program_id")
        if not program_id:
            return Response({"detail": "program_id is required."}, status=status.HTTP_400_BAD_REQUEST)

        program = Program.objects.filter(pk=program_id).first()
        if program is None:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

        profile.selected_program = program
        profile.save(update_fields=["selected_program"])
        return Response(ProgramSerializer(program).data)
