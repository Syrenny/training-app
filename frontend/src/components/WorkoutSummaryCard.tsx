import { Check } from "lucide-react";
import { Badge } from "./ui/badge";
import type { DayExerciseData } from "@/lib/api";
import { cn } from "@/lib/utils";

interface WorkoutSummaryCardProps {
  exercises: DayExerciseData[];
  isCompleted: boolean;
  completionDate?: string;
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

function formatCompletionDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}

export function WorkoutSummaryCard({
  exercises,
  isCompleted,
  completionDate,
}: WorkoutSummaryCardProps) {
  const totalSets = countTotalSets(exercises);
  const exerciseCount = countExercises(exercises);
  const avgTime = estimateAvgTime(exercises);

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <Badge variant="secondary">{exerciseCount} упр</Badge>
      <Badge variant="secondary">{totalSets} подх</Badge>
      <Badge variant="secondary">~{avgTime} мин</Badge>
      {isCompleted && completionDate && (
        <Badge
          className={cn(
            "ml-auto bg-green-500/15 text-green-600",
            "border-green-500/30",
          )}
        >
          <Check className="h-3 w-3" />
          {formatCompletionDate(completionDate)}
        </Badge>
      )}
    </div>
  );
}

