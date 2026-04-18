import type { ExerciseSetData, OneRepMaxData } from "./api";

export function calcWeight(oneRepMax: number, percent: number): number {
  return Math.floor((oneRepMax * percent) / 100 / 2.5) * 2.5;
}

function midpoint(min: number, max: number | null | undefined): number {
  if (max == null || max === min) return min;
  return (min + max) / 2;
}

export function getOneRepMaxValue(
  oneRepMax: OneRepMaxData | null,
  exerciseId: number | null | undefined,
): number | null {
  if (!oneRepMax || exerciseId == null) return null;
  const item = oneRepMax.items.find((entry) => entry.exercise_id === exerciseId);
  if (!item || item.value <= 0) return null;
  return item.value;
}

export function calcTonnage(
  sets: ExerciseSetData[],
  oneRepMaxExerciseId: number | null | undefined,
  oneRepMax: OneRepMaxData | null,
): number | null {
  const orm = getOneRepMaxValue(oneRepMax, oneRepMaxExerciseId);

  let total = 0;
  for (const s of sets) {
    let weight: number | null = null;
    if (s.load_type === "PERCENT" && s.load_value) {
      if (orm == null) return null;
      weight = calcWeight(orm, midpoint(Number(s.load_value), s.load_value_max));
    } else if (s.load_type === "KG" && s.load_value) {
      weight = midpoint(Number(s.load_value), s.load_value_max);
    }
    if (weight == null) return null;
    total += weight * midpoint(s.reps, s.reps_max) * s.sets;
  }
  return total;
}
