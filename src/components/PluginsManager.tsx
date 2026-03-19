import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Blocks, FolderOpen, LoaderCircle, Puzzle, RefreshCw, TriangleAlert } from 'lucide-react';
import { pluginSystemConfig } from '../config/plugins';
import type { ResolvedOverlayAppearance } from '../config/appearance';
import type {
  LoadedOverlayPlugin,
  OverlayPluginApi,
  OverlayPluginContext,
  OverlayPluginHostContext,
} from './pluginRuntime';
import { OverlayScrollArea } from './OverlayScrollArea';

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

  return (
    <div style={{ display: 'flex', flex: 1, minHeight: 0, background: 'var(--overlay-bg-app)', color: TEXT, fontFamily: 'var(--overlay-font-ui)' }}>
      <aside
        style={{
          width: 280,
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
              const status = plugin.error ? 'Load error' : 'Top-bar tab';

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
                </button>
              );
            })
          )}
        </OverlayScrollArea>
      </aside>

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
              {selectedPlugin?.filePath ?? pluginSystemConfig.pluginsDirectory}
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
            <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: 16 }}>
              <EmptyPluginsState accent={accent} onOpenFolder={onOpenPluginsFolder} />
            </div>
          ) : (
            <FolderPluginRenderer
              plugin={selectedPlugin}
              appearance={appearance}
              createPluginApi={createPluginApi}
              hostMode="manager-preview"
            />
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
    />
  );
}

function FolderPluginHostFrame({
  plugin,
  appearance,
  createPluginApi,
  hostMode,
}: {
  plugin: LoadedOverlayPlugin;
  appearance?: ResolvedOverlayAppearance;
  createPluginApi: (plugin: OverlayPluginContext) => OverlayPluginApi;
  hostMode: FolderPluginHostMode;
}) {
  const PluginComponent = plugin.component;
  if (!PluginComponent) {
    return <PluginErrorPanel plugin={plugin} />;
  }
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [hostSize, setHostSize] = useState({ width: 0, height: 0 });
  const hostLayout = FOLDER_PLUGIN_HOST_LAYOUT[hostMode];

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

    syncHostSize();
    if (typeof ResizeObserver === 'undefined') {
      return;
    }
    const observer = new ResizeObserver(syncHostSize);
    observer.observe(hostElement);
    return () => observer.disconnect();
  }, []);

  const hostContext = buildPluginHostContext(hostMode, hostSize.width, hostSize.height);
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
          background: hostMode === 'panel-tab' ? 'transparent' : 'var(--overlay-bg-app)',
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
): OverlayPluginHostContext {
  const compact = width > 0 && width <= PLUGIN_HOST_COMPACT_WIDTH;
  return {
    mode,
    width,
    height,
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
      <div style={{ fontSize: 16, fontWeight: 700 }}>Drop-in plugins become tabs</div>
      <div style={{ fontSize: 12, color: MUTED, maxWidth: 520, lineHeight: 1.6 }}>
        Put a self-contained TSX file into `{pluginSystemConfig.pluginsDirectory}` and OverlayTerm will load it as a top-bar panel.
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
          background: 'color-mix(in srgb, var(--overlay-bg-app) 72%, black)',
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
