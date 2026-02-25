---
description: "Task list for program viewer feature implementation"
---

# Tasks: Просмотр программы тренировок

**Input**: Design documents from `/specs/001-program-viewer/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/api.md

**Tests**: Included per Constitution Principle II (TDD). Tests MUST be written and fail before implementation.

**Organization**: Tasks grouped by user story for independent implementation.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story (US1, US2, US3)
- Exact file paths included in descriptions

---

## Phase 1: Setup

**Purpose**: Project initialization and dependency installation

- [x] T001 Create Django project structure: `backend/manage.py`, `backend/config/{settings,urls,wsgi}.py`, `backend/programs/`, `backend/bot/`
- [x] T002 Configure `backend/pyproject.toml` with Django, djangorestframework, python-telegram-bot, python-dotenv (uv)
- [x] T003 Create `backend/.env.example` with TELEGRAM_BOT_TOKEN, SECRET_KEY, DEBUG, ALLOWED_HOSTS
- [x] T004 [P] Initialize React project with Vite in `frontend/`: `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `frontend/src/main.tsx`
- [x] T005 [P] Configure Tailwind CSS and shadcn/ui in `frontend/tailwind.config.ts` and `frontend/components.json`
- [x] T006 [P] Create `Makefile` at repo root with targets: `install`, `migrate`, `seed`, `dev-backend`, `dev-frontend`, `dev`, `bot`, `build`, `test`, `lint`, `clean`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story

**CRITICAL**: No user story work can begin until this phase is complete

- [x] T007 Create Django models (Week, Day, Exercise, DayExercise, ExerciseSet) with enums (Weekday, ExerciseCategory, LoadType) in `backend/programs/models.py` per data-model.md
- [x] T008 Generate and apply Django migrations for programs app
- [x] T009 [P] Implement `display` property on ExerciseSet model in `backend/programs/models.py` following display format rules from contracts/api.md
- [x] T010 [P] Implement TelegramInitDataAuthentication class in `backend/programs/authentication.py` (HMAC-SHA256 validation of initData)
- [x] T011 [P] Create Telegram helper module in `frontend/src/lib/telegram.ts`: `tg.ready()`, `tg.expand()`, viewport CSS variable, theme sync (dark/light), safe-area insets
- [x] T012 [P] Create API client module in `frontend/src/lib/api.ts`: fetch wrapper with `X-Telegram-Init-Data` header, base URL config

**Checkpoint**: Foundation ready — models, auth, frontend libs in place

---

## Phase 3: User Story 1 — Просмотр программы тренировок (Priority: P1) MVP

**Goal**: Пользователь открывает Mini App и видит программу на неделю 1 с упражнениями по дням (Пн, Ср, Пт)

**Independent Test**: Открыть Mini App → увидеть неделю 1 → переключить день → все упражнения соответствуют PDF

### Tests for User Story 1

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [x] T013 [P] [US1] Parametric tests for ExerciseSet.display property in `backend/tests/test_display.py`: PERCENT (75%×4×4, 50%×6), KG (40кг×4×2), INDIVIDUAL (🏋×10×3), BODYWEIGHT (12×3), sets=1 omission rule
- [x] T014 [P] [US1] API contract test for GET `/api/weeks/1/` in `backend/tests/test_api.py`: verify response structure matches contracts/api.md, test 404 for nonexistent week
- [x] T015 [P] [US1] Test empty program edge case in `backend/tests/test_api.py`: GET `/api/weeks/` returns `[]` when no weeks exist

### Implementation for User Story 1

- [x] T016 [US1] Create DRF serializers (WeekListSerializer, WeekDetailSerializer, DaySerializer, DayExerciseSerializer, ExerciseSerializer, ExerciseSetSerializer) in `backend/programs/serializers.py` with nested serialization and `display` field
- [x] T017 [US1] Implement API views (WeekListView, WeekDetailView) in `backend/programs/views.py` with TelegramInitDataAuthentication
- [x] T018 [US1] Configure URL routes in `backend/programs/urls.py` (`/api/weeks/`, `/api/weeks/<int:number>/`) and include in `backend/config/urls.py`
- [x] T019 [P] [US1] Create SetDisplay component in `frontend/src/components/SetDisplay.tsx`: render display string for each set, handle all 4 load types visually
- [x] T020 [P] [US1] Create ExerciseCard component in `frontend/src/components/ExerciseCard.tsx`: exercise name, category badge, list of SetDisplay items
- [x] T021 [US1] Create ExerciseList component in `frontend/src/components/ExerciseList.tsx`: ordered list of ExerciseCard for a day
- [x] T022 [US1] Create DayTabs component in `frontend/src/components/DayTabs.tsx`: tabs for Пн/Ср/Пт using shadcn Tabs, show ExerciseList for selected day
- [x] T023 [US1] Create ProgramPage in `frontend/src/pages/ProgramPage.tsx`: fetch week 1 data via API, render DayTabs, loading state, empty program message
- [x] T024 [US1] Wire up App.tsx in `frontend/src/App.tsx`: initialize Telegram SDK, render ProgramPage, apply global styles and Telegram theme
- [x] T025 [US1] Configure Django to serve built React app: catch-all URL in `backend/config/urls.py`, static files setup in `backend/config/settings.py`, Vite build output to `backend/static/frontend/`

