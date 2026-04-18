import type { AuthUser } from "@/lib/api";
import { useEffect } from "react";
import { useProgramStore } from "@/lib/store";
import { DayTabs } from "@/components/DayTabs";
import { InfoButton } from "@/components/InfoButton";
import { WeekSelector } from "@/components/WeekSelector";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ProgramPageProps {
  user: AuthUser | null;
}

export function ProgramPage({ user: _user }: ProgramPageProps) {
  const activeCycle = useProgramStore((s) => s.activeCycle);
  const selectedWeek = useProgramStore((s) => s.selectedWeek);
  const loading = useProgramStore((s) => s.loading);
  const error = useProgramStore((s) => s.error);
  const weekDetailCache = useProgramStore((s) => s.weekDetailCache);
  const fetchActiveCycle = useProgramStore((s) => s.fetchActiveCycle);
  const fetchProgram = useProgramStore((s) => s.fetchProgram);
  const fetchOneRepMax = useProgramStore((s) => s.fetchOneRepMax);
  const fetchCompletions = useProgramStore((s) => s.fetchCompletions);
  const fetchAccessoryWeights = useProgramStore((s) => s.fetchAccessoryWeights);

  useEffect(() => {
    fetchActiveCycle();
    fetchProgram();
    fetchOneRepMax();
    fetchCompletions();
    fetchAccessoryWeights();
  }, [fetchActiveCycle, fetchProgram, fetchOneRepMax, fetchCompletions, fetchAccessoryWeights]);

  const weekData = selectedWeek !== null ? weekDetailCache[selectedWeek] : null;

  if (loading && !weekData) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error && !weekData) {
    return (
      <p className="text-muted-foreground text-center py-16">
        Программа пока не добавлена
      </p>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {!activeCycle ? (
        <div className="px-4 pt-4">
          <Card>
            <CardHeader>
              <CardTitle>Активный цикл не запущен</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Сначала выберите программу, задайте 1ПМ и начните цикл во вкладке профиля.
            </CardContent>
          </Card>
        </div>
      ) : null}

      {activeCycle ? (
        <div className="px-4 pt-4 pb-2 text-sm text-muted-foreground">
          Цикл начат {new Date(activeCycle.started_at).toLocaleString("ru-RU")}
        </div>
      ) : null}

      <div className="pl-1 pr-2 pt-1 pb-1 shrink-0">
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <WeekSelector />
          </div>
          <InfoButton />
        </div>
      </div>

      <div className="flex flex-col flex-1 min-h-0 px-4">
        {activeCycle && weekData ? (
          <DayTabs weekNumber={weekData.number} days={weekData.days} />
        ) : null}
      </div>
    </div>
  );
}
