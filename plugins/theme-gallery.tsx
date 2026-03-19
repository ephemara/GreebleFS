import React, { useMemo, useState } from 'react';
import { definePlugin } from 'overlayterm-plugin';
import { Brush, Copy, Palette, Sparkles } from 'lucide-react';

type PluginProps = {
  plugin: {
    name: string;
    filePath: string;
  };
  appearance: {
    theme: {
      id: string;
      name: string;
      description?: string;
      palette?: Record<string, string>;
    };
    fonts?: {
      ui?: string;
      mono?: string;
    };
    cssVars?: Record<string, string>;
  };
  host?: {
    compact: boolean;
  };
};

function ThemeGallery({ plugin, appearance, host }: PluginProps) {
  const palette = appearance.theme.palette ?? {};
  const accent = palette.accent ?? '#7dd3fc';
  const textPrimary = palette.textPrimary ?? '#f8fafc';
  const textSecondary = palette.textSecondary ?? '#cbd5e1';
  const textMuted = palette.textMuted ?? '#94a3b8';
  const border = palette.border ?? 'rgba(148, 163, 184, 0.18)';
  const panelBackground = palette.panelBackground ?? 'rgba(15, 23, 42, 0.72)';
  const cardBackground = palette.cardBackground ?? 'rgba(15, 23, 42, 0.88)';
  const [copyStatus, setCopyStatus] = useState('Ready');

  const swatches = useMemo(() => {
    const primaryTokens = [
      ['Accent', palette.accent],
      ['Success', palette.success],
      ['Warning', palette.warning],
      ['Danger', palette.danger],
      ['Border', palette.border],
      ['Text Primary', palette.textPrimary],
      ['Text Muted', palette.textMuted],
      ['Panel', palette.panelBackground],
    ] as const;
    return primaryTokens.filter(([, value]) => Boolean(value));
  }, [palette.accent, palette.border, palette.danger, palette.panelBackground, palette.success, palette.textMuted, palette.textPrimary, palette.warning]);

  const cssVarEntries = useMemo(() => Object.entries(appearance.cssVars ?? {}).slice(0, 12), [appearance.cssVars]);

  async function copyThemeSnapshot() {
    const payload = {
      themeId: appearance.theme.id,
      themeName: appearance.theme.name,
      palette,
      fonts: appearance.fonts,
      cssVars: appearance.cssVars,
    };
    try {
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
      setCopyStatus('Theme snapshot copied.');
    } catch (error) {
      setCopyStatus(`Clipboard copy failed: ${String(error)}`);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, color: textPrimary, fontFamily: 'var(--overlay-font-ui)' }}>
      <section style={{ borderRadius: 18, border: `1px solid ${border}`, background: panelBackground, padding: 16, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ minWidth: 220 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${accent}1f`, border: `1px solid ${accent}66` }}>
                <Palette size={16} style={{ color: accent }} />
              </div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 800 }}>Theme Gallery</div>
                <div style={{ fontSize: 12, color: textMuted, marginTop: 2 }}>
                  A design-focused plugin sample for theme-aware interfaces.
                </div>
              </div>
            </div>
            <div style={{ marginTop: 10, fontSize: 11, color: textMuted, wordBreak: 'break-word' }}>
              {plugin.name} · {plugin.filePath}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={() => void copyThemeSnapshot()} style={toolbarButton(border, cardBackground, textSecondary)}>
              <Copy size={14} />
              Copy Theme Snapshot
            </button>
          </div>
        </div>

        <div style={{ marginTop: 12, fontSize: 12, color: textMuted, lineHeight: 1.6 }}>Theme status: {copyStatus}</div>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: host?.compact ? '1fr' : 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10 }}>
        {swatches.map(([label, value]) => (
          <div key={label} style={{ borderRadius: 16, border: `1px solid ${border}`, background: panelBackground, overflow: 'hidden' }}>
            <div style={{ height: 72, background: value ?? accent }} />
            <div style={{ padding: 12 }}>
              <div style={{ fontSize: 11, color: textMuted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</div>
              <div style={{ marginTop: 6, fontSize: 12, color: textSecondary, fontFamily: 'var(--overlay-font-mono)', wordBreak: 'break-word' }}>{value}</div>
            </div>
          </div>
        ))}
      </section>

      <section style={{ borderRadius: 18, border: `1px solid ${border}`, background: panelBackground, padding: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: host?.compact ? '1fr' : 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
          <div style={stackCardStyle(border, cardBackground)}>
            <div style={sectionTitleStyle(textMuted)}>Theme metadata</div>
            <div style={sectionBodyStyle(textSecondary)}>
              <div><strong>Name:</strong> {appearance.theme.name}</div>
              <div><strong>Id:</strong> {appearance.theme.id}</div>
              {appearance.theme.description && <div><strong>Description:</strong> {appearance.theme.description}</div>}
            </div>
          </div>
          <div style={stackCardStyle(border, cardBackground)}>
            <div style={sectionTitleStyle(textMuted)}>Fonts</div>
            <div style={sectionBodyStyle(textSecondary)}>
              <div><strong>UI:</strong> {appearance.fonts?.ui ?? 'var(--overlay-font-ui)'}</div>
              <div><strong>Mono:</strong> {appearance.fonts?.mono ?? 'var(--overlay-font-mono)'}</div>
            </div>
          </div>
        </div>

        <div style={{ marginTop: 12, display: 'grid', gap: 12 }}>
          <div style={demoSurfaceStyle(border, cardBackground, accent)}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Brush size={14} />
              <div style={{ fontWeight: 800 }}>Sample panel surface</div>
            </div>
            <div style={{ marginTop: 8, fontSize: 13, color: textSecondary, lineHeight: 1.6 }}>
              Theme-aware plugins should use the incoming appearance object and CSS variables rather than hardcoding colors.
            </div>
          </div>

          <div style={{ borderRadius: 14, border: `1px solid ${border}`, background: cardBackground, padding: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <Sparkles size={14} style={{ color: accent }} />
              <div style={{ fontSize: 13, fontWeight: 800 }}>Live CSS variables</div>
            </div>
            <div style={{ display: 'grid', gap: 8 }}>
              {cssVarEntries.length > 0 ? cssVarEntries.map(([name, value]) => (
                <div key={name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '8px 10px', borderRadius: 10, border: `1px solid ${border}`, background: 'rgba(255, 255, 255, 0.02)' }}>
                  <span style={{ fontSize: 12, color: textMuted, fontFamily: 'var(--overlay-font-mono)' }}>{name}</span>
                  <span style={{ fontSize: 12, color: textSecondary, fontFamily: 'var(--overlay-font-mono)' }}>{value}</span>
                </div>
              )) : (
                <div style={{ fontSize: 12, color: textMuted }}>No custom CSS variables were provided for this theme.</div>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function toolbarButton(border: string, background: string, textColor: string): React.CSSProperties {
  return { display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 10, border: `1px solid ${border}`, background, color: textColor, cursor: 'pointer', fontSize: 12, fontWeight: 700 };
}

function stackCardStyle(border: string, background: string): React.CSSProperties {
  return { borderRadius: 14, border: `1px solid ${border}`, background, padding: 12 };
}

function sectionTitleStyle(color: string): React.CSSProperties {
  return { fontSize: 11, color, textTransform: 'uppercase', letterSpacing: '0.08em' };
}

function sectionBodyStyle(color: string): React.CSSProperties {
  return { marginTop: 8, display: 'grid', gap: 6, fontSize: 12, color, lineHeight: 1.6 };
}

function demoSurfaceStyle(border: string, background: string, accent: string): React.CSSProperties {
  return { borderRadius: 14, border: `1px solid ${border}`, background, padding: 14, boxShadow: `inset 0 0 0 1px ${accent}14` };
}

export default definePlugin({
  id: 'theme-gallery',
  name: 'Theme Gallery',
  description: 'Theme-aware sample that previews the active palette and CSS variables.',
  defaultOpen: false,
  keepMounted: true,
  component: ThemeGallery,
});
