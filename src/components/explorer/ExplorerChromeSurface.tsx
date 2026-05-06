import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
} from "react";
import { X } from "@/components/AppIcons";
import type {
  LayoutDynamicsAuthoringSnapshot,
  LayoutDynamicsAxisMode,
  LayoutDynamicsSolverProfile,
} from "../../config/layoutDynamics";
import type {
  ExplorerChromeControlId,
  ExplorerChromeResolvedControlPlacement,
  ExplorerChromeResolvedSurface,
  ExplorerChromeSurfaceId,
  ExplorerChromeZoneId,
} from "../../config/explorerChromeLayouts";
import {
  getExplorerChromeResolvedSurfaceSignature,
  getExplorerChromeSurfaceDefinition,
} from "../../config/explorerChromeLayouts";
import { shouldAllowNativeContextMenu } from "../../runtime/documentInteractionGuards";
import { LayoutDynamicsCanvas } from "../layoutDynamics/LayoutDynamicsCanvas";
import {
  useExplorerCustomizePointerSnapshot,
  type ExplorerCustomizePointerDropTarget,
} from "./explorerCustomizePointerRuntime";
import type { ExplorerChromeContextMenuRequest } from "./overlayContextMenuModel";

export interface ExplorerChromeSurfaceLayoutDynamics {
  enabled: boolean;
  authoringCanvasEnabled?: boolean;
  axisMode: LayoutDynamicsAxisMode;
  solver: LayoutDynamicsSolverProfile;
  intensity: number;
  onCommitSnapshot?: (snapshot: LayoutDynamicsAuthoringSnapshot) => void;
}

type ExplorerChromeSurfaceOverflowMode = "scroll" | "wrap";

interface ExplorerChromeSurfaceProps {
  surface: ExplorerChromeResolvedSurface;
  style?: CSSProperties;
  getRowStyle?: (rowId: string) => CSSProperties | undefined;
  getZoneStyle?: (zoneId: ExplorerChromeZoneId) => CSSProperties | undefined;
  overflowMode?: ExplorerChromeSurfaceOverflowMode;
  dynamicCanvasMinHeightPx?: number;
  excludedControlIds?: ExplorerChromeControlId[];
  renderControl: (
    placement: ExplorerChromeResolvedControlPlacement,
  ) => React.ReactNode;
  onContextMenuRequest?: (
    request: ExplorerChromeContextMenuRequest,
  ) => void;
  layoutDynamics?: ExplorerChromeSurfaceLayoutDynamics;
  editMode?: {
    active: boolean;
    draggingControlId: ExplorerChromeControlId | null;
    pointerSourceKind?: "placed" | "catalog" | null;
    highlightedDropTarget?: ExplorerCustomizePointerDropTarget | null;
    resizingControlId?: ExplorerChromeControlId | null;
    selectedControlId?: ExplorerChromeControlId | null;
    pendingHotkeyControlId?: ExplorerChromeControlId | null;
    catalogPreviewPlacement?: ExplorerChromeResolvedControlPlacement | null;
    onRegisterSurface?: (surface: ExplorerChromeResolvedSurface) => void;
    onUnregisterSurface?: (surfaceId: ExplorerChromeSurfaceId) => void;
    onDragStart: (controlId: ExplorerChromeControlId) => void;
    onDragEnd: () => void;
    onBeginPointerDrag?: (args: {
      controlId: ExplorerChromeControlId;
      pointerId: number;
      sourceKind: "placed";
      startPoint: { x: number; y: number };
      onTap?: (controlId: ExplorerChromeControlId) => void;
    }) => void;
    onBeginPointerResize?: (args: {
      controlId: ExplorerChromeControlId;
      pointerId: number;
      startPoint: { x: number; y: number };
    }) => void;
    onSetHighlightedDropTarget?: (
      target: {
        surfaceId: ExplorerChromeSurfaceId;
        zoneId: ExplorerChromeZoneId;
        targetIndex: number;
        offsetPx: number;
      } | null,
    ) => void;
    onSetSelectedControl?: (controlId: ExplorerChromeControlId | null) => void;
    onSetPendingHotkeyControl?: (
      controlId: ExplorerChromeControlId | null,
    ) => void;
    onRequestHotkeyCapture?: (controlId: ExplorerChromeControlId) => void;
    onMoveControl: (args: {
      controlId: ExplorerChromeControlId;
      targetSurfaceId: ExplorerChromeSurfaceId;
      targetZoneId: ExplorerChromeZoneId;
      targetIndex: number;
      targetOffsetPx?: number;
    }) => void;
    isControlResizable?: (
      placement: ExplorerChromeResolvedControlPlacement,
    ) => boolean;
    onRemoveControl?: (controlId: ExplorerChromeControlId) => void;
  };
}

