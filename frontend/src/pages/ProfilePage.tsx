import type { AuthUser } from "@/lib/api";
import { useEffect, useState } from "react";
import { LogOut, RotateCcw } from "lucide-react";
import { OneRepMaxPage } from "@/components/OneRepMaxPage";
import { useProgramStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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
  const programs = useProgramStore((s) => s.programs);
  const selectedProgram = useProgramStore((s) => s.selectedProgram);
  const fetchPrograms = useProgramStore((s) => s.fetchPrograms);
  const fetchProgram = useProgramStore((s) => s.fetchProgram);
  const selectProgram = useProgramStore((s) => s.selectProgram);
  const resetCompletions = useProgramStore((s) => s.resetCompletions);
  const [resetNotice, setResetNotice] = useState<string | null>(null);
  const [programNotice, setProgramNotice] = useState<string | null>(null);

  useEffect(() => {
    void Promise.all([fetchPrograms(), fetchProgram()]);
  }, [fetchPrograms, fetchProgram]);

  async function handleResetCompletions() {
    await resetCompletions();
    setResetNotice("Отметки выполнения сброшены.");
  }

  async function handleProgramChange(value: string) {
    await selectProgram(Number(value));
    setProgramNotice("Программа переключена.");
    setResetNotice(null);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="hide-scrollbar min-h-0 flex-1 overflow-y-auto">
        <div className="space-y-4 px-4 py-4">
          <Card>
            <CardHeader>
              <CardTitle>Сессия Telegram</CardTitle>
            </CardHeader>
            <CardContent>
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
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {fullName || "Пользователь Telegram"}
                  </p>
                  {user.telegram_username ? (
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      @{user.telegram_username}
                    </p>
                  ) : null}
                </div>
                <Button variant="ghost" size="sm" onClick={onLogout}>
                  <LogOut className="h-4 w-4" />
                  Выйти
                </Button>
              </div>
            </CardContent>
          </Card>

          <OneRepMaxPage />

          <Card>
            <CardHeader>
              <CardTitle>Программа</CardTitle>
              <CardDescription>
                Выбранная программа используется на главном экране и для отметок выполнения.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Select
                value={selectedProgram ? String(selectedProgram.id) : undefined}
                onValueChange={handleProgramChange}
                disabled={programs.length === 0}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Выберите программу" />
                </SelectTrigger>
                <SelectContent>
                  {programs.map((program) => (
                    <SelectItem key={program.id} value={String(program.id)}>
                      {program.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedProgram?.description ? (
                <p className="text-sm text-muted-foreground">{selectedProgram.description}</p>
              ) : null}
              {programNotice ? (
                <p className="text-sm text-muted-foreground">{programNotice}</p>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <CardTitle className="flex-1">Отметки выполнения</CardTitle>
                <Button variant="ghost" size="sm" onClick={handleResetCompletions}>
                  <RotateCcw className="h-4 w-4" />
                  Сбросить
                </Button>
              </div>
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
