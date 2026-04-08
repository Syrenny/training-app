import { useEffect, useState } from "react";
import { TelegramLoginWidget } from "./TelegramLoginWidget";

interface UnauthorizedScreenProps {
  inTelegram: boolean;
  devMode?: boolean;
  botUsername?: string;
  resetKey?: number;
  loading?: boolean;
  error?: string | null;
  onLogin?: () => void;
}

export function UnauthorizedScreen({
  inTelegram,
  devMode = false,
  botUsername,
  resetKey = 0,
  loading = false,
  error = null,
  onLogin,
}: UnauthorizedScreenProps) {
  const [widgetVisible, setWidgetVisible] = useState(false);

  useEffect(() => {
    setWidgetVisible(false);
  }, [resetKey]);

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
        ) : botUsername ? (
          widgetVisible ? (
            <div className="mt-6 flex flex-col items-center gap-3">
              <TelegramLoginWidget
                key={`${botUsername}-${resetKey}`}
                botUsername={botUsername}
              />
              <button
                type="button"
                onClick={() => setWidgetVisible(false)}
                className="text-sm text-muted-foreground transition hover:text-foreground"
              >
                Начать вход заново
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setWidgetVisible(true)}
              className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
            >
              Войти через Telegram
            </button>
          )
        ) : (
          <p className="mt-6 text-sm text-muted-foreground">
            Telegram Login пока не настроен: укажите `TELEGRAM_BOT_USERNAME`.
          </p>
        )}
      </div>
    </div>
  );
}
