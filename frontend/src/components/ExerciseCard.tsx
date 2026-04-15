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
    <div className="py-4">
      <div className="mb-2 flex items-baseline gap-2">
        <span className="text-muted-foreground text-sm font-medium">
          {displayOrder}.
        </span>
        <span className="font-semibold">{exercise.name}</span>
        <span className="text-muted-foreground ml-auto shrink-0 text-xs">
          {categoryLabels[exercise.category] ?? exercise.category}
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {sets.map((set) => (
          <SetDisplay key={set.id} set={set} category={exercise.category} />
        ))}
      </div>
      {tonnage != null && (
        <p className="text-muted-foreground mt-2 text-xs">
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
    </div>
  );
}
