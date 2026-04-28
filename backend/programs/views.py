import json
from datetime import date
from urllib.parse import unquote

from django.conf import settings
from django.contrib.auth import login, logout
from django.db import transaction
from django.db.models import OuterRef, Q, Subquery
from django.utils.text import slugify
from django.utils import timezone
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
    CycleOneRepMax,
    Day,
    DayExercise,
    DayTextBlock,
    Exercise,
    ExerciseSet,
    OneRepMax,
    Program,
    ProgramOneRepMaxExercise,
    TrainingCycle,
    Week,
    Weekday,
    WorkoutCompletion,
)
from .program_clone import clone_program_structure
from .program_snapshot import (
    build_base_program_payload,
    build_program_response,
    get_default_program,
)
from .serializers import (
    AccessoryWeightSerializer,
    ExerciseSerializer,
    OneRepMaxResponseSerializer,
    OneRepMaxUpdateSerializer,
    ProgramCreateSerializer,
    ProgramSerializer,
    TrainingCycleFinishSerializer,
    TrainingCycleStartSerializer,
    TrainingCycleSummarySerializer,
    WeekDetailSerializer,
    WeekListSerializer,
    WorkoutCompletionSerializer,
)


def get_selected_program(request):
    default_program = get_default_program()
    user = getattr(request, "user", None)
    if not getattr(user, "is_authenticated", False):
        return default_program

    profile = getattr(user, "profile", None)
    if profile is None:
        return default_program

    accessible_programs = get_program_queryset_for_profile(profile)

    if (
        profile.selected_program_id is not None
        and not accessible_programs.filter(pk=profile.selected_program_id).exists()
    ):
        profile.selected_program = default_program
        profile.save(update_fields=["selected_program"])
        return default_program

    if profile.selected_program_id is None and default_program is not None:
        profile.selected_program = default_program
        profile.save(update_fields=["selected_program"])
        return default_program

    return profile.selected_program or default_program


def get_request_profile(request):
    user = getattr(request, "user", None)
    if not getattr(user, "is_authenticated", False):
        return None
    return getattr(user, "profile", None)


def get_program_queryset_for_profile(profile):
    queryset = Program.objects.all()
    if profile is None:
        return queryset.filter(owner__isnull=True)
    return queryset.filter(Q(owner__isnull=True) | Q(owner=profile))


def get_accessible_program_queryset(request):
    return get_program_queryset_for_profile(get_request_profile(request))


def generate_custom_program_slug(profile, name):
    base = slugify(name)[:60]
    if not base:
        base = f"user-{profile.telegram_id}"
    base = f"{base}-custom"
    slug = base
    suffix = 2
    while Program.objects.filter(slug=slug).exists():
        slug = f"{base}-{suffix}"
        suffix += 1
    return slug


def get_active_cycle(request, *, program=None):
    telegram_id = get_request_telegram_id(request)
    if not telegram_id:
        return None

    active_cycles = (
        TrainingCycle.objects.filter(
            telegram_id=telegram_id,
            completed_at__isnull=True,
        )
        .select_related("program")
        .order_by("-started_at", "-id")
    )

    selected_program = program or get_selected_program(request)
    if selected_program is not None:
        cycle = active_cycles.filter(program=selected_program).first()
        if cycle is not None:
            return cycle

    if get_request_profile(request) is None:
        return active_cycles.first()

    return None


def get_program_context(request):
    return get_selected_program(request)


def build_pending_one_rep_max_response(program, telegram_id=None):
    if program is None:
        return {"cycle_id": None, "program_id": None, "items": []}

    configs = list(
        ProgramOneRepMaxExercise.objects.filter(program=program)
        .select_related("exercise")
        .order_by("order", "id")
    )
    saved_values = {}
    if telegram_id:
        saved_values = {
            item.exercise_id: item.value
            for item in OneRepMax.objects.filter(
                telegram_id=telegram_id,
                program=program,
            )
        }
        if not saved_values:
            latest_cycle = (
                TrainingCycle.objects.filter(
                    telegram_id=telegram_id,
                    program=program,
                    completed_at__isnull=False,
                )
                .order_by("-completed_at", "-id")
                .first()
            )
            if latest_cycle is not None:
                saved_values = {
                    item.exercise_id: item.value
                    for item in CycleOneRepMax.objects.filter(cycle=latest_cycle)
                }

    return {
        "cycle_id": None,
        "program_id": program.id,
        "items": [
            {
                "exercise_id": item.exercise_id,
                "exercise_name": item.exercise.name,
                "category": item.exercise.category,
                "label": item.label or item.exercise.name,
                "value": saved_values.get(item.exercise_id, 0),
            }
            for item in configs
        ],
    }


