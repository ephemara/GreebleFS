import React, { useEffect, useMemo, type CSSProperties } from 'react';
import type {
  ExplorerChromeControlId,
  ExplorerChromeResolvedControlPlacement,
  ExplorerChromeResolvedSurface,
  ExplorerChromeSurfaceId,
  ExplorerChromeZoneId,
} from '../../config/explorerChromeLayouts';
import { getExplorerChromeResolvedSurfaceSignature } from '../../config/explorerChromeLayouts';

interface ExplorerChromeSurfaceProps {
  surface: ExplorerChromeResolvedSurface;
  style?: CSSProperties;
  getRowStyle?: (rowId: string) => CSSProperties | undefined;
  getZoneStyle?: (zoneId: ExplorerChromeZoneId) => CSSProperties | undefined;
  renderControl: (placement: ExplorerChromeResolvedControlPlacement) => React.ReactNode;
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
    onSetHighlightedDropTarget?: (target: {
      surfaceId: ExplorerChromeSurfaceId;
      zoneId: ExplorerChromeZoneId;
      targetIndex: number;
    } | null) => void;
    onSetSelectedControl?: (controlId: ExplorerChromeControlId | null) => void;
    onSetPendingHotkeyControl?: (controlId: ExplorerChromeControlId | null) => void;
    onMoveControl: (args: {
      controlId: ExplorerChromeControlId;
      targetSurfaceId: ExplorerChromeSurfaceId;
      targetZoneId: ExplorerChromeZoneId;
      targetIndex: number;
    }) => void;
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
  const hasControls = surface.rows.some((row) => row.zones.some((zone) => zone.controls.length > 0));
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
    const isHighlighted = highlightedDropTarget?.surfaceId === surface.surfaceId
      && highlightedDropTarget.zoneId === zoneId
      && highlightedDropTarget.targetIndex === targetIndex;

    return (
      <div
        key={`${surface.surfaceId}:${zoneId}:drop:${targetIndex}`}
        onDragOver={(event) => {
          event.preventDefault();
          event.dataTransfer.dropEffect = 'move';
          editMode.onSetHighlightedDropTarget?.({
            surfaceId: surface.surfaceId,
            zoneId,
            targetIndex,
          });
        }}
        onDragLeave={() => {
          if (!isHighlighted) {
            return;
          }
          editMode.onSetHighlightedDropTarget?.(null);
        }}
        onDrop={(event) => {
          event.preventDefault();
          if (!editMode.draggingControlId) {
            return;
          }
          editMode.onMoveControl({
            controlId: editMode.draggingControlId,
            targetSurfaceId: surface.surfaceId,
            targetZoneId: zoneId,
            targetIndex,
          });
          editMode.onSetHighlightedDropTarget?.(null);
          editMode.onDragEnd();
        }}
        style={{
          width: 10,
          alignSelf: 'stretch',
          display: 'flex',
          alignItems: 'stretch',
          justifyContent: 'center',
          cursor: 'copy',
          flexShrink: 0,
        }}
      >
        <span
          aria-hidden="true"
          style={{
            width: 2,
            borderRadius: 999,
            background: isHighlighted
              ? 'var(--overlay-accent)'
              : editMode.draggingControlId
                ? 'color-mix(in srgb, var(--overlay-accent) 60%, transparent)'
                : 'color-mix(in srgb, var(--overlay-border) 82%, transparent)',
            opacity: isHighlighted ? 1 : editMode.draggingControlId ? 0.75 : 0.35,
          }}
        />
      </div>
    );
  };

  return (
    <div
      data-overlay-explorer-surface={surface.surfaceId}
      style={style}
    >
      {surface.rows.map((row) => {
        const rowHasControls = row.zones.some((zone) => zone.controls.length > 0);
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
                        padding: zone.controls.length === 0 ? '4px 6px' : undefined,
                        borderRadius: 10,
                        outline: zone.controls.length === 0
                          ? '1px dashed color-mix(in srgb, var(--overlay-border) 72%, transparent)'
                          : undefined,
                        outlineOffset: zone.controls.length === 0 ? -1 : undefined,
                      }
                      : {}),
                  }}
                >
                  {editModeActive && renderDropTarget(zone.id, 0)}
                  {zone.controls.map((placement, index) => {
                    const isSelected = editMode?.selectedControlId === placement.controlId;
                    const isPendingHotkey = editMode?.pendingHotkeyControlId === placement.controlId;
                    return (
                      <React.Fragment key={`${placement.surfaceId}:${placement.controlId}`}>
                        <div
                          data-overlay-explorer-control={placement.controlId}
                          data-overlay-explorer-control-zone={placement.zone}
                          draggable={false}
                          onMouseDownCapture={(event) => {
                            if (!editModeActive || !editMode) {
                              return;
                            }
                            event.currentTarget.draggable = event.ctrlKey && event.altKey;
                            if (!event.ctrlKey || !event.altKey) {
                              editMode.onSetSelectedControl?.(placement.controlId);
                            }
                          }}
                          onMouseUpCapture={(event) => {
                            event.currentTarget.draggable = false;
                          }}
                          onClickCapture={(event) => {
                            if (!editModeActive || !editMode) {
                              return;
                            }
                            event.preventDefault();
                            event.stopPropagation();
                            if (event.ctrlKey && event.altKey) {
                              editMode.onSetPendingHotkeyControl?.(placement.controlId);
                              editMode.onSetSelectedControl?.(placement.controlId);
                              return;
                            }
                            editMode.onSetSelectedControl?.(placement.controlId);
                          }}
                          onDragStart={(event) => {
                            if (!editModeActive || !editMode || !event.currentTarget.draggable) {
                              event.preventDefault();
                              return;
                            }
                            event.dataTransfer.effectAllowed = 'move';
                            event.dataTransfer.setData('text/plain', placement.controlId);
                            editMode.onSetSelectedControl?.(placement.controlId);
                            editMode.onDragStart(placement.controlId);
                          }}
                          onDragEnd={(event) => {
                            event.currentTarget.draggable = false;
                            if (!editModeActive || !editMode) {
                              return;
                            }
                            editMode.onSetHighlightedDropTarget?.(null);
                            editMode.onDragEnd();
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            minWidth: 0,
                            flexGrow: placement.grow ?? 0,
                            flexShrink: placement.shrink ?? 0,
                            overflow: placement.overflowEligible ? 'hidden' : 'visible',
                            ...(editModeActive
                              ? {
                                cursor: 'default',
                                borderRadius: 10,
                                outline: isPendingHotkey
                                  ? '1px solid color-mix(in srgb, var(--overlay-accent) 92%, white 8%)'
                                  : isSelected
                                    ? '1px solid color-mix(in srgb, var(--overlay-accent) 70%, transparent)'
                                    : '1px solid color-mix(in srgb, var(--overlay-border) 80%, transparent)',
                                outlineOffset: -1,
                                background: editMode.draggingControlId === placement.controlId
                                  ? 'color-mix(in srgb, var(--overlay-accent) 14%, transparent)'
                                  : isPendingHotkey
                                    ? 'color-mix(in srgb, var(--overlay-accent) 18%, transparent)'
                                    : isSelected
                                      ? 'color-mix(in srgb, var(--overlay-accent) 10%, transparent)'
                                      : 'transparent',
                                opacity: editMode.draggingControlId === placement.controlId ? 0.55 : 1,
                              }
                              : {}),
                          }}
                        >
                          {renderControl(placement)}
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
