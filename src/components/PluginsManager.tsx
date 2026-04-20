import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Blocks, FolderOpen, LoaderCircle, Puzzle, RefreshCw, TriangleAlert } from 'lucide-react';
import { pluginSystemConfig } from '../config/plugins';
import type { ResolvedOverlayAppearance } from '../config/appearance';
import { useSettingsStore } from '../store/settingsStore';
import type {
  LoadedOverlayPlugin,
  OverlayPluginApi,
  OverlayPluginContext,
  OverlayPluginHostContext,
} from './pluginRuntime';
import { OverlayScrollArea } from './OverlayScrollArea';
import { ResizablePane, usePersistentPanelSize } from './ResizablePane';

const PANEL = 'var(--overlay-bg-panel)';
const PANEL_ALT = 'var(--overlay-bg-panel-alt)';
const BORDER = 'var(--overlay-border)';
const MUTED = 'var(--overlay-text-muted)';
const TEXT = 'var(--overlay-text-primary)';

type FolderPluginHostMode = 'panel-tab' | 'manager-preview';

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
    viewportPadding: 16,
    maxWidth: 1760,
    framed: true,
  },
};

const PLUGIN_HOST_COMPACT_WIDTH = 1040;
const PLUGIN_HOST_DENSE_WIDTH = 820;

