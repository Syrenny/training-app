import { useEffect, useRef } from "react";

export interface TelegramWidgetAuthData {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

interface TelegramLoginWidgetProps {
  botUsername: string;
  onAuth: (data: TelegramWidgetAuthData) => void;
}

export function TelegramLoginWidget({
  botUsername,
  onAuth,
}: TelegramLoginWidgetProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const callbackNameRef = useRef(`telegramLoginWidgetAuth_${Math.random().toString(36).slice(2)}`);

  useEffect(() => {
    if (!botUsername || !containerRef.current) return;

    const container = containerRef.current;
    const callbackName = callbackNameRef.current;
    const script = document.createElement("script");
    const windowWithCallback = window as typeof window & Record<string, unknown>;

    windowWithCallback[callbackName] = (user: TelegramWidgetAuthData) => {
      onAuth(user);
    };

    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.async = true;
    script.setAttribute("data-telegram-login", botUsername);
    script.setAttribute("data-size", "large");
    script.setAttribute("data-radius", "12");
    script.setAttribute("data-userpic", "false");
    script.setAttribute("data-request-access", "write");
    script.setAttribute("data-onauth", `${callbackName}(user)`);

    container.innerHTML = "";
    container.appendChild(script);

    return () => {
      delete windowWithCallback[callbackName];
      container.innerHTML = "";
    };
  }, [botUsername, onAuth]);

  return <div ref={containerRef} className="min-h-11" />;
}
