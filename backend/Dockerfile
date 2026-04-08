# syntax=docker/dockerfile:1.7

FROM ghcr.io/astral-sh/uv:python3.13-alpine AS base

ENV UV_LINK_MODE=copy \
    UV_COMPILE_BYTECODE=1 \
    UV_PYTHON_DOWNLOADS=0 \
    PATH="/app/.venv/bin:$PATH"

WORKDIR /app

FROM base AS deps

COPY pyproject.toml uv.lock ./
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-install-project

FROM deps AS dev

COPY . /app
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen

FROM deps AS prod

COPY . /app
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-dev

RUN SECRET_KEY=build-placeholder python manage.py collectstatic --noinput

EXPOSE 8000
