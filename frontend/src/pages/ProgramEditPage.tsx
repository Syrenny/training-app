import { useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Pencil,
  History,
  Plus,
  RotateCcw,
  Save,
  Trash2,
} from "lucide-react";
import type {
  ExerciseSetData,
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
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WeekPicker } from "@/components/WeekPicker";
import { SetDisplay } from "@/components/SetDisplay";
import { calcTonnage } from "@/lib/calc";

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

const categoryLabels: Record<string, string> = {
  BENCH: "Жим",
  SQUAT: "Присед",
  DEADLIFT: "Тяга",
  ACCESSORY: "Подсобка",
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

interface SetEditorState {
  exerciseUid: string;
  setUid: string | null;
  draft: DraftSet;
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

function renderDraftSetDisplay(set: DraftSet) {
  const parts: string[] = [];
  if (set.loadType === "PERCENT") {
    parts.push(`${set.loadValue}%`);
  } else if (set.loadType === "KG") {
    parts.push(`${set.loadValue}кг`);
  } else if (set.loadType === "INDIVIDUAL") {
    parts.push("🏋");
  }
  parts.push(set.reps);
  if (Number(set.sets || 0) > 1) {
    parts.push(set.sets);
  }
  return parts.join("×");
}

function toPreviewSetData(set: DraftSet, id: string, order = 1): ExerciseSetData {
  return {
    id,
    order,
    load_type: set.loadType,
    load_value:
      set.loadType === "PERCENT" || set.loadType === "KG"
        ? Number(set.loadValue || 0)
        : null,
    reps: Number(set.reps || 0),
    sets: Number(set.sets || 0),
    display: renderDraftSetDisplay(set),
  };
}

type ExerciseGroupItem =
  | { type: "single"; exercise: DraftExercise; displayOrder: number }
  | {
      type: "superset";
      group: string;
      exercises: DraftExercise[];
      displayOrder: number;
    };

function groupDraftExercises(exercises: DraftExercise[]) {
  const items: ExerciseGroupItem[] = [];
  let i = 0;
  let displayOrder = 1;

  while (i < exercises.length) {
    const current = exercises[i];
    if (current.supersetGroup) {
      const grouped: DraftExercise[] = [];
      const groupId = current.supersetGroup;
      while (i < exercises.length && exercises[i].supersetGroup === groupId) {
        grouped.push(exercises[i]);
        i += 1;
      }
      items.push({ type: "superset", group: groupId, exercises: grouped, displayOrder });
    } else {
      items.push({ type: "single", exercise: current, displayOrder });
      i += 1;
    }
    displayOrder += 1;
  }

  return items;
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
  const oneRepMax = useProgramStore((s) => s.oneRepMax);

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
  const [addDayOpen, setAddDayOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteWeekConfirmOpen, setDeleteWeekConfirmOpen] = useState(false);
  const [initialSignature, setInitialSignature] = useState("");
  const [commitMessage, setCommitMessage] = useState("");
  const [setEditor, setSetEditor] = useState<SetEditorState | null>(null);

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
        setCommitMessage("");
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

  function resetEditorToProgram(program: ProgramData, commitMessage = "") {
    const nextDraft = draftFromProgram(program);
    setDraft(nextDraft);
    setSelectedWeekUid(nextDraft.weeks[0]?.uid ?? null);
    setSelectedDayUid(nextDraft.weeks[0]?.days[0]?.uid ?? null);
    setCommitMessage(commitMessage);
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
    setAddDayOpen(false);
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

  function openSetEditor(exerciseUid: string, setUid: string | null, initial?: DraftSet) {
    setSetEditor({
      exerciseUid,
      setUid,
      draft: initial
        ? { ...initial }
        : {
            uid: createUid(),
            loadType: "INDIVIDUAL",
            loadValue: "",
            reps: "10",
            sets: "3",
          },
    });
  }

  function saveSetEditor() {
    if (!setEditor || !isSetValid(setEditor.draft)) {
      return;
    }

    if (setEditor.setUid) {
      updateSetField(setEditor.exerciseUid, setEditor.setUid, () => ({
        ...setEditor.draft,
        uid: setEditor.setUid!,
      }));
    } else {
      updateExerciseField(setEditor.exerciseUid, (exercise) => ({
        ...exercise,
        sets: [...exercise.sets, { ...setEditor.draft }],
      }));
    }

    setSetEditor(null);
  }

  function deleteEditedSet() {
    if (!setEditor?.setUid) {
      setSetEditor(null);
      return;
    }

    updateExerciseField(setEditor.exerciseUid, (exercise) => ({
      ...exercise,
      sets: exercise.sets.filter((entry) => entry.uid !== setEditor.setUid),
    }));
    setSetEditor(null);
  }

  function getExerciseMeta(exerciseId: number) {
    return catalog.find((entry) => entry.id === exerciseId) ?? null;
  }

  function getExerciseIndex(exerciseUid: string) {
    return selectedDay?.exercises.findIndex((entry) => entry.uid === exerciseUid) ?? -1;
  }

  function renderSetPills(exercise: DraftExercise) {
    const exerciseMeta = getExerciseMeta(exercise.exerciseId);

    return (
      <div className="flex flex-wrap gap-1.5">
        {exercise.sets.map((set, index) => (
          <button
            key={set.uid}
            type="button"
            className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={() => openSetEditor(exercise.uid, set.uid, set)}
          >
            <SetDisplay
              set={toPreviewSetData(set, `${exercise.uid}:${index}`, index + 1)}
              category={exerciseMeta?.category}
            />
          </button>
        ))}
        <Button
          type="button"
          variant="outline"
          size="icon-xs"
          className="h-7 w-7 shrink-0 rounded-md border-dashed"
          onClick={() => openSetEditor(exercise.uid, null, emptySet())}
        >
          <Plus className="h-3 w-3" />
        </Button>
      </div>
    );
  }

  function renderExerciseToolbar(exercise: DraftExercise) {
    const exerciseIndex = getExerciseIndex(exercise.uid);
    const isFirst = exerciseIndex <= 0;
    const isLast = selectedDay == null || exerciseIndex === selectedDay.exercises.length - 1;

    return (
      <div className="mt-4 flex flex-wrap items-center gap-2 border-t pt-4">
        <Select
          value={String(exercise.exerciseId)}
          onValueChange={(value) =>
            updateExerciseField(exercise.uid, (entry) => ({
              ...entry,
              exerciseId: Number(value),
            }))
          }
        >
          <SelectTrigger className="min-w-0 flex-1 sm:min-w-72">
            <SelectValue placeholder="Выберите упражнение" />
          </SelectTrigger>
          <SelectContent>
            {catalog.map((entry) => (
              <SelectItem key={entry.id} value={String(entry.id)}>
                {entry.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          key={`${exercise.uid}:superset:${exercise.supersetGroup}`}
          type="number"
          min="1"
          placeholder="Суперсет"
          className="w-28"
          defaultValue={exercise.supersetGroup}
          onBlur={(event) =>
            updateExerciseField(exercise.uid, (entry) => ({
              ...entry,
              supersetGroup: event.target.value,
            }))
          }
        />
        <Button
          variant="outline"
          size="icon-sm"
          onClick={() => moveExercise(exercise.uid, -1)}
          disabled={isFirst}
        >
          <ChevronUp className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="icon-sm"
          onClick={() => moveExercise(exercise.uid, 1)}
          disabled={isLast}
        >
          <ChevronDown className="h-4 w-4" />
        </Button>
        <Button
          variant="destructive"
          size="icon-sm"
          onClick={() =>
            updateSelectedDay((currentDay) => ({
              ...currentDay,
              exercises: currentDay.exercises.filter((entry) => entry.uid !== exercise.uid),
            }))
          }
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  function renderExercisePreview(
    exercise: DraftExercise,
    displayOrder?: number,
  ) {
    const exerciseMeta = getExerciseMeta(exercise.exerciseId);
    const previewSets = exercise.sets.map((set, index) =>
      toPreviewSetData(set, `${exercise.uid}:${index}`, index + 1),
    );
    const tonnage =
      exerciseMeta && exerciseMeta.category !== "ACCESSORY"
        ? calcTonnage(previewSets, exerciseMeta.category, oneRepMax)
        : null;

    return (
      <>
        <div className="mb-2 flex items-baseline gap-2">
          {displayOrder != null ? (
            <span className="text-muted-foreground text-sm font-medium">
              {displayOrder}.
            </span>
          ) : null}
          <span className="font-semibold">
            {exerciseMeta?.name ?? "Упражнение"}
          </span>
          <Badge variant="secondary" className="ml-auto shrink-0 text-xs">
            {exerciseMeta ? categoryLabels[exerciseMeta.category] : "Упражнение"}
          </Badge>
        </div>
        {renderSetPills(exercise)}
        {tonnage != null ? (
          <p className="mt-2 text-xs text-muted-foreground">
            Тоннаж: {tonnage >= 1000 ? `${(tonnage / 1000).toFixed(1)}т` : `${tonnage}кг`}
          </p>
        ) : null}
      </>
    );
  }

  async function performSave() {
    if (!draft || !canSave) return;
    const nextCommitMessage = commitMessage.trim();
    if (!nextCommitMessage) {
      setError("Добавьте комментарий к сохранению.");
      return;
    }
    try {
      setSaving(true);
      setError(null);
      const result = await saveProgramSnapshot(buildSavePayload(draft, nextCommitMessage));
      const nextDraft = draftFromProgram(result);
      setSavedProgram(result);
      const items = await fetchProgramHistory().catch(() => history);
      setDraft(nextDraft);
      setHistory(items);
      setInitialSignature(structuralSignature(nextDraft));
      setSelectedWeekUid(nextDraft.weeks[0]?.uid ?? null);
      setSelectedDayUid(nextDraft.weeks[0]?.days[0]?.uid ?? null);
      setCommitMessage("");
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
      <div className="shrink-0 border-b bg-background px-4 py-3">
        <div className="flex items-center gap-2">
          <p className="min-w-0 flex-1 text-base font-semibold">Редактор</p>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="История"
            onClick={() => setHistoryOpen(true)}
          >
            <History className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Отменить все"
            onClick={cancelAllChanges}
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
          <Button
            size="icon-sm"
            aria-label={saving ? "Сохранение" : "Сохранить"}
            onClick={() => setConfirmOpen(true)}
            disabled={!canSave}
          >
            <Save className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="hide-scrollbar min-h-0 flex-1 overflow-y-auto">
        <div className="space-y-4 px-4 py-4">
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
            <Button
              variant="destructive"
              size="icon-sm"
              aria-label="Удалить неделю"
              onClick={() => setDeleteWeekConfirmOpen(true)}
              disabled={!selectedWeek}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
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
              {selectedWeek.days.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  В этой неделе пока нет тренировочных дней.
                </p>
              ) : (
                <Tabs
                  value={selectedDay?.uid}
                  onValueChange={(value) => setSelectedDayUid(value)}
                >
                  <div className="flex items-center gap-2">
                    <TabsList className="w-full">
                      {selectedWeek.days.map((day) => (
                        <TabsTrigger key={day.uid} value={day.uid} className="flex-1">
                          {WEEKDAY_SHORT_LABELS[day.weekday] ?? day.weekday}
                        </TabsTrigger>
                      ))}
                    </TabsList>
                    <Button
                      variant="outline"
                      size="icon-sm"
                      aria-label="Добавить день"
                      onClick={() => {
                        if (!remainingWeekdays.length) return;
                        setNewDayWeekday(remainingWeekdays[0]?.value ?? "MON");
                        setAddDayOpen(true);
                      }}
                      disabled={!selectedWeek || remainingWeekdays.length === 0}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>

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

                        {groupDraftExercises(selectedDay.exercises).map((item) =>
                          item.type === "single" ? (
                            <Card key={item.exercise.uid} className="mb-3">
                              <CardContent>
                                {renderExercisePreview(item.exercise, item.displayOrder)}
                                {renderExerciseToolbar(item.exercise)}
                              </CardContent>
                            </Card>
                          ) : (
                            <Card
                              key={`superset-${item.group}`}
                              className="mb-3 border-l-4 border-l-primary"
                            >
                              <CardContent>
                                <div className="mb-3 flex items-baseline gap-2">
                                  <span className="text-muted-foreground text-sm font-medium">
                                    {item.displayOrder}.
                                  </span>
                                  <Badge variant="outline" className="text-xs">
                                    Суперсет
                                  </Badge>
                                </div>
                                <div className="space-y-4">
                                  {item.exercises.map((exercise, exerciseIndex) => (
                                    <div
                                      key={exercise.uid}
                                      className={
                                        exerciseIndex === 0
                                          ? ""
                                          : "border-border/60 border-t pt-4"
                                      }
                                    >
                                      {renderExercisePreview(exercise)}
                                      {renderExerciseToolbar(exercise)}
                                    </div>
                                  ))}
                                </div>
                              </CardContent>
                            </Card>
                          ),
                        )}

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
            <DialogTitle>Сохранить изменения</DialogTitle>
            <DialogDescription>
              Добавьте обязательный комментарий к снапшоту перед сохранением.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {hasStructuralChanges ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-sm text-amber-950">
                После удаления недель или дней старые отметки выполнения могут больше не
                совпадать с программой.
              </div>
            ) : null}
            <div className="space-y-2">
              <p className="text-sm font-medium">Комментарий к сохранению</p>
              <Input
                placeholder="Например: добавил субботу и обновил подсобку на 2 неделе"
                value={commitMessage}
                onChange={(event) => setCommitMessage(event.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Отмена
            </Button>
            <Button onClick={performSave} disabled={!canSave || !commitMessage.trim()}>
              {saving ? "Сохранение..." : "Сохранить"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteWeekConfirmOpen} onOpenChange={setDeleteWeekConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Удалить неделю?</DialogTitle>
            <DialogDescription>
              Удаление недели сдвинет нумерацию следующих недель при сохранении.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteWeekConfirmOpen(false)}>
              Отмена
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (selectedWeek) {
                  removeWeek(selectedWeek.uid);
                }
                setDeleteWeekConfirmOpen(false);
              }}
            >
              Удалить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={addDayOpen} onOpenChange={setAddDayOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Добавить день</DialogTitle>
            <DialogDescription>
              Выберите день недели для новой тренировки.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-sm font-medium">День недели</p>
            <Select value={newDayWeekday} onValueChange={setNewDayWeekday}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Выберите день недели" />
              </SelectTrigger>
              <SelectContent>
                {remainingWeekdays.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDayOpen(false)}>
              Отмена
            </Button>
            <Button onClick={addDay} disabled={remainingWeekdays.length === 0}>
              Добавить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={setEditor != null} onOpenChange={(open) => !open && setSetEditor(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Редактирование подхода</DialogTitle>
            <DialogDescription>
              Изменения сразу показываются в виде pill, как на главной странице.
            </DialogDescription>
          </DialogHeader>
          {setEditor ? (
            <div className="space-y-4">
              <div className="flex justify-center">
                <div className="rounded-md">
                  <SetDisplay
                    set={toPreviewSetData(setEditor.draft, "editor-preview")}
                    category={
                      catalog.find((entry) =>
                        selectedDay?.exercises.find((exercise) => exercise.uid === setEditor.exerciseUid)?.exerciseId === entry.id,
                      )?.category
                    }
                  />
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <Select
                  value={setEditor.draft.loadType}
                  onValueChange={(value: LoadType) =>
                    setSetEditor((current) =>
                      current
                        ? {
                            ...current,
                            draft: {
                              ...current.draft,
                              loadType: value,
                              loadValue:
                                value === "PERCENT" || value === "KG"
                                  ? current.draft.loadValue
                                  : "",
                            },
                          }
                        : current,
                    )
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
                  type="number"
                  step="0.5"
                  placeholder="Вес / %"
                  disabled={setEditor.draft.loadType === "INDIVIDUAL" || setEditor.draft.loadType === "BODYWEIGHT"}
                  value={setEditor.draft.loadValue}
                  onChange={(event) =>
                    setSetEditor((current) =>
                      current
                        ? {
                            ...current,
                            draft: { ...current.draft, loadValue: event.target.value },
                          }
                        : current,
                    )
                  }
                />
                <Input
                  type="number"
                  min="1"
                  placeholder="Повторы"
                  value={setEditor.draft.reps}
                  onChange={(event) =>
                    setSetEditor((current) =>
                      current
                        ? {
                            ...current,
                            draft: { ...current.draft, reps: event.target.value },
                          }
                        : current,
                    )
                  }
                />
                <Input
                  type="number"
                  min="1"
                  placeholder="Подходы"
                  value={setEditor.draft.sets}
                  onChange={(event) =>
                    setSetEditor((current) =>
                      current
                        ? {
                            ...current,
                            draft: { ...current.draft, sets: event.target.value },
                          }
                        : current,
                    )
                  }
                />
              </div>
            </div>
          ) : null}
          <DialogFooter className="sm:justify-between">
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setSetEditor(null)}>
                Отмена
              </Button>
              {setEditor?.setUid ? (
                <Button variant="destructive" onClick={deleteEditedSet}>
                  Удалить
                </Button>
              ) : null}
            </div>
            <Button onClick={saveSetEditor} disabled={!setEditor || !isSetValid(setEditor.draft)}>
              <Pencil className="h-4 w-4" />
              Сохранить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
