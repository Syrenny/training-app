import { useCallback, useEffect, useMemo, useState } from "react";
import { RotateCcw, Save } from "lucide-react";
import { useProgramStore } from "@/lib/store";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type SaveStatus = "idle" | "saving" | "saved" | "error";

export function OneRepMaxPage() {
  const programs = useProgramStore((s) => s.programs);
  const selectedProgram = useProgramStore((s) => s.selectedProgram);
  const fetchPrograms = useProgramStore((s) => s.fetchPrograms);
  const fetchProgram = useProgramStore((s) => s.fetchProgram);
  const fetchOneRepMax = useProgramStore((s) => s.fetchOneRepMax);
  const selectProgram = useProgramStore((s) => s.selectProgram);
  const resetCompletions = useProgramStore((s) => s.resetCompletions);
  const oneRepMax = useProgramStore((s) => s.oneRepMax);
  const saveOneRepMax = useProgramStore((s) => s.saveOneRepMax);
  const [draft, setDraft] = useState<Record<number, number>>({});
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [programNotice, setProgramNotice] = useState<string | null>(null);

  useEffect(() => {
    void Promise.all([fetchPrograms(), fetchProgram(), fetchOneRepMax()]);
  }, [fetchPrograms, fetchProgram, fetchOneRepMax]);

  const items = useMemo(() => {
    if (oneRepMax && oneRepMax.program_id === selectedProgram?.id) {
      return oneRepMax.items;
    }
    return (
      selectedProgram?.one_rep_max_exercises.map((item) => ({
        exercise_id: item.exercise_id,
        exercise_name: item.exercise.name,
        category: item.exercise.category,
        label: item.label || item.exercise.name,
        value: 0,
      })) ?? []
    );
  }, [oneRepMax, selectedProgram]);

  const getValue = (exerciseId: number) => draft[exerciseId] ?? items.find(
    (item) => item.exercise_id === exerciseId,
  )?.value ?? "";

  const handleChange = useCallback(
    (exerciseId: number, raw: string) => {
      const digits = raw.replace(/\D/g, "").slice(0, 3);
      const value = digits === "" ? 0 : parseInt(digits, 10);
      setDraft((prev) => ({ ...prev, [exerciseId]: value }));
      setStatus("idle");
    },
    [],
  );

  const handleProgramChange = useCallback(
    async (value: string) => {
      await selectProgram(Number(value));
      setDraft({});
      setStatus("idle");
      setProgramNotice("Программа переключена.");
    },
    [selectProgram],
  );

  const handleResetCompletions = useCallback(async () => {
    await resetCompletions();
  }, [resetCompletions]);

  const handleSave = useCallback(async () => {
    if (Object.keys(draft).length === 0) return;
    setStatus("saving");
    try {
      await saveOneRepMax({
        items: Object.entries(draft).map(([exerciseId, value]) => ({
          exercise_id: Number(exerciseId),
          value,
        })),
      });
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
            <p>Программа и 1ПМ</p>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleResetCompletions}
            >
              <RotateCcw className="h-4 w-4" />
              Сбросить отметки
            </Button>
          </div>
        </CardTitle>
        <CardDescription>
          Сначала выберите программу. Ниже показываются только те разовые максимумы,
          которые нужны именно ей.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-3">
          <label className="block text-sm text-muted-foreground">Программа</label>
          <Select
            value={selectedProgram ? String(selectedProgram.id) : undefined}
            onValueChange={handleProgramChange}
            disabled={programs.length === 0}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Выберите программу" />
            </SelectTrigger>
            <SelectContent>
              {programs.map((program) => (
                <SelectItem key={program.id} value={String(program.id)}>
                  {program.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedProgram?.description ? (
            <p className="text-sm text-muted-foreground">{selectedProgram.description}</p>
          ) : null}
          {programNotice ? (
            <p className="text-sm text-muted-foreground">{programNotice}</p>
          ) : null}
        </div>

        <div className="border-t pt-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">Разовые максимумы</p>
              <p className="text-sm text-muted-foreground">
                Используются для расчета процентов в выбранной программе.
              </p>
            </div>
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

          {items.map((item) => (
            <div key={item.exercise_id} className="mb-4">
              <label className="mb-1 block text-sm text-muted-foreground">
                {item.label}, кг
              </label>
              <Input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={3}
                value={getValue(item.exercise_id) || ""}
                onChange={(e) => handleChange(item.exercise_id, e.target.value)}
                placeholder="0"
              />
            </div>
          ))}

          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Для этой программы пока не настроены упражнения 1ПМ.
            </p>
          ) : null}

          {status === "saved" && (
            <p className="text-center text-sm text-green-600">Сохранено</p>
          )}
          {status === "error" && (
            <p className="text-center text-sm text-destructive">
              Ошибка сохранения
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
