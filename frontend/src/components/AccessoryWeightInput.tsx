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
  setsDisplay,
}: AccessoryWeightInputProps) {
  const accessoryWeights = useProgramStore((s) => s.accessoryWeights);
  const saveAccessoryWeight = useProgramStore((s) => s.saveAccessoryWeight);

  const latest = accessoryWeights[exerciseId];
  const [value, setValue] = useState(latest?.weight ?? "");
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
    <div className="flex items-baseline gap-0">
      <Input
        type="number"
        inputMode="decimal"
        step="0.5"
        min="0"
        placeholder=""
        className="h-5 w-13 rounded-none border-0 border-b border-border bg-transparent px-0 text-left text-sm font-medium shadow-none ring-0 [appearance:textfield] focus-visible:ring-0 [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none bg-none text-center"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onFocus={(e) => e.target.select()}
        onBlur={handleBlur}
      />
      <span className="text-muted-foreground text-sm">кг</span>
    </div>
  );
}

export function AccessoryWeightHistoryButton({
  exerciseId,
  exerciseName,
}: Pick<AccessoryWeightInputProps, "exerciseId" | "exerciseName">) {
  const [historyOpen, setHistoryOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className="p-1 text-muted-foreground"
        onClick={() => setHistoryOpen(true)}
        aria-label="История весов"
      >
        <History className="h-3.5 w-3.5" />
      </button>
      <AccessoryWeightHistory
        exerciseId={exerciseId}
        exerciseName={exerciseName}
        open={historyOpen}
        onOpenChange={setHistoryOpen}
      />
    </>
  );
}
