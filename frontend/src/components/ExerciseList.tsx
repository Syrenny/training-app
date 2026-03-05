import { ExerciseCard } from "./ExerciseCard";
import { CompletionButton } from "./CompletionButton";
import type { DayExerciseData } from "@/lib/api";
import { useProgramStore } from "@/lib/store";

interface ExerciseListProps {
  exercises: DayExerciseData[];
  dayId: number;
}

export function ExerciseList({ exercises, dayId }: ExerciseListProps) {
  const completedDayIds = useProgramStore((s) => s.completedDayIds);
  const toggleCompletion = useProgramStore((s) => s.toggleCompletion);

  return (
    <div>
      {exercises.length === 0 ? (
        <p className="text-muted-foreground text-center py-8">
          Нет упражнений
        </p>
      ) : (
        exercises.map((dayExercise) => (
          <ExerciseCard key={dayExercise.id} dayExercise={dayExercise} />
        ))
      )}
      <CompletionButton
        dayId={dayId}
        completed={completedDayIds.has(dayId)}
        onToggle={() => toggleCompletion(dayId)}
      />
    </div>
  );
}
