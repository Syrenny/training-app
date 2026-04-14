import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  AccessoryWeightLatest,
  OneRepMaxData,
  ProgramData,
  WeekDetailData,
  WeekListItem,
} from "./api";
import {
  fetchAccessoryWeightsLatest as apiFetchAccessoryWeightsLatest,
  fetchCompletions as apiFetchCompletions,
  fetchOneRepMax as apiFetchOneRepMax,
  fetchProgram as apiFetchProgram,
  markComplete as apiMarkComplete,
  resetCompletions as apiResetCompletions,
  saveAccessoryWeight as apiSaveAccessoryWeight,
  saveOneRepMax as apiSaveOneRepMax,
  unmarkComplete as apiUnmarkComplete,
} from "./api";
import type { NavigationResult } from "./navigation";
import { resolveNext, resolvePrev } from "./navigation";

export function completionKey(weekNumber: number, weekday: string) {
  return `${weekNumber}:${weekday}`;
}

function buildWeekCache(program: ProgramData) {
  return Object.fromEntries(program.weeks.map((week) => [week.number, week]));
}

function resolveSelectedDay(
  selectedWeek: number | null,
  selectedDay: string | null,
  cache: Record<number, WeekDetailData>,
) {
  if (selectedWeek === null) return null;
  const days = cache[selectedWeek]?.days ?? [];
  if (days.length === 0) return null;
  return days.some((day) => day.weekday === selectedDay) ? selectedDay : days[0].weekday;
}

interface ProgramState {
  selectedWeek: number | null;
  selectedDay: string | null;

  weeks: WeekListItem[];
  weekDetailCache: Record<number, WeekDetailData>;
  loading: boolean;
  error: string | null;
  programVersion: number | null;
  programUpdatedAt: string | null;
  oneRepMax: OneRepMaxData | null;
  completions: Map<string, string>;
  accessoryWeights: AccessoryWeightLatest;

  setWeek: (week: number) => void;
  setDay: (day: string) => void;
  fetchProgram: () => Promise<void>;
  fetchOneRepMax: () => Promise<void>;
  saveOneRepMax: (data: Partial<OneRepMaxData>) => Promise<void>;
  fetchCompletions: () => Promise<void>;
  toggleCompletion: (weekNumber: number, weekday: string) => Promise<void>;
  resetCompletions: () => Promise<void>;
  fetchAccessoryWeights: () => Promise<void>;
  saveAccessoryWeight: (exerciseId: number, weight: number, setsDisplay: string) => Promise<void>;
  navigateNext: () => Promise<NavigationResult>;
  navigatePrev: () => Promise<NavigationResult>;
}

export const useProgramStore = create<ProgramState>()(
  persist(
    (set, get) => ({
      selectedWeek: null,
      selectedDay: null,
      weeks: [],
      weekDetailCache: {},
      loading: false,
      error: null,
      programVersion: null,
      programUpdatedAt: null,
      oneRepMax: null,
      completions: new Map<string, string>(),
      accessoryWeights: {},

      setWeek: (week) =>
        set((state) => ({
          selectedWeek: week,
          selectedDay: resolveSelectedDay(week, state.selectedDay, state.weekDetailCache),
        })),

      setDay: (day) => set({ selectedDay: day }),

      fetchProgram: async () => {
        set({ loading: true, error: null });
        try {
          const program = await apiFetchProgram();
          const weeks = program.weeks.map((week) => ({
            id: week.id,
            number: week.number,
            title: week.title,
          }));
          const weekDetailCache = buildWeekCache(program);

          set((state) => {
            const nextSelectedWeek = weeks.some((week) => week.number === state.selectedWeek)
              ? state.selectedWeek
              : (weeks[0]?.number ?? null);
            return {
              weeks,
              weekDetailCache,
              programVersion: program.version,
              programUpdatedAt: program.updated_at,
              selectedWeek: nextSelectedWeek,
              selectedDay: resolveSelectedDay(nextSelectedWeek, state.selectedDay, weekDetailCache),
              loading: false,
              error: null,
            };
          });
        } catch {
          set({
            loading: false,
            error: "Не удалось загрузить программу",
            weeks: [],
            weekDetailCache: {},
          });
        }
      },

      fetchOneRepMax: async () => {
        try {
          const data = await apiFetchOneRepMax();
          set({ oneRepMax: data });
        } catch {
          // Silent fail — 1RM is optional
        }
      },

      saveOneRepMax: async (data) => {
        try {
          const result = await apiSaveOneRepMax(data);
          set({ oneRepMax: result });
        } catch {
          // Silent fail
        }
      },

      fetchCompletions: async () => {
        try {
          const data = await apiFetchCompletions();
          const map = new Map<string, string>();
          for (const item of data.completions) {
            map.set(completionKey(item.week_number, item.weekday), item.completed_at);
          }
          set({ completions: map });
        } catch {
          // Silent fail — completions are non-critical
        }
      },

      toggleCompletion: async (weekNumber, weekday) => {
        const key = completionKey(weekNumber, weekday);
        const { completions } = get();
        const isCompleted = completions.has(key);
        const next = new Map(completions);

        if (isCompleted) {
          next.delete(key);
        } else {
          next.set(key, new Date().toISOString().split("T")[0]);
        }
        set({ completions: next });

        try {
          if (isCompleted) {
            await apiUnmarkComplete(weekNumber, weekday);
          } else {
            await apiMarkComplete(weekNumber, weekday);
          }
        } catch {
          set({ completions });
        }
      },

      resetCompletions: async () => {
        const previous = get().completions;
        set({ completions: new Map<string, string>() });
        try {
          await apiResetCompletions();
        } catch {
          set({ completions: previous });
        }
      },

      fetchAccessoryWeights: async () => {
        try {
          const data = await apiFetchAccessoryWeightsLatest();
          set({ accessoryWeights: data });
        } catch {
          // Silent fail
        }
      },

      saveAccessoryWeight: async (exerciseId, weight, setsDisplay) => {
        const { selectedWeek } = get();
        try {
          await apiSaveAccessoryWeight(exerciseId, weight, selectedWeek, setsDisplay);
          set((state) => ({
            accessoryWeights: {
              ...state.accessoryWeights,
              [exerciseId]: {
                weight: String(weight),
                recorded_date: new Date().toISOString().split("T")[0],
              },
            },
          }));
        } catch {
          // Silent fail
        }
      },

      navigateNext: async () => {
        const { selectedWeek, selectedDay, weeks, weekDetailCache } = get();
        if (selectedWeek === null || selectedDay === null) return { type: "boundary" };

        const target = resolveNext(selectedWeek, selectedDay, weeks, weekDetailCache);
        if (!target) return { type: "boundary" };

        set({ selectedWeek: target.week, selectedDay: target.day });
        return { type: "navigated", week: target.week, day: target.day };
      },

      navigatePrev: async () => {
        const { selectedWeek, selectedDay, weeks, weekDetailCache } = get();
        if (selectedWeek === null || selectedDay === null) return { type: "boundary" };

        const target = resolvePrev(selectedWeek, selectedDay, weeks, weekDetailCache);
        if (!target) return { type: "boundary" };

        set({ selectedWeek: target.week, selectedDay: target.day });
        return { type: "navigated", week: target.week, day: target.day };
      },
    }),
    {
      name: "program-store",
      partialize: (state) => ({
        selectedWeek: state.selectedWeek,
        selectedDay: state.selectedDay,
      }),
    },
  ),
);
