import type { AuthUser } from "@/lib/api";
import { useEffect } from "react";
import { useProgramStore } from "@/lib/store";
import { DayTabs } from "@/components/DayTabs";
import { InfoButton } from "@/components/InfoButton";
import { PageHeaderOverlay } from "@/components/PageHeaderOverlay";
import { WeekSelector } from "@/components/WeekSelector";

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
  const hasOverlayHeader = Boolean(weekData);

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
    <div className="relative flex flex-col flex-1 min-h-0">
      {hasOverlayHeader ? (
        <PageHeaderOverlay contentClassName="flex items-center gap-2">
          <div className="flex-1">
            <WeekSelector />
          </div>
          <InfoButton />
        </PageHeaderOverlay>
      ) : (
        <div className="px-4 py-3 shrink-0">
          <div className="glass-surface flex items-center gap-2 rounded-full px-3 py-2">
            <div className="flex-1">
              <WeekSelector />
            </div>
            <InfoButton />
          </div>
        </div>
      )}

      <div
        className={`flex flex-col flex-1 min-h-0 px-4`}
      >
        {weekData ? (
          <DayTabs
            weekNumber={weekData.number}
            days={weekData.days}
            showCompletionControls={Boolean(activeCycle)}
          />
        ) : null}
      </div>
    </div>
  );
}
