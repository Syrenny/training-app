import { Input } from "@/components/ui/input";
import { History } from "lucide-react";
import { useProgramStore } from "@/lib/store";
import { useRef, useState } from "react";
import { AccessoryWeightHistory } from "./AccessoryWeightHistory";

interface AccessoryWeightInputProps {
  exerciseId: number;
  exerciseName: string;
  setsDisplay: string;
}

export function AccessoryWeightInput({
  exerciseId,
  exerciseName,
  setsDisplay,
}: AccessoryWeightInputProps) {
  const accessoryWeights = useProgramStore((s) => s.accessoryWeights);
  const saveAccessoryWeight = useProgramStore((s) => s.saveAccessoryWeight);

  const latest = accessoryWeights[exerciseId];
  const [value, setValue] = useState(latest?.weight ?? "");
  const [historyOpen, setHistoryOpen] = useState(false);
  const lastSaved = useRef(latest?.weight ?? "");

  // Sync when store updates from outside
  const storeWeight = latest?.weight ?? "";
  if (storeWeight !== lastSaved.current) {
    lastSaved.current = storeWeight;
    setValue(storeWeight);
  }

  const handleBlur = () => {
    const trimmed = value.trim();
    if (trimmed === "" || trimmed === lastSaved.current) return;
    const num = parseFloat(trimmed);
    if (isNaN(num) || num <= 0) {
      setValue(lastSaved.current);
      return;
    }
    lastSaved.current = trimmed;
    saveAccessoryWeight(exerciseId, num, setsDisplay);
  };

  return (
    <>
      <div className="flex items-center gap-1.5 mt-2">
        <Input
          type="number"
          inputMode="decimal"
          step="0.5"
          min="0"
          placeholder="—"
          className="w-14 h-7 px-1 text-sm text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onFocus={(e) => e.target.select()}
          onBlur={handleBlur}
        />
        <span className="text-muted-foreground text-xs">кг</span>
        <button
          type="button"
          className="ml-auto p-1 text-muted-foreground"
          onClick={() => setHistoryOpen(true)}
          aria-label="История весов"
        >
          <History className="h-3.5 w-3.5" />
        </button>
      </div>
      <AccessoryWeightHistory
        exerciseId={exerciseId}
        exerciseName={exerciseName}
        open={historyOpen}
        onOpenChange={setHistoryOpen}
      />
    </>
  );
}
