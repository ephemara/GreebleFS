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
import { BOUNDED_CHROME_CONTAINMENT_STYLE } from "../../config/chromeEffects";
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
  rowId?: string;
  zoneId?: string;
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

export interface LayoutDynamicsCanvasExternalDragPreview {
  itemId: string;
  label: string;
  content: ReactNode;
  pointerPoint: { x: number; y: number } | null;
  bandId?: string | null;
  anchorX?: number | null;
  widthPx?: number;
  heightPx?: number;
  style?: CSSProperties;
  dataAttributes?: Record<string, string | undefined>;
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
  externalDragPreview?: LayoutDynamicsCanvasExternalDragPreview | null;
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

function resolveNodePositionWithinBand(input: {
  axisMode: LayoutDynamicsAxisMode;
  bandBounds: LayoutDynamicsBandBounds | null;
  width: number;
  height: number;
  requestedX: number;
  requestedY: number;
}): { x: number; y: number } {
  if (!input.bandBounds) {
    return {
      x: input.requestedX,
      y: input.requestedY,
    };
  }

  const clampedX = clamp(
    input.requestedX,
    input.bandBounds.x,
    Math.max(
      input.bandBounds.x,
      input.bandBounds.x + input.bandBounds.width - input.width,
    ),
  );
  if (input.axisMode === "free-2d") {
    return {
      x: clampedX,
      y: clamp(
        input.requestedY,
        input.bandBounds.y,
        Math.max(
          input.bandBounds.y,
          input.bandBounds.y + input.bandBounds.height - input.height,
        ),
      ),
    };
  }

  return {
    x: clampedX,
    y:
      input.bandBounds.y +
      Math.max(0, (input.bandBounds.height - input.height) / 2),
  };
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
  externalDragPreview = null,
}: LayoutDynamicsCanvasProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef<number | null>(null);
  const bandElementMapRef = useRef(new Map<string, HTMLDivElement>());
  const itemElementMapRef = useRef(new Map<string, HTMLDivElement>());
  const externalDragPreviewElementRef = useRef<HTMLDivElement | null>(null);
  const externalDragPreviewNodeRef = useRef<MutableCanvasNode | null>(null);
  const nodesRef = useRef(new Map<string, MutableCanvasNode>());
  const dragStateRef = useRef<DragState | null>(null);

  const visibleItems = useMemo(
    () => items.filter((item) => item.hidden !== true),
    [items],
  );

