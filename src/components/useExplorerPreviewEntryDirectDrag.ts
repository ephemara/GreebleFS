import { useCallback, useEffect, useRef, type PointerEvent as ReactPointerEvent } from "react";

const EXPLORER_PREVIEW_ROW_DRAG_START_DISTANCE_PX = 6;
const EXPLORER_PREVIEW_ROW_CLICK_SUPPRESS_MS = 180;

type PreviewEntryDragCandidate<TEntry> = {
  pointerId: number;
  startClientX: number;
  startClientY: number;
  entry: TEntry;
  suppressKey: string;
};

export function useExplorerPreviewEntryDirectDrag<TEntry>(args: {
  onStartDrag: (entry: TEntry) => void | Promise<void>;
}) {
  const dragCandidateRef = useRef<PreviewEntryDragCandidate<TEntry> | null>(null);
  const suppressClickKeyRef = useRef<string | null>(null);
  const suppressClickTimerRef = useRef<number | null>(null);

  const clearSuppressedClick = useCallback(() => {
    if (suppressClickTimerRef.current != null) {
      window.clearTimeout(suppressClickTimerRef.current);
      suppressClickTimerRef.current = null;
    }
    suppressClickKeyRef.current = null;
  }, []);

  const suppressClick = useCallback(
    (suppressKey: string) => {
      clearSuppressedClick();
      suppressClickKeyRef.current = suppressKey;
      suppressClickTimerRef.current = window.setTimeout(() => {
        suppressClickKeyRef.current = null;
        suppressClickTimerRef.current = null;
      }, EXPLORER_PREVIEW_ROW_CLICK_SUPPRESS_MS);
    },
    [clearSuppressedClick],
  );

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      const candidate = dragCandidateRef.current;
      if (!candidate || candidate.pointerId !== event.pointerId) {
        return;
      }

      const movedDistance = Math.hypot(
        event.clientX - candidate.startClientX,
        event.clientY - candidate.startClientY,
      );
      if (movedDistance < EXPLORER_PREVIEW_ROW_DRAG_START_DISTANCE_PX) {
        return;
      }

      dragCandidateRef.current = null;
      suppressClick(candidate.suppressKey);
      void args.onStartDrag(candidate.entry);
    };

    const handlePointerEnd = (event: PointerEvent) => {
      const candidate = dragCandidateRef.current;
      if (!candidate || candidate.pointerId !== event.pointerId) {
        return;
      }
      dragCandidateRef.current = null;
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerEnd);
    window.addEventListener("pointercancel", handlePointerEnd);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerEnd);
      window.removeEventListener("pointercancel", handlePointerEnd);
      clearSuppressedClick();
    };
  }, [args.onStartDrag, clearSuppressedClick, suppressClick]);

  const bindPreviewEntryDirectDrag = useCallback(
    (entry: TEntry, suppressKey: string) => ({
      onPointerDown: (event: ReactPointerEvent<HTMLElement>) => {
        if (event.button !== 0) {
          return;
        }

        dragCandidateRef.current = {
          pointerId: event.pointerId,
          startClientX: event.clientX,
          startClientY: event.clientY,
          entry,
          suppressKey,
        };
      },
      onPointerCancel: (event: ReactPointerEvent<HTMLElement>) => {
        if (dragCandidateRef.current?.pointerId === event.pointerId) {
          dragCandidateRef.current = null;
        }
      },
    }),
    [],
  );

  const shouldSuppressPreviewEntryClick = useCallback(
    (suppressKey: string) => suppressClickKeyRef.current === suppressKey,
    [],
  );

  return {
    bindPreviewEntryDirectDrag,
    shouldSuppressPreviewEntryClick,
  };
}
