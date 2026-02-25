# Tasks: Деплой приложения

**Input**: Design documents from `/specs/002-docker-deploy/`
**Prerequisites**: plan.md, spec.md, research.md, quickstart.md

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup

**Purpose**: Create ignore files and project structure for deploy infrastructure

- [x] T001 Create .dockerignore with exclusions for .git, node_modules, __pycache__, .venv, db/, *.pyc, .env in .dockerignore
- [x] T002 [P] Create .github/workflows/ directory structure

**Checkpoint**: Directory structure ready for deploy files

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Dockerfile and entrypoint — required by ALL user stories

**⚠️ CRITICAL**: US2 and US3 cannot work without a working container (US1)

- [x] T003 Create multi-stage Dockerfile: stage 1 (Node 22) builds frontend with `npm ci && npm run build`, stage 2 (Python 3.13) installs backend deps with uv, copies built frontend from stage 1, runs collectstatic in Dockerfile
- [x] T004 Create entrypoint.sh: run migrations, start gunicorn (2 workers, bind 0.0.0.0:8000) in background, start `python manage.py runbot` in foreground in entrypoint.sh
- [x] T005 Add gunicorn and whitenoise to backend dependencies using uv (pyproject.toml)
- [x] T006 Configure whitenoise middleware in backend/config/settings.py (add WhiteNoiseMiddleware after SecurityMiddleware, set STATIC_ROOT)
- [x] T007 Update backend/config/settings.py to read SECRET_KEY, ALLOWED_HOSTS, DEBUG from environment variables with sensible defaults

**Checkpoint**: `docker build` succeeds, `docker run` starts Django + bot

---

## Phase 3: User Story 1 — Контейнеризация (Priority: P1) 🎯 MVP

**Goal**: Приложение упаковано в контейнер, запускается с env vars, данные сохраняются через volume

**Independent Test**: `docker build -t training-app . && docker run -p 8000:8000 -v $(pwd)/db:/app/db -e TELEGRAM_BOT_TOKEN=test -e SECRET_KEY=secret -e ALLOWED_HOSTS=localhost training-app` → curl localhost:8000 отвечает, данные сохраняются между перезапусками

### Implementation for User Story 1

- [x] T008 [US1] Ensure SQLite DATABASE path in backend/config/settings.py points to /app/db/db.sqlite3 (configurable via env var DB_DIR, default db/) so volume mount works
- [ ] T009 [US1] Verify Dockerfile builds successfully by running `docker build -t training-app .` locally
- [ ] T010 [US1] Verify container starts and Django responds: run container with env vars, curl /api/programs/, check bot logs in docker logs

**Checkpoint**: Container builds, runs, serves API, bot starts, DB persists via volume

---

## Phase 4: User Story 2 — Автоматический деплой при пуше в main (Priority: P1)

**Goal**: Push to main → tests → build & push image to ghcr.io → SSH deploy to VPS

**Independent Test**: Push commit to main → GitHub Actions runs → new container deployed on server

### Implementation for User Story 2

- [x] T011 [US2] Create GitHub Actions workflow .github/workflows/deploy.yml with trigger on push to main and workflow_dispatch, concurrency group `deploy-production` with cancel-in-progress
- [x] T012 [US2] Add "test" job to .github/workflows/deploy.yml: checkout, setup Python 3.13, install deps with uv, run `python manage.py test` from backend/
- [x] T013 [US2] Add "build" job to .github/workflows/deploy.yml: depends on test, login to ghcr.io, docker build & push with tags (sha + latest)
- [x] T014 [US2] Add "deploy" job to .github/workflows/deploy.yml: depends on build, SSH to server using secrets (SSH_HOST, SSH_USER, SSH_KEY), pull image from ghcr.io, stop old container, start new container with env vars from secrets (TELEGRAM_BOT_TOKEN, SECRET_KEY, TELEGRAM_WEBAPP_URL, ALLOWED_HOSTS), mount volume for SQLite

**Checkpoint**: Full CI/CD pipeline: push → test → build → deploy

---

## Phase 5: User Story 3 — Ручной запуск деплоя (Priority: P3)

**Goal**: Разработчик может вручную запустить деплой через GitHub Actions UI

**Independent Test**: GitHub Actions → Run workflow → выбрать ветку → деплой происходит

### Implementation for User Story 3

- [x] T015 [US3] Verify workflow_dispatch trigger is configured in .github/workflows/deploy.yml (already added in T011), test that manual run is available in Actions UI

**Checkpoint**: Manual deploy via Actions UI works

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Validation and hardening

- [ ] T016 Run quickstart.md validation: build container locally, run with env vars, verify API responds and bot starts
- [x] T017 Verify all existing tests still pass (make test) after deploy changes

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Foundational — container must build first
- **US2 (Phase 4)**: Depends on US1 — CI/CD deploys the container from US1
- **US3 (Phase 5)**: Depends on US2 — workflow_dispatch is part of the same workflow
- **Polish (Phase 6)**: Depends on all stories complete

### Within Phases

- T001 and T002 are parallel (different files)
- T003 must complete before T004 (entrypoint runs inside container)
- T005 and T006 are sequential (deps must be installed before configuring middleware)
- T011 → T012 → T013 → T014 are sequential (building the workflow file incrementally)

### Parallel Opportunities

- T001 + T002 (setup phase)
- T005 + T007 (different files: pyproject.toml vs settings.py) — but T006 depends on T005

---

## Implementation Strategy

### MVP First (User Story 1)

1. Complete Phase 1: Setup (.dockerignore, directory)
2. Complete Phase 2: Foundational (Dockerfile, entrypoint, deps, settings)
3. Complete Phase 3: US1 (verify container works locally)
4. **STOP and VALIDATE**: Build and run container, test all endpoints

### Full Delivery

5. Complete Phase 4: US2 (GitHub Actions CI/CD)
6. Complete Phase 5: US3 (manual dispatch — already included in workflow)
7. Complete Phase 6: Polish (validation)

---

## Notes

- US3 is essentially free — workflow_dispatch is added alongside push trigger in T011
- No new data models or API endpoints — this is purely infrastructure
- All secrets are injected at runtime via `docker run -e`, never baked into image
- SQLite volume mount path: `/app/db/` inside container → host directory via `-v`
