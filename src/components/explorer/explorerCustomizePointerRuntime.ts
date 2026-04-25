import { useSyncExternalStore } from "react";

import type {
  ExplorerChromeControlId,
  ExplorerChromeSurfaceId,
  ExplorerChromeZoneId,
} from "../../config/explorerChromeLayouts";

type ExplorerCustomizePointerPoint = {
  x: number;
  y: number;
};

export type ExplorerCustomizePointerSourceKind = "placed" | "catalog";

export interface ExplorerCustomizePointerDropTarget {
  surfaceId: ExplorerChromeSurfaceId;
  zoneId: ExplorerChromeZoneId;
  targetIndex: number;
}

export interface ExplorerCustomizePointerSnapshot {
  active: boolean;
  draggingControlId: ExplorerChromeControlId | null;
  sourceKind: ExplorerCustomizePointerSourceKind | null;
  dropTarget: ExplorerCustomizePointerDropTarget | null;
  removeTargetActive: boolean;
  pointerPoint: ExplorerCustomizePointerPoint | null;
}

interface ExplorerCustomizePointerSession {
  pointerId: number;
  controlId: ExplorerChromeControlId;
  sourceKind: ExplorerCustomizePointerSourceKind;
  startPoint: ExplorerCustomizePointerPoint;
  latestPoint: ExplorerCustomizePointerPoint;
  active: boolean;
  dropTarget: ExplorerCustomizePointerDropTarget | null;
  removeTargetActive: boolean;
  onActivate?: ((controlId: ExplorerChromeControlId) => void) | null;
  onUpdateDropTarget?:
    | ((target: ExplorerCustomizePointerDropTarget | null) => void)
    | null;
  onTap?: ((controlId: ExplorerChromeControlId) => void) | null;
  onDrop?:
    | ((args: {
        controlId: ExplorerChromeControlId;
        sourceKind: ExplorerCustomizePointerSourceKind;
        target: ExplorerCustomizePointerDropTarget;
      }) => void)
    | null;
  onRemove?: ((controlId: ExplorerChromeControlId) => void) | null;
  onComplete?: (() => void) | null;
}

export interface BeginExplorerCustomizePointerSessionArgs {
  pointerId: number;
  controlId: ExplorerChromeControlId;
  sourceKind: ExplorerCustomizePointerSourceKind;
  startPoint: ExplorerCustomizePointerPoint;
  onActivate?: ((controlId: ExplorerChromeControlId) => void) | null;
  onUpdateDropTarget?:
    | ((target: ExplorerCustomizePointerDropTarget | null) => void)
    | null;
  onTap?: ((controlId: ExplorerChromeControlId) => void) | null;
  onDrop?:
    | ((args: {
        controlId: ExplorerChromeControlId;
        sourceKind: ExplorerCustomizePointerSourceKind;
        target: ExplorerCustomizePointerDropTarget;
      }) => void)
    | null;
  onRemove?: ((controlId: ExplorerChromeControlId) => void) | null;
  onComplete?: (() => void) | null;
}

const EXPLORER_CUSTOMIZE_POINTER_START_DISTANCE_PX = 6;

const snapshotListeners = new Set<() => void>();

let activeExplorerCustomizePointerSession: ExplorerCustomizePointerSession | null =
  null;
let windowListenersAttached = false;
let savedBodyUserSelect: string | null = null;
let savedBodyCursor: string | null = null;
let snapshotCache: ExplorerCustomizePointerSnapshot = {
  active: false,
  draggingControlId: null,
  sourceKind: null,
  dropTarget: null,
  removeTargetActive: false,
  pointerPoint: null,
};

function syncSnapshotCache(): void {
  snapshotCache = {
    active: activeExplorerCustomizePointerSession?.active ?? false,
    draggingControlId: activeExplorerCustomizePointerSession?.controlId ?? null,
    sourceKind: activeExplorerCustomizePointerSession?.sourceKind ?? null,
    dropTarget: activeExplorerCustomizePointerSession?.dropTarget ?? null,
    removeTargetActive:
      activeExplorerCustomizePointerSession?.removeTargetActive ?? false,
    pointerPoint: activeExplorerCustomizePointerSession?.latestPoint ?? null,
  };
}

function emitSnapshot(): void {
  syncSnapshotCache();
  for (const listener of snapshotListeners) {
    listener();
  }
}

function subscribeToExplorerCustomizePointerSnapshot(
  listener: () => void,
): () => void {
  snapshotListeners.add(listener);
  return () => {
    snapshotListeners.delete(listener);
  };
}

function getExplorerCustomizePointerSnapshot(): ExplorerCustomizePointerSnapshot {
  syncSnapshotCache();
  return snapshotCache;
}

