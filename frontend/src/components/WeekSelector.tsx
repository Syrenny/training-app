import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { useProgramStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
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
        <Button variant="ghost" className="h-auto justify-start px-0 text-lg font-semibold">
          {title}
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xs">
        <DialogHeader>
          <DialogTitle>Выберите неделю</DialogTitle>
        </DialogHeader>
        <div className="grid gap-1">
          {weeks.map((week) => (
            <Button
              key={week.id}
              variant={week.number === selectedWeek ? "default" : "ghost"}
              className="w-full justify-start"
              onClick={() => {
                setWeek(week.number);
                setOpen(false);
              }}
            >
              {week.title || `${week.number} неделя`}
            </Button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
