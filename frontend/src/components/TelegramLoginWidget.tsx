import { useEffect, useId, useRef } from "react";

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

declare global {
  interface Window {
    [key: string]: ((user: TelegramWidgetAuthData) => void) | undefined;
  }
}

export function TelegramLoginWidget({
  botUsername,
  onAuth,
}: TelegramLoginWidgetProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const callbackId = useId().replace(/:/g, "");

  useEffect(() => {
    if (!botUsername || !containerRef.current) return;

    const callbackName = `telegramLoginCallback_${callbackId}`;
    window[callbackName] = (user: TelegramWidgetAuthData) => {
      onAuth(user);
    };

    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.async = true;
    script.setAttribute("data-telegram-login", botUsername);
    script.setAttribute("data-size", "large");
    script.setAttribute("data-radius", "12");
    script.setAttribute("data-userpic", "false");
    script.setAttribute("data-request-access", "write");
    script.setAttribute("data-onauth", `${callbackName}(user)`);

    containerRef.current.innerHTML = "";
    containerRef.current.appendChild(script);

    return () => {
      delete window[callbackName];
    };
  }, [botUsername, callbackId, onAuth]);

  return <div ref={containerRef} className="min-h-11" />;
}