export function ExplorerChromeSurface({
  surface,
  style,
  getRowStyle,
  getZoneStyle,
  overflowMode = "scroll",
  dynamicCanvasMinHeightPx,
  excludedControlIds,
  renderControl,
  onContextMenuRequest,
  layoutDynamics,
  editMode,
}: ExplorerChromeSurfaceProps) {
  const excludedControlIdSet = useMemo(
    () => new Set(excludedControlIds ?? []),
    [excludedControlIds],
  );
  const filteredSurface = useMemo<ExplorerChromeResolvedSurface>(
    () => ({
      ...surface,
      rows: surface.rows
        .map((row) => ({
          ...row,
          zones: row.zones.map((zone) => ({
            ...zone,
            controls: zone.controls.filter(
              (placement) => !excludedControlIdSet.has(placement.controlId),
            ),
          })),
        }))
        .filter((row) => row.zones.some((zone) => zone.controls.length > 0)),
    }),
    [excludedControlIdSet, surface],
  );
  const editModeActive = editMode?.active === true;
  const hasControls = filteredSurface.rows.some((row) =>
    row.zones.some((zone) => zone.controls.length > 0),
  );
  const [hoveredControlId, setHoveredControlId] =
    useState<ExplorerChromeControlId | null>(null);
  const registerSurface = editMode?.onRegisterSurface;
  const unregisterSurface = editMode?.onUnregisterSurface;
  const surfaceRegistrationSignature = useMemo(
    () => getExplorerChromeResolvedSurfaceSignature(filteredSurface),
    [filteredSurface],
  );
  const stableRegisteredSurface = useMemo(
    () => filteredSurface,
    [surfaceRegistrationSignature],
  );
  const surfaceDefinition = useMemo(
    () => getExplorerChromeSurfaceDefinition(surface.surfaceId),
    [surface.surfaceId],
  );
  const customizePointerSnapshot = useExplorerCustomizePointerSnapshot();
  const primaryZoneIdByBandId = useMemo(
    () =>
      new Map(
        surfaceDefinition.rows.map((row) => [row.id, row.zones[0] ?? "start"] as const),
      ),
    [surfaceDefinition.rows],
  );
  const bandIdByZoneId = useMemo(
    () =>
      new Map(
        surfaceDefinition.rows.flatMap((row) =>
          row.zones.map((zoneId) => [zoneId, row.id] as const),
        ),
      ),
    [surfaceDefinition.rows],
  );
  const useDynamicSurfaceLayout =
    layoutDynamics?.enabled === true &&
    layoutDynamics.authoringCanvasEnabled === true &&
    editModeActive;
  const usesFreeformDynamicCanvas =
    useDynamicSurfaceLayout && layoutDynamics?.axisMode === "free-2d";
  const useWrappedOverflow = overflowMode === "wrap";
  const freeformDynamicCanvasBandId = `${surface.surfaceId}:freeform-canvas`;
  const parseDynamicCanvasCssPixels = useCallback(
    (value: CSSProperties["minHeight"] | CSSProperties["height"]): number => {
      if (typeof value === "number" && Number.isFinite(value)) {
        return value;
      }
      if (typeof value === "string") {
        const normalized = value.trim();
        if (normalized.endsWith("px")) {
          const parsed = Number.parseFloat(normalized);
          if (Number.isFinite(parsed)) {
            return parsed;
          }
        }
      }
      return 0;
    },
    [],
  );
  const resolvedFreeformDynamicCanvasMinHeightPx = useMemo(() => {
    if (!usesFreeformDynamicCanvas) {
      return null;
    }
    if (
      typeof dynamicCanvasMinHeightPx === "number" &&
      Number.isFinite(dynamicCanvasMinHeightPx)
    ) {
      return Math.max(32, dynamicCanvasMinHeightPx);
    }
    const summedRowMinHeight = surfaceDefinition.rows.reduce((total, row) => {
      const rowStyle = getRowStyle?.(row.id);
      return (
        total +
        Math.max(
          32,
          parseDynamicCanvasCssPixels(rowStyle?.minHeight) ||
            parseDynamicCanvasCssPixels(rowStyle?.height),
        )
      );
    }, 0);
    return Math.max(32, summedRowMinHeight);
  }, [
    dynamicCanvasMinHeightPx,
    getRowStyle,
    parseDynamicCanvasCssPixels,
    surfaceDefinition.rows,
    usesFreeformDynamicCanvas,
  ]);
  const resolveResponsivePlacement = useCallback(
    (
      placement: ExplorerChromeResolvedControlPlacement,
      rowId?: string,
    ): ExplorerChromeResolvedControlPlacement => {
      if (editModeActive) {
        return placement;
      }

      const rowStyle = rowId ? getRowStyle?.(rowId) : undefined;
      const rowHeightPx =
        parseDynamicCanvasCssPixels(rowStyle?.height) ||
        parseDynamicCanvasCssPixels(rowStyle?.minHeight) ||
        parseDynamicCanvasCssPixels(style?.height) ||
        parseDynamicCanvasCssPixels(style?.minHeight);
      if (!rowHeightPx || rowHeightPx > 44) {
        return placement;
      }

      const compactWidth =
        typeof placement.widthPx === "number"
          ? Math.max(72, Math.min(placement.widthPx, rowHeightPx <= 34 ? 112 : 148))
          : undefined;

      return {
        ...placement,
        sizeVariant: "compact",
        widthPx: compactWidth ?? placement.widthPx,
        showLabel: false,
        showIcon: placement.showIcon ?? true,
      };
    },
    [editModeActive, getRowStyle, parseDynamicCanvasCssPixels, style?.height, style?.minHeight],
  );
  const freeformRowAnchorYOffsetByLegacyBandId = useMemo(() => {
    if (!usesFreeformDynamicCanvas) {
      return new Map<string, number>();
    }
    let offsetY = 0;
    return new Map(
      surfaceDefinition.rows.map((row) => {
        const rowStyle = getRowStyle?.(row.id);
        const entry = [row.id, offsetY] as const;
        offsetY += Math.max(
          32,
          parseDynamicCanvasCssPixels(rowStyle?.minHeight) ||
            parseDynamicCanvasCssPixels(rowStyle?.height),
        );
        return entry;
      }),
    );
  }, [
    getRowStyle,
    parseDynamicCanvasCssPixels,
    surfaceDefinition.rows,
    usesFreeformDynamicCanvas,
  ]);
  const dynamicSurfaceItems = useMemo(
    () =>
      filteredSurface.rows.flatMap((row) =>
        row.zones.flatMap((zone) =>
          zone.controls.map((placement) => {
            const controlIsResizable =
              editMode?.isControlResizable?.(placement) ?? false;
            const sourceBandId = placement.bandId ?? row.id;
            return {
              id: placement.controlId,
              label: placement.controlId,
              bandId: usesFreeformDynamicCanvas
                ? freeformDynamicCanvasBandId
                : sourceBandId,
              order: placement.order,
              anchorX: placement.anchorX,
              anchorY: usesFreeformDynamicCanvas
                ? (placement.anchorY ?? 0) +
                  (freeformRowAnchorYOffsetByLegacyBandId.get(sourceBandId) ?? 0)
                : placement.anchorY,
              widthPx: placement.widthPx,
              selected: editMode?.selectedControlId === placement.controlId,
              removable: editMode?.onRemoveControl != null,
              resizable: controlIsResizable,
              content: renderControl(resolveResponsivePlacement(placement, row.id)),
              style: {
                overflow: placement.overflowEligible ? "hidden" : "visible",
                paddingRight:
                  editModeActive && controlIsResizable ? 12 : 0,
              },
              dataAttributes: {
                "data-overlay-explorer-control": placement.controlId,
                "data-overlay-explorer-control-zone": placement.zone,
                "data-layout-dynamics-band-id": usesFreeformDynamicCanvas
                  ? freeformDynamicCanvasBandId
                  : sourceBandId,
              },
            };
          }),
        ),
      ),
    [
      editMode,
      editModeActive,
      freeformDynamicCanvasBandId,
      freeformRowAnchorYOffsetByLegacyBandId,
      filteredSurface.rows,
      renderControl,
      resolveResponsivePlacement,
      usesFreeformDynamicCanvas,
    ],
  );
  const dynamicSurfaceBands = useMemo(
    () => {
      if (usesFreeformDynamicCanvas) {
        return [
          {
            id: freeformDynamicCanvasBandId,
            minHeightPx: resolvedFreeformDynamicCanvasMinHeightPx ?? 32,
            rowId: "freeform",
            zoneId: surfaceDefinition.rows[0]?.zones[0] ?? "start",
            style: {
              minHeight: resolvedFreeformDynamicCanvasMinHeightPx ?? 32,
            },
          },
        ];
      }
      return surfaceDefinition.rows.map((row) => ({
        id: row.id,
        minHeightPx: 32,
        rowId: row.id,
        zoneId: row.zones[0] ?? "start",
        style: getRowStyle?.(row.id),
      }));
    },
    [
      freeformDynamicCanvasBandId,
      getRowStyle,
      resolvedFreeformDynamicCanvasMinHeightPx,
      surfaceDefinition.rows,
      usesFreeformDynamicCanvas,
    ],
  );
  const dynamicCatalogPreview = useMemo(() => {
    if (
      !useDynamicSurfaceLayout ||
      !editModeActive ||
      editMode?.catalogPreviewPlacement == null ||
      customizePointerSnapshot.active !== true ||
      customizePointerSnapshot.draggingControlId !==
        editMode.catalogPreviewPlacement.controlId ||
      customizePointerSnapshot.sourceKind !== "catalog" ||
      customizePointerSnapshot.pointerPoint == null
    ) {
      return null;
    }

    const highlightedDropTarget =
      editMode?.highlightedDropTarget?.surfaceId === surface.surfaceId
        ? editMode.highlightedDropTarget
        : null;
    if (
      highlightedDropTarget == null ||
      highlightedDropTarget.surfaceId !== surface.surfaceId
    ) {
      return null;
    }

    const bandId = usesFreeformDynamicCanvas
      ? freeformDynamicCanvasBandId
      : highlightedDropTarget.bandId ??
        bandIdByZoneId.get(highlightedDropTarget.zoneId) ??
        surfaceDefinition.rows[0]?.id ??
        "primary";
    const previewPlacement: ExplorerChromeResolvedControlPlacement = {
      ...editMode.catalogPreviewPlacement,
      controlId: editMode.catalogPreviewPlacement.controlId,
      surfaceId: surface.surfaceId,
      zone:
        highlightedDropTarget.zoneId ??
        primaryZoneIdByBandId.get(bandId) ??
        editMode.catalogPreviewPlacement.zone,
      order: highlightedDropTarget.targetIndex * 10 + 5,
      bandId,
      anchorX: highlightedDropTarget.anchorX,
      anchorY: highlightedDropTarget.anchorY,
      offsetPx: 0,
      hidden: false,
    };
    return {
      itemId: `external-preview:${previewPlacement.controlId}`,
      label: previewPlacement.controlId,
      content: renderControl(previewPlacement),
      pointerPoint: customizePointerSnapshot.pointerPoint,
      bandId,
      anchorX: highlightedDropTarget.anchorX,
      anchorY: highlightedDropTarget.anchorY,
      widthPx: previewPlacement.widthPx,
      dataAttributes: {
        "data-overlay-explorer-control": previewPlacement.controlId,
        "data-overlay-explorer-control-zone": previewPlacement.zone,
        "data-layout-dynamics-band-id": bandId,
      },
    };
  }, [
    bandIdByZoneId,
    customizePointerSnapshot.active,
    customizePointerSnapshot.draggingControlId,
    customizePointerSnapshot.pointerPoint,
    customizePointerSnapshot.sourceKind,
    editMode,
    editModeActive,
    freeformDynamicCanvasBandId,
    primaryZoneIdByBandId,
    renderControl,
    surface.surfaceId,
    surfaceDefinition.rows,
    useDynamicSurfaceLayout,
    usesFreeformDynamicCanvas,
  ]);
  const handleHorizontalChromeWheel = useCallback(
    (event: React.WheelEvent<HTMLDivElement>) => {
      const rowElement = event.currentTarget;
      const horizontalIntent = Math.abs(event.deltaX) > Math.abs(event.deltaY);
      if (horizontalIntent || event.deltaY === 0) {
        return;
      }

      const maxScrollLeft =
        rowElement.scrollWidth - rowElement.clientWidth;
      if (maxScrollLeft <= 1) {
        return;
      }

      const nextScrollLeft = Math.max(
        0,
        Math.min(maxScrollLeft, rowElement.scrollLeft + event.deltaY),
      );
      if (nextScrollLeft === rowElement.scrollLeft) {
        return;
      }

      event.preventDefault();
      rowElement.scrollLeft = nextScrollLeft;
    },
    [],
  );

  useEffect(() => {
    if (!editModeActive || !registerSurface) {
      return undefined;
    }

    registerSurface(stableRegisteredSurface);
    return () => {
      unregisterSurface?.(stableRegisteredSurface.surfaceId);
    };
  }, [
    editModeActive,
    registerSurface,
    stableRegisteredSurface,
    unregisterSurface,
  ]);

  if (!hasControls && !editModeActive) {
    return null;
  }

  const emitContextMenuRequest = useCallback(
    (event: React.MouseEvent<HTMLElement>) => {
      if (!onContextMenuRequest || shouldAllowNativeContextMenu(event.target)) {
        return;
      }
      const targetElement =
        event.target instanceof Element ? event.target : null;
      const controlId =
        targetElement?.closest<HTMLElement>("[data-overlay-explorer-control]")
          ?.dataset.overlayExplorerControl ?? null;
      event.preventDefault();
      event.stopPropagation();
      onContextMenuRequest({
        event,
        surfaceId: surface.surfaceId,
        controlId:
          typeof controlId === "string" && controlId.length > 0
            ? (controlId as ExplorerChromeControlId)
            : null,
      });
    },
    [onContextMenuRequest, surface.surfaceId],
  );

  if (useDynamicSurfaceLayout && layoutDynamics) {
    return (
      <div
        data-overlay-explorer-surface={surface.surfaceId}
        data-explorer-customize-surface-id={surface.surfaceId}
        style={{
          width: "100%",
          minWidth: 0,
          position: "relative",
          ...style,
        }}
        onContextMenu={emitContextMenuRequest}
      >
        <LayoutDynamicsCanvas
          surfaceId={surface.surfaceId}
          axisMode={layoutDynamics.axisMode}
          solver={layoutDynamics.solver}
          intensity={layoutDynamics.intensity}
          authoringActive={editModeActive}
          bands={dynamicSurfaceBands}
          items={dynamicSurfaceItems}
          onSelectItem={(controlId) =>
            editMode?.onSetSelectedControl?.(
              controlId as ExplorerChromeControlId | null,
            )
          }
          onRemoveItem={
            editMode?.onRemoveControl
              ? (controlId) =>
                  editMode.onRemoveControl?.(
                    controlId as ExplorerChromeControlId,
                  )
              : undefined
          }
          onBeginResizeItem={
            editMode?.onBeginPointerResize
              ? ({ itemId, pointerId, startPoint }) => {
                  editMode.onSetSelectedControl?.(
                    itemId as ExplorerChromeControlId,
                  );
                  editMode.onBeginPointerResize?.({
                    controlId: itemId as ExplorerChromeControlId,
                    pointerId,
                    startPoint,
                  });
                }
              : undefined
          }
          onCommitSnapshot={layoutDynamics.onCommitSnapshot}
          externalDragPreview={dynamicCatalogPreview}
        />
      </div>
    );
  }

  const targetUsesCustomizeRemoveControl = (target: EventTarget | null) =>
    target instanceof Element &&
    target.closest("[data-explorer-customize-remove-control='true']") != null;

  const targetUsesCustomizeLiveControl = (target: EventTarget | null) =>
    target instanceof Element &&
    target.closest("[data-explorer-customize-live-control='true']") != null;

  const targetUsesCustomizeResizeControl = (target: EventTarget | null) =>
    target instanceof Element &&
    target.closest("[data-explorer-customize-resize-control='true']") != null;

  const renderInsertionGhost = (
    zoneId: ExplorerChromeZoneId,
    targetIndex: number,
    offsetPx: number,
  ) => {
    if (!editModeActive || !editMode) {
      return null;
    }

    const highlightedDropTarget = editMode.highlightedDropTarget;
    const isHighlighted =
      highlightedDropTarget?.surfaceId === surface.surfaceId &&
      highlightedDropTarget.zoneId === zoneId &&
      highlightedDropTarget.targetIndex === targetIndex;

    return (
      <div
        key={`${surface.surfaceId}:${zoneId}:ghost:${targetIndex}`}
        data-explorer-customize-insertion-ghost="true"
        style={{
          minWidth: 22,
          height: 26,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          marginLeft: offsetPx > 0 ? `${offsetPx}px` : undefined,
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            width: isHighlighted ? 18 : 14,
            height: isHighlighted ? 20 : 18,
            borderRadius: 10,
            border: isHighlighted
              ? "1px solid color-mix(in srgb, var(--overlay-accent) 82%, white 18%)"
              : "1px dashed color-mix(in srgb, var(--overlay-accent) 54%, transparent)",
            background: isHighlighted
              ? "color-mix(in srgb, var(--overlay-accent) 18%, transparent)"
              : "color-mix(in srgb, var(--overlay-accent) 10%, transparent)",
            boxShadow: isHighlighted
              ? "0 0 0 1px color-mix(in srgb, var(--overlay-accent) 24%, transparent)"
              : undefined,
            transition: "width 120ms ease, height 120ms ease, background 120ms ease",
          }}
        />
      </div>
    );
  };

  return (
    <div
      className="explorer-chrome-surface"
      data-overlay-explorer-surface={surface.surfaceId}
      data-explorer-customize-surface-id={surface.surfaceId}
      style={{
        width: "100%",
        minWidth: 0,
        position: "relative",
        ...style,
      }}
      onContextMenu={emitContextMenuRequest}
    >
      {filteredSurface.rows.map((row) => {
        const rowHasControls = row.zones.some(
          (zone) => zone.controls.length > 0,
        );
        if (!rowHasControls && !editModeActive) {
          return null;
        }

        return (
          <div
            className="explorer-chrome-surface__row overlay-scrollbars-none"
            key={row.id}
            data-overlay-explorer-row={row.id}
            data-explorer-customize-row-id={row.id}
            onWheel={
              useWrappedOverflow ? undefined : handleHorizontalChromeWheel
            }
            style={{
              width: "100%",
              minWidth: 0,
              position: "relative",
              ...(getRowStyle?.(row.id) ?? {}),
              flexWrap: useWrappedOverflow ? "wrap" : "nowrap",
              overflowX: useWrappedOverflow ? "visible" : "auto",
              overflowY: useWrappedOverflow ? "visible" : "hidden",
              overscrollBehaviorX: useWrappedOverflow ? "auto" : "contain",
            }}
          >
            {row.zones.map((zone) => {
              if (zone.controls.length === 0 && !editModeActive) {
                return null;
              }

              const highlightedDropTarget = editMode?.highlightedDropTarget;
              const zoneIsActiveDropTarget =
                highlightedDropTarget?.surfaceId === surface.surfaceId &&
                highlightedDropTarget.zoneId === zone.id;
              const zoneInsertionIndex = zoneIsActiveDropTarget
                ? highlightedDropTarget?.targetIndex ?? null
                : null;
              const zoneInsertionOffsetPx = zoneIsActiveDropTarget
                ? highlightedDropTarget?.offsetPx ?? 0
                : 0;

              return (
                <div
                  className="explorer-chrome-surface__zone"
                  key={zone.id}
                  data-overlay-explorer-zone={zone.id}
                  data-explorer-customize-zone-id={zone.id}
                  style={{
                    position: "relative",
                    ...(getZoneStyle?.(zone.id) ?? {}),
                    flexWrap: useWrappedOverflow ? "wrap" : "nowrap",
                    flexShrink: useWrappedOverflow ? 1 : 0,
                    minWidth: useWrappedOverflow ? 0 : "max-content",
                    maxWidth: useWrappedOverflow ? "100%" : undefined,
                    ...(editModeActive
                      ? {
                          minHeight: 32,
                          padding:
                            zone.controls.length === 0 ? "4px 6px" : "2px 4px",
                          borderRadius: 12,
                          background: zoneIsActiveDropTarget
                            ? "color-mix(in srgb, var(--overlay-accent) 10%, transparent)"
                            : zone.controls.length === 0
                              ? "color-mix(in srgb, var(--overlay-border) 8%, transparent)"
                              : "transparent",
                          boxShadow: zoneIsActiveDropTarget
                            ? "inset 0 0 0 1px color-mix(in srgb, var(--overlay-accent) 40%, transparent)"
                            : zone.controls.length === 0
                              ? "inset 0 0 0 1px color-mix(in srgb, var(--overlay-border) 52%, transparent)"
                              : undefined,
                          transition:
                            "background 120ms ease, box-shadow 120ms ease",
                        }
                      : {}),
                  }}
                >
                  {zone.controls.map((placement, index) => {
                    const responsivePlacement = resolveResponsivePlacement(
                      placement,
                      row.id,
                    );
                    const isSelected =
                      editMode?.selectedControlId === placement.controlId;
                    const isPendingHotkey =
                      editMode?.pendingHotkeyControlId === placement.controlId;
                    const isResizing =
                      editMode?.resizingControlId === placement.controlId;
                    const controlIsResizable =
                      editMode?.isControlResizable?.(placement) ?? false;
                    const hasExplicitWidth =
                      typeof responsivePlacement.widthPx === "number";
                    return (
                      <React.Fragment
                        key={`${placement.surfaceId}:${placement.controlId}`}
                      >
                        {editModeActive && zoneInsertionIndex === index
                          ? renderInsertionGhost(
                              zone.id,
                              index,
                              zoneInsertionOffsetPx,
                            )
                          : null}
                        <div
                          data-overlay-explorer-control={placement.controlId}
                          data-overlay-explorer-control-zone={placement.zone}
                          onPointerDownCapture={(event) => {
                            if (!editMode || event.button !== 0) {
                              return;
                            }

                            if (
                              targetUsesCustomizeRemoveControl(event.target)
                            ) {
                              return;
                            }

                            if (
                              targetUsesCustomizeResizeControl(event.target)
                            ) {
                              return;
                            }

                            if (editModeActive) {
                              if (event.ctrlKey && event.altKey) {
                                return;
                              }

                              event.preventDefault();
                              event.stopPropagation();
                              editMode.onSetSelectedControl?.(
                                placement.controlId,
                              );
                              editMode.onBeginPointerDrag?.({
                                controlId: placement.controlId,
                                pointerId: event.pointerId,
                                sourceKind: "placed",
                                startPoint: {
                                  x: event.clientX,
                                  y: event.clientY,
                                },
                              });
                            }
                          }}
                          onMouseEnter={() => {
                            if (editModeActive) {
                              setHoveredControlId(placement.controlId);
                            }
                          }}
                          onMouseLeave={() => {
                            setHoveredControlId((current) =>
                              current === placement.controlId ? null : current,
                            );
                          }}
                          onClickCapture={(event) => {
                            if (!editMode) {
                              return;
                            }

                            if (
                              targetUsesCustomizeRemoveControl(event.target)
                            ) {
                              return;
                            }

                            if (
                              targetUsesCustomizeResizeControl(event.target)
                            ) {
                              return;
                            }

                            if (event.ctrlKey && event.altKey) {
                              event.preventDefault();
                              event.stopPropagation();
                              editMode.onRequestHotkeyCapture?.(
                                placement.controlId,
                              );
                              editMode.onSetSelectedControl?.(
                                placement.controlId,
                              );
                              return;
                            }

                            if (!editModeActive) {
                              return;
                            }

                            if (targetUsesCustomizeLiveControl(event.target)) {
                              event.preventDefault();
                              event.stopPropagation();
                              editMode.onSetSelectedControl?.(
                                placement.controlId,
                              );
                              return;
                            }

                            event.preventDefault();
                            event.stopPropagation();
                            editMode.onSetSelectedControl?.(
                              placement.controlId,
                            );
                          }}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            minWidth: 0,
                            position: "relative",
                            flexGrow: hasExplicitWidth ? 0 : responsivePlacement.grow ?? 0,
                            flexShrink: useWrappedOverflow
                              ? responsivePlacement.shrink ?? 0
                              : 0,
                            flexBasis: hasExplicitWidth ? responsivePlacement.widthPx : undefined,
                            width: hasExplicitWidth ? responsivePlacement.widthPx : undefined,
                            maxWidth: hasExplicitWidth ? responsivePlacement.widthPx : undefined,
                            marginLeft:
                              (placement.offsetPx ?? 0) > 0
                                ? `${placement.offsetPx}px`
                                : undefined,
                            overflow: placement.overflowEligible
                              ? "hidden"
                              : "visible",
                            paddingRight:
                              editModeActive && controlIsResizable ? 12 : 0,
                            ...(editModeActive
                              ? {
                                  cursor:
                                    isResizing
                                      ? "ew-resize"
                                      : editMode.draggingControlId ===
                                          placement.controlId
                                        ? "grabbing"
                                        : "grab",
                                  borderRadius: 10,
                                  outline: isPendingHotkey
                                    ? "1px solid color-mix(in srgb, var(--overlay-accent) 92%, white 8%)"
                                    : isSelected
                                      ? "1px solid color-mix(in srgb, var(--overlay-accent) 70%, transparent)"
                                      : "1px solid color-mix(in srgb, var(--overlay-border) 80%, transparent)",
                                  outlineOffset: -1,
                                  background: isResizing
                                    ? "color-mix(in srgb, var(--overlay-accent) 16%, transparent)"
                                    : editMode.draggingControlId ===
                                        placement.controlId
                                      ? "color-mix(in srgb, var(--overlay-accent) 14%, transparent)"
                                      : isPendingHotkey
                                        ? "color-mix(in srgb, var(--overlay-accent) 18%, transparent)"
                                        : isSelected
                                          ? "color-mix(in srgb, var(--overlay-accent) 10%, transparent)"
                                          : "transparent",
                                  opacity:
                                    editMode.draggingControlId ===
                                    placement.controlId
                                      ? 0.55
                                      : 1,
                                }
                              : isPendingHotkey
                                ? {
                                    borderRadius: 10,
                                    outline:
                                      "1px solid color-mix(in srgb, var(--overlay-accent) 92%, white 8%)",
                                    outlineOffset: -1,
                                    background:
                                      "color-mix(in srgb, var(--overlay-accent) 16%, transparent)",
                                  }
                                : {}),
                          }}
                        >
                          {renderControl(responsivePlacement)}
                          {editModeActive &&
                          controlIsResizable &&
                          editMode.onBeginPointerResize ? (
                            <button
                              type="button"
                              data-explorer-customize-resize-control="true"
                              aria-label={`Resize ${placement.controlId}`}
                              onPointerDown={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                editMode.onSetSelectedControl?.(
                                  placement.controlId,
                                );
                                editMode.onBeginPointerResize?.({
                                  controlId: placement.controlId,
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
                                  hoveredControlId === placement.controlId ||
                                  isSelected ||
                                  isResizing
                                    ? "color-mix(in srgb, var(--overlay-accent) 20%, transparent)"
                                    : "transparent",
                                color: "var(--overlay-text-dim)",
                                cursor: "ew-resize",
                                opacity:
                                  hoveredControlId === placement.controlId ||
                                  isSelected ||
                                  isResizing
                                    ? 0.96
                                    : 0,
                                pointerEvents:
                                  hoveredControlId === placement.controlId ||
                                  isSelected ||
                                  isResizing
                                    ? "auto"
                                    : "none",
                                transition:
                                  "opacity 120ms ease, background 120ms ease",
                                zIndex: 2,
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
                          {editModeActive && editMode.onRemoveControl ? (
                            <button
                              type="button"
                              data-explorer-customize-remove-control="true"
                              aria-label={`Remove ${placement.controlId} from layout`}
                              onClick={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                editMode.onRemoveControl?.(placement.controlId);
                              }}
                              style={{
                                position: "absolute",
                                top: 2,
                                right: 2,
                                width: 18,
                                height: 18,
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                                borderRadius: 999,
                                border:
                                  "1px solid color-mix(in srgb, #ef4444 50%, transparent)",
                                background:
                                  "color-mix(in srgb, #ef4444 16%, black 8%)",
                                color: "var(--overlay-text-primary)",
                                cursor: "pointer",
                                opacity:
                                  hoveredControlId === placement.controlId
                                    ? 0.92
                                    : 0,
                                pointerEvents:
                                  hoveredControlId === placement.controlId
                                    ? "auto"
                                    : "none",
                                transition: "opacity 120ms ease",
                                zIndex: 2,
                              }}
                            >
                              <X size={10} />
                            </button>
                          ) : null}
                        </div>
                      </React.Fragment>
                    );
                  })}
                  {editModeActive &&
                  zoneInsertionIndex === zone.controls.length
                    ? renderInsertionGhost(
                        zone.id,
                        zone.controls.length,
                        zoneInsertionOffsetPx,
                      )
                    : null}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
