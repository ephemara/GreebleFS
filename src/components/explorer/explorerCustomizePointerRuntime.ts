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
  offsetPx: number;
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
const EXPLORER_CUSTOMIZE_SURFACE_ATTRIBUTE =
  "data-explorer-customize-surface-id";
const EXPLORER_CUSTOMIZE_REMOVE_ZONE_SELECTOR =
  '[data-explorer-customize-remove-zone="true"]';

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

function areExplorerCustomizePointerPointsEqual(
  left: ExplorerCustomizePointerPoint | null,
  right: ExplorerCustomizePointerPoint | null,
): boolean {
  return left?.x === right?.x && left?.y === right?.y;
}

function areExplorerCustomizePointerDropTargetsEqual(
  left: ExplorerCustomizePointerDropTarget | null,
  right: ExplorerCustomizePointerDropTarget | null,
): boolean {
  return (
    left?.surfaceId === right?.surfaceId &&
    left?.zoneId === right?.zoneId &&
    left?.targetIndex === right?.targetIndex &&
    left?.offsetPx === right?.offsetPx
  );
}

function syncSnapshotCache(): boolean {
  const nextSnapshot: ExplorerCustomizePointerSnapshot = {
    active: activeExplorerCustomizePointerSession?.active ?? false,
    draggingControlId: activeExplorerCustomizePointerSession?.controlId ?? null,
    sourceKind: activeExplorerCustomizePointerSession?.sourceKind ?? null,
    dropTarget: activeExplorerCustomizePointerSession?.dropTarget ?? null,
    removeTargetActive:
      activeExplorerCustomizePointerSession?.removeTargetActive ?? false,
    pointerPoint: activeExplorerCustomizePointerSession?.latestPoint ?? null,
  };
  if (
    snapshotCache.active === nextSnapshot.active &&
    snapshotCache.draggingControlId === nextSnapshot.draggingControlId &&
    snapshotCache.sourceKind === nextSnapshot.sourceKind &&
    snapshotCache.removeTargetActive === nextSnapshot.removeTargetActive &&
    areExplorerCustomizePointerDropTargetsEqual(
      snapshotCache.dropTarget,
      nextSnapshot.dropTarget,
    ) &&
    areExplorerCustomizePointerPointsEqual(
      snapshotCache.pointerPoint,
      nextSnapshot.pointerPoint,
    )
  ) {
    return false;
  }

  snapshotCache = nextSnapshot;
  return true;
}

