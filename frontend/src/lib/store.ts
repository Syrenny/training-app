import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  AccessoryWeightLatest,
  OneRepMaxData,
  ProgramData,
  ProgramCreateInput,
  ProgramSummary,
  WeekDetailData,
  WeekListItem,
} from "./api";
import {
  fetchAccessoryWeightsLatest as apiFetchAccessoryWeightsLatest,
  fetchCompletions as apiFetchCompletions,
  createProgram as apiCreateProgram,
  fetchOneRepMax as apiFetchOneRepMax,
  fetchProgram as apiFetchProgram,
  fetchPrograms as apiFetchPrograms,
  markComplete as apiMarkComplete,
  resetCompletions as apiResetCompletions,
  saveAccessoryWeight as apiSaveAccessoryWeight,
  saveOneRepMax as apiSaveOneRepMax,
  unmarkComplete as apiUnmarkComplete,
  updateSelectedProgram as apiUpdateSelectedProgram,
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
  programs: ProgramSummary[];
  selectedProgram: ProgramSummary | null;
  weeks: WeekListItem[];
  weekDetailCache: Record<number, WeekDetailData>;
  loading: boolean;
  error: string | null;
  oneRepMax: OneRepMaxData | null;
  completions: Map<string, string>;
  accessoryWeights: AccessoryWeightLatest;

  setWeek: (week: number) => void;
  setDay: (day: string) => void;
  fetchPrograms: () => Promise<void>;
  createProgram: (data: ProgramCreateInput) => Promise<ProgramSummary>;
  selectProgram: (programId: number) => Promise<void>;
  fetchProgram: () => Promise<void>;
  fetchOneRepMax: () => Promise<void>;
  fetchCompletions: () => Promise<void>;
  fetchAccessoryWeights: () => Promise<void>;
  toggleCompletion: (weekNumber: number, weekday: string) => Promise<void>;
  saveOneRepMax: (items: Array<{ exercise_id: number; value: number }>) => Promise<void>;
  resetCompletions: () => Promise<void>;
  saveAccessoryWeight: (exerciseId: number, weight: number, setsDisplay: string) => Promise<void>;
  navigateNext: () => Promise<NavigationResult>;
  navigatePrev: () => Promise<NavigationResult>;
}

export const useProgramStore = create<ProgramState>()(
  persist(
    (set, get) => ({
      selectedWeek: null,
      selectedDay: null,
      programs: [],
      selectedProgram: null,
      weeks: [],
      weekDetailCache: {},
      loading: false,
      error: null,
      oneRepMax: null,
      completions: new Map<string, string>(),
      accessoryWeights: {},

      setWeek: (week) =>
        set((state) => ({
          selectedWeek: week,
          selectedDay: resolveSelectedDay(week, state.selectedDay, state.weekDetailCache),
        })),

      setDay: (day) => set({ selectedDay: day }),

      fetchPrograms: async () => {
        try {
          const programs = await apiFetchPrograms();
          set((state) => ({
            programs,
            selectedProgram:
              programs.find((item) => item.id === state.selectedProgram?.id)
              ?? state.selectedProgram
              ?? programs[0]
              ?? null,
          }));
        } catch {
          // Silent fail
        }
      },

      createProgram: async (data) => {
        const program = await apiCreateProgram(data);
        await Promise.all([
          get().fetchPrograms(),
          get().fetchProgram(),
          get().fetchOneRepMax(),
          get().fetchCompletions(),
        ]);
        set({ selectedProgram: program });
        return program;
      },

      selectProgram: async (programId) => {
        await apiUpdateSelectedProgram(programId);
        await Promise.all([
          get().fetchPrograms(),
          get().fetchProgram(),
          get().fetchOneRepMax(),
          get().fetchCompletions(),
          get().fetchAccessoryWeights(),
        ]);
      },

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
              selectedProgram: program.program,
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
          set({ oneRepMax: null });
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
          set({ completions: new Map<string, string>() });
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

      saveOneRepMax: async (items) => {
        const data = await apiSaveOneRepMax({ items });
        set({ oneRepMax: data });
      },

      resetCompletions: async () => {
        await apiResetCompletions();
        set({ completions: new Map<string, string>() });
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
