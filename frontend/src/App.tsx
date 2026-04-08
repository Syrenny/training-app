import { useEffect, useState } from "react";
import type { AuthUser } from "@/lib/api";
import type { TelegramWidgetAuthData } from "@/lib/api";
import { fetchSession, loginWithTelegram, logoutSession } from "@/lib/api";
import { getTelegram, initTelegram, isTelegramContext } from "@/lib/telegram";
import { ProgramPage } from "@/pages/ProgramPage";
import { UnauthorizedScreen } from "@/components/UnauthorizedScreen";

const DEV_MODE = import.meta.env.VITE_DEV_MODE === "true";
type AuthState = "loading" | "authenticated" | "unauthenticated";

function App() {
  const [authState, setAuthState] = useState<AuthState>("loading");
  const [user, setUser] = useState<AuthUser | null>(null);
  const [botUsername, setBotUsername] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authResetKey, setAuthResetKey] = useState(0);

  const inTelegram = isTelegramContext();

  useEffect(() => {
    initTelegram();
  }, []);

  useEffect(() => {
    let mounted = true;

    async function bootstrapAuth() {
      try {
        const params = new URLSearchParams(window.location.search);
        const widgetAuthData = params.get("hash")
          ? {
              id: Number(params.get("id")),
              first_name: params.get("first_name") ?? undefined,
              last_name: params.get("last_name") ?? undefined,
              username: params.get("username") ?? undefined,
              photo_url: params.get("photo_url") ?? undefined,
              auth_date: Number(params.get("auth_date")),
              hash: params.get("hash") ?? "",
            }
          : null;

        if (widgetAuthData?.id && widgetAuthData.hash && widgetAuthData.auth_date) {
          const auth = await loginWithTelegram(undefined, widgetAuthData);
          if (!mounted) return;
          setUser(auth.user);
          setBotUsername(auth.telegram_bot_username ?? "");
          setAuthError(null);
          setAuthState("authenticated");
          window.history.replaceState({}, document.title, window.location.pathname);
          return;
        }

        const session = await fetchSession();
        if (!mounted) return;
        setBotUsername(session.telegram_bot_username ?? "");

        if (session.authenticated && session.user) {
          setUser(session.user);
          setAuthState("authenticated");
          return;
        }

        const tg = getTelegram();
        if (DEV_MODE || tg?.initData) {
          const auth = await loginWithTelegram(tg?.initData);
          if (!mounted) return;
          setUser(auth.user);
          setBotUsername(auth.telegram_bot_username ?? "");
          setAuthError(null);
          setAuthState("authenticated");
          return;
        }

        setAuthState("unauthenticated");
      } catch {
        if (!mounted) return;
        setAuthError("Не удалось выполнить вход. Проверьте доступ к Telegram и повторите попытку.");
        setAuthState("unauthenticated");
      }
    }

    bootstrapAuth();
    return () => {
      mounted = false;
    };
  }, []);

  async function handleLogin() {
    setAuthState("loading");
    setAuthError(null);
    try {
      const tg = getTelegram();
      const auth = await loginWithTelegram(tg?.initData);
      setUser(auth.user);
      setBotUsername(auth.telegram_bot_username ?? "");
      setAuthState("authenticated");
    } catch {
      setAuthError("Вход через Telegram не удался.");
      setAuthState("unauthenticated");
    }
  }

  async function handleWidgetAuth(authData: TelegramWidgetAuthData) {
    setAuthState("loading");
    setAuthError(null);
    try {
      const auth = await loginWithTelegram(undefined, authData);
      setUser(auth.user);
      setBotUsername(auth.telegram_bot_username ?? "");
      setAuthState("authenticated");
    } catch {
      setAuthError("Вход через Telegram не удался.");
      setAuthState("unauthenticated");
      setAuthResetKey((value) => value + 1);
    }
  }

  async function handleLogout() {
    try {
      await logoutSession();
    } finally {
      setUser(null);
      setAuthError(null);
      setAuthResetKey((value) => value + 1);
      setAuthState("unauthenticated");
    }
  }

  if (inTelegram && authState !== "authenticated") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Загрузка...</p>
        </div>
      </div>
    );
  }

  if (authState !== "authenticated" || !user) {
    return (
      <UnauthorizedScreen
        inTelegram={inTelegram}
        devMode={DEV_MODE}
        botUsername={botUsername}
        resetKey={authResetKey}
        loading={authState === "loading"}
        error={authError}
        onLogin={handleLogin}
        onWidgetAuth={handleWidgetAuth}
      />
    );
  }

  return (
    <div
      className="h-dvh bg-background text-foreground flex flex-col"
      style={{
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      <ProgramPage user={user} onLogout={handleLogout} />
    </div>
  );
}

export default App;
