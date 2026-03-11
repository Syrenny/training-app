import { Check } from "lucide-react";
import { ExerciseCard } from "./ExerciseCard";
import { SupersetCard } from "./SupersetCard";
import { CompletionButton } from "./CompletionButton";
import type { DayExerciseData } from "@/lib/api";
import { calcTonnage } from "@/lib/calc";
import { useProgramStore } from "@/lib/store";

type ExerciseItem =
  | { type: "single"; exercise: DayExerciseData; displayOrder: number }
  | {
      type: "superset";
      group: number;
      exercises: DayExerciseData[];
      displayOrder: number;
    };

function groupExercises(exercises: DayExerciseData[]): ExerciseItem[] {
  const items: ExerciseItem[] = [];
  let i = 0;
  let displayOrder = 1;
  while (i < exercises.length) {
    const ex = exercises[i];
    if (ex.superset_group != null) {
      const grouped: DayExerciseData[] = [];
      const groupId = ex.superset_group;
      while (i < exercises.length && exercises[i].superset_group === groupId) {
        grouped.push(exercises[i]);
        i++;
      }
      items.push({ type: "superset", group: groupId, exercises: grouped, displayOrder });
    } else {
      items.push({ type: "single", exercise: ex, displayOrder });
      i++;
    }
    displayOrder++;
  }
  return items;
}

interface ExerciseListProps {
  exercises: DayExerciseData[];
  dayId: number;
}

function formatTonnage(value: number): string {
  return value >= 1000
    ? `${(value / 1000).toFixed(1)}т`
    : `${value}кг`;
}

export function ExerciseList({ exercises, dayId }: ExerciseListProps) {
  const completedDayIds = useProgramStore((s) => s.completedDayIds);
  const toggleCompletion = useProgramStore((s) => s.toggleCompletion);
  const oneRepMax = useProgramStore((s) => s.oneRepMax);

  const totalTonnage = exercises.reduce((sum, ex) => {
    if (ex.exercise.category === "ACCESSORY") return sum;
    const t = calcTonnage(ex.sets, ex.exercise.category, oneRepMax);
    return t != null ? sum + t : sum;
  }, 0);

  const isCompleted = completedDayIds.has(dayId);

  return (
    <div>
      {exercises.length > 0 && (
        <div className="flex items-center gap-2 mb-3">
          {totalTonnage > 0 && (
            <p className="text-muted-foreground text-sm">
              Тоннаж в базовых упражнениях: {formatTonnage(totalTonnage)}
            </p>
          )}
          {isCompleted && (
            <Check className="h-4 w-4 text-green-500 ml-auto shrink-0" />
          )}
        </div>
      )}
      {exercises.length === 0 ? (
        <p className="text-muted-foreground text-center py-8">
          Нет упражнений
        </p>
      ) : (
        groupExercises(exercises).map((item) =>
          item.type === "single" ? (
            <ExerciseCard
              key={item.exercise.id}
              dayExercise={item.exercise}
              displayOrder={item.displayOrder}
            />
          ) : (
            <SupersetCard
              key={`ss-${item.group}`}
              exercises={item.exercises}
              displayOrder={item.displayOrder}
            />
          ),
        )
      )}
      <CompletionButton
        dayId={dayId}
        completed={isCompleted}
        onToggle={() => toggleCompletion(dayId)}
      />
    </div>
  );
}