function emitSnapshot(): void {
  if (!syncSnapshotCache()) {
    return;
  }
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

export function useExplorerCustomizePointerActive(): boolean {
  return useSyncExternalStore(
    subscribeToExplorerCustomizePointerSnapshot,
    () => getExplorerCustomizePointerSnapshot().active,
    () => getExplorerCustomizePointerSnapshot().active,
  );
}

export function useExplorerCustomizePointerSourceKind(): ExplorerCustomizePointerSourceKind | null {
  return useSyncExternalStore(
    subscribeToExplorerCustomizePointerSnapshot,
    () => getExplorerCustomizePointerSnapshot().sourceKind,
    () => getExplorerCustomizePointerSnapshot().sourceKind,
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

function pointIntersectsRect(
  point: ExplorerCustomizePointerPoint,
  rect: DOMRect,
): boolean {
  return (
    point.x >= rect.left &&
    point.x <= rect.right &&
    point.y >= rect.top &&
    point.y <= rect.bottom
  );
}

function distanceFromPointToRect(
  point: ExplorerCustomizePointerPoint,
  rect: DOMRect,
): number {
  const horizontalDistance =
    point.x < rect.left ? rect.left - point.x : point.x > rect.right ? point.x - rect.right : 0;
  const verticalDistance =
    point.y < rect.top ? rect.top - point.y : point.y > rect.bottom ? point.y - rect.bottom : 0;
  return Math.hypot(horizontalDistance, verticalDistance);
}

function getImmediateCustomizeZoneElements(
  rowElement: HTMLElement,
): HTMLElement[] {
  return Array.from(rowElement.children).filter(
    (child): child is HTMLElement =>
      child instanceof HTMLElement &&
      child.dataset.explorerCustomizeZoneId != null,
  );
}

function getImmediateCustomizeControlElements(
  zoneElement: HTMLElement,
  ignoredControlId?: ExplorerChromeControlId | null,
): HTMLElement[] {
  return Array.from(zoneElement.children).filter(
    (child): child is HTMLElement =>
      child instanceof HTMLElement &&
      child.dataset.overlayExplorerControl != null &&
      child.dataset.overlayExplorerControl !== ignoredControlId,
  );
}

interface ExplorerCustomizeAmbientZoneTarget {
  zoneElement: HTMLElement;
  territoryLeft: number;
  territoryRight: number;
}

function resolveAmbientRowElementInSurface(
  surfaceElement: HTMLElement,
  point: ExplorerCustomizePointerPoint,
): HTMLElement | null {
  const rowElements = Array.from(surfaceElement.children).filter(
    (child): child is HTMLElement =>
      child instanceof HTMLElement &&
      child.dataset.explorerCustomizeRowId != null,
  );
  if (rowElements.length === 0) {
    return null;
  }

  for (const rowElement of rowElements) {
    if (pointIntersectsRect(point, rowElement.getBoundingClientRect())) {
      return rowElement;
    }
  }

  return rowElements.reduce<HTMLElement | null>((closestRow, rowElement) => {
    if (!closestRow) {
      return rowElement;
    }
    return distanceFromPointToRect(
      point,
      rowElement.getBoundingClientRect(),
    ) <
      distanceFromPointToRect(point, closestRow.getBoundingClientRect())
      ? rowElement
      : closestRow;
  }, null);
}

function resolveAmbientZoneTargetInRow(
  rowElement: HTMLElement,
  point: ExplorerCustomizePointerPoint,
): ExplorerCustomizeAmbientZoneTarget | null {
  const zoneElements = getImmediateCustomizeZoneElements(rowElement);
  if (zoneElements.length === 0) {
    return null;
  }

  for (const zoneElement of zoneElements) {
    if (pointIntersectsRect(point, zoneElement.getBoundingClientRect())) {
      const zoneRect = zoneElement.getBoundingClientRect();
      return {
        zoneElement,
        territoryLeft: zoneRect.left,
        territoryRight: zoneRect.right,
      };
    }
  }

  const rowRect = rowElement.getBoundingClientRect();
  for (let index = 0; index < zoneElements.length; index += 1) {
    const zoneElement = zoneElements[index];
    const zoneRect = zoneElement.getBoundingClientRect();
    const previousRect =
      index > 0 ? zoneElements[index - 1]?.getBoundingClientRect() : null;
    const nextRect =
      index < zoneElements.length - 1
        ? zoneElements[index + 1]?.getBoundingClientRect()
        : null;
    const territoryLeft =
      previousRect == null ? rowRect.left : (previousRect.right + zoneRect.left) / 2;
    const territoryRight =
      nextRect == null ? rowRect.right : (zoneRect.right + nextRect.left) / 2;
    if (point.x >= territoryLeft && point.x <= territoryRight) {
      return {
        zoneElement,
        territoryLeft,
        territoryRight,
      };
    }
  }

  return zoneElements.reduce<ExplorerCustomizeAmbientZoneTarget | null>(
    (closestZone, zoneElement) => {
      if (!closestZone) {
        const zoneRect = zoneElement.getBoundingClientRect();
        return {
          zoneElement,
          territoryLeft: zoneRect.left,
          territoryRight: zoneRect.right,
        };
      }
      const currentRect = zoneElement.getBoundingClientRect();
      const closestRect = closestZone.zoneElement.getBoundingClientRect();
      return distanceFromPointToRect(point, currentRect) <
        distanceFromPointToRect(point, closestRect)
        ? {
            zoneElement,
            territoryLeft: currentRect.left,
            territoryRight: currentRect.right,
          }
        : closestZone;
    },
    null,
  );
}

function resolveInsertionPositionForZone(input: {
  zoneElement: HTMLElement;
  territoryLeft: number;
  territoryRight: number;
  point: ExplorerCustomizePointerPoint,
  ignoredControlId?: ExplorerChromeControlId | null;
}): {
  targetIndex: number;
  offsetPx: number;
} {
  const controlElements = getImmediateCustomizeControlElements(
    input.zoneElement,
    input.ignoredControlId,
  );
  const clampedPointX = Math.max(
    input.territoryLeft,
    Math.min(input.territoryRight, input.point.x),
  );
  if (controlElements.length === 0) {
    return {
      targetIndex: 0,
      offsetPx: Math.max(0, Math.round(clampedPointX - input.territoryLeft)),
    };
  }

  let targetIndex = controlElements.length;
  for (let index = 0; index < controlElements.length; index += 1) {
    const controlRect = controlElements[index].getBoundingClientRect();
    const controlMidpointX = controlRect.left + controlRect.width / 2;
    if (
      input.point.y < controlRect.top ||
      (input.point.y <= controlRect.bottom && clampedPointX < controlMidpointX)
    ) {
      targetIndex = index;
      break;
    }
  }

  const previousControlRect =
    targetIndex > 0
      ? controlElements[targetIndex - 1]?.getBoundingClientRect()
      : null;
  const nextControlRect =
    targetIndex < controlElements.length
      ? controlElements[targetIndex]?.getBoundingClientRect()
      : null;
  const slotStart = previousControlRect?.right ?? input.territoryLeft;
  const slotEnd = nextControlRect?.left ?? input.territoryRight;
  const clampedSlotPointX = Math.max(
    slotStart,
    Math.min(slotEnd, clampedPointX),
  );

  return {
    targetIndex,
    offsetPx: Math.max(0, Math.round(clampedSlotPointX - slotStart)),
  };
}

function resolveAmbientSurfaceElementFromPoint(
  point: ExplorerCustomizePointerPoint,
): HTMLElement | null {
  if (typeof document === "undefined") {
    return null;
  }

  const surfaceElements = Array.from(
    document.querySelectorAll<HTMLElement>(
      `[${EXPLORER_CUSTOMIZE_SURFACE_ATTRIBUTE}]`,
    ),
  );
  if (surfaceElements.length === 0) {
    return null;
  }

  for (const surfaceElement of surfaceElements) {
    if (pointIntersectsRect(point, surfaceElement.getBoundingClientRect())) {
      return surfaceElement;
    }
  }

  return null;
}

export function resolveExplorerCustomizeDropTargetFromPoint(
  point: ExplorerCustomizePointerPoint,
): {
  dropTarget: ExplorerCustomizePointerDropTarget | null;
  removeTargetActive: boolean;
} {
  if (typeof document === "undefined") {
    return { dropTarget: null, removeTargetActive: false };
  }

  const hoveredElement = document.elementFromPoint(point.x, point.y);

  const ambientSurfaceElement = resolveAmbientSurfaceElementFromPoint(point);
  if (ambientSurfaceElement) {
    const surfaceId = ambientSurfaceElement.dataset
      .explorerCustomizeSurfaceId as
      | ExplorerChromeSurfaceId
      | undefined;
    const ambientRowElement = resolveAmbientRowElementInSurface(
      ambientSurfaceElement,
      point,
    );
    const ambientZoneTarget =
      ambientRowElement == null
        ? null
        : resolveAmbientZoneTargetInRow(ambientRowElement, point);
    const zoneId = ambientZoneTarget?.zoneElement.dataset.explorerCustomizeZoneId as
      | ExplorerChromeZoneId
      | undefined;
    const ignoredControlId =
      activeExplorerCustomizePointerSession?.sourceKind === "placed"
        ? activeExplorerCustomizePointerSession.controlId
        : null;
    const insertionPosition =
      ambientZoneTarget == null
        ? null
        : resolveInsertionPositionForZone({
            zoneElement: ambientZoneTarget.zoneElement,
            territoryLeft: ambientZoneTarget.territoryLeft,
            territoryRight: ambientZoneTarget.territoryRight,
            point,
            ignoredControlId,
          });
    if (
      surfaceId &&
      zoneId &&
      insertionPosition &&
      Number.isFinite(insertionPosition.targetIndex) &&
      Number.isInteger(insertionPosition.targetIndex)
    ) {
      return {
        dropTarget: {
          surfaceId,
          zoneId,
          targetIndex: insertionPosition.targetIndex,
          offsetPx: insertionPosition.offsetPx,
        },
        removeTargetActive: false,
      };
    }
  }

  const removeZone =
    hoveredElement instanceof HTMLElement
      ? hoveredElement.closest<HTMLElement>(EXPLORER_CUSTOMIZE_REMOVE_ZONE_SELECTOR)
      : null;
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
    areExplorerCustomizePointerDropTargetsEqual(
      currentDropTarget,
      nextDropTarget,
    )
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

  const targetState = resolveExplorerCustomizeDropTargetFromPoint(point);
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
