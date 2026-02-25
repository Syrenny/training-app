# Research: Деплой приложения

## R1: Контейнеризация Django + React + Bot

**Decision**: Multi-stage Dockerfile — Node для сборки фронтенда, Python для runtime.

**Rationale**:
- Multi-stage build уменьшает размер финального образа (не тащим node_modules)
- Frontend собирается в первом stage, результат копируется в Python-образ
- uv используется для установки Python-зависимостей (быстрее pip)
- gunicorn как production WSGI-сервер (вместо `runserver`)

**Alternatives considered**:
- Два отдельных контейнера (frontend + backend) — overengineering для SQLite + Mini App
- nginx для отдачи статики — не нужен, Django + whitenoise/gunicorn достаточно для масштаба проекта

## R2: Запуск бота и веб-сервера в одном контейнере

**Decision**: Использовать bash-скрипт `entrypoint.sh`, который запускает gunicorn в фоне и бота в foreground.

**Rationale**:
- Бот и Django используют одну базу (SQLite) — не может быть разных контейнеров с SQLite
- supervisord — лишняя зависимость для двух процессов
- Простой bash entrypoint: миграции → collectstatic → gunicorn (фон) → runbot (foreground)

**Alternatives considered**:
- docker-compose с двумя сервисами — невозможно с SQLite (file locking)
- supervisord — лишняя зависимость (принцип IV: YAGNI)

## R3: CI/CD через GitHub Actions

**Decision**: Один workflow файл `.github/workflows/deploy.yml`:
1. Trigger: push to main + workflow_dispatch
2. Job 1: Test (run backend tests)
3. Job 2: Build & Push (build Docker image, push to ghcr.io)
4. Job 3: Deploy (SSH to server, pull image, restart container)

**Rationale**:
- GitHub Actions — бесплатные минуты для публичных репо, интеграция с GitHub Secrets
- ghcr.io — нативный registry, не нужен Docker Hub
- SSH deploy — простейший способ для одного VPS

**Alternatives considered**:
- Docker Hub — нужна отдельная учетная запись
- Watchtower (автопулл новых образов) — скрытая сложность, неявное поведение
- rsync/scp вместо Docker — не даёт воспроизводимости

## R4: Управление секретами

**Decision**: GitHub Secrets → переменные окружения при docker run на сервере.

**Secrets list**:
- `SSH_HOST` — IP/домен сервера
- `SSH_USER` — пользователь для SSH
- `SSH_KEY` — приватный SSH-ключ
- `TELEGRAM_BOT_TOKEN` — токен бота
- `SECRET_KEY` — Django secret key
- `TELEGRAM_WEBAPP_URL` — URL Mini App
- `ALLOWED_HOSTS` — разрешенные хосты

**Rationale**: Секреты хранятся только в GitHub, никогда не попадают в образ или код.

## R5: Production WSGI-сервер

**Decision**: gunicorn с 2 воркерами.

**Rationale**:
- Стандартный production-сервер для Django
- 2 воркера достаточно для SQLite (не параллелит запись)
- whitenoise для отдачи статических файлов (встроен в Django middleware, не нужен nginx)

## R6: Concurrency и zero-downtime

**Decision**: Concurrency group в GitHub Actions + простой restart контейнера.

**Rationale**:
- Для одного VPS и маленького приложения zero-downtime не критичен
- Concurrency group: `deploy-production` — один деплой за раз
- cancel-in-progress: true — новый деплой отменяет предыдущий
