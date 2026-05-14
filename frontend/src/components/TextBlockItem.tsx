import type { DayTextBlockData } from "@/lib/api";

interface TextBlockItemProps {
  kind: DayTextBlockData["kind"];
  content: string;
}

export function TextBlockItem({ kind, content }: TextBlockItemProps) {
  return (
    <div
      className={
        kind === "REST"
          ? "rounded-2xl bg-muted px-4 py-3 text-sm font-medium text-foreground"
          : "rounded-2xl bg-green-600/15 px-4 py-3 text-sm text-foreground"
      }
    >
      {content}
    </div>
  );
}
