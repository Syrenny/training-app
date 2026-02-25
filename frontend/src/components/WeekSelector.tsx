import type { WeekListItem } from "@/lib/api";

interface WeekSelectorProps {
  weeks: WeekListItem[];
  currentWeek: number;
  onWeekChange: (weekNumber: number) => void;
}

export function WeekSelector({
  weeks,
  currentWeek,
  onWeekChange,
}: WeekSelectorProps) {
  if (weeks.length <= 1) return null;

  return (
    <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
      {weeks.map((week) => (
        <button
          key={week.id}
          onClick={() => onWeekChange(week.number)}
          className={`min-h-[44px] min-w-[44px] px-4 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
            currentWeek === week.number
              ? "bg-primary text-primary-foreground"
              : "bg-secondary text-secondary-foreground"
          }`}
        >
          {week.title || `Неделя ${week.number}`}
        </button>
      ))}
    </div>
  );
}
