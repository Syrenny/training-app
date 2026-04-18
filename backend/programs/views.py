import json
from datetime import date
from urllib.parse import unquote

from django.conf import settings
from django.contrib.auth import login, logout
from django.db import transaction
from django.db.models import OuterRef, Q, Subquery
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
    AdaptationAction,
    AdaptationScope,
    CycleOneRepMax,
    Exercise,
    Program,
    ProgramAdaptation,
    ProgramOneRepMaxExercise,
    ProgramSnapshot,
    TrainingCycle,
    Week,
    Weekday,
    WorkoutCompletion,
)
from .program_snapshot import (
    apply_adaptations_to_payload,
    build_base_program_payload,
    build_program_payload_with_future_adaptations,
    build_program_response,
    count_program_entities,
    iter_payload_slots,
    find_slot_index,
    get_default_program,
    get_latest_snapshot_for_program,
    merge_program_payload_metadata,
    revert_cycle_adaptation,
)
from .serializers import (
    AccessoryWeightSerializer,
    ExerciseSerializer,
    OneRepMaxResponseSerializer,
    ProgramAdaptationCancelSerializer,
    ProgramAdaptationCreateSerializer,
    ProgramAdaptationSerializer,
    ProgramSerializer,
    ProgramSnapshotInputSerializer,
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

    if profile.selected_program_id is None and default_program is not None:
        profile.selected_program = default_program
        profile.save(update_fields=["selected_program"])
        return default_program

    return profile.selected_program or default_program


def get_active_cycle(request):
    telegram_id = get_request_telegram_id(request)
    if not telegram_id:
        return None
    return (
        TrainingCycle.objects.filter(
            telegram_id=telegram_id,
            completed_at__isnull=True,
        )
        .select_related("program")
        .order_by("-started_at", "-id")
        .first()
    )


def get_program_context(request):
    active_cycle = get_active_cycle(request)
    if active_cycle is not None:
        return active_cycle.program
    return get_selected_program(request)


def get_slot_payload(payload, week_number, weekday, slot_key):
    day_exercises, exercise_index = find_slot_index(payload, week_number, weekday, slot_key)
    if day_exercises is None or exercise_index is None:
        return None
    return day_exercises[exercise_index]


def is_slot_replaced(current_payload, base_payload, week_number, weekday, slot_key):
    current_slot = get_slot_payload(current_payload, week_number, weekday, slot_key)
    base_slot = get_slot_payload(base_payload, week_number, weekday, slot_key)
    if current_slot is None or base_slot is None:
        return False
    return current_slot.get("exercise_id") != base_slot.get("exercise_id")


def adaptation_has_completed_workouts(adaptation):
    common_filters = {
        "telegram_id": adaptation.telegram_id,
        "completed_at__gte": adaptation.created_at,
    }

    if adaptation.scope == AdaptationScope.ONLY_HERE:
        if adaptation.cycle_id is None:
            return False
        return WorkoutCompletion.objects.filter(
            **common_filters,
            week_number=adaptation.week_number,
            weekday=adaptation.weekday,
            cycle=adaptation.cycle,
        ).exists()

    filters = {
        **common_filters,
    }

    if adaptation.scope == AdaptationScope.FUTURE_CYCLES:
        return WorkoutCompletion.objects.filter(
            **filters,
            cycle__program=adaptation.program,
            cycle__started_at__gte=adaptation.created_at,
        ).exists()

    if adaptation.cycle_id is None:
        return False

    return WorkoutCompletion.objects.filter(
        **filters,
        cycle=adaptation.cycle,
    ).exists()


def any_matching_slot_replaced(current_payload, base_payload, original_exercise_id):
    for week_number, weekday, _, _, item in iter_payload_slots(base_payload):
        if item.get("exercise_id") != original_exercise_id:
            continue

        current_slot = get_slot_payload(
            current_payload,
            week_number,
            weekday,
            item.get("slot_key"),
        )
        if current_slot is None or current_slot.get("exercise_id") != original_exercise_id:
            return True

    return False


def build_cycle_baseline_payload(cycle):
    payload = build_base_program_payload(cycle.program)
    future_adaptations = list(
        ProgramAdaptation.objects.filter(
            telegram_id=cycle.telegram_id,
            program=cycle.program,
            scope=AdaptationScope.FUTURE_CYCLES,
            created_at__lte=cycle.started_at,
        )
        .filter(Q(canceled_at__isnull=True) | Q(canceled_at__gt=cycle.started_at))
        .order_by("created_at", "id")
    )
    if not future_adaptations:
        return payload
    return apply_adaptations_to_payload(payload, future_adaptations)


def rebuild_cycle_payload(cycle, *, exclude_adaptation_ids=None):
    excluded_ids = set(exclude_adaptation_ids or [])
    remaining_adaptations = [
        adaptation
        for adaptation in ProgramAdaptation.objects.filter(
            cycle=cycle,
            canceled_at__isnull=True,
        ).order_by("created_at", "id")
        if adaptation.id not in excluded_ids
    ]
    baseline_payload = build_cycle_baseline_payload(cycle)
    if not remaining_adaptations:
        return baseline_payload

    return apply_adaptations_to_payload(baseline_payload, remaining_adaptations)


def build_pending_one_rep_max_response(program):
    if program is None:
        return {"cycle_id": None, "program_id": None, "items": []}

    configs = list(
        ProgramOneRepMaxExercise.objects.filter(program=program)
        .select_related("exercise")
        .order_by("order", "id")
    )
    return {
        "cycle_id": None,
        "program_id": program.id,
        "items": [
            {
                "exercise_id": item.exercise_id,
                "exercise_name": item.exercise.name,
                "category": item.exercise.category,
                "label": item.label or item.exercise.name,
                "value": 0,
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

        active_cycle = get_active_cycle(request)
        if active_cycle is None:
            data = build_pending_one_rep_max_response(get_selected_program(request))
        else:
            data = build_cycle_one_rep_max_response(active_cycle)
        return Response(OneRepMaxResponseSerializer(data).data)

    def put(self, request):
        return Response(
            {"detail": "1ПМ задаются только при старте тренировочного цикла."},
            status=status.HTTP_409_CONFLICT,
        )


class CompletionListView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        telegram_id = get_request_telegram_id(request)
        if not telegram_id:
            return Response(
                {"detail": "Telegram user ID not found."},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        active_cycle = get_active_cycle(request)
        if active_cycle is None:
            return Response({"completions": []})

        completions = (
            WorkoutCompletion.objects.filter(telegram_id=telegram_id, cycle=active_cycle)
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
        return Response(
            {"detail": "Отметки сбрасывать нельзя. Завершите цикл явно."},
            status=status.HTTP_409_CONFLICT,
        )


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

        active_cycle = get_active_cycle(request)
        if active_cycle is None:
            return Response(
                {"detail": "Нет активного тренировочного цикла."},
                status=status.HTTP_409_CONFLICT,
            )

        completion, created = WorkoutCompletion.objects.get_or_create(
            cycle=active_cycle,
            week_number=week_number,
            weekday=weekday,
            defaults={
                "telegram_id": telegram_id,
                "program": active_cycle.program,
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

        active_cycle = get_active_cycle(request)
        if active_cycle is None:
            return Response(
                {"detail": "Нет активного тренировочного цикла."},
                status=status.HTTP_409_CONFLICT,
            )

        WorkoutCompletion.objects.filter(
            cycle=active_cycle,
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
        telegram_id = get_request_telegram_id(request)
        active_cycle = get_active_cycle(request) if telegram_id else None

        if active_cycle is not None:
            return Response(build_program_response(active_cycle.program_payload, program=program))

        if not telegram_id:
            return Response(build_program_response(build_base_program_payload(program), program=program))

        payload = build_program_payload_with_future_adaptations(telegram_id, program)
        return Response(build_program_response(payload, program=program))


class ProgramOriginalView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        program = get_selected_program(request)
        return Response(build_program_response(build_base_program_payload(program), program=program))


class ProgramSnapshotCreateView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        telegram_id = get_request_telegram_id(request)
        if not telegram_id:
            return Response(
                {"detail": "Telegram user ID not found."},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        serializer = ProgramSnapshotInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        program = get_selected_program(request)
        current_snapshot = get_latest_snapshot_for_program(telegram_id, program)
        current_payload = current_snapshot.payload if current_snapshot else build_base_program_payload(program)
        latest = (
            ProgramSnapshot.objects.filter(telegram_id=telegram_id, program=program)
            .order_by("-version")
            .first()
        )
        next_version = (latest.version if latest else 0) + 1
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
        program = get_selected_program(request)
        snapshots = ProgramSnapshot.objects.filter(
            telegram_id=telegram_id,
            program=program,
        ).order_by("-version")
        return Response(
            [
                {
                    "version": snapshot.version,
                    "created_at": snapshot.created_at.isoformat(),
                    "commit_message": snapshot.commit_message,
                    "source_snapshot_version": snapshot.source_snapshot_version,
                    **count_program_entities(snapshot.payload),
                }
                for snapshot in snapshots
            ]
        )


class ProgramHistoryDetailView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, version):
        telegram_id = get_request_telegram_id(request)
        if not telegram_id:
            return Response(
                {"detail": "Telegram user ID not found."},
                status=status.HTTP_401_UNAUTHORIZED,
            )
        program = get_selected_program(request)
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
    queryset = Program.objects.prefetch_related("one_rep_max_exercises__exercise").all()
    serializer_class = ProgramSerializer
    permission_classes = [AllowAny]


class ProgramSelectionView(APIView):
    permission_classes = [AllowAny]

    def put(self, request):
        if get_active_cycle(request) is not None:
            return Response(
                {"detail": "Во время активного цикла программу менять нельзя."},
                status=status.HTTP_409_CONFLICT,
            )
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

        program = Program.objects.prefetch_related("one_rep_max_exercises__exercise").filter(pk=program_id).first()
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
        if get_active_cycle(request) is not None:
            return Response(
                {"detail": "Сначала завершите текущий тренировочный цикл."},
                status=status.HTTP_409_CONFLICT,
            )

        serializer = TrainingCycleStartSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        program = Program.objects.filter(pk=serializer.validated_data["program_id"]).first()
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

        payload = build_program_payload_with_future_adaptations(telegram_id, program)
        with transaction.atomic():
            cycle = TrainingCycle.objects.create(
                telegram_id=telegram_id,
                program=program,
                program_payload=payload,
            )
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

            if getattr(request.user, "is_authenticated", False):
                profile = getattr(request.user, "profile", None)
                if profile is not None:
                    profile.selected_program = program
                    profile.save(update_fields=["selected_program"])

        return Response(
            {
                "cycle": TrainingCycleSummarySerializer(cycle).data,
                "program": build_program_response(payload, program=program),
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
        cycle.completed_at = timezone.now()
        cycle.completion_reason = serializer.validated_data["reason"]
        cycle.completion_feeling = serializer.validated_data["feeling"]
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


class ProgramAdaptationListCreateView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        telegram_id = get_request_telegram_id(request)
        if not telegram_id:
            return Response(
                {"detail": "Telegram user ID not found."},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        program_id = request.query_params.get("program_id")
        if program_id:
            program = Program.objects.filter(pk=program_id).first()
        else:
            program = get_program_context(request)
        if program is None:
            return Response([])

        items = (
            ProgramAdaptation.objects.filter(telegram_id=telegram_id, program=program)
            .select_related("program", "cycle", "original_exercise", "replacement_exercise")
            .order_by("-created_at", "-id")
        )
        return Response(ProgramAdaptationSerializer(items, many=True).data)

    def post(self, request):
        telegram_id = get_request_telegram_id(request)
        if not telegram_id:
            return Response(
                {"detail": "Telegram user ID not found."},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        serializer = ProgramAdaptationCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        program = Program.objects.filter(pk=serializer.validated_data["program_id"]).first()
        if program is None:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

        active_cycle = get_active_cycle(request)
        scope = serializer.validated_data["scope"]
        cycle = None
        current_payload = None
        if scope != AdaptationScope.FUTURE_CYCLES:
            if active_cycle is None or active_cycle.program_id != program.id:
                return Response(
                    {"detail": "Для этой области действия нужен активный цикл той же программы."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            cycle = active_cycle
            current_payload = json.loads(json.dumps(cycle.program_payload))
        else:
            current_payload = build_program_payload_with_future_adaptations(telegram_id, program)

        week_number = serializer.validated_data["week_number"]
        weekday = serializer.validated_data["weekday"]
        slot_key = serializer.validated_data["slot_key"]
        original_exercise_id = serializer.validated_data.get("original_exercise_id")
        current_slot_payload = get_slot_payload(current_payload, week_number, weekday, slot_key)
        if current_slot_payload is None:
            return Response(
                {"detail": "Эта позиция уже недоступна. Сначала отмените предыдущее правило."},
                status=status.HTTP_409_CONFLICT,
            )

        if (
            serializer.validated_data["action"] == AdaptationAction.REPLACE
            and scope != AdaptationScope.ONLY_HERE
        ):
            base_payload = build_base_program_payload(program)
            if (
                is_slot_replaced(current_payload, base_payload, week_number, weekday, slot_key)
                or any_matching_slot_replaced(
                    current_payload,
                    base_payload,
                    original_exercise_id,
                )
            ):
                return Response(
                    {
                        "detail": (
                            "Заменённое упражнение можно менять только стратегией "
                            "«Только сейчас». Для более широкой замены сначала отмените прошлое правило."
                        )
                    },
                    status=status.HTTP_409_CONFLICT,
                )

        original_exercise = None
        original_exercise_id = serializer.validated_data.get("original_exercise_id")
        if original_exercise_id is not None:
            original_exercise = Exercise.objects.filter(pk=original_exercise_id).first()

        replacement_exercise = None
        replacement_exercise_id = serializer.validated_data.get("replacement_exercise_id")
        if replacement_exercise_id is not None:
            replacement_exercise = Exercise.objects.filter(pk=replacement_exercise_id).first()
            if replacement_exercise is None:
                return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

        adaptation = ProgramAdaptation.objects.create(
            telegram_id=telegram_id,
            program=program,
            cycle=cycle,
            scope=scope,
            action=serializer.validated_data["action"],
            slot_key=slot_key,
            week_number=week_number,
            weekday=weekday,
            original_exercise=original_exercise,
            replacement_exercise=replacement_exercise,
            previous_slot_payload=current_slot_payload if cycle is not None else None,
            reason=serializer.validated_data.get("reason", ""),
        )

        if cycle is not None:
            cycle.program_payload = apply_adaptations_to_payload(cycle.program_payload, [adaptation])
            cycle.save(update_fields=["program_payload"])

        return Response(ProgramAdaptationSerializer(adaptation).data, status=status.HTTP_201_CREATED)


class ProgramAdaptationCancelView(APIView):
    permission_classes = [AllowAny]

    def post(self, request, adaptation_id):
        telegram_id = get_request_telegram_id(request)
        if not telegram_id:
            return Response(
                {"detail": "Telegram user ID not found."},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        serializer = ProgramAdaptationCancelSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        adaptation = (
            ProgramAdaptation.objects.filter(telegram_id=telegram_id, pk=adaptation_id)
            .select_related("program", "cycle", "original_exercise", "replacement_exercise")
            .first()
        )
        if adaptation is None:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

        if adaptation.canceled_at is not None:
            return Response(
                {"detail": "Адаптация уже отменена."},
                status=status.HTTP_409_CONFLICT,
            )

        cancellation_reason = serializer.validated_data.get("reason", "")
        if adaptation_has_completed_workouts(adaptation):
            if not cancellation_reason:
                return Response(
                    {"detail": "Укажите причину: по этой адаптации уже были проведены тренировки."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            adaptation.canceled_at = timezone.now()
            adaptation.cancellation_reason = cancellation_reason
            adaptation.save(update_fields=["canceled_at", "cancellation_reason"])
            return Response(ProgramAdaptationSerializer(adaptation).data)

        cycle = adaptation.cycle if adaptation.scope != AdaptationScope.FUTURE_CYCLES else None

        with transaction.atomic():
            if cycle is not None:
                try:
                    cycle.program_payload = rebuild_cycle_payload(
                        cycle,
                        exclude_adaptation_ids={adaptation.id},
                    )
                except ValueError:
                    return Response(
                        {
                            "detail": (
                                "Эту адаптацию нельзя автоматически отменить. "
                                "Сначала завершите или скорректируйте более старые правила."
                            )
                        },
                        status=status.HTTP_409_CONFLICT,
                    )
                cycle.save(update_fields=["program_payload"])

            adaptation.delete()

        return Response(status=status.HTTP_204_NO_CONTENT)
