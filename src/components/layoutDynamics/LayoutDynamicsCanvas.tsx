import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  type CSSProperties,
  type ReactNode,
} from "react";
import { X } from "@/components/AppIcons";
import type {
  LayoutDynamicsAuthoringSnapshot,
  LayoutDynamicsAxisMode,
  LayoutDynamicsSolverProfile,
} from "../../config/layoutDynamics";
import {
  areLayoutDynamicsNodesSettled,
  resolveHorizontalBandLayout,
  stepLayoutDynamicsSimulation,
  type LayoutDynamicsBandBounds,
  type LayoutDynamicsSimulationNode,
} from "../../runtime/layoutDynamicsRuntime";

export interface LayoutDynamicsCanvasBand {
  id: string;
  label?: string;
  minHeightPx: number;
  style?: CSSProperties;
}

export interface LayoutDynamicsCanvasItem {
  id: string;
  label: string;
  bandId: string;
  order: number;
  anchorX?: number;
  anchorY?: number;
  widthPx?: number;
  heightPx?: number;
  hidden?: boolean;
  selected?: boolean;
  removable?: boolean;
  resizable?: boolean;
  content: ReactNode;
  style?: CSSProperties;
  dataAttributes?: Record<string, string | undefined>;
}

export interface LayoutDynamicsCanvasResizeRequest {
  itemId: string;
  pointerId: number;
  startPoint: { x: number; y: number };
}

interface LayoutDynamicsCanvasProps {
  surfaceId: string;
  axisMode: LayoutDynamicsAxisMode;
  solver: LayoutDynamicsSolverProfile;
  intensity: number;
  authoringActive: boolean;
  bands: LayoutDynamicsCanvasBand[];
  items: LayoutDynamicsCanvasItem[];
  style?: CSSProperties;
  onSelectItem?: (itemId: string | null) => void;
  onRemoveItem?: (itemId: string) => void;
  onBeginResizeItem?: (
    request: LayoutDynamicsCanvasResizeRequest,
  ) => void;
  onCommitSnapshot?: (snapshot: LayoutDynamicsAuthoringSnapshot) => void;
}

interface MutableCanvasNode extends LayoutDynamicsSimulationNode {
  order: number;
  measuredWidth: number;
  measuredHeight: number;
  hasPersistedAnchor: boolean;
  hidden: boolean;
}

interface DragState {
  nodeId: string;
  pointerId: number;
  grabOffsetX: number;
  grabOffsetY: number;
  originBandId: string;
  originX: number;
  originY: number;
  moved: boolean;
}

const AUTO_LAYOUT_FALLBACK_WIDTH = 92;
const AUTO_LAYOUT_FALLBACK_HEIGHT = 28;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function getOverlayTargetFlag(
  target: EventTarget | null,
  attribute: string,
): boolean {
  return target instanceof Element && target.closest(`[${attribute}='true']`) != null;
}

function resolveNearestBandId(
  bandBounds: LayoutDynamicsBandBounds[],
  pointerY: number,
  fallbackBandId: string,
): string {
  const bandContainingPointer = bandBounds.find(
    (band) => pointerY >= band.y && pointerY <= band.y + band.height,
  );
  if (bandContainingPointer) {
    return bandContainingPointer.id;
  }

  const nearestBand = bandBounds.reduce<LayoutDynamicsBandBounds | null>(
    (closest, band) => {
      if (!closest) {
        return band;
      }
      const closestDistance = Math.abs(
        closest.y + closest.height / 2 - pointerY,
      );
      const candidateDistance = Math.abs(band.y + band.height / 2 - pointerY);
      return candidateDistance < closestDistance ? band : closest;
    },
    null,
  );

  return nearestBand?.id ?? fallbackBandId;
}

