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
  onAdd?: () => void;
  triggerButtonProps?: React.ComponentProps<"button">;
  itemButtonVariant?: React.ComponentProps<typeof Button>["variant"];
  addButtonVariant?: React.ComponentProps<typeof Button>["variant"];
}

export function WeekPicker({
  items,
  selectedNumber,
  onSelect,
  onAdd,
  triggerButtonProps,
  itemButtonVariant = "ghost",
  addButtonVariant = "outline",
}: WeekPickerProps) {
  const [open, setOpen] = useState(false);
  const triggerClassName = triggerButtonProps?.className;

  const current = items.find((week) => week.number === selectedNumber);
  const title = current?.title || (selectedNumber ? `${selectedNumber} неделя` : "Недели");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          {...triggerButtonProps}
          className={cn("h-auto justify-start px-0 text-lg font-semibold w-full", triggerClassName)}
        >
          {title}
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xs">
        <DialogHeader>
          <DialogTitle>Выберите неделю</DialogTitle>
        </DialogHeader>
        <div className="grid gap-5">
          {items.length === 0 ? (
            <p className="py-2 text-sm text-muted-foreground">
              Пока нет недель.
            </p>
          ) : (
            items.map((week) => (
              <Button
                key={week.id}
                variant={itemButtonVariant}
                className="w-full justify-start"
                onClick={() => {
                  onSelect(week.number);
                  setOpen(false);
                }}
              >
                {week.title || `${week.number} неделя`}
              </Button>
            ))
          )}
          {onAdd ? (
            <Button
              variant={addButtonVariant}
              className="mt-2 w-full"
              onClick={() => {
                onAdd();
                setOpen(false);
              }}
            >
              Добавить неделю
            </Button>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
