import { Badge } from "@/components/ui/badge";
import { ExerciseDisplayContent } from "./ExerciseDisplayContent";
import type { DayExerciseData } from "@/lib/api";

interface SupersetCardProps {
  exercises: DayExerciseData[];
  displayOrder: number;
}

export function SupersetCard({ exercises, displayOrder }: SupersetCardProps) {
  return (
    <div className="py-4">
      <div className="mb-3 flex items-baseline gap-2">
        <span className="text-muted-foreground text-sm font-medium">
          {displayOrder}.
        </span>
        <Badge variant="outline" className="text-xs">
          Суперсет
        </Badge>
      </div>
      <div className="divide-y divide-border/50">
        {exercises.map((dayExercise, index) => (
          <ExerciseDisplayContent
            key={dayExercise.id}
            className={index === 0 ? "pb-3" : "pt-3"}
            exercise={dayExercise.exercise}
            sets={dayExercise.sets}
            notes={dayExercise.notes}
          />
        ))}
      </div>
    </div>
  );
}
