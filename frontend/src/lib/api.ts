import { getTelegram } from "./telegram";

const BASE_URL = "/api";

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as { detail?: string };
    if (typeof data.detail === "string" && data.detail) {
      return data.detail;
    }
  } catch {
    // Ignore JSON parsing errors
  }
  return `API error: ${response.status}`;
}

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
  if (!response.ok) throw new Error(await readErrorMessage(response));
  return response.json();
}

async function postApi<T>(path: string, data: unknown): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, getRequestOptions("POST", data));
  if (!response.ok) throw new Error(await readErrorMessage(response));
  return response.json();
}

async function putApi<T>(path: string, data: unknown): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, getRequestOptions("PUT", data));
  if (!response.ok) throw new Error(await readErrorMessage(response));
  return response.json();
}

async function deleteApi(path: string): Promise<void> {
  const response = await fetch(`${BASE_URL}${path}`, getRequestOptions("DELETE"));
  if (!response.ok) throw new Error(await readErrorMessage(response));
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
  load_value_max: number | null;
  reps: number;
  reps_max: number | null;
  sets: number;
  display: string;
}

export interface ExerciseData {
  id: number;
  name: string;
  category: "BENCH" | "SQUAT" | "DEADLIFT" | "ACCESSORY";
  one_rep_max_exercise_id?: number | null;
}

export interface ProgramOneRepMaxExerciseData {
  exercise_id: number;
  label: string;
  order: number;
  exercise: ExerciseData;
}

export interface DayExerciseData {
  id: string;
  order: number;
  slot_key: string;
  exercise: ExerciseData;
  sets: ExerciseSetData[];
  superset_group: number | null;
  notes: string;
}

export interface DayTextBlockData {
  kind: "REST" | "INFO";
  content: string;
}

export interface DayData {
  id: string;
  order: number;
  weekday: string;
  weekday_display: string;
  title: string;
  exercises: DayExerciseData[];
  text_blocks: DayTextBlockData[];
}

export interface WeekListItem {
  id: number;
  number: number;
  title: string;
}

export interface WeekDetailData extends WeekListItem {
  days: DayData[];
}

export interface ProgramSummary {
  id: number;
  slug: string;
  name: string;
  description: string;
  is_custom: boolean;
  source_program_id: number | null;
  source_program_name: string | null;
  one_rep_max_exercises: ProgramOneRepMaxExerciseData[];
}

export interface ProgramCreateInput {
  name: string;
  description?: string;
  source_program_id?: number | null;
}

export interface ProgramData {
  program: ProgramSummary | null;
  version: number | null;
  updated_at: string | null;
  commit_message: string | null;
  weeks: WeekDetailData[];
}

export interface ProgramSetInput {
  load_type: "PERCENT" | "KG" | "INDIVIDUAL" | "BODYWEIGHT";
  load_value: number | null;
  load_value_max?: number | null;
  reps: number;
  reps_max?: number | null;
  sets: number;
}

export interface ProgramExerciseInput {
  exercise: number;
  superset_group: number | null;
  notes?: string;
  sets: ProgramSetInput[];
}

export interface ProgramTextBlockInput {
  kind: "REST" | "INFO";
  content: string;
}

