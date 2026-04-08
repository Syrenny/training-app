import { useEffect, useState, useRef } from "react";

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
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (!botUsername || !containerRef.current) return;

    const container = containerRef.current;
    const callbackName = callbackNameRef.current;
    const script = document.createElement("script");
    const windowWithCallback = window as typeof window & Record<string, unknown>;
    const observer = new MutationObserver(() => {
      if (container.querySelector("iframe")) {
        setIsReady(true);
      }
    });

    setIsReady(false);

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
    observer.observe(container, { childList: true, subtree: true });
    container.appendChild(script);

    return () => {
      observer.disconnect();
      delete windowWithCallback[callbackName];
      container.innerHTML = "";
    };
  }, [botUsername, onAuth]);

  return (
    <div className="relative min-h-11 min-w-[244px]">
      {!isReady ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : null}
      <div
        ref={containerRef}
        className={isReady ? "min-h-11" : "min-h-11 opacity-0"}
      />
    </div>
  );
}
