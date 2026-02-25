# Research: 001-program-viewer

**Date**: 2026-02-25

## R1: Telegram Bot → Mini App Launch Pattern

**Decision**: `KeyboardButton` + `WebAppInfo` из `python-telegram-bot`

**Rationale**: Стандартный паттерн Telegram — бот отправляет клавиатуру
с кнопкой, которая открывает Web App внутри Telegram-клиента.
Простейший и надёжный способ для MVP.

**Alternatives considered**:
- InlineKeyboardButton с WebAppInfo — работает, но reply keyboard
  удобнее для постоянного доступа.
- Menu Button (BotFather) — можно добавить как дополнительную
  точку входа, но не заменяет /start.

## R2: Django + React Architecture

**Decision**: Django REST Framework (API) + React SPA (Vite),
собранный фронтенд подаётся через Django static files.
Единый деплой.

**Rationale**:
- Один сервер — проще ops для MVP.
- Нет проблем с CORS (API и фронтенд на одном домене).
- DRF предоставляет JSON API для программы тренировок.
- Vite собирает React в `backend/static/frontend/`,
  `index.html` → `backend/templates/index.html`.

**Alternatives considered**:
- Два отдельных сервера (frontend + backend) — избыточно для MVP.
- Django Templates (без React) — не даёт интерактивности
  и не использует shadcn/tailwind.
- Next.js — серверный рендеринг не нужен для Mini App.

## R3: python-telegram-bot

**Decision**: `python-telegram-bot` (latest stable v21+)

**Rationale**: Полная поддержка Bot API, включая WebAppInfo.
Активно поддерживается. Асинхронный по умолчанию.

## R4: Telegram initData Validation

**Decision**: HMAC-SHA256 валидация как DRF Authentication class.
Без внешних библиотек — ~15 строк Python (stdlib `hmac` + `hashlib`).

**Rationale**: initData приходит от Mini App, содержит `hash`.
Валидация через HMAC с bot token — стандарт Telegram.
Достаточно для MVP (один тип пользователя).

## R5: shadcn/ui в Telegram Mini App

**Decision**: shadcn/ui + Tailwind CSS с Telegram-специфичными
настройками viewport и темы.

**Rationale**: shadcn работает в Telegram Mini App.
Ключевые адаптации:
- `tg.expand()` при загрузке для полной высоты.
- CSS-переменная `--tg-viewport-height` вместо `100vh`.
- Синхронизация темы: `tg.colorScheme` → `dark` class.
- Маппинг `tg.themeParams` → CSS custom properties.
- `env(safe-area-inset-*)` для iOS.
- Один scrollable контейнер (без вложенных).

## R6: Storage

**Decision**: SQLite для MVP.

**Rationale**: Один пользователь-администратор вносит данные,
пользователи только читают. Нагрузка минимальная.
Миграция на PostgreSQL тривиальна через Django ORM.

**Alternatives considered**:
- PostgreSQL — избыточно для MVP с одним админом.
- Файловое хранение (JSON/YAML) — теряем Django Admin.
