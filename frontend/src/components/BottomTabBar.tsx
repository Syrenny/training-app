import { Button } from "@/components/ui/button"
import { Dumbbell, PencilRuler, UserRound } from "lucide-react"

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
    <div className="fixed bottom-2 left-0 right-0 z-50 px-16">
      <div
        className="
          mx-auto max-w-screen-sm
          rounded-full
          backdrop-blur-xl
          bg-white/10 dark:bg-black/20
          backdrop-saturate-150
          shadow-lg
        "
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="flex items-center gap-1 px-2 py-2">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const active = tab.id === activeTab;

            return (
              <Button
                key={tab.id}
                variant="ghost"
                className={`
                    h-14 flex-1 flex-col gap-1 relative

                    ${active ? `
                    bg-white/20 dark:bg-white/10
                    backdrop-blur-md
                    shadow-sm
                    rounded-full
                    ` : `
                    hover:bg-white/10 dark:hover:bg-white/5
                    `}
                `}
                onClick={() => onChange(tab.id)}
                >
                <Icon className="h-4 w-4" />
                <span className="text-[11px]">{tab.label}</span>
              </Button>
            );
          })}
        </div>
      </div>
    </div>
  );
}