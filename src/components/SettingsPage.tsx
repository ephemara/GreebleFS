import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { FolderOpen, LayoutGrid, Palette, Plus, RotateCcw, Search, Settings2, SlidersHorizontal, TerminalSquare, Trash2, Type } from 'lucide-react';
import {
  ensureFontFamilyLoaded,
  overlayFontCatalog,
  overlayThemePresets,
  parseImportedTheme,
  serializeTheme,
  upsertCustomTheme,
  type OverlayThemeDefinition,
  type ResolvedOverlayAppearance,
} from '../config/appearance';
import {
  createDefaultDirectoryBookmarks,
  detectClientPlatform,
  getExternalTerminalProfileOptions,
  type ExternalTerminalProfile,
} from '../config/platform';
import {
  createDefaultFolderIconRules,
  FOLDER_ICON_OPTIONS,
  getNamedFolderIconSrc,
  normalizeFolderIconMatcher,
  type FolderIconRule,
  type FolderIconValue,
} from '../config/folderIcons';
import {
  BUILT_IN_LAYOUT_MANIFEST,
  loadExternalLayoutManifest,
  resolveLayoutProfile,
  type LoadedLayoutManifest,
} from '../config/layoutProfiles';
import {
  clampOverlayAnimationDuration,
  clampOverlayAnimationIntensity,
  overlayAnimationPresets,
} from '../config/overlayAnimations';
import { useSettingsStore } from '../store/settingsStore';
import { useTerminalStore } from '../store/terminalStore';

function ColorToken({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="flex flex-col gap-1 rounded border border-white/8 bg-white/[0.03] p-2">
      <span className="text-[9px] font-semibold uppercase tracking-wide opacity-50">{label}</span>
      <div className="flex items-center gap-2">
        <input type="color" value={value} onChange={event => onChange(event.target.value)} className="h-7 w-9 rounded border-0 bg-transparent p-0" />
        <input
          value={value}
          onChange={event => onChange(event.target.value)}
          className="w-full bg-transparent text-[10px] outline-none"
        />
      </div>
    </label>
  );
}

function SectionTitle({ icon, title, subtitle }: { icon: ReactNode; title: string; subtitle: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] opacity-60">
          {icon}
          <span>{title}</span>
        </div>
        <p className="mt-1 text-[11px] opacity-40">{subtitle}</p>
      </div>
    </div>
  );
}

function RangeField({
  label,
  description,
  min,
  max,
  step,
  value,
  valueLabel,
  onChange,
}: {
  label: string;
  description: string;
  min: number;
  max: number;
  step: number;
  value: number;
  valueLabel: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="rounded border border-white/8 bg-white/[0.03] p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-60">{label}</div>
          <p className="mt-1 text-[11px] opacity-40">{description}</p>
        </div>
        <span className="rounded border border-white/10 bg-white/[0.04] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] opacity-80">
          {valueLabel}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={event => onChange(parseFloat(event.target.value))}
        className="mt-3 w-full cursor-pointer"
      />
    </label>
  );
}

function parseMatcherInput(value: string): string[] {
  return value
    .split(',')
    .map(part => normalizeFolderIconMatcher(part))
    .filter(Boolean);
}

function stringifyMatchers(matchers: string[]): string {
  return matchers.join(', ');
}

const DEFAULT_LOADED_LAYOUT_MANIFEST: LoadedLayoutManifest = {
  manifest: BUILT_IN_LAYOUT_MANIFEST,
  sourcePath: null,
  sourceType: 'built-in',
  sourceError: null,
};

