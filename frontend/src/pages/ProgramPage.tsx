import { useEffect } from "react";
import { useProgramStore } from "@/lib/store";
import { DayTabs } from "@/components/DayTabs";
import { WeekSelector } from "@/components/WeekSelector";

export function ProgramPage() {
  const selectedWeek = useProgramStore((s) => s.selectedWeek);
  const loading = useProgramStore((s) => s.loading);
  const error = useProgramStore((s) => s.error);
  const weekDetailCache = useProgramStore((s) => s.weekDetailCache);
  const fetchWeeks = useProgramStore((s) => s.fetchWeeks);
  const fetchWeekDetail = useProgramStore((s) => s.fetchWeekDetail);

  useEffect(() => {
    fetchWeeks();
  }, [fetchWeeks]);

  useEffect(() => {
    if (selectedWeek !== null) {
      fetchWeekDetail(selectedWeek);
    }
  }, [selectedWeek, fetchWeekDetail]);

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
    <div className="px-4 py-4">
      <WeekSelector />

      {weekData && <DayTabs days={weekData.days} />}
    </div>
  );
}