export function LayoutDynamicsCanvas({
  surfaceId,
  axisMode,
  solver,
  intensity,
  authoringActive,
  bands,
  items,
  style,
  onSelectItem,
  onRemoveItem,
  onBeginResizeItem,
  onCommitSnapshot,
}: LayoutDynamicsCanvasProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef<number | null>(null);
  const bandElementMapRef = useRef(new Map<string, HTMLDivElement>());
  const itemElementMapRef = useRef(new Map<string, HTMLDivElement>());
  const nodesRef = useRef(new Map<string, MutableCanvasNode>());
  const dragStateRef = useRef<DragState | null>(null);

  const visibleItems = useMemo(
    () => items.filter((item) => item.hidden !== true),
    [items],
  );

  const measureBandBounds = useCallback((): LayoutDynamicsBandBounds[] => {
    const rootRect = rootRef.current?.getBoundingClientRect();
    if (!rootRect) {
      return [];
    }

    return bands
      .map((band) => {
        const bandElement = bandElementMapRef.current.get(band.id);
        const bandRect = bandElement?.getBoundingClientRect();
        if (!bandRect) {
          return null;
        }
        return {
          id: band.id,
          x: bandRect.left - rootRect.left,
          y: bandRect.top - rootRect.top,
          width: bandRect.width,
          height: bandRect.height,
        } satisfies LayoutDynamicsBandBounds;
      })
      .filter((band): band is LayoutDynamicsBandBounds => band != null);
  }, [bands]);

  const flushNodeTransforms = useCallback(() => {
    const selectedItemIds = new Set(
      items.filter((item) => item.selected).map((item) => item.id),
    );
    const draggingNodeId = dragStateRef.current?.nodeId ?? null;
    for (const [nodeId, node] of nodesRef.current) {
      const itemElement = itemElementMapRef.current.get(nodeId);
      if (!itemElement) {
        continue;
      }

      itemElement.style.transform = `translate3d(${Math.round(node.x)}px, ${Math.round(node.y)}px, 0)`;
      itemElement.style.width =
        node.measuredWidth > 0 ? `${Math.round(node.measuredWidth)}px` : "";
      itemElement.style.height =
        node.measuredHeight > 0 ? `${Math.round(node.measuredHeight)}px` : "";
      itemElement.style.opacity = draggingNodeId === nodeId ? "0.62" : "1";
      itemElement.style.zIndex =
        draggingNodeId === nodeId ? "4" : selectedItemIds.has(nodeId) ? "3" : "2";
    }
  }, [items]);

  const scheduleFrame = useCallback(() => {
    if (rafRef.current != null) {
      return;
    }

    const tick = (time: number) => {
      rafRef.current = null;
      const previousTime = lastFrameTimeRef.current ?? time;
      lastFrameTimeRef.current = time;
      const bandBounds = measureBandBounds();

      stepLayoutDynamicsSimulation({
        state: {
          nodes: Array.from(nodesRef.current.values()),
          draggedNodeId: dragStateRef.current?.nodeId ?? null,
        },
        solver,
        axisMode,
        bandBounds,
        deltaTimeSeconds: (time - previousTime) / 1000,
        intensity,
      });
      flushNodeTransforms();

      if (
        dragStateRef.current ||
        !areLayoutDynamicsNodesSettled(
          Array.from(nodesRef.current.values()),
          solver,
        )
      ) {
        rafRef.current = window.requestAnimationFrame(tick);
      }
    };

    rafRef.current = window.requestAnimationFrame(tick);
  }, [axisMode, flushNodeTransforms, intensity, measureBandBounds, solver]);

  const syncNodesFromItems = useCallback(() => {
    const nextNodes = new Map<string, MutableCanvasNode>();
    const bandBounds = measureBandBounds();
    const bandTopById = new Map(
      bandBounds.map((band) => [band.id, band.y] as const),
    );
    const bandCenterById = new Map(
      bandBounds.map(
        (band) =>
          [
            band.id,
            band.y + Math.max(0, (band.height - AUTO_LAYOUT_FALLBACK_HEIGHT) / 2),
          ] as const,
      ),
    );
    const autoLayoutCursorByBandId = new Map<string, number>();

    for (const item of visibleItems
      .slice()
      .sort((left, right) => left.order - right.order)) {
      const measuredElement = itemElementMapRef.current.get(item.id);
      const measuredWidth =
        item.widthPx ??
        measuredElement?.getBoundingClientRect().width ??
        AUTO_LAYOUT_FALLBACK_WIDTH;
      const measuredHeight =
        item.heightPx ??
        measuredElement?.getBoundingClientRect().height ??
        AUTO_LAYOUT_FALLBACK_HEIGHT;
      const previousNode = nodesRef.current.get(item.id);
      const bandBoundsForItem = bandBounds.find((band) => band.id === item.bandId);
      const anchorX =
        item.anchorX != null
          ? item.anchorX + (bandBoundsForItem?.x ?? 0)
          : (() => {
              const currentCursor = autoLayoutCursorByBandId.get(item.bandId) ?? 0;
              autoLayoutCursorByBandId.set(
                item.bandId,
                currentCursor + measuredWidth + solver.gapPx,
              );
              return currentCursor + (bandBoundsForItem?.x ?? 0);
            })();
      const anchorY =
        item.anchorY != null
          ? item.anchorY + (bandTopById.get(item.bandId) ?? 0)
          : axisMode === "free-2d"
            ? bandTopById.get(item.bandId) ?? 0
            : bandCenterById.get(item.bandId) ?? 0;

      nextNodes.set(item.id, {
        id: item.id,
        bandId: item.bandId,
        x: previousNode?.x ?? anchorX,
        y: previousNode?.y ?? anchorY,
        anchorX,
        anchorY,
        width: measuredWidth,
        height: measuredHeight,
        measuredWidth,
        measuredHeight,
        velocityX: previousNode?.velocityX ?? 0,
        velocityY: previousNode?.velocityY ?? 0,
        order: item.order,
        hasPersistedAnchor: item.anchorX != null || item.anchorY != null,
        hidden: item.hidden === true,
      });
    }

    nodesRef.current = nextNodes;
    flushNodeTransforms();
  }, [axisMode, flushNodeTransforms, measureBandBounds, solver.gapPx, visibleItems]);

  const commitSnapshotFromCurrentNodes = useCallback(() => {
    const bandBounds = measureBandBounds();
    const nextEntries: LayoutDynamicsAuthoringSnapshot["entries"] = [];

    if (axisMode === "horizontal-band") {
      for (const band of bandBounds) {
        const bandSnapshot = resolveHorizontalBandLayout({
          nodes: Array.from(nodesRef.current.values())
            .filter((node) => node.bandId === band.id && !node.hidden)
            .map((node) => ({
              id: node.id,
              width: node.width,
              x: node.x,
              y: node.y,
            })),
          bandBounds: band,
          gapPx: solver.gapPx,
        });
        for (const entry of bandSnapshot.entries) {
          nextEntries.push(entry);
          const node = nodesRef.current.get(entry.nodeId);
          if (!node) {
            continue;
          }
          node.bandId = entry.bandId;
          node.anchorX = band.x + entry.x;
          node.anchorY =
            axisMode === "horizontal-band"
              ? band.y + Math.max(0, (band.height - node.height) / 2)
              : band.y + entry.y;
        }
      }
    } else {
      for (const node of nodesRef.current.values()) {
        const band = bandBounds.find((candidate) => candidate.id === node.bandId);
        const entry = {
          nodeId: node.id,
          bandId: node.bandId,
          x: Math.round(node.x - (band?.x ?? 0)),
          y: Math.round(node.y - (band?.y ?? 0)),
        };
        nextEntries.push(entry);
        node.anchorX = (band?.x ?? 0) + entry.x;
        node.anchorY = (band?.y ?? 0) + entry.y;
      }
    }

    onCommitSnapshot?.({ entries: nextEntries });
    scheduleFrame();
  }, [axisMode, measureBandBounds, onCommitSnapshot, scheduleFrame, solver.gapPx]);

  const finishDrag = useCallback(
    (cancelled: boolean) => {
      const dragState = dragStateRef.current;
      if (!dragState) {
        return;
      }

      dragStateRef.current = null;
      const draggedNode = nodesRef.current.get(dragState.nodeId);
      if (draggedNode && cancelled) {
        draggedNode.bandId = dragState.originBandId;
        draggedNode.x = dragState.originX;
        draggedNode.y = dragState.originY;
        draggedNode.anchorX = dragState.originX;
        draggedNode.anchorY = dragState.originY;
      }

      if (!cancelled && draggedNode) {
        commitSnapshotFromCurrentNodes();
      } else {
        flushNodeTransforms();
      }

      scheduleFrame();
    },
    [commitSnapshotFromCurrentNodes, flushNodeTransforms, scheduleFrame],
  );

  useLayoutEffect(() => {
    syncNodesFromItems();
  }, [syncNodesFromItems]);

  useEffect(() => {
    const handleResize = () => {
      syncNodesFromItems();
      scheduleFrame();
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [scheduleFrame, syncNodesFromItems]);

  useEffect(() => {
    if (!authoringActive && dragStateRef.current) {
      finishDrag(true);
    }
  }, [authoringActive, finishDrag]);

  useEffect(
    () => () => {
      if (rafRef.current != null) {
        window.cancelAnimationFrame(rafRef.current);
      }
    },
    [],
  );

  const bindBandElement = useCallback(
    (bandId: string) => (element: HTMLDivElement | null) => {
      if (element) {
        bandElementMapRef.current.set(bandId, element);
      } else {
        bandElementMapRef.current.delete(bandId);
      }
    },
    [],
  );

  const bindItemElement = useCallback(
    (itemId: string) => (element: HTMLDivElement | null) => {
      if (element) {
        itemElementMapRef.current.set(itemId, element);
      } else {
        itemElementMapRef.current.delete(itemId);
      }
    },
    [],
  );

  const beginDrag = useCallback(
    (event: React.PointerEvent<HTMLDivElement>, item: LayoutDynamicsCanvasItem) => {
      if (!authoringActive || event.button !== 0) {
        return;
      }

      if (
        getOverlayTargetFlag(event.target, "data-layout-dynamics-live-control") ||
        getOverlayTargetFlag(
          event.target,
          "data-explorer-customize-live-control",
        ) ||
        getOverlayTargetFlag(
          event.target,
          "data-layout-dynamics-remove-control",
        ) ||
        getOverlayTargetFlag(
          event.target,
          "data-layout-dynamics-resize-control",
        ) ||
        getOverlayTargetFlag(
          event.target,
          "data-explorer-customize-resize-control",
        )
      ) {
        return;
      }

      const node = nodesRef.current.get(item.id);
      const rootRect = rootRef.current?.getBoundingClientRect();
      if (!node || !rootRect) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      onSelectItem?.(item.id);
      dragStateRef.current = {
        nodeId: item.id,
        pointerId: event.pointerId,
        grabOffsetX: event.clientX - rootRect.left - node.x,
        grabOffsetY: event.clientY - rootRect.top - node.y,
        originBandId: node.bandId,
        originX: node.anchorX,
        originY: node.anchorY,
        moved: false,
      };

      const handlePointerMove = (pointerEvent: PointerEvent) => {
        const dragState = dragStateRef.current;
        if (
          !dragState ||
          dragState.pointerId !== pointerEvent.pointerId ||
          !rootRef.current
        ) {
          return;
        }

        const draggingNode = nodesRef.current.get(dragState.nodeId);
        if (!draggingNode) {
          return;
        }

        const bandBounds = measureBandBounds();
        const rootBounds = rootRef.current.getBoundingClientRect();
        const relativePointerX =
          pointerEvent.clientX - rootBounds.left - dragState.grabOffsetX;
        const relativePointerY =
          pointerEvent.clientY - rootBounds.top - dragState.grabOffsetY;
        const nextBandId =
          axisMode === "free-2d"
            ? draggingNode.bandId
            : resolveNearestBandId(
                bandBounds,
                pointerEvent.clientY - rootBounds.top,
                draggingNode.bandId,
              );
        const bandBoundsForNode =
          bandBounds.find((band) => band.id === nextBandId) ?? null;

        draggingNode.bandId = nextBandId;
        draggingNode.x = relativePointerX;
        draggingNode.y =
          axisMode === "free-2d"
            ? relativePointerY
            : (bandBoundsForNode?.y ?? draggingNode.y) +
              Math.max(
                0,
                ((bandBoundsForNode?.height ?? draggingNode.height) -
                  draggingNode.height) /
                  2,
              );
        dragState.moved = true;

        if (bandBoundsForNode) {
          draggingNode.x = clamp(
            draggingNode.x,
            bandBoundsForNode.x,
            Math.max(
              bandBoundsForNode.x,
              bandBoundsForNode.x +
                bandBoundsForNode.width -
                draggingNode.measuredWidth,
            ),
          );
          if (axisMode === "free-2d") {
            draggingNode.y = clamp(
              draggingNode.y,
              bandBoundsForNode.y,
              Math.max(
                bandBoundsForNode.y,
                bandBoundsForNode.y +
                  bandBoundsForNode.height -
                  draggingNode.measuredHeight,
              ),
            );
          }
        }

        flushNodeTransforms();
        scheduleFrame();
      };

      const handlePointerEnd = (pointerEvent: PointerEvent) => {
        const dragState = dragStateRef.current;
        if (
          !dragState ||
          dragState.pointerId !== pointerEvent.pointerId
        ) {
          return;
        }

        window.removeEventListener("pointermove", handlePointerMove);
        window.removeEventListener("pointerup", handlePointerEnd);
        window.removeEventListener("pointercancel", handlePointerCancel);
        window.removeEventListener("blur", handleWindowBlur);
        window.removeEventListener("keydown", handleWindowKeyDown);

        if (!dragState.moved) {
          onSelectItem?.(dragState.nodeId);
        }
        finishDrag(false);
      };

      const handlePointerCancel = (pointerEvent: PointerEvent) => {
        const dragState = dragStateRef.current;
        if (
          !dragState ||
          dragState.pointerId !== pointerEvent.pointerId
        ) {
          return;
        }
        window.removeEventListener("pointermove", handlePointerMove);
        window.removeEventListener("pointerup", handlePointerEnd);
        window.removeEventListener("pointercancel", handlePointerCancel);
        window.removeEventListener("blur", handleWindowBlur);
        window.removeEventListener("keydown", handleWindowKeyDown);
        finishDrag(true);
      };

      const handleWindowBlur = () => {
        window.removeEventListener("pointermove", handlePointerMove);
        window.removeEventListener("pointerup", handlePointerEnd);
        window.removeEventListener("pointercancel", handlePointerCancel);
        window.removeEventListener("blur", handleWindowBlur);
        window.removeEventListener("keydown", handleWindowKeyDown);
        finishDrag(true);
      };

      const handleWindowKeyDown = (keyboardEvent: KeyboardEvent) => {
        if (keyboardEvent.key !== "Escape") {
          return;
        }
        keyboardEvent.preventDefault();
        window.removeEventListener("pointermove", handlePointerMove);
        window.removeEventListener("pointerup", handlePointerEnd);
        window.removeEventListener("pointercancel", handlePointerCancel);
        window.removeEventListener("blur", handleWindowBlur);
        window.removeEventListener("keydown", handleWindowKeyDown);
        finishDrag(true);
      };

      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", handlePointerEnd);
      window.addEventListener("pointercancel", handlePointerCancel);
      window.addEventListener("blur", handleWindowBlur);
      window.addEventListener("keydown", handleWindowKeyDown);

      scheduleFrame();
    },
    [authoringActive, axisMode, finishDrag, flushNodeTransforms, measureBandBounds, onSelectItem, scheduleFrame],
  );

  return (
    <div
      ref={rootRef}
      data-layout-dynamics-surface={surfaceId}
      tabIndex={authoringActive ? 0 : -1}
      onKeyDown={(event) => {
        if (
          !authoringActive ||
          !onRemoveItem ||
          (event.key !== "Delete" && event.key !== "Backspace")
        ) {
          return;
        }
        const selectedItem = items.find((item) => item.selected);
        if (!selectedItem) {
          return;
        }
        event.preventDefault();
        onRemoveItem(selectedItem.id);
      }}
      style={{
        position: "relative",
        width: "100%",
        minWidth: 0,
        ...style,
      }}
    >
      <div style={{ display: "grid", width: "100%", minWidth: 0 }}>
        {bands.map((band) => (
          <div
            key={band.id}
            ref={bindBandElement(band.id)}
            data-layout-dynamics-band={band.id}
            style={{
              position: "relative",
              minHeight: band.minHeightPx,
              width: "100%",
              minWidth: 0,
              ...band.style,
            }}
          />
        ))}
      </div>
      <div
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: authoringActive ? "auto" : "none",
        }}
      >
        {visibleItems.map((item) => {
          const isSelected = item.selected === true;
          const isResizable =
            authoringActive && item.resizable === true && onBeginResizeItem;
          return (
            <div
              key={item.id}
              ref={bindItemElement(item.id)}
              data-layout-dynamics-item={item.id}
              onPointerDown={(event) => beginDrag(event, item)}
              onClick={(event) => {
                if (!authoringActive) {
                  return;
                }

                if (
                  getOverlayTargetFlag(
                    event.target,
                    "data-layout-dynamics-remove-control",
                  ) ||
                  getOverlayTargetFlag(
                    event.target,
                    "data-layout-dynamics-resize-control",
                  )
                ) {
                  return;
                }

                event.preventDefault();
                event.stopPropagation();
                onSelectItem?.(item.id);
              }}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                display: "flex",
                alignItems: "center",
                minWidth: 0,
                pointerEvents: "auto",
                transition: authoringActive
                  ? "box-shadow 120ms ease, outline-color 120ms ease, background 120ms ease"
                  : "none",
                outline: authoringActive
                  ? isSelected
                    ? "1px solid color-mix(in srgb, var(--overlay-accent) 72%, transparent)"
                    : "1px solid color-mix(in srgb, var(--overlay-border) 72%, transparent)"
                  : "none",
                outlineOffset: -1,
                borderRadius: 10,
                background:
                  authoringActive && isSelected
                    ? "color-mix(in srgb, var(--overlay-accent) 10%, transparent)"
                    : "transparent",
                ...item.style,
              }}
              {...item.dataAttributes}
            >
              {item.content}
              {authoringActive && item.removable !== false ? (
                <button
                  type="button"
                  data-layout-dynamics-remove-control="true"
                  aria-label={`Remove ${item.label} from layout`}
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    onRemoveItem?.(item.id);
                  }}
                  style={{
                    position: "absolute",
                    top: -7,
                    right: -7,
                    width: 16,
                    height: 16,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border: "none",
                    borderRadius: 999,
                    background:
                      "color-mix(in srgb, var(--overlay-accent) 22%, var(--overlay-bg))",
                    color: "var(--overlay-text)",
                    cursor: "pointer",
                    boxShadow:
                      "0 0 0 1px color-mix(in srgb, var(--overlay-accent) 32%, transparent)",
                  }}
                >
                  <X size={10} />
                </button>
              ) : null}
              {isResizable ? (
                <button
                  type="button"
                  data-layout-dynamics-resize-control="true"
                  aria-label={`Resize ${item.label}`}
                  onPointerDown={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    onSelectItem?.(item.id);
                    onBeginResizeItem?.({
                      itemId: item.id,
                      pointerId: event.pointerId,
                      startPoint: {
                        x: event.clientX,
                        y: event.clientY,
                      },
                    });
                  }}
                  style={{
                    position: "absolute",
                    top: "50%",
                    right: 1,
                    transform: "translateY(-50%)",
                    width: 12,
                    height: 28,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border: "none",
                    borderRadius: 999,
                    background:
                      "color-mix(in srgb, var(--overlay-accent) 18%, transparent)",
                    color: "var(--overlay-text-dim)",
                    cursor: "ew-resize",
                  }}
                >
                  <span
                    aria-hidden="true"
                    style={{
                      display: "grid",
                      gridAutoFlow: "row",
                      gap: 2,
                    }}
                  >
                    {Array.from({ length: 4 }).map((_, handleIndex) => (
                      <span
                        key={handleIndex}
                        style={{
                          width: 3,
                          height: 3,
                          borderRadius: 999,
                          background:
                            "color-mix(in srgb, var(--overlay-text-dim) 78%, white 22%)",
                        }}
                      />
                    ))}
                  </span>
                </button>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
