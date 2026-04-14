import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export interface WeekPickerItem {
  id: string | number;
  number: number;
  title: string;
}

interface WeekPickerProps {
  items: WeekPickerItem[];
  selectedNumber: number | null;
  onSelect: (weekNumber: number) => void;
  triggerButtonProps?: React.ComponentProps<"button">;
}

export function WeekPicker({
  items,
  selectedNumber,
  onSelect,
  triggerButtonProps,
}: WeekPickerProps) {
  const [open, setOpen] = useState(false);
  const triggerClassName = triggerButtonProps?.className;

  if (items.length === 0) return null;

  const current = items.find((week) => week.number === selectedNumber);
  const title = current?.title || `${selectedNumber} неделя`;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          {...triggerButtonProps}
          className={cn("h-auto justify-start px-0 text-lg font-semibold", triggerClassName)}
        >
          {title}
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xs">
        <DialogHeader>
          <DialogTitle>Выберите неделю</DialogTitle>
        </DialogHeader>
        <div className="grid gap-1">
          {items.map((week) => (
            <Button
              key={week.id}
              variant={week.number === selectedNumber ? "default" : "ghost"}
              className="w-full justify-start"
              onClick={() => {
                onSelect(week.number);
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
