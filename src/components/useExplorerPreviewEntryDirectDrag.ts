import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";

const EXPLORER_PREVIEW_ROW_DRAG_START_DISTANCE_PX = 6;
const EXPLORER_PREVIEW_ROW_CLICK_SUPPRESS_MS = 180;

export type ExplorerPreviewEntryDragRequest<TEntry> = {
  entry: TEntry;
  entries: TEntry[];
  pointerId: number;
  startClientX: number;
  startClientY: number;
  currentClientX: number;
  currentClientY: number;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
};

type PreviewEntryDragCandidate<TEntry> = {
  pointerId: number;
  startClientX: number;
  startClientY: number;
  entry: TEntry;
  entries: TEntry[];
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  suppressKey: string;
};

export function useExplorerPreviewEntryDirectDrag<TEntry>(args: {
  entries: readonly TEntry[];
  getEntryKey: (entry: TEntry) => string;
  onOpenEntry: (entry: TEntry) => void;
  onStartDrag?: (
    request: ExplorerPreviewEntryDragRequest<TEntry>,
  ) => void | Promise<void>;
}) {
  const [selectedEntryKeys, setSelectedEntryKeys] = useState<Set<string>>(
    () => new Set(),
  );
  const dragCandidateRef = useRef<PreviewEntryDragCandidate<TEntry> | null>(null);
  const suppressClickKeyRef = useRef<string | null>(null);
  const suppressClickTimerRef = useRef<number | null>(null);
  const entryKeySet = useMemo(
    () => new Set(args.entries.map((entry) => args.getEntryKey(entry))),
    [args.entries, args.getEntryKey],
  );

  useEffect(() => {
    setSelectedEntryKeys((currentKeys) => {
      const nextKeys = new Set(
        [...currentKeys].filter((entryKey) => entryKeySet.has(entryKey)),
      );
      if (
        nextKeys.size === currentKeys.size &&
        [...nextKeys].every((entryKey) => currentKeys.has(entryKey))
      ) {
        return currentKeys;
      }
      return nextKeys;
    });
  }, [entryKeySet]);

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
      void args.onStartDrag?.({
        entry: candidate.entry,
        entries: candidate.entries,
        pointerId: candidate.pointerId,
        startClientX: candidate.startClientX,
        startClientY: candidate.startClientY,
        currentClientX: event.clientX,
        currentClientY: event.clientY,
        altKey: candidate.altKey,
        ctrlKey: candidate.ctrlKey,
        metaKey: candidate.metaKey,
      });
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

  const isPreviewEntrySelected = useCallback(
    (entryKey: string) => selectedEntryKeys.has(entryKey),
    [selectedEntryKeys],
  );

  const shouldSuppressPreviewEntryClick = useCallback(
    (suppressKey: string) => suppressClickKeyRef.current === suppressKey,
    [],
  );

  const bindPreviewEntryDirectDrag = useCallback(
    (entry: TEntry) => {
      const entryKey = args.getEntryKey(entry);
      return {
        onPointerDown: (event: ReactPointerEvent<HTMLElement>) => {
          if (event.button !== 0) {
            return;
          }

          const selectedEntries =
            selectedEntryKeys.has(entryKey) && selectedEntryKeys.size > 0
              ? args.entries.filter((candidate) =>
                  selectedEntryKeys.has(args.getEntryKey(candidate)),
                )
              : [];
          const dragEntries =
            selectedEntries.length > 0 ? selectedEntries : [entry];

          dragCandidateRef.current = {
            pointerId: event.pointerId,
            startClientX: event.clientX,
            startClientY: event.clientY,
            entry,
            entries: [...dragEntries],
            altKey: event.altKey,
            ctrlKey: event.ctrlKey,
            metaKey: event.metaKey,
            suppressKey: entryKey,
          };
        },
        onPointerCancel: (event: ReactPointerEvent<HTMLElement>) => {
          if (dragCandidateRef.current?.pointerId === event.pointerId) {
            dragCandidateRef.current = null;
          }
        },
        onClick: (event: ReactMouseEvent<HTMLElement>) => {
          if (shouldSuppressPreviewEntryClick(entryKey)) {
            event.preventDefault();
            return;
          }

          if (event.ctrlKey || event.metaKey) {
            event.preventDefault();
            setSelectedEntryKeys((currentKeys) => {
              const nextKeys = new Set(currentKeys);
              if (nextKeys.has(entryKey)) {
                nextKeys.delete(entryKey);
              } else {
                nextKeys.add(entryKey);
              }
              return nextKeys;
            });
            return;
          }

          setSelectedEntryKeys(new Set([entryKey]));
          args.onOpenEntry(entry);
        },
      };
    },
    [
      args.entries,
      args.getEntryKey,
      args.onOpenEntry,
      selectedEntryKeys,
      shouldSuppressPreviewEntryClick,
    ],
  );

  return {
    bindPreviewEntryDirectDrag,
    isPreviewEntrySelected,
    shouldSuppressPreviewEntryClick,
  };
}
