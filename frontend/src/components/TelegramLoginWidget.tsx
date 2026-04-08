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
}

export function TelegramLoginWidget({
  botUsername,
}: TelegramLoginWidgetProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!botUsername || !containerRef.current) return;

    const container = containerRef.current;
    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.async = true;
    script.setAttribute("data-telegram-login", botUsername);
    script.setAttribute("data-size", "large");
    script.setAttribute("data-radius", "12");
    script.setAttribute("data-userpic", "false");
    script.setAttribute("data-request-access", "write");
    script.setAttribute(
      "data-auth-url",
      `${window.location.origin}${window.location.pathname}`,
    );

    container.innerHTML = "";
    container.appendChild(script);

    return () => {
      container.innerHTML = "";
    };
  }, [botUsername]);

  return <div ref={containerRef} className="min-h-11" />;
}
