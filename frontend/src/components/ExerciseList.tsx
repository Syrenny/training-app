import { Check } from "lucide-react";
import { ExerciseCard } from "./ExerciseCard";
import { SupersetCard } from "./SupersetCard";
import { CompletionButton } from "./CompletionButton";
import type { DayExerciseData } from "@/lib/api";
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

function formatCompletionDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}

export function ExerciseList({ exercises, dayId }: ExerciseListProps) {
  const completions = useProgramStore((s) => s.completions);
  const toggleCompletion = useProgramStore((s) => s.toggleCompletion);

  const completionDate = completions.get(dayId);
  const isCompleted = completionDate != null;

  return (
    <div>
      {exercises.length > 0 && isCompleted && (
        <div className="flex items-center justify-end gap-1.5 mb-3">
          <Check className="h-4 w-4 text-green-500 shrink-0" />
          <span className="text-xs text-green-500">
            {formatCompletionDate(completionDate)}
          </span>
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
