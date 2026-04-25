import { useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Link2,
  Pencil,
  Plus,
  RotateCcw,
  Save,
  Trash2,
} from "lucide-react";
import type {
  ExerciseSetData,
  ExerciseData,
  ProgramData,
  ProgramSnapshotInput,
} from "@/lib/api";
import {
  fetchExercises,
  fetchOriginalProgram,
  fetchProgram,
  saveProgramSnapshot,
} from "@/lib/api";
import { useProgramStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { WeekPicker } from "@/components/WeekPicker";
import { SetDisplay } from "@/components/SetDisplay";
import { DayTabsBar } from "@/components/DayTabsBar";
import { calcTonnage } from "@/lib/calc";
import { useLongPress } from "@/hooks/useLongPress";

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

type DeleteTarget =
  | { type: "week"; weekUid: string; title: string; description: string }
  | { type: "day"; dayUid: string; title: string; description: string }
  | { type: "exercise"; exerciseUid: string; title: string; description: string };

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

function createSetFromPrevious(previous?: DraftSet): DraftSet {
  return {
    uid: createUid(),
    loadType: previous?.loadType ?? "INDIVIDUAL",
    loadValue: "",
    reps: "10",
    sets: "3",
  };
}

function createExercise(exerciseId: number): DraftExercise {
  return {
    uid: createUid(),
    exerciseId,
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

function contentSignature(draft: DraftProgram) {
  return JSON.stringify({
    weeks: draft.weeks.map((week) => ({
      title: week.title,
      days: week.days.map((day) => ({
        weekday: day.weekday,
        exercises: day.exercises.map((exercise) => ({
          exerciseId: exercise.exerciseId,
          supersetGroup: exercise.supersetGroup,
          sets: exercise.sets.map((set) => ({
            loadType: set.loadType,
            loadValue: set.loadValue,
            reps: set.reps,
            sets: set.sets,
          })),
        })),
      })),
    })),
  });
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
    load_value_max: null,
    reps: Number(set.reps || 0),
    reps_max: null,
    sets: Number(set.sets || 0),
    display: renderDraftSetDisplay(set),
  };
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

function nextSupersetGroupId(exercises: DraftExercise[]) {
  let maxGroup = 0;
  for (const exercise of exercises) {
    const value = Number(exercise.supersetGroup);
    if (Number.isFinite(value)) {
      maxGroup = Math.max(maxGroup, value);
    }
  }
  return String(maxGroup + 1);
}

function getSupersetGroupId(exercises: DraftExercise[], exerciseIndex: number) {
  const current = exercises[exerciseIndex];
  if (!current?.supersetGroup) return "";
  return (
    exercises[exerciseIndex - 1]?.supersetGroup === current.supersetGroup
    || exercises[exerciseIndex + 1]?.supersetGroup === current.supersetGroup
  )
    ? current.supersetGroup
    : "";
}

type ExerciseGroupItem =
  | { type: "single"; exercise: DraftExercise; displayOrder: number; startIndex: number }
  | {
      type: "superset";
      group: string;
      exercises: DraftExercise[];
      displayOrder: number;
      startIndex: number;
    };

function groupDraftExercises(exercises: DraftExercise[]) {
  const items: ExerciseGroupItem[] = [];
  let index = 0;
  let displayOrder = 1;

  while (index < exercises.length) {
    const groupId = getSupersetGroupId(exercises, index);
    if (!groupId) {
      items.push({
        type: "single",
        exercise: exercises[index],
        displayOrder,
        startIndex: index,
      });
      index += 1;
      displayOrder += 1;
      continue;
    }

    const grouped: DraftExercise[] = [exercises[index]];
    let cursor = index + 1;
    while (cursor < exercises.length && exercises[cursor].supersetGroup === groupId) {
      grouped.push(exercises[cursor]);
      cursor += 1;
    }

    items.push({
      type: "superset",
      group: groupId,
      exercises: grouped,
      displayOrder,
      startIndex: index,
    });
    index = cursor;
    displayOrder += 1;
  }

  return items;
}

export function ProgramEditPage({ onClose }: ProgramEditPageProps) {
  const refreshProgram = useProgramStore((s) => s.fetchProgram);
  const refreshCompletions = useProgramStore((s) => s.fetchCompletions);
  const oneRepMax = useProgramStore((s) => s.oneRepMax);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftProgram | null>(null);
  const [originalProgram, setOriginalProgram] = useState<ProgramData | null>(null);
  const [catalog, setCatalog] = useState<ExerciseData[]>([]);
  const [selectedWeekUid, setSelectedWeekUid] = useState<string | null>(null);
  const [selectedDayUid, setSelectedDayUid] = useState<string | null>(null);
  const [newDayWeekday, setNewDayWeekday] = useState("MON");
  const [dayEditorOpen, setDayEditorOpen] = useState(false);
  const [exercisePickerIndex, setExercisePickerIndex] = useState<number | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [initialSignature, setInitialSignature] = useState("");
  const [initialContentSignature, setInitialContentSignature] = useState("");
  const [originalContentSignature, setOriginalContentSignature] = useState("");
  const [setEditor, setSetEditor] = useState<SetEditorState | null>(null);

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        setLoading(true);
        const [program, original, exercises] = await Promise.all([
          fetchProgram(),
          fetchOriginalProgram(),
          fetchExercises(),
        ]);
        if (!mounted) return;
        const nextDraft = draftFromProgram(program);
        setDraft(nextDraft);
        setOriginalProgram(original);
        setCatalog(exercises);
        setInitialSignature(structuralSignature(nextDraft));
        setInitialContentSignature(contentSignature(nextDraft));
        setOriginalContentSignature(contentSignature(draftFromProgram(original)));
        setSelectedWeekUid(nextDraft.weeks[0]?.uid ?? null);
        setSelectedDayUid(nextDraft.weeks[0]?.days[0]?.uid ?? null);
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
  const hasChanges = draft ? contentSignature(draft) !== initialContentSignature : false;
  const canSave = draft != null && catalog.length > 0 && isDraftValid(draft) && hasChanges && !saving;
  const weekLongPressProps = useLongPress({
    disabled: !selectedWeek,
    preventDefault: false,
    onLongPress: () => {
      if (!selectedWeek || selectedWeekNumber == null) return;
      setDeleteTarget({
        type: "week",
        weekUid: selectedWeek.uid,
        title: `Удалить ${selectedWeek.title || `${selectedWeekNumber} неделю`}?`,
        description: "Удаление недели сдвинет нумерацию следующих недель при сохранении.",
      });
    },
  });

  function resetEditorToProgram(program: ProgramData) {
    const nextDraft = draftFromProgram(program);
    setDraft(nextDraft);
    setSelectedWeekUid(nextDraft.weeks[0]?.uid ?? null);
    setSelectedDayUid(nextDraft.weeks[0]?.days[0]?.uid ?? null);
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

  function openExercisePicker(insertIndex: number) {
    setExercisePickerIndex(insertIndex);
  }

  function insertExerciseAt(insertIndex: number, exerciseId: number) {
    updateSelectedDay((currentDay) => {
      const exercises = [...currentDay.exercises];
      exercises.splice(insertIndex, 0, createExercise(exerciseId));
      return { ...currentDay, exercises };
    });
    setExercisePickerIndex(null);
  }

  function selectWeekByNumber(weekNumber: number) {
    const nextWeek = draft?.weeks[weekNumber - 1];
    if (!nextWeek) return;
    setSelectedWeekUid(nextWeek.uid);
    setSelectedDayUid(nextWeek.days[0]?.uid ?? null);
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

  function isBoundaryLinked(exercises: DraftExercise[], boundaryIndex: number) {
    if (boundaryIndex < 0 || boundaryIndex >= exercises.length - 1) return false;
    const left = exercises[boundaryIndex];
    const right = exercises[boundaryIndex + 1];
    return Boolean(left.supersetGroup && left.supersetGroup === right.supersetGroup);
  }

  function toggleSupersetAt(boundaryIndex: number) {
    updateSelectedDay((currentDay) => {
      if (boundaryIndex < 0 || boundaryIndex >= currentDay.exercises.length - 1) {
        return currentDay;
      }

      let exercises = [...currentDay.exercises];
      const left = exercises[boundaryIndex];
      const right = exercises[boundaryIndex + 1];
      const linked = isBoundaryLinked(exercises, boundaryIndex);

      if (linked) {
        const groupId = left.supersetGroup;
        let leftStart = boundaryIndex;
        while (leftStart > 0 && exercises[leftStart - 1].supersetGroup === groupId) {
          leftStart -= 1;
        }

        let rightEnd = boundaryIndex + 1;
        while (
          rightEnd < exercises.length - 1
          && exercises[rightEnd + 1].supersetGroup === groupId
        ) {
          rightEnd += 1;
        }

        const leftCount = boundaryIndex - leftStart + 1;
        const rightCount = rightEnd - boundaryIndex;
        const rightGroupId = rightCount > 1 ? nextSupersetGroupId(exercises) : "";

        exercises = exercises.map((exercise, index) => {
          if (index < leftStart || index > rightEnd) return exercise;
          if (index <= boundaryIndex) {
            return {
              ...exercise,
              supersetGroup: leftCount > 1 ? groupId : "",
            };
          }
          return {
            ...exercise,
            supersetGroup: rightGroupId,
          };
        });
      } else {
        const leftGroupId = left.supersetGroup;
        const rightGroupId = right.supersetGroup;
        let leftStart = boundaryIndex;
        if (leftGroupId) {
          while (leftStart > 0 && exercises[leftStart - 1].supersetGroup === leftGroupId) {
            leftStart -= 1;
          }
        }

        let rightEnd = boundaryIndex + 1;
        if (rightGroupId) {
          while (
            rightEnd < exercises.length - 1
            && exercises[rightEnd + 1].supersetGroup === rightGroupId
          ) {
            rightEnd += 1;
          }
        }

        const groupId = leftGroupId || rightGroupId || nextSupersetGroupId(exercises);
        exercises = exercises.map((exercise, index) =>
          index >= leftStart && index <= rightEnd
            ? { ...exercise, supersetGroup: groupId }
            : exercise,
        );
      }

      return { ...currentDay, exercises };
    });
  }

  function requestDeleteExercise(exercise: DraftExercise) {
    const exerciseName = getExerciseMeta(exercise.exerciseId)?.name ?? "это упражнение";
    setDeleteTarget({
      type: "exercise",
      exerciseUid: exercise.uid,
      title: `Удалить упражнение «${exerciseName}»?`,
      description: "Упражнение и все его подходы будут удалены из текущего дня.",
    });
  }

  function confirmDeleteTarget() {
    if (!deleteTarget) return;
    if (deleteTarget.type === "week") {
      removeWeek(deleteTarget.weekUid);
    } else if (deleteTarget.type === "day") {
      removeDay(deleteTarget.dayUid);
    } else {
      updateSelectedDay((currentDay) => ({
        ...currentDay,
        exercises: currentDay.exercises.filter((entry) => entry.uid !== deleteTarget.exerciseUid),
      }));
    }
    setDeleteTarget(null);
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
              oneRepMaxExerciseId={exerciseMeta?.one_rep_max_exercise_id}
            />
          </button>
        ))}
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="h-7 w-7 shrink-0 rounded-md border-dashed"
          onClick={() => openSetEditor(
            exercise.uid,
            null,
            createSetFromPrevious(exercise.sets[exercise.sets.length - 1]),
          )}
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
      <div className="mt-4 flex items-center justify-between gap-2 border-t pt-4">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Удалить упражнение"
          onClick={() => requestDeleteExercise(exercise)}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => moveExercise(exercise.uid, -1)}
            disabled={isFirst}
          >
            <ChevronUp className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => moveExercise(exercise.uid, 1)}
            disabled={isLast}
          >
            <ChevronDown className="h-4 w-4" />
          </Button>
        </div>
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
        ? calcTonnage(previewSets, exerciseMeta.one_rep_max_exercise_id, oneRepMax)
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

  function renderExerciseControls(insertIndex: number, compact = false) {
    const canLink = selectedDay != null && insertIndex > 0 && insertIndex < selectedDay.exercises.length;
    const linked = canLink ? isBoundaryLinked(selectedDay.exercises, insertIndex - 1) : false;

    return (
      <div
        className={
          compact
            ? "my-4 flex items-center justify-center gap-2"
            : "mb-3 flex items-center justify-center gap-2"
        }
      >
        {linked ? <div className="h-px flex-1 bg-border" /> : null}
        <Button
          variant="ghost"
          size="icon-sm"
          className={`rounded-full border-dashed ${linked ? "border-primary/50" : ""}`}
          onClick={() => openExercisePicker(insertIndex)}
          disabled={catalog.length === 0}
        >
          <Plus className="h-4 w-4" />
        </Button>
        {canLink ? (
          <Button
            variant="ghost"
            size="icon-sm"
            className={`rounded-full ${linked ? "bg-primary/10 text-primary" : ""}`}
            onClick={() => toggleSupersetAt(insertIndex - 1)}
          >
            <Link2 className="h-4 w-4" />
          </Button>
        ) : null}
        {linked ? <div className="h-px flex-1 bg-border" /> : null}
      </div>
    );
  }

  async function performSave() {
    if (!draft || !canSave) return;
    try {
      setSaving(true);
      setError(null);
      const commitMessage =
        contentSignature(draft) === originalContentSignature
          ? "Откат к оригинальной программе"
          : "Обновление программы";
      const result = await saveProgramSnapshot(buildSavePayload(draft, commitMessage));
      const nextDraft = draftFromProgram(result);
      setDraft(nextDraft);
      setInitialSignature(structuralSignature(nextDraft));
      setInitialContentSignature(contentSignature(nextDraft));
      setSelectedWeekUid(nextDraft.weeks[0]?.uid ?? null);
      setSelectedDayUid(nextDraft.weeks[0]?.days[0]?.uid ?? null);
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

  function restoreOriginalProgram() {
    if (!originalProgram) {
      setError("Не удалось загрузить оригинальную программу");
      return;
    }
    resetEditorToProgram(originalProgram);
    setNotice("В редактор загружена оригинальная программа. Сохраните изменения, чтобы применить откат.");
    setResetConfirmOpen(false);
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
        <Button className="mt-4" variant="ghost" onClick={onClose}>
          Вернуться
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-1 min-h-0 flex-col">
      <div className="shrink-0 px-4 pt-4 pb-4">
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <WeekPicker
              items={editorWeeks}
              selectedNumber={selectedWeekNumber}
              onSelect={selectWeekByNumber}
              onAdd={addWeek}
              itemButtonVariant="ghost"
              addButtonVariant="ghost"
              triggerButtonProps={{
                ...weekLongPressProps,
                className: "h-auto justify-start px-0 text-lg font-semibold",
              }}
            />
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Загрузить оригинальную программу"
            onClick={() => setResetConfirmOpen(true)}
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={saving ? "Сохранение" : "Сохранить"}
            onClick={() => (hasStructuralChanges ? setConfirmOpen(true) : performSave())}
            disabled={!canSave}
          >
            <Save className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Tabs
        value={selectedDay?.uid}
        onValueChange={(value) => setSelectedDayUid(value)}
        className="flex flex-1 min-h-0 flex-col px-4"
      >
        {selectedWeek ? (
          <div className="shrink-0 pb-2">
            {selectedWeek.days.length === 0 ? (
              <div className="rounded-lg border border-dashed px-3 py-2 text-sm text-muted-foreground">
                В этой неделе пока нет тренировочных дней.
              </div>
            ) : (
              <DayTabsBar
                items={selectedWeek.days.map((day) => ({
                  key: day.uid,
                  value: day.uid,
                  label: WEEKDAY_SHORT_LABELS[day.weekday] ?? day.weekday,
                }))}
                action={(
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Редактировать дни"
                    onClick={() => {
                      setNewDayWeekday(remainingWeekdays[0]?.value ?? "MON");
                      setDayEditorOpen(true);
                    }}
                    disabled={!selectedWeek}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                )}
              />
            )}
          </div>
        ) : null}

        <div className="hide-scrollbar min-h-0 flex-1 overflow-y-auto">
          <div className="space-y-4">
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            {notice ? <p className="text-sm text-muted-foreground">{notice}</p> : null}

            {!selectedWeek ? (
              <Card>
                <CardContent className="py-8 text-center text-sm text-muted-foreground">
                  В программе не осталось недель.
                </CardContent>
              </Card>
            ) : selectedWeek.days.length === 0 ? null : selectedDay ? (
              <TabsContent value={selectedDay.uid} className="space-y-3">
                {renderExerciseControls(0)}
                {groupDraftExercises(selectedDay.exercises).map((item) =>
                  item.type === "single" ? (
                    <div key={item.exercise.uid}>
                      <Card className="mb-3">
                        <CardContent>
                        {renderExercisePreview(item.exercise, item.displayOrder)}
                        {renderExerciseToolbar(item.exercise)}
                        </CardContent>
                      </Card>
                      {renderExerciseControls(item.startIndex + 1)}
                    </div>
                  ) : (
                    <div key={`superset-${item.group}`}>
                      <Card className="mb-3 border-l-4 border-l-primary">
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
                                {exerciseIndex < item.exercises.length - 1 ? (
                                  <div className="mt-4">
                                    {renderExerciseControls(
                                      item.startIndex + exerciseIndex + 1,
                                      true,
                                    )}
                                  </div>
                                ) : null}
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                      {renderExerciseControls(item.startIndex + item.exercises.length)}
                    </div>
                  ),
                )}
              </TabsContent>
            ) : null}
          </div>
        </div>
      </Tabs>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Сохранить структурные изменения?</DialogTitle>
            <DialogDescription>
              После удаления недель или дней старые отметки выполнения могут больше не
              совпадать с программой.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmOpen(false)}>
              Отмена
            </Button>
            <Button variant="ghost" onClick={performSave} disabled={!canSave}>
              {saving ? "Сохранение..." : "Сохранить"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={resetConfirmOpen} onOpenChange={setResetConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Загрузить оригинальную программу?</DialogTitle>
            <DialogDescription>
              Редактор переключится на исходную программу. Чтобы применить откат, её нужно будет сохранить.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setResetConfirmOpen(false)}>
              Назад
            </Button>
            <Button variant="ghost" onClick={restoreOriginalProgram}>
              Загрузить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteTarget != null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{deleteTarget?.title ?? "Удалить?"}</DialogTitle>
            <DialogDescription>{deleteTarget?.description}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>
              Отмена
            </Button>
            <Button variant="ghost" onClick={confirmDeleteTarget}>
              Удалить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dayEditorOpen} onOpenChange={setDayEditorOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Редактор дней</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm font-medium">Текущие дни</p>
              {selectedWeek?.days.length ? (
                <div className="space-y-2">
                  {selectedWeek.days.map((day) => {
                    const label =
                      WEEKDAY_OPTIONS.find((option) => option.value === day.weekday)?.label ?? day.weekday;

                    return (
                      <div
                        key={day.uid}
                        className="flex items-center justify-between rounded-lg border px-3 py-2"
                      >
                        <button
                          type="button"
                          className="min-w-0 flex-1 text-left text-sm font-medium"
                          onClick={() => {
                            setSelectedDayUid(day.uid);
                            setDayEditorOpen(false);
                          }}
                        >
                          {label}
                        </button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Удалить ${label}`}
                          onClick={() => removeDay(day.uid)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  В этой неделе пока нет тренировочных дней.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">Добавить день</p>
              <div className="flex items-center gap-2">
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
                <Button
                  type="button"
                  variant="ghost"
                  onClick={addDay}
                  disabled={remainingWeekdays.length === 0}
                >
                  Добавить
                </Button>
              </div>
              {remainingWeekdays.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Все дни недели уже добавлены.
                </p>
              ) : null}
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDayEditorOpen(false)}>
              Готово
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={exercisePickerIndex != null}
        onOpenChange={(open) => !open && setExercisePickerIndex(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Добавить упражнение</DialogTitle>
            <DialogDescription>
              Выберите упражнение для вставки в программу.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[60dvh] space-y-2 overflow-y-auto pr-1">
            {catalog.map((exercise) => (
              <Button
                key={exercise.id}
                variant="ghost"
                className="h-auto w-full justify-start gap-3 py-3 text-left"
                onClick={() => {
                  if (exercisePickerIndex == null) return;
                  insertExerciseAt(exercisePickerIndex, exercise.id);
                }}
              >
                <span className="min-w-0 flex-1 truncate">{exercise.name}</span>
                <Badge variant="secondary" className="text-xs">
                  {categoryLabels[exercise.category] ?? exercise.category}
                </Badge>
              </Button>
            ))}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setExercisePickerIndex(null)}>
              Отмена
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={setEditor != null} onOpenChange={(open) => !open && setSetEditor(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
          </DialogHeader>
          {setEditor ? (
            <div className="space-y-4">
              <div className="flex justify-center">
                <div className="rounded-md">
                  <SetDisplay
                    set={toPreviewSetData(setEditor.draft, "editor-preview")}
                    oneRepMaxExerciseId={
                      catalog.find((entry) =>
                        selectedDay?.exercises.find((exercise) => exercise.uid === setEditor.exerciseUid)?.exerciseId === entry.id,
                      )?.one_rep_max_exercise_id
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
              <Button variant="ghost" onClick={() => setSetEditor(null)}>
                Отмена
              </Button>
              {setEditor?.setUid ? (
                <Button variant="ghost" onClick={deleteEditedSet}>
                  Удалить
                </Button>
              ) : null}
            </div>
            <Button variant="ghost" onClick={saveSetEditor} disabled={!setEditor || !isSetValid(setEditor.draft)}>
              <Pencil className="h-4 w-4" />
              Сохранить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
