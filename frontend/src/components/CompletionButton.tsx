import { useCallback, useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

const HOLD_DURATION_MS = 1500;

interface CompletionButtonProps {
  completed: boolean;
  completionDate?: string;
  onToggle: () => void;
}

function formatCompletionDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}

export function CompletionButton({
  completed,
  completionDate,
  onToggle,
}: CompletionButtonProps) {
  const [progress, setProgress] = useState(0);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);
  const holdingRef = useRef(false);

  const startHold = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      holdingRef.current = true;
      startRef.current = performance.now();

      const tick = (now: number) => {
        if (!holdingRef.current) return;
        const elapsed = now - (startRef.current ?? now);
        const p = Math.min(elapsed / HOLD_DURATION_MS, 1);
        setProgress(p);
        if (p < 1) {
          rafRef.current = requestAnimationFrame(tick);
        } else {
          holdingRef.current = false;
          setProgress(0);
          onToggle();
        }
      };

      rafRef.current = requestAnimationFrame(tick);
    },
    [onToggle],
  );

  const cancelHold = useCallback(() => {
    if (!holdingRef.current) return;
    holdingRef.current = false;
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    startRef.current = null;
    setProgress(0);
  }, []);

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <button
      type="button"
      aria-label={completed ? "Отменить завершение тренировки" : "Завершить тренировку"}
      title={completed ? "Удерживайте, чтобы отменить завершение" : "Удерживайте, чтобы завершить тренировку"}
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full px-3 py-0.5 text-xs font-medium whitespace-nowrap transition-colors touch-none w-24",
        completed
          ? " bg-green-500/15 text-green-600 dark:text-green-400"
          : "border-border bg-secondary text-secondary-foreground",
      )}
      onPointerDown={startHold}
      onPointerUp={cancelHold}
      onPointerLeave={cancelHold}
      onPointerCancel={cancelHold}
      onContextMenu={(e) => e.preventDefault()}
    >
      <span
        className={cn(
          "absolute inset-0 origin-left",
          completed ? "bg-red-500/15" : "bg-green-500/15",
        )}
        style={{ transform: `scaleX(${progress})` }}
      />
      <span className="pointer-events-none relative z-10 inline-flex items-center gap-1">
        {completed && completionDate ? <Check className="h-3 w-3" /> : null}
        {completed && completionDate ? formatCompletionDate(completionDate) : "Завершить"}
      </span>
    </button>
  );
}
