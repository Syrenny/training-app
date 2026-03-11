import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SetDisplay } from "./SetDisplay";
import { AccessoryWeightInput } from "./AccessoryWeightInput";
import type { DayExerciseData } from "@/lib/api";
import { calcTonnage } from "@/lib/calc";
import { useProgramStore } from "@/lib/store";

const categoryLabels: Record<string, string> = {
  BENCH: "Жим",
  SQUAT: "Присед",
  DEADLIFT: "Тяга",
  ACCESSORY: "Подсобка",
};

interface ExerciseCardProps {
  dayExercise: DayExerciseData;
  displayOrder: number;
}

export function ExerciseCard({ dayExercise, displayOrder }: ExerciseCardProps) {
  const { exercise, sets } = dayExercise;
  const oneRepMax = useProgramStore((s) => s.oneRepMax);

  const tonnage =
    exercise.category !== "ACCESSORY"
      ? calcTonnage(sets, exercise.category, oneRepMax)
      : null;

  return (
    <Card className="mb-3">
      <CardContent>
        <div className="flex items-baseline gap-2 mb-2">
          <span className="text-muted-foreground text-sm font-medium">
            {displayOrder}.
          </span>
          <span className="font-semibold">{exercise.name}</span>
          <Badge variant="secondary" className="text-xs ml-auto shrink-0">
            {categoryLabels[exercise.category] ?? exercise.category}
          </Badge>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {sets.map((set) => (
            <SetDisplay key={set.id} set={set} category={exercise.category} />
          ))}
        </div>
        {tonnage != null && (
          <p className="text-muted-foreground text-xs mt-2">
            Тоннаж: {tonnage >= 1000 ? `${(tonnage / 1000).toFixed(1)}т` : `${tonnage}кг`}
          </p>
        )}
        {exercise.category === "ACCESSORY" && (
          <AccessoryWeightInput
            exerciseId={exercise.id}
            exerciseName={exercise.name}
            setsDisplay={sets.map(s => s.display).join(", ")}
          />
        )}
      </CardContent>
    </Card>
  );
}
