import { Menu } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { OneRepMaxPage } from "./OneRepMaxPage";

interface SidebarProps {
  userName?: string;
  username?: string;
  photoUrl?: string;
  onLogout?: () => void;
}

function getInitial(userName?: string, username?: string) {
  const source = userName || username || "T";
  return source.trim().charAt(0).toUpperCase();
}

export function Sidebar({ userName, username, photoUrl, onLogout }: SidebarProps) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <button
          className="inline-flex items-center justify-center rounded-md h-9 w-9 border border-input bg-background hover:bg-accent hover:text-accent-foreground"
          aria-label="Открыть меню"
        >
          <Menu className="h-5 w-5" />
        </button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72">
        <SheetHeader>
          <SheetTitle>Разовые максимумы</SheetTitle>
        </SheetHeader>
        <div className="px-4 space-y-6">
          <OneRepMaxPage />
          <div className="rounded-xl border border-border p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Сессия
            </p>
            <div className="mt-3 flex items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-accent text-sm font-semibold text-accent-foreground">
                {photoUrl ? (
                  <img
                    src={photoUrl}
                    alt={userName || username || "Пользователь Telegram"}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  getInitial(userName, username)
                )}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {userName || "Пользователь Telegram"}
                </p>
                {username ? (
                  <p className="mt-1 truncate text-xs text-muted-foreground">
                    @{username}
                  </p>
                ) : null}
              </div>
            </div>
            {onLogout ? (
              <button
                type="button"
                onClick={onLogout}
                className="mt-4 inline-flex h-9 w-full items-center justify-center rounded-md border border-input bg-background px-3 text-sm hover:bg-accent hover:text-accent-foreground"
              >
                Выйти
              </button>
            ) : null}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
