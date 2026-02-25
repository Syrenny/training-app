# Tasks: Корректировки интерфейса

**Input**: Design documents from `/specs/003-ui-tweaks/`
**Prerequisites**: plan.md, spec.md

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup

**Purpose**: Install new dependencies

- [x] T001 Install zustand dependency in frontend/package.json: `cd frontend && npm install zustand`
- [x] T002 Add shadcn Select component: `cd frontend && npx shadcn@latest add select`

**Checkpoint**: Dependencies installed, shadcn Select available

---

## Phase 2: Foundational (Zustand Store)

**Purpose**: Create the shared store used by US2, US3, and US4

**⚠️ CRITICAL**: US2-US4 all depend on the store

- [x] T003 Create Zustand store in frontend/src/lib/store.ts with: selectedWeek (number | null), selectedDay (string | null), weekList (WeekListItem[]), weekDetailCache (Record<number, WeekDetailData>), actions: setWeek, setDay, fetchWeeks, fetchWeekDetail (with caching). Use persist middleware to save selectedWeek and selectedDay to localStorage.

**Checkpoint**: Store created, can be imported by components

---

## Phase 3: User Story 1 — Визуальные корректировки (Priority: P1) 🎯 MVP

**Goal**: Выравнивание элементов, иконка гантели, убрать заголовок

**Independent Test**: Открыть день — номера слева-сверху, бейджи справа, иконка гантели для INDIVIDUAL, нет заголовка

### Implementation for User Story 1

- [x] T004 [P] [US1] Update frontend/src/components/ExerciseCard.tsx: align order number to top-left (items-start instead of items-center), push Badge to right edge (ml-auto), add Dumbbell icon from lucide-react for INDIVIDUAL load_type sets
- [x] T005 [P] [US1] Remove h1 "Программа тренировок" heading from frontend/src/pages/ProgramPage.tsx

**Checkpoint**: Cards look correct, no title, dumbbell icon visible

---

## Phase 4: User Story 2 — Дропдаун недель (Priority: P1)

**Goal**: Компактный дропдаун вместо кнопок

**Independent Test**: Открыть приложение, кликнуть селектор — дропдаун с неделями, выбрать — контент обновляется

### Implementation for User Story 2

- [x] T006 [US2] Rewrite frontend/src/components/WeekSelector.tsx: replace horizontal button list with shadcn Select component (from frontend/src/components/ui/select.tsx), show current week title, dropdown lists all weeks

**Checkpoint**: Dropdown works, compact, selects week

---

## Phase 5: User Story 3 — Запоминание недели и дня (Priority: P2)

**Goal**: Сохранение позиции между сессиями

**Independent Test**: Выбрать неделю 5 + среду, перезагрузить — показывается неделя 5, среда

### Implementation for User Story 3

- [x] T007 [US3] Update frontend/src/pages/ProgramPage.tsx: replace local useState with Zustand store (selectedWeek, selectedDay from store), initialize from persisted state, fallback to first available week if saved week not found
- [x] T008 [US3] Update frontend/src/components/DayTabs.tsx: make it a controlled component — read selectedDay from store, call setDay on tab change instead of using uncontrolled defaultValue

**Checkpoint**: Week and day persist across page reloads

---

## Phase 6: User Story 4 — Кэширование запросов (Priority: P2)

**Goal**: Не делать повторные запросы за уже загруженные недели

**Independent Test**: Открыть неделю 1, переключиться на неделю 2 (запрос), вернуться на неделю 1 — мгновенно, без запроса

### Implementation for User Story 4

- [x] T009 [US4] Update frontend/src/pages/ProgramPage.tsx: use store.fetchWeekDetail (which checks cache before fetching) instead of direct API calls. Remove local weekData/loading/error state, use store state instead.

**Checkpoint**: Network tab shows no duplicate requests for same week

---

## Phase 7: Polish

**Purpose**: Cleanup and validation

- [x] T010 Verify TypeScript compiles without errors: `cd frontend && npx tsc --noEmit`
- [x] T011 Visual smoke test: open app, check all 4 user stories work together

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies
- **Foundational (Phase 2)**: Depends on T001 (zustand installed)
- **US1 (Phase 3)**: No dependencies on store — can run in parallel with Phase 2
- **US2 (Phase 4)**: Depends on T002 (shadcn Select)
- **US3 (Phase 5)**: Depends on T003 (store created)
- **US4 (Phase 6)**: Depends on T003 (store created) and T007 (ProgramPage uses store)
- **Polish (Phase 7)**: Depends on all stories complete

### Parallel Opportunities

- T004 + T005 (different files, both US1)
- US1 (Phase 3) can run in parallel with Phase 2 (no store dependency)
- T001 + T002 (independent installs)

---

## Implementation Strategy

### MVP First (User Story 1)

1. Phase 1: Install deps
2. Phase 3: US1 visual tweaks (T004, T005)
3. **STOP**: App looks better already

### Full Delivery

4. Phase 2: Create store (T003)
5. Phase 4: US2 dropdown (T006)
6. Phase 5: US3 persistence (T007, T008)
7. Phase 6: US4 caching (T009)
8. Phase 7: Polish (T010, T011)

---

## Notes

- Zustand is lightweight (~1KB) and supports persist middleware out of the box
- shadcn Select wraps Radix UI Select — already installed via radix-ui package
- lucide-react is already a dependency — Dumbbell icon just needs to be imported
- No backend changes needed — this is 100% frontend
