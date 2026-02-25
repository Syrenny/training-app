import { useCallback, useEffect, useRef } from "react";
import { useProgramStore } from "@/lib/store";

const FIELDS = [
  { key: "bench" as const, label: "Жим лёжа" },
  { key: "squat" as const, label: "Присед" },
  { key: "deadlift" as const, label: "Тяга" },
];

export function OneRepMaxPage() {
  const oneRepMax = useProgramStore((s) => s.oneRepMax);
  const saveOneRepMax = useProgramStore((s) => s.saveOneRepMax);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleChange = useCallback(
    (field: "bench" | "squat" | "deadlift", raw: string) => {
      const digits = raw.replace(/\D/g, "").slice(0, 3);
      const value = digits === "" ? 0 : parseInt(digits, 10);

      // Optimistic update
      useProgramStore.setState((s) => ({
        oneRepMax: s.oneRepMax
          ? { ...s.oneRepMax, [field]: value }
          : { bench: 0, squat: 0, deadlift: 0, [field]: value },
      }));

      // Debounced save
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        saveOneRepMax({ [field]: value });
      }, 500);
    },
    [saveOneRepMax],
  );

  return (
    <div className="space-y-4 py-2">
      <h3 className="text-lg font-semibold">Разовые максимумы (1ПМ)</h3>
      {FIELDS.map(({ key, label }) => (
        <div key={key}>
          <label className="text-sm text-muted-foreground mb-1 block">
            {label}, кг
          </label>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={3}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            value={oneRepMax?.[key] || ""}
            onChange={(e) => handleChange(key, e.target.value)}
            placeholder="0"
          />
        </div>
      ))}
    </div>
  );
}
