import type { AuthUser } from "@/lib/api";
import { useEffect } from "react";
import { useProgramStore } from "@/lib/store";
import { DayTabs } from "@/components/DayTabs";
import { InfoButton } from "@/components/InfoButton";
import { Sidebar } from "@/components/Sidebar";
import { WeekSelector } from "@/components/WeekSelector";

interface ProgramPageProps {
  user: AuthUser | null;
  onLogout: () => void;
}

export function ProgramPage({ user, onLogout }: ProgramPageProps) {
  const selectedWeek = useProgramStore((s) => s.selectedWeek);
  const loading = useProgramStore((s) => s.loading);
  const error = useProgramStore((s) => s.error);
  const weekDetailCache = useProgramStore((s) => s.weekDetailCache);
  const fetchWeeks = useProgramStore((s) => s.fetchWeeks);
  const fetchWeekDetail = useProgramStore((s) => s.fetchWeekDetail);
  const fetchOneRepMax = useProgramStore((s) => s.fetchOneRepMax);
  const fetchCompletions = useProgramStore((s) => s.fetchCompletions);
  const fetchAccessoryWeights = useProgramStore((s) => s.fetchAccessoryWeights);

  useEffect(() => {
    fetchWeeks();
    fetchOneRepMax();
    fetchCompletions();
    fetchAccessoryWeights();
  }, [fetchWeeks, fetchOneRepMax, fetchCompletions, fetchAccessoryWeights]);

  useEffect(() => {
    if (selectedWeek !== null) {
      fetchWeekDetail(selectedWeek);
    }
  }, [selectedWeek, fetchWeekDetail]);

  const weekData = selectedWeek !== null ? weekDetailCache[selectedWeek] : null;
  const fullName = [user?.first_name, user?.last_name].filter(Boolean).join(" ").trim();

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
        <div className="flex items-center gap-2">
          <Sidebar
            userName={fullName || user?.first_name || user?.telegram_username || undefined}
            username={user?.telegram_username || undefined}
            photoUrl={user?.telegram_photo_url || undefined}
            onLogout={onLogout}
          />
          <div className="flex-1">
            <WeekSelector />
          </div>
          <InfoButton />
        </div>
      </div>

      <div className="flex flex-col flex-1 min-h-0 px-4 pb-4">
        {weekData && <DayTabs days={weekData.days} />}
      </div>
    </div>
  );
}
