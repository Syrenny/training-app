import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ExerciseList } from "./ExerciseList";
import { useProgramStore } from "@/lib/store";
import type { DayData } from "@/lib/api";

interface DayTabsProps {
  days: DayData[];
}

export function DayTabs({ days }: DayTabsProps) {
  const selectedDay = useProgramStore((s) => s.selectedDay);
  const setDay = useProgramStore((s) => s.setDay);

  if (days.length === 0) {
    return (
      <p className="text-muted-foreground text-center py-8">
        Нет тренировочных дней
      </p>
    );
  }

  const validDay = days.find((d) => d.weekday === selectedDay);
  const activeDay = validDay ? selectedDay! : days[0]?.weekday;

  return (
    <Tabs value={activeDay} onValueChange={setDay}>
      <TabsList className="w-full">
        {days.map((day) => (
          <TabsTrigger
            key={day.weekday}
            value={day.weekday}
            className="flex-1 text-base"
          >
            {day.weekday_display}
          </TabsTrigger>
        ))}
      </TabsList>
      {days.map((day) => (
        <TabsContent key={day.weekday} value={day.weekday} className="mt-4">
          <ExerciseList exercises={day.exercises} />
        </TabsContent>
      ))}
    </Tabs>
  );
}
