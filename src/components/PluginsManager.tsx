import React, { useEffect, useMemo, useRef, useState } from 'react';
import { convertFileSrc } from '@tauri-apps/api/core';
import {
  Blocks,
  Eye,
  File,
  FolderOpen,
  LoaderCircle,
  MonitorPlay,
  Power,
  PowerOff,
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
import { WorkbenchDisclosureGroup } from './WorkbenchDisclosureGroup';
import { ExplorerPreviewWorkflowTabControl } from './explorer/ExplorerPreviewWorkflowTabControl';
import {
  buildExplorerPreviewWorkflowTabs,
  mergeExplorerPreviewWildcardWorkflowTabs,
  resolveExplorerPreviewWorkflowActiveTab,
  type ExplorerPreviewWildcardWorkflowTab,
  type ExplorerPreviewWorkflowTab,
} from './explorer/explorerPreviewWorkflowTabs';

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
  onSetPluginEnabled: (plugin: LoadedOverlayPlugin, enabled: boolean) => void;
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
  onSetPluginEnabled,
  createPluginApi,
}: PluginsManagerProps) {
  const accent = appearance?.theme.palette.accent ?? 'var(--overlay-accent)';
  const [selectedPluginId, setSelectedPluginId] = useState<string | null>(null);
  const [selectedSurface, setSelectedSurface] = useState<PluginManagerSurface>('workbench-preview');
  const [selectedPreviewLaneId, setSelectedPreviewLaneId] = useState<string | null>(null);
  const [sidebarWidth, setSidebarWidth] = usePersistentPanelSize('overlayterm-plugins-sidebar-width', 236, 190, 320);
  const [collapsedCategoryIds, setCollapsedCategoryIds] = useState<ReadonlySet<string>>(() => new Set());

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
  useEffect(() => {
    setSelectedPreviewLaneId(current => {
      if (current && selectedPluginPreviewLanes.some(lane => lane.id === current)) {
        return current;
      }
      return selectedPluginPreviewLanes[0]?.id ?? null;
    });
  }, [selectedPluginPreviewLanes]);
  const selectedPluginPreviewLane = useMemo(
    () => selectedPluginPreviewLanes.find(lane => lane.id === selectedPreviewLaneId)
      ?? selectedPluginPreviewLanes[0]
      ?? null,
    [selectedPluginPreviewLanes, selectedPreviewLaneId],
  );
  const selectedPluginCapabilityLabels = useMemo(
    () => (selectedPlugin ? getPluginCapabilityLabels(selectedPlugin) : []),
    [selectedPlugin],
  );
  const selectedTestFile = useMemo(
    () => resolvePreviewTestFile(selectedPlugin, selectedPluginPreviewLane ?? undefined),
    [selectedPlugin, selectedPluginPreviewLane],
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
  useEffect(() => {
    setCollapsedCategoryIds(current => {
      const availableCategoryIds = new Set(groupedPlugins.map(group => group.category));
      let changed = false;
      const next = new Set<string>();
      current.forEach(category => {
        if (availableCategoryIds.has(category)) {
          next.add(category);
        } else {
          changed = true;
        }
      });
      return changed ? next : current;
    });
  }, [groupedPlugins]);

  const toggleCategoryCollapsed = (category: string) => {
    setCollapsedCategoryIds(current => {
      const next = new Set(current);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

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
        minSize={190}
        maxSize={320}
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
        <div style={{ padding: '10px 12px', borderBottom: `1px solid ${BORDER}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={iconTileStyle(accent)}>
              <Puzzle size={12} style={{ color: accent }} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700, lineHeight: 1, color: TEXT }}>Plugins</div>
              <div style={{ marginTop: 4, fontSize: 10, lineHeight: 1.2, color: MUTED }}>
                {plugins.length} packages • {totalPreviewLaneCount} previews • {totalTags} tags
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 9 }}>
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

        <OverlayScrollArea style={{ flex: 1, minHeight: 0 }} viewportStyle={{ padding: '7px 8px 10px 8px' }} scrollbarStyle="themed">
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
              <PluginRailGroup
                key={group.category}
                group={group}
                accent={accent}
                collapsed={collapsedCategoryIds.has(group.category)}
                selectedPluginId={selectedPluginId}
                onToggleCollapsed={() => toggleCategoryCollapsed(group.category)}
                onSelectPlugin={setSelectedPluginId}
                onSetPluginEnabled={onSetPluginEnabled}
              />
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
              <>
                <PluginEnablementSwitch
                  plugin={selectedPlugin}
                  accent={accent}
                  onSetPluginEnabled={onSetPluginEnabled}
                />
                <SurfaceSegmentedControl
                  accent={accent}
                  surface={effectiveSurface}
                  previewEnabled={selectedPluginPreviewLanes.length > 0}
                  onSurfaceChange={setSelectedSurface}
                />
              </>
            ) : null}
          </div>
        </div>

        {error ? (
          <div style={{ padding: '6px 10px', fontSize: 10, color: 'var(--overlay-danger)', borderBottom: `1px solid ${BORDER}`, background: 'color-mix(in srgb, var(--overlay-danger) 18%, transparent)' }}>
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
          <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 286px', gap: 0 }}>
            <section style={{ minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
              <div style={surfaceToolbarStyle}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <PluginBadge
                    label={
                      selectedPlugin.enabled === false
                        ? 'Disabled'
                        : selectedPlugin.error
                          ? 'Load error'
                          : selectedPlugin.component
                            ? 'Panel ready'
                            : 'Metadata only'
                    }
                    accent={
                      selectedPlugin.enabled === false
                        ? MUTED
                        : selectedPlugin.error
                          ? 'var(--overlay-warning)'
                          : accent
                    }
                  />
                  {selectedPluginCapabilityLabels.map(label => (
                    <PluginBadge key={`${selectedPlugin.id}-${label}`} label={label} accent={accent} />
                  ))}
                </div>
                {effectiveSurface === 'workbench-preview' ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    {selectedPluginPreviewLanes.length > 1 ? (
                      <PreviewLaneSegmentedControl
                        lanes={selectedPluginPreviewLanes}
                        selectedLaneId={selectedPluginPreviewLane?.id ?? null}
                        accent={accent}
                        onLaneChange={setSelectedPreviewLaneId}
                      />
                    ) : null}
                    {selectedTestFile ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: MUTED, fontSize: 10 }}>
                        <File size={12} />
                        {selectedTestFile.label}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>

              <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
                {effectiveSurface === 'workbench-preview' ? (
                  <PluginWorkbenchPreviewTestHost
                    plugin={selectedPlugin}
                    lane={selectedPluginPreviewLane}
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
              onSetPluginEnabled={onSetPluginEnabled}
            />
          </div>
        )}
      </main>
    </div>
  );
}

function PluginRailGroup({
  group,
  accent,
  collapsed,
  selectedPluginId,
  onToggleCollapsed,
  onSelectPlugin,
  onSetPluginEnabled,
}: {
  group: ReturnType<typeof groupPluginsByCategory>[number];
  accent: string;
  collapsed: boolean;
  selectedPluginId: string | null;
  onToggleCollapsed: () => void;
  onSelectPlugin: (pluginId: string) => void;
  onSetPluginEnabled: (plugin: LoadedOverlayPlugin, enabled: boolean) => void;
}) {
  return (
    <div data-plugin-rail-category={group.category}>
      <WorkbenchDisclosureGroup
        label={group.category}
        count={group.plugins.length}
        ariaLabel={`${group.category} ${group.plugins.length} plugin${group.plugins.length === 1 ? '' : 's'}`}
        collapsed={collapsed}
        onToggleCollapsed={onToggleCollapsed}
        variant="rail"
        mutedColor={MUTED}
      >
        <div style={{ display: 'grid', gap: 4 }}>
          {group.plugins.map(plugin => (
            <PluginRailItem
              key={`${plugin.id}-${plugin.modified}`}
              plugin={plugin}
              accent={accent}
              selected={plugin.id === selectedPluginId}
              onSelect={() => onSelectPlugin(plugin.id)}
              onSetPluginEnabled={onSetPluginEnabled}
            />
          ))}
        </div>
      </WorkbenchDisclosureGroup>
    </div>
  );
}

function PluginRailItem({
  plugin,
  accent,
  selected,
  onSelect,
  onSetPluginEnabled,
}: {
  plugin: LoadedOverlayPlugin;
  accent: string;
  selected: boolean;
  onSelect: () => void;
  onSetPluginEnabled: (plugin: LoadedOverlayPlugin, enabled: boolean) => void;
}) {
  const enabled = plugin.enabled !== false;
  const capabilityLabels = getPluginCapabilityLabels(plugin);
  const tags = getPluginTags(plugin);
  const summaryParts = [
    enabled ? 'Enabled' : 'Disabled',
    getPluginSourceSummary(plugin),
    ...capabilityLabels.slice(0, 2),
    ...tags.slice(0, 2),
  ];
  if (plugin.diagnostics.warnings.length > 0) {
    summaryParts.push(`${plugin.diagnostics.warnings.length} warning${plugin.diagnostics.warnings.length === 1 ? '' : 's'}`);
  }
  return (
    <div
      style={{
        width: '100%',
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) 28px',
        alignItems: 'stretch',
        gap: 5,
        padding: 3,
        borderRadius: 7,
        border: `1px solid ${selected ? `${accent}88` : BORDER}`,
        background: selected
          ? 'var(--overlay-workbench-chrome-button-active-bg)'
          : PANEL_ALT,
        color: TEXT,
        boxShadow: selected ? `inset 2px 0 0 ${accent}, inset 0 0 0 1px ${accent}22` : 'none',
        opacity: enabled ? 1 : 0.68,
      }}
    >
      <button
        type="button"
        aria-label={`${plugin.name} ${enabled ? 'Enabled' : 'Disabled'} ${plugin.error ? 'Load error' : getPluginSourceSummary(plugin)}`}
        onClick={onSelect}
        style={{
          minWidth: 0,
          border: 'none',
          background: 'transparent',
          color: 'inherit',
          padding: '3px 2px 3px 3px',
          textAlign: 'left',
          cursor: 'pointer',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        <div
          style={{
            width: 20,
            height: 20,
            borderRadius: 5,
            border: `1px solid ${selected ? `${accent}55` : 'var(--overlay-workbench-settings-badge-border)'}`,
            background: selected ? 'var(--overlay-workbench-chrome-button-active-bg)' : 'var(--overlay-workbench-settings-badge-bg)',
            color: selected ? accent : MUTED,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Puzzle size={11} />
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ minWidth: 0, display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ minWidth: 0, flex: 1, fontSize: 10, fontWeight: 750, letterSpacing: '0.08em', textTransform: 'uppercase', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {plugin.name}
            </div>
            {plugin.error ? <TriangleAlert size={12} style={{ color: 'var(--overlay-warning)', flexShrink: 0 }} /> : null}
          </div>
          <div style={{ marginTop: 1, fontSize: 9, lineHeight: 1.35, color: selected ? accent : MUTED, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {summaryParts.join(' • ')}
          </div>
        </div>
        </div>
      </button>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-label={`${enabled ? 'Disable' : 'Enable'} ${plugin.name}`}
        title={`${enabled ? 'Disable' : 'Enable'} ${plugin.name}`}
        onClick={(event) => {
          event.stopPropagation();
          onSetPluginEnabled(plugin, !enabled);
        }}
        style={pluginEnablementIconButtonStyle(accent, enabled)}
      >
        {enabled ? <Power size={12} /> : <PowerOff size={12} />}
      </button>
    </div>
  );
}

function PluginEnablementSwitch({
  plugin,
  accent,
  onSetPluginEnabled,
}: {
  plugin: LoadedOverlayPlugin;
  accent: string;
  onSetPluginEnabled: (plugin: LoadedOverlayPlugin, enabled: boolean) => void;
}) {
  const enabled = plugin.enabled !== false;
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      aria-label={`${enabled ? 'Disable' : 'Enable'} ${plugin.name}`}
      title={`${enabled ? 'Disable' : 'Enable'} ${plugin.name}`}
      onClick={() => onSetPluginEnabled(plugin, !enabled)}
      style={pluginEnablementSwitchStyle(accent, enabled)}
    >
      {enabled ? <Power size={13} /> : <PowerOff size={13} />}
      {enabled ? 'Enabled' : 'Disabled'}
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

function PreviewLaneSegmentedControl({
  lanes,
  selectedLaneId,
  accent,
  onLaneChange,
}: {
  lanes: readonly OverlayPluginPreviewLaneContribution[];
  selectedLaneId: string | null;
  accent: string;
  onLaneChange: (laneId: string) => void;
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
      {lanes.map(lane => (
        <button
          key={lane.id}
          type="button"
          aria-pressed={lane.id === selectedLaneId}
          onClick={() => onLaneChange(lane.id)}
          style={segmentButtonStyle(accent, lane.id === selectedLaneId)}
        >
          {lane.title}
        </button>
      ))}
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
  const [viewMode, setViewMode] = useState<'preview' | 'edit'>('preview');
  const [workflowTabId, setWorkflowTabId] = useState('preview');
  const [registeredWildcardTabs, setRegisteredWildcardTabs] = useState<
    ExplorerPreviewWildcardWorkflowTab[]
  >([]);
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

  useEffect(() => {
    setViewMode('preview');
    setWorkflowTabId('preview');
    setRegisteredWildcardTabs([]);
  }, [lane?.id, testFile?.id]);

  const workflowTabs = useMemo(
    () => lane
      ? buildExplorerPreviewWorkflowTabs({
        includePreviewTab: lane.workbenchChrome.includePreviewTab,
        includeEditTab: lane.workbenchChrome.includeEditTab,
        wildcardTabs: mergeExplorerPreviewWildcardWorkflowTabs(
          lane.workbenchChrome.wildcardTabs,
          registeredWildcardTabs,
        ),
      })
      : [],
    [lane, registeredWildcardTabs],
  );
  const activeWorkflowTab = useMemo(
    () => resolveExplorerPreviewWorkflowActiveTab(workflowTabs, workflowTabId),
    [workflowTabId, workflowTabs],
  );
  useEffect(() => {
    if (workflowTabId !== activeWorkflowTab.id) {
      setWorkflowTabId(activeWorkflowTab.id);
    }
    if (viewMode !== activeWorkflowTab.baseMode) {
      setViewMode(activeWorkflowTab.baseMode);
    }
  }, [activeWorkflowTab.baseMode, activeWorkflowTab.id, viewMode, workflowTabId]);

  const handleWorkflowTabSelect = (tab: ExplorerPreviewWorkflowTab) => {
    setWorkflowTabId(tab.id);
    setViewMode(tab.baseMode);
  };
  const handleViewModeChange = (mode: 'preview' | 'edit') => {
    setViewMode(mode);
    setWorkflowTabId(current => (
      current === 'preview' || current === 'edit' ? mode : current
    ));
  };
  const handleRegisteredWorkflowTabsChange = (
    tabs: ExplorerPreviewWildcardWorkflowTab[] | null,
  ) => {
    setRegisteredWildcardTabs(tabs ?? []);
  };

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
      <div style={{ minWidth: 0, minHeight: 0, width: '100%', height: '100%', overflow: 'hidden', background: 'var(--overlay-bg-shell)', display: 'flex', flexDirection: 'column' }}>
        {workflowTabs.length > 1 ? (
          <div style={{ padding: '6px 8px', borderBottom: `1px solid ${BORDER}`, background: 'var(--overlay-explorer-preview-header-bg)' }}>
            <ExplorerPreviewWorkflowTabControl
              tabs={workflowTabs}
              activeTabId={activeWorkflowTab.id}
              onTabSelect={handleWorkflowTabSelect}
            />
          </div>
        ) : null}
        <div ref={hostRef} style={{ flex: 1, minWidth: 0, minHeight: 0, overflow: 'hidden' }}>
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
            viewMode={viewMode}
            workflowTabId={activeWorkflowTab.id}
            previewBackedByArchiveVirtual={false}
            onRegisterWorkflowTabs={handleRegisteredWorkflowTabsChange}
            onViewModeChange={handleViewModeChange}
          />
        </div>
      </div>
    </PluginErrorBoundary>
  );
}

function PluginInspector({
  plugin,
  previewLanes,
  accent,
  onSetPluginEnabled,
}: {
  plugin: LoadedOverlayPlugin;
  previewLanes: OverlayPluginPreviewLaneContribution[];
  accent: string;
  onSetPluginEnabled: (plugin: LoadedOverlayPlugin, enabled: boolean) => void;
}) {
  const [collapsedSectionIds, setCollapsedSectionIds] = useState<ReadonlySet<string>>(() => new Set());
  const toggleSectionCollapsed = (sectionId: string) => {
    setCollapsedSectionIds(current => {
      const next = new Set(current);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  };

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
      <OverlayScrollArea style={{ flex: 1, minHeight: 0 }} viewportStyle={{ padding: 10 }} scrollbarStyle="themed">
        <InspectorBlock
          id="lifecycle"
          title="Lifecycle"
          icon={<Power size={12} />}
          collapsed={collapsedSectionIds.has('lifecycle')}
          onToggleCollapsed={toggleSectionCollapsed}
        >
          <div style={{ display: 'grid', gap: 8 }}>
            <div style={inspectorMutedTextStyle}>
              Disabled plugins stay visible here, but their panels, commands, preview lanes, themes, settings slots, and package assets are not mounted into the shell.
            </div>
            <PluginEnablementSwitch
              plugin={plugin}
              accent={accent}
              onSetPluginEnabled={onSetPluginEnabled}
            />
          </div>
        </InspectorBlock>

        <InspectorBlock
          id="organization"
          title="Organization"
          icon={<Tags size={12} />}
          collapsed={collapsedSectionIds.has('organization')}
          onToggleCollapsed={toggleSectionCollapsed}
        >
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            <PluginBadge label={getPluginCategory(plugin)} accent={accent} />
            {getPluginTags(plugin).map(tag => (
              <PluginBadge key={`${plugin.id}-${tag}`} label={tag} accent="var(--overlay-text-muted)" />
            ))}
          </div>
        </InspectorBlock>

        <InspectorBlock
          id="preview-lanes"
          title="Preview Lanes"
          icon={<Eye size={12} />}
          collapsed={collapsedSectionIds.has('preview-lanes')}
          onToggleCollapsed={toggleSectionCollapsed}
        >
          {previewLanes.length === 0 ? (
            <div style={inspectorMutedTextStyle}>This plugin does not contribute a workbench preview lane.</div>
          ) : (
            <div style={{ display: 'grid', gap: 6 }}>
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

        <InspectorBlock
          id="test-files"
          title="Test Files"
          icon={<File size={12} />}
          collapsed={collapsedSectionIds.has('test-files')}
          onToggleCollapsed={toggleSectionCollapsed}
        >
          {getPluginTestFiles(plugin).length === 0 ? (
            <div style={inspectorMutedTextStyle}>No package fixtures declared.</div>
          ) : (
            <div style={{ display: 'grid', gap: 6 }}>
              {getPluginTestFiles(plugin).map(testFile => (
                <div key={testFile.id} style={inspectorRowStyle}>
                  <div style={{ fontWeight: 700 }}>{testFile.label}</div>
                  <div style={inspectorMutedTextStyle}>{testFile.path}</div>
                </div>
              ))}
            </div>
          )}
        </InspectorBlock>

        <InspectorBlock
          id="diagnostics"
          title="Diagnostics"
          icon={<Puzzle size={12} />}
          collapsed={collapsedSectionIds.has('diagnostics')}
          onToggleCollapsed={toggleSectionCollapsed}
        >
          <div style={inspectorMutedTextStyle}>Manifest: {plugin.diagnostics.manifestPath ?? 'none'}</div>
          {plugin.diagnostics.warnings.length > 0 ? (
            <div style={{ marginTop: 6, display: 'grid', gap: 6 }}>
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
  if (plugin.enabled === false) {
    return <PluginDisabledPanel plugin={plugin} />;
  }
  if (plugin.error || !PluginComponent) {
    return plugin.error
      ? <PluginErrorPanel plugin={plugin} />
      : <PluginMetadataOnlyPanel plugin={plugin} />;
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

function PluginDisabledPanel({ plugin }: { plugin: LoadedOverlayPlugin }) {
  return (
    <div
      style={{
        margin: 12,
        borderRadius: 8,
        border: `1px solid ${BORDER}`,
        background: PANEL_ALT,
        padding: 14,
        color: TEXT,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700 }}>
        <PowerOff size={15} style={{ color: MUTED }} />
        {plugin.name} is disabled
      </div>
      <div style={{ marginTop: 8, fontSize: 11, lineHeight: 1.5, color: MUTED }}>
        This package is present on disk but its runtime contributions are not loaded. Enable it from the plugin manager header or Lifecycle inspector when you want it back in the shell.
      </div>
    </div>
  );
}

function PluginMetadataOnlyPanel({ plugin }: { plugin: LoadedOverlayPlugin }) {
  return (
    <div
      style={{
        margin: 12,
        borderRadius: 8,
        border: `1px solid ${BORDER}`,
        background: PANEL_ALT,
        padding: 14,
        color: TEXT,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700 }}>
        <Puzzle size={15} style={{ color: MUTED }} />
        {plugin.name} has no panel entry
      </div>
      <div style={{ marginTop: 8, fontSize: 11, lineHeight: 1.5, color: MUTED }}>
        The package can still contribute non-panel capabilities such as preview lanes, commands, settings slots, or visual assets when enabled.
      </div>
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

function InspectorBlock({
  id,
  title,
  icon,
  collapsed,
  onToggleCollapsed,
  children,
}: {
  id: string;
  title: string;
  icon: React.ReactNode;
  collapsed: boolean;
  onToggleCollapsed: (id: string) => void;
  children: React.ReactNode;
}) {
  return (
    <WorkbenchDisclosureGroup
      label={title}
      leadingIcon={icon}
      ariaLabel={`${title} section`}
      collapsed={collapsed}
      onToggleCollapsed={() => onToggleCollapsed(id)}
      variant="panel"
      textColor={TEXT}
      mutedColor={MUTED}
      borderColor={BORDER}
      background="rgba(255,255,255,0.025)"
      sectionStyle={{ marginBottom: 8, borderRadius: 8 }}
      buttonStyle={inspectorHeaderButtonStyle}
      contentStyle={{ padding: '8px 10px 10px' }}
    >
      {children}
    </WorkbenchDisclosureGroup>
  );
}

function toolbarButton(accent: string, primary: boolean): React.CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 7,
    padding: '6px 8px',
    border: `1px solid ${primary ? accent : BORDER}`,
    background: primary ? `${accent}22` : 'var(--overlay-workbench-settings-badge-bg)',
    color: primary ? 'var(--overlay-accent-contrast)' : 'var(--overlay-text-secondary)',
    cursor: 'pointer',
    fontSize: 9,
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
    padding: '4px 7px',
    background: active ? `${accent}22` : 'transparent',
    color: active ? TEXT : MUTED,
    cursor: 'pointer',
    fontSize: 9,
    fontWeight: 750,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    opacity: active ? 1 : 0.8,
  };
}

function pluginEnablementSwitchStyle(
  accent: string,
  enabled: boolean,
): React.CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 27,
    borderRadius: 7,
    padding: '4px 8px',
    border: `1px solid ${enabled ? `${accent}88` : BORDER}`,
    background: enabled ? `${accent}22` : 'var(--overlay-workbench-settings-badge-bg)',
    color: enabled ? TEXT : MUTED,
    cursor: 'pointer',
    fontSize: 9,
    fontWeight: 800,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
  };
}

function pluginEnablementIconButtonStyle(
  accent: string,
  enabled: boolean,
): React.CSSProperties {
  return {
    width: 28,
    minWidth: 28,
    minHeight: 28,
    borderRadius: 6,
    border: `1px solid ${enabled ? `${accent}77` : BORDER}`,
    background: enabled ? `${accent}1f` : 'var(--overlay-workbench-settings-badge-bg)',
    color: enabled ? accent : MUTED,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
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
  if ((plugin.diagnostics.capabilities.mobilePanes ?? 0) > 0) {
    labels.push(`Mobile ${plugin.diagnostics.capabilities.mobilePanes}`);
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
      title={label}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        minWidth: 0,
        maxWidth: '100%',
        borderRadius: 5,
        border: `1px solid color-mix(in srgb, ${accent} 34%, transparent)`,
        background: `color-mix(in srgb, ${accent} 12%, transparent)`,
        color: TEXT,
        padding: '2px 5px',
        fontSize: 8,
        fontWeight: 750,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        lineHeight: 1,
      }}
    >
      <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {label}
      </span>
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

const headerPathStyle: React.CSSProperties = {
  marginTop: 3,
  fontSize: 10,
  color: MUTED,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const surfaceToolbarStyle: React.CSSProperties = {
  padding: '6px 10px',
  borderBottom: `1px solid ${BORDER}`,
  background: 'rgba(255,255,255,0.02)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 10,
};

const iconTileStyle = (accent: string): React.CSSProperties => ({
  width: 24,
  height: 24,
  borderRadius: 7,
  background: `${accent}1f`,
  border: `1px solid ${accent}66`,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
});

const inspectorMutedTextStyle: React.CSSProperties = {
  fontSize: 9,
  color: MUTED,
  lineHeight: 1.45,
  overflowWrap: 'anywhere',
};

const inspectorRowStyle: React.CSSProperties = {
  border: `1px solid ${BORDER}`,
  borderRadius: 7,
  padding: '6px 7px',
  background: 'rgba(255,255,255,0.025)',
  fontSize: 9,
  color: TEXT,
};

const inspectorHeaderButtonStyle: React.CSSProperties = {
  display: 'flex',
  width: '100%',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
  border: 0,
  borderBottom: `1px solid ${BORDER}`,
  background: 'transparent',
  color: TEXT,
  padding: '7px 8px',
  cursor: 'pointer',
  fontSize: 9,
  fontWeight: 750,
  textTransform: 'uppercase',
  letterSpacing: '0.12em',
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
