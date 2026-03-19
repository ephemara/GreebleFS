import React, { useMemo } from 'react';
import { Copy, FolderOpen, Info, Palette, RefreshCw, Layers3 } from 'lucide-react';
import { definePlugin } from 'overlayterm-plugin';

type ThemePalette = {
  accent?: string;
  accentContrast?: string;
  border?: string;
  cardBackground?: string;
  textPrimary?: string;
  textMuted?: string;
};

type OverlayAppearance = {
  theme: {
    name?: string;
    palette?: ThemePalette;
  };
  fonts: {
    ui: string;
    mono: string;
  };
};

type HostContext = {
  mode: 'panel-tab' | 'manager-preview';
  width: number;
  height: number;
  compact: boolean;
  density: 'compact' | 'regular';
} | undefined;

type PluginApi = {
  refreshPlugins: () => Promise<void>;
  openPluginsFolder: () => Promise<void>;
};

type PluginProps = {
  plugin: {
    id: string;
    name: string;
    filePath: string;
    pluginRoot: string;
    pluginDirectory: string;
    backendDirectory: string;
  };
  api: PluginApi;
  appearance: OverlayAppearance;
  host?: HostContext;
};

function statCard(label: string, value: string, accent: string) {
  return (
    <div
      style={{
        borderRadius: 16,
        border: '1px solid var(--overlay-border)',
        background: 'var(--overlay-bg-panel)',
        padding: 14,
        minHeight: 92,
      }}
    >
      <div style={{ fontSize: 11, color: 'var(--overlay-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        {label}
      </div>
      <div style={{ marginTop: 8, fontSize: 13, fontWeight: 700, color: accent, wordBreak: 'break-word', lineHeight: 1.45 }}>
        {value}
      </div>
    </div>
  );
}

function ThemeSwatch({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 10,
        padding: '10px 12px',
        borderRadius: 12,
        border: '1px solid var(--overlay-border)',
        background: 'var(--overlay-bg-card)',
      }}
    >
      <div>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--overlay-text-primary)' }}>{label}</div>
        <div style={{ marginTop: 3, fontSize: 11, color: 'var(--overlay-text-muted)' }}>{value}</div>
      </div>
      <div style={{ width: 24, height: 24, borderRadius: 999, background: accent, border: '1px solid rgba(255,255,255,0.18)' }} />
    </div>
  );
}

function copyText(text: string) {
  if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
    return Promise.reject(new Error('Clipboard API unavailable.'));
  }
  return navigator.clipboard.writeText(text);
}

function PlatformInspector({ plugin, api, appearance, host }: PluginProps) {
  const palette = appearance.theme.palette ?? {};
  const accent = palette.accent ?? 'var(--overlay-accent)';
  const text = palette.textPrimary ?? 'var(--overlay-text-primary)';
  const muted = palette.textMuted ?? 'var(--overlay-text-muted)';
  const border = palette.border ?? 'var(--overlay-border)';
  const panel = palette.cardBackground ?? 'var(--overlay-bg-panel)';

  const hostSummary = useMemo(() => {
    if (!host) {
      return 'Running in the default plugin host.';
    }

    return `${host.mode} · ${host.width} x ${host.height} · ${host.density}${host.compact ? ' · compact layout' : ''}`;
  }, [host]);

  const details = [
    { label: 'Plugin id', value: plugin.id },
    { label: 'Source file', value: plugin.filePath },
    { label: 'Plugin root', value: plugin.pluginRoot },
    { label: 'Plugin directory', value: plugin.pluginDirectory },
    { label: 'Backend directory', value: plugin.backendDirectory },
  ];

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        minHeight: '100%',
        color: text,
        fontFamily: 'var(--overlay-font-ui)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
          padding: 16,
          borderRadius: 18,
          border: `1px solid ${border}`,
          background: `linear-gradient(135deg, color-mix(in srgb, ${accent} 18%, transparent), ${panel})`,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 10,
                background: `${accent}22`,
                border: `1px solid ${accent}66`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Info size={16} style={{ color: accent }} />
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800 }}>{plugin.name}</div>
              <div style={{ fontSize: 12, color: muted, marginTop: 3 }}>{hostSummary}</div>
            </div>
          </div>
          <div style={{ marginTop: 10, fontSize: 12, color: muted, maxWidth: 760, lineHeight: 1.65 }}>
            This plugin is a portable reference panel. It shows how to read the host context, inspect the theme,
            and use safe actions like refresh, open folder, and clipboard copy without relying on native binaries.
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={() => void api.refreshPlugins()} style={toolbarButton(accent, false)}>
            <RefreshCw size={14} />
            Refresh
          </button>
          <button onClick={() => void api.openPluginsFolder()} style={toolbarButton(accent, true)}>
            <FolderOpen size={14} />
            Open Folder
          </button>
          <button
            onClick={() => void copyText(plugin.pluginDirectory)}
            style={toolbarButton(accent, false)}
            title="Copy the resolved plugin directory to your clipboard"
          >
            <Copy size={14} />
            Copy Path
          </button>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: host?.compact ? '1fr' : 'repeat(2, minmax(0, 1fr))',
          gap: 12,
        }}
      >
        {details.map(detail => (
          <div key={detail.label}>
            {statCard(detail.label, detail.value, accent)}
          </div>
        ))}
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: host?.compact ? '1fr' : 'repeat(2, minmax(0, 1fr))',
          gap: 12,
        }}
      >
        <ThemeSwatch label="Accent" value={String(palette.accent ?? 'theme accent')} accent={accent} />
        <ThemeSwatch label="Border" value={String(border)} accent={border} />
        <ThemeSwatch label="Text" value={String(text)} accent={text} />
        <ThemeSwatch label="Muted" value={String(muted)} accent={muted} />
      </div>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 10,
          padding: 14,
          borderRadius: 16,
          border: `1px solid ${border}`,
          background: 'var(--overlay-bg-panel)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: accent }}>
          <Layers3 size={14} />
          <span style={{ fontSize: 12, fontWeight: 700 }}>Portable plugin pattern</span>
        </div>
        <div style={{ fontSize: 12, color: muted, lineHeight: 1.6 }}>
          Keep plugin examples frontend-only first. If you need a backend helper later, ship per-platform entrypoints
          inside the plugin&apos;s `backend/` folder instead of assuming a single binary will run everywhere.
        </div>
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
    border: `1px solid ${primary ? accent : 'var(--overlay-border)'}`,
    background: primary ? `${accent}22` : 'var(--overlay-bg-card)',
    color: primary ? 'var(--overlay-accent-contrast)' : 'var(--overlay-text-secondary)',
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 600,
  };
}

export default definePlugin({
  id: 'platform-inspector',
  name: 'Platform Inspector',
  description: 'Portable reference plugin for host metadata, theme inspection, and safe cross-platform actions.',
  component: PlatformInspector,
});
