declare global {
  interface Window {
    Telegram: {
      WebApp: TelegramWebApp;
    };
  }
}

interface TelegramWebApp {
  ready: () => void;
  expand: () => void;
  close: () => void;
  initData: string;
  initDataUnsafe: Record<string, unknown>;
  colorScheme: "light" | "dark";
  themeParams: Record<string, string>;
  viewportHeight: number;
  viewportStableHeight: number;
  onEvent: (event: string, callback: (...args: unknown[]) => void) => void;
}

export function getTelegram(): TelegramWebApp | null {
  if (typeof window !== "undefined" && window.Telegram?.WebApp) {
    return window.Telegram.WebApp;
  }
  return null;
}

export function initTelegram(): void {
  const tg = getTelegram();
  if (!tg) return;

  tg.ready();
  tg.expand();

  syncTheme(tg);
  syncViewport(tg);

  tg.onEvent("themeChanged", () => syncTheme(tg));
  tg.onEvent("viewportChanged", () => syncViewport(tg));
}

function syncTheme(tg: TelegramWebApp): void {
  const root = document.documentElement;

  if (tg.colorScheme === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }

  const tp = tg.themeParams;
  if (tp.bg_color) root.style.setProperty("--tg-bg-color", tp.bg_color);
  if (tp.text_color) root.style.setProperty("--tg-text-color", tp.text_color);
  if (tp.hint_color) root.style.setProperty("--tg-hint-color", tp.hint_color);
  if (tp.button_color)
    root.style.setProperty("--tg-button-color", tp.button_color);
  if (tp.button_text_color)
    root.style.setProperty("--tg-button-text-color", tp.button_text_color);
}

function syncViewport(tg: TelegramWebApp): void {
  document.documentElement.style.setProperty(
    "--tg-viewport-height",
    `${tg.viewportStableHeight || tg.viewportHeight}px`
  );
}
