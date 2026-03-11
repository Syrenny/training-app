import { Badge } from "@/components/ui/badge";
import { Dumbbell } from "lucide-react";

const pillClass = "h-7 py-0 rounded-md font-mono text-sm px-2 [&>svg]:size-3.5";

export function SetPill({ children }: { children: React.ReactNode }) {
  return (
    <Badge variant="secondary" className={pillClass}>
      {children}
    </Badge>
  );
}

export function DumbbellSetPill({ children }: { children: React.ReactNode }) {
  return (
    <Badge variant="secondary" className={pillClass}>
      <Dumbbell />
      {children}
    </Badge>
  );
}
