import React, { useEffect, useMemo, useRef, useState } from 'react';
import { convertFileSrc } from '@tauri-apps/api/core';
import {
  Blocks,
  Eye,
  File,
  FolderOpen,
  LoaderCircle,
  MonitorPlay,
  Puzzle,
  RefreshCw,
  Tags,
  TriangleAlert,
} from '@/components/AppIcons';
import { pluginSystemConfig } from '../config/plugins';
import type { ResolvedOverlayAppearance } from '../config/appearance';
import type { OverlayPluginPreviewLaneContribution } from '../config/pluginContributions';
import { useSettingsStore } from '../store/settingsStore';
import {
  createPluginPreviewRuntimeBridge,
  type LoadedOverlayPlugin,
  type OverlayPluginApi,
  type OverlayPluginContext,
  type OverlayPluginHostContext,
  type OverlayPluginPreviewHostContext,
  type OverlayPluginTestFile,
} from './pluginRuntime';
import { OverlayScrollArea } from './OverlayScrollArea';
import { ResizablePane, usePersistentPanelSize } from './ResizablePane';

const PANEL = 'var(--overlay-workbench-settings-card-bg)';
const PANEL_ALT = 'var(--overlay-workbench-settings-rail-bg)';
const BORDER = 'var(--overlay-workbench-settings-card-border)';
const MUTED = 'var(--overlay-text-muted)';
const TEXT = 'var(--overlay-text-primary)';

type FolderPluginHostMode = 'panel-tab' | 'manager-preview';
type PluginManagerSurface = 'workbench-preview' | 'panel-entry';

type FolderPluginHostLayout = {
  viewportPadding: number;
  maxWidth: number;
  framed: boolean;
};

const FOLDER_PLUGIN_HOST_LAYOUT: Record<FolderPluginHostMode, FolderPluginHostLayout> = {
  'panel-tab': {
    viewportPadding: 0,
    maxWidth: 0,
    framed: false,
  },
  'manager-preview': {
    viewportPadding: 0,
    maxWidth: 0,
    framed: false,
  },
};

const PLUGIN_HOST_COMPACT_WIDTH = 1040;
const PLUGIN_HOST_DENSE_WIDTH = 820;

export interface PluginsManagerProps {
  appearance?: ResolvedOverlayAppearance;
  plugins: LoadedOverlayPlugin[];
  previewLanes?: OverlayPluginPreviewLaneContribution[];
  isLoading: boolean;
  error: string | null;
  onRefreshPlugins: () => Promise<void> | void;
  onOpenPluginsFolder: () => Promise<void>;
  createPluginApi: (plugin: OverlayPluginContext) => OverlayPluginApi;
}

export interface FolderPluginRendererProps {
  plugin: LoadedOverlayPlugin;
  appearance?: ResolvedOverlayAppearance;
  createPluginApi: (plugin: OverlayPluginContext) => OverlayPluginApi;
  hostMode?: FolderPluginHostMode;
  isActive?: boolean;
}

