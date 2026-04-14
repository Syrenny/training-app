import type { AuthUser } from "@/lib/api";
import { useState } from "react";
import { LogOut, RotateCcw } from "lucide-react";
import { OneRepMaxPage } from "@/components/OneRepMaxPage";
import { useProgramStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface ProfilePageProps {
  user: AuthUser;
  onLogout: () => void;
}

function getInitial(userName?: string, username?: string) {
  const source = userName || username || "T";
  return source.trim().charAt(0).toUpperCase();
}

export function ProfilePage({ user, onLogout }: ProfilePageProps) {
  const fullName = [user.first_name, user.last_name].filter(Boolean).join(" ").trim();
  const resetCompletions = useProgramStore((s) => s.resetCompletions);
  const [resetNotice, setResetNotice] = useState<string | null>(null);

  async function handleResetCompletions() {
    await resetCompletions();
    setResetNotice("Отметки выполнения сброшены.");
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 px-4 pt-4">
        <h1 className="text-lg font-semibold">Профиль</h1>
      </div>

      <div className="hide-scrollbar min-h-0 flex-1 overflow-y-auto">
        <div className="space-y-4 px-4 py-4">
          <Card>
            <CardHeader>
              <CardTitle>Сессия Telegram</CardTitle>
              <CardDescription>Текущий аккаунт, через который открыт мини-апп.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-accent text-base font-semibold text-accent-foreground">
                  {user.telegram_photo_url ? (
                    <img
                      src={user.telegram_photo_url}
                      alt={fullName || user.telegram_username || "Пользователь Telegram"}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    getInitial(fullName, user.telegram_username || undefined)
                  )}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {fullName || "Пользователь Telegram"}
                  </p>
                  {user.telegram_username ? (
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      @{user.telegram_username}
                    </p>
                  ) : null}
                  {user.telegram_id ? (
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      ID: {user.telegram_id}
                    </p>
                  ) : null}
                </div>
              </div>

              <Button variant="outline" className="w-full" onClick={onLogout}>
                <LogOut className="h-4 w-4" />
                Выйти
              </Button>
            </CardContent>
          </Card>

          <OneRepMaxPage />

          <Card>
            <CardHeader>
              <CardTitle>Отметки выполнения</CardTitle>
              <CardDescription>
                Отметки привязаны только к номеру недели и дню недели. После сильных
                изменений программы их можно обнулить здесь.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Если структура тренировок изменилась, старые отметки могут больше не
                совпадать с текущей программой.
              </p>
              <Button variant="outline" className="w-full" onClick={handleResetCompletions}>
                <RotateCcw className="h-4 w-4" />
                Сбросить отметки выполнения
              </Button>
              {resetNotice ? (
                <p className="text-sm text-muted-foreground">{resetNotice}</p>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
