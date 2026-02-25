# Tasks: Автоматический подсчёт веса

**Input**: Design documents from `/specs/004-weight-calc/`
**Prerequisites**: plan.md, spec.md, data-model.md, contracts/one-rep-max-api.md, research.md

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2)
- Include exact file paths in descriptions

---

## Phase 1: Setup

**Purpose**: Install new UI dependency

- [x] T001 Add shadcn Sheet component: `cd frontend && npx shadcn@latest add sheet`

**Checkpoint**: Sheet component available at frontend/src/components/ui/sheet.tsx

---

## Phase 2: Foundational (Backend Model + API)

**Purpose**: OneRepMax model and API endpoint — required by both US1 (input form) and US2 (weight display)

**⚠️ CRITICAL**: Both user stories depend on the backend API

- [x] T002 Add OneRepMax model in backend/programs/models.py: fields telegram_id (BigIntegerField, unique, indexed), bench (PositiveIntegerField, default=0, validators max=999), squat (same), deadlift (same). Run makemigrations + migrate.
- [x] T003 Add OneRepMaxSerializer in backend/programs/serializers.py: fields bench, squat, deadlift. Validation: 0–999 integer for each field.
- [x] T004 Add OneRepMaxView in backend/programs/views.py: GET returns current user's 1RM (or defaults {bench:0, squat:0, deadlift:0}), PUT does get_or_create by telegram_id then updates. Extract telegram_id from request.user["id"]. Use IsAuthenticated permission (TelegramInitDataAuthentication).
- [x] T005 Add URL route in backend/programs/urls.py: path "one-rep-max/" → OneRepMaxView (GET + PUT)
- [x] T006 Write tests in backend/tests/test_one_rep_max.py: test model creation, test GET returns defaults, test PUT creates/updates, test PUT validation (>999 rejected), test weight calculation formula (parametric: 100kg×70%=70kg, 200kg×72%=142.5kg, 90kg×55%=47.5kg, 150kg×80%=120kg)

**Checkpoint**: `cd backend && uv run python manage.py test tests/test_one_rep_max.py` — all tests pass

---

## Phase 3: User Story 1 — Ввод разовых максимумов (Priority: P1) 🎯 MVP

**Goal**: Страница ввода 1ПМ доступная из сайдбара, значения сохраняются на сервере

**Independent Test**: Открыть сайдбар → 1ПМ → ввести значения → закрыть/открыть → значения сохранены

### Implementation for User Story 1

- [x] T007 [P] [US1] Add OneRepMax types and API functions in frontend/src/lib/api.ts: type OneRepMaxData {bench: number, squat: number, deadlift: number}, fetchOneRepMax(): GET /one-rep-max/, saveOneRepMax(data): PUT /one-rep-max/
- [x] T008 [P] [US1] Add oneRepMax state to Zustand store in frontend/src/lib/store.ts: oneRepMax (OneRepMaxData | null), fetchOneRepMax action (load from API), saveOneRepMax action (PUT to API + update local state). Fetch on app init.
- [x] T009 [US1] Create OneRepMaxPage component in frontend/src/components/OneRepMaxPage.tsx: three input fields (Жим, Присед, Тяга), numbers only, max 3 digits, reads from store, saves on change (debounce ~500ms). Use shadcn Input components.
- [x] T010 [US1] Create Sidebar component in frontend/src/components/Sidebar.tsx: shadcn Sheet (side="left"), trigger button with Menu icon (lucide-react), navigation item "1ПМ" that shows OneRepMaxPage content inside the sheet.
- [x] T011 [US1] Add Sidebar trigger to frontend/src/pages/ProgramPage.tsx: render Sidebar component at top of page (before WeekSelector)

**Checkpoint**: Sidebar opens, 1RM values can be entered, saved, and persist after reload

---

## Phase 4: User Story 2 — Отображение рассчитанного веса (Priority: P1)

**Goal**: Рядом с процентом в бейдже подхода отображается рассчитанный вес (например, `70% (70кг) ×4×2`)

**Independent Test**: Ввести 1ПМ жима = 100кг → подход 70% показывает "70% (70кг)", подход 72% показывает "72% (70кг)"

### Implementation for User Story 2

- [x] T012 [US2] Create weight calculation utility in frontend/src/lib/calc.ts: function calcWeight(oneRepMax: number, percent: number): number — returns Math.floor(oneRepMax * percent / 100 / 2.5) * 2.5. Export category-to-field mapping: {BENCH: "bench", SQUAT: "squat", DEADLIFT: "deadlift"}.
- [x] T013 [US2] Update frontend/src/components/SetDisplay.tsx: accept exercise category prop, read oneRepMax from store, for PERCENT load_type with category BENCH/SQUAT/DEADLIFT — calculate weight using calcWeight(), display as "70% (70кг)" format inside the badge. If 1RM is 0 or null, show only percent. Skip for ACCESSORY category.
- [x] T014 [US2] Update frontend/src/components/ExerciseCard.tsx: pass exercise category down to SetDisplay component
- [x] T015 [US2] Update frontend/src/components/ExerciseList.tsx if needed: ensure category flows from DayExercise through ExerciseCard to SetDisplay

**Checkpoint**: All percentage-based sets for BENCH/SQUAT/DEADLIFT show calculated weight inline

---

## Phase 5: Polish

**Purpose**: Cleanup and validation

- [x] T016 Verify TypeScript compiles without errors: `cd frontend && npx tsc --noEmit`
- [x] T017 Run all backend tests: `cd backend && uv run python manage.py test tests/ --verbosity=2`
- [x] T018 Visual smoke test: open app, verify all quickstart.md scenarios work

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies
- **Foundational (Phase 2)**: No dependencies on Phase 1 (Sheet not needed for backend)
- **US1 (Phase 3)**: Depends on T001 (Sheet component) and T005 (API route ready)
- **US2 (Phase 4)**: Depends on T008 (store has oneRepMax state)
- **Polish (Phase 5)**: Depends on all stories complete

### Parallel Opportunities

- T001 can run in parallel with T002–T006 (frontend setup vs backend work)
- T007 + T008 (different files, both US1 frontend)
- T002 + T003 can overlap (model + serializer in different locations of same module)

---

## Implementation Strategy

### MVP First (User Story 1)

1. Phase 1: Install shadcn Sheet
2. Phase 2: Backend model + API + tests
3. Phase 3: US1 — sidebar + 1RM input form
4. **STOP**: User can enter and save 1RM values

### Full Delivery

5. Phase 4: US2 — weight display in set badges
6. Phase 5: Polish + validation

---

## Notes

- No new backend dependencies — Django REST Framework handles everything
- Frontend: only new shadcn component is Sheet (for sidebar)
- Telegram user ID extracted from existing TelegramInitDataAuthentication
- Weight calculation is pure frontend — formula: Math.floor(1RM × % / 100 / 2.5) * 2.5
- OneRepMax model uses get_or_create pattern — no separate create endpoint needed
