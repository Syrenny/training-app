import { useCallback, useState } from "react";
import { useProgramStore } from "@/lib/store";
import type { OneRepMaxData } from "@/lib/api";

const FIELDS = [
  { key: "bench" as const, label: "Жим лежа" },
  { key: "squat" as const, label: "Присед" },
  { key: "deadlift" as const, label: "Тяга" },
];

type SaveStatus = "idle" | "saving" | "saved" | "error";

export function OneRepMaxPage() {
  const oneRepMax = useProgramStore((s) => s.oneRepMax);
  const saveOneRepMax = useProgramStore((s) => s.saveOneRepMax);
  const [draft, setDraft] = useState<Partial<OneRepMaxData>>({});
  const [status, setStatus] = useState<SaveStatus>("idle");

  const getValue = (key: keyof OneRepMaxData) =>
    draft[key] ?? oneRepMax?.[key] ?? "";

  const handleChange = useCallback(
    (field: keyof OneRepMaxData, raw: string) => {
      const digits = raw.replace(/\D/g, "").slice(0, 3);
      const value = digits === "" ? 0 : parseInt(digits, 10);
      setDraft((prev) => ({ ...prev, [field]: value }));
      setStatus("idle");
    },
    [],
  );

  const handleSave = useCallback(async () => {
    if (Object.keys(draft).length === 0) return;
    setStatus("saving");
    try {
      await saveOneRepMax(draft);
      setDraft({});
      setStatus("saved");
    } catch {
      setStatus("error");
    }
  }, [draft, saveOneRepMax]);

  const hasDraftChanges = Object.keys(draft).length > 0;

  return (
    <div className="space-y-4 py-2">
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
            value={getValue(key) || ""}
            onChange={(e) => handleChange(key, e.target.value)}
            placeholder="0"
          />
        </div>
      ))}

      <button
        className="w-full h-10 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:pointer-events-none"
        onClick={handleSave}
        disabled={!hasDraftChanges || status === "saving"}
      >
        {status === "saving" ? "Сохранение..." : "Сохранить"}
      </button>

      {status === "saved" && (
        <p className="text-sm text-green-600 text-center">Сохранено</p>
      )}
      {status === "error" && (
        <p className="text-sm text-destructive text-center">
          Ошибка сохранения
        </p>
      )}
    </div>
  );
}
