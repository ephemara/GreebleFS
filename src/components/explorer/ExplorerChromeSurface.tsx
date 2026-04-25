import React, { useEffect, useMemo, useState, type CSSProperties } from "react";
import { X } from "@/components/AppIcons";
import type {
  ExplorerChromeControlId,
  ExplorerChromeResolvedControlPlacement,
  ExplorerChromeResolvedSurface,
  ExplorerChromeSurfaceId,
  ExplorerChromeZoneId,
} from "../../config/explorerChromeLayouts";
import { getExplorerChromeResolvedSurfaceSignature } from "../../config/explorerChromeLayouts";

interface ExplorerChromeSurfaceProps {
  surface: ExplorerChromeResolvedSurface;
  style?: CSSProperties;
  getRowStyle?: (rowId: string) => CSSProperties | undefined;
  getZoneStyle?: (zoneId: ExplorerChromeZoneId) => CSSProperties | undefined;
  renderControl: (
    placement: ExplorerChromeResolvedControlPlacement,
  ) => React.ReactNode;
  editMode?: {
    active: boolean;
    draggingControlId: ExplorerChromeControlId | null;
    highlightedDropTarget?: {
      surfaceId: ExplorerChromeSurfaceId;
      zoneId: ExplorerChromeZoneId;
      targetIndex: number;
    } | null;
    resizingControlId?: ExplorerChromeControlId | null;
    selectedControlId?: ExplorerChromeControlId | null;
    pendingHotkeyControlId?: ExplorerChromeControlId | null;
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
  renderControl,
  editMode,
}: ExplorerChromeSurfaceProps) {
  const editModeActive = editMode?.active === true;
  const hasControls = surface.rows.some((row) =>
    row.zones.some((zone) => zone.controls.length > 0),
  );
  const [hoveredControlId, setHoveredControlId] =
    useState<ExplorerChromeControlId | null>(null);
  const registerSurface = editMode?.onRegisterSurface;
  const unregisterSurface = editMode?.onUnregisterSurface;
  const surfaceRegistrationSignature = useMemo(
    () => getExplorerChromeResolvedSurfaceSignature(surface),
    [surface],
  );
  const stableRegisteredSurface = useMemo(
    () => surface,
    [surfaceRegistrationSignature],
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
      data-overlay-explorer-surface={surface.surfaceId}
      data-explorer-customize-surface-id={surface.surfaceId}
      style={{
        width: "100%",
        minWidth: 0,
        position: "relative",
        ...style,
      }}
    >
      {surface.rows.map((row) => {
        const rowHasControls = row.zones.some(
          (zone) => zone.controls.length > 0,
        );
        if (!rowHasControls && !editModeActive) {
          return null;
        }

        return (
          <div
            key={row.id}
            data-overlay-explorer-row={row.id}
            data-explorer-customize-row-id={row.id}
            style={{
              width: "100%",
              minWidth: 0,
              position: "relative",
              ...(getRowStyle?.(row.id) ?? {}),
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

              return (
                <div
                  key={zone.id}
                  data-overlay-explorer-zone={zone.id}
                  data-explorer-customize-zone-id={zone.id}
                  style={{
                    minWidth: 0,
                    position: "relative",
                    ...(getZoneStyle?.(zone.id) ?? {}),
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
                    const isSelected =
                      editMode?.selectedControlId === placement.controlId;
                    const isPendingHotkey =
                      editMode?.pendingHotkeyControlId === placement.controlId;
                    const isResizing =
                      editMode?.resizingControlId === placement.controlId;
                    const controlIsResizable =
                      editMode?.isControlResizable?.(placement) ?? false;
                    const hasExplicitWidth = typeof placement.widthPx === "number";
                    return (
                      <React.Fragment
                        key={`${placement.surfaceId}:${placement.controlId}`}
                      >
                        {editModeActive && zoneInsertionIndex === index
                          ? renderInsertionGhost(zone.id, index)
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
                            flexGrow: hasExplicitWidth ? 0 : placement.grow ?? 0,
                            flexShrink: hasExplicitWidth ? 1 : placement.shrink ?? 0,
                            flexBasis: hasExplicitWidth ? placement.widthPx : undefined,
                            width: hasExplicitWidth ? placement.widthPx : undefined,
                            maxWidth: hasExplicitWidth ? placement.widthPx : undefined,
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
                          {renderControl(placement)}
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
                    ? renderInsertionGhost(zone.id, zone.controls.length)
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
