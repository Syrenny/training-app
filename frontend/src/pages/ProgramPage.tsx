import { useEffect, useState } from "react";
import { fetchWeekDetail, fetchWeeks } from "@/lib/api";
import type { WeekDetailData, WeekListItem } from "@/lib/api";
import { DayTabs } from "@/components/DayTabs";
import { WeekSelector } from "@/components/WeekSelector";

export function ProgramPage() {
  const [weeks, setWeeks] = useState<WeekListItem[]>([]);
  const [currentWeek, setCurrentWeek] = useState(1);
  const [weekData, setWeekData] = useState<WeekDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchWeeks()
      .then(setWeeks)
      .catch(() => setWeeks([]));
  }, []);

  useEffect(() => {
    setLoading(true);
    setError(null);

    fetchWeekDetail(currentWeek)
      .then((data) => {
        setWeekData(data);
        setLoading(false);
      })
      .catch(() => {
        setWeekData(null);
        setLoading(false);
        setError("Не удалось загрузить программу");
      });
  }, [currentWeek]);

  if (loading) {
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
      <h1 className="text-xl font-bold mb-4">Программа тренировок</h1>

      <WeekSelector
        weeks={weeks}
        currentWeek={currentWeek}
        onWeekChange={setCurrentWeek}
      />

      {weekData && <DayTabs days={weekData.days} />}
    </div>
  );
}
