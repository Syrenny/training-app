import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ExerciseList } from "./ExerciseList";
import type { DayData } from "@/lib/api";

interface DayTabsProps {
  days: DayData[];
}

export function DayTabs({ days }: DayTabsProps) {
  if (days.length === 0) {
    return (
      <p className="text-muted-foreground text-center py-8">
        Нет тренировочных дней
      </p>
    );
  }

  const defaultDay = days[0]?.weekday;

  return (
    <Tabs defaultValue={defaultDay}>
      <TabsList className="w-full">
        {days.map((day) => (
          <TabsTrigger
            key={day.weekday}
            value={day.weekday}
            className="flex-1 min-h-[44px] text-base"
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
