import { getTelegram } from "./telegram";

const BASE_URL = "/api";

async function fetchApi<T>(path: string): Promise<T> {
  const tg = getTelegram();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (tg?.initData) {
    headers["X-Telegram-Init-Data"] = tg.initData;
  }

  const response = await fetch(`${BASE_URL}${path}`, { headers });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  return response.json();
}

export interface ExerciseSetData {
  id: number;
  order: number;
  load_type: "PERCENT" | "KG" | "INDIVIDUAL" | "BODYWEIGHT";
  load_value: number | null;
  reps: number;
  sets: number;
  display: string;
}

export interface ExerciseData {
  id: number;
  name: string;
  category: "BENCH" | "SQUAT" | "DEADLIFT" | "ACCESSORY";
}

export interface DayExerciseData {
  id: number;
  order: number;
  exercise: ExerciseData;
  sets: ExerciseSetData[];
}

export interface DayData {
  id: number;
  weekday: string;
  weekday_display: string;
  exercises: DayExerciseData[];
}

export interface WeekListItem {
  id: number;
  number: number;
  title: string;
}

export interface WeekDetailData extends WeekListItem {
  days: DayData[];
}

export function fetchWeeks(): Promise<WeekListItem[]> {
  return fetchApi<WeekListItem[]>("/weeks/");
}

export function fetchWeekDetail(weekNumber: number): Promise<WeekDetailData> {
  return fetchApi<WeekDetailData>(`/weeks/${weekNumber}/`);
}
