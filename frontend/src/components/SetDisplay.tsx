import { Dumbbell } from "lucide-react";
import type { ExerciseSetData } from "@/lib/api";

interface SetDisplayProps {
  set: ExerciseSetData;
}

export function SetDisplay({ set }: SetDisplayProps) {
  const parts = set.display.split("🏋");

  if (parts.length === 1) {
    return (
      <span className="inline-block rounded bg-secondary px-2 py-1 text-sm font-mono">
        {set.display}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center rounded bg-secondary px-2 py-1 text-sm font-mono gap-0.5">
      {parts[0]}
      <Dumbbell className="h-3.5 w-3.5 inline-block -translate-y-px" />
      {parts[1]}
    </span>
  );
}
