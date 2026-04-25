import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';

type PanelPointerPoint = {
  x: number;
  y: number;
};

type PanelListDragSnapshot = {
  active: boolean;
  draggedItemId: string | null;
  hoveredListId: string | null;
  hoveredIndex: number | null;
};

type PanelListDragSession = {
  pointerId: number;
  itemId: string;
  sourceListId: string;
  startPoint: PanelPointerPoint;
  latestPoint: PanelPointerPoint;
  active: boolean;
  hoveredListId: string | null;
  hoveredIndex: number | null;
  onDragStart?: ((itemId: string) => void) | null;
  onDragEnd?: (() => void) | null;
};

type PanelListRegistryEntry = {
  setHoveredDropIndex: (index: number | null) => void;
  onDropItem: (itemId: string, index: number) => void;
  resolveDropIndexFromPoint: (point: PanelPointerPoint) => number | null;
};

export interface DraggablePanelListDragHandleProps {
  onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void;
  'data-draggable-panel-handle': string;
}

export interface DraggablePanelListRenderItemArgs<TItem> {
  item: TItem;
  itemId: string;
  isActive: boolean;
  isDragging: boolean;
  dragHandleProps: DraggablePanelListDragHandleProps;
}

export interface DraggablePanelListProps<TItem> {
  items: readonly TItem[];
  getItemId: (item: TItem) => string;
  renderItem: (args: DraggablePanelListRenderItemArgs<TItem>) => ReactNode;
  renderChildren?: (item: TItem) => ReactNode;
  activeItemId?: string | null;
  draggedItemId?: string | null;
  onSelectItem?: (itemId: string) => void;
  onDragStart?: (itemId: string) => void;
  onDragEnd?: () => void;
  onDropItem: (itemId: string, index: number) => void;
  emptyState?: ReactNode;
  className?: string;
  style?: CSSProperties;
  listLabel?: string;
  accentColor?: string;
  borderColor?: string;
}

const DEFAULT_ACCENT_COLOR = 'var(--overlay-accent)';
const DEFAULT_BORDER_COLOR = 'var(--overlay-workbench-settings-card-border)';
const PANEL_LIST_DRAG_START_DISTANCE_PX = 6;

const panelListRegistry = new Map<string, PanelListRegistryEntry>();
const panelListDragListeners = new Set<() => void>();

let activePanelListDragSession: PanelListDragSession | null = null;
let panelListWindowListenersAttached = false;
let savedBodyUserSelect: string | null = null;
let savedBodyCursor: string | null = null;
let nextPanelListRuntimeId = 1;
let panelListDragSnapshotCache: PanelListDragSnapshot = {
  active: false,
  draggedItemId: null,
  hoveredListId: null,
  hoveredIndex: null,
};

function syncPanelListDragSnapshotCache(): void {
  const nextSnapshot: PanelListDragSnapshot = {
    active: activePanelListDragSession?.active ?? false,
    draggedItemId:
      activePanelListDragSession?.active === true
        ? activePanelListDragSession.itemId
        : null,
    hoveredListId: activePanelListDragSession?.hoveredListId ?? null,
    hoveredIndex: activePanelListDragSession?.hoveredIndex ?? null,
  };

  if (
    panelListDragSnapshotCache.active === nextSnapshot.active &&
    panelListDragSnapshotCache.draggedItemId === nextSnapshot.draggedItemId &&
    panelListDragSnapshotCache.hoveredListId === nextSnapshot.hoveredListId &&
    panelListDragSnapshotCache.hoveredIndex === nextSnapshot.hoveredIndex
  ) {
    return;
  }

  panelListDragSnapshotCache = nextSnapshot;
}

function emitPanelListDragSnapshot(): void {
  syncPanelListDragSnapshotCache();
  for (const listener of panelListDragListeners) {
    listener();
  }
}

function getPanelListDragSnapshot(): PanelListDragSnapshot {
  syncPanelListDragSnapshotCache();
  return panelListDragSnapshotCache;
}

