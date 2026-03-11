import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AccessoryWeightLatest, OneRepMaxData, WeekDetailData, WeekListItem } from "./api";
import {
  fetchAccessoryWeightsLatest as apiFetchAccessoryWeightsLatest,
  fetchCompletions as apiFetchCompletions,
  fetchOneRepMax as apiFetchOneRepMax,
  fetchWeekDetail as apiFetchWeekDetail,
  fetchWeeks as apiFetchWeeks,
  markComplete as apiMarkComplete,
  saveAccessoryWeight as apiSaveAccessoryWeight,
  saveOneRepMax as apiSaveOneRepMax,
  unmarkComplete as apiUnmarkComplete,
} from "./api";
import type { NavigationResult } from "./navigation";
import { resolveNext, resolvePrev, getAdjacentWeekNumber } from "./navigation";

interface ProgramState {
  // Persisted
  selectedWeek: number | null;
  selectedDay: string | null;

  // Transient
  weeks: WeekListItem[];
  weekDetailCache: Record<number, WeekDetailData>;
  loading: boolean;
  error: string | null;
  oneRepMax: OneRepMaxData | null;
  completions: Map<number, string>;
  accessoryWeights: AccessoryWeightLatest;

  // Actions
  setWeek: (week: number) => void;
  setDay: (day: string) => void;
  fetchWeeks: () => Promise<void>;
  fetchWeekDetail: (weekNumber: number) => Promise<void>;
  fetchOneRepMax: () => Promise<void>;
  saveOneRepMax: (data: Partial<OneRepMaxData>) => Promise<void>;
  fetchCompletions: () => Promise<void>;
  toggleCompletion: (dayId: number) => Promise<void>;
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
      oneRepMax: null,
      completions: new Map<number, string>(),
      accessoryWeights: {},

      setWeek: (week) => set({ selectedWeek: week, selectedDay: null }),

      setDay: (day) => {
        set({ selectedDay: day });
        // Prefetch adjacent weeks if on first/last day
        const { selectedWeek, weeks, weekDetailCache, fetchWeekDetail: fetch } = get();
        if (selectedWeek === null) return;
        const weekData = weekDetailCache[selectedWeek];
        if (!weekData) return;
        const days = weekData.days;
        const dayIndex = days.findIndex((d) => d.weekday === day);
        if (dayIndex === 0) {
          const prev = getAdjacentWeekNumber(selectedWeek, weeks, "prev");
          if (prev !== null && !weekDetailCache[prev]) fetch(prev);
        }
        if (dayIndex === days.length - 1) {
          const next = getAdjacentWeekNumber(selectedWeek, weeks, "next");
          if (next !== null && !weekDetailCache[next]) fetch(next);
        }
      },

      fetchWeeks: async () => {
        try {
          const weeks = await apiFetchWeeks();
          const state = get();
          const validWeek = weeks.find((w) => w.number === state.selectedWeek);
          set({
            weeks,
            selectedWeek: validWeek ? state.selectedWeek : (weeks[0]?.number ?? null),
          });
        } catch {
          set({ weeks: [] });
        }
      },

      fetchWeekDetail: async (weekNumber) => {
        const cached = get().weekDetailCache[weekNumber];
        if (cached) {
          set({ error: null });
          return;
        }

        set({ loading: true, error: null });
        try {
          const data = await apiFetchWeekDetail(weekNumber);
          set((state) => ({
            weekDetailCache: { ...state.weekDetailCache, [weekNumber]: data },
            loading: false,
          }));
        } catch {
          set({ loading: false, error: "Не удалось загрузить программу" });
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
          const map = new Map<number, string>();
          for (const [id, date] of Object.entries(data.completions)) {
            map.set(Number(id), date);
          }
          set({ completions: map });
        } catch {
          // Silent fail — completions are non-critical
        }
      },

      toggleCompletion: async (dayId) => {
        const { completions } = get();
        const isCompleted = completions.has(dayId);

        // Optimistic update
        const next = new Map(completions);
        if (isCompleted) {
          next.delete(dayId);
        } else {
          next.set(dayId, new Date().toISOString().split("T")[0]);
        }
        set({ completions: next });

        try {
          if (isCompleted) {
            await apiUnmarkComplete(dayId);
          } else {
            await apiMarkComplete(dayId);
          }
        } catch {
          // Revert on error
          set({ completions });
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
          // Update local state optimistically
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
        const { selectedWeek, selectedDay, weeks, weekDetailCache, fetchWeekDetail: fetch } = get();
        if (selectedWeek === null || selectedDay === null) return { type: "boundary" };

        const target = resolveNext(selectedWeek, selectedDay, weeks, weekDetailCache);
        if (!target) return { type: "boundary" };

        if (target.week !== selectedWeek) {
          await fetch(target.week);
        }
        set({ selectedWeek: target.week, selectedDay: target.day });

        // Prefetch adjacent week for next potential swipe
        const nextWeek = getAdjacentWeekNumber(target.week, weeks, "next");
        if (nextWeek !== null && !get().weekDetailCache[nextWeek]) {
          fetch(nextWeek);
        }

        return { type: "navigated", week: target.week, day: target.day };
      },

      navigatePrev: async () => {
        const { selectedWeek, selectedDay, weeks, weekDetailCache, fetchWeekDetail: fetch } = get();
        if (selectedWeek === null || selectedDay === null) return { type: "boundary" };

        const target = resolvePrev(selectedWeek, selectedDay, weeks, weekDetailCache);
        if (!target) return { type: "boundary" };

        if (target.week !== selectedWeek) {
          await fetch(target.week);
        }
        set({ selectedWeek: target.week, selectedDay: target.day });

        // Prefetch adjacent week for next potential swipe
        const prevWeek = getAdjacentWeekNumber(target.week, weeks, "prev");
        if (prevWeek !== null && !get().weekDetailCache[prevWeek]) {
          fetch(prevWeek);
        }

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