export interface ProgramDayInput {
  weekday: string;
  title?: string;
  exercises: ProgramExerciseInput[];
  text_blocks?: ProgramTextBlockInput[];
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

export interface OneRepMaxItemData {
  exercise_id: number;
  exercise_name: string;
  category: "BENCH" | "SQUAT" | "DEADLIFT" | "ACCESSORY";
  label: string;
  value: number;
}

export interface OneRepMaxData {
  cycle_id: number | null;
  program_id: number | null;
  items: OneRepMaxItemData[];
}

export interface TrainingCycleSummary {
  id: number;
  program_id: number;
  program_name: string;
  started_at: string;
  completed_at: string | null;
  completion_reason: string;
  completion_feeling: string;
  is_active: boolean;
}

export interface ActiveTrainingCycleResponse {
  cycle: TrainingCycleSummary | null;
}

export interface TrainingCycleStartInput {
  program_id: number;
  items: Array<{ exercise_id: number; value: number }>;
}

export interface TrainingCycleStartResponse {
  cycle: TrainingCycleSummary;
  program: ProgramData;
  one_rep_max: OneRepMaxData;
}

export interface ProgramAdaptation {
  id: number;
  program_id: number;
  program_name: string;
  cycle_id: number | null;
  scope: "ONLY_HERE" | "CURRENT_CYCLE" | "FUTURE_CYCLES";
  scope_label: string;
  action: "DELETE" | "REPLACE";
  action_label: string;
  slot_key: string;
  week_number: number;
  weekday: string;
  original_exercise_id: number | null;
  original_exercise_name: string | null;
  replacement_exercise_id: number | null;
  replacement_exercise_name: string | null;
  reason: string;
  is_canceled: boolean;
  canceled_at: string | null;
  cancellation_reason: string;
  created_at: string;
}

export interface ProgramAdaptationInput {
  program_id: number;
  scope: "ONLY_HERE" | "CURRENT_CYCLE" | "FUTURE_CYCLES";
  action: "DELETE" | "REPLACE";
  slot_key: string;
  week_number: number;
  weekday: string;
  original_exercise_id?: number | null;
  replacement_exercise_id?: number | null;
  reason?: string;
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

export function fetchPrograms(): Promise<ProgramSummary[]> {
  return fetchApi<ProgramSummary[]>("/programs/");
}

export function updateSelectedProgram(programId: number): Promise<ProgramSummary> {
  return putApi<ProgramSummary>("/programs/selected/", { program_id: programId });
}

export function createProgram(data: ProgramCreateInput): Promise<ProgramSummary> {
  return postApi<ProgramSummary>("/programs/create/", data);
}

export function fetchOriginalProgram(): Promise<ProgramData> {
  return fetchApi<ProgramData>("/program/original/");
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

export function saveOneRepMax(
  data: { items: Array<{ exercise_id: number; value: number }> },
): Promise<OneRepMaxData> {
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

export function fetchActiveTrainingCycle(): Promise<ActiveTrainingCycleResponse> {
  return fetchApi<ActiveTrainingCycleResponse>("/training-cycle/active/");
}

export function startTrainingCycle(
  data: TrainingCycleStartInput,
): Promise<TrainingCycleStartResponse> {
  return postApi<TrainingCycleStartResponse>("/training-cycle/start/", data);
}

export function finishTrainingCycle(data: {
  notes?: string;
}): Promise<TrainingCycleSummary> {
  return postApi<TrainingCycleSummary>("/training-cycle/finish/", data);
}

export function fetchTrainingCycleHistory(): Promise<TrainingCycleSummary[]> {
  return fetchApi<TrainingCycleSummary[]>("/training-cycle/history/");
}

export function deleteTrainingCycle(cycleId: number): Promise<void> {
  return deleteApi(`/training-cycle/history/${cycleId}/`);
}

export function fetchProgramAdaptations(
  programId: number,
): Promise<ProgramAdaptation[]> {
  return fetchApi<ProgramAdaptation[]>(
    `/program/adaptations/?program_id=${encodeURIComponent(String(programId))}`,
  );
}

export function createProgramAdaptation(
  data: ProgramAdaptationInput,
): Promise<ProgramAdaptation> {
  return postApi<ProgramAdaptation>("/program/adaptations/", data);
}

export async function cancelProgramAdaptation(
  adaptationId: number,
  reason?: string,
): Promise<ProgramAdaptation | null> {
  const response = await fetch(
    `${BASE_URL}/program/adaptations/${adaptationId}/cancel/`,
    getRequestOptions("POST", reason !== undefined ? { reason } : {}),
  );
  if (!response.ok) throw new Error(await readErrorMessage(response));
  if (response.status === 204) return null;
  return response.json();
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
