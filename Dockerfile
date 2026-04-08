# Stage 1: Build frontend
FROM node:22-slim AS frontend-builder

WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Stage 2: Python runtime base
FROM python:3.13-slim AS python-base

WORKDIR /app

# Install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

# Install Python dependencies
COPY backend/pyproject.toml backend/uv.lock ./
RUN uv sync --frozen --no-dev

# Copy backend source
COPY backend/ ./

# Copy built frontend from stage 1
COPY --from=frontend-builder /app/backend/static/frontend/ ./static/frontend/
RUN mkdir -p ./templates && cp ./static/frontend/index.html ./templates/index.html

# Collect static files
RUN SECRET_KEY=build-placeholder uv run python manage.py collectstatic --noinput

# Create db directory for volume mount
RUN mkdir -p /app/db

FROM python-base AS web
COPY docker/web-entrypoint.sh /app/web-entrypoint.sh
RUN chmod +x /app/web-entrypoint.sh

EXPOSE 8000
ENTRYPOINT ["/app/web-entrypoint.sh"]

FROM python-base AS bot
COPY docker/bot-entrypoint.sh /app/bot-entrypoint.sh
RUN chmod +x /app/bot-entrypoint.sh
ENTRYPOINT ["/app/bot-entrypoint.sh"]

FROM nginx:1.27-alpine AS frontend-static
COPY docker/frontend-static.conf /etc/nginx/conf.d/default.conf
COPY --from=frontend-builder /app/backend/static/frontend/ /usr/share/nginx/html/
