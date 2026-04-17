import type { ReactNode } from "react";
import { SetDisplay } from "./SetDisplay";
import { AccessoryWeightHistoryButton, AccessoryWeightInput } from "./AccessoryWeightInput";
import type { ExerciseSetData } from "@/lib/api";
import { calcTonnage } from "@/lib/calc";
import { useProgramStore } from "@/lib/store";
import { cn } from "@/lib/utils";

const categoryLabels: Record<string, string> = {
  BENCH: "Жим",
  SQUAT: "Присед",
  DEADLIFT: "Тяга",
  ACCESSORY: "Подсобка",
};

interface ExerciseDisplayContentProps {
  displayOrder?: number;
  exercise: {
    id: number;
    name: string;
    category: string;
  };
  sets: ExerciseSetData[];
  notes?: string;
  badges?: ReactNode;
  footer?: ReactNode;
  showAccessoryWeight?: boolean;
  className?: string;
  nameClassName?: string;
  setsClassName?: string;
}

export function ExerciseDisplayContent({
  displayOrder,
  exercise,
  sets,
  notes,
  badges,
  footer,
  showAccessoryWeight = true,
  className,
  nameClassName,
  setsClassName,
}: ExerciseDisplayContentProps) {
  const oneRepMax = useProgramStore((s) => s.oneRepMax);

  const tonnage =
    exercise.category !== "ACCESSORY"
      ? calcTonnage(sets, exercise.category, oneRepMax)
      : null;

  return (
    <div className={className}>
      <div className="mb-2 flex items-baseline gap-2">
        {displayOrder != null ? (
          <span className="text-muted-foreground text-sm font-medium">
            {displayOrder}.
          </span>
        ) : null}
        <span className={cn("font-semibold", nameClassName)}>
          {exercise.name}
        </span>
        <span className="text-muted-foreground ml-auto shrink-0 text-xs">
          {categoryLabels[exercise.category] ?? exercise.category}
        </span>
      </div>

      {badges ? (
        <div className="mb-3 flex flex-wrap gap-2">
          {badges}
        </div>
      ) : null}

      <div className={cn("mt-3 space-y-1.5", setsClassName)}>
        {sets.map((set, index) => (
          <SetDisplay
            key={set.id}
            set={set}
            category={exercise.category}
            weightEditor={
              showAccessoryWeight && exercise.category === "ACCESSORY" && index === 0 ? (
                <AccessoryWeightInput
                  exerciseId={exercise.id}
                  exerciseName={exercise.name}
                  setsDisplay={sets.map((item) => item.display).join(", ")}
                />
              ) : undefined
            }
            rightAddon={
              showAccessoryWeight && exercise.category === "ACCESSORY" && index === 0 ? (
                <AccessoryWeightHistoryButton
                  exerciseId={exercise.id}
                  exerciseName={exercise.name}
                />
              ) : undefined
            }
          />
        ))}
      </div>

      {notes ? (
        <div className="mt-4">
          <p className="whitespace-pre-line text-sm leading-6 text-muted-foreground">
            {notes}
          </p>
        </div>
      ) : null}

      {tonnage != null ? (
        <div className="mt-4">
          <p className="text-xs text-muted-foreground">
            Тоннаж: {tonnage >= 1000 ? `${(tonnage / 1000).toFixed(1)}т` : `${tonnage}кг`}
          </p>
        </div>
      ) : null}

      {footer}
    </div>
  );
}