export interface PluginsManagerProps {
  appearance?: ResolvedOverlayAppearance;
  plugins: LoadedOverlayPlugin[];
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
  isLoading,
  error,
  onRefreshPlugins,
  onOpenPluginsFolder,
  createPluginApi,
}: PluginsManagerProps) {
  const accent = appearance?.theme.palette.accent ?? 'var(--overlay-accent)';
  const [selectedPluginId, setSelectedPluginId] = useState<string | null>(null);
  const [sidebarWidth, setSidebarWidth] = usePersistentPanelSize('overlayterm-plugins-sidebar-width', 280, 220, 420);

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
  const selectedPluginCapabilityLabels = useMemo(
    () => (selectedPlugin ? getPluginCapabilityLabels(selectedPlugin) : []),
    [selectedPlugin],
  );

  return (
    <div style={{ display: 'flex', flex: 1, minHeight: 0, background: 'var(--overlay-bg-shell)', color: TEXT, fontFamily: 'var(--overlay-font-ui)' }}>
      <ResizablePane
        size={sidebarWidth}
        minSize={220}
        maxSize={420}
        onSizeChange={setSidebarWidth}
        borderColor={`${accent}55`}
        style={{
          borderRight: `1px solid ${BORDER}`,
          background: PANEL,
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
        }}
      >
        <div style={{ padding: '14px 16px', borderBottom: `1px solid ${BORDER}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 8,
                background: `${accent}1f`,
                border: `1px solid ${accent}66`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Puzzle size={15} style={{ color: accent }} />
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: TEXT }}>Plugins</div>
              <div style={{ fontSize: 11, color: MUTED }}>Available plugins now become real top-bar tabs.</div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button onClick={() => void onRefreshPlugins()} style={toolbarButton(accent, false)}>
              <RefreshCw size={14} />
              Refresh
            </button>
            <button onClick={() => void onOpenPluginsFolder()} style={toolbarButton(accent, true)}>
              <FolderOpen size={14} />
              Open Folder
            </button>
          </div>
          <div style={{ marginTop: 8, fontSize: 11, color: MUTED }}>
            Manual refresh is the default path. Turn on Developer Mode in Settings only when you need live plugin hot reload.
          </div>
        </div>

        <OverlayScrollArea style={{ flex: 1, minHeight: 0 }} viewportStyle={{ padding: 10 }}>
          <div style={{ padding: '4px 8px 10px', fontSize: 11, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Available Plugins
          </div>

          {plugins.length === 0 && !isLoading ? (
            <div
              style={{
                padding: 14,
                borderRadius: 12,
                border: `1px dashed ${accent}55`,
                background: `${accent}0d`,
                color: MUTED,
                fontSize: 12,
                lineHeight: 1.55,
              }}
            >
              No plugins found in `{pluginSystemConfig.pluginsDirectory}` yet.
            </div>
          ) : (
            plugins.map(plugin => {
              const isSelected = plugin.id === selectedPluginId;
              const status = plugin.error ? 'Load error' : getPluginSourceSummary(plugin);
              const capabilityLabels = getPluginCapabilityLabels(plugin).slice(0, 2);

              return (
                <button
                  key={`${plugin.id}-${plugin.modified}`}
                  onClick={() => setSelectedPluginId(plugin.id)}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '12px 12px',
                    borderRadius: 12,
                    border: `1px solid ${isSelected ? `${accent}88` : BORDER}`,
                    background: isSelected ? `${accent}17` : 'transparent',
                    color: TEXT,
                    cursor: 'pointer',
                    marginBottom: 8,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <div style={{ fontSize: 12, fontWeight: 700 }}>{plugin.name}</div>
                    {plugin.error && <TriangleAlert size={13} style={{ color: '#f59e0b' }} />}
                  </div>
                  <div style={{ marginTop: 5, fontSize: 11, color: MUTED }}>
                    {status}
                  </div>
                  {(capabilityLabels.length > 0 || plugin.diagnostics.warnings.length > 0) && (
                    <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {capabilityLabels.map(label => (
                        <PluginBadge key={`${plugin.id}-${label}`} label={label} accent={accent} />
                      ))}
                      {plugin.diagnostics.warnings.length > 0 && (
                        <PluginBadge label={`${plugin.diagnostics.warnings.length} warning${plugin.diagnostics.warnings.length === 1 ? '' : 's'}`} accent="var(--overlay-warning)" />
                      )}
                    </div>
                  )}
                </button>
              );
            })
          )}
        </OverlayScrollArea>
      </ResizablePane>

      <main style={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <div
          style={{
            padding: '14px 16px',
            borderBottom: `1px solid ${BORDER}`,
            background: PANEL_ALT,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: TEXT }}>
              {selectedPlugin?.name ?? 'Plugin Workspace'}
            </div>
            <div style={{ fontSize: 11, color: MUTED, marginTop: 4 }}>
              {selectedPlugin ? `${getPluginSourceSummary(selectedPlugin)} • ${selectedPlugin.filePath}` : pluginSystemConfig.pluginsDirectory}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {isLoading && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: MUTED }}>
                <LoaderCircle size={14} className="animate-spin" />
                Loading plugins...
              </div>
            )}
          </div>
        </div>

        {error && (
          <div style={{ padding: '10px 16px', fontSize: 12, color: 'var(--overlay-danger)', borderBottom: `1px solid ${BORDER}`, background: 'color-mix(in srgb, var(--overlay-danger) 18%, transparent)' }}>
            {error}
          </div>
        )}

        <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {!selectedPlugin ? (
            <OverlayScrollArea
              style={{ flex: 1, minHeight: 0 }}
              viewportStyle={{ padding: 16 }}
              scrollbarStyle="themed"
            >
              <EmptyPluginsState accent={accent} onOpenFolder={onOpenPluginsFolder} />
            </OverlayScrollArea>
          ) : (
            <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '14px 16px', borderBottom: `1px solid ${BORDER}`, background: PANEL }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  <PluginBadge label={selectedPlugin.error ? 'Load error' : 'Panel ready'} accent={selectedPlugin.error ? 'var(--overlay-warning)' : accent} />
                  {selectedPluginCapabilityLabels.map(label => (
                    <PluginBadge key={`${selectedPlugin.id}-${label}`} label={label} accent={accent} />
                  ))}
                </div>
                {selectedPlugin.diagnostics.manifestPath && (
                  <div style={{ marginTop: 8, fontSize: 11, color: MUTED }}>
                    Manifest: {selectedPlugin.diagnostics.manifestPath}
                  </div>
                )}
                {selectedPlugin.diagnostics.warnings.length > 0 && (
                  <div
                    style={{
                      marginTop: 10,
                      borderRadius: 12,
                      border: '1px solid color-mix(in srgb, var(--overlay-warning) 45%, transparent)',
                      background: 'color-mix(in srgb, var(--overlay-warning) 14%, transparent)',
                      padding: 12,
                      fontSize: 11,
                      color: TEXT,
                    }}
                  >
                    <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--overlay-warning)' }}>
                      Package warnings
                    </div>
                    <div style={{ marginTop: 8, display: 'grid', gap: 6 }}>
                      {selectedPlugin.diagnostics.warnings.map(warning => (
                        <div key={`${selectedPlugin.id}-${warning}`}>{warning}</div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <FolderPluginRenderer
                  plugin={selectedPlugin}
                  appearance={appearance}
                  createPluginApi={createPluginApi}
                  hostMode="manager-preview"
                />
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
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
          <OverlayScrollArea
            style={{ flex: 1, minHeight: 0 }}
            viewportStyle={{ padding: hostLayout.viewportPadding }}
            contentStyle={{
              minHeight: '100%',
              display: 'flex',
              justifyContent: 'center',
            }}
          >
            <div
              style={{
                width: '100%',
                maxWidth: hostLayout.maxWidth,
                minWidth: 0,
                minHeight: '100%',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                borderRadius: hostLayout.framed ? 16 : 0,
                border: hostLayout.framed ? `1px solid ${BORDER}` : 'none',
                background: hostLayout.framed ? PANEL_ALT : 'transparent',
                boxShadow: hostLayout.framed ? '0 18px 48px rgba(0,0,0,0.22)' : 'none',
              }}
            >
              {pluginElement}
            </div>
          </OverlayScrollArea>
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
        minHeight: 280,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 14,
        borderRadius: 18,
        border: `1px dashed ${accent}55`,
        background: `${accent}0d`,
        color: TEXT,
        textAlign: 'center',
        padding: 24,
      }}
    >
      <Blocks size={34} style={{ color: accent }} />
      <div style={{ fontSize: 16, fontWeight: 700 }}>Drop-in files and package plugins become tabs</div>
      <div style={{ fontSize: 12, color: MUTED, maxWidth: 520, lineHeight: 1.6 }}>
        Put a self-contained TSX file into `{pluginSystemConfig.pluginsDirectory}` for a lightweight plugin, or drop in a
        package folder with a manifest, bundled entrypoint, themes, shaders, fonts, and assets.
        If a plugin needs its own native helper, place it in{' '}
        <code>{`${pluginSystemConfig.pluginsDirectory}/plugin-name/backend`}</code>.
      </div>
      <button onClick={() => void onOpenFolder()} style={toolbarButton(accent, true)}>
        <FolderOpen size={14} />
        Open Plugins Folder
      </button>
    </div>
  );
}

function PluginErrorPanel({ plugin }: { plugin: LoadedOverlayPlugin }) {
  return (
    <div
      style={{
        borderRadius: 18,
        border: '1px solid color-mix(in srgb, var(--overlay-warning) 45%, transparent)',
        background: 'color-mix(in srgb, var(--overlay-warning) 14%, transparent)',
        padding: 18,
        color: TEXT,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 15, fontWeight: 700 }}>
        <TriangleAlert size={16} style={{ color: 'var(--overlay-warning)' }} />
        {plugin.name} failed to load
      </div>
      <pre
        style={{
          marginTop: 12,
          padding: 12,
          borderRadius: 12,
          background: 'color-mix(in srgb, var(--overlay-bg-shell) 72%, black)',
          color: 'var(--overlay-warning)',
          whiteSpace: 'pre-wrap',
          fontSize: 12,
          lineHeight: 1.5,
          border: '1px solid rgba(245,158,11,0.2)',
        }}
      >
        {plugin.error}
      </pre>
      <div style={{ marginTop: 10, fontSize: 11, color: MUTED }}>
        Imports are intentionally restricted to React, `lucide-react`, selected Tauri modules, and `overlayterm-plugin`.
      </div>
    </div>
  );
}

function toolbarButton(accent: string, primary: boolean): React.CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    borderRadius: 10,
    padding: '8px 12px',
    border: `1px solid ${primary ? accent : BORDER}`,
    background: primary ? `${accent}22` : 'var(--overlay-bg-card)',
    color: primary ? 'var(--overlay-accent-contrast)' : 'var(--overlay-text-secondary)',
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 600,
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
  return labels;
}

function PluginBadge({ label, accent }: { label: string; accent: string }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        borderRadius: 999,
        border: `1px solid color-mix(in srgb, ${accent} 36%, transparent)`,
        background: `color-mix(in srgb, ${accent} 14%, transparent)`,
        color: TEXT,
        padding: '4px 8px',
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
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
          borderRadius: 18,
          border: '1px solid color-mix(in srgb, var(--overlay-danger) 38%, transparent)',
          background: 'color-mix(in srgb, var(--overlay-danger) 16%, transparent)',
          padding: 18,
          color: TEXT,
        }}
      >
        <div style={{ fontSize: 15, fontWeight: 700 }}>
          {this.props.pluginName} threw while rendering
        </div>
        <pre
          style={{
            marginTop: 12,
            padding: 12,
            borderRadius: 12,
            background: 'var(--overlay-bg-card-hover)',
            color: 'var(--overlay-danger)',
            whiteSpace: 'pre-wrap',
            fontSize: 12,
            lineHeight: 1.5,
          }}
        >
          {this.state.error}
        </pre>
      </div>
    );
  }
}

export default PluginsManager;
