import { Dumbbell } from "lucide-react";
import type { ExerciseSetData } from "@/lib/api";
import { calcWeight, categoryToField } from "@/lib/calc";
import { useProgramStore } from "@/lib/store";

interface SetDisplayProps {
  set: ExerciseSetData;
  category?: string;
}

export function SetDisplay({ set, category }: SetDisplayProps) {
  const oneRepMax = useProgramStore((s) => s.oneRepMax);

  // Calculate weight for PERCENT sets with known category
  let weightLabel = "";
  if (
    set.load_type === "PERCENT" &&
    set.load_value &&
    category
  ) {
    const field = categoryToField[category];
    if (field && oneRepMax) {
      const orm = oneRepMax[field];
      if (orm > 0) {
        const w = calcWeight(orm, Number(set.load_value));
        weightLabel = ` (${w % 1 === 0 ? w.toFixed(0) : w}кг)`;
      }
    }
  }

  const parts = set.display.split("🏋");

  if (parts.length === 1) {
    // Inject weight label after percentage
    if (weightLabel && set.load_type === "PERCENT") {
      const display = set.display;
      const pctIdx = display.indexOf("%");
      if (pctIdx !== -1) {
        const before = display.slice(0, pctIdx + 1);
        const after = display.slice(pctIdx + 1);
        return (
          <span className="inline-block rounded bg-secondary px-2 py-1 text-sm font-mono">
            {before}{weightLabel}{after}
          </span>
        );
      }
    }
    return (
      <span className="inline-block rounded bg-secondary px-2 py-1 text-sm font-mono">
        {set.display}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center rounded bg-secondary px-2 py-1 text-sm font-mono gap-0.5">
      {parts[0]}
      <Dumbbell className="h-3.5 w-3.5 inline-block -translate-y-px" />
      {parts[1]}
    </span>
  );
}
