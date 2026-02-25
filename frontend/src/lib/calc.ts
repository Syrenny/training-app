import type { OneRepMaxData } from "./api";

export function calcWeight(oneRepMax: number, percent: number): number {
  return Math.floor((oneRepMax * percent) / 100 / 2.5) * 2.5;
}

export const categoryToField: Record<string, keyof OneRepMaxData | null> = {
  BENCH: "bench",
  SQUAT: "squat",
  DEADLIFT: "deadlift",
  ACCESSORY: null,
};
