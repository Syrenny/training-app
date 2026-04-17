import type { ExerciseSetData } from "@/lib/api";
import { calcWeight, categoryToField } from "@/lib/calc";
import { useProgramStore } from "@/lib/store";
import { SetPill, DumbbellSetPill } from "./SetPill";

interface SetDisplayProps {
  set: ExerciseSetData;
  category?: string;
}

export function SetDisplay({ set, category }: SetDisplayProps) {
  const oneRepMax = useProgramStore((s) => s.oneRepMax);

  let weightLabel = "";
  if (set.load_type === "PERCENT" && set.load_value && category) {
    const field = categoryToField[category];
    if (field && oneRepMax) {
      const orm = oneRepMax[field];
      if (orm > 0) {
        const minWeight = calcWeight(orm, Number(set.load_value));
        const maxWeight =
          set.load_value_max != null
            ? calcWeight(orm, Number(set.load_value_max))
            : null;
        const formatWeight = (value: number) => (value % 1 === 0 ? value.toFixed(0) : String(value));
        weightLabel = maxWeight != null && maxWeight !== minWeight
          ? ` (${formatWeight(minWeight)}-${formatWeight(maxWeight)}кг)`
          : ` (${formatWeight(minWeight)}кг)`;
      }
    }
  }

  const parts = set.display.split("🏋");

  if (parts.length === 1) {
    if (weightLabel && set.load_type === "PERCENT") {
      const display = set.display;
      const pctIdx = display.indexOf("%");
      if (pctIdx !== -1) {
        const before = display.slice(0, pctIdx + 1);
        const after = display.slice(pctIdx + 1);
        return (
          <SetPill>
            {before}{weightLabel}{after}
          </SetPill>
        );
      }
    }
    return <SetPill>{set.display}</SetPill>;
  }

  return <DumbbellSetPill>{parts[1]}</DumbbellSetPill>;
}
