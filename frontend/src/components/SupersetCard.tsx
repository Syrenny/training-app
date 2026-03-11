import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SetDisplay } from "./SetDisplay";
import type { DayExerciseData } from "@/lib/api";
import { calcTonnage } from "@/lib/calc";
import { useProgramStore } from "@/lib/store";

const categoryLabels: Record<string, string> = {
  BENCH: "Жим",
  SQUAT: "Присед",
  DEADLIFT: "Тяга",
  ACCESSORY: "Подсобка",
};

interface SupersetCardProps {
  exercises: DayExerciseData[];
  displayOrder: number;
}

export function SupersetCard({ exercises, displayOrder }: SupersetCardProps) {
  const oneRepMax = useProgramStore((s) => s.oneRepMax);

  return (
    <Card className="mb-3 border-l-4 border-l-primary">
      <CardContent>
        <div className="flex items-baseline gap-2 mb-3">
          <span className="text-muted-foreground text-sm font-medium">
            {displayOrder}.
          </span>
          <Badge variant="outline" className="text-xs">
            Суперсет
          </Badge>
        </div>
        <div className="space-y-3">
          {exercises.map((dayExercise) => {
            const tonnage =
              dayExercise.exercise.category !== "ACCESSORY"
                ? calcTonnage(
                    dayExercise.sets,
                    dayExercise.exercise.category,
                    oneRepMax,
                  )
                : null;

            return (
              <div key={dayExercise.id}>
                <div className="flex items-baseline gap-2 mb-2">
                  <span className="font-semibold">
                    {dayExercise.exercise.name}
                  </span>
                  <Badge
                    variant="secondary"
                    className="text-xs ml-auto shrink-0"
                  >
                    {categoryLabels[dayExercise.exercise.category] ??
                      dayExercise.exercise.category}
                  </Badge>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {dayExercise.sets.map((set) => (
                    <SetDisplay
                      key={set.id}
                      set={set}
                      category={dayExercise.exercise.category}
                    />
                  ))}
                </div>
                {tonnage != null && (
                  <p className="text-muted-foreground text-xs mt-2">
                    Тоннаж:{" "}
                    {tonnage >= 1000
                      ? `${(tonnage / 1000).toFixed(1)}т`
                      : `${tonnage}кг`}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
