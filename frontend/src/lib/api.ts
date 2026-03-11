import { getTelegram } from "./telegram";

const BASE_URL = "/api";

function getHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (import.meta.env.VITE_DEV_MODE === "true") {
    headers["X-Dev-Mode"] = "1";
  } else {
    const tg = getTelegram();
    if (tg?.initData) {
      headers["X-Telegram-Init-Data"] = tg.initData;
    }
  }
  return headers;
}

async function fetchApi<T>(path: string): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, { headers: getHeaders() });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  return response.json();
}

async function putApi<T>(path: string, data: unknown): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    method: "PUT",
    headers: getHeaders(),
    body: JSON.stringify(data),
  });

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
  superset_group: number | null;
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

export interface OneRepMaxData {
  bench: number;
  squat: number;
  deadlift: number;
}

export function fetchOneRepMax(): Promise<OneRepMaxData> {
  return fetchApi<OneRepMaxData>("/one-rep-max/");
}

export function saveOneRepMax(data: Partial<OneRepMaxData>): Promise<OneRepMaxData> {
  return putApi<OneRepMaxData>("/one-rep-max/", data);
}

export interface CompletionsData {
  completed_day_ids: number[];
}

export interface CompletionRecord {
  day_id: number;
  completed_at: string;
}

export function fetchCompletions(): Promise<CompletionsData> {
  return fetchApi<CompletionsData>("/completions/");
}

export async function markComplete(dayId: number): Promise<CompletionRecord> {
  const response = await fetch(`${BASE_URL}/completions/${dayId}/`, {
    method: "POST",
    headers: getHeaders(),
  });
  if (!response.ok) throw new Error(`API error: ${response.status}`);
  return response.json();
}

export async function unmarkComplete(dayId: number): Promise<void> {
  const response = await fetch(`${BASE_URL}/completions/${dayId}/`, {
    method: "DELETE",
    headers: getHeaders(),
  });
  if (!response.ok) throw new Error(`API error: ${response.status}`);
}
