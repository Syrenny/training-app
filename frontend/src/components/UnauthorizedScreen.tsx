import type { TelegramWidgetAuthData } from "@/lib/api";
import { TelegramLoginWidget } from "./TelegramLoginWidget";

interface UnauthorizedScreenProps {
  inTelegram: boolean;
  devMode?: boolean;
  botUsername?: string;
  resetKey?: number;
  loading?: boolean;
  error?: string | null;
  onLogin?: () => void;
  onWidgetAuth?: (data: TelegramWidgetAuthData) => void;
}

export function UnauthorizedScreen({
  inTelegram,
  devMode = false,
  botUsername,
  resetKey = 0,
  loading = false,
  error = null,
  onLogin,
  onWidgetAuth,
}: UnauthorizedScreenProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6 text-foreground">
      <div className="w-full max-w-md rounded-3xl border border-border bg-card p-8 shadow-sm">
        <div className="space-y-3">
          <h1 className="text-3xl font-semibold leading-tight">
            Вход через Telegram
          </h1>
        </div>

        <div className="mt-6 rounded-2xl bg-muted/60 p-4 text-sm leading-6 text-muted-foreground">
          {devMode
            ? "Приложение запущено в dev-режиме. Можно войти локально без Telegram Mini App."
            : inTelegram
            ? "Вы открыли приложение внутри Telegram. Можно создать локальную сессию и продолжить работу."
            : "Сейчас вы вне Telegram. Вход можно выполнить через стандартный Telegram Login на этой странице."}
        </div>

        {error ? (
          <p className="mt-4 text-sm text-destructive">{error}</p>
        ) : null}

        {inTelegram || devMode ? (
          <button
            type="button"
            onClick={onLogin}
            disabled={loading}
            className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Входим..." : devMode ? "Войти в dev-режиме" : "Войти через Telegram"}
          </button>
        ) : botUsername && onWidgetAuth ? (
          <div className="mt-6 flex justify-center">
            <TelegramLoginWidget
              key={`${botUsername}-${resetKey}`}
              botUsername={botUsername}
              onAuth={onWidgetAuth}
            />
          </div>
        ) : (
          <p className="mt-6 text-sm text-muted-foreground">
            Telegram Login пока не настроен: укажите `TELEGRAM_BOT_USERNAME`.
          </p>
        )}
      </div>
    </div>
  );
}
