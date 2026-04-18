import { useEffect, useMemo, useState } from "react";
import { MinusCircle, PencilLine } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import type {
  DayExerciseData,
  ExerciseData,
  ProgramAdaptation,
  ProgramAdaptationInput,
} from "@/lib/api";
import { createProgramAdaptation, fetchExercises, fetchProgramAdaptations } from "@/lib/api";
import { useProgramStore } from "@/lib/store";

type PendingAction =
  | {
      action: "DELETE";
      exercise: DayExerciseData;
      weekNumber: number;
      weekday: string;
    }
  | {
      action: "REPLACE";
      exercise: DayExerciseData;
      weekNumber: number;
      weekday: string;
    };

const SCOPE_LABELS = {
  ONLY_HERE: "Только здесь",
  CURRENT_CYCLE: "До конца текущего цикла",
  FUTURE_CYCLES: "Во всех будущих циклах",
} as const;

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ProgramAdaptationsPage() {
  const activeCycle = useProgramStore((s) => s.activeCycle);
  const selectedProgram = useProgramStore((s) => s.selectedProgram);
  const weeks = useProgramStore((s) => s.weeks);
  const weekDetailCache = useProgramStore((s) => s.weekDetailCache);
  const fetchProgram = useProgramStore((s) => s.fetchProgram);
  const fetchPrograms = useProgramStore((s) => s.fetchPrograms);
  const fetchActiveCycle = useProgramStore((s) => s.fetchActiveCycle);

  const [catalog, setCatalog] = useState<ExerciseData[]>([]);
  const [adaptations, setAdaptations] = useState<ProgramAdaptation[]>([]);
  const [selectedWeek, setSelectedWeek] = useState<number | null>(null);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [scope, setScope] = useState<ProgramAdaptationInput["scope"]>("FUTURE_CYCLES");
  const [replacementExerciseId, setReplacementExerciseId] = useState<string>("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        setLoading(true);
        await Promise.all([fetchPrograms(), fetchActiveCycle(), fetchProgram()]);
        const exercises = await fetchExercises();
        if (!mounted) return;
        setCatalog(exercises);
      } catch {
        if (!mounted) return;
        setError("Не удалось загрузить редактор адаптаций");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void load();
    return () => {
      mounted = false;
    };
  }, [fetchProgram, fetchPrograms, fetchActiveCycle]);

  useEffect(() => {
    if (!selectedProgram) return;
    void (async () => {
      try {
        setAdaptations(await fetchProgramAdaptations(selectedProgram.id));
      } catch {
        setAdaptations([]);
      }
    })();
  }, [selectedProgram?.id]);

  useEffect(() => {
    if (weeks.length === 0) {
      setSelectedWeek(null);
      setSelectedDay(null);
      return;
    }
    setSelectedWeek((current) => {
      if (current != null && weeks.some((week) => week.number === current)) {
        return current;
      }
      return weeks[0].number;
    });
  }, [weeks]);

  const week = selectedWeek != null ? weekDetailCache[selectedWeek] : null;

  useEffect(() => {
    const days = week?.days ?? [];
    if (days.length === 0) {
      setSelectedDay(null);
      return;
    }
    setSelectedDay((current) => {
      if (current && days.some((day) => day.weekday === current)) {
        return current;
      }
      return days[0].weekday;
    });
  }, [week]);

  const day = useMemo(
    () => week?.days.find((item) => item.weekday === selectedDay) ?? null,
    [week, selectedDay],
  );

  const scopeOptions = useMemo(() => {
    if (activeCycle && selectedProgram && activeCycle.program_id === selectedProgram.id) {
      return [
        { value: "ONLY_HERE" as const, label: SCOPE_LABELS.ONLY_HERE },
        { value: "CURRENT_CYCLE" as const, label: SCOPE_LABELS.CURRENT_CYCLE },
        { value: "FUTURE_CYCLES" as const, label: SCOPE_LABELS.FUTURE_CYCLES },
      ];
    }
    return [{ value: "FUTURE_CYCLES" as const, label: SCOPE_LABELS.FUTURE_CYCLES }];
  }, [activeCycle, selectedProgram]);

  useEffect(() => {
    setScope(scopeOptions[0]?.value ?? "FUTURE_CYCLES");
  }, [scopeOptions]);

  function openAction(nextPending: PendingAction) {
    setPending(nextPending);
    setReplacementExerciseId("");
    setReason("");
    setScope(scopeOptions[0]?.value ?? "FUTURE_CYCLES");
    setError(null);
  }

  function closeAction() {
    setPending(null);
    setReplacementExerciseId("");
    setReason("");
    setSubmitting(false);
  }

  async function handleSubmit() {
    if (!pending || !selectedProgram) return;
    if (pending.action === "REPLACE" && !replacementExerciseId) return;

    setSubmitting(true);
    try {
      await createProgramAdaptation({
        program_id: selectedProgram.id,
        scope,
        action: pending.action,
        slot_key: pending.exercise.slot_key,
        week_number: pending.weekNumber,
        weekday: pending.weekday,
        original_exercise_id: pending.exercise.exercise.id,
        replacement_exercise_id:
          pending.action === "REPLACE" ? Number(replacementExerciseId) : null,
        reason,
      });
      await fetchProgram();
      setAdaptations(await fetchProgramAdaptations(selectedProgram.id));
      closeAction();
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Не удалось сохранить адаптацию",
      );
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="hide-scrollbar min-h-0 flex-1 overflow-y-auto">
      <div className="space-y-4 px-4 py-4">
        <Card>
          <CardHeader>
            <CardTitle>Адаптации пользователя</CardTitle>
            <CardDescription>
              Адаптации накладываются на базовую программу. Активный цикл меняется только по вашему явному действию.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="block text-sm text-muted-foreground">Неделя</label>
                <Select
                  value={selectedWeek ? String(selectedWeek) : undefined}
                  onValueChange={(value) => setSelectedWeek(Number(value))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Неделя" />
                  </SelectTrigger>
                  <SelectContent>
                    {weeks.map((item) => (
                      <SelectItem key={item.number} value={String(item.number)}>
                        {item.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="block text-sm text-muted-foreground">День</label>
                <Select value={selectedDay ?? undefined} onValueChange={setSelectedDay}>
                  <SelectTrigger>
                    <SelectValue placeholder="День" />
                  </SelectTrigger>
                  <SelectContent>
                    {(week?.days ?? []).map((item) => (
                      <SelectItem key={item.weekday} value={item.weekday}>
                        {item.weekday_display}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {activeCycle ? (
              <div className="rounded-2xl border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
                Активный цикл зафиксирован с {formatDateTime(activeCycle.started_at)}. Области
                «только здесь» и «до конца текущего цикла» меняют его явно, а «во всех будущих циклах»
                повлияет только на последующие старты.
              </div>
            ) : (
              <div className="rounded-2xl border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
                Сейчас активного цикла нет, поэтому можно сохранять адаптации только для будущих циклов.
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Упражнения дня</CardTitle>
            <CardDescription>
              Пока доступны два действия: удалить или заменить упражнение на другое.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {day?.exercises.length ? (
              day.exercises.map((exercise) => (
                <div
                  key={exercise.slot_key}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-border p-4"
                >
                  <div className="min-w-0">
                    <p className="font-medium">{exercise.exercise.name}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {exercise.sets.map((set) => set.display).join(", ")}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        openAction({
                          action: "DELETE",
                          exercise,
                          weekNumber: week?.number ?? 1,
                          weekday: day.weekday,
                        })
                      }
                    >
                      <MinusCircle className="h-4 w-4" />
                      Удалить
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        openAction({
                          action: "REPLACE",
                          exercise,
                          weekNumber: week?.number ?? 1,
                          weekday: day.weekday,
                        })
                      }
                    >
                      <PencilLine className="h-4 w-4" />
                      Заменить
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">В выбранном дне нет упражнений.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Список адаптаций</CardTitle>
            <CardDescription>
              Ниже показаны все пользовательские адаптации для выбранной программы.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {adaptations.length === 0 ? (
              <p className="text-sm text-muted-foreground">Пока адаптаций нет.</p>
            ) : (
              adaptations.map((item) => (
                <div key={item.id} className="rounded-2xl border border-border p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">{item.action_label}</Badge>
                    <Badge variant="outline">{item.scope_label}</Badge>
                    <span className="text-xs text-muted-foreground">
                      Неделя {item.week_number}, {item.weekday}
                    </span>
                  </div>
                  <p className="mt-3 text-sm">
                    {item.original_exercise_name ?? "Упражнение"}
                    {item.replacement_exercise_name ? ` → ${item.replacement_exercise_name}` : ""}
                  </p>
                  {item.reason ? (
                    <p className="mt-2 text-sm text-muted-foreground">{item.reason}</p>
                  ) : null}
                  <p className="mt-2 text-xs text-muted-foreground">
                    Создано {formatDateTime(item.created_at)}
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={pending != null} onOpenChange={(open) => (!open ? closeAction() : null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {pending?.action === "DELETE" ? "Удалить упражнение" : "Заменить упражнение"}
            </DialogTitle>
            <DialogDescription>
              {pending?.exercise.exercise.name ?? "Упражнение"} — выберите область действия и,
              если нужно, упражнение-замену.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1">
              <label className="block text-sm text-muted-foreground">Область действия</label>
              <Select value={scope} onValueChange={(value) => setScope(value as ProgramAdaptationInput["scope"])}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {scopeOptions.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {pending?.action === "REPLACE" ? (
              <div className="space-y-1">
                <label className="block text-sm text-muted-foreground">Новое упражнение</label>
                <Select value={replacementExerciseId} onValueChange={setReplacementExerciseId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Выберите упражнение" />
                  </SelectTrigger>
                  <SelectContent>
                    {catalog.map((item) => (
                      <SelectItem key={item.id} value={String(item.id)}>
                        {item.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            <div className="space-y-1">
              <label className="block text-sm text-muted-foreground">Зачем адаптация</label>
              <Input
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Например: локоть не терпит этот вариант"
              />
            </div>

            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeAction}>
              Отмена
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? "Сохраняю..." : "Сохранить адаптацию"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
