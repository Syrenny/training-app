import type { AuthUser } from "@/lib/api";
import { useEffect } from "react";
import { useProgramStore } from "@/lib/store";
import { DayTabs } from "@/components/DayTabs";
import { InfoButton } from "@/components/InfoButton";
import { WeekSelector } from "@/components/WeekSelector";

interface ProgramPageProps {
  user: AuthUser | null;
}

export function ProgramPage({ user: _user }: ProgramPageProps) {
  const selectedWeek = useProgramStore((s) => s.selectedWeek);
  const selectedProgram = useProgramStore((s) => s.selectedProgram);
  const loading = useProgramStore((s) => s.loading);
  const error = useProgramStore((s) => s.error);
  const weekDetailCache = useProgramStore((s) => s.weekDetailCache);
  const fetchProgram = useProgramStore((s) => s.fetchProgram);
  const fetchOneRepMax = useProgramStore((s) => s.fetchOneRepMax);
  const fetchCompletions = useProgramStore((s) => s.fetchCompletions);
  const fetchAccessoryWeights = useProgramStore((s) => s.fetchAccessoryWeights);

  useEffect(() => {
    fetchProgram();
    fetchOneRepMax();
    fetchCompletions();
    fetchAccessoryWeights();
  }, [fetchProgram, fetchOneRepMax, fetchCompletions, fetchAccessoryWeights]);

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
      <div className="px-4 pt-4 pb-4 shrink-0">
        {selectedProgram ? (
          <p className="mb-2 text-sm font-medium text-muted-foreground">
            {selectedProgram.name}
          </p>
        ) : null}
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <WeekSelector />
          </div>
          <InfoButton />
        </div>
      </div>

      <div className="flex flex-col flex-1 min-h-0 px-4 pb-4">
        {weekData && <DayTabs weekNumber={weekData.number} days={weekData.days} />}
      </div>
    </div>
  );
}
