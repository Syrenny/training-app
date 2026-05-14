import { Flame, ChevronRight } from "lucide-react";

interface WarmupTeaserCardProps {
  onOpen: () => void;
}

export function WarmupTeaserCard({ onOpen }: WarmupTeaserCardProps) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-center gap-4 px-0 py-4 text-left text-foreground transition-opacity active:opacity-70"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-foreground">
        <Flame className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-foreground">Разминка</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Пройти базовую разминку
        </p>
      </div>
      <div className="pointer-events-none flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground">
        <ChevronRight className="h-4 w-4" />
      </div>
    </button>
  );
}
