import { Dumbbell, PencilRuler, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";

export type AppTab = "home" | "editor" | "profile";

interface BottomTabBarProps {
  activeTab: AppTab;
  onChange: (tab: AppTab) => void;
}

const TABS: Array<{ id: AppTab; label: string; icon: typeof Dumbbell }> = [
  { id: "home", label: "Главная", icon: Dumbbell },
  { id: "editor", label: "Редактор", icon: PencilRuler },
  { id: "profile", label: "Профиль", icon: UserRound },
];

export function BottomTabBar({ activeTab, onChange }: BottomTabBarProps) {
  return (
    <div
      className="border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="mx-auto flex max-w-screen-sm items-center gap-1 px-2 py-2">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const active = tab.id === activeTab;
          return (
            <Button
              key={tab.id}
              variant={active ? "secondary" : "ghost"}
              className="h-14 flex-1 flex-col gap-1"
              onClick={() => onChange(tab.id)}
            >
              <Icon className="h-4 w-4" />
              <span className="text-[11px]">{tab.label}</span>
            </Button>
          );
        })}
      </div>
    </div>
  );
}
