import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SetDisplay } from "./SetDisplay";
import type { DayExerciseData } from "@/lib/api";

const categoryLabels: Record<string, string> = {
  BENCH: "Жим",
  SQUAT: "Присед",
  DEADLIFT: "Тяга",
  ACCESSORY: "Подсобка",
};

interface ExerciseCardProps {
  dayExercise: DayExerciseData;
}

export function ExerciseCard({ dayExercise }: ExerciseCardProps) {
  const { exercise, sets, order } = dayExercise;

  return (
    <Card className="mb-3">
      <CardContent>
        <div className="flex items-start gap-2 mb-2">
          <span className="text-muted-foreground text-sm font-medium">
            {order}.
          </span>
          <span className="font-semibold">{exercise.name}</span>
          <Badge variant="secondary" className="text-xs ml-auto shrink-0">
            {categoryLabels[exercise.category] ?? exercise.category}
          </Badge>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {sets.map((set) => (
            <SetDisplay key={set.id} set={set} category={exercise.category} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
