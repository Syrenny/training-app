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

export function initTelegram(): () => void {
  const tg = getTelegram();
  if (!tg || typeof tg.initData !== "string" || tg.initData.length === 0) {
    return () => {};
  }

  const handleViewportChange = () => syncViewport(tg);

  tg.ready();
  tg.expand();
  syncViewport(tg);
  tg.onEvent("viewportChanged", handleViewportChange);

  return () => {
    tg.offEvent?.("viewportChanged", handleViewportChange);
  };
}

function syncViewport(tg: TelegramWebApp): void {
  document.documentElement.style.setProperty(
    "--tg-viewport-height",
    `${tg.viewportStableHeight || tg.viewportHeight}px`
  );
}