export function useExplorerCustomizePointerSnapshot(): ExplorerCustomizePointerSnapshot {
  return useSyncExternalStore(
    subscribeToExplorerCustomizePointerSnapshot,
    getExplorerCustomizePointerSnapshot,
    getExplorerCustomizePointerSnapshot,
  );
}

export function isExplorerCustomizePointerActive(): boolean {
  return getExplorerCustomizePointerSnapshot().active;
}

function applyBodyDragState(): void {
  if (typeof document === "undefined") {
    return;
  }

  const { body } = document;
  if (!body) {
    return;
  }

  if (savedBodyUserSelect === null) {
    savedBodyUserSelect = body.style.userSelect;
  }
  if (savedBodyCursor === null) {
    savedBodyCursor = body.style.cursor;
  }

  body.style.userSelect = "none";
  body.style.cursor = "grabbing";
}

function restoreBodyDragState(): void {
  if (typeof document === "undefined") {
    savedBodyUserSelect = null;
    savedBodyCursor = null;
    return;
  }

  const { body } = document;
  if (!body) {
    savedBodyUserSelect = null;
    savedBodyCursor = null;
    return;
  }

  if (savedBodyUserSelect !== null) {
    body.style.userSelect = savedBodyUserSelect;
  } else {
    body.style.removeProperty("user-select");
  }
  if (savedBodyCursor !== null) {
    body.style.cursor = savedBodyCursor;
  } else {
    body.style.removeProperty("cursor");
  }

  savedBodyUserSelect = null;
  savedBodyCursor = null;
}

function resolveDropTargetFromPoint(point: ExplorerCustomizePointerPoint): {
  dropTarget: ExplorerCustomizePointerDropTarget | null;
  removeTargetActive: boolean;
} {
  if (typeof document === "undefined") {
    return { dropTarget: null, removeTargetActive: false };
  }

  const hoveredElement = document.elementFromPoint(point.x, point.y);
  if (!(hoveredElement instanceof HTMLElement)) {
    return { dropTarget: null, removeTargetActive: false };
  }

  const dropZone = hoveredElement.closest<HTMLElement>(
    "[data-explorer-customize-drop-surface-id]",
  );
  if (dropZone) {
    const surfaceId = dropZone.dataset.explorerCustomizeDropSurfaceId as
      | ExplorerChromeSurfaceId
      | undefined;
    const zoneId = dropZone.dataset.explorerCustomizeDropZoneId as
      | ExplorerChromeZoneId
      | undefined;
    const targetIndexValue = dropZone.dataset.explorerCustomizeDropTargetIndex;
    const targetIndex =
      targetIndexValue == null
        ? Number.NaN
        : Number.parseInt(targetIndexValue, 10);
    if (
      surfaceId &&
      zoneId &&
      Number.isFinite(targetIndex) &&
      Number.isInteger(targetIndex)
    ) {
      return {
        dropTarget: {
          surfaceId,
          zoneId,
          targetIndex,
        },
        removeTargetActive: false,
      };
    }
  }

  const removeZone = hoveredElement.closest<HTMLElement>(
    '[data-explorer-customize-remove-zone="true"]',
  );
  return {
    dropTarget: null,
    removeTargetActive: removeZone != null,
  };
}

function clearHighlightedDropTarget(): void {
  activeExplorerCustomizePointerSession?.onUpdateDropTarget?.(null);
}

function updateHighlightedDropTarget(
  nextDropTarget: ExplorerCustomizePointerDropTarget | null,
): void {
  const currentSession = activeExplorerCustomizePointerSession;
  if (!currentSession) {
    return;
  }

  const currentDropTarget = currentSession.dropTarget;
  if (
    currentDropTarget?.surfaceId === nextDropTarget?.surfaceId &&
    currentDropTarget?.zoneId === nextDropTarget?.zoneId &&
    currentDropTarget?.targetIndex === nextDropTarget?.targetIndex
  ) {
    return;
  }

  currentSession.onUpdateDropTarget?.(nextDropTarget);
}

function commitExplorerCustomizePointerMove(
  point: ExplorerCustomizePointerPoint,
  pointerId: number,
): void {
  const currentSession = activeExplorerCustomizePointerSession;
  if (!currentSession || currentSession.pointerId !== pointerId) {
    return;
  }

  const movedDistance = Math.hypot(
    point.x - currentSession.startPoint.x,
    point.y - currentSession.startPoint.y,
  );

  if (
    !currentSession.active &&
    movedDistance < EXPLORER_CUSTOMIZE_POINTER_START_DISTANCE_PX
  ) {
    return;
  }

  if (!currentSession.active) {
    applyBodyDragState();
    currentSession.onActivate?.(currentSession.controlId);
    currentSession.active = true;
  }

  const targetState = resolveDropTargetFromPoint(point);
  updateHighlightedDropTarget(targetState.dropTarget);
  activeExplorerCustomizePointerSession = {
    ...currentSession,
    latestPoint: point,
    dropTarget: targetState.dropTarget,
    removeTargetActive: targetState.removeTargetActive,
    active: true,
  };
  emitSnapshot();
}

