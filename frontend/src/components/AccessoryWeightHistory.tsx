import {
  Button,
} from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { fetchAccessoryWeightHistory, updateAccessoryWeightNote } from "@/lib/api";
import type { AccessoryWeightRecord } from "@/lib/api";
import { useEffect, useState } from "react";
import { SetPill, DumbbellSetPill } from "./SetPill";

interface AccessoryWeightHistoryProps {
  exerciseId: number;
  exerciseName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function formatDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}

function renderSetPill(display: string) {
  const parts = display.split("\u{1F3CB}");
  if (parts.length > 1) {
    return <DumbbellSetPill>{parts[1]}</DumbbellSetPill>;
  }
  return <SetPill>{display}</SetPill>;
}

function renderSets(setsDisplay: string) {
  if (!setsDisplay) return null;
  const items = setsDisplay.split(", ").filter(Boolean);
  return (
    <div className="flex flex-wrap gap-1">
      {items.map((item, i) => (
        <span key={i}>{renderSetPill(item)}</span>
      ))}
    </div>
  );
}

export function AccessoryWeightHistory({
  exerciseId,
  exerciseName,
  open,
  onOpenChange,
}: AccessoryWeightHistoryProps) {
  const [records, setRecords] = useState<AccessoryWeightRecord[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [savingDate, setSavingDate] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setSaveError(null);
    fetchAccessoryWeightHistory(exerciseId)
      .then((items) => {
        setRecords(items);
        setNotes(
          Object.fromEntries(
            items.map((item) => [item.recorded_date, item.note ?? ""]),
          ),
        );
      })
      .catch(() => {
        setRecords([]);
        setNotes({});
      })
      .finally(() => setLoading(false));
  }, [open, exerciseId]);

  async function handleSaveNote(recordedDate: string) {
    const note = notes[recordedDate] ?? "";
    setSavingDate(recordedDate);
    setSaveError(null);
    try {
      const updated = await updateAccessoryWeightNote(exerciseId, recordedDate, note);
      setRecords((current) =>
        current.map((item) =>
          item.recorded_date === recordedDate ? updated : item,
        ),
      );
    } catch {
      setSaveError("Не удалось сохранить заметку");
    } finally {
      setSavingDate(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xs">
        <DialogHeader>
          <DialogTitle className="text-base">{exerciseName}</DialogTitle>
        </DialogHeader>
        {loading ? (
          <p className="text-muted-foreground text-sm text-center py-4">
            Загрузка...
          </p>
        ) : records.length === 0 ? (
          <p className="text-muted-foreground text-sm text-center py-4">
            Нет записей
          </p>
        ) : (
          <div className="max-h-72 overflow-y-auto space-y-2">
            {saveError ? (
              <p className="text-sm text-destructive">{saveError}</p>
            ) : null}
            {records.map((rec) => (
              <div
                key={rec.recorded_date}
                className="rounded-md border border-border p-2.5"
              >
                <div className="flex items-baseline justify-between mb-1.5">
                  <span className="text-sm font-medium">
                    {formatDate(rec.recorded_date)}
                  </span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-sm font-semibold">{rec.weight} кг</span>
                    {rec.week_number != null && (
                      <span className="text-xs text-muted-foreground">
                        нед. {rec.week_number}
                      </span>
                    )}
                  </div>
                </div>
                {rec.sets_display && renderSets(rec.sets_display)}
                <div className="mt-2 space-y-2">
                  <Textarea
                    rows={2}
                    placeholder="Заметка к этому логу"
                    value={notes[rec.recorded_date] ?? ""}
                    onChange={(event) =>
                      setNotes((current) => ({
                        ...current,
                        [rec.recorded_date]: event.target.value,
                      }))
                    }
                    className="min-h-0 resize-none bg-secondary/60 text-sm"
                  />
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={
                        savingDate === rec.recorded_date
                        || (notes[rec.recorded_date] ?? "") === (rec.note ?? "")
                      }
                      onClick={() => handleSaveNote(rec.recorded_date)}
                    >
                      {savingDate === rec.recorded_date ? "Сохранение..." : "Сохранить заметку"}
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
