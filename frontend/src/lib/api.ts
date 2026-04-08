import { getTelegram } from "./telegram";

const BASE_URL = "/api";

export interface AuthUser {
  id: number;
  telegram_id: number | null;
  first_name: string;
  last_name: string;
  telegram_username: string;
}

export interface AuthSessionData {
  authenticated: boolean;
  telegram_bot_username: string;
  user: AuthUser | null;
}

export interface TelegramWidgetAuthData {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

function getCookie(name: string): string {
  if (typeof document === "undefined") return "";
  const match = document.cookie
    .split("; ")
    .find((part) => part.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.split("=").slice(1).join("=")) : "";
}

function getCsrfToken(): string {
  return getCookie("csrftoken");
}

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

function getRequestOptions(method?: string, data?: unknown): RequestInit {
  const headers = getHeaders();
  if (method && method !== "GET") {
    const csrfToken = getCsrfToken();
    if (csrfToken) {
      headers["X-CSRFToken"] = csrfToken;
    }
  }

  return {
    method,
    headers,
    credentials: "include",
    body: data === undefined ? undefined : JSON.stringify(data),
  };
}

async function fetchApi<T>(path: string): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, getRequestOptions("GET"));

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  return response.json();
}

async function putApi<T>(path: string, data: unknown): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, getRequestOptions("PUT", data));

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  return response.json();
}

export async function fetchSession(): Promise<AuthSessionData> {
  return fetchApi<AuthSessionData>("/auth/session/");
}

export async function loginWithTelegram(
  initData?: string,
  authData?: TelegramWidgetAuthData,
): Promise<AuthSessionData> {
  const response = await fetch(
    `${BASE_URL}/auth/telegram/`,
    getRequestOptions(
      "POST",
      initData ? { init_data: initData } : { auth_data: authData },
    ),
  );

  if (!response.ok) {
    throw new Error(`Auth error: ${response.status}`);
  }

  return response.json();
}

export async function logoutSession(): Promise<void> {
  const response = await fetch(`${BASE_URL}/auth/logout/`, getRequestOptions("POST"));
  if (!response.ok) {
    throw new Error(`Logout error: ${response.status}`);
  }
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
  completions: Record<string, string>;
}

export interface CompletionRecord {
  day_id: number;
  completed_at: string;
}

export function fetchCompletions(): Promise<CompletionsData> {
  return fetchApi<CompletionsData>("/completions/");
}

export async function markComplete(dayId: number): Promise<CompletionRecord> {
  const response = await fetch(
    `${BASE_URL}/completions/${dayId}/`,
    getRequestOptions("POST"),
  );
  if (!response.ok) throw new Error(`API error: ${response.status}`);
  return response.json();
}

export async function unmarkComplete(dayId: number): Promise<void> {
  const response = await fetch(
    `${BASE_URL}/completions/${dayId}/`,
    getRequestOptions("DELETE"),
  );
  if (!response.ok) throw new Error(`API error: ${response.status}`);
}

// Accessory weights

export interface AccessoryWeightLatest {
  [exerciseId: string]: {
    weight: string;
    recorded_date: string;
  };
}

export interface AccessoryWeightRecord {
  weight: string;
  sets_display: string;
  recorded_date: string;
  week_number: number | null;
}

export function fetchAccessoryWeightsLatest(): Promise<AccessoryWeightLatest> {
  return fetchApi<AccessoryWeightLatest>("/accessory-weights/latest/");
}

export function saveAccessoryWeight(
  exerciseId: number,
  weight: number,
  weekNumber: number | null,
  setsDisplay: string,
): Promise<AccessoryWeightRecord> {
  return putApi<AccessoryWeightRecord>(`/accessory-weights/${exerciseId}/`, {
    weight,
    week_number: weekNumber,
    sets_display: setsDisplay,
  });
}

export function fetchAccessoryWeightHistory(
  exerciseId: number,
): Promise<AccessoryWeightRecord[]> {
  return fetchApi<AccessoryWeightRecord[]>(
    `/accessory-weights/${exerciseId}/history/`,
  );
}
