import { useCallback, useState } from "react";
import { Save } from "lucide-react";
import { useProgramStore } from "@/lib/store";
import type { OneRepMaxData } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

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
    <Card>
      <CardHeader>
        <CardTitle>
          <div className="flex items-center justify-between gap-3">
            <p>Разовые максимумы</p>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSave}
              disabled={!hasDraftChanges || status === "saving"}
            >
              <Save className="h-4 w-4" />
              {status === "saving" ? "Сохранение..." : "Сохранить"}
            </Button>
          </div>
        </CardTitle>
        <CardDescription>Используются для расчета процентов в программе.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {FIELDS.map(({ key, label }) => (
          <div key={key}>
            <label className="mb-1 block text-sm text-muted-foreground">
              {label}, кг
            </label>
            <Input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={3}
              value={getValue(key) || ""}
              onChange={(e) => handleChange(key, e.target.value)}
              placeholder="0"
            />
          </div>
        ))}

        {status === "saved" && (
          <p className="text-center text-sm text-green-600">Сохранено</p>
        )}
        {status === "error" && (
          <p className="text-center text-sm text-destructive">
            Ошибка сохранения
          </p>
        )}
      </CardContent>
    </Card>
  );
}
