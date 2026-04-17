import type { ExerciseSetData, OneRepMaxData } from "./api";

export function calcWeight(oneRepMax: number, percent: number): number {
  return Math.floor((oneRepMax * percent) / 100 / 2.5) * 2.5;
}

function midpoint(min: number, max: number | null | undefined): number {
  if (max == null || max === min) return min;
  return (min + max) / 2;
}

export const categoryToField: Record<string, keyof OneRepMaxData | null> = {
  BENCH: "bench",
  SQUAT: "squat",
  DEADLIFT: "deadlift",
  ACCESSORY: null,
};

export function calcTonnage(
  sets: ExerciseSetData[],
  category: string,
  oneRepMax: OneRepMaxData | null,
): number | null {
  const field = categoryToField[category];
  if (!field || !oneRepMax) return null;
  const orm = oneRepMax[field];
  if (orm <= 0) return null;

  let total = 0;
  for (const s of sets) {
    let weight: number | null = null;
    if (s.load_type === "PERCENT" && s.load_value) {
      weight = calcWeight(orm, midpoint(Number(s.load_value), s.load_value_max));
    } else if (s.load_type === "KG" && s.load_value) {
      weight = midpoint(Number(s.load_value), s.load_value_max);
    }
    if (weight == null) return null;
    total += weight * midpoint(s.reps, s.reps_max) * s.sets;
  }
  return total;
}
