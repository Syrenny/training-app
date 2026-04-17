import { ExerciseDisplayContent } from "./ExerciseDisplayContent";
import type { DayExerciseData } from "@/lib/api";

interface ExerciseCardProps {
  dayExercise: DayExerciseData;
  displayOrder: number;
}

export function ExerciseCard({ dayExercise, displayOrder }: ExerciseCardProps) {
  return (
    <ExerciseDisplayContent
      className="py-4"
      displayOrder={displayOrder}
      exercise={dayExercise.exercise}
      sets={dayExercise.sets}
      notes={dayExercise.notes}
    />
  );
}
