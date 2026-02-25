import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { OneRepMaxData, WeekDetailData, WeekListItem } from "./api";
import {
  fetchOneRepMax as apiFetchOneRepMax,
  fetchWeekDetail as apiFetchWeekDetail,
  fetchWeeks as apiFetchWeeks,
  saveOneRepMax as apiSaveOneRepMax,
} from "./api";

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

  // Actions
  setWeek: (week: number) => void;
  setDay: (day: string) => void;
  fetchWeeks: () => Promise<void>;
  fetchWeekDetail: (weekNumber: number) => Promise<void>;
  fetchOneRepMax: () => Promise<void>;
  saveOneRepMax: (data: Partial<OneRepMaxData>) => Promise<void>;
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

      setWeek: (week) => set({ selectedWeek: week, selectedDay: null }),

      setDay: (day) => set({ selectedDay: day }),

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