function subscribeToPanelListDrag(listener: () => void): () => void {
  panelListDragListeners.add(listener);
  return () => {
    panelListDragListeners.delete(listener);
  };
}

function usePanelListDragSnapshot(): PanelListDragSnapshot {
  return useSyncExternalStore(
    subscribeToPanelListDrag,
    getPanelListDragSnapshot,
    getPanelListDragSnapshot,
  );
}

function clearPanelListHoveredTarget(): void {
  if (
    activePanelListDragSession?.hoveredListId &&
    panelListRegistry.has(activePanelListDragSession.hoveredListId)
  ) {
    panelListRegistry
      .get(activePanelListDragSession.hoveredListId)
      ?.setHoveredDropIndex(null);
  }
}

function setPanelListHoveredTarget(
  listId: string | null,
  index: number | null,
): void {
  const currentSession = activePanelListDragSession;
  if (!currentSession) {
    return;
  }

  if (
    currentSession.hoveredListId === listId &&
    currentSession.hoveredIndex === index
  ) {
    return;
  }

  clearPanelListHoveredTarget();

  if (listId && index != null) {
    panelListRegistry.get(listId)?.setHoveredDropIndex(index);
  }

  activePanelListDragSession = {
    ...currentSession,
    hoveredListId: listId,
    hoveredIndex: index,
  };
  emitPanelListDragSnapshot();
}

function applyPanelListDragBodyState(): void {
  if (typeof document === 'undefined') {
    return;
  }

  const body = document.body;
  if (!body) {
    return;
  }

  if (savedBodyUserSelect === null) {
    savedBodyUserSelect = body.style.userSelect;
  }
  if (savedBodyCursor === null) {
    savedBodyCursor = body.style.cursor;
  }

  body.style.userSelect = 'none';
  body.style.cursor = 'grabbing';
}

function restorePanelListDragBodyState(): void {
  if (typeof document === 'undefined') {
    savedBodyUserSelect = null;
    savedBodyCursor = null;
    return;
  }

  const body = document.body;
  if (!body) {
    savedBodyUserSelect = null;
    savedBodyCursor = null;
    return;
  }

  if (savedBodyUserSelect !== null) {
    body.style.userSelect = savedBodyUserSelect;
  } else {
    body.style.removeProperty('user-select');
  }
  if (savedBodyCursor !== null) {
    body.style.cursor = savedBodyCursor;
  } else {
    body.style.removeProperty('cursor');
  }

  savedBodyUserSelect = null;
  savedBodyCursor = null;
}

function resolvePanelListDropTargetFromPoint(
  point: PanelPointerPoint,
): { listId: string; index: number } | null {
  if (typeof document === 'undefined') {
    return null;
  }

  const hoveredElement = document.elementFromPoint(point.x, point.y);
  if (!(hoveredElement instanceof Element)) {
    return null;
  }

  const explicitDropZone = hoveredElement.closest<HTMLElement>(
    '[data-draggable-panel-drop-zone-list-id]',
  );
  if (explicitDropZone) {
    const listId =
      explicitDropZone.dataset.draggablePanelDropZoneListId ?? null;
    const indexValue =
      explicitDropZone.dataset.draggablePanelDropZoneIndex ?? null;
    const index =
      indexValue == null ? Number.NaN : Number.parseInt(indexValue, 10);
    if (listId && Number.isFinite(index) && panelListRegistry.has(listId)) {
      return { listId, index };
    }
  }

  const hoveredListElement = hoveredElement.closest<HTMLElement>(
    '[data-draggable-panel-runtime-list-id]',
  );
  const listId = hoveredListElement?.dataset.draggablePanelRuntimeListId;
  if (!listId) {
    return null;
  }

  const listEntry = panelListRegistry.get(listId);
  if (!listEntry) {
    return null;
  }

  const resolvedIndex = listEntry.resolveDropIndexFromPoint(point);
  if (resolvedIndex == null) {
    return null;
  }

  return {
    listId,
    index: resolvedIndex,
  };
}

