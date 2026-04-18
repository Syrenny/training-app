import type { ReactNode } from "react";
import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

interface DayTabsBarItem {
  key: string;
  value: string;
  label: ReactNode;
  indicator?: boolean;
}

interface DayTabsBarProps {
  items: DayTabsBarItem[];
  action?: ReactNode;
  className?: string;
}

export function DayTabsBar({ items, action, className }: DayTabsBarProps) {
  return (
    <div className={cn("z-20", className)}>
      <div className="mx-auto rounded-full bg-white/10 shadow-lg backdrop-blur-xl backdrop-saturate-150 dark:bg-black/20">
        <div className="flex items-center gap-2">
          <TabsList className="flex-1 rounded-full bg-transparent shadow-none p-1">
            {items.map((item) => (
              <TabsTrigger
                key={item.key}
                value={item.value}
                className="relative flex-1 rounded-full text-sm text-foreground/70 hover:bg-white/10 hover:text-foreground dark:text-muted-foreground dark:hover:bg-white/5 dark:hover:text-foreground data-[state=active]:bg-white/20 data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=active]:backdrop-blur-md dark:data-[state=active]:bg-white/10"
              >
                {item.label}
                {item.indicator ? (
                  <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-green-500" />
                ) : null}
              </TabsTrigger>
            ))}
          </TabsList>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
      </div>
    </div>
  );
}
