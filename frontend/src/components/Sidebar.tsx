import { Menu } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { OneRepMaxPage } from "./OneRepMaxPage";

export function Sidebar() {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <button
          className="inline-flex items-center justify-center rounded-md h-9 w-9 border border-input bg-background hover:bg-accent hover:text-accent-foreground"
          aria-label="Открыть меню"
        >
          <Menu className="h-5 w-5" />
        </button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72">
        <SheetHeader>
          <SheetTitle>Настройки</SheetTitle>
        </SheetHeader>
        <div className="px-4">
          <OneRepMaxPage />
        </div>
      </SheetContent>
    </Sheet>
  );
}
