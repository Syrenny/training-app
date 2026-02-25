import { ExerciseCard } from "./ExerciseCard";
import type { DayExerciseData } from "@/lib/api";

interface ExerciseListProps {
  exercises: DayExerciseData[];
}

export function ExerciseList({ exercises }: ExerciseListProps) {
  if (exercises.length === 0) {
    return (
      <p className="text-muted-foreground text-center py-8">
        Нет упражнений
      </p>
    );
  }

  return (
    <div>
      {exercises.map((dayExercise) => (
        <ExerciseCard key={dayExercise.id} dayExercise={dayExercise} />
      ))}
    </div>
  );
}