def build_cycle_one_rep_max_response(cycle):
    if cycle is None:
        return build_pending_one_rep_max_response(None)

    items = list(
        CycleOneRepMax.objects.filter(cycle=cycle)
        .select_related("exercise")
        .order_by("exercise_id")
    )
    return {
        "cycle_id": cycle.id,
        "program_id": cycle.program_id,
        "items": [
            {
                "exercise_id": item.exercise_id,
                "exercise_name": item.exercise.name,
                "category": item.exercise.category,
                "label": item.label or item.exercise.name,
                "value": item.value,
            }
            for item in items
        ],
    }


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
                        "first_name": getattr(profile, "first_name", "") or request.user.first_name,
                        "last_name": getattr(profile, "last_name", "") or request.user.last_name,
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

        data = build_pending_one_rep_max_response(
            get_selected_program(request),
            telegram_id=telegram_id,
        )
        return Response(OneRepMaxResponseSerializer(data).data)

    def put(self, request):
        telegram_id = get_request_telegram_id(request)
        if not telegram_id:
            return Response(
                {"detail": "Telegram user ID not found."},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        serializer = OneRepMaxUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        program = get_selected_program(request)
        configs = list(
            ProgramOneRepMaxExercise.objects.filter(program=program)
            .select_related("exercise")
            .order_by("order", "id")
        )
        allowed_ids = {item.exercise_id for item in configs}
        provided = {item["exercise_id"]: item["value"] for item in serializer.validated_data["items"]}
        invalid_ids = sorted(set(provided) - allowed_ids)
        if invalid_ids:
            return Response(
                {"detail": "Unknown one rep max exercises.", "exercise_ids": invalid_ids},
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            existing_values = {
                item.exercise_id: item
                for item in OneRepMax.objects.select_for_update().filter(
                    telegram_id=telegram_id,
                    program=program,
                    exercise_id__in=allowed_ids,
                )
            }
            for exercise_id, value in provided.items():
                existing = existing_values.get(exercise_id)
                if existing is None:
                    OneRepMax.objects.create(
                        telegram_id=telegram_id,
                        program=program,
                        exercise_id=exercise_id,
                        value=value,
                    )
                else:
                    existing.value = value
                    existing.save(update_fields=["value"])

        data = build_pending_one_rep_max_response(program, telegram_id=telegram_id)
        return Response(OneRepMaxResponseSerializer(data).data)


class CompletionListView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        telegram_id = get_request_telegram_id(request)
        if not telegram_id:
            return Response(
                {"detail": "Telegram user ID not found."},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        program = get_selected_program(request)
        if program is None:
            return Response({"completions": []})

        completions = (
            WorkoutCompletion.objects.filter(
                telegram_id=telegram_id,
                program=program,
            )
            .order_by("completed_at")
        )
        latest_by_day = {}
        for item in completions:
            if item.week_number is None or item.weekday is None:
                continue
            latest_by_day[(item.week_number, item.weekday)] = item.completed_at.strftime("%Y-%m-%d")

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

        program = get_selected_program(request)
        if program is not None:
            WorkoutCompletion.objects.filter(
                telegram_id=telegram_id,
                program=program,
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

        program = get_selected_program(request)
        if program is None:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

        cycle = get_active_cycle(request)
        completion, created = WorkoutCompletion.objects.update_or_create(
            telegram_id=telegram_id,
            cycle=cycle,
            program=program,
            week_number=week_number,
            weekday=weekday,
            defaults={
                "cycle": cycle,
            },
        )
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

        program = get_selected_program(request)
        if program is None:
            return Response(status=status.HTTP_204_NO_CONTENT)

        WorkoutCompletion.objects.filter(
            telegram_id=telegram_id,
            program=program,
            week_number=week_number,
            weekday=weekday,
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

        week_number = request.data.get("week_number")
        program = get_program_context(request)
        week = None
        if week_number is not None and program is not None:
            week = Week.objects.filter(program=program, number=week_number).first()

        obj, _ = AccessoryWeight.objects.update_or_create(
            telegram_id=telegram_id,
            exercise=exercise,
            recorded_date=date.today(),
            defaults={
                "weight": weight,
                "sets_display": request.data.get("sets_display", ""),
                "week": week,
            },
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
        return Week.objects.filter(program=get_program_context(self.request))


class WeekDetailView(generics.RetrieveAPIView):
    serializer_class = WeekDetailSerializer
    permission_classes = [AllowAny]
    lookup_field = "number"

    def get_queryset(self):
        return Week.objects.filter(program=get_program_context(self.request)).prefetch_related(
            "days__exercises__exercise",
            "days__exercises__one_rep_max_exercise",
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
        program = get_program_context(request)
        return Response(build_program_response(build_base_program_payload(program), program=program))


class ProgramOriginalView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        program = get_selected_program(request)
        original_program = program
        if program is not None and program.owner_id is not None and program.source_program_id is not None:
            original_program = program.source_program
        return Response(
            build_program_response(
                build_base_program_payload(original_program),
                program=program,
            )
        )


class ProgramListView(generics.ListAPIView):
    serializer_class = ProgramSerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        return (
            get_accessible_program_queryset(self.request)
            .prefetch_related("one_rep_max_exercises__exercise", "source_program")
            .order_by("owner_id", "name", "id")
        )


class ProgramCreateView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        if not request.user.is_authenticated:
            return Response(
                {"detail": "Authentication required."},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        profile = get_request_profile(request)
        if profile is None:
            return Response({"detail": "User profile not found."}, status=status.HTTP_400_BAD_REQUEST)

        serializer = ProgramCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        source_program = None
        source_program_id = serializer.validated_data.get("source_program_id")
        if source_program_id is not None:
            source_program = (
                Program.objects.prefetch_related("one_rep_max_exercises__exercise")
                .filter(pk=source_program_id, owner__isnull=True)
                .first()
            )
            if source_program is None:
                return Response(
                    {"detail": "Базовая программа не найдена."},
                    status=status.HTTP_404_NOT_FOUND,
                )

        with transaction.atomic():
            program = Program.objects.create(
                slug=generate_custom_program_slug(profile, serializer.validated_data["name"]),
                name=serializer.validated_data["name"],
                description=serializer.validated_data.get("description", ""),
                owner=profile,
                source_program=source_program,
            )
            clone_program_structure(source_program, program)
            profile.selected_program = program
            profile.save(update_fields=["selected_program"])

        program = Program.objects.prefetch_related("one_rep_max_exercises__exercise", "source_program").get(pk=program.pk)
        return Response(ProgramSerializer(program).data, status=status.HTTP_201_CREATED)


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

        program = (
            get_program_queryset_for_profile(profile)
            .prefetch_related("one_rep_max_exercises__exercise", "source_program")
            .filter(pk=program_id)
            .first()
        )
        if program is None:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

        profile.selected_program = program
        profile.save(update_fields=["selected_program"])
        return Response(ProgramSerializer(program).data)


class TrainingCycleActiveView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        telegram_id = get_request_telegram_id(request)
        if not telegram_id:
            return Response(
                {"detail": "Telegram user ID not found."},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        cycle = get_active_cycle(request)
        return Response(
            {"cycle": TrainingCycleSummarySerializer(cycle).data if cycle else None}
        )


class TrainingCycleStartView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        telegram_id = get_request_telegram_id(request)
        if not telegram_id:
            return Response(
                {"detail": "Telegram user ID not found."},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        serializer = TrainingCycleStartSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        program = get_accessible_program_queryset(request).filter(
            pk=serializer.validated_data["program_id"]
        ).first()
        if program is None:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

        configs = list(
            ProgramOneRepMaxExercise.objects.filter(program=program)
            .select_related("exercise")
            .order_by("order", "id")
        )
        allowed_ids = {item.exercise_id for item in configs}
        provided = {item["exercise_id"]: item["value"] for item in serializer.validated_data["items"]}
        invalid_ids = sorted(set(provided) - allowed_ids)
        if invalid_ids:
            return Response(
                {"detail": "Unknown one rep max exercises.", "exercise_ids": invalid_ids},
                status=status.HTTP_400_BAD_REQUEST,
            )
        missing_ids = sorted(allowed_ids - set(provided))
        if missing_ids:
            return Response(
                {"detail": "Не заданы все обязательные 1ПМ.", "exercise_ids": missing_ids},
                status=status.HTTP_400_BAD_REQUEST,
            )

        existing_cycle = (
            TrainingCycle.objects.filter(
                telegram_id=telegram_id,
                program=program,
                completed_at__isnull=True,
            )
            .select_related("program")
            .first()
        )
        if existing_cycle is not None:
            return Response(
                {"detail": "Для этой программы уже есть активный тренировочный цикл."},
                status=status.HTTP_409_CONFLICT,
            )

        with transaction.atomic():
            cycle = TrainingCycle.objects.create(
                telegram_id=telegram_id,
                program=program,
            )
            existing_one_rep_max = {
                item.exercise_id: item
                for item in OneRepMax.objects.select_for_update().filter(
                    telegram_id=telegram_id,
                    program=program,
                    exercise_id__in=allowed_ids,
                )
            }
            CycleOneRepMax.objects.bulk_create(
                [
                    CycleOneRepMax(
                        cycle=cycle,
                        exercise=item.exercise,
                        label=item.label,
                        value=provided[item.exercise_id],
                    )
                    for item in configs
                ]
            )
            one_rep_max_to_create = []
            one_rep_max_to_update = []
            for item in configs:
                value = provided[item.exercise_id]
                existing = existing_one_rep_max.get(item.exercise_id)
                if existing is None:
                    one_rep_max_to_create.append(
                        OneRepMax(
                            telegram_id=telegram_id,
                            program=program,
                            exercise=item.exercise,
                            value=value,
                        )
                    )
                else:
                    existing.value = value
                    one_rep_max_to_update.append(existing)
            if one_rep_max_to_create:
                OneRepMax.objects.bulk_create(one_rep_max_to_create)
            if one_rep_max_to_update:
                OneRepMax.objects.bulk_update(one_rep_max_to_update, ["value"])

            if getattr(request.user, "is_authenticated", False):
                profile = getattr(request.user, "profile", None)
                if profile is not None:
                    profile.selected_program = program
                    profile.save(update_fields=["selected_program"])

        return Response(
            {
                "cycle": TrainingCycleSummarySerializer(cycle).data,
                "program": build_program_response(build_base_program_payload(program), program=program),
                "one_rep_max": OneRepMaxResponseSerializer(
                    build_cycle_one_rep_max_response(cycle)
                ).data,
            },
            status=status.HTTP_201_CREATED,
        )


class TrainingCycleFinishView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        telegram_id = get_request_telegram_id(request)
        if not telegram_id:
            return Response(
                {"detail": "Telegram user ID not found."},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        cycle = get_active_cycle(request)
        if cycle is None:
            return Response(
                {"detail": "Нет активного тренировочного цикла."},
                status=status.HTTP_409_CONFLICT,
            )

        serializer = TrainingCycleFinishSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        notes = (
            serializer.validated_data.get("notes")
            or serializer.validated_data.get("feeling")
            or ""
        )
        cycle.completed_at = timezone.now()
        cycle.completion_reason = serializer.validated_data.get("reason", "")
        cycle.completion_feeling = notes
        cycle.save(update_fields=["completed_at", "completion_reason", "completion_feeling"])
        return Response(TrainingCycleSummarySerializer(cycle).data)


class TrainingCycleHistoryView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        telegram_id = get_request_telegram_id(request)
        if not telegram_id:
            return Response(
                {"detail": "Telegram user ID not found."},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        cycles = TrainingCycle.objects.filter(telegram_id=telegram_id).select_related("program")
        return Response(TrainingCycleSummarySerializer(cycles, many=True).data)


class TrainingCycleHistoryDetailView(APIView):
    permission_classes = [AllowAny]

    def delete(self, request, cycle_id):
        telegram_id = get_request_telegram_id(request)
        if not telegram_id:
            return Response(
                {"detail": "Telegram user ID not found."},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        cycle = TrainingCycle.objects.filter(id=cycle_id, telegram_id=telegram_id).first()
        if cycle is None:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

        if cycle.completed_at is None:
            return Response(
                {"detail": "Нельзя удалить активный тренировочный цикл."},
                status=status.HTTP_409_CONFLICT,
            )

        cycle.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
