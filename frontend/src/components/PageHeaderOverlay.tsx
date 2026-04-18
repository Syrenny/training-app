import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageHeaderOverlayProps {
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}

export function PageHeaderOverlay({
  children,
  className,
  contentClassName,
}: PageHeaderOverlayProps) {
  return (
    <div className={cn("absolute left-4 right-4 top-3 z-30", className)}>
      <div
        className={cn(
          "rounded-full bg-white/15 px-3 py-2 shadow-lg backdrop-blur-xl backdrop-saturate-150 dark:border-white/10 dark:bg-black/25",
          contentClassName,
        )}
      >
        {children}
      </div>
    </div>
  );
}
