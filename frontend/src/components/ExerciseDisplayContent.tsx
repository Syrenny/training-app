import type { ReactNode } from "react";
import { SetDisplay } from "./SetDisplay";
import { AccessoryWeightInput } from "./AccessoryWeightInput";
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

      <div className={cn("flex flex-wrap gap-1.5", setsClassName)}>
        {sets.map((set) => (
          <SetDisplay key={set.id} set={set} category={exercise.category} />
        ))}
      </div>

      {tonnage != null ? (
        <p className="text-muted-foreground mt-2 text-xs">
          Тоннаж: {tonnage >= 1000 ? `${(tonnage / 1000).toFixed(1)}т` : `${tonnage}кг`}
        </p>
      ) : null}

      {notes ? (
        <p className="mt-2 whitespace-pre-line text-sm leading-6 text-muted-foreground">
          {notes}
        </p>
      ) : null}

      {showAccessoryWeight && exercise.category === "ACCESSORY" ? (
        <AccessoryWeightInput
          exerciseId={exercise.id}
          exerciseName={exercise.name}
          setsDisplay={sets.map((set) => set.display).join(", ")}
        />
      ) : null}

      {footer}
    </div>
  );
}
