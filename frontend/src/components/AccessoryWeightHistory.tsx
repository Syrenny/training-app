import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { fetchAccessoryWeightHistory } from "@/lib/api";
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
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetchAccessoryWeightHistory(exerciseId)
      .then(setRecords)
      .catch(() => setRecords([]))
      .finally(() => setLoading(false));
  }, [open, exerciseId]);

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
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
