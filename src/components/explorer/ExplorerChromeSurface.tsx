import React, { type CSSProperties } from 'react';
import type {
  ExplorerChromeResolvedControlPlacement,
  ExplorerChromeResolvedSurface,
  ExplorerChromeZoneId,
} from '../../config/explorerChromeLayouts';

interface ExplorerChromeSurfaceProps {
  surface: ExplorerChromeResolvedSurface;
  style?: CSSProperties;
  getRowStyle?: (rowId: string) => CSSProperties | undefined;
  getZoneStyle?: (zoneId: ExplorerChromeZoneId) => CSSProperties | undefined;
  renderControl: (placement: ExplorerChromeResolvedControlPlacement) => React.ReactNode;
}

export function ExplorerChromeSurface({
  surface,
  style,
  getRowStyle,
  getZoneStyle,
  renderControl,
}: ExplorerChromeSurfaceProps) {
  const hasControls = surface.rows.some((row) => row.zones.some((zone) => zone.controls.length > 0));
  if (!hasControls) {
    return null;
  }

  return (
    <div
      data-overlay-explorer-surface={surface.surfaceId}
      style={style}
    >
      {surface.rows.map((row) => {
        const rowHasControls = row.zones.some((zone) => zone.controls.length > 0);
        if (!rowHasControls) {
          return null;
        }

        return (
          <div
            key={row.id}
            data-overlay-explorer-row={row.id}
            style={getRowStyle?.(row.id)}
          >
            {row.zones.map((zone) => {
              if (zone.controls.length === 0) {
                return null;
              }

              return (
                <div
                  key={zone.id}
                  data-overlay-explorer-zone={zone.id}
                  style={getZoneStyle?.(zone.id)}
                >
                  {zone.controls.map((placement) => (
                    <div
                      key={`${placement.surfaceId}:${placement.controlId}`}
                      data-overlay-explorer-control={placement.controlId}
                      data-overlay-explorer-control-zone={placement.zone}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        minWidth: 0,
                        flexGrow: placement.grow ?? 0,
                        flexShrink: placement.shrink ?? 0,
                        overflow: placement.overflowEligible ? 'hidden' : 'visible',
                      }}
                    >
                      {renderControl(placement)}
                    </div>
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
