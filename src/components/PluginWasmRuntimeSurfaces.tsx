import { useMemo } from 'react';

import type {
  BoundOverlayPluginPreviewLaneProps,
  OverlayPluginProps,
} from './pluginRuntime';
import {
  WasmPanelHost,
  type WasmPanelBuildTarget,
  type WasmPanelHostContext,
} from './WasmPanelHost';

export interface PluginWasmPanelSurfaceProps extends OverlayPluginProps {
  runtimeId: string;
  buildTarget?: WasmPanelBuildTarget | null;
}

export function PluginWasmPanelSurface({
  plugin,
  appearance,
  host,
  runtimeId,
  buildTarget = null,
}: PluginWasmPanelSurfaceProps) {
  const context = useMemo<WasmPanelHostContext>(
    () => ({
      runtimeId,
      panelId: plugin.id,
      appearanceId: appearance.theme.id,
      densityToken: host?.density ?? 'regular',
      cssVariables: appearance.cssVars,
      assetUrls: {},
      size: {
        width: host?.width ?? 0,
        height: host?.height ?? 0,
      },
      surfaceKind: 'plugin-panel',
      surfaceContext: {
        pluginId: plugin.id,
        pluginName: plugin.name,
        hostMode: host?.mode ?? 'panel-tab',
        zoom: host?.zoom ?? 1,
        compact: host?.compact ?? false,
      },
    }),
    [appearance.cssVars, appearance.theme.id, buildTarget, host, plugin.id, plugin.name, runtimeId],
  );

  return (
    <WasmPanelHost
      runtimeId={runtimeId}
      context={context}
      buildTarget={buildTarget ?? undefined}
      className="absolute inset-0"
      style={{ width: '100%', height: '100%', minWidth: 0, minHeight: 0 }}
    />
  );
}

export interface PluginWasmPreviewSurfaceProps
  extends BoundOverlayPluginPreviewLaneProps {
  runtimeId: string;
  buildTarget?: WasmPanelBuildTarget | null;
}

export function PluginWasmPreviewSurface({
  runtimeId,
  buildTarget = null,
  appearance,
  host,
  lane,
  file,
  executionContext,
  viewMode,
  workflowTabId,
  previewBackedByArchiveVirtual,
}: PluginWasmPreviewSurfaceProps) {
  const context = useMemo<WasmPanelHostContext>(
    () => ({
      runtimeId,
      panelId: `${lane.pluginId}.preview.${lane.id}`,
      appearanceId: appearance.theme.id,
      densityToken: host.density,
      cssVariables: appearance.cssVars,
      assetUrls: {},
      size: {
        width: host.width,
        height: host.height,
      },
      surfaceKind: 'plugin-preview-lane',
      surfaceContext: {
        pluginId: lane.pluginId,
        pluginName: lane.pluginName,
        laneId: lane.id,
        laneTitle: lane.title,
        file,
        executionContext,
        viewMode,
        workflowTabId,
        previewBackedByArchiveVirtual,
        host: {
          width: host.width,
          height: host.height,
          zoom: host.zoom,
          compact: host.compact,
          density: host.density,
        },
      },
    }),
    [
      appearance.cssVars,
      appearance.theme.id,
      executionContext,
      file,
      host.compact,
      host.density,
      host.height,
      host.width,
      host.zoom,
      lane.id,
      lane.pluginId,
      lane.pluginName,
      lane.title,
      previewBackedByArchiveVirtual,
      runtimeId,
      viewMode,
      workflowTabId,
    ],
  );

  return (
    <WasmPanelHost
      runtimeId={runtimeId}
      context={context}
      buildTarget={buildTarget ?? undefined}
      style={{ width: '100%', height: '100%', minWidth: 0, minHeight: 0 }}
      renderLoading={() => (
        <div style={{ padding: 12 }}>
          Loading {lane.title} runtime…
        </div>
      )}
    />
  );
}
