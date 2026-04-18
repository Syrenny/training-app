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
          "glass-surface rounded-full px-3 py-2",
          contentClassName,
        )}
      >
        {children}
      </div>
    </div>
  );
}
