import type { WeekDetailData, WeekListItem } from "./api";

export interface NavigationTarget {
  week: number;
  day: string;
}

export type NavigationResult =
  | { type: "navigated"; week: number; day: string }
  | { type: "boundary" };

export function resolveNext(
  currentWeek: number,
  currentDay: string,
  weeks: WeekListItem[],
  cache: Record<number, WeekDetailData>,
): NavigationTarget | null {
  const weekData = cache[currentWeek];
  if (!weekData) return null;

  const days = weekData.days;
  const currentIndex = days.findIndex((d) => d.weekday === currentDay);
  if (currentIndex === -1) return null;

  if (currentIndex < days.length - 1) {
    return { week: currentWeek, day: days[currentIndex + 1].weekday };
  }

  const nextWeek = getAdjacentWeekNumber(currentWeek, weeks, "next");
  if (nextWeek === null) return null;

  const nextWeekData = cache[nextWeek];
  if (!nextWeekData || nextWeekData.days.length === 0) return null;

  return { week: nextWeek, day: nextWeekData.days[0].weekday };
}

export function resolvePrev(
  currentWeek: number,
  currentDay: string,
  weeks: WeekListItem[],
  cache: Record<number, WeekDetailData>,
): NavigationTarget | null {
  const weekData = cache[currentWeek];
  if (!weekData) return null;

  const days = weekData.days;
  const currentIndex = days.findIndex((d) => d.weekday === currentDay);
  if (currentIndex === -1) return null;

  if (currentIndex > 0) {
    return { week: currentWeek, day: days[currentIndex - 1].weekday };
  }

  const prevWeek = getAdjacentWeekNumber(currentWeek, weeks, "prev");
  if (prevWeek === null) return null;

  const prevWeekData = cache[prevWeek];
  if (!prevWeekData || prevWeekData.days.length === 0) return null;

  const prevDays = prevWeekData.days;
  return { week: prevWeek, day: prevDays[prevDays.length - 1].weekday };
}

export function getAdjacentWeekNumber(
  currentWeek: number,
  weeks: WeekListItem[],
  direction: "next" | "prev",
): number | null {
  const sorted = [...weeks].sort((a, b) => a.number - b.number);
  const currentIndex = sorted.findIndex((w) => w.number === currentWeek);
  if (currentIndex === -1) return null;

  const targetIndex = direction === "next" ? currentIndex + 1 : currentIndex - 1;
  if (targetIndex < 0 || targetIndex >= sorted.length) return null;

  return sorted[targetIndex].number;
}
