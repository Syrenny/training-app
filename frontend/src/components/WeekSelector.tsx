import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { useProgramStore } from "@/lib/store";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function WeekSelector() {
  const weeks = useProgramStore((s) => s.weeks);
  const selectedWeek = useProgramStore((s) => s.selectedWeek);
  const setWeek = useProgramStore((s) => s.setWeek);
  const [open, setOpen] = useState(false);

  if (weeks.length === 0) return null;

  const current = weeks.find((w) => w.number === selectedWeek);
  const title = current?.title || `${selectedWeek} неделя`;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="flex items-center gap-2 text-lg font-semibold">
          {title}
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-xs">
        <DialogHeader>
          <DialogTitle>Выберите неделю</DialogTitle>
        </DialogHeader>
        <div className="grid gap-1">
          {weeks.map((week) => (
            <button
              key={week.id}
              className={`w-full text-left rounded-md px-3 py-2.5 text-sm transition-colors ${
                week.number === selectedWeek
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-accent"
              }`}
              onClick={() => {
                setWeek(week.number);
                setOpen(false);
              }}
            >
              {week.title || `${week.number} неделя`}
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
