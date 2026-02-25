import type { ExerciseSetData } from "@/lib/api";

interface SetDisplayProps {
  set: ExerciseSetData;
}

export function SetDisplay({ set }: SetDisplayProps) {
  return (
    <span className="inline-block rounded bg-secondary px-2 py-1 text-sm font-mono">
      {set.display}
    </span>
  );
}
