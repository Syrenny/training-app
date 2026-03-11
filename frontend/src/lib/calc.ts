import type { ExerciseSetData, OneRepMaxData } from "./api";

export function calcWeight(oneRepMax: number, percent: number): number {
  return Math.floor((oneRepMax * percent) / 100 / 2.5) * 2.5;
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
      weight = calcWeight(orm, Number(s.load_value));
    } else if (s.load_type === "KG" && s.load_value) {
      weight = Number(s.load_value);
    }
    if (weight == null) return null;
    total += weight * s.reps * s.sets;
  }
  return total;
}