function finishExplorerCustomizePointerSession(args: {
  pointerId?: number | null;
  shouldDrop: boolean;
}): void {
  const currentSession = activeExplorerCustomizePointerSession;
  if (!currentSession) {
    return;
  }

  if (args.pointerId != null && currentSession.pointerId !== args.pointerId) {
    return;
  }

  const dragWasActive = currentSession.active;
  const dropTarget = currentSession.dropTarget;
  const removeTargetActive = currentSession.removeTargetActive;
  const controlId = currentSession.controlId;
  const sourceKind = currentSession.sourceKind;
  const onTap = currentSession.onTap;
  const onDrop = currentSession.onDrop;
  const onRemove = currentSession.onRemove;
  const onComplete = currentSession.onComplete;

  clearHighlightedDropTarget();
  activeExplorerCustomizePointerSession = null;
  restoreBodyDragState();
  detachWindowListeners();
  emitSnapshot();

  if (!dragWasActive) {
    onTap?.(controlId);
    onComplete?.();
    return;
  }

  if (args.shouldDrop) {
    if (removeTargetActive && sourceKind === "placed") {
      onRemove?.(controlId);
    } else if (dropTarget) {
      onDrop?.({
        controlId,
        sourceKind,
        target: dropTarget,
      });
    }
  }

  onComplete?.();
}

function handleWindowPointerMove(event: PointerEvent): void {
  commitExplorerCustomizePointerMove(
    {
      x: event.clientX,
      y: event.clientY,
    },
    event.pointerId,
  );
}

function handleWindowPointerUp(event: PointerEvent): void {
  finishExplorerCustomizePointerSession({
    pointerId: event.pointerId,
    shouldDrop: true,
  });
}

function handleWindowPointerCancel(event: PointerEvent): void {
  finishExplorerCustomizePointerSession({
    pointerId: event.pointerId,
    shouldDrop: false,
  });
}

function handleWindowBlur(): void {
  finishExplorerCustomizePointerSession({
    shouldDrop: false,
  });
}

function handleWindowKeyDown(event: KeyboardEvent): void {
  if (event.key !== "Escape") {
    return;
  }
  finishExplorerCustomizePointerSession({
    shouldDrop: false,
  });
}

function attachWindowListeners(): void {
  if (windowListenersAttached || typeof window === "undefined") {
    return;
  }

  windowListenersAttached = true;
  window.addEventListener("pointermove", handleWindowPointerMove);
  window.addEventListener("pointerup", handleWindowPointerUp);
  window.addEventListener("pointercancel", handleWindowPointerCancel);
  window.addEventListener("blur", handleWindowBlur);
  window.addEventListener("keydown", handleWindowKeyDown);
}

function detachWindowListeners(): void {
  if (!windowListenersAttached || typeof window === "undefined") {
    return;
  }

  windowListenersAttached = false;
  window.removeEventListener("pointermove", handleWindowPointerMove);
  window.removeEventListener("pointerup", handleWindowPointerUp);
  window.removeEventListener("pointercancel", handleWindowPointerCancel);
  window.removeEventListener("blur", handleWindowBlur);
  window.removeEventListener("keydown", handleWindowKeyDown);
}

export function cancelExplorerCustomizePointerSession(): void {
  finishExplorerCustomizePointerSession({
    shouldDrop: false,
  });
}

export function beginExplorerCustomizePointerSession(
  args: BeginExplorerCustomizePointerSessionArgs,
): void {
  cancelExplorerCustomizePointerSession();
  activeExplorerCustomizePointerSession = {
    pointerId: args.pointerId,
    controlId: args.controlId,
    sourceKind: args.sourceKind,
    startPoint: args.startPoint,
    latestPoint: args.startPoint,
    active: false,
    dropTarget: null,
    removeTargetActive: false,
    onActivate: args.onActivate ?? null,
    onUpdateDropTarget: args.onUpdateDropTarget ?? null,
    onTap: args.onTap ?? null,
    onDrop: args.onDrop ?? null,
    onRemove: args.onRemove ?? null,
    onComplete: args.onComplete ?? null,
  };
  attachWindowListeners();
  emitSnapshot();
}
