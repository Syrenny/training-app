import { useCallback, useEffect, useRef } from "react";

const DEFAULT_HOLD_MS = 600;
const MOVE_THRESHOLD = 10;

interface UseLongPressOptions {
  disabled?: boolean;
  onLongPress: () => void;
  holdMs?: number;
}

export function useLongPress({
  disabled = false,
  onLongPress,
  holdMs = DEFAULT_HOLD_MS,
}: UseLongPressOptions) {
  const timeoutRef = useRef<number | null>(null);
  const firedRef = useRef(false);
  const startPointRef = useRef<{ x: number; y: number } | null>(null);

  const clearHold = useCallback(() => {
    if (timeoutRef.current != null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    startPointRef.current = null;
  }, []);

  const cancelHold = useCallback(() => {
    clearHold();
  }, [clearHold]);

  const startHold = useCallback(
    (event: React.PointerEvent) => {
      if (disabled) return;
      if (
        event.target instanceof Element &&
        event.currentTarget instanceof Element &&
        event.target !== event.currentTarget &&
        event.target.closest("button, input, select, textarea, a, [role='combobox'], [data-no-hold]")
      ) {
        return;
      }
      firedRef.current = false;
      startPointRef.current = { x: event.clientX, y: event.clientY };
      clearHold();
      timeoutRef.current = window.setTimeout(() => {
        firedRef.current = true;
        clearHold();
        onLongPress();
      }, holdMs);
    },
    [clearHold, disabled, holdMs, onLongPress],
  );

  const moveHold = useCallback(
    (event: React.PointerEvent) => {
      if (timeoutRef.current == null || startPointRef.current == null) return;
      const dx = Math.abs(event.clientX - startPointRef.current.x);
      const dy = Math.abs(event.clientY - startPointRef.current.y);
      if (dx > MOVE_THRESHOLD || dy > MOVE_THRESHOLD) {
        clearHold();
      }
    },
    [clearHold],
  );

  const blockClickAfterHold = useCallback((event: React.MouseEvent) => {
    if (!firedRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    firedRef.current = false;
  }, []);

  useEffect(() => {
    return () => {
      if (timeoutRef.current != null) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return {
    onPointerDown: startHold,
    onPointerMove: moveHold,
    onPointerUp: cancelHold,
    onPointerCancel: cancelHold,
    onPointerLeave: cancelHold,
    onClickCapture: blockClickAfterHold,
    onContextMenu: (event: React.MouseEvent) => event.preventDefault(),
  };
}
