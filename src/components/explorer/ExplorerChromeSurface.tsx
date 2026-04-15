import React, { useEffect, type CSSProperties } from 'react';
import type {
  ExplorerChromeControlId,
  ExplorerChromeResolvedControlPlacement,
  ExplorerChromeResolvedSurface,
  ExplorerChromeSurfaceId,
  ExplorerChromeZoneId,
} from '../../config/explorerChromeLayouts';

interface ExplorerChromeSurfaceProps {
  surface: ExplorerChromeResolvedSurface;
  style?: CSSProperties;
  getRowStyle?: (rowId: string) => CSSProperties | undefined;
  getZoneStyle?: (zoneId: ExplorerChromeZoneId) => CSSProperties | undefined;
  renderControl: (placement: ExplorerChromeResolvedControlPlacement) => React.ReactNode;
  editMode?: {
    active: boolean;
    draggingControlId: ExplorerChromeControlId | null;
    onRegisterSurface?: (surface: ExplorerChromeResolvedSurface) => void;
    onUnregisterSurface?: (surfaceId: ExplorerChromeSurfaceId) => void;
    onDragStart: (controlId: ExplorerChromeControlId) => void;
    onDragEnd: () => void;
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
  useEffect(() => {
    if (!editModeActive) {
      return undefined;
    }

    editMode?.onRegisterSurface?.(surface);
    return () => {
      editMode?.onUnregisterSurface?.(surface.surfaceId);
    };
  }, [editMode, editModeActive, surface]);

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

    return (
      <div
        key={`${surface.surfaceId}:${zoneId}:drop:${targetIndex}`}
        onDragOver={(event) => {
          event.preventDefault();
          event.dataTransfer.dropEffect = 'move';
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
            background: editMode.draggingControlId ? 'var(--overlay-accent)' : 'color-mix(in srgb, var(--overlay-border) 82%, transparent)',
            opacity: editMode.draggingControlId ? 0.95 : 0.35,
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
                  {zone.controls.map((placement, index) => (
                    <React.Fragment key={`${placement.surfaceId}:${placement.controlId}`}>
                      <div
                        data-overlay-explorer-control={placement.controlId}
                        data-overlay-explorer-control-zone={placement.zone}
                        draggable={editModeActive}
                        onDragStart={(event) => {
                          if (!editModeActive || !editMode) {
                            return;
                          }
                          event.dataTransfer.effectAllowed = 'move';
                          event.dataTransfer.setData('text/plain', placement.controlId);
                          editMode.onDragStart(placement.controlId);
                        }}
                        onDragEnd={() => {
                          if (!editModeActive || !editMode) {
                            return;
                          }
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
                              cursor: 'grab',
                              borderRadius: 10,
                              outline: '1px solid color-mix(in srgb, var(--overlay-border) 80%, transparent)',
                              outlineOffset: -1,
                              background: editMode.draggingControlId === placement.controlId
                                ? 'color-mix(in srgb, var(--overlay-accent) 14%, transparent)'
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
                  ))}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
