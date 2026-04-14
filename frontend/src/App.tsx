import { useEffect, useState } from "react";
import type { AuthUser } from "@/lib/api";
import type { TelegramWidgetAuthData } from "@/lib/api";
import { fetchSession, loginWithTelegram, logoutSession } from "@/lib/api";
import { getTelegram, initTelegram, isTelegramContext } from "@/lib/telegram";
import { ProgramPage } from "@/pages/ProgramPage";
import { ProgramEditPage } from "@/pages/ProgramEditPage";
import { ProfilePage } from "@/pages/ProfilePage";
import { BottomTabBar, type AppTab } from "@/components/BottomTabBar";
import { UnauthorizedScreen } from "@/components/UnauthorizedScreen";

const DEV_MODE = import.meta.env.VITE_DEV_MODE === "true";
const AUTH_CACHE_KEY = "training-app-auth-user";
const TAB_CACHE_KEY = "training-app-active-tab";
type AuthState = "loading" | "authenticated" | "unauthenticated";

function LoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
      <div className="flex flex-col items-center gap-4">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="text-sm text-muted-foreground">Загрузка...</p>
      </div>
    </div>
  );
}

function loadCachedUser(): AuthUser | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.sessionStorage.getItem(AUTH_CACHE_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

function cacheUser(user: AuthUser | null) {
  if (typeof window === "undefined") {
    return;
  }

  if (!user) {
    window.sessionStorage.removeItem(AUTH_CACHE_KEY);
    return;
  }

  window.sessionStorage.setItem(AUTH_CACHE_KEY, JSON.stringify(user));
}

function loadCachedTab(): AppTab {
  if (typeof window === "undefined") {
    return "home";
  }

  const raw = window.sessionStorage.getItem(TAB_CACHE_KEY);
  return raw === "home" || raw === "editor" || raw === "profile" ? raw : "home";
}

function cacheTab(tab: AppTab) {
  if (typeof window === "undefined") {
    return;
  }
  window.sessionStorage.setItem(TAB_CACHE_KEY, tab);
}

function App() {
  const initialTab = loadCachedTab();
  const [user, setUser] = useState<AuthUser | null>(() => loadCachedUser());
  const [authState, setAuthState] = useState<AuthState>(() =>
    loadCachedUser() ? "authenticated" : "loading",
  );
  const [screen, setScreen] = useState<AppTab>(initialTab);
  const [editorMounted, setEditorMounted] = useState(initialTab === "editor");
  const [botUsername, setBotUsername] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authResetKey, setAuthResetKey] = useState(0);

  const inTelegram = isTelegramContext();

  useEffect(() => {
    return initTelegram();
  }, []);

  useEffect(() => {
    cacheTab(screen);
  }, [screen]);

  useEffect(() => {
    if (screen === "editor") {
      setEditorMounted(true);
    }
  }, [screen]);

  useEffect(() => {
    let mounted = true;

    async function bootstrapAuth() {
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
        try {
          const auth = await loginWithTelegram(undefined, widgetAuthData);
          if (!mounted) return;
          setUser(auth.user);
          cacheUser(auth.user);
          setBotUsername(auth.telegram_bot_username ?? "");
          setAuthError(null);
          setAuthState("authenticated");
          window.history.replaceState({}, document.title, window.location.pathname);
          return;
        } catch {
          if (!mounted) return;
          setAuthError("Вход через Telegram не удался.");
          setAuthState("unauthenticated");
          return;
        }
      }

      try {
        const session = await fetchSession();
        if (!mounted) return;
        setBotUsername(session.telegram_bot_username ?? "");

        if (session.authenticated && session.user) {
          setUser(session.user);
          cacheUser(session.user);
          setAuthState("authenticated");
          return;
        }

        cacheUser(null);
      } catch {
        if (!mounted) return;
        setBotUsername("");
      }

      try {
        const tg = getTelegram();
        if (DEV_MODE || tg?.initData) {
          const auth = await loginWithTelegram(tg?.initData);
          if (!mounted) return;
          setUser(auth.user);
          cacheUser(auth.user);
          setBotUsername(auth.telegram_bot_username ?? "");
          setAuthError(null);
          setAuthState("authenticated");
          return;
        }
      } catch {
        if (!mounted) return;
        if (inTelegram || DEV_MODE) {
          setAuthError("Не удалось выполнить вход. Проверьте доступ к Telegram и повторите попытку.");
        }
      }

      if (!mounted) return;
      setUser(null);
      cacheUser(null);
      setAuthState("unauthenticated");
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
      cacheUser(auth.user);
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
      cacheUser(auth.user);
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
      setScreen("home");
      setUser(null);
      cacheUser(null);
      cacheTab("home");
      setAuthError(null);
      setAuthResetKey((value) => value + 1);
      setAuthState("unauthenticated");
    }
  }

  if (authState === "loading") {
    return <LoadingScreen />;
  }

  if (authState !== "authenticated" || !user) {
    return (
      <UnauthorizedScreen
        inTelegram={inTelegram}
        devMode={DEV_MODE}
        botUsername={botUsername}
        resetKey={authResetKey}
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
      }}
    >
      <div className="min-h-0 flex flex-1 flex-col overflow-hidden">
        <div className={screen === "home" ? "flex min-h-0 flex-1 flex-col" : "hidden"}>
          <ProgramPage user={user} />
        </div>
        {editorMounted ? (
          <div className={screen === "editor" ? "flex min-h-0 flex-1 flex-col" : "hidden"}>
            <ProgramEditPage />
          </div>
        ) : null}
        <div className={screen === "profile" ? "flex min-h-0 flex-1 flex-col" : "hidden"}>
          <ProfilePage user={user} onLogout={handleLogout} />
        </div>
      </div>
      <BottomTabBar activeTab={screen} onChange={setScreen} />
    </div>
  );
}

export default App;