export function SettingsPage({ appearance }: { appearance: ResolvedOverlayAppearance }) {
  const platform = useMemo(() => detectClientPlatform(), []);
  const settings = useSettingsStore(s => s.settings);
  const updateTerminal = useSettingsStore(s => s.updateTerminal);
  const updateExplorer = useSettingsStore(s => s.updateExplorer);
  const updateAppearance = useSettingsStore(s => s.updateAppearance);
  const updateLayout = useSettingsStore(s => s.updateLayout);
  const updateSystem = useSettingsStore(s => s.updateSystem);
  const resetToDefaults = useSettingsStore(s => s.resetToDefaults);
  const { directoryBookmarks, addDirectoryBookmark } = useTerminalStore();

  const profileOptions = useMemo(() => getExternalTerminalProfileOptions(platform), [platform]);
  const [themeDraft, setThemeDraft] = useState(() => serializeTheme(appearance.theme));
  const [folderIconSearch, setFolderIconSearch] = useState('');
  const [startupSyncPending, setStartupSyncPending] = useState(false);
  const [startupSyncError, setStartupSyncError] = useState<string | null>(null);
  const [layoutManifestState, setLayoutManifestState] = useState<LoadedLayoutManifest>(DEFAULT_LOADED_LAYOUT_MANIFEST);

  useEffect(() => {
    ensureFontFamilyLoaded(appearance.fonts.ui);
    ensureFontFamilyLoaded(settings.terminal.fontFamily);
  }, [appearance.fonts.ui, settings.terminal.fontFamily]);

  useEffect(() => {
    setThemeDraft(serializeTheme(appearance.theme));
  }, [appearance.theme]);

  useEffect(() => {
    let cancelled = false;

    loadExternalLayoutManifest(settings.layout.configPath)
      .then(result => {
        if (!cancelled) {
          setLayoutManifestState(result);
        }
      })
      .catch(error => {
        if (!cancelled) {
          console.warn('OverlayTerm: failed to load layout manifest in settings', error);
          setLayoutManifestState({
            ...DEFAULT_LOADED_LAYOUT_MANIFEST,
            sourceError: String(error),
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [settings.layout.configPath]);

  const persistTheme = useCallback((nextTheme: OverlayThemeDefinition) => {
    const builtinIds = new Set(overlayThemePresets.map(themeDef => themeDef.id));
    const needsCustomId = builtinIds.has(nextTheme.id);
    const customTheme = {
      ...nextTheme,
      id: needsCustomId ? `${nextTheme.id}-custom` : nextTheme.id,
      name: needsCustomId ? `${nextTheme.name} Custom` : nextTheme.name,
    };
    const nextCustomThemes = upsertCustomTheme(settings.appearance.customThemes, customTheme);
    updateAppearance({
      customThemes: nextCustomThemes,
      activeThemeId: customTheme.id,
    });
    setThemeDraft(serializeTheme(customTheme));
    return customTheme;
  }, [settings.appearance.customThemes, updateAppearance]);

  const updateThemePalette = useCallback((patch: Partial<OverlayThemeDefinition['palette']>) => {
    persistTheme({
      ...appearance.theme,
      palette: {
        ...appearance.theme.palette,
        ...patch,
      },
    });
  }, [appearance.theme, persistTheme]);

  const applyThemeDraft = useCallback(() => {
    try {
      const importedTheme = parseImportedTheme(themeDraft);
      persistTheme(importedTheme);
    } catch (error) {
      window.alert(`Theme import failed: ${String(error)}`);
    }
  }, [persistTheme, themeDraft]);

  const seedDefaultBookmarks = useCallback(async () => {
    try {
      const home = await invoke<string>('fs_get_home_dir');
      const seeds = createDefaultDirectoryBookmarks(home, platform);
      for (const seed of seeds) {
        if (!directoryBookmarks.some(bookmark => bookmark.value === seed.value)) {
          await addDirectoryBookmark(seed);
        }
      }
    } catch (error) {
      console.warn('OverlayTerm: failed to seed default bookmarks', error);
    }
  }, [addDirectoryBookmark, directoryBookmarks, platform]);

  const panelBackground = appearance.theme.palette.panelBackground;
  const border = appearance.theme.palette.border;
  const text = appearance.theme.palette.textPrimary;
  const muted = appearance.theme.palette.textMuted;
  const accent = appearance.theme.palette.accent;
  const activeLayoutProfile = useMemo(
    () => resolveLayoutProfile(layoutManifestState.manifest, settings.layout.activeProfileId),
    [layoutManifestState.manifest, settings.layout.activeProfileId],
  );
  const layoutSourceSummary = useMemo(() => {
    if (layoutManifestState.sourceType === 'file' && layoutManifestState.sourcePath) {
      return `Loaded from ${layoutManifestState.sourcePath}`;
    }
    if (settings.layout.configPath.trim()) {
      return 'Custom path failed, using built-in layouts';
    }
    return 'Using built-in layouts with home-directory auto-probe';
  }, [layoutManifestState.sourcePath, layoutManifestState.sourceType, settings.layout.configPath]);
  const filteredFolderIconOptions = useMemo(() => {
    const query = folderIconSearch.trim().toLowerCase();
    if (!query) {
      return FOLDER_ICON_OPTIONS;
    }

    return FOLDER_ICON_OPTIONS.filter(option => option.label.toLowerCase().includes(query) || option.value.toLowerCase().includes(query));
  }, [folderIconSearch]);

  const patchFolderRules = useCallback((rules: FolderIconRule[]) => {
    updateExplorer({ folderIconRules: rules });
  }, [updateExplorer]);

  const updateFolderRule = useCallback((ruleId: string, patch: Partial<FolderIconRule>) => {
    patchFolderRules(
      settings.explorer.folderIconRules.map(rule => (rule.id === ruleId ? { ...rule, ...patch } : rule)),
    );
  }, [patchFolderRules, settings.explorer.folderIconRules]);

  const removeFolderRule = useCallback((ruleId: string) => {
    patchFolderRules(settings.explorer.folderIconRules.filter(rule => rule.id !== ruleId));
  }, [patchFolderRules, settings.explorer.folderIconRules]);

  const addFolderRule = useCallback(() => {
    patchFolderRules([
      ...settings.explorer.folderIconRules,
      {
        id: `custom-${Date.now()}`,
        label: 'Custom Rule',
        matchers: [],
        icon: settings.explorer.defaultFolderIcon,
      },
    ]);
  }, [patchFolderRules, settings.explorer.defaultFolderIcon, settings.explorer.folderIconRules]);

  const setLaunchAtStartup = useCallback(async (enabled: boolean) => {
    setStartupSyncPending(true);
    setStartupSyncError(null);
    try {
      const nextValue = await invoke<boolean>('startup_set_launch_at_startup', { enabled });
      updateSystem({ launchAtStartup: nextValue });
    } catch (error) {
      setStartupSyncError(String(error));
    } finally {
      setStartupSyncPending(false);
    }
  }, [updateSystem]);

  return (
    <div
      className="custom-scrollbar flex h-full flex-col overflow-y-auto"
      style={{
        fontFamily: appearance.fonts.ui,
        background: `linear-gradient(180deg, ${appearance.theme.palette.appBackgroundAlt} 0%, ${panelBackground} 100%)`,
      }}
    >
      <div className="border-b px-5 py-4" style={{ borderColor: border }}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em]" style={{ color: muted }}>
              <SlidersHorizontal size={13} />
              <span>Application Settings</span>
            </div>
            <h1 className="mt-2 text-[24px] font-semibold" style={{ color: text }}>Tune the whole overlay from one place.</h1>
            <p className="mt-2 max-w-[720px] text-[12px] leading-5" style={{ color: muted }}>
              Platform-aware defaults, terminal behavior, explorer startup, and theme editing all live here now.
            </p>
          </div>
          <button
            onClick={() => resetToDefaults()}
            className="inline-flex items-center gap-2 rounded px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] transition-colors"
            style={{ border: `1px solid ${border}`, color: text, background: 'rgba(255,255,255,0.04)' }}
          >
            <RotateCcw size={12} />
            Reset Defaults
          </button>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 p-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
        <div className="space-y-4">
          <section className="rounded border p-4" style={{ borderColor: border, background: 'rgba(255,255,255,0.03)' }}>
            <SectionTitle
              icon={<Palette size={12} />}
              title="Appearance"
              subtitle="Theme presets, UI fonts, and direct palette editing."
            />

            <div className="mt-4 space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-50">Theme Presets</label>
                <div className="grid grid-cols-2 gap-2">
                  {appearance.themes.map(themeOption => {
                    const active = settings.appearance.activeThemeId === themeOption.id;
                    return (
                      <button
                        key={themeOption.id}
                        onClick={() => updateAppearance({ activeThemeId: themeOption.id })}
                        className="flex items-center gap-2 rounded px-3 py-2 text-left transition-opacity hover:opacity-100"
                        style={{
                          background: themeOption.palette.appBackground,
                          border: `1px solid ${active ? themeOption.palette.accent : themeOption.palette.border}`,
                          color: themeOption.palette.textPrimary,
                        }}
                      >
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: themeOption.palette.accent }} />
                        <span className="truncate text-[11px] font-medium">{themeOption.name}</span>
                        {active && <span className="ml-auto text-[9px] opacity-60">LIVE</span>}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] opacity-50">
                  <Type size={10} />
                  UI Font
                </label>
                <div className="grid grid-cols-1 gap-1 md:grid-cols-2">
                  {overlayFontCatalog.map(font => {
                    const active = settings.appearance.uiFontFamily === font.family;
                    return (
                      <button
                        key={font.id}
                        onClick={() => updateAppearance({ uiFontFamily: font.family })}
                        className="w-full rounded px-3 py-2 text-left text-[11px] transition-colors hover:bg-white/5"
                        style={{
                          fontFamily: font.family,
                          background: active ? `${accent}18` : 'transparent',
                          border: `1px solid ${active ? accent : 'rgba(255,255,255,0.08)'}`,
                          color: active ? text : muted,
                        }}
                      >
                        {font.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <ColorToken label="Accent" value={appearance.theme.palette.accent} onChange={value => updateThemePalette({ accent: value, accentSoft: `${value}22` })} />
                <ColorToken label="App Background" value={appearance.theme.palette.appBackground} onChange={value => updateThemePalette({ appBackground: value, shellBackgroundSolid: value })} />
                <ColorToken label="Panel" value={appearance.theme.palette.panelBackground} onChange={value => updateThemePalette({ panelBackground: value, sidebarBackground: value })} />
                <ColorToken label="Text" value={appearance.theme.palette.textPrimary} onChange={value => updateThemePalette({ textPrimary: value })} />
              </div>

              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                <RangeField
                  label="Window Opacity"
                  description="How translucent the overlay surface should feel."
                  min={0.15}
                  max={1}
                  step={0.02}
                  value={settings.appearance.appOpacity}
                  valueLabel={`${Math.round(settings.appearance.appOpacity * 100)}%`}
                  onChange={value => updateAppearance({ appOpacity: value })}
                />
                <RangeField
                  label="Window Zoom"
                  description="Scale the full overlay shell without changing monitor placement."
                  min={0.7}
                  max={1.35}
                  step={0.025}
                  value={settings.appearance.appZoom}
                  valueLabel={`${Math.round(settings.appearance.appZoom * 100)}%`}
                  onChange={value => updateAppearance({ appZoom: value })}
                />
              </div>

              <label className="flex items-center justify-between rounded border px-3 py-2 text-[11px]" style={{ borderColor: border }}>
                <div>
                  <div className="font-semibold uppercase tracking-[0.12em] opacity-60">Native Glass Blur</div>
                  <p className="mt-1 text-[11px] opacity-40">Use compositor-backed window blur when the platform supports it.</p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.appearance.appBlur}
                  onChange={event => updateAppearance({ appBlur: event.target.checked })}
                />
              </label>

              <div className="rounded border p-3" style={{ borderColor: border, background: 'rgba(255,255,255,0.025)' }}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-60">Window Motion</div>
                    <p className="mt-1 text-[11px] opacity-40">
                      Swap how the overlay arrives and leaves without rewiring the shell again.
                    </p>
                  </div>
                  <span className="rounded border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ borderColor: border, background: 'rgba(255,255,255,0.04)', color: text }}>
                    Pipeline
                  </span>
                </div>

                <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-50">Open Preset</label>
                    <div className="grid grid-cols-1 gap-2">
                      {overlayAnimationPresets.map(preset => {
                        const active = settings.appearance.appOpenAnimation === preset.id;
                        return (
                          <button
                            key={`open-${preset.id}`}
                            onClick={() => updateAppearance({ appOpenAnimation: preset.id })}
                            className="rounded px-3 py-2 text-left transition-colors"
                            style={{
                              border: `1px solid ${active ? accent : border}`,
                              background: active ? `${accent}16` : 'rgba(255,255,255,0.03)',
                              color: text,
                            }}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[11px] font-semibold">{preset.label}</span>
                              <span className="text-[9px] uppercase tracking-[0.14em]" style={{ color: active ? accent : muted }}>
                                {preset.group}
                              </span>
                            </div>
                            <p className="mt-1 text-[11px] opacity-45">{preset.description}</p>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-50">Close Preset</label>
                    <div className="grid grid-cols-1 gap-2">
                      {overlayAnimationPresets.map(preset => {
                        const active = settings.appearance.appCloseAnimation === preset.id;
                        return (
                          <button
                            key={`close-${preset.id}`}
                            onClick={() => updateAppearance({ appCloseAnimation: preset.id })}
                            className="rounded px-3 py-2 text-left transition-colors"
                            style={{
                              border: `1px solid ${active ? accent : border}`,
                              background: active ? `${accent}16` : 'rgba(255,255,255,0.03)',
                              color: text,
                            }}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[11px] font-semibold">{preset.label}</span>
                              <span className="text-[9px] uppercase tracking-[0.14em]" style={{ color: active ? accent : muted }}>
                                {preset.group}
                              </span>
                            </div>
                            <p className="mt-1 text-[11px] opacity-45">{preset.description}</p>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
                  <RangeField
                    label="Animation Duration"
                    description="How long each open or close pass gets to play before the window settles."
                    min={140}
                    max={1200}
                    step={20}
                    value={settings.appearance.appAnimationDurationMs}
                    valueLabel={`${settings.appearance.appAnimationDurationMs}ms`}
                    onChange={value => updateAppearance({ appAnimationDurationMs: clampOverlayAnimationDuration(value) })}
                  />
                  <RangeField
                    label="Animation Intensity"
                    description="Push the translation, breakup, and glow harder without changing presets."
                    min={0.55}
                    max={1.8}
                    step={0.05}
                    value={settings.appearance.appAnimationIntensity}
                    valueLabel={`${settings.appearance.appAnimationIntensity.toFixed(2)}x`}
                    onChange={value => updateAppearance({ appAnimationIntensity: clampOverlayAnimationIntensity(value) })}
                  />
                </div>
              </div>
            </div>
          </section>

          <section className="rounded border p-4" style={{ borderColor: border, background: 'rgba(255,255,255,0.03)' }}>
            <SectionTitle
              icon={<TerminalSquare size={12} />}
              title="Terminal"
              subtitle="Integrated shell behavior and external terminal handoff."
            />

            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-50">Integrated Shell</label>
                <input
                  value={settings.terminal.shell}
                  onChange={event => updateTerminal({ shell: event.target.value })}
                  className="w-full rounded border px-3 py-2 text-[11px] outline-none"
                  style={{ borderColor: border, background: 'rgba(255,255,255,0.04)', color: text, fontFamily: appearance.fonts.mono }}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-50">Terminal Font</label>
                <input
                  value={settings.terminal.fontFamily}
                  onChange={event => updateTerminal({ fontFamily: event.target.value })}
                  className="w-full rounded border px-3 py-2 text-[11px] outline-none"
                  style={{ borderColor: border, background: 'rgba(255,255,255,0.04)', color: text, fontFamily: appearance.fonts.mono }}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-50">Font Size</label>
                <input
                  type="number"
                  min={8}
                  max={24}
                  value={settings.terminal.fontSize}
                  onChange={event => updateTerminal({ fontSize: Number(event.target.value) })}
                  className="w-full rounded border px-3 py-2 text-[11px] outline-none"
                  style={{ borderColor: border, background: 'rgba(255,255,255,0.04)', color: text }}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-50">Cursor Style</label>
                <select
                  value={settings.terminal.cursorStyle}
                  onChange={event => updateTerminal({ cursorStyle: event.target.value as typeof settings.terminal.cursorStyle })}
                  className="w-full rounded border px-3 py-2 text-[11px] outline-none"
                  style={{ borderColor: border, background: panelBackground, color: text }}
                >
                  <option value="bar">Bar</option>
                  <option value="block">Block</option>
                  <option value="underline">Underline</option>
                </select>
              </div>

              <div className="space-y-1.5 md:col-span-2">
                <label className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-50">Open Target</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['integrated', 'external'] as const).map(mode => {
                    const active = settings.terminal.preferredOpenMode === mode;
                    return (
                      <button
                        key={mode}
                        onClick={() => updateTerminal({ preferredOpenMode: mode })}
                        className="rounded px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em]"
                        style={{
                          background: active ? `${accent}20` : 'rgba(255,255,255,0.04)',
                          color: active ? text : muted,
                          border: `1px solid ${active ? accent : border}`,
                        }}
                      >
                        {mode}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-1.5 md:col-span-2">
                <label className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-50">External Terminal Profile</label>
                <select
                  value={settings.terminal.externalTerminalProfile}
                  onChange={event => updateTerminal({ externalTerminalProfile: event.target.value as ExternalTerminalProfile })}
                  className="w-full rounded border px-3 py-2 text-[11px] outline-none"
                  style={{ borderColor: border, background: panelBackground, color: text }}
                >
                  {profileOptions.map(option => (
                    <option key={option.id} value={option.id}>{option.label}</option>
                  ))}
                </select>
                <p className="text-[11px] opacity-40">
                  {profileOptions.find(option => option.id === settings.terminal.externalTerminalProfile)?.description ?? 'Use a platform-appropriate terminal profile.'}
                </p>
              </div>

              {(settings.terminal.externalTerminalProfile === 'custom' || settings.terminal.preferredOpenMode === 'external') && (
                <>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-50">External Command</label>
                    <input
                      value={settings.terminal.externalTerminalCommand}
                      onChange={event => updateTerminal({ externalTerminalCommand: event.target.value })}
                      className="w-full rounded border px-3 py-2 text-[11px] outline-none"
                      style={{ borderColor: border, background: 'rgba(255,255,255,0.04)', color: text, fontFamily: appearance.fonts.mono }}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-50">External Args</label>
                    <textarea
                      value={settings.terminal.externalTerminalArgs}
                      onChange={event => updateTerminal({ externalTerminalArgs: event.target.value })}
                      className="min-h-[92px] w-full rounded border px-3 py-2 text-[11px] outline-none"
                      style={{ borderColor: border, background: 'rgba(255,255,255,0.04)', color: text, fontFamily: appearance.fonts.mono }}
                    />
                  </div>
                </>
              )}

              <label className="flex items-center justify-between rounded border px-3 py-2 text-[11px]" style={{ borderColor: border }}>
                <span>Cursor Blink</span>
                <input
                  type="checkbox"
                  checked={settings.terminal.cursorBlink}
                  onChange={event => updateTerminal({ cursorBlink: event.target.checked })}
                />
              </label>
            </div>
          </section>
        </div>

        <div className="space-y-4">
          <section className="rounded border p-4" style={{ borderColor: border, background: 'rgba(255,255,255,0.03)' }}>
            <SectionTitle
              icon={<LayoutGrid size={12} />}
              title="Layouts"
              subtitle="Drive the whole shell from a manifest instead of a single hardcoded chrome layout."
            />

            <div className="mt-4 space-y-3">
              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-50">Manifest Path</label>
                <input
                  value={settings.layout.configPath}
                  onChange={event => updateLayout({ configPath: event.target.value })}
                  placeholder="Leave blank to probe ~/.overlayterm/snapyard.layouts.json or .toml"
                  className="w-full rounded border px-3 py-2 text-[11px] outline-none"
                  style={{ borderColor: border, background: 'rgba(255,255,255,0.04)', color: text, fontFamily: appearance.fonts.mono }}
                />
                <div className="flex flex-wrap items-center gap-2 text-[10px]">
                  <button
                    onClick={() => updateLayout({ configPath: '' })}
                    className="rounded px-2 py-1 font-semibold uppercase tracking-[0.14em]"
                    style={{ border: `1px solid ${border}`, background: 'rgba(255,255,255,0.04)', color: text }}
                  >
                    Use Auto Probe
                  </button>
                  <span
                    className="rounded border px-2 py-1 font-semibold uppercase tracking-[0.14em]"
                    style={{
                      borderColor: layoutManifestState.sourceError ? '#f97316' : accent,
                      background: layoutManifestState.sourceError ? 'rgba(249,115,22,0.12)' : `${accent}12`,
                      color: layoutManifestState.sourceError ? '#fdba74' : text,
                    }}
                  >
                    {layoutManifestState.sourceType === 'file' ? 'External Manifest' : 'Built In'}
                  </span>
                </div>
                <p className="text-[11px] opacity-40">
                  {layoutSourceSummary}
                </p>
                {layoutManifestState.sourceError && (
                  <div className="rounded border px-3 py-2 text-[11px]" style={{ borderColor: '#7f1d1d', background: 'rgba(127,29,29,0.18)', color: '#fecaca' }}>
                    Manifest load failed: {layoutManifestState.sourceError}
                  </div>
                )}
              </div>

              <div className="rounded border p-3" style={{ borderColor: border, background: 'rgba(255,255,255,0.025)' }}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-60">Profiles</div>
                    <p className="mt-1 text-[11px] opacity-40">
                      Click a profile to switch the entire workbench layout. The Snapyard button still cycles this same ordered set.
                    </p>
                  </div>
                  <span className="rounded border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ borderColor: border, background: 'rgba(255,255,255,0.04)', color: text }}>
                    {layoutManifestState.manifest.profiles.length} loaded
                  </span>
                </div>

                <div className="mt-3 space-y-2">
                  {layoutManifestState.manifest.profiles.map(profile => {
                    const active = profile.id === activeLayoutProfile.id;
                    return (
                      <button
                        key={profile.id}
                        onClick={() => updateLayout({ activeProfileId: profile.id })}
                        className="w-full rounded border px-3 py-3 text-left transition-colors"
                        style={{
                          borderColor: active ? accent : border,
                          background: active ? `${accent}16` : 'rgba(255,255,255,0.03)',
                          color: text,
                        }}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="text-[11px] font-semibold">{profile.label}</div>
                            <p className="mt-1 text-[11px] opacity-45">{profile.description}</p>
                          </div>
                          {active && (
                            <span className="rounded border px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.14em]" style={{ borderColor: accent, color: accent }}>
                              Live
                            </span>
                          )}
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2 text-[9px] font-semibold uppercase tracking-[0.12em] opacity-70">
                          <span className="rounded border px-2 py-1" style={{ borderColor: border }}>
                            Bar {profile.chrome.barPosition}
                          </span>
                          <span className="rounded border px-2 py-1" style={{ borderColor: border }}>
                            Dock {profile.controlDock.enabled ? profile.controlDock.side : 'off'}
                          </span>
                          <span className="rounded border px-2 py-1" style={{ borderColor: border }}>
                            Pinned {profile.pinnedPanels.length}
                          </span>
                          <span className="rounded border px-2 py-1" style={{ borderColor: border }}>
                            Default {profile.behavior.defaultActivePanelId}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>

          <section className="rounded border p-4" style={{ borderColor: border, background: 'rgba(255,255,255,0.03)' }}>
            <SectionTitle
              icon={<Settings2 size={12} />}
              title="System"
              subtitle="Machine-level startup behavior and OS integration state."
            />

            <div className="mt-4 space-y-3">
              <label className="flex items-center justify-between rounded border px-3 py-3 text-[11px]" style={{ borderColor: border }}>
                <div>
                  <div className="font-semibold uppercase tracking-[0.12em] opacity-60">Launch At Startup</div>
                  <p className="mt-1 text-[11px] opacity-40">
                    Registers OverlayTerm as a login item so the tray and overlay are available after sign-in.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.system.launchAtStartup}
                  disabled={startupSyncPending}
                  onChange={event => void setLaunchAtStartup(event.target.checked)}
                />
              </label>
              <div className="rounded border px-3 py-2 text-[11px]" style={{ borderColor: border, background: 'rgba(255,255,255,0.025)', color: startupSyncError ? '#fda4af' : muted }}>
                {startupSyncPending
                  ? 'Updating OS startup registration...'
                  : startupSyncError
                    ? `Startup registration failed: ${startupSyncError}`
                    : `Current status: ${settings.system.launchAtStartup ? 'enabled' : 'disabled'}`}
              </div>
            </div>
          </section>

          <section className="rounded border p-4" style={{ borderColor: border, background: 'rgba(255,255,255,0.03)' }}>
            <SectionTitle
              icon={<FolderOpen size={12} />}
              title="Explorer"
              subtitle="Startup path, visibility rules, and bookmark quality-of-life."
            />

            <div className="mt-4 space-y-3">
              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-50">Startup Path</label>
                <input
                  value={settings.explorer.defaultPath}
                  onChange={event => updateExplorer({ defaultPath: event.target.value })}
                  className="w-full rounded border px-3 py-2 text-[11px] outline-none"
                  style={{ borderColor: border, background: 'rgba(255,255,255,0.04)', color: text, fontFamily: appearance.fonts.mono }}
                />
                <p className="text-[11px] opacity-40">Use `.` to prefer the detected home directory for the current machine.</p>
              </div>

              <div className="grid grid-cols-1 gap-2">
                <label className="flex items-center justify-between rounded border px-3 py-2 text-[11px]" style={{ borderColor: border }}>
                  <span>Show Hidden Files</span>
                  <input
                    type="checkbox"
                    checked={settings.explorer.showHiddenFiles}
                    onChange={event => updateExplorer({ showHiddenFiles: event.target.checked })}
                  />
                </label>
                <label className="flex items-center justify-between rounded border px-3 py-2 text-[11px]" style={{ borderColor: border }}>
                  <span>Confirm Delete</span>
                  <input
                    type="checkbox"
                    checked={settings.explorer.confirmDelete}
                    onChange={event => updateExplorer({ confirmDelete: event.target.checked })}
                  />
                </label>
              </div>

              <div className="rounded border p-3" style={{ borderColor: border, background: 'rgba(255,255,255,0.025)' }}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-60">Folder Icon Authoring</div>
                    <p className="mt-1 text-[11px] opacity-40">
                      Curated coding-folder rules land first. Anything that misses falls back to the default folder icon.
                    </p>
                  </div>
                  <button
                    onClick={() => updateExplorer({ folderIconRules: createDefaultFolderIconRules() })}
                    className="rounded px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]"
                    style={{ border: `1px solid ${border}`, background: 'rgba(255,255,255,0.04)', color: text }}
                  >
                    Restore Rules
                  </button>
                </div>

                <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-[140px_minmax(0,1fr)]">
                  <label className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-50">Default Fallback</label>
                  <div className="flex items-center gap-3 rounded border px-3 py-2" style={{ borderColor: border, background: 'rgba(255,255,255,0.04)' }}>
                    <img
                      src={getNamedFolderIconSrc(settings.explorer.defaultFolderIcon)}
                      width={22}
                      height={22}
                      style={{ objectFit: 'contain', flexShrink: 0 }}
                      draggable={false}
                    />
                    <select
                      value={settings.explorer.defaultFolderIcon}
                      onChange={event => updateExplorer({ defaultFolderIcon: event.target.value as FolderIconValue })}
                      className="w-full bg-transparent text-[11px] outline-none"
                      style={{ color: text }}
                    >
                      {FOLDER_ICON_OPTIONS.map(option => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="mt-3 space-y-2">
                  {settings.explorer.folderIconRules.map(rule => (
                    <div key={rule.id} className="rounded border p-3" style={{ borderColor: border, background: 'rgba(255,255,255,0.03)' }}>
                      <div className="grid grid-cols-1 gap-2 xl:grid-cols-[120px_minmax(0,1.1fr)_minmax(0,0.9fr)_36px]">
                        <div className="flex items-center gap-2 rounded border px-2 py-2" style={{ borderColor: border, background: 'rgba(255,255,255,0.04)' }}>
                          <img
                            src={getNamedFolderIconSrc(rule.icon)}
                            width={18}
                            height={18}
                            style={{ objectFit: 'contain', flexShrink: 0 }}
                            draggable={false}
                          />
                          <input
                            value={rule.label}
                            onChange={event => updateFolderRule(rule.id, { label: event.target.value })}
                            className="w-full bg-transparent text-[11px] outline-none"
                            style={{ color: text }}
                          />
                        </div>
                        <input
                          value={stringifyMatchers(rule.matchers)}
                          onChange={event => updateFolderRule(rule.id, { matchers: parseMatcherInput(event.target.value) })}
                          placeholder="src, source, source_code"
                          className="w-full rounded border px-3 py-2 text-[11px] outline-none"
                          style={{ borderColor: border, background: 'rgba(255,255,255,0.04)', color: text, fontFamily: appearance.fonts.mono }}
                        />
                        <select
                          value={rule.icon}
                          onChange={event => updateFolderRule(rule.id, { icon: event.target.value as FolderIconValue })}
                          className="w-full rounded border px-3 py-2 text-[11px] outline-none"
                          style={{ borderColor: border, background: panelBackground, color: text }}
                        >
                          {FOLDER_ICON_OPTIONS.map(option => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={() => removeFolderRule(rule.id)}
                          className="flex items-center justify-center rounded border"
                          title="Remove Rule"
                          style={{ borderColor: border, background: 'rgba(255,255,255,0.04)', color: muted }}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-3 flex items-center gap-2">
                  <button
                    onClick={addFolderRule}
                    className="inline-flex items-center gap-2 rounded px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em]"
                    style={{ background: `${accent}18`, color: text, border: `1px solid ${accent}55` }}
                  >
                    <Plus size={11} />
                    Add Rule
                  </button>
                  <span className="text-[10px] opacity-40">
                    Matchers are normalized, so `src-tauri`, `src tauri`, and `src_tauri` resolve the same way.
                  </span>
                </div>

                <div className="mt-4 rounded border p-3" style={{ borderColor: border, background: 'rgba(255,255,255,0.02)' }}>
                  <label className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] opacity-50">
                    <Search size={11} />
                    Icon Catalog
                  </label>
                  <input
                    value={folderIconSearch}
                    onChange={event => setFolderIconSearch(event.target.value)}
                    placeholder="Filter icon names"
                    className="mt-2 w-full rounded border px-3 py-2 text-[11px] outline-none"
                    style={{ borderColor: border, background: 'rgba(255,255,255,0.04)', color: text }}
                  />
                  <div className="custom-scrollbar mt-3 grid max-h-[220px] grid-cols-2 gap-2 overflow-y-auto pr-1 md:grid-cols-3">
                    {filteredFolderIconOptions.map(option => (
                      <button
                        key={option.value}
                        onClick={() => updateExplorer({ defaultFolderIcon: option.value })}
                        className="flex items-center gap-2 rounded border px-2 py-2 text-left text-[10px]"
                        style={{
                          borderColor: settings.explorer.defaultFolderIcon === option.value ? accent : border,
                          background: settings.explorer.defaultFolderIcon === option.value ? `${accent}14` : 'rgba(255,255,255,0.03)',
                          color: text,
                        }}
                        title="Set as default fallback"
                      >
                        <img src={option.closedSrc} width={18} height={18} style={{ objectFit: 'contain', flexShrink: 0 }} draggable={false} />
                        <span className="truncate">{option.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <button
                onClick={() => void seedDefaultBookmarks()}
                className="w-full rounded px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em]"
                style={{ background: `${accent}18`, color: text, border: `1px solid ${accent}55` }}
              >
                Seed Platform Bookmarks
              </button>
            </div>
          </section>

          <section className="rounded border p-4" style={{ borderColor: border, background: 'rgba(255,255,255,0.03)' }}>
            <SectionTitle
              icon={<Palette size={12} />}
              title="Theme JSON"
              subtitle="Paste, tweak, or version your custom theme directly."
            />

            <div className="mt-4 space-y-2">
              <textarea
                value={themeDraft}
                onChange={event => setThemeDraft(event.target.value)}
                className="min-h-[280px] w-full rounded border px-3 py-3 text-[11px] outline-none"
                style={{ borderColor: border, background: 'rgba(255,255,255,0.04)', color: text, fontFamily: appearance.fonts.mono }}
              />
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setThemeDraft(serializeTheme(appearance.theme))}
                  className="rounded px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em]"
                  style={{ background: 'rgba(255,255,255,0.06)', color: text, border: `1px solid ${border}` }}
                >
                  Reset Draft
                </button>
                <button
                  onClick={applyThemeDraft}
                  className="rounded px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em]"
                  style={{ background: `${accent}20`, color: text, border: `1px solid ${accent}` }}
                >
                  Import / Apply
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