function commitPanelListPointerMove(point: PanelPointerPoint, pointerId: number) {
  const currentSession = activePanelListDragSession;
  if (!currentSession || currentSession.pointerId !== pointerId) {
    return;
  }

  const movedDistance = Math.hypot(
    point.x - currentSession.startPoint.x,
    point.y - currentSession.startPoint.y,
  );

  if (!currentSession.active && movedDistance < PANEL_LIST_DRAG_START_DISTANCE_PX) {
    return;
  }

  if (!currentSession.active) {
    activePanelListDragSession = {
      ...currentSession,
      active: true,
      latestPoint: point,
    };
    currentSession.onDragStart?.(currentSession.itemId);
    applyPanelListDragBodyState();
    emitPanelListDragSnapshot();
  } else {
    activePanelListDragSession = {
      ...currentSession,
      latestPoint: point,
    };
  }

  const dropTarget = resolvePanelListDropTargetFromPoint(point);
  setPanelListHoveredTarget(dropTarget?.listId ?? null, dropTarget?.index ?? null);
}

function finishPanelListDragSession(args: {
  pointerId?: number | null;
  shouldDrop: boolean;
}): void {
  const currentSession = activePanelListDragSession;
  if (!currentSession) {
    return;
  }

  if (
    args.pointerId != null &&
    currentSession.pointerId !== args.pointerId
  ) {
    return;
  }

  const hoveredListId = currentSession.hoveredListId;
  const hoveredIndex = currentSession.hoveredIndex;
  const draggedItemId = currentSession.itemId;
  const dragWasActive = currentSession.active;
  const dragEndHandler = currentSession.onDragEnd;

  clearPanelListHoveredTarget();
  activePanelListDragSession = null;
  restorePanelListDragBodyState();
  detachPanelListWindowListeners();
  emitPanelListDragSnapshot();

  if (
    args.shouldDrop &&
    dragWasActive &&
    hoveredListId != null &&
    hoveredIndex != null
  ) {
    panelListRegistry.get(hoveredListId)?.onDropItem(draggedItemId, hoveredIndex);
  }

  dragEndHandler?.();
}

function handlePanelListWindowPointerMove(event: PointerEvent): void {
  commitPanelListPointerMove(
    {
      x: event.clientX,
      y: event.clientY,
    },
    event.pointerId,
  );
}

function handlePanelListWindowPointerUp(event: PointerEvent): void {
  finishPanelListDragSession({
    pointerId: event.pointerId,
    shouldDrop: true,
  });
}

function handlePanelListWindowPointerCancel(event: PointerEvent): void {
  finishPanelListDragSession({
    pointerId: event.pointerId,
    shouldDrop: false,
  });
}

function handlePanelListWindowBlur(): void {
  finishPanelListDragSession({
    shouldDrop: false,
  });
}

function handlePanelListWindowKeyDown(event: KeyboardEvent): void {
  if (event.key !== 'Escape') {
    return;
  }
  finishPanelListDragSession({
    shouldDrop: false,
  });
}

function attachPanelListWindowListeners(): void {
  if (panelListWindowListenersAttached || typeof window === 'undefined') {
    return;
  }

  panelListWindowListenersAttached = true;
  window.addEventListener('pointermove', handlePanelListWindowPointerMove);
  window.addEventListener('pointerup', handlePanelListWindowPointerUp);
  window.addEventListener('pointercancel', handlePanelListWindowPointerCancel);
  window.addEventListener('blur', handlePanelListWindowBlur);
  window.addEventListener('keydown', handlePanelListWindowKeyDown);
}

function detachPanelListWindowListeners(): void {
  if (!panelListWindowListenersAttached || typeof window === 'undefined') {
    return;
  }

  panelListWindowListenersAttached = false;
  window.removeEventListener('pointermove', handlePanelListWindowPointerMove);
  window.removeEventListener('pointerup', handlePanelListWindowPointerUp);
  window.removeEventListener('pointercancel', handlePanelListWindowPointerCancel);
  window.removeEventListener('blur', handlePanelListWindowBlur);
  window.removeEventListener('keydown', handlePanelListWindowKeyDown);
}

