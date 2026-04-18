import type { ReactNode } from "react";
import type { ExerciseSetData } from "@/lib/api";
import { calcWeight, getOneRepMaxValue } from "@/lib/calc";
import { useProgramStore } from "@/lib/store";

interface SetDisplayProps {
  set: ExerciseSetData;
  oneRepMaxExerciseId?: number | null;
  weightEditor?: ReactNode;
  rightAddon?: ReactNode;
}

function formatNumber(value: number | null | undefined) {
  if (value == null) return "";
  return value % 1 === 0 ? value.toFixed(0) : String(value);
}

function formatRange(minValue: number | null | undefined, maxValue: number | null | undefined) {
  const first = formatNumber(minValue);
  if (!first) return "";
  const last = formatNumber(maxValue);
  if (!last || last === first) return first;
  return `${first}–${last}`;
}

export function SetDisplay({
  set,
  oneRepMaxExerciseId,
  weightEditor,
  rightAddon,
}: SetDisplayProps) {
  const oneRepMax = useProgramStore((s) => s.oneRepMax);

  let weightLabel = "";
  let percentLabel = "";

  if (set.load_type === "PERCENT" && set.load_value) {
    const orm = getOneRepMaxValue(oneRepMax, oneRepMaxExerciseId);
    if (orm != null) {
      const minWeight = calcWeight(orm, Number(set.load_value));
      const maxWeight =
        set.load_value_max != null
          ? calcWeight(orm, Number(set.load_value_max))
          : null;
      weightLabel = `${formatRange(minWeight, maxWeight)}кг`;
    }
    percentLabel = `${formatRange(Number(set.load_value), set.load_value_max)}%`;
  }

  if (set.load_type === "KG" && set.load_value != null) {
    weightLabel = `${formatRange(Number(set.load_value), set.load_value_max)}\u00A0кг`;
  }

  const repsLabel = set.reps_max != null && set.reps_max !== set.reps
    ? `${set.reps}–${set.reps_max}`
    : String(set.reps);
  const volumeLabel = `${repsLabel}${set.sets > 1 ? `×${set.sets}` : ""}`;
  const leftLabel = weightLabel ? `${weightLabel} ${volumeLabel}` : volumeLabel;

  return (
    <div className="grid w-full grid-cols-[minmax(0,1.8fr)_minmax(0,.8fr)] items-baseline gap-x-2 font-mono text-sm tabular-nums">
      <div className="min-w-0 whitespace-nowrap text-left font-medium text-foreground">
        {weightEditor ? (
          <div className="flex items-baseline gap-2">
            {weightEditor}
            <span>{volumeLabel}</span>
          </div>
        ) : (
          <span>{leftLabel}</span>
        )}
      </div>
      <div className="min-w-0 whitespace-nowrap text-right text-muted-foreground">
        {rightAddon ?? percentLabel}
      </div>
    </div>
  );
}
