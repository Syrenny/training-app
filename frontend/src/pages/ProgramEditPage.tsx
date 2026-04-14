import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  History,
  Plus,
  RotateCcw,
  Save,
  Trash2,
} from "lucide-react";
import type {
  ExerciseData,
  ProgramData,
  ProgramHistoryItem,
  ProgramSnapshotInput,
} from "@/lib/api";
import {
  fetchExercises,
  fetchProgram,
  fetchProgramHistory,
  fetchProgramHistoryDetail,
  saveProgramSnapshot,
} from "@/lib/api";
import { useProgramStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WeekPicker } from "@/components/WeekPicker";

const WEEKDAY_OPTIONS = [
  { value: "MON", label: "Понедельник" },
  { value: "TUE", label: "Вторник" },
  { value: "WED", label: "Среда" },
  { value: "THU", label: "Четверг" },
  { value: "FRI", label: "Пятница" },
  { value: "SAT", label: "Суббота" },
  { value: "SUN", label: "Воскресенье" },
];

const WEEKDAY_SHORT_LABELS: Record<string, string> = {
  MON: "Пн",
  TUE: "Вт",
  WED: "Ср",
  THU: "Чт",
  FRI: "Пт",
  SAT: "Сб",
  SUN: "Вс",
};

const WEEKDAY_ORDER = Object.fromEntries(
  WEEKDAY_OPTIONS.map((option, index) => [option.value, index]),
);

type LoadType = "PERCENT" | "KG" | "INDIVIDUAL" | "BODYWEIGHT";

interface DraftSet {
  uid: string;
  loadType: LoadType;
  loadValue: string;
  reps: string;
  sets: string;
}

interface DraftExercise {
  uid: string;
  exerciseId: number;
  supersetGroup: string;
  sets: DraftSet[];
}

interface DraftDay {
  uid: string;
  weekday: string;
  exercises: DraftExercise[];
}

interface DraftWeek {
  uid: string;
  title: string;
  days: DraftDay[];
}

interface DraftProgram {
  sourceSnapshotVersion: number | null;
  weeks: DraftWeek[];
}

interface ProgramEditPageProps {
  onClose?: () => void;
}

function createUid() {
  return crypto.randomUUID();
}

function draftSet(set: ProgramData["weeks"][number]["days"][number]["exercises"][number]["sets"][number]): DraftSet {
  return {
    uid: createUid(),
    loadType: set.load_type,
    loadValue: set.load_value == null ? "" : String(set.load_value),
    reps: String(set.reps),
    sets: String(set.sets),
  };
}

function draftFromProgram(program: ProgramData): DraftProgram {
  return {
    sourceSnapshotVersion: program.version,
    weeks: program.weeks.map((week) => ({
      uid: createUid(),
      title: week.title,
      days: week.days.map((day) => ({
        uid: createUid(),
        weekday: day.weekday,
        exercises: day.exercises.map((exercise) => ({
          uid: createUid(),
          exerciseId: exercise.exercise.id,
          supersetGroup:
            exercise.superset_group == null ? "" : String(exercise.superset_group),
          sets: exercise.sets.map(draftSet),
        })),
      })),
    })),
  };
}

function emptySet(): DraftSet {
  return {
    uid: createUid(),
    loadType: "INDIVIDUAL",
    loadValue: "",
    reps: "10",
    sets: "3",
  };
}

function emptyExercise(exercises: ExerciseData[]): DraftExercise {
  return {
    uid: createUid(),
    exerciseId: exercises[0]?.id ?? 0,
    supersetGroup: "",
    sets: [emptySet()],
  };
}

function buildSavePayload(draft: DraftProgram, commitMessage: string): ProgramSnapshotInput {
  return {
    commit_message: commitMessage.trim(),
    source_snapshot_version: draft.sourceSnapshotVersion,
    weeks: draft.weeks.map((week) => ({
      title: week.title,
      days: week.days.map((day) => ({
        weekday: day.weekday,
        exercises: day.exercises.map((exercise) => ({
          exercise: exercise.exerciseId,
          superset_group: exercise.supersetGroup ? Number(exercise.supersetGroup) : null,
          sets: exercise.sets.map((set) => ({
            load_type: set.loadType,
            load_value:
              set.loadType === "PERCENT" || set.loadType === "KG"
                ? Number(set.loadValue || 0)
                : null,
            reps: Number(set.reps || 0),
            sets: Number(set.sets || 0),
          })),
        })),
      })),
    })),
  };
}

