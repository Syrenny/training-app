import { getTelegram } from "./telegram";

export type AppTheme = "light" | "dark";

const DARK_THEME_COLOR = "#111111";
const LIGHT_THEME_COLOR = "#ffffff";

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof document !== "undefined";
}

export function getSystemTheme(): AppTheme {
  if (!isBrowser()) return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function getTelegramTheme(): AppTheme | null {
  const telegram = getTelegram();
  if (!telegram || typeof telegram.initData !== "string" || telegram.initData.length === 0) {
    return null;
  }
  return telegram.colorScheme === "dark" ? "dark" : "light";
}

export function getPreferredTheme(): AppTheme {
  return getTelegramTheme() ?? getSystemTheme();
}

export function applyThemeDocumentState(theme: AppTheme): void {
  if (!isBrowser()) return;

  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.style.colorScheme = theme;

  const themeColor = document.querySelector('meta[name="theme-color"]');
  if (themeColor) {
    themeColor.setAttribute(
      "content",
      theme === "dark" ? DARK_THEME_COLOR : LIGHT_THEME_COLOR,
    );
  }
}

export function subscribeToThemeChanges(
  onThemeChange: (theme: AppTheme) => void,
): () => void {
  if (!isBrowser()) {
    return () => {};
  }

  const telegram = getTelegram();
  if (telegram && typeof telegram.initData === "string" && telegram.initData.length > 0) {
    const handleTelegramThemeChange = () => {
      onThemeChange(telegram.colorScheme === "dark" ? "dark" : "light");
    };

    telegram.onEvent("themeChanged", handleTelegramThemeChange);
    return () => {
      telegram.offEvent?.("themeChanged", handleTelegramThemeChange);
    };
  }

  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const handleMediaChange = (event: MediaQueryListEvent) => {
    onThemeChange(event.matches ? "dark" : "light");
  };

  if (typeof media.addEventListener === "function") {
    media.addEventListener("change", handleMediaChange);
    return () => {
      media.removeEventListener("change", handleMediaChange);
    };
  }

  media.addListener(handleMediaChange);
  return () => {
    media.removeListener(handleMediaChange);
  };
}
