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
  offEvent?: (event: string, callback: (...args: unknown[]) => void) => void;
}

export function isAuthorized(): boolean {
  const tg = getTelegram();
  return tg !== null && tg.initData !== "";
}

export function isTelegramContext(): boolean {
  const tg = getTelegram();
  return tg !== null && typeof tg.initData === "string" && tg.initData.length > 0;
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

  const handleViewportChange = () => syncViewport(tg);

  tg.ready();
  tg.expand();
  syncViewport(tg);
  tg.onEvent("viewportChanged", handleViewportChange);

  const tp = tg.themeParams;
  const root = document.documentElement;
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
