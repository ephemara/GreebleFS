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

  const renderDropTarget = (
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
        key={`${surface.surfaceId}:${zoneId}:drop:${targetIndex}`}
        data-explorer-customize-drop-surface-id={surface.surfaceId}
        data-explorer-customize-drop-zone-id={zoneId}
        data-explorer-customize-drop-target-index={String(targetIndex)}
        style={{
          width: 10,
          alignSelf: "stretch",
          display: "flex",
          alignItems: "stretch",
          justifyContent: "center",
          cursor: editMode.draggingControlId ? "grabbing" : "default",
          flexShrink: 0,
        }}
      >
        <span
          aria-hidden="true"
          style={{
            width: 2,
            borderRadius: 999,
            background: isHighlighted
              ? "var(--overlay-accent)"
              : editMode.draggingControlId
                ? "color-mix(in srgb, var(--overlay-accent) 60%, transparent)"
                : "color-mix(in srgb, var(--overlay-border) 82%, transparent)",
            opacity: isHighlighted
              ? 1
              : editMode.draggingControlId
                ? 0.75
                : 0.35,
          }}
        />
      </div>
    );
  };

  return (
    <div data-overlay-explorer-surface={surface.surfaceId} style={style}>
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
            style={getRowStyle?.(row.id)}
          >
            {row.zones.map((zone) => {
              if (zone.controls.length === 0 && !editModeActive) {
                return null;
              }

              return (
                <div
                  key={zone.id}
                  data-overlay-explorer-zone={zone.id}
                  style={{
                    ...(getZoneStyle?.(zone.id) ?? {}),
                    ...(editModeActive
                      ? {
                          minHeight: 28,
                          padding:
                            zone.controls.length === 0 ? "4px 6px" : undefined,
                          borderRadius: 10,
                          outline:
                            zone.controls.length === 0
                              ? "1px dashed color-mix(in srgb, var(--overlay-border) 72%, transparent)"
                              : undefined,
                          outlineOffset:
                            zone.controls.length === 0 ? -1 : undefined,
                        }
                      : {}),
                  }}
                >
                  {editModeActive && renderDropTarget(zone.id, 0)}
                  {zone.controls.map((placement, index) => {
                    const isSelected =
                      editMode?.selectedControlId === placement.controlId;
                    const isPendingHotkey =
                      editMode?.pendingHotkeyControlId === placement.controlId;
                    return (
                      <React.Fragment
                        key={`${placement.surfaceId}:${placement.controlId}`}
                      >
                        <div
                          data-overlay-explorer-control={placement.controlId}
                          data-overlay-explorer-control-zone={placement.zone}
                          onPointerDownCapture={(event) => {
                            if (!editMode || event.button !== 0) {
                              return;
                            }

                            if (
                              editModeActive &&
                              event.ctrlKey &&
                              event.altKey
                            ) {
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
                                onTap: (controlId) => {
                                  editMode.onRequestHotkeyCapture?.(controlId);
                                  editMode.onSetSelectedControl?.(controlId);
                                },
                              });
                              return;
                            }

                            if (editModeActive) {
                              editMode.onSetSelectedControl?.(
                                placement.controlId,
                              );
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
                              editModeActive &&
                              event.ctrlKey &&
                              event.altKey
                            ) {
                              event.preventDefault();
                              event.stopPropagation();
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
                            flexGrow: placement.grow ?? 0,
                            flexShrink: placement.shrink ?? 0,
                            overflow: placement.overflowEligible
                              ? "hidden"
                              : "visible",
                            ...(editModeActive
                              ? {
                                  cursor: "default",
                                  borderRadius: 10,
                                  outline: isPendingHotkey
                                    ? "1px solid color-mix(in srgb, var(--overlay-accent) 92%, white 8%)"
                                    : isSelected
                                      ? "1px solid color-mix(in srgb, var(--overlay-accent) 70%, transparent)"
                                      : "1px solid color-mix(in srgb, var(--overlay-border) 80%, transparent)",
                                  outlineOffset: -1,
                                  background:
                                    editMode.draggingControlId ===
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
                          {editModeActive && editMode.onRemoveControl ? (
                            <button
                              type="button"
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
                        {editModeActive && renderDropTarget(zone.id, index + 1)}
                      </React.Fragment>
                    );
                  })}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
