import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  AccessoryWeightLatest,
  OneRepMaxData,
  ProgramData,
  ProgramSummary,
  TrainingCycleStartInput,
  TrainingCycleSummary,
  WeekDetailData,
  WeekListItem,
} from "./api";
import {
  fetchAccessoryWeightsLatest as apiFetchAccessoryWeightsLatest,
  fetchActiveTrainingCycle as apiFetchActiveTrainingCycle,
  fetchCompletions as apiFetchCompletions,
  fetchOneRepMax as apiFetchOneRepMax,
  fetchProgram as apiFetchProgram,
  fetchPrograms as apiFetchPrograms,
  fetchTrainingCycleHistory as apiFetchTrainingCycleHistory,
  finishTrainingCycle as apiFinishTrainingCycle,
  markComplete as apiMarkComplete,
  saveAccessoryWeight as apiSaveAccessoryWeight,
  startTrainingCycle as apiStartTrainingCycle,
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
  activeCycle: TrainingCycleSummary | null;
  cycleHistory: TrainingCycleSummary[];
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
  selectProgram: (programId: number) => Promise<void>;
  fetchActiveCycle: () => Promise<void>;
  fetchCycleHistory: () => Promise<void>;
  fetchProgram: () => Promise<void>;
  fetchOneRepMax: () => Promise<void>;
  fetchCompletions: () => Promise<void>;
  fetchAccessoryWeights: () => Promise<void>;
  toggleCompletion: (weekNumber: number, weekday: string) => Promise<void>;
  saveAccessoryWeight: (exerciseId: number, weight: number, setsDisplay: string) => Promise<void>;
  startCycle: (data: TrainingCycleStartInput) => Promise<void>;
  finishCycle: (reason: string, feeling: string) => Promise<void>;
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
      activeCycle: null,
      cycleHistory: [],
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
              programs.find((item) => item.id === state.activeCycle?.program_id)
              ?? programs.find((item) => item.id === state.selectedProgram?.id)
              ?? state.selectedProgram
              ?? programs[0]
              ?? null,
          }));
        } catch {
          // Silent fail
        }
      },

      selectProgram: async (programId) => {
        await apiUpdateSelectedProgram(programId);
        await Promise.all([get().fetchPrograms(), get().fetchProgram(), get().fetchOneRepMax()]);
      },

      fetchActiveCycle: async () => {
        try {
          const response = await apiFetchActiveTrainingCycle();
          set({ activeCycle: response.cycle });
        } catch {
          set({ activeCycle: null });
        }
      },

      fetchCycleHistory: async () => {
        try {
          const items = await apiFetchTrainingCycleHistory();
          set({ cycleHistory: items });
        } catch {
          // Silent fail
        }
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

      startCycle: async (data) => {
        const response = await apiStartTrainingCycle(data);
        const weeks = response.program.weeks.map((week) => ({
          id: week.id,
          number: week.number,
          title: week.title,
        }));
        const weekDetailCache = buildWeekCache(response.program);
        const nextSelectedWeek = weeks[0]?.number ?? null;

        set((state) => ({
          activeCycle: response.cycle,
          selectedProgram: response.program.program,
          oneRepMax: response.one_rep_max,
          completions: new Map<string, string>(),
          weeks,
          weekDetailCache,
          selectedWeek: nextSelectedWeek,
          selectedDay: resolveSelectedDay(nextSelectedWeek, state.selectedDay, weekDetailCache),
          error: null,
        }));
      },

      finishCycle: async (reason, feeling) => {
        const finished = await apiFinishTrainingCycle({ reason, feeling });
        set((state) => ({
          activeCycle: null,
          completions: new Map<string, string>(),
          cycleHistory: [finished, ...state.cycleHistory.filter((item) => item.id !== finished.id)],
        }));
        await Promise.all([
          get().fetchActiveCycle(),
          get().fetchProgram(),
          get().fetchOneRepMax(),
          get().fetchCompletions(),
          get().fetchCycleHistory(),
        ]);
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
