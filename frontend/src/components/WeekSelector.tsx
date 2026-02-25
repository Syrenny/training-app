import { useProgramStore } from "@/lib/store";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function WeekSelector() {
  const weeks = useProgramStore((s) => s.weeks);
  const selectedWeek = useProgramStore((s) => s.selectedWeek);
  const setWeek = useProgramStore((s) => s.setWeek);

  if (weeks.length === 0) return null;

  return (
    <div>
      <Select
        value={selectedWeek?.toString() ?? ""}
        onValueChange={(v) => setWeek(Number(v))}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Выберите неделю" />
        </SelectTrigger>
        <SelectContent>
          {weeks.map((week) => (
            <SelectItem key={week.id} value={week.number.toString()}>
              {week.title || `Неделя ${week.number}`}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