function startPanelListPointerSession(args: {
  pointerId: number;
  itemId: string;
  sourceListId: string;
  startPoint: PanelPointerPoint;
  onDragStart?: ((itemId: string) => void) | null;
  onDragEnd?: (() => void) | null;
}): void {
  finishPanelListDragSession({
    shouldDrop: false,
  });

  activePanelListDragSession = {
    pointerId: args.pointerId,
    itemId: args.itemId,
    sourceListId: args.sourceListId,
    startPoint: args.startPoint,
    latestPoint: args.startPoint,
    active: false,
    hoveredListId: null,
    hoveredIndex: null,
    onDragStart: args.onDragStart ?? null,
    onDragEnd: args.onDragEnd ?? null,
  };
  attachPanelListWindowListeners();
  emitPanelListDragSnapshot();
}

export function DraggablePanelList<TItem>({
  items,
  getItemId,
  renderItem,
  renderChildren,
  activeItemId = null,
  draggedItemId = null,
  onSelectItem,
  onDragStart,
  onDragEnd,
  onDropItem,
  emptyState,
  className,
  style,
  listLabel = 'panel-list',
  accentColor = DEFAULT_ACCENT_COLOR,
  borderColor = DEFAULT_BORDER_COLOR,
}: DraggablePanelListProps<TItem>) {
  const listRuntimeIdRef = useRef<string>(
    `draggable-panel-list-${nextPanelListRuntimeId++}`,
  );
  const listRuntimeId = listRuntimeIdRef.current;
  const listRootRef = useRef<HTMLDivElement | null>(null);
  const itemElementMapRef = useRef<Map<string, HTMLDivElement>>(new Map());
  const [hoveredDropIndex, setHoveredDropIndex] = useState<number | null>(null);
  const dragSnapshot = usePanelListDragSnapshot();
  const effectiveDraggedItemId = draggedItemId ?? dragSnapshot.draggedItemId;
  const dragActive = effectiveDraggedItemId != null;

  useEffect(() => {
    panelListRegistry.set(listRuntimeId, {
      setHoveredDropIndex,
      onDropItem,
      resolveDropIndexFromPoint: (point) => {
        const listElement = listRootRef.current;
        if (!listElement) {
          return null;
        }

        const listRect = listElement.getBoundingClientRect();
        const horizontalInset = 20;
        const verticalInset = 12;
        const pointInsideList =
          point.x >= listRect.left - horizontalInset &&
          point.x <= listRect.right + horizontalInset &&
          point.y >= listRect.top - verticalInset &&
          point.y <= listRect.bottom + verticalInset;

        if (!pointInsideList) {
          return null;
        }

        if (items.length === 0) {
          return 0;
        }

        for (let index = 0; index < items.length; index += 1) {
          const itemId = getItemId(items[index]);
          const itemElement = itemElementMapRef.current.get(itemId);
          if (!itemElement) {
            continue;
          }

          const itemRect = itemElement.getBoundingClientRect();
          const itemMidpointY = itemRect.top + itemRect.height / 2;
          if (point.y < itemMidpointY) {
            return index;
          }
        }

        return items.length;
      },
    });

    return () => {
      if (activePanelListDragSession?.hoveredListId === listRuntimeId) {
        setHoveredDropIndex(null);
      }
      panelListRegistry.delete(listRuntimeId);
    };
  }, [getItemId, items, listRuntimeId, onDropItem]);

  useEffect(() => {
    if (!dragActive) {
      setHoveredDropIndex(null);
    }
  }, [dragActive]);

  const registerItemElement = useMemo(
    () =>
      (itemId: string) =>
      (node: HTMLDivElement | null) => {
        if (node) {
          itemElementMapRef.current.set(itemId, node);
        } else {
          itemElementMapRef.current.delete(itemId);
        }
      },
    [],
  );

  const renderDropZone = (dropIndex: number) => {
    const indicatorActive = dragActive && hoveredDropIndex === dropIndex;

    return (
      <div
        key={`${listLabel}-drop-${dropIndex}`}
        data-draggable-panel-drop-zone={`${listLabel}:${dropIndex}`}
        data-draggable-panel-drop-zone-list-id={listRuntimeId}
        data-draggable-panel-drop-zone-index={dropIndex}
        aria-hidden
        style={{
          minHeight: dragActive ? 18 : 6,
          padding: dragActive ? '2px 0' : 0,
          pointerEvents: dragActive ? 'auto' : 'none',
        }}
      >
        <div
          aria-hidden
          style={{
            position: 'relative',
            height: indicatorActive ? 10 : 4,
            opacity: dragActive || indicatorActive ? 1 : 0,
            transition: 'opacity 120ms ease, height 120ms ease',
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: 0,
              right: 0,
              height: indicatorActive ? 2 : 1,
              transform: 'translateY(-50%)',
              borderRadius: 999,
              background: indicatorActive ? accentColor : `${borderColor}cc`,
            }}
          />
          {indicatorActive ? (
            <>
              <div
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: 0,
                  width: 8,
                  height: 8,
                  borderRadius: '999px',
                  transform: 'translateY(-50%)',
                  background: accentColor,
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  top: '50%',
                  right: 0,
                  width: 8,
                  height: 8,
                  borderRadius: '999px',
                  transform: 'translateY(-50%)',
                  background: accentColor,
                }}
              />
            </>
          ) : null}
        </div>
      </div>
    );
  };

  if (items.length === 0) {
    const emptyActive = dragActive && hoveredDropIndex === 0;

    return (
      <div
        ref={listRootRef}
        data-draggable-panel-list={listLabel}
        data-draggable-panel-runtime-list-id={listRuntimeId}
        className={className}
        style={style}
      >
        <div
          data-draggable-panel-empty={listLabel}
          aria-label={`Empty ${listLabel}`}
          className="rounded-xl border border-dashed px-3 py-4 text-[11px]"
          style={{
            borderColor: emptyActive ? accentColor : `${borderColor}aa`,
            background: emptyActive ? `${accentColor}10` : 'rgba(255,255,255,0.02)',
            transition: 'border-color 120ms ease, background 120ms ease',
          }}
        >
          {emptyState}
        </div>
      </div>
    );
  }

  return (
    <div
      ref={listRootRef}
      data-draggable-panel-list={listLabel}
      data-draggable-panel-runtime-list-id={listRuntimeId}
      className={className}
      style={style}
    >
      {renderDropZone(0)}
      {items.map((item, index) => {
        const itemId = getItemId(item);
        const isActive = activeItemId === itemId;
        const isDragging = effectiveDraggedItemId === itemId;

        return (
          <div
            key={itemId}
            data-draggable-panel-item={itemId}
            style={{
              opacity: isDragging ? 0.7 : 1,
              transition: 'opacity 120ms ease',
            }}
          >
            <div
              ref={registerItemElement(itemId)}
              data-draggable-panel-row-shell={itemId}
            >
              {renderItem({
                item,
                itemId,
                isActive,
                isDragging,
                dragHandleProps: {
                  'data-draggable-panel-handle': itemId,
                  onPointerDown: (event) => {
                    if (event.button !== 0) {
                      return;
                    }
                    event.preventDefault();
                    event.stopPropagation();
                    onSelectItem?.(itemId);
                    startPanelListPointerSession({
                      pointerId: event.pointerId,
                      itemId,
                      sourceListId: listRuntimeId,
                      startPoint: {
                        x: event.clientX,
                        y: event.clientY,
                      },
                      onDragStart,
                      onDragEnd,
                    });
                  },
                },
              })}
            </div>
            {renderChildren?.(item)}
            {renderDropZone(index + 1)}
          </div>
        );
      })}
    </div>
  );
}
