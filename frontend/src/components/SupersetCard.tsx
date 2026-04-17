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

interface SupersetCardProps {
  exercises: DayExerciseData[];
  displayOrder: number;
}

export function SupersetCard({ exercises, displayOrder }: SupersetCardProps) {
  const oneRepMax = useProgramStore((s) => s.oneRepMax);

  return (
    <div className="py-4">
      <div className="mb-3 flex items-baseline gap-2">
        <span className="text-muted-foreground text-sm font-medium">
          {displayOrder}.
        </span>
        <span className="text-muted-foreground text-xs uppercase tracking-[0.12em]">
          Суперсет
        </span>
      </div>
      <div className="divide-y divide-border/50">
        {exercises.map((dayExercise, index) => {
          const tonnage =
            dayExercise.exercise.category !== "ACCESSORY"
              ? calcTonnage(
                  dayExercise.sets,
                  dayExercise.exercise.category,
                  oneRepMax,
                )
              : null;

          return (
            <div
              key={dayExercise.id}
              className={index === 0 ? "pb-3" : "pt-3"}
            >
              <div className="mb-2 flex items-baseline gap-2">
                <span className="font-semibold">
                  {dayExercise.exercise.name}
                </span>
                <span className="text-muted-foreground ml-auto shrink-0 text-xs">
                  {categoryLabels[dayExercise.exercise.category] ??
                    dayExercise.exercise.category}
                </span>
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
              {dayExercise.notes ? (
                <p className="mt-2 text-sm leading-5 text-muted-foreground">
                  {dayExercise.notes}
                </p>
              ) : null}
              {dayExercise.exercise.category === "ACCESSORY" && (
                <AccessoryWeightInput
                  exerciseId={dayExercise.exercise.id}
                  exerciseName={dayExercise.exercise.name}
                  setsDisplay={dayExercise.sets.map((s) => s.display).join(", ")}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
