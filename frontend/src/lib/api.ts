import { getTelegram } from "./telegram";

const BASE_URL = "/api";

export interface AuthUser {
  id: number;
  telegram_id: number | null;
  first_name: string;
  last_name: string;
  telegram_username: string;
  telegram_photo_url: string;
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
  if (!response.ok) throw new Error(`API error: ${response.status}`);
  return response.json();
}

async function postApi<T>(path: string, data: unknown): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, getRequestOptions("POST", data));
  if (!response.ok) throw new Error(`API error: ${response.status}`);
  return response.json();
}

async function putApi<T>(path: string, data: unknown): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, getRequestOptions("PUT", data));
  if (!response.ok) throw new Error(`API error: ${response.status}`);
  return response.json();
}

async function deleteApi(path: string): Promise<void> {
  const response = await fetch(`${BASE_URL}${path}`, getRequestOptions("DELETE"));
  if (!response.ok) throw new Error(`API error: ${response.status}`);
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
  id: string;
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
  id: string;
  order: number;
  exercise: ExerciseData;
  sets: ExerciseSetData[];
  superset_group: number | null;
}

export interface DayData {
  id: string;
  order: number;
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

export interface ProgramData {
  version: number | null;
  updated_at: string | null;
  commit_message: string | null;
  weeks: WeekDetailData[];
}

export interface ProgramSetInput {
  load_type: "PERCENT" | "KG" | "INDIVIDUAL" | "BODYWEIGHT";
  load_value: number | null;
  reps: number;
  sets: number;
}

export interface ProgramExerciseInput {
  exercise: number;
  superset_group: number | null;
  sets: ProgramSetInput[];
}

export interface ProgramDayInput {
  weekday: string;
  exercises: ProgramExerciseInput[];
}

export interface ProgramWeekInput {
  title?: string;
  days: ProgramDayInput[];
}

export interface ProgramSnapshotInput {
  commit_message: string;
  source_snapshot_version?: number | null;
  weeks: ProgramWeekInput[];
}

export interface ProgramHistoryItem {
  version: number;
  created_at: string;
  commit_message: string;
  source_snapshot_version: number | null;
  week_count: number;
  day_count: number;
  exercise_count: number;
  set_count: number;
}

export interface CompletionRecord {
  week_number: number;
  weekday: string;
  completed_at: string;
}

export interface CompletionsData {
  completions: CompletionRecord[];
}

export interface OneRepMaxData {
  bench: number;
  squat: number;
  deadlift: number;
}

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

export function fetchProgram(): Promise<ProgramData> {
  return fetchApi<ProgramData>("/program/");
}

export function saveProgramSnapshot(data: ProgramSnapshotInput): Promise<ProgramData> {
  return postApi<ProgramData>("/program/snapshots/", data);
}

export function fetchProgramHistory(): Promise<ProgramHistoryItem[]> {
  return fetchApi<ProgramHistoryItem[]>("/program/history/");
}

export function fetchProgramHistoryDetail(version: number): Promise<ProgramData> {
  return fetchApi<ProgramData>(`/program/history/${version}/`);
}

export function fetchExercises(): Promise<ExerciseData[]> {
  return fetchApi<ExerciseData[]>("/exercises/");
}

export function fetchOneRepMax(): Promise<OneRepMaxData> {
  return fetchApi<OneRepMaxData>("/one-rep-max/");
}

export function saveOneRepMax(data: Partial<OneRepMaxData>): Promise<OneRepMaxData> {
  return putApi<OneRepMaxData>("/one-rep-max/", data);
}

export function fetchCompletions(): Promise<CompletionsData> {
  return fetchApi<CompletionsData>("/completions/");
}

export function markComplete(weekNumber: number, weekday: string): Promise<CompletionRecord> {
  return postApi<CompletionRecord>(
    `/completions/${weekNumber}/${encodeURIComponent(weekday)}/`,
    {},
  );
}

export function unmarkComplete(weekNumber: number, weekday: string): Promise<void> {
  return deleteApi(`/completions/${weekNumber}/${encodeURIComponent(weekday)}/`);
}

export function resetCompletions(): Promise<void> {
  return deleteApi("/completions/");
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
