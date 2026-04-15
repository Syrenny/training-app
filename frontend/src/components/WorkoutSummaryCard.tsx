import type { DayExerciseData } from "@/lib/api";

interface WorkoutSummaryCardProps {
  exercises: DayExerciseData[];
}

function countTotalSets(exercises: DayExerciseData[]): number {
  return exercises.reduce(
    (total, ex) => total + ex.sets.reduce((s, set) => s + set.sets, 0),
    0,
  );
}

function countExercises(exercises: DayExerciseData[]): number {
  const seen = new Set<number>();
  let count = 0;
  for (const ex of exercises) {
    const key = ex.superset_group;
    if (key != null) {
      if (!seen.has(key)) {
        seen.add(key);
        count++;
      }
    } else {
      count++;
    }
  }
  return count;
}

function estimateAvgTime(exercises: DayExerciseData[]): number {
  const WORK_TIME_PER_SET = 1;

  let total = 0;
  for (const ex of exercises) {
    const sets = ex.sets.reduce((s, set) => s + set.sets, 0);
    if (sets === 0) continue;

    const restPeriods = sets - 1;
    const isBase = ex.exercise.category !== "ACCESSORY";
    const avgRest = isBase ? 4 : 2.5;

    total += sets * WORK_TIME_PER_SET + restPeriods * avgRest;
  }

  return Math.round(total);
}

export function WorkoutSummaryCard({
  exercises,
}: WorkoutSummaryCardProps) {
  const totalSets = countTotalSets(exercises);
  const exerciseCount = countExercises(exercises);
  const avgTime = estimateAvgTime(exercises);

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
      <span>{exerciseCount} упр</span>
      <span aria-hidden="true">•</span>
      <span>{totalSets} подх</span>
      <span aria-hidden="true">•</span>
      <span>~{avgTime} мин</span>
    </div>
  );
}
