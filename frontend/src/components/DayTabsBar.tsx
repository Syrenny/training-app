import type { ReactNode } from "react";
import { TabsList, TabsTrigger } from "@/components/ui/tabs";

interface DayTabsBarItem {
  key: string;
  value: string;
  label: ReactNode;
  indicator?: boolean;
}

interface DayTabsBarProps {
  items: DayTabsBarItem[];
  action?: ReactNode;
}

export function DayTabsBar({ items, action }: DayTabsBarProps) {
  return (
    <div className="flex items-center gap-2">
      <TabsList className="w-full rounded-full">
        {items.map((item) => (
          <TabsTrigger
            key={item.key}
            value={item.value}
            className="relative flex-1 text-base rounded-full"
          >
            {item.label}
            {item.indicator ? (
              <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-green-500" />
            ) : null}
          </TabsTrigger>
        ))}
      </TabsList>
      {action}
    </div>
  );
}