export function PluginsManager({
  appearance,
  plugins,
  previewLanes = [],
  isLoading,
  error,
  onRefreshPlugins,
  onOpenPluginsFolder,
  createPluginApi,
}: PluginsManagerProps) {
  const accent = appearance?.theme.palette.accent ?? 'var(--overlay-accent)';
  const [selectedPluginId, setSelectedPluginId] = useState<string | null>(null);
  const [selectedSurface, setSelectedSurface] = useState<PluginManagerSurface>('workbench-preview');
  const [sidebarWidth, setSidebarWidth] = usePersistentPanelSize('overlayterm-plugins-sidebar-width', 270, 210, 340);

  useEffect(() => {
    setSelectedPluginId(current => {
      if (current && plugins.some(plugin => plugin.id === current)) {
        return current;
      }
      return plugins[0]?.id ?? null;
    });
  }, [plugins]);

  const selectedPlugin = useMemo(
    () => plugins.find(plugin => plugin.id === selectedPluginId) ?? null,
    [plugins, selectedPluginId],
  );
  const selectedPluginPreviewLanes = useMemo(
    () => selectedPlugin ? previewLanes.filter(lane => lane.pluginId === selectedPlugin.id) : [],
    [previewLanes, selectedPlugin],
  );
  const selectedPluginCapabilityLabels = useMemo(
    () => (selectedPlugin ? getPluginCapabilityLabels(selectedPlugin) : []),
    [selectedPlugin],
  );
  const selectedTestFile = useMemo(
    () => resolvePreviewTestFile(selectedPlugin, selectedPluginPreviewLanes[0]),
    [selectedPlugin, selectedPluginPreviewLanes],
  );
  const effectiveSurface: PluginManagerSurface =
    selectedSurface === 'workbench-preview' && selectedPluginPreviewLanes.length === 0
      ? 'panel-entry'
      : selectedSurface;
  const groupedPlugins = useMemo(() => groupPluginsByCategory(plugins), [plugins]);
  const totalPreviewLaneCount = previewLanes.length;
  const totalTags = useMemo(() => {
    const tags = new Set<string>();
    plugins.forEach(plugin => getPluginTags(plugin).forEach(tag => tags.add(tag)));
    return tags.size;
  }, [plugins]);

  return (
    <div
      style={{
        display: 'flex',
        flex: 1,
        minHeight: 0,
        minWidth: 0,
        gap: 'var(--overlay-workbench-panel-gap)',
        padding: 'var(--overlay-workbench-page-padding)',
        background: 'var(--overlay-workbench-settings-bg)',
        color: TEXT,
        fontFamily: 'var(--overlay-font-ui)',
      }}
    >
      <ResizablePane
        size={sidebarWidth}
        minSize={210}
        maxSize={340}
        onSizeChange={setSidebarWidth}
        borderColor={`${accent}55`}
        style={{
          border: `1px solid ${BORDER}`,
          borderRadius: 'var(--overlay-workbench-panel-radius)',
          background: PANEL_ALT,
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
          overflow: 'hidden',
        }}
      >
        <div style={{ padding: 12, borderBottom: `1px solid ${BORDER}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={iconTileStyle(accent)}>
              <Puzzle size={14} style={{ color: accent }} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: TEXT }}>Plugins</div>
              <div style={{ marginTop: 2, fontSize: 10, color: MUTED }}>
                {plugins.length} packages • {totalPreviewLaneCount} previews • {totalTags} tags
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 10 }}>
            <button onClick={() => void onRefreshPlugins()} style={toolbarButton(accent, false)}>
              <RefreshCw size={13} />
              Refresh
            </button>
            <button onClick={() => void onOpenPluginsFolder()} style={toolbarButton(accent, true)}>
              <FolderOpen size={13} />
              Folder
            </button>
          </div>
        </div>

        <OverlayScrollArea style={{ flex: 1, minHeight: 0 }} viewportStyle={{ padding: 8 }} scrollbarStyle="themed">
          {plugins.length === 0 && !isLoading ? (
            <div
              style={{
                padding: 12,
                borderRadius: 8,
                border: `1px dashed ${accent}55`,
                background: `${accent}0d`,
                color: MUTED,
                fontSize: 11,
                lineHeight: 1.5,
              }}
            >
              No plugins found in `{pluginSystemConfig.pluginsDirectory}` yet.
            </div>
          ) : (
            groupedPlugins.map(group => (
              <div key={group.category} style={{ marginBottom: 10 }}>
                <div style={railGroupHeaderStyle}>
                  <span>{group.category}</span>
                  <span>{group.plugins.length}</span>
                </div>
                <div style={{ display: 'grid', gap: 6 }}>
                  {group.plugins.map(plugin => (
                    <PluginRailItem
                      key={`${plugin.id}-${plugin.modified}`}
                      plugin={plugin}
                      accent={accent}
                      selected={plugin.id === selectedPluginId}
                      onSelect={() => setSelectedPluginId(plugin.id)}
                    />
                  ))}
                </div>
              </div>
            ))
          )}
        </OverlayScrollArea>
      </ResizablePane>

      <main
        style={{
          flex: 1,
          minWidth: 0,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          border: `1px solid ${BORDER}`,
          borderRadius: 'var(--overlay-workbench-panel-radius)',
          background: PANEL,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '10px 12px',
            borderBottom: `1px solid ${BORDER}`,
            background: PANEL_ALT,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <div style={{ fontSize: 14, fontWeight: 750, color: TEXT }}>
                {selectedPlugin?.name ?? 'Plugin Workspace'}
              </div>
              {selectedPlugin ? (
                <PluginBadge label={getPluginCategory(selectedPlugin)} accent={accent} />
              ) : null}
            </div>
            <div style={headerPathStyle}>
              {selectedPlugin ? `${getPluginSourceSummary(selectedPlugin)} • ${selectedPlugin.filePath}` : pluginSystemConfig.pluginsDirectory}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {isLoading ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: MUTED }}>
                <LoaderCircle size={13} className="animate-spin" />
                Loading
              </div>
            ) : null}
            {selectedPlugin ? (
              <SurfaceSegmentedControl
                accent={accent}
                surface={effectiveSurface}
                previewEnabled={selectedPluginPreviewLanes.length > 0}
                onSurfaceChange={setSelectedSurface}
              />
            ) : null}
          </div>
        </div>

        {error ? (
          <div style={{ padding: '8px 12px', fontSize: 11, color: 'var(--overlay-danger)', borderBottom: `1px solid ${BORDER}`, background: 'color-mix(in srgb, var(--overlay-danger) 18%, transparent)' }}>
            {error}
          </div>
        ) : null}

        {!selectedPlugin ? (
          <OverlayScrollArea
            style={{ flex: 1, minHeight: 0 }}
            viewportStyle={{ padding: 12 }}
            scrollbarStyle="themed"
          >
            <EmptyPluginsState accent={accent} onOpenFolder={onOpenPluginsFolder} />
          </OverlayScrollArea>
        ) : (
          <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 300px', gap: 0 }}>
            <section style={{ minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
              <div style={surfaceToolbarStyle}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <PluginBadge label={selectedPlugin.error ? 'Load error' : 'Panel ready'} accent={selectedPlugin.error ? 'var(--overlay-warning)' : accent} />
                  {selectedPluginCapabilityLabels.map(label => (
                    <PluginBadge key={`${selectedPlugin.id}-${label}`} label={label} accent={accent} />
                  ))}
                </div>
                {selectedTestFile && effectiveSurface === 'workbench-preview' ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: MUTED, fontSize: 10 }}>
                    <File size={12} />
                    {selectedTestFile.label}
                  </div>
                ) : null}
              </div>

              <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
                {effectiveSurface === 'workbench-preview' ? (
                  <PluginWorkbenchPreviewTestHost
                    plugin={selectedPlugin}
                    lane={selectedPluginPreviewLanes[0] ?? null}
                    testFile={selectedTestFile}
                    appearance={appearance}
                  />
                ) : (
                  <FolderPluginRenderer
                    plugin={selectedPlugin}
                    appearance={appearance}
                    createPluginApi={createPluginApi}
                    hostMode="manager-preview"
                  />
                )}
              </div>
            </section>

            <PluginInspector
              plugin={selectedPlugin}
              previewLanes={selectedPluginPreviewLanes}
              accent={accent}
            />
          </div>
        )}
      </main>
    </div>
  );
}

function PluginRailItem({
  plugin,
  accent,
  selected,
  onSelect,
}: {
  plugin: LoadedOverlayPlugin;
  accent: string;
  selected: boolean;
  onSelect: () => void;
}) {
  const capabilityLabels = getPluginCapabilityLabels(plugin).slice(0, 2);
  const tags = getPluginTags(plugin).slice(0, 3);
  return (
    <button
      type="button"
      aria-label={`${plugin.name} ${plugin.error ? 'Load error' : getPluginSourceSummary(plugin)}`}
      onClick={onSelect}
      style={{
        width: '100%',
        textAlign: 'left',
        padding: '9px 10px',
        borderRadius: 8,
        border: `1px solid ${selected ? `${accent}88` : BORDER}`,
        background: selected ? `${accent}17` : 'rgba(255,255,255,0.02)',
        color: TEXT,
        cursor: 'pointer',
        boxShadow: selected ? `inset 0 0 0 1px ${accent}22` : 'none',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ minWidth: 0, fontSize: 11, fontWeight: 750, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {plugin.name}
        </div>
        {plugin.error ? <TriangleAlert size={12} style={{ color: 'var(--overlay-warning)' }} /> : null}
      </div>
      <div style={{ marginTop: 4, fontSize: 10, color: MUTED }}>
        {getPluginSourceSummary(plugin)}
      </div>
      {(capabilityLabels.length > 0 || tags.length > 0 || plugin.diagnostics.warnings.length > 0) ? (
        <div style={{ marginTop: 7, display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          {capabilityLabels.map(label => (
            <PluginBadge key={`${plugin.id}-${label}`} label={label} accent={accent} />
          ))}
          {tags.map(tag => (
            <PluginBadge key={`${plugin.id}-${tag}`} label={tag} accent="var(--overlay-text-muted)" />
          ))}
          {plugin.diagnostics.warnings.length > 0 ? (
            <PluginBadge label={`${plugin.diagnostics.warnings.length} warning${plugin.diagnostics.warnings.length === 1 ? '' : 's'}`} accent="var(--overlay-warning)" />
          ) : null}
        </div>
      ) : null}
    </button>
  );
}

function SurfaceSegmentedControl({
  accent,
  surface,
  previewEnabled,
  onSurfaceChange,
}: {
  accent: string;
  surface: PluginManagerSurface;
  previewEnabled: boolean;
  onSurfaceChange: (surface: PluginManagerSurface) => void;
}) {
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 2,
        border: `1px solid ${BORDER}`,
        borderRadius: 8,
        background: 'var(--overlay-workbench-settings-badge-bg)',
        padding: 2,
      }}
    >
      <button
        type="button"
        disabled={!previewEnabled}
        onClick={() => onSurfaceChange('workbench-preview')}
        style={segmentButtonStyle(accent, surface === 'workbench-preview' && previewEnabled)}
      >
        <Eye size={12} />
        Preview
      </button>
      <button
        type="button"
        onClick={() => onSurfaceChange('panel-entry')}
        style={segmentButtonStyle(accent, surface === 'panel-entry' || !previewEnabled)}
      >
        <MonitorPlay size={12} />
        Panel
      </button>
    </div>
  );
}

function PluginWorkbenchPreviewTestHost({
  plugin,
  lane,
  testFile,
  appearance,
}: {
  plugin: LoadedOverlayPlugin;
  lane: OverlayPluginPreviewLaneContribution | null;
  testFile: OverlayPluginTestFile | null;
  appearance?: ResolvedOverlayAppearance;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [hostSize, setHostSize] = useState({ width: 0, height: 0 });
  const appZoom = useSettingsStore(state => state.settings.appearance.appZoom ?? 1);

  useEffect(() => {
    const hostElement = hostRef.current;
    if (!hostElement) {
      return;
    }
    const syncHostSize = () => {
      const nextWidth = Math.max(Math.round(hostElement.clientWidth), 0);
      const nextHeight = Math.max(Math.round(hostElement.clientHeight), 0);
      setHostSize(current => (
        current.width === nextWidth && current.height === nextHeight
          ? current
          : { width: nextWidth, height: nextHeight }
      ));
    };
    syncHostSize();
    if (typeof ResizeObserver === 'undefined') {
      return;
    }
    const observer = new ResizeObserver(syncHostSize);
    observer.observe(hostElement);
    return () => observer.disconnect();
  }, []);

  if (!lane || !testFile) {
    return (
      <div style={emptyPreviewStyle}>
        <Blocks size={30} style={{ color: MUTED }} />
        <div style={{ fontSize: 13, fontWeight: 700 }}>No preview test file is declared for this package.</div>
      </div>
    );
  }

  const PreviewComponent = lane.component;
  const fileName = getBaseName(testFile.path);
  const previewHost: OverlayPluginPreviewHostContext = {
    mode: 'preview-pane',
    width: hostSize.width,
    height: hostSize.height,
    zoom: appZoom,
    compact: hostSize.width > 0 && hostSize.width <= PLUGIN_HOST_COMPACT_WIDTH,
    density: hostSize.width > 0 && hostSize.width <= PLUGIN_HOST_DENSE_WIDTH ? 'compact' : 'regular',
  };

  return (
    <PluginErrorBoundary pluginName={`${plugin.name} preview`}>
      <div ref={hostRef} style={{ minWidth: 0, minHeight: 0, width: '100%', height: '100%', overflow: 'hidden', background: 'var(--overlay-bg-shell)' }}>
        <PreviewComponent
          lane={lane}
          file={{
            path: testFile.path,
            resolvedPath: testFile.path,
            name: fileName,
            extension: testFile.extension,
            size: 0,
            assetUrl: toFileAssetUrl(testFile.path),
            isDirectory: false,
          }}
          runtime={createPluginPreviewRuntimeBridge(lane.runtimeId, () => null)}
          appearance={getPluginAppearance(appearance)}
          host={previewHost}
          executionContext={null}
          viewMode="preview"
          workflowTabId="preview"
          previewBackedByArchiveVirtual={false}
        />
      </div>
    </PluginErrorBoundary>
  );
}

function PluginInspector({
  plugin,
  previewLanes,
  accent,
}: {
  plugin: LoadedOverlayPlugin;
  previewLanes: OverlayPluginPreviewLaneContribution[];
  accent: string;
}) {
  return (
    <aside
      style={{
        minWidth: 0,
        minHeight: 0,
        borderLeft: `1px solid ${BORDER}`,
        background: PANEL_ALT,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <OverlayScrollArea style={{ flex: 1, minHeight: 0 }} viewportStyle={{ padding: 12 }} scrollbarStyle="themed">
        <InspectorBlock title="Organization" icon={<Tags size={13} />}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            <PluginBadge label={getPluginCategory(plugin)} accent={accent} />
            {getPluginTags(plugin).map(tag => (
              <PluginBadge key={`${plugin.id}-${tag}`} label={tag} accent="var(--overlay-text-muted)" />
            ))}
          </div>
        </InspectorBlock>

        <InspectorBlock title="Preview Lanes" icon={<Eye size={13} />}>
          {previewLanes.length === 0 ? (
            <div style={inspectorMutedTextStyle}>This plugin does not contribute a workbench preview lane.</div>
          ) : (
            <div style={{ display: 'grid', gap: 8 }}>
              {previewLanes.map(lane => (
                <div key={lane.id} style={inspectorRowStyle}>
                  <div style={{ fontWeight: 700 }}>{lane.title}</div>
                  <div style={inspectorMutedTextStyle}>
                    {lane.match.extensions.length > 0 ? `.${lane.match.extensions.join(' .')}` : lane.match.appliesTo}
                  </div>
                </div>
              ))}
            </div>
          )}
        </InspectorBlock>

        <InspectorBlock title="Test Files" icon={<File size={13} />}>
          {getPluginTestFiles(plugin).length === 0 ? (
            <div style={inspectorMutedTextStyle}>No package fixtures declared.</div>
          ) : (
            <div style={{ display: 'grid', gap: 8 }}>
              {getPluginTestFiles(plugin).map(testFile => (
                <div key={testFile.id} style={inspectorRowStyle}>
                  <div style={{ fontWeight: 700 }}>{testFile.label}</div>
                  <div style={inspectorMutedTextStyle}>{testFile.path}</div>
                </div>
              ))}
            </div>
          )}
        </InspectorBlock>

        <InspectorBlock title="Diagnostics" icon={<Puzzle size={13} />}>
          <div style={inspectorMutedTextStyle}>Manifest: {plugin.diagnostics.manifestPath ?? 'none'}</div>
          {plugin.diagnostics.warnings.length > 0 ? (
            <div style={{ marginTop: 8, display: 'grid', gap: 6 }}>
              {plugin.diagnostics.warnings.map(warning => (
                <div key={`${plugin.id}-${warning}`} style={{ ...inspectorRowStyle, color: 'var(--overlay-warning)' }}>
                  {warning}
                </div>
              ))}
            </div>
          ) : null}
        </InspectorBlock>
      </OverlayScrollArea>
    </aside>
  );
}

export function FolderPluginRenderer({
  plugin,
  appearance,
  createPluginApi,
  hostMode = 'panel-tab',
  isActive = true,
}: FolderPluginRendererProps) {
  const PluginComponent = plugin.component;
  if (plugin.error || !PluginComponent) {
    return <PluginErrorPanel plugin={plugin} />;
  }

  return (
    <FolderPluginHostFrame
      plugin={plugin}
      appearance={appearance}
      createPluginApi={createPluginApi}
      hostMode={hostMode}
      isActive={isActive}
    />
  );
}

function FolderPluginHostFrame({
  plugin,
  appearance,
  createPluginApi,
  hostMode,
  isActive,
}: {
  plugin: LoadedOverlayPlugin;
  appearance?: ResolvedOverlayAppearance;
  createPluginApi: (plugin: OverlayPluginContext) => OverlayPluginApi;
  hostMode: FolderPluginHostMode;
  isActive: boolean;
}) {
  const PluginComponent = plugin.component;
  if (!PluginComponent) {
    return <PluginErrorPanel plugin={plugin} />;
  }
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [hostSize, setHostSize] = useState({ width: 0, height: 0 });
  const appZoom = useSettingsStore(state => state.settings.appearance.appZoom ?? 1);
  const hostLayout = FOLDER_PLUGIN_HOST_LAYOUT[hostMode];
  const syncHostSizeRef = useRef<() => void>(() => {});

  useEffect(() => {
    const hostElement = hostRef.current;
    if (!hostElement) {
      return;
    }

    const syncHostSize = () => {
      const nextWidth = Math.max(Math.round(hostElement.clientWidth), 0);
      const nextHeight = Math.max(Math.round(hostElement.clientHeight), 0);
      setHostSize(current => {
        if (current.width === nextWidth && current.height === nextHeight) {
          return current;
        }
        return { width: nextWidth, height: nextHeight };
      });
    };
    syncHostSizeRef.current = syncHostSize;

    syncHostSize();
    if (typeof ResizeObserver === 'undefined') {
      return;
    }
    const observer = new ResizeObserver(syncHostSize);
    observer.observe(hostElement);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isActive) {
      return;
    }
    const runSync = () => syncHostSizeRef.current();
    const firstFrame = window.requestAnimationFrame(() => {
      runSync();
      window.requestAnimationFrame(runSync);
    });
    return () => window.cancelAnimationFrame(firstFrame);
  }, [appZoom, isActive, hostMode]);

  const hostContext = buildPluginHostContext(hostMode, hostSize.width, hostSize.height, appZoom);
  const hostStyle = {
    '--overlay-plugin-host-width': `${hostContext.width}px`,
    '--overlay-plugin-host-height': `${hostContext.height}px`,
    '--overlay-plugin-host-padding': `${hostLayout.viewportPadding}px`,
  } as React.CSSProperties;
  const pluginElement = (
    <PluginComponent
      plugin={plugin}
      api={createPluginApi(plugin)}
      host={hostContext}
      appearance={getPluginAppearance(appearance)}
    />
  );

  return (
    <PluginErrorBoundary pluginName={plugin.name}>
      <div
        ref={hostRef}
        data-overlay-plugin-host
        data-overlay-plugin-mode={hostMode}
        style={{
          ...hostStyle,
          display: 'flex',
          flex: 1,
          minWidth: 0,
          minHeight: 0,
          overflow: 'hidden',
          background: hostMode === 'panel-tab' ? 'transparent' : 'var(--overlay-bg-shell)',
        }}
      >
        {hostMode === 'panel-tab' ? (
          <div style={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', overflow: 'hidden' }}>
            {pluginElement}
          </div>
        ) : (
          <div
            style={{
              width: '100%',
              maxWidth: hostLayout.maxWidth || 'none',
              minWidth: 0,
              minHeight: 0,
              display: 'flex',
              flex: 1,
              flexDirection: 'column',
              overflow: 'hidden',
              borderRadius: hostLayout.framed ? 8 : 0,
              border: hostLayout.framed ? `1px solid ${BORDER}` : 'none',
              background: hostLayout.framed ? PANEL_ALT : 'transparent',
            }}
          >
            {pluginElement}
          </div>
        )}
      </div>
    </PluginErrorBoundary>
  );
}

function buildPluginHostContext(
  mode: FolderPluginHostMode,
  width: number,
  height: number,
  zoom: number,
): OverlayPluginHostContext {
  const compact = width > 0 && width <= PLUGIN_HOST_COMPACT_WIDTH;
  return {
    mode,
    width,
    height,
    zoom,
    compact,
    density: width > 0 && width <= PLUGIN_HOST_DENSE_WIDTH ? 'compact' : 'regular',
  };
}

function getPluginAppearance(appearance?: ResolvedOverlayAppearance) {
  return {
    theme: appearance?.theme ?? ({
      id: 'operator',
      name: 'Operator',
      palette: {} as never,
      effects: {} as never,
      xterm: {} as never,
    }),
    fonts: appearance?.fonts ?? {
      ui: 'var(--overlay-font-ui)',
      mono: 'var(--overlay-font-mono)',
    },
    cssVars: appearance?.cssVars ?? {},
  };
}

function EmptyPluginsState({ accent, onOpenFolder }: { accent: string; onOpenFolder: () => Promise<void> }) {
  return (
    <div
      style={{
        minHeight: 220,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        borderRadius: 8,
        border: `1px dashed ${accent}55`,
        background: `${accent}0d`,
        color: TEXT,
        textAlign: 'center',
        padding: 20,
      }}
    >
      <Blocks size={30} style={{ color: accent }} />
      <div style={{ fontSize: 14, fontWeight: 700 }}>Drop-in files and package plugins become tabs</div>
      <div style={{ fontSize: 11, color: MUTED, maxWidth: 520, lineHeight: 1.55 }}>
        Put a self-contained TSX file into `{pluginSystemConfig.pluginsDirectory}` for a lightweight plugin, or drop in a
        package folder with a manifest, bundled entrypoint, preview lanes, tags, test files, and assets.
      </div>
      <button onClick={() => void onOpenFolder()} style={toolbarButton(accent, true)}>
        <FolderOpen size={13} />
        Open Plugins Folder
      </button>
    </div>
  );
}

function PluginErrorPanel({ plugin }: { plugin: LoadedOverlayPlugin }) {
  return (
    <div
      style={{
        margin: 12,
        borderRadius: 8,
        border: '1px solid color-mix(in srgb, var(--overlay-warning) 45%, transparent)',
        background: 'color-mix(in srgb, var(--overlay-warning) 14%, transparent)',
        padding: 14,
        color: TEXT,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700 }}>
        <TriangleAlert size={15} style={{ color: 'var(--overlay-warning)' }} />
        {plugin.name} failed to load
      </div>
      <pre style={errorPreStyle}>{plugin.error}</pre>
      <div style={{ marginTop: 10, fontSize: 11, color: MUTED }}>
        Imports are intentionally restricted to React, `lucide-react`, selected Tauri modules, `greeblefs-workbenches`, and `overlayterm-plugin`.
      </div>
    </div>
  );
}

function InspectorBlock({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 10, border: `1px solid ${BORDER}`, borderRadius: 8, background: 'rgba(255,255,255,0.025)', padding: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8, color: TEXT, fontSize: 10, fontWeight: 750, textTransform: 'uppercase', letterSpacing: '0.12em' }}>
        {icon}
        {title}
      </div>
      {children}
    </section>
  );
}

function toolbarButton(accent: string, primary: boolean): React.CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 8,
    padding: '7px 9px',
    border: `1px solid ${primary ? accent : BORDER}`,
    background: primary ? `${accent}22` : 'var(--overlay-workbench-settings-badge-bg)',
    color: primary ? 'var(--overlay-accent-contrast)' : 'var(--overlay-text-secondary)',
    cursor: 'pointer',
    fontSize: 10,
    fontWeight: 750,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
  };
}

function segmentButtonStyle(accent: string, active: boolean): React.CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    border: 0,
    borderRadius: 6,
    padding: '5px 8px',
    background: active ? `${accent}22` : 'transparent',
    color: active ? TEXT : MUTED,
    cursor: 'pointer',
    fontSize: 10,
    fontWeight: 750,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    opacity: active ? 1 : 0.8,
  };
}

function getPluginSourceSummary(plugin: LoadedOverlayPlugin): string {
  return plugin.diagnostics.sourceKind === 'package-plugin'
    ? `Package plugin • ${plugin.diagnostics.sourceLabel}`
    : 'File plugin';
}

function getPluginCapabilityLabels(plugin: LoadedOverlayPlugin): string[] {
  const labels: string[] = [];
  if (plugin.diagnostics.capabilities.themes > 0) {
    labels.push(`Themes ${plugin.diagnostics.capabilities.themes}`);
  }
  if (plugin.diagnostics.capabilities.shaders > 0) {
    labels.push(`Shaders ${plugin.diagnostics.capabilities.shaders}`);
  }
  if (plugin.diagnostics.capabilities.fonts > 0) {
    labels.push(`Fonts ${plugin.diagnostics.capabilities.fonts}`);
  }
  if (plugin.diagnostics.capabilities.commands > 0) {
    labels.push(`Commands ${plugin.diagnostics.capabilities.commands}`);
  }
  if (plugin.diagnostics.capabilities.explorerActions > 0) {
    labels.push(`Explorer ${plugin.diagnostics.capabilities.explorerActions}`);
  }
  if (plugin.diagnostics.capabilities.previewLanes > 0) {
    labels.push(`Preview ${plugin.diagnostics.capabilities.previewLanes}`);
  }
  if (plugin.diagnostics.capabilities.settingsSlots > 0) {
    labels.push(`Settings ${plugin.diagnostics.capabilities.settingsSlots}`);
  }
  return labels;
}

function PluginBadge({ label, accent }: { label: string; accent: string }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        borderRadius: 5,
        border: `1px solid color-mix(in srgb, ${accent} 34%, transparent)`,
        background: `color-mix(in srgb, ${accent} 12%, transparent)`,
        color: TEXT,
        padding: '3px 6px',
        fontSize: 9,
        fontWeight: 750,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        lineHeight: 1,
      }}
    >
      {label}
    </span>
  );
}

class PluginErrorBoundary extends React.Component<
  { children: React.ReactNode; pluginName: string },
  { error: string | null }
> {
  constructor(props: { children: React.ReactNode; pluginName: string }) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: unknown) {
    return { error: String(error) };
  }

  override componentDidUpdate(prevProps: { pluginName: string }) {
    if (prevProps.pluginName !== this.props.pluginName && this.state.error) {
      this.setState({ error: null });
    }
  }

  override render() {
    if (!this.state.error) {
      return this.props.children;
    }

    return (
      <div
        style={{
          margin: 12,
          borderRadius: 8,
          border: '1px solid color-mix(in srgb, var(--overlay-danger) 38%, transparent)',
          background: 'color-mix(in srgb, var(--overlay-danger) 16%, transparent)',
          padding: 14,
          color: TEXT,
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 700 }}>
          {this.props.pluginName} threw while rendering
        </div>
        <pre style={{ ...errorPreStyle, color: 'var(--overlay-danger)' }}>
          {this.state.error}
        </pre>
      </div>
    );
  }
}

function groupPluginsByCategory(plugins: LoadedOverlayPlugin[]) {
  const groups = new Map<string, LoadedOverlayPlugin[]>();
  plugins.forEach(plugin => {
    const category = getPluginCategory(plugin);
    groups.set(category, [...(groups.get(category) ?? []), plugin]);
  });

  return [...groups.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([category, entries]) => ({
      category,
      plugins: entries.sort((left, right) => left.name.localeCompare(right.name)),
    }));
}

function resolvePreviewTestFile(
  plugin: LoadedOverlayPlugin | null,
  lane: OverlayPluginPreviewLaneContribution | undefined,
): OverlayPluginTestFile | null {
  if (!plugin || !lane) {
    return null;
  }

  const normalizedExtensions = new Set(lane.match.extensions.map(extension => extension.toLowerCase()));
  const testFiles = getPluginTestFiles(plugin);
  return testFiles.find(testFile => normalizedExtensions.has(testFile.extension.toLowerCase()))
    ?? testFiles[0]
    ?? null;
}

function getPluginCategory(plugin: LoadedOverlayPlugin): string {
  return plugin.diagnostics.category || 'General';
}

function getPluginTags(plugin: LoadedOverlayPlugin): string[] {
  return plugin.diagnostics.tags ?? [];
}

function getPluginTestFiles(plugin: LoadedOverlayPlugin): OverlayPluginTestFile[] {
  return plugin.diagnostics.testFiles ?? [];
}

function getBaseName(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/');
  return normalized.slice(normalized.lastIndexOf('/') + 1);
}

function toFileAssetUrl(filePath: string): string {
  try {
    return convertFileSrc(filePath);
  } catch {
    const normalized = filePath.replace(/\\/g, '/');
    return normalized.startsWith('/') ? `file://${encodeURI(normalized)}` : `file:///${encodeURI(normalized)}`;
  }
}

const railGroupHeaderStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 8,
  padding: '4px 4px 6px',
  fontSize: 9,
  color: MUTED,
  textTransform: 'uppercase',
  letterSpacing: '0.12em',
};

const headerPathStyle: React.CSSProperties = {
  marginTop: 3,
  fontSize: 10,
  color: MUTED,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const surfaceToolbarStyle: React.CSSProperties = {
  padding: '8px 10px',
  borderBottom: `1px solid ${BORDER}`,
  background: 'rgba(255,255,255,0.02)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 10,
};

const iconTileStyle = (accent: string): React.CSSProperties => ({
  width: 26,
  height: 26,
  borderRadius: 7,
  background: `${accent}1f`,
  border: `1px solid ${accent}66`,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
});

const inspectorMutedTextStyle: React.CSSProperties = {
  fontSize: 10,
  color: MUTED,
  lineHeight: 1.45,
  overflowWrap: 'anywhere',
};

const inspectorRowStyle: React.CSSProperties = {
  border: `1px solid ${BORDER}`,
  borderRadius: 7,
  padding: 8,
  background: 'rgba(255,255,255,0.025)',
  fontSize: 10,
  color: TEXT,
};

const emptyPreviewStyle: React.CSSProperties = {
  minWidth: 0,
  minHeight: 0,
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 10,
  color: MUTED,
  textAlign: 'center',
};

const errorPreStyle: React.CSSProperties = {
  marginTop: 10,
  padding: 10,
  borderRadius: 7,
  background: 'color-mix(in srgb, var(--overlay-bg-shell) 72%, black)',
  color: 'var(--overlay-warning)',
  whiteSpace: 'pre-wrap',
  fontSize: 11,
  lineHeight: 1.45,
  border: '1px solid rgba(245,158,11,0.2)',
};

export default PluginsManager;
