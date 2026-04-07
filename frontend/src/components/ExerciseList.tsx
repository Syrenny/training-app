import { ExerciseCard } from "./ExerciseCard";
import { SupersetCard } from "./SupersetCard";
import { CompletionButton } from "./CompletionButton";
import { WorkoutSummaryCard } from "./WorkoutSummaryCard";
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

export function ExerciseList({ exercises, dayId }: ExerciseListProps) {
  const completions = useProgramStore((s) => s.completions);
  const toggleCompletion = useProgramStore((s) => s.toggleCompletion);

  const completionDate = completions.get(dayId);
  const isCompleted = completionDate != null;

  return (
    <div>
      {exercises.length > 0 && (
        <WorkoutSummaryCard
          exercises={exercises}
          isCompleted={isCompleted}
          completionDate={completionDate}
        />
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
