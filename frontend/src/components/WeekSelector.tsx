import { useProgramStore } from "@/lib/store";
import { WeekPicker } from "@/components/WeekPicker";

export function WeekSelector() {
  const weeks = useProgramStore((s) => s.weeks);
  const selectedWeek = useProgramStore((s) => s.selectedWeek);
  const setWeek = useProgramStore((s) => s.setWeek);

  if (weeks.length === 0) return null;

  return (
    <WeekPicker
      items={weeks}
      selectedNumber={selectedWeek}
      onSelect={setWeek}
    />
  );
}