  const measureBandBounds = useCallback((): LayoutDynamicsBandBounds[] => {
    const contentRect = contentRef.current?.getBoundingClientRect();
    if (!contentRect) {
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
          x: bandRect.left - contentRect.left,
          y: bandRect.top - contentRect.top,
          width: bandRect.width,
          height: bandRect.height,
        } satisfies LayoutDynamicsBandBounds;
      })
      .filter((band): band is LayoutDynamicsBandBounds => band != null);
  }, [bands]);

  const updateCanvasContentExtent = useCallback(() => {
    const rootElement = rootRef.current;
    const contentElement = contentRef.current;
    if (!rootElement || !contentElement) {
      return;
    }

    if (!authoringActive) {
      contentElement.style.width = "100%";
      contentElement.style.height = "100%";
      return;
    }

    const bandBounds = measureBandBounds();
    const rootClientWidth = rootElement.clientWidth;
    const rootClientHeight = rootElement.clientHeight;
    const bandMaxX = bandBounds.reduce(
      (maxValue, band) => Math.max(maxValue, band.x + band.width),
      rootClientWidth,
    );
    const bandMaxY = bandBounds.reduce(
      (maxValue, band) => Math.max(maxValue, band.y + band.height),
      rootClientHeight,
    );
    const dynamicNodes = [
      ...Array.from(nodesRef.current.values()),
      ...(externalDragPreviewNodeRef.current
        ? [externalDragPreviewNodeRef.current]
        : []),
    ];
    const nodeMaxX = dynamicNodes.reduce(
      (maxValue, node) =>
        Math.max(maxValue, node.x + Math.max(node.measuredWidth, node.width) + 20),
      bandMaxX,
    );
    const nodeMaxY = dynamicNodes.reduce(
      (maxValue, node) =>
        Math.max(
          maxValue,
          node.y + Math.max(node.measuredHeight, node.height) + 20,
        ),
      bandMaxY,
    );

    contentElement.style.width = `${Math.ceil(
      Math.max(rootClientWidth, bandMaxX, nodeMaxX),
    )}px`;
    contentElement.style.height = `${Math.ceil(
      Math.max(rootClientHeight, bandMaxY, nodeMaxY),
    )}px`;
  }, [authoringActive, measureBandBounds]);

  const flushNodeTransforms = useCallback(() => {
    const selectedItemIds = new Set(
      items.filter((item) => item.selected).map((item) => item.id),
    );
    const draggingNodeId =
      externalDragPreviewNodeRef.current?.id ?? dragStateRef.current?.nodeId ?? null;
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

    const externalDragPreviewNode = externalDragPreviewNodeRef.current;
    const externalDragPreviewElement = externalDragPreviewElementRef.current;
    if (externalDragPreviewNode && externalDragPreviewElement) {
      externalDragPreviewElement.style.transform = `translate3d(${Math.round(
        externalDragPreviewNode.x,
      )}px, ${Math.round(externalDragPreviewNode.y)}px, 0)`;
      externalDragPreviewElement.style.width =
        externalDragPreviewNode.measuredWidth > 0
          ? `${Math.round(externalDragPreviewNode.measuredWidth)}px`
          : "";
      externalDragPreviewElement.style.height =
        externalDragPreviewNode.measuredHeight > 0
          ? `${Math.round(externalDragPreviewNode.measuredHeight)}px`
          : "";
      externalDragPreviewElement.style.opacity = "0.9";
      externalDragPreviewElement.style.zIndex = "5";
    }
    updateCanvasContentExtent();
  }, [items, updateCanvasContentExtent]);

  const scheduleFrame = useCallback(() => {
    if (rafRef.current != null) {
      return;
    }

    const tick = (time: number) => {
      rafRef.current = null;
      const previousTime = lastFrameTimeRef.current ?? time;
      lastFrameTimeRef.current = time;
      const bandBounds = measureBandBounds();
      const externalDragPreviewNode = externalDragPreviewNodeRef.current;
      const simulationNodes = externalDragPreviewNode
        ? [...Array.from(nodesRef.current.values()), externalDragPreviewNode]
        : Array.from(nodesRef.current.values());
      const draggedNodeId =
        externalDragPreviewNode?.id ?? dragStateRef.current?.nodeId ?? null;

      stepLayoutDynamicsSimulation({
        state: {
          nodes: simulationNodes,
          draggedNodeId,
        },
        solver,
        axisMode,
        bandBounds,
        deltaTimeSeconds: (time - previousTime) / 1000,
        intensity,
      });
      flushNodeTransforms();

      if (
        externalDragPreviewNodeRef.current ||
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
        x: authoringActive ? (previousNode?.x ?? anchorX) : anchorX,
        y: authoringActive ? (previousNode?.y ?? anchorY) : anchorY,
        anchorX,
        anchorY,
        width: measuredWidth,
        height: measuredHeight,
        measuredWidth,
        measuredHeight,
        velocityX: authoringActive ? (previousNode?.velocityX ?? 0) : 0,
        velocityY: authoringActive ? (previousNode?.velocityY ?? 0) : 0,
        order: item.order,
        hasPersistedAnchor: item.anchorX != null || item.anchorY != null,
        hidden: item.hidden === true,
      });
    }

    nodesRef.current = nextNodes;
    flushNodeTransforms();
  }, [
    authoringActive,
    axisMode,
    flushNodeTransforms,
    measureBandBounds,
    solver.gapPx,
    visibleItems,
  ]);

  const updateExternalDragPreviewNode = useCallback(() => {
    if (
      !authoringActive ||
      !externalDragPreview ||
      !externalDragPreview.pointerPoint ||
      !contentRef.current
    ) {
      if (externalDragPreviewNodeRef.current) {
        externalDragPreviewNodeRef.current = null;
        flushNodeTransforms();
        scheduleFrame();
      }
      return;
    }

    const bandBounds = measureBandBounds();
    const fallbackBandId =
      externalDragPreview.bandId ?? bands[0]?.id ?? externalDragPreviewNodeRef.current?.bandId;
    if (!fallbackBandId) {
      return;
    }

    const previewElement = externalDragPreviewElementRef.current;
    const measuredWidth =
      externalDragPreview.widthPx ??
      previewElement?.getBoundingClientRect().width ??
      AUTO_LAYOUT_FALLBACK_WIDTH;
    const measuredHeight =
      externalDragPreview.heightPx ??
      previewElement?.getBoundingClientRect().height ??
      AUTO_LAYOUT_FALLBACK_HEIGHT;
    const contentRect = contentRef.current.getBoundingClientRect();
    const pointerX = externalDragPreview.pointerPoint.x - contentRect.left;
    const pointerY = externalDragPreview.pointerPoint.y - contentRect.top;
    const nextBandId =
      axisMode === "free-2d"
        ? (externalDragPreview.bandId ?? fallbackBandId)
        : (externalDragPreview.bandId ??
          resolveNearestBandId(bandBounds, pointerY, fallbackBandId));
    const bandBoundsForPreview =
      bandBounds.find((band) => band.id === nextBandId) ?? null;
    const requestedX =
      externalDragPreview.anchorX != null && bandBoundsForPreview
        ? bandBoundsForPreview.x + externalDragPreview.anchorX
        : pointerX - measuredWidth / 2;
    const requestedY =
      axisMode === "free-2d"
        ? pointerY - measuredHeight / 2
        : bandBoundsForPreview?.y ?? 0;
    const { x, y } = resolveNodePositionWithinBand({
      axisMode,
      bandBounds: bandBoundsForPreview,
      width: measuredWidth,
      height: measuredHeight,
      requestedX,
      requestedY,
    });

    externalDragPreviewNodeRef.current = {
      id: externalDragPreview.itemId,
      bandId: nextBandId,
      x,
      y,
      anchorX: x,
      anchorY: y,
      width: measuredWidth,
      height: measuredHeight,
      measuredWidth,
      measuredHeight,
      velocityX: 0,
      velocityY: 0,
      order: Number.MAX_SAFE_INTEGER,
      hasPersistedAnchor: false,
      hidden: false,
    };
    flushNodeTransforms();
    scheduleFrame();
  }, [
    authoringActive,
    axisMode,
    bands,
    externalDragPreview,
    flushNodeTransforms,
    measureBandBounds,
    scheduleFrame,
  ]);

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
    if (authoringActive) {
      scheduleFrame();
    }
  }, [
    authoringActive,
    axisMode,
    measureBandBounds,
    onCommitSnapshot,
    scheduleFrame,
    solver.gapPx,
  ]);

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
        draggedNode.velocityX = 0;
        draggedNode.velocityY = 0;
      }

      if (!cancelled && draggedNode) {
        commitSnapshotFromCurrentNodes();
      } else {
        flushNodeTransforms();
      }

      if (authoringActive) {
        scheduleFrame();
      }
    },
    [
      authoringActive,
      commitSnapshotFromCurrentNodes,
      flushNodeTransforms,
      scheduleFrame,
    ],
  );

  useLayoutEffect(() => {
    syncNodesFromItems();
  }, [syncNodesFromItems]);

  useLayoutEffect(() => {
    updateExternalDragPreviewNode();
  }, [updateExternalDragPreviewNode]);

  useEffect(() => {
    const handleResize = () => {
      syncNodesFromItems();
      updateExternalDragPreviewNode();
      if (authoringActive) {
        scheduleFrame();
      }
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [authoringActive, scheduleFrame, syncNodesFromItems, updateExternalDragPreviewNode]);

  useEffect(() => {
    if (!authoringActive && dragStateRef.current) {
      finishDrag(true);
    }
  }, [authoringActive, finishDrag]);

  useEffect(() => {
    if (!authoringActive && externalDragPreviewNodeRef.current) {
      externalDragPreviewNodeRef.current = null;
      flushNodeTransforms();
    }
  }, [authoringActive, flushNodeTransforms]);

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
      const contentRect = contentRef.current?.getBoundingClientRect();
      if (!node || !contentRect) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      onSelectItem?.(item.id);
      dragStateRef.current = {
        nodeId: item.id,
        pointerId: event.pointerId,
        grabOffsetX: event.clientX - contentRect.left - node.x,
        grabOffsetY: event.clientY - contentRect.top - node.y,
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
          !contentRef.current
        ) {
          return;
        }

        const draggingNode = nodesRef.current.get(dragState.nodeId);
        if (!draggingNode) {
          return;
        }

        const bandBounds = measureBandBounds();
        const contentBounds = contentRef.current.getBoundingClientRect();
        const relativePointerX =
          pointerEvent.clientX - contentBounds.left - dragState.grabOffsetX;
        const relativePointerY =
          pointerEvent.clientY - contentBounds.top - dragState.grabOffsetY;
        const nextBandId =
          axisMode === "free-2d"
            ? draggingNode.bandId
            : resolveNearestBandId(
                bandBounds,
                pointerEvent.clientY - contentBounds.top,
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
        overflow: authoringActive ? "auto" : "hidden",
        ...style,
        ...BOUNDED_CHROME_CONTAINMENT_STYLE,
      }}
    >
      <div
        ref={contentRef}
        style={{
          position: "relative",
          minWidth: "100%",
          minHeight: "100%",
        }}
      >
      <div style={{ display: "grid", width: "100%", minWidth: 0 }}>
        {bands.map((band) => (
          <div
            key={band.id}
            ref={bindBandElement(band.id)}
            data-layout-dynamics-band={band.id}
            data-explorer-customize-row-id={band.rowId}
            data-explorer-customize-zone-id={band.zoneId}
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
          overflow: authoringActive ? "visible" : "hidden",
          pointerEvents: authoringActive ? "auto" : "none",
          ...BOUNDED_CHROME_CONTAINMENT_STYLE,
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
              data-layout-dynamics-band-id={item.bandId}
              onPointerDown={(event) => beginDrag(event, item)}
              onClickCapture={(event) => {
                if (
                  !authoringActive ||
                  !(
                    getOverlayTargetFlag(
                      event.target,
                      "data-layout-dynamics-live-control",
                    ) ||
                    getOverlayTargetFlag(
                      event.target,
                      "data-explorer-customize-live-control",
                    )
                  )
                ) {
                  return;
                }

                event.preventDefault();
                event.stopPropagation();
                onSelectItem?.(item.id);
              }}
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
              <div
                style={{
                  minWidth: 0,
                  pointerEvents: authoringActive ? "none" : "auto",
                }}
              >
                {item.content}
              </div>
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
        {externalDragPreview ? (
          <div
            ref={externalDragPreviewElementRef}
            data-layout-dynamics-item={externalDragPreview.itemId}
            data-layout-dynamics-band-id={externalDragPreview.bandId ?? undefined}
            data-layout-dynamics-external-drag-preview="true"
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              display: "flex",
              alignItems: "center",
              minWidth: 0,
              pointerEvents: "none",
              borderRadius: 10,
              outline:
                "1px dashed color-mix(in srgb, var(--overlay-accent) 64%, transparent)",
              outlineOffset: -1,
              background:
                "color-mix(in srgb, var(--overlay-accent) 8%, var(--overlay-bg))",
              boxShadow:
                "0 10px 28px color-mix(in srgb, black 22%, transparent)",
              ...externalDragPreview.style,
            }}
            {...externalDragPreview.dataAttributes}
          >
            {externalDragPreview.content}
          </div>
        ) : null}
      </div>
      </div>
    </div>
  );
}
