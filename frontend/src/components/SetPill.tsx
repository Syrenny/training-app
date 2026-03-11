import { Dumbbell } from "lucide-react";

const baseClass = "inline-block rounded bg-secondary px-2 py-1 text-sm font-mono";
const dumbbellClass =
  "inline-flex items-center rounded bg-secondary px-2 py-1 text-sm font-mono gap-0.5";

export function SetPill({ children }: { children: React.ReactNode }) {
  return <span className={baseClass}>{children}</span>;
}

export function DumbbellSetPill({ children }: { children: React.ReactNode }) {
  return (
    <span className={dumbbellClass}>
      <Dumbbell className="h-3.5 w-3.5 inline-block -translate-y-px" />
      {children}
    </span>
  );
}