function sortDays(days: DraftDay[]) {
  return [...days].sort(
    (left, right) =>
      (WEEKDAY_ORDER[left.weekday] ?? Number.MAX_SAFE_INTEGER)
      - (WEEKDAY_ORDER[right.weekday] ?? Number.MAX_SAFE_INTEGER),
  );
}

function structuralSignature(draft: DraftProgram) {
  return JSON.stringify(
    draft.weeks.map((week) => ({
      title: week.title,
      days: week.days.map((day) => day.weekday),
    })),
  );
}

function isSetValid(set: DraftSet) {
  if (!set.reps || Number(set.reps) <= 0 || !set.sets || Number(set.sets) <= 0) {
    return false;
  }
  if ((set.loadType === "PERCENT" || set.loadType === "KG") && !set.loadValue) {
    return false;
  }
  return true;
}

function isDraftValid(draft: DraftProgram) {
  return draft.weeks.every((week) =>
    week.days.every((day) =>
      day.exercises.every(
        (exercise) =>
          exercise.exerciseId > 0 &&
          exercise.sets.length > 0 &&
          exercise.sets.every(isSetValid),
      ),
    ),
  );
}

export function ProgramEditPage({ onClose }: ProgramEditPageProps) {
  const refreshProgram = useProgramStore((s) => s.fetchProgram);
  const refreshCompletions = useProgramStore((s) => s.fetchCompletions);
  const resetCompletions = useProgramStore((s) => s.resetCompletions);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [savedProgram, setSavedProgram] = useState<ProgramData | null>(null);
  const [draft, setDraft] = useState<DraftProgram | null>(null);
  const [history, setHistory] = useState<ProgramHistoryItem[]>([]);
  const [catalog, setCatalog] = useState<ExerciseData[]>([]);
  const [selectedWeekUid, setSelectedWeekUid] = useState<string | null>(null);
  const [selectedDayUid, setSelectedDayUid] = useState<string | null>(null);
  const [newDayWeekday, setNewDayWeekday] = useState("MON");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [initialSignature, setInitialSignature] = useState("");
  const [commitInputValue, setCommitInputValue] = useState("");
  const [commitInputKey, setCommitInputKey] = useState(0);
  const commitInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        setLoading(true);
        const [program, exercises, items] = await Promise.all([
          fetchProgram(),
          fetchExercises(),
          fetchProgramHistory().catch(() => []),
        ]);
        if (!mounted) return;
        const nextDraft = draftFromProgram(program);
        setSavedProgram(program);
        setDraft(nextDraft);
        setCatalog(exercises);
        setHistory(items);
        setInitialSignature(structuralSignature(nextDraft));
        setSelectedWeekUid(nextDraft.weeks[0]?.uid ?? null);
        setSelectedDayUid(nextDraft.weeks[0]?.days[0]?.uid ?? null);
        setCommitInputValue("");
        setCommitInputKey((value) => value + 1);
        setError(null);
      } catch {
        if (!mounted) return;
        setError("Не удалось загрузить редактор программы");
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, []);

  const selectedWeek = useMemo(
    () => draft?.weeks.find((week) => week.uid === selectedWeekUid) ?? null,
    [draft, selectedWeekUid],
  );
  const selectedDay = useMemo(
    () => selectedWeek?.days.find((day) => day.uid === selectedDayUid) ?? null,
    [selectedWeek, selectedDayUid],
  );

  const remainingWeekdays = useMemo(() => {
    if (!selectedWeek) return WEEKDAY_OPTIONS;
    const used = new Set(selectedWeek.days.map((day) => day.weekday));
    return WEEKDAY_OPTIONS.filter((option) => !used.has(option.value));
  }, [selectedWeek]);
  const editorWeeks = useMemo(
    () =>
      draft?.weeks.map((week, index) => ({
        id: week.uid,
        number: index + 1,
        title: week.title || `${index + 1} неделя`,
      })) ?? [],
    [draft],
  );
  const selectedWeekNumber = useMemo(
    () =>
      draft?.weeks.findIndex((week) => week.uid === selectedWeekUid) !== -1
        ? (draft?.weeks.findIndex((week) => week.uid === selectedWeekUid) ?? 0) + 1
        : null,
    [draft, selectedWeekUid],
  );

  const hasStructuralChanges = draft ? structuralSignature(draft) !== initialSignature : false;
  const canSave = draft != null && catalog.length > 0 && isDraftValid(draft) && !saving;

  function getCommitMessage() {
    return commitInputRef.current?.value.trim() ?? "";
  }

  function resetEditorToProgram(program: ProgramData, commitMessage = "") {
    const nextDraft = draftFromProgram(program);
    setDraft(nextDraft);
    setSelectedWeekUid(nextDraft.weeks[0]?.uid ?? null);
    setSelectedDayUid(nextDraft.weeks[0]?.days[0]?.uid ?? null);
    setCommitInputValue(commitMessage);
    setCommitInputKey((value) => value + 1);
    setError(null);
  }

  useEffect(() => {
    if (!selectedWeek && draft?.weeks.length) {
      setSelectedWeekUid(draft.weeks[0].uid);
      setSelectedDayUid(draft.weeks[0].days[0]?.uid ?? null);
    }
  }, [draft, selectedWeek]);

  useEffect(() => {
    if (!selectedWeek) return;
    if (!selectedWeek.days.some((day) => day.uid === selectedDayUid)) {
      setSelectedDayUid(selectedWeek.days[0]?.uid ?? null);
      setNewDayWeekday(
        WEEKDAY_OPTIONS.find((option) => !selectedWeek.days.some((day) => day.weekday === option.value))?.value ?? "MON",
      );
    }
  }, [selectedWeek, selectedDayUid]);

  function updateDraft(mutator: (current: DraftProgram) => DraftProgram) {
    setDraft((current) => (current ? mutator(current) : current));
  }

  function updateSelectedWeek(mutator: (week: DraftWeek) => DraftWeek) {
    updateDraft((current) => ({
      ...current,
      weeks: current.weeks.map((week) =>
        week.uid === selectedWeekUid ? mutator(week) : week,
      ),
    }));
  }

  function updateSelectedDay(mutator: (day: DraftDay) => DraftDay) {
    updateSelectedWeek((week) => ({
      ...week,
      days: week.days.map((day) => (day.uid === selectedDayUid ? mutator(day) : day)),
    }));
  }

  function addDay() {
    if (!selectedWeek || !remainingWeekdays.length) return;
    const weekday = remainingWeekdays.find((option) => option.value === newDayWeekday)?.value
      ?? remainingWeekdays[0].value;
    const nextDay: DraftDay = {
      uid: createUid(),
      weekday,
      exercises: [],
    };
    updateSelectedWeek((week) => ({ ...week, days: sortDays([...week.days, nextDay]) }));
    setSelectedDayUid(nextDay.uid);
  }

  function addWeek() {
    updateDraft((current) => {
      const nextWeek: DraftWeek = {
        uid: createUid(),
        title: `${current.weeks.length + 1} неделя`,
        days: [],
      };
      setSelectedWeekUid(nextWeek.uid);
      setSelectedDayUid(null);
      return {
        ...current,
        weeks: [...current.weeks, nextWeek],
      };
    });
  }

  function selectWeekByNumber(weekNumber: number) {
    const nextWeek = draft?.weeks[weekNumber - 1];
    if (!nextWeek) return;
    setSelectedWeekUid(nextWeek.uid);
    setSelectedDayUid(nextWeek.days[0]?.uid ?? null);
  }

  function cancelAllChanges() {
    if (!savedProgram) return;
    resetEditorToProgram(savedProgram);
    setNotice("Несохраненные изменения отменены.");
    setHistoryOpen(false);
    setConfirmOpen(false);
  }

  function removeWeek(weekUid: string) {
    updateDraft((current) => {
      const weeks = current.weeks.filter((week) => week.uid !== weekUid);
      const nextWeek = weeks[0] ?? null;
      setSelectedWeekUid(nextWeek?.uid ?? null);
      setSelectedDayUid(nextWeek?.days[0]?.uid ?? null);
      return { ...current, weeks };
    });
  }

  function removeDay(dayUid: string) {
    updateSelectedWeek((week) => {
      const days = week.days.filter((day) => day.uid !== dayUid);
      setSelectedDayUid(days[0]?.uid ?? null);
      return { ...week, days };
    });
  }

  function moveExercise(uid: string, direction: -1 | 1) {
    updateSelectedDay((day) => {
      const index = day.exercises.findIndex((exercise) => exercise.uid === uid);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= day.exercises.length) return day;
      const exercises = [...day.exercises];
      [exercises[index], exercises[target]] = [exercises[target], exercises[index]];
      return { ...day, exercises };
    });
  }

  function moveSet(exerciseUid: string, setUid: string, direction: -1 | 1) {
    updateSelectedDay((day) => ({
      ...day,
      exercises: day.exercises.map((exercise) => {
        if (exercise.uid !== exerciseUid) return exercise;
        const index = exercise.sets.findIndex((set) => set.uid === setUid);
        const target = index + direction;
        if (index < 0 || target < 0 || target >= exercise.sets.length) return exercise;
        const sets = [...exercise.sets];
        [sets[index], sets[target]] = [sets[target], sets[index]];
        return { ...exercise, sets };
      }),
    }));
  }

  function updateExerciseField(
    exerciseUid: string,
    updater: (exercise: DraftExercise) => DraftExercise,
  ) {
    updateSelectedDay((currentDay) => ({
      ...currentDay,
      exercises: currentDay.exercises.map((item) =>
        item.uid === exerciseUid ? updater(item) : item,
      ),
    }));
  }

  function updateSetField(
    exerciseUid: string,
    setUid: string,
    updater: (set: DraftSet) => DraftSet,
  ) {
    updateExerciseField(exerciseUid, (exercise) => ({
      ...exercise,
      sets: exercise.sets.map((entry) => (entry.uid === setUid ? updater(entry) : entry)),
    }));
  }

  async function performSave() {
    if (!draft || !canSave) return;
    const commitMessage = getCommitMessage();
    if (!commitMessage) {
      setError("Добавьте комментарий к сохранению.");
      setConfirmOpen(false);
      return;
    }
    try {
      setSaving(true);
      setError(null);
      const result = await saveProgramSnapshot(buildSavePayload(draft, commitMessage));
      const nextDraft = draftFromProgram(result);
      setSavedProgram(result);
      const items = await fetchProgramHistory().catch(() => history);
      setDraft(nextDraft);
      setHistory(items);
      setInitialSignature(structuralSignature(nextDraft));
      setSelectedWeekUid(nextDraft.weeks[0]?.uid ?? null);
      setSelectedDayUid(nextDraft.weeks[0]?.days[0]?.uid ?? null);
      setCommitInputValue("");
      setCommitInputKey((value) => value + 1);
      setNotice("Снапшот программы сохранен.");
      await refreshProgram();
      await refreshCompletions();
      onClose?.();
    } catch {
      setError("Не удалось сохранить программу");
    } finally {
      setSaving(false);
      setConfirmOpen(false);
    }
  }

  async function restoreVersion(version: number) {
    try {
      const program = await fetchProgramHistoryDetail(version);
      resetEditorToProgram(
        program,
        `Восстановление версии ${version}${program.commit_message ? `: ${program.commit_message}` : ""}`,
      );
      setNotice(`В редактор загружена версия ${version}. Сохраните ее как новый снапшот.`);
      setHistoryOpen(false);
    } catch {
      setError("Не удалось загрузить выбранную версию");
    }
  }

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center px-4">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!draft) {
    return (
      <div className="px-4 py-6">
        <p className="text-sm text-destructive">{error ?? "Редактор недоступен"}</p>
        <Button className="mt-4" variant="outline" onClick={onClose}>
          Вернуться
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-1 min-h-0 flex-col bg-muted/20">
      <div className="shrink-0 border-b bg-background px-4 py-4">
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">Редактор тренировки</p>
            <p className="text-xs text-muted-foreground">
              Сохраняет программу целиком как новый снапшот.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setHistoryOpen(true)}>
            <History className="h-4 w-4" />
            История
          </Button>
          <Button variant="outline" size="sm" onClick={cancelAllChanges}>
            Отменить все
          </Button>
          <Button size="sm" onClick={() => (hasStructuralChanges ? setConfirmOpen(true) : performSave())} disabled={!canSave}>
            <Save className="h-4 w-4" />
            {saving ? "Сохранение..." : "Сохранить"}
          </Button>
        </div>
      </div>

      <div className="hide-scrollbar min-h-0 flex-1 overflow-y-auto">
        <div className="space-y-4 px-4 py-4">
          <Card className="border-amber-200 bg-amber-50/70">
            <CardContent className="space-y-3 text-sm text-amber-950">
              <p className="font-medium">
                История выполнений привязана только к номеру недели и дню недели.
              </p>
              <p>
                После структурных изменений отметки выполненных тренировок могут перестать
                соответствовать новой программе. При необходимости сбросьте их вручную.
              </p>
              <Button variant="outline" size="sm" onClick={() => resetCompletions()}>
                <RotateCcw className="h-4 w-4" />
                Сбросить отметки выполнения
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm font-semibold">Комментарий к сохранению</p>
                <p className="text-xs text-muted-foreground">
                  Это обязательный коммит снапшота. Без него сохранить изменения нельзя.
                </p>
              </div>
              <Input
                key={commitInputKey}
                ref={commitInputRef}
                placeholder="Например: добавил субботу и обновил подсобку на 2 неделе"
                defaultValue={commitInputValue}
              />
            </CardContent>
          </Card>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          {notice ? <p className="text-sm text-muted-foreground">{notice}</p> : null}

          <div className="flex items-center gap-2">
            <div className="flex-1">
              <WeekPicker
                items={editorWeeks}
                selectedNumber={selectedWeekNumber}
                onSelect={selectWeekByNumber}
              />
            </div>
            <Button variant="outline" size="sm" onClick={addWeek}>
              <Plus className="h-4 w-4" />
              Добавить неделю
            </Button>
          </div>

          {!selectedWeek ? (
            <Card>
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                В программе не осталось недель. Историю можно использовать для восстановления.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{selectedWeek.title}</p>
                  <p className="text-xs text-muted-foreground">
                    Удаление недели сдвинет нумерацию следующих недель при сохранении.
                  </p>
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => removeWeek(selectedWeek.uid)}
                >
                  <Trash2 className="h-4 w-4" />
                  Удалить неделю
                </Button>
              </div>

              <div className="flex flex-wrap items-center gap-2 rounded-xl border border-dashed p-3">
                <Select value={newDayWeekday} onValueChange={setNewDayWeekday}>
                  <SelectTrigger className="w-full sm:w-52">
                    <SelectValue placeholder="Добавить день" />
                  </SelectTrigger>
                  <SelectContent>
                    {remainingWeekdays.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={addDay}
                  disabled={remainingWeekdays.length === 0}
                >
                  <Plus className="h-4 w-4" />
                  Добавить день
                </Button>
              </div>

              {selectedWeek.days.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  В этой неделе пока нет тренировочных дней.
                </p>
              ) : (
                <Tabs
                  value={selectedDay?.uid}
                  onValueChange={(value) => setSelectedDayUid(value)}
                >
                  <TabsList className="w-full">
                    {selectedWeek.days.map((day) => (
                      <TabsTrigger key={day.uid} value={day.uid} className="flex-1">
                        {WEEKDAY_SHORT_LABELS[day.weekday] ?? day.weekday}
                      </TabsTrigger>
                    ))}
                  </TabsList>

                    {selectedDay ? (
                      <TabsContent value={selectedDay.uid} className="space-y-3">
                        <div className="flex flex-wrap items-center gap-2 rounded-xl border p-3">
                          <p className="min-w-0 flex-1 text-sm text-muted-foreground">
                            {WEEKDAY_OPTIONS.find((option) => option.value === selectedDay.weekday)?.label ?? selectedDay.weekday}
                          </p>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => removeDay(selectedDay.uid)}
                          >
                            <Trash2 className="h-4 w-4" />
                            Удалить день
                          </Button>
                        </div>

                        {selectedDay.exercises.map((exercise, exerciseIndex) => (
                          <Card key={exercise.uid}>
                            <CardContent className="space-y-4">
                              <div className="flex flex-wrap items-center gap-2">
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-semibold">
                                    Упражнение {exerciseIndex + 1}
                                  </p>
                                </div>
                                <Button
                                  variant="outline"
                                  size="icon-sm"
                                  onClick={() => moveExercise(exercise.uid, -1)}
                                  disabled={exerciseIndex === 0}
                                >
                                  <ChevronUp className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="icon-sm"
                                  onClick={() => moveExercise(exercise.uid, 1)}
                                  disabled={exerciseIndex === selectedDay.exercises.length - 1}
                                >
                                  <ChevronDown className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="destructive"
                                  size="icon-sm"
                                  onClick={() =>
                                    updateSelectedDay((currentDay) => ({
                                      ...currentDay,
                                      exercises: currentDay.exercises.filter((item) => item.uid !== exercise.uid),
                                    }))
                                  }
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>

                              <div className="grid gap-3 md:grid-cols-[minmax(0,2fr)_140px]">
                                <Select
                                  value={String(exercise.exerciseId)}
                                  onValueChange={(value) =>
                                    updateExerciseField(exercise.uid, (item) => ({
                                      ...item,
                                      exerciseId: Number(value),
                                    }))
                                  }
                                >
                                  <SelectTrigger className="w-full">
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
                                <Input
                                  key={`${exercise.uid}:superset:${exercise.supersetGroup}`}
                                  type="number"
                                  min="1"
                                  placeholder="Суперсет"
                                  defaultValue={exercise.supersetGroup}
                                  onBlur={(event) =>
                                    updateExerciseField(exercise.uid, (item) => ({
                                      ...item,
                                      supersetGroup: event.target.value,
                                    }))
                                  }
                                />
                              </div>

                              <div className="space-y-3">
                                {exercise.sets.map((set, setIndex) => (
                                  <div key={set.uid} className="rounded-xl border bg-muted/30 p-3">
                                    <div className="mb-3 flex items-center gap-2">
                                      <p className="min-w-0 flex-1 text-sm font-medium">
                                        Подход {setIndex + 1}
                                      </p>
                                      <Button
                                        variant="outline"
                                        size="icon-xs"
                                        onClick={() => moveSet(exercise.uid, set.uid, -1)}
                                        disabled={setIndex === 0}
                                      >
                                        <ChevronUp className="h-3 w-3" />
                                      </Button>
                                      <Button
                                        variant="outline"
                                        size="icon-xs"
                                        onClick={() => moveSet(exercise.uid, set.uid, 1)}
                                        disabled={setIndex === exercise.sets.length - 1}
                                      >
                                        <ChevronDown className="h-3 w-3" />
                                      </Button>
                                      <Button
                                        variant="destructive"
                                        size="icon-xs"
                                        onClick={() =>
                                          updateSelectedDay((currentDay) => ({
                                            ...currentDay,
                                            exercises: currentDay.exercises.map((item) =>
                                              item.uid === exercise.uid
                                                ? {
                                                    ...item,
                                                    sets: item.sets.filter((entry) => entry.uid !== set.uid),
                                                  }
                                                : item,
                                            ),
                                          }))
                                        }
                                        disabled={exercise.sets.length === 1}
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </Button>
                                    </div>

                                    <div className="grid gap-3 md:grid-cols-4">
                                      <Select
                                        value={set.loadType}
                                        onValueChange={(value: LoadType) =>
                                          updateSetField(exercise.uid, set.uid, (entry) => ({
                                            ...entry,
                                            loadType: value,
                                            loadValue:
                                              value === "PERCENT" || value === "KG"
                                                ? entry.loadValue
                                                : "",
                                          }))
                                        }
                                      >
                                        <SelectTrigger className="w-full">
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="PERCENT">Процент</SelectItem>
                                          <SelectItem value="KG">Килограммы</SelectItem>
                                          <SelectItem value="INDIVIDUAL">Индивидуально</SelectItem>
                                          <SelectItem value="BODYWEIGHT">Собственный вес</SelectItem>
                                        </SelectContent>
                                      </Select>
                                      <Input
                                        key={`${set.uid}:load:${set.loadType}:${set.loadValue}`}
                                        type="number"
                                        step="0.5"
                                        placeholder="Вес / %"
                                        disabled={set.loadType === "INDIVIDUAL" || set.loadType === "BODYWEIGHT"}
                                        defaultValue={set.loadValue}
                                        onBlur={(event) =>
                                          updateSetField(exercise.uid, set.uid, (entry) => ({
                                            ...entry,
                                            loadValue: event.target.value,
                                          }))
                                        }
                                      />
                                      <Input
                                        key={`${set.uid}:reps:${set.reps}`}
                                        type="number"
                                        min="1"
                                        placeholder="Повторы"
                                        defaultValue={set.reps}
                                        onBlur={(event) =>
                                          updateSetField(exercise.uid, set.uid, (entry) => ({
                                            ...entry,
                                            reps: event.target.value,
                                          }))
                                        }
                                      />
                                      <Input
                                        key={`${set.uid}:sets:${set.sets}`}
                                        type="number"
                                        min="1"
                                        placeholder="Подходы"
                                        defaultValue={set.sets}
                                        onBlur={(event) =>
                                          updateSetField(exercise.uid, set.uid, (entry) => ({
                                            ...entry,
                                            sets: event.target.value,
                                          }))
                                        }
                                      />
                                    </div>
                                  </div>
                                ))}
                              </div>

                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  updateExerciseField(exercise.uid, (item) => ({
                                    ...item,
                                    sets: [...item.sets, emptySet()],
                                  }))
                                }
                              >
                                <Plus className="h-4 w-4" />
                                Добавить подход
                              </Button>
                            </CardContent>
                          </Card>
                        ))}

                        <Button
                          variant="outline"
                          onClick={() =>
                            updateSelectedDay((currentDay) => ({
                              ...currentDay,
                              exercises: [...currentDay.exercises, emptyExercise(catalog)],
                            }))
                          }
                        >
                          <Plus className="h-4 w-4" />
                          Добавить упражнение
                        </Button>
                      </TabsContent>
                  ) : null}
                </Tabs>
              )}
            </div>
          )}
        </div>
      </div>

      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>История изменений</DialogTitle>
            <DialogDescription>
              Любую сохраненную версию можно загрузить в редактор и сохранить как новый снапшот.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {history.length === 0 ? (
              <p className="text-sm text-muted-foreground">Пока нет сохраненных версий.</p>
            ) : (
              history.map((item) => (
                <div key={item.version} className="rounded-xl border p-3">
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">Версия {item.version}</p>
                      <p className="mt-1 text-sm">{item.commit_message || "Без комментария"}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(item.created_at).toLocaleString()}
                      </p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        Недель: {item.week_count}, дней: {item.day_count}, упражнений: {item.exercise_count}
                      </p>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => restoreVersion(item.version)}>
                      Загрузить
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Сохранить структурные изменения?</DialogTitle>
            <DialogDescription>
              После удаления недель или дней старые отметки выполнения могут больше не совпадать
              с программой.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Отмена
            </Button>
            <Button onClick={performSave} disabled={!canSave}>
              Продолжить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