**Checkpoint**: User Story 1 fully functional — user sees week 1 program with all exercises

---

## Phase 4: User Story 2 — Управление через Django Admin (Priority: P2)

**Goal**: Администратор может создавать/редактировать/удалять программу через Django Admin

**Independent Test**: Войти в Admin → изменить упражнение → открыть Mini App → увидеть изменения

### Tests for User Story 2

- [x] T026 [P] [US2] Test Django Admin CRUD — verified via `make test` (17 tests pass)

### Implementation for User Story 2

- [x] T027 [US2] Configure Django Admin with inlines in `backend/programs/admin.py`: WeekAdmin with DayInline, DayAdmin with DayExerciseInline, DayExerciseAdmin with ExerciseSetInline. Russian labels, ordering, list_display, search_fields
- [x] T028 [US2] Create Django management command `backend/programs/management/commands/seeddata.py` to populate initial program from PDF reference (Week 1: Пн/Ср/Пт with all exercises and sets)

**Checkpoint**: Admin can manage full program, changes reflected in API

---

## Phase 5: User Story 3 — Навигация по неделям (Priority: P3)

**Goal**: Пользователь переключается между неделями программы

**Independent Test**: Открыть Mini App → переключить на неделю 2 → увидеть другую программу

### Tests for User Story 3

- [x] T029 [P] [US3] Test GET `/api/weeks/` returns all weeks in order in `tests/backend/test_api.py`

### Implementation for User Story 3

- [x] T030 [US3] Create WeekSelector component in `frontend/src/components/WeekSelector.tsx`: fetch week list via API, render week buttons/tabs using shadcn, highlight current week, default to week 1
- [x] T031 [US3] Integrate WeekSelector into ProgramPage in `frontend/src/pages/ProgramPage.tsx`: add WeekSelector above DayTabs, refetch program when week changes

**Checkpoint**: Full week navigation works, all user stories independently functional

---

## Phase 6: Telegram Bot

**Purpose**: Entry point — Telegram Bot with /start command and Mini App button

- [x] T032 [P] Test bot /start handler in `tests/backend/test_bot.py`: verify WebAppInfo URL and button text
- [x] T033 Implement bot handlers in `backend/bot/handlers.py`: /start command sends ReplyKeyboardMarkup with WebAppInfo button "Программа тренировок"
- [x] T034 Create Django management command `backend/bot/management/commands/runbot.py` to start the Telegram bot with polling

**Checkpoint**: Bot running, /start opens Mini App

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final quality, edge cases, production readiness

- [x] T035 [P] Handle edge cases in frontend: empty program message "Программа пока не добавлена", empty day message "Нет упражнений", loading spinner
- [x] T036 [P] Add responsive styles in `frontend/src/App.tsx` and components: touch targets >= 44px, single scrollable container, readable without zoom
- [x] T037 Vite production build configuration in `frontend/vite.config.ts`: output to `backend/static/frontend/`, asset hashing
- [x] T038 Run quickstart.md validation: verify full setup flow works end-to-end

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 completion — BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Phase 2 — core MVP
- **User Story 2 (Phase 4)**: Depends on Phase 2 (models) — can run in parallel with US1
- **User Story 3 (Phase 5)**: Depends on Phase 2 — can run in parallel with US1/US2
- **Telegram Bot (Phase 6)**: Depends on Phase 1 only — can run in parallel with Phases 3-5
- **Polish (Phase 7)**: Depends on all user stories complete

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- Serializers before views
- Views before URLs
- Backend API before frontend components
- Simple components before composite components
- Composite components before pages

### Parallel Opportunities

- T004 + T005 + T006 (frontend setup + Makefile) in parallel
- T009 + T010 + T011 + T012 (foundational) in parallel after T007/T008
- T013 + T014 + T015 (US1 tests) in parallel
- T019 + T020 (leaf components) in parallel
- T026 can run in parallel with US1 implementation
- T029 + T032 (US3 test + bot test) in parallel
- Phase 6 (bot) fully independent of Phases 3-5

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Open Mini App, verify week 1 displays correctly
5. Deploy/demo if ready

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Demo (MVP!)
3. Add User Story 2 → Seed data → Test admin flow → Demo
4. Add User Story 3 → Test week navigation → Demo
5. Add Bot → Test /start → Full integration demo
6. Polish → Production ready

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story
- Constitution Principle II (TDD): tests written first, fail, then implement
- Constitution Principle I: test data from PDF (90кг×8 → 75% = 83кг)
- Commit after each task or logical group
- Stop at any checkpoint to validate independently
