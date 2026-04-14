import { useCallback, useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

const HOLD_DURATION_MS = 1500;

interface CompletionButtonProps {
  completed: boolean;
  onToggle: () => void;
}

export function CompletionButton({ completed, onToggle }: CompletionButtonProps) {
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
    <div className="mt-6 mb-4 select-none">
      <button
        type="button"
        className={cn(
          "relative w-full overflow-hidden rounded-xl h-14 border transition-colors touch-none",
          completed
            ? "border-green-500/40 bg-green-500/5 text-green-700 dark:text-green-400"
            : "border-border bg-card text-foreground",
        )}
        onPointerDown={startHold}
        onPointerUp={cancelHold}
        onPointerLeave={cancelHold}
        onContextMenu={(e) => e.preventDefault()}
      >
        <span
          className={cn(
            "absolute inset-0 origin-left",
            completed ? "bg-red-500/20" : "bg-green-500/20",
          )}
          style={{ transform: `scaleX(${progress})` }}
        />
        <span className="relative z-10 flex items-center justify-center gap-2 text-sm font-medium pointer-events-none">
          {completed ? (
            <>
              <Check className="h-4 w-4" />
              <span>Завершено — удержи для отмены</span>
            </>
          ) : (
            <span>Завершить тренировку</span>
          )}
        </span>
      </button>
    </div>
  );
}
