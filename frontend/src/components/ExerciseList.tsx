import { ExerciseCard } from "./ExerciseCard";
import { SupersetCard } from "./SupersetCard";
import { CompletionButton } from "./CompletionButton";
import { WorkoutSummaryCard } from "./WorkoutSummaryCard";
import { Card, CardContent } from "@/components/ui/card";
import type { DayExerciseData } from "@/lib/api";
import { completionKey, useProgramStore } from "@/lib/store";

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
  weekNumber: number;
  weekday: string;
}

export function ExerciseList({ exercises, weekNumber, weekday }: ExerciseListProps) {
  const completions = useProgramStore((s) => s.completions);
  const toggleCompletion = useProgramStore((s) => s.toggleCompletion);

  const key = completionKey(weekNumber, weekday);
  const completionDate = completions.get(key);
  const isCompleted = completionDate != null;

  return (
    <div>
      <Card className="mb-5 gap-0 rounded-2xl border-transparent bg-transparent py-0 shadow-none">
        <CardContent className="px-4 py-3">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
          {exercises.length > 0 ? (
            <WorkoutSummaryCard
              exercises={exercises}
            />
          ) : (
            <p className="text-sm text-muted-foreground">
                  В этой тренировке пока нет упражнений.
                </p>
              )}
            </div>
            <CompletionButton
              completed={isCompleted}
              completionDate={completionDate}
              onToggle={() => toggleCompletion(weekNumber, weekday)}
            />
          </div>
        </CardContent>
      </Card>
      {exercises.length === 0 ? (
        <p className="text-muted-foreground text-center py-8">
          Нет упражнений
        </p>
      ) : (
        <div className="divide-y divide-border/70 border-y border-border/70">
          {groupExercises(exercises).map((item) =>
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
          )}
        </div>
      )}
    </div>
  );
}
