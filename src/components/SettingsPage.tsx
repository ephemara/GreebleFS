import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { FolderOpen, LayoutGrid, Palette, Plus, RefreshCw, RotateCcw, Search, Settings2, SlidersHorizontal, Sparkles, TerminalSquare, Trash2, Type } from 'lucide-react';
import type { LoadedOverlayAnimation } from './animationRuntime';
import {
  normalizeShaderControlValue,
  resolveShaderComputedUniforms,
  resolveShaderControlValues,
  type LoadedOverlayShader,
  type OverlayShaderControlDefinition,
  type OverlayShaderShellContext,
} from './shaderRuntime';
import {
  ensureFontFamilyLoaded,
  getThemeSourceLabel,
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
import { getBuiltInIconTheme } from '../config/iconTheme';
import { animationSystemConfig, resolvePreferredAnimationId } from '../config/animations';
import { OverlayScrollArea } from './OverlayScrollArea';
import { ResizablePane, usePersistentPanelSize } from './ResizablePane';
import {
  BUILT_IN_LAYOUT_MANIFEST,
  loadExternalLayoutManifest,
  resolveLayoutProfile,
  type LoadedLayoutManifest,
} from '../config/layoutProfiles';
import type { LoadedOverlayThemePackage } from '../config/themePackages';
import {
  getOverlayShaderSurfaceLabel,
  getShaderEnabledSurfaceIds,
  resolvePreferredShaderId,
} from '../config/shaders';
import {
  clampOverlayAnimationDuration,
  clampOverlayAnimationIntensity,
} from '../config/overlayAnimations';
import {
  clampOverlayVisualControlValue,
  formatOverlayVisualControlValue,
  overlayVisualControls,
} from '../config/overlayWindow';
import {
  formatHotkeyLabel,
  getHotkeyBindingDefinition,
  hotkeyBindingDefinitions,
  normalizeKeybindingValue,
  type HotkeyBindingKey,
} from '../config/hotkeys';
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
        <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] opacity-60">
          {icon}
          <span>{title}</span>
        </div>
        <p className="mt-0.5 text-[10px] leading-4 opacity-40">{subtitle}</p>
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

function formatShaderControlValue(control: OverlayShaderControlDefinition, value: number): string {
  if (control.formatValue) {
    return control.formatValue(value);
  }

  if (control.step >= 1) {
    return `${Math.round(value)}`;
  }

  const decimals = `${control.step}`.split('.')[1]?.length ?? 2;
  return value.toFixed(Math.min(decimals, 3));
}

function ShortcutField({
  bindingKey,
  value,
  onCommit,
}: {
  bindingKey: HotkeyBindingKey;
  value: string;
  onCommit: (value: string) => void;
}) {
  const definition = getHotkeyBindingDefinition(bindingKey);
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  const commit = useCallback(() => {
    const normalized = normalizeKeybindingValue(draft, definition.defaultValue);
    setDraft(normalized);
    onCommit(normalized);
  }, [definition.defaultValue, draft, onCommit]);

  return (
    <label className="rounded border border-white/8 bg-white/[0.03] p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-60">{definition.label}</div>
          <p className="mt-1 text-[11px] opacity-40">{definition.description}</p>
        </div>
        <span className="rounded border border-white/10 bg-white/[0.04] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] opacity-80">
          {definition.scope}
        </span>
      </div>
      <input
        value={draft}
        onChange={event => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={event => {
          if (event.key === 'Enter') {
            event.preventDefault();
            commit();
          }
          if (event.key === 'Escape') {
            event.preventDefault();
            setDraft(value);
          }
        }}
        className="mt-3 w-full rounded border px-3 py-2 text-[11px] outline-none"
        style={{ borderColor: 'rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)' }}
      />
      <div className="mt-2 flex items-center justify-between gap-3 text-[10px] opacity-45">
        <span>Live value: {formatHotkeyLabel(value)}</span>
        <button
          type="button"
          onClick={() => {
            setDraft(definition.defaultValue);
            onCommit(definition.defaultValue);
          }}
          className="rounded border px-2 py-1 font-semibold uppercase tracking-[0.14em]"
          style={{ borderColor: 'rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)' }}
        >
          Reset
        </button>
      </div>
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

type SettingsSectionKey =
  | 'appearance'
  | 'shaders'
  | 'animations'
  | 'terminal'
  | 'explorer'
  | 'layouts'
  | 'hotkeys'
  | 'system'
  | 'theme-json';

function SettingsRailButton({
  active,
  icon,
  label,
  subtitle,
  summary,
  accent,
  border,
  text,
  muted,
  onClick,
}: {
  active: boolean;
  icon: ReactNode;
  label: string;
  subtitle: string;
  summary: string;
  accent: string;
  border: string;
  text: string;
  muted: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={subtitle}
      className="w-full rounded px-2 py-2 text-left transition-colors"
      style={{
        border: `1px solid ${active ? `${accent}88` : border}`,
        background: active ? `${accent}12` : 'rgba(255,255,255,0.02)',
        color: text,
        boxShadow: active ? `inset 0 0 0 1px ${accent}22` : 'none',
      }}
    >
      <div className="flex items-center gap-2">
        <div
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded"
          style={{
            background: active ? `${accent}18` : 'rgba(255,255,255,0.035)',
            color: active ? accent : muted,
            border: `1px solid ${active ? `${accent}55` : 'rgba(255,255,255,0.06)'}`,
          }}
        >
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-semibold uppercase tracking-[0.08em]">{label}</div>
          <div className="mt-0.5 text-[10px] leading-4" style={{ color: active ? accent : muted }}>
            {summary}
          </div>
        </div>
      </div>
    </button>
  );
}


export function SettingsPage({
  appearance,
  themePackages,
  themePackagesDirectory,
  themePackagesLoading,
  themePackagesError,
  onRefreshThemes,
  onOpenThemesFolder,
  shaders,
  shaderDiagnostics,
  shadersDirectory,
  shadersLoading,
  shadersError,
  onRefreshShaders,
  onOpenShadersFolder,
  animations,
  animationDiagnostics,
  animationsDirectory,
  animationsLoading,
  animationsError,
  onRefreshAnimations,
  onOpenAnimationsFolder,
}: {
  appearance: ResolvedOverlayAppearance;
  themePackages: LoadedOverlayThemePackage[];
  themePackagesDirectory: string;
  themePackagesLoading: boolean;
  themePackagesError: string | null;
  onRefreshThemes: () => Promise<void>;
  onOpenThemesFolder: () => Promise<void>;
  shaders: LoadedOverlayShader[];
  shaderDiagnostics: LoadedOverlayShader[];
  shadersDirectory: string;
  shadersLoading: boolean;
  shadersError: string | null;
  onRefreshShaders: () => Promise<void>;
  onOpenShadersFolder: () => Promise<void>;
  animations: LoadedOverlayAnimation[];
  animationDiagnostics: LoadedOverlayAnimation[];
  animationsDirectory: string;
  animationsLoading: boolean;
  animationsError: string | null;
  onRefreshAnimations: () => Promise<void>;
  onOpenAnimationsFolder: () => Promise<void>;
}) {
  const platform = useMemo(() => detectClientPlatform(), []);
  const platformLabel = useMemo(() => {
    if (platform === 'windows') return 'Windows';
    if (platform === 'macos') return 'macOS';
    if (platform === 'linux') return 'Linux';
    return 'the OS';
  }, [platform]);
  const settings = useSettingsStore(s => s.settings);
  const updateTerminal = useSettingsStore(s => s.updateTerminal);
  const updateExplorer = useSettingsStore(s => s.updateExplorer);
  const updateAppearance = useSettingsStore(s => s.updateAppearance);
  const updateLayout = useSettingsStore(s => s.updateLayout);
  const updateKeybindings = useSettingsStore(s => s.updateKeybindings);
  const updateSystem = useSettingsStore(s => s.updateSystem);
  const resetToDefaults = useSettingsStore(s => s.resetToDefaults);
  const { directoryBookmarks, addDirectoryBookmark } = useTerminalStore();

  const profileOptions = useMemo(() => getExternalTerminalProfileOptions(platform), [platform]);
  const [themeDraft, setThemeDraft] = useState(() => serializeTheme(appearance.baseTheme));
  const [folderIconSearch, setFolderIconSearch] = useState('');
  const [activeSection, setActiveSection] = useState<SettingsSectionKey>('appearance');
  const [startupSyncPending, setStartupSyncPending] = useState(false);
  const [startupSyncError, setStartupSyncError] = useState<string | null>(null);
  const [layoutManifestState, setLayoutManifestState] = useState<LoadedLayoutManifest>(DEFAULT_LOADED_LAYOUT_MANIFEST);
  const [railWidth, setRailWidth] = usePersistentPanelSize('overlayterm-settings-rail-width', 236, 190, 320);
  const availableAnimations = useMemo(
    () => animations.filter(animation => !animation.error),
    [animations],
  );
  const availableShaders = useMemo(
    () => shaders.filter(shader => !shader.error),
    [shaders],
  );
  const openAnimationOptions = useMemo(
    () => availableAnimations.filter(animation => animation.open),
    [availableAnimations],
  );
  const closeAnimationOptions = useMemo(
    () => availableAnimations.filter(animation => animation.close),
    [availableAnimations],
  );
  const availableOpenAnimationIds = useMemo(
    () => openAnimationOptions.map(animation => animation.id),
    [openAnimationOptions],
  );
  const availableCloseAnimationIds = useMemo(
    () => closeAnimationOptions.map(animation => animation.id),
    [closeAnimationOptions],
  );
  const animationFailures = useMemo(
    () => animationDiagnostics.filter(animation => Boolean(animation.error)),
    [animationDiagnostics],
  );
  const shaderFailures = useMemo(
    () => shaderDiagnostics.filter(shader => Boolean(shader.error)),
    [shaderDiagnostics],
  );
  const availableShaderIds = useMemo(
    () => availableShaders.map(shader => shader.id),
    [availableShaders],
  );
  const effectiveShaderId = useMemo(
    () => resolvePreferredShaderId({
      availableShaderIds,
      userOverrideId: settings.appearance.activeShaderId,
      themeDefaultShaderId: appearance.baseTheme.defaultShaderId,
    }),
    [appearance.baseTheme.defaultShaderId, availableShaderIds, settings.appearance.activeShaderId],
  );
  const effectiveShader = useMemo(
    () => availableShaders.find(shader => shader.id === effectiveShaderId) ?? null,
    [availableShaders, effectiveShaderId],
  );
  const enabledShaderSurfaces = useMemo(
    () => getShaderEnabledSurfaceIds(effectiveShader),
    [effectiveShader],
  );
  const effectiveShaderControlOverrides = useMemo(
    () => effectiveShader
      ? (settings.appearance.shaderControlValues[effectiveShader.id] ?? {})
      : {},
    [effectiveShader, settings.appearance.shaderControlValues],
  );
  const shaderSettingsShellContext = useMemo<OverlayShaderShellContext | null>(() => {
    if (!effectiveShader) {
      return null;
    }

    return {
      id: effectiveShader.id,
      name: effectiveShader.name,
      filePath: effectiveShader.filePath,
      shaderRoot: effectiveShader.shaderRoot,
      source: effectiveShader.source,
      viewport: {
        width: typeof window === 'undefined' ? 0 : window.innerWidth,
        height: typeof window === 'undefined' ? 0 : window.innerHeight,
      },
      accentColor: appearance.theme.palette.accent,
      theme: appearance.theme,
      panelTransparency: settings.appearance.panelTransparency,
      blurStrength: settings.appearance.appBlurStrength,
      zoom: settings.appearance.appZoom,
      isSettingsActive: true,
      shaderControlValues: effectiveShaderControlOverrides,
    };
  }, [
    appearance.theme,
    effectiveShader,
    effectiveShaderControlOverrides,
    settings.appearance.appBlurStrength,
    settings.appearance.appZoom,
    settings.appearance.panelTransparency,
  ]);
  const effectiveShaderComputedUniforms = useMemo(
    () => shaderSettingsShellContext
      ? resolveShaderComputedUniforms(effectiveShader, shaderSettingsShellContext)
      : {},
    [effectiveShader, shaderSettingsShellContext],
  );
  const effectiveShaderControlValues = useMemo(
    () => resolveShaderControlValues(
      effectiveShader,
      effectiveShaderControlOverrides,
      effectiveShaderComputedUniforms,
    ),
    [effectiveShader, effectiveShaderComputedUniforms, effectiveShaderControlOverrides],
  );
  const shaderSelectionSummary = settings.appearance.activeShaderId
    ? 'Settings Override'
    : appearance.baseTheme.defaultShaderId
      ? 'Theme Default'
      : 'Fallback';
  const effectiveOpenAnimationId = useMemo(
    () => resolvePreferredAnimationId({
      availableAnimationIds: availableOpenAnimationIds,
      userOverrideId: settings.appearance.appOpenAnimation,
      themeDefaultAnimationId: appearance.baseTheme.defaultOpenAnimationId,
      fallbackAnimationId: animationSystemConfig.defaultOpenAnimationId,
    }),
    [appearance.baseTheme.defaultOpenAnimationId, availableOpenAnimationIds, settings.appearance.appOpenAnimation],
  );
  const effectiveCloseAnimationId = useMemo(
    () => resolvePreferredAnimationId({
      availableAnimationIds: availableCloseAnimationIds,
      userOverrideId: settings.appearance.appCloseAnimation,
      themeDefaultAnimationId: appearance.baseTheme.defaultCloseAnimationId,
      fallbackAnimationId: animationSystemConfig.defaultCloseAnimationId,
    }),
    [appearance.baseTheme.defaultCloseAnimationId, availableCloseAnimationIds, settings.appearance.appCloseAnimation],
  );

  useEffect(() => {
    ensureFontFamilyLoaded(appearance.fonts.ui);
    ensureFontFamilyLoaded(settings.terminal.fontFamily);
  }, [appearance.fonts.ui, settings.terminal.fontFamily]);

  useEffect(() => {
    setThemeDraft(serializeTheme(appearance.baseTheme));
  }, [appearance.baseTheme]);

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
      ...appearance.baseTheme,
      palette: {
        ...appearance.baseTheme.palette,
        ...patch,
      },
    });
  }, [appearance.baseTheme, persistTheme]);

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

  const effectiveTheme = appearance.theme;
  const editableTheme = appearance.baseTheme;
  const panelBackground = effectiveTheme.palette.panelBackground;
  const border = effectiveTheme.palette.border;
  const text = effectiveTheme.palette.textPrimary;
  const muted = effectiveTheme.palette.textMuted;
  const accent = effectiveTheme.palette.accent;
  const themeIconTheme = editableTheme.assets?.iconTheme ?? getBuiltInIconTheme();
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

  const setHideAppInTray = useCallback((enabled: boolean) => {
    updateSystem({ hideAppInTray: enabled });
  }, [updateSystem]);

  const setShowInTaskbar = useCallback((enabled: boolean) => {
    updateSystem({ showInTaskbar: enabled });
  }, [updateSystem]);

  const setShaderControlValue = useCallback((
    shader: LoadedOverlayShader,
    control: OverlayShaderControlDefinition,
    rawValue: number,
  ) => {
    const existingShaderValues = settings.appearance.shaderControlValues[shader.id] ?? {};
    const fallbackValue = typeof effectiveShaderComputedUniforms[control.id] === 'number'
      ? effectiveShaderComputedUniforms[control.id] as number
      : control.defaultValue;
    const normalizedValue = normalizeShaderControlValue(control, rawValue, fallbackValue);
    const defaultValue = resolveShaderControlValues(shader, undefined, effectiveShaderComputedUniforms)[control.id];
    const nextShaderValues = { ...existingShaderValues };

    if (typeof defaultValue === 'number' && Math.abs(normalizedValue - defaultValue) < Number.EPSILON * 10) {
      delete nextShaderValues[control.id];
    } else {
      nextShaderValues[control.id] = normalizedValue;
    }

    const nextShaderControlValues = { ...settings.appearance.shaderControlValues };
    if (Object.keys(nextShaderValues).length === 0) {
      delete nextShaderControlValues[shader.id];
    } else {
      nextShaderControlValues[shader.id] = nextShaderValues;
    }

    updateAppearance({ shaderControlValues: nextShaderControlValues });
  }, [
    effectiveShaderComputedUniforms,
    settings.appearance.shaderControlValues,
    updateAppearance,
  ]);

  const settingsSections: Array<{
    key: SettingsSectionKey;
    label: string;
    subtitle: string;
    summary: string;
    detail: string;
    icon: ReactNode;
  }> = [
    {
      key: 'appearance',
      label: 'Appearance',
      subtitle: 'Theme, opacity, panel transparency, blur, and zoom.',
      summary: `${effectiveTheme.name} · ${settings.appearance.useNativeOsIcons ? 'OS Icons' : 'Theme Icons'} · ${formatOverlayVisualControlValue('opacity', settings.appearance.appOpacity)} OP · ${formatOverlayVisualControlValue('panelTransparency', settings.appearance.panelTransparency)} PT · ${formatOverlayVisualControlValue('zoom', settings.appearance.appZoom)} ZM · ${formatOverlayVisualControlValue('blurStrength', settings.appearance.appBlurStrength)} BL`,
      detail: 'Tune the shell look and feel, from presets and palette tokens to blur, transparency, and UI typography.',
      icon: <Palette size={14} />,
    },
    {
      key: 'shaders',
      label: 'Shaders',
      subtitle: 'Shell-wide shader profiles for background, chrome, and rails.',
      summary: `${availableShaders.length} profiles${shaderFailures.length > 0 ? ` · ${shaderFailures.length} errors` : ''}`,
      detail: 'Assign live shader profiles, inspect surface coverage, and manage the dedicated shader authoring folder apart from animations.',
      icon: <Sparkles size={14} />,
    },
    {
      key: 'animations',
      label: 'Animations',
      subtitle: 'Open and close motion modules.',
      summary: `${availableAnimations.length} modules${animationFailures.length > 0 ? ` · ${animationFailures.length} errors` : ''}`,
      detail: 'Browse built-in and authored animation modules, assign the live open/close bindings, and manage the animation authoring folder.',
      icon: <RotateCcw size={14} />,
    },
    {
      key: 'terminal',
      label: 'Terminal',
      subtitle: 'Shell defaults and external handoff.',
      summary: `${settings.terminal.preferredOpenMode} · ${settings.terminal.cursorStyle} cursor`,
      detail: 'Control the integrated terminal, its typography, and how commands hand off to external shells.',
      icon: <TerminalSquare size={14} />,
    },
    {
      key: 'explorer',
      label: 'Explorer',
      subtitle: 'Startup path, file visibility, and folder rules.',
      summary: `${settings.explorer.folderClickMode === 'single' ? 'Single-click folders' : 'Double-click folders'} · ${settings.explorer.folderIconRules.length} icon rules`,
      detail: 'Shape the file browser around your machine, including startup path, folder activation behavior, and icon rules.',
      icon: <FolderOpen size={14} />,
    },
    {
      key: 'layouts',
      label: 'Layouts',
      subtitle: 'Workbench profiles and shell chrome.',
      summary: `${activeLayoutProfile.label} · ${layoutManifestState.manifest.profiles.length} profiles`,
      detail: 'Switch between shell profiles, point at external manifests, and control the workbench shape at the layout level.',
      icon: <LayoutGrid size={14} />,
    },
    {
      key: 'hotkeys',
      label: 'Hotkeys',
      subtitle: 'Overlay opener and gesture bindings.',
      summary: [settings.keybindings.terminalToggle, settings.keybindings.terminalFocus]
        .map(formatHotkeyLabel)
        .join(' · '),
      detail: 'Keep the overlay easy to summon, jump straight to the terminal panel, and remap the first global gestures without digging through raw config.',
      icon: <SlidersHorizontal size={14} />,
    },
    {
      key: 'system',
      label: 'System',
      subtitle: 'Startup and OS integration status.',
      summary: [
        settings.system.launchAtStartup ? 'Startup on' : 'Startup off',
        settings.system.hideAppInTray ? 'Tray on' : 'Tray off',
        settings.system.showInTaskbar ? 'Taskbar on' : 'Taskbar off',
      ].join(' · '),
      detail: 'Handle machine-level behavior like login launch and other desktop integration concerns in one place.',
      icon: <Settings2 size={14} />,
    },
    {
      key: 'theme-json',
      label: 'Theme JSON',
      subtitle: 'Raw theme authoring and import.',
      summary: 'Direct JSON editing',
      detail: 'Paste, tweak, and version full theme definitions directly when presets and token pickers are not enough.',
      icon: <Type size={14} />,
    },
  ];
  const activeSectionMeta = settingsSections.find(section => section.key === activeSection) ?? settingsSections[0];

  return (
    <div
      style={{
        display: 'flex',
        height: '100%',
        minHeight: 0,
        minWidth: 0,
        fontFamily: appearance.fonts.ui,
        background: `linear-gradient(180deg, ${effectiveTheme.palette.appBackgroundAlt} 0%, ${panelBackground} 100%)`,
      }}
    >
      <ResizablePane
        size={railWidth}
        minSize={190}
        maxSize={320}
        onSizeChange={setRailWidth}
        borderColor={`${accent}55`}
        style={{ display: 'flex', minHeight: 0, flexDirection: 'column', borderRight: `1px solid ${border}`, background: 'rgba(255,255,255,0.02)' }}
      >
        <div className="border-b px-4 py-3" style={{ borderColor: border }}>
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em]" style={{ color: muted }}>
            <SlidersHorizontal size={12} />
            <span>Workbench Settings</span>
          </div>
          <h1 className="mt-1.5 text-[16px] font-semibold leading-none" style={{ color: text }}>Settings</h1>
        </div>

        <OverlayScrollArea style={{ flex: 1, minHeight: 0 }} viewportStyle={{ padding: '8px 10px 10px 10px' }}>
          <div className="space-y-2">
            {settingsSections.map(section => (
              <SettingsRailButton
                key={section.key}
                active={activeSection === section.key}
                icon={section.icon}
                label={section.label}
                subtitle={section.subtitle}
                summary={section.summary}
                accent={accent}
                border={border}
                text={text}
                muted={muted}
                onClick={() => setActiveSection(section.key)}
              />
            ))}
          </div>
        </OverlayScrollArea>
      </ResizablePane>

      <main className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="border-b px-4 py-3" style={{ borderColor: border }}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="min-w-[240px] flex-1 text-[11px] leading-4" style={{ color: muted }}>
                {activeSectionMeta.detail}
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
              <span
                className="rounded px-2.5 py-1.5 text-[9px] font-semibold uppercase tracking-[0.12em]"
                style={{ border: `1px solid ${border}`, color: muted, background: 'rgba(255,255,255,0.03)' }}
              >
                Theme · {effectiveTheme.name}
              </span>
              <span
                className="rounded px-2.5 py-1.5 text-[9px] font-semibold uppercase tracking-[0.12em]"
                style={{ border: `1px solid ${border}`, color: muted, background: 'rgba(255,255,255,0.03)' }}
              >
                Layout · {activeLayoutProfile.label}
              </span>
              <span
                className="rounded px-2.5 py-1.5 text-[9px] font-semibold uppercase tracking-[0.12em]"
                style={{ border: `1px solid ${border}`, color: muted, background: 'rgba(255,255,255,0.03)' }}
              >
                Startup · {settings.system.launchAtStartup ? 'Enabled' : 'Disabled'}
              </span>
              <span
                className="hidden rounded px-2.5 py-1.5 text-[9px] font-semibold uppercase tracking-[0.12em] xl:inline-flex"
                style={{ border: `1px solid ${border}`, color: muted, background: 'rgba(255,255,255,0.03)' }}
              >
                {activeSectionMeta.summary}
              </span>
              <button
                onClick={() => resetToDefaults()}
                className="inline-flex items-center gap-1.5 rounded px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] transition-colors"
                style={{ border: `1px solid ${border}`, color: text, background: 'rgba(255,255,255,0.04)' }}
              >
                <RotateCcw size={12} />
                Reset Defaults
              </button>
            </div>
          </div>
        </div>

        <OverlayScrollArea style={{ flex: 1, minHeight: 0 }} viewportStyle={{ padding: 12 }}>
          <div className="mx-auto flex w-full max-w-[1080px] flex-col gap-3 pb-5">
            {activeSection === 'appearance' && (
              <section className="rounded border p-4" style={{ borderColor: border, background: 'rgba(255,255,255,0.03)' }}>
            <SectionTitle
              icon={<Palette size={12} />}
              title="Appearance"
              subtitle="Theme presets, UI fonts, and direct palette editing."
            />

            <div className="mt-4 space-y-4">
              <div className="rounded border p-3" style={{ borderColor: border, background: 'rgba(255,255,255,0.025)' }}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-60">Theme Packages</div>
                    <p className="mt-1 text-[11px] opacity-40">
                      Drop packaged themes into <code>{themePackagesDirectory}</code> and Greeble will discover them as first-class themes with assets and visuals.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void onOpenThemesFolder()}
                      className="rounded px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em]"
                      style={{ border: `1px solid ${border}`, background: 'rgba(255,255,255,0.04)', color: text }}
                    >
                      Open Folder
                    </button>
                    <button
                      type="button"
                      onClick={() => void onRefreshThemes()}
                      className="inline-flex items-center gap-1.5 rounded px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em]"
                      style={{ border: `1px solid ${accent}`, background: `${accent}18`, color: text }}
                    >
                      <RefreshCw size={10} />
                      Refresh
                    </button>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px]">
                  <span className="rounded border px-2 py-1 font-semibold uppercase tracking-[0.12em]" style={{ borderColor: border, background: 'rgba(255,255,255,0.04)', color: text }}>
                    {themePackagesLoading ? 'Scanning Packages' : `${themePackages.length} Package${themePackages.length === 1 ? '' : 's'} Loaded`}
                  </span>
                  <span className="rounded border px-2 py-1 font-semibold uppercase tracking-[0.12em]" style={{ borderColor: border, background: 'rgba(255,255,255,0.04)', color: muted }}>
                    Active Source: {getThemeSourceLabel(editableTheme)}
                  </span>
                </div>

                {themePackagesError && (
                  <div className="mt-3 rounded border px-3 py-2 text-[11px]" style={{ borderColor: '#7f1d1d', background: 'rgba(127,29,29,0.18)', color: '#fecaca' }}>
                    Theme package scan failed: {themePackagesError}
                  </div>
                )}
              </div>

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
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[11px] font-medium">{themeOption.name}</div>
                          <div className="truncate text-[9px] uppercase tracking-[0.12em] opacity-45">{getThemeSourceLabel(themeOption)}</div>
                        </div>
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

              <label className="flex items-center justify-between rounded border px-3 py-2 text-[11px]" style={{ borderColor: border }}>
                <div>
                  <div className="font-semibold uppercase tracking-[0.12em] opacity-60">Native OS Icons</div>
                  <p className="mt-1 text-[11px] opacity-40">
                    Use {platformLabel}&apos;s current file and folder icons in the explorer when available. Theme icons stay in place as the fallback layer.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.appearance.useNativeOsIcons}
                  onChange={event => updateAppearance({ useNativeOsIcons: event.target.checked })}
                />
              </label>

              <div className="grid grid-cols-2 gap-2">
                <ColorToken label="Accent" value={editableTheme.palette.accent} onChange={value => updateThemePalette({ accent: value, accentSoft: `${value}22` })} />
                <ColorToken label="App Background" value={editableTheme.palette.appBackground} onChange={value => updateThemePalette({ appBackground: value, shellBackgroundSolid: value })} />
                <ColorToken label="Panel" value={editableTheme.palette.panelBackground} onChange={value => updateThemePalette({ panelBackground: value, sidebarBackground: value })} />
                <ColorToken label="Text" value={editableTheme.palette.textPrimary} onChange={value => updateThemePalette({ textPrimary: value })} />
              </div>

              <div className="grid grid-cols-1 gap-2 xl:grid-cols-4">
                <RangeField
                  label="Window Opacity"
                  description="How translucent the overlay surface should feel."
                  min={overlayVisualControls.opacity.min}
                  max={overlayVisualControls.opacity.max}
                  step={overlayVisualControls.opacity.step}
                  value={settings.appearance.appOpacity}
                  valueLabel={formatOverlayVisualControlValue('opacity', settings.appearance.appOpacity)}
                  onChange={value => updateAppearance({ appOpacity: clampOverlayVisualControlValue('opacity', value) })}
                />
                <RangeField
                  label="Panel Transparency"
                  description="Fade panel chrome away while keeping the actual panel content readable."
                  min={overlayVisualControls.panelTransparency.min}
                  max={overlayVisualControls.panelTransparency.max}
                  step={overlayVisualControls.panelTransparency.step}
                  value={settings.appearance.panelTransparency}
                  valueLabel={formatOverlayVisualControlValue('panelTransparency', settings.appearance.panelTransparency)}
                  onChange={value => updateAppearance({ panelTransparency: clampOverlayVisualControlValue('panelTransparency', value) })}
                />
                <RangeField
                  label="Blur Strength"
                  description="Scale the glass softness separately from overall opacity so fully opaque shells can still feel frosted."
                  min={overlayVisualControls.blurStrength.min}
                  max={overlayVisualControls.blurStrength.max}
                  step={overlayVisualControls.blurStrength.step}
                  value={settings.appearance.appBlurStrength}
                  valueLabel={formatOverlayVisualControlValue('blurStrength', settings.appearance.appBlurStrength)}
                  onChange={value => updateAppearance({ appBlurStrength: clampOverlayVisualControlValue('blurStrength', value) })}
                />
                <RangeField
                  label="Window Zoom"
                  description="Scale the full overlay shell without changing monitor placement."
                  min={overlayVisualControls.zoom.min}
                  max={overlayVisualControls.zoom.max}
                  step={overlayVisualControls.zoom.step}
                  value={settings.appearance.appZoom}
                  valueLabel={formatOverlayVisualControlValue('zoom', settings.appearance.appZoom)}
                  onChange={value => updateAppearance({ appZoom: clampOverlayVisualControlValue('zoom', value) })}
                />
              </div>

              <label className="flex items-center justify-between rounded border px-3 py-2 text-[11px]" style={{ borderColor: border }}>
                <div>
                  <div className="font-semibold uppercase tracking-[0.12em] opacity-60">Native Glass Blur</div>
                  <p className="mt-1 text-[11px] opacity-40">Use compositor-backed window blur when the platform supports it, then tune the glass amount with Blur Strength.</p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.appearance.appBlur}
                  onChange={event => updateAppearance({ appBlur: event.target.checked })}
                />
              </label>
            </div>
          </section>
            )}

            {activeSection === 'shaders' && (
              <section className="rounded border p-4" style={{ borderColor: border, background: 'rgba(255,255,255,0.03)' }}>
            <SectionTitle
              icon={<Sparkles size={12} />}
              title="Shaders"
              subtitle="Dedicated shell shader profiles with a separate authoring/runtime path from motion."
            />

            <div className="mt-4 space-y-4">
              <div className="rounded border p-3" style={{ borderColor: border, background: 'rgba(255,255,255,0.025)' }}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-60">Shader Catalog</div>
                    <p className="mt-1 text-[11px] opacity-40">
                      Shader authoring lives in its own catalog now. Use this page to browse built-ins plus folder-authored profiles, inspect load failures, and choose whether the shell follows the theme default or a user override.
                    </p>
                  </div>
                  <span className="rounded border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ borderColor: border, background: 'rgba(255,255,255,0.04)', color: text }}>
                    Shader
                  </span>
                </div>

                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[10px]">
                  <div className="opacity-45">
                    {availableShaders.length} ready profiles
                    {shaderFailures.length > 0 ? ` · ${shaderFailures.length} failed loads` : ''}
                    {shadersLoading ? ' · refreshing…' : ''}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => void onRefreshShaders()}
                      className="inline-flex items-center gap-1.5 rounded border px-2.5 py-1.5 transition-colors"
                      style={{ borderColor: border, background: 'rgba(255,255,255,0.03)', color: text }}
                    >
                      <RefreshCw size={12} />
                      Refresh Shaders
                    </button>
                    <button
                      onClick={() => void onOpenShadersFolder()}
                      className="inline-flex items-center gap-1.5 rounded border px-2.5 py-1.5 transition-colors"
                      style={{ borderColor: accent, background: `${accent}16`, color: text }}
                    >
                      <FolderOpen size={12} />
                      Open Folder
                    </button>
                  </div>
                </div>

                <div className="mt-3 rounded border px-3 py-2 text-[11px]" style={{ borderColor: border, background: 'rgba(255,255,255,0.03)' }}>
                  <div className="font-semibold uppercase tracking-[0.12em] opacity-60">Authoring Folder</div>
                  <div className="mt-1 break-all opacity-55">{shadersDirectory}</div>
                  {shadersError && (
                    <div className="mt-2 rounded border px-2 py-1.5 text-[10px]" style={{ borderColor: 'rgba(245,158,11,0.35)', background: 'rgba(245,158,11,0.08)', color: text }}>
                      {shadersError}
                    </div>
                  )}
                </div>

                {shaderFailures.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {shaderFailures.map(shader => (
                      <div
                        key={`shader-error-${shader.filePath}`}
                        className="rounded border px-3 py-2"
                        style={{ borderColor: 'rgba(245,158,11,0.35)', background: 'rgba(245,158,11,0.08)', color: text }}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-[11px] font-semibold">{shader.name}</div>
                          <span className="text-[9px] uppercase tracking-[0.12em] opacity-55">Load Error</span>
                        </div>
                        <div className="mt-1 break-all text-[10px] opacity-55">{shader.filePath}</div>
                        <pre className="mt-2 whitespace-pre-wrap text-[10px] leading-4 opacity-80">{shader.error}</pre>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1.2fr_0.8fr]">
                <div className="rounded border p-3" style={{ borderColor: border, background: 'rgba(255,255,255,0.025)' }}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-60">Live Assignment</div>
                      <p className="mt-1 text-[11px] opacity-40">
                        A user override wins over the active theme. Clearing the override hands control back to the theme default, and unresolved IDs collapse safely to <code>none</code>.
                      </p>
                    </div>
                    <span className="rounded border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ borderColor: accent, background: `${accent}14`, color: accent }}>
                      {shaderSelectionSummary}
                    </span>
                  </div>

                  <div className="mt-3 grid grid-cols-1 gap-2">
                    <button
                      type="button"
                      onClick={() => updateAppearance({ activeShaderId: null })}
                      className="rounded px-3 py-2 text-left transition-colors"
                      style={{
                        border: `1px solid ${settings.appearance.activeShaderId == null ? accent : border}`,
                        background: settings.appearance.activeShaderId == null ? `${accent}16` : 'rgba(255,255,255,0.03)',
                        color: text,
                      }}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-semibold">Follow Theme Default</span>
                        <span className="text-[9px] uppercase tracking-[0.14em]" style={{ color: settings.appearance.activeShaderId == null ? accent : muted }}>
                          {appearance.baseTheme.defaultShaderId ?? 'none'}
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] opacity-45">
                        {appearance.baseTheme.defaultShaderId
                          ? `Active theme ${appearance.baseTheme.name} defaults to ${appearance.baseTheme.defaultShaderId}.`
                          : `Active theme ${appearance.baseTheme.name} does not define a shader, so the shell falls back to none.`}
                      </p>
                    </button>

                    {availableShaders.map(shader => {
                      const overrideActive = settings.appearance.activeShaderId === shader.id;
                      const effectiveActive = effectiveShaderId === shader.id;
                      const surfaceSummary = getShaderEnabledSurfaceIds(shader)
                        .map(surface => getOverlayShaderSurfaceLabel(surface))
                        .join(' · ');
                      return (
                        <button
                          key={`shader-${shader.id}`}
                          type="button"
                          onClick={() => updateAppearance({ activeShaderId: shader.id })}
                          className="rounded px-3 py-2 text-left transition-colors"
                          style={{
                            border: `1px solid ${overrideActive ? accent : border}`,
                            background: overrideActive ? `${accent}16` : 'rgba(255,255,255,0.03)',
                            color: text,
                          }}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[11px] font-semibold">{shader.name}</span>
                            <span className="text-[9px] uppercase tracking-[0.14em]" style={{ color: overrideActive ? accent : muted }}>
                              {shader.group}
                            </span>
                          </div>
                          <p className="mt-1 text-[11px] opacity-45">{shader.description ?? 'Shell shader profile.'}</p>
                          <div className="mt-2 flex flex-wrap items-center gap-2 text-[9px] uppercase tracking-[0.12em] opacity-55">
                            <span>{surfaceSummary || 'No Surfaces'}</span>
                            {shader.controls.length > 0 && <span>{shader.controls.length} Controls</span>}
                            {effectiveActive && <span style={{ color: accent }}>Live</span>}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="rounded border p-3" style={{ borderColor: border, background: 'rgba(255,255,255,0.025)' }}>
                    <div className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-60">Effective Shader</div>
                    <div className="mt-2 flex items-start justify-between gap-3">
                      <div>
                        <div className="text-[12px] font-semibold">{effectiveShader?.name ?? 'None'}</div>
                        <p className="mt-1 text-[11px] opacity-45">
                          {effectiveShader?.description ?? 'No shader surfaces are currently active.'}
                        </p>
                      </div>
                      <span className="rounded border px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.14em]" style={{ borderColor: border, color: muted }}>
                        {effectiveShader?.id ?? 'none'}
                      </span>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2 text-[9px] uppercase tracking-[0.12em]">
                      {(effectiveShader?.tags ?? []).map(tag => (
                        <span key={`shader-tag-${tag}`} className="rounded border px-2 py-1" style={{ borderColor: border, background: 'rgba(255,255,255,0.03)', color: muted }}>
                          {tag}
                        </span>
                      ))}
                      {(effectiveShader?.tags ?? []).length === 0 && (
                        <span className="opacity-45">No metadata tags</span>
                      )}
                    </div>
                  </div>

                  <div className="rounded border p-3" style={{ borderColor: border, background: 'rgba(255,255,255,0.025)' }}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-60">Shader Controls</div>
                        <p className="mt-1 text-[11px] opacity-45">
                          Shaders can expose their own live tweak set. Overrides are stored per shader, so changing profiles does not wipe a tuned setup for another one.
                        </p>
                      </div>
                      {effectiveShader && effectiveShader.controls.length > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            const nextShaderControlValues = { ...settings.appearance.shaderControlValues };
                            delete nextShaderControlValues[effectiveShader.id];
                            updateAppearance({ shaderControlValues: nextShaderControlValues });
                          }}
                          className="rounded border px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.12em]"
                          style={{ borderColor: border, background: 'rgba(255,255,255,0.04)', color: muted }}
                        >
                          Reset Shader
                        </button>
                      )}
                    </div>

                    {effectiveShader && effectiveShader.controls.length > 0 ? (
                      <div className="mt-3 space-y-2">
                        {effectiveShader.controls.map(control => (
                          <RangeField
                            key={`shader-control-${effectiveShader.id}-${control.id}`}
                            label={control.label}
                            description={control.description ?? `Live ${effectiveShader.name} control.`}
                            min={control.min}
                            max={control.max}
                            step={control.step}
                            value={effectiveShaderControlValues[control.id] ?? control.defaultValue ?? control.min}
                            valueLabel={formatShaderControlValue(
                              control,
                              effectiveShaderControlValues[control.id] ?? control.defaultValue ?? control.min,
                            )}
                            onChange={value => setShaderControlValue(effectiveShader, control, value)}
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="mt-3 rounded border px-3 py-2 text-[11px] opacity-55" style={{ borderColor: border, background: 'rgba(255,255,255,0.03)' }}>
                        {effectiveShader
                          ? `${effectiveShader.name} does not expose live controls yet. Add a \`controls\` array in the shader module to surface tweakable sliders here.`
                          : 'No shader is currently active, so there are no live controls to show.'}
                      </div>
                    )}
                  </div>

                  <div className="rounded border p-3" style={{ borderColor: border, background: 'rgba(255,255,255,0.025)' }}>
                    <div className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-60">Surface Coverage</div>
                    <div className="mt-3 grid grid-cols-1 gap-2">
                      {(['background', 'topBar', 'border'] as const).map(surface => {
                        const enabled = enabledShaderSurfaces.includes(surface);
                        return (
                          <div
                            key={`shader-surface-${surface}`}
                            className="rounded border px-3 py-2"
                            style={{
                              borderColor: enabled ? `${accent}55` : border,
                              background: enabled ? `${accent}12` : 'rgba(255,255,255,0.03)',
                              color: text,
                            }}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[11px] font-semibold">{getOverlayShaderSurfaceLabel(surface)}</span>
                              <span className="text-[9px] uppercase tracking-[0.12em]" style={{ color: enabled ? accent : muted }}>
                                {enabled ? 'Enabled' : 'Off'}
                              </span>
                            </div>
                            <p className="mt-1 text-[11px] opacity-45">
                              {enabled
                                ? `${effectiveShader?.name ?? 'Current shader'} actively renders this shell surface.`
                                : `${effectiveShader?.name ?? 'Current shader'} does not supply a renderer for this surface.`}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
            )}

            {activeSection === 'animations' && (
              <section className="rounded border p-4" style={{ borderColor: border, background: 'rgba(255,255,255,0.03)' }}>
            <SectionTitle
              icon={<RotateCcw size={12} />}
              title="Animations"
              subtitle="Built-in and authored motion modules with dedicated open and close bindings."
            />

            <div className="mt-4 space-y-4">
              <div className="rounded border p-3" style={{ borderColor: border, background: 'rgba(255,255,255,0.025)' }}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-60">Animation Modules</div>
                    <p className="mt-1 text-[11px] opacity-40">
                      Keep motion authoring separate from theme work. Browse modules here, assign live open and close bindings, and manage the animation folder without crowding the Appearance page.
                    </p>
                  </div>
                  <span className="rounded border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ borderColor: border, background: 'rgba(255,255,255,0.04)', color: text }}>
                    Motion
                  </span>
                </div>

                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[10px]">
                  <div className="opacity-45">
                    {availableAnimations.length} ready modules
                    {animationFailures.length > 0 ? ` · ${animationFailures.length} failed loads` : ''}
                    {animationsLoading ? ' · refreshing…' : ''}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => void onRefreshAnimations()}
                      className="inline-flex items-center gap-1.5 rounded border px-2.5 py-1.5 transition-colors"
                      style={{ borderColor: border, background: 'rgba(255,255,255,0.03)', color: text }}
                    >
                      <RefreshCw size={12} />
                      Refresh Motion
                    </button>
                    <button
                      onClick={() => void onOpenAnimationsFolder()}
                      className="inline-flex items-center gap-1.5 rounded border px-2.5 py-1.5 transition-colors"
                      style={{ borderColor: accent, background: `${accent}16`, color: text }}
                    >
                      <FolderOpen size={12} />
                      Open Folder
                    </button>
                  </div>
                </div>

                <div className="mt-3 rounded border px-3 py-2 text-[11px]" style={{ borderColor: border, background: 'rgba(255,255,255,0.03)' }}>
                  <div className="font-semibold uppercase tracking-[0.12em] opacity-60">Authoring Folder</div>
                  <div className="mt-1 break-all opacity-55">{animationsDirectory}</div>
                  {animationsError && (
                    <div className="mt-2 rounded border px-2 py-1.5 text-[10px]" style={{ borderColor: 'rgba(245,158,11,0.35)', background: 'rgba(245,158,11,0.08)', color: text }}>
                      {animationsError}
                    </div>
                  )}
                </div>

                {animationFailures.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {animationFailures.map(animation => (
                      <div
                        key={`animation-error-${animation.filePath}`}
                        className="rounded border px-3 py-2"
                        style={{ borderColor: 'rgba(245,158,11,0.35)', background: 'rgba(245,158,11,0.08)', color: text }}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-[11px] font-semibold">{animation.name}</div>
                          <span className="text-[9px] uppercase tracking-[0.12em] opacity-55">Load Error</span>
                        </div>
                        <div className="mt-1 break-all text-[10px] opacity-55">{animation.filePath}</div>
                        <pre className="mt-2 whitespace-pre-wrap text-[10px] leading-4 opacity-80">{animation.error}</pre>
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-50">Open Motion</label>
                    <div className="grid grid-cols-1 gap-2">
                      <button
                        onClick={() => updateAppearance({ appOpenAnimation: null })}
                        className="rounded px-3 py-2 text-left transition-colors"
                        style={{
                          border: `1px solid ${settings.appearance.appOpenAnimation == null ? accent : border}`,
                          background: settings.appearance.appOpenAnimation == null ? `${accent}16` : 'rgba(255,255,255,0.03)',
                          color: text,
                        }}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] font-semibold">Follow Theme Default</span>
                          <span className="text-[9px] uppercase tracking-[0.14em]" style={{ color: settings.appearance.appOpenAnimation == null ? accent : muted }}>
                            {effectiveOpenAnimationId}
                          </span>
                        </div>
                        <p className="mt-1 text-[11px] opacity-45">
                          {appearance.baseTheme.defaultOpenAnimationId
                            ? `Active theme ${appearance.baseTheme.name} defaults open motion to ${appearance.baseTheme.defaultOpenAnimationId}.`
                            : `Active theme ${appearance.baseTheme.name} does not define open motion, so OverlayTerm falls back to ${animationSystemConfig.defaultOpenAnimationId}.`}
                        </p>
                      </button>
                      {openAnimationOptions.map(animation => {
                        const active = settings.appearance.appOpenAnimation === animation.id;
                        return (
                          <button
                            key={`open-${animation.id}`}
                            onClick={() => updateAppearance({ appOpenAnimation: animation.id })}
                            className="rounded px-3 py-2 text-left transition-colors"
                            style={{
                              border: `1px solid ${active ? accent : border}`,
                              background: active ? `${accent}16` : 'rgba(255,255,255,0.03)',
                              color: text,
                            }}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[11px] font-semibold">{animation.name}</span>
                              <span className="text-[9px] uppercase tracking-[0.14em]" style={{ color: active ? accent : muted }}>
                                {animation.group}
                              </span>
                            </div>
                            <p className="mt-1 text-[11px] opacity-45">{animation.description ?? 'Authored window opening motion module.'}</p>
                          </button>
                        );
                      })}
                      {openAnimationOptions.length === 0 && (
                        <div className="rounded border px-3 py-2 text-[11px] opacity-45" style={{ borderColor: border, background: 'rgba(255,255,255,0.03)' }}>
                          No open-capable motion modules loaded yet.
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-50">Close Motion</label>
                    <div className="grid grid-cols-1 gap-2">
                      <button
                        onClick={() => updateAppearance({ appCloseAnimation: null })}
                        className="rounded px-3 py-2 text-left transition-colors"
                        style={{
                          border: `1px solid ${settings.appearance.appCloseAnimation == null ? accent : border}`,
                          background: settings.appearance.appCloseAnimation == null ? `${accent}16` : 'rgba(255,255,255,0.03)',
                          color: text,
                        }}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] font-semibold">Follow Theme Default</span>
                          <span className="text-[9px] uppercase tracking-[0.14em]" style={{ color: settings.appearance.appCloseAnimation == null ? accent : muted }}>
                            {effectiveCloseAnimationId}
                          </span>
                        </div>
                        <p className="mt-1 text-[11px] opacity-45">
                          {appearance.baseTheme.defaultCloseAnimationId
                            ? `Active theme ${appearance.baseTheme.name} defaults close motion to ${appearance.baseTheme.defaultCloseAnimationId}.`
                            : `Active theme ${appearance.baseTheme.name} does not define close motion, so OverlayTerm falls back to ${animationSystemConfig.defaultCloseAnimationId}.`}
                        </p>
                      </button>
                      {closeAnimationOptions.map(animation => {
                        const active = settings.appearance.appCloseAnimation === animation.id;
                        return (
                          <button
                            key={`close-${animation.id}`}
                            onClick={() => updateAppearance({ appCloseAnimation: animation.id })}
                            className="rounded px-3 py-2 text-left transition-colors"
                            style={{
                              border: `1px solid ${active ? accent : border}`,
                              background: active ? `${accent}16` : 'rgba(255,255,255,0.03)',
                              color: text,
                            }}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[11px] font-semibold">{animation.name}</span>
                              <span className="text-[9px] uppercase tracking-[0.14em]" style={{ color: active ? accent : muted }}>
                                {animation.group}
                              </span>
                            </div>
                            <p className="mt-1 text-[11px] opacity-45">{animation.description ?? 'Authored window closing motion module.'}</p>
                          </button>
                        );
                      })}
                      {closeAnimationOptions.length === 0 && (
                        <div className="rounded border px-3 py-2 text-[11px] opacity-45" style={{ borderColor: border, background: 'rgba(255,255,255,0.03)' }}>
                          No close-capable motion modules loaded yet.
                        </div>
                      )}
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
            )}

            {activeSection === 'hotkeys' && (
              <section className="rounded border p-4" style={{ borderColor: border, background: 'rgba(255,255,255,0.03)' }}>
            <SectionTitle
              icon={<TerminalSquare size={12} />}
              title="Hotkeys"
              subtitle="Keep the overlay opener configurable and expose the first global gesture controls."
            />

            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
              {hotkeyBindingDefinitions
                .filter(definition => definition.scope === 'global' || definition.scope === 'gesture')
                .map(definition => (
                  <ShortcutField
                    key={definition.key}
                    bindingKey={definition.key}
                    value={settings.keybindings[definition.key]}
                    onCommit={value => updateKeybindings({ [definition.key]: value })}
                  />
                ))}
            </div>
          </section>
            )}

            {activeSection === 'terminal' && (
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
            )}

            {activeSection === 'layouts' && (
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
                  placeholder="Leave blank to probe ~/.greeble/greeble.layouts.json or .toml"
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
                      Click a profile to switch the entire workbench layout. The Greeble button still cycles this same ordered set.
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
            )}

            {activeSection === 'system' && (
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
                    Registers Greeble as a login item so the tray and overlay are available after sign-in.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.system.launchAtStartup}
                  disabled={startupSyncPending}
                  onChange={event => void setLaunchAtStartup(event.target.checked)}
                />
              </label>
              <label className="flex items-center justify-between rounded border px-3 py-3 text-[11px]" style={{ borderColor: border }}>
                <div>
                  <div className="font-semibold uppercase tracking-[0.12em] opacity-60">Hide App In Tray</div>
                  <p className="mt-1 text-[11px] opacity-40">
                    Keeps a {platform === 'macos' ? 'menu bar' : 'system tray'} entry available so the overlay can stay resident when the main window is hidden.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.system.hideAppInTray}
                  disabled={!settings.system.showInTaskbar && settings.system.hideAppInTray}
                  onChange={event => setHideAppInTray(event.target.checked)}
                />
              </label>
              <label className="flex items-center justify-between rounded border px-3 py-3 text-[11px]" style={{ borderColor: border }}>
                <div>
                  <div className="font-semibold uppercase tracking-[0.12em] opacity-60">Show In Taskbar</div>
                  <p className="mt-1 text-[11px] opacity-40">
                    Shows the main window in the {platform === 'macos' ? 'Dock' : 'taskbar'} while the overlay is running. Dev mode defaults this on so `tauri dev` stays easy to find.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.system.showInTaskbar}
                  disabled={!settings.system.hideAppInTray && settings.system.showInTaskbar}
                  onChange={event => setShowInTaskbar(event.target.checked)}
                />
              </label>
              <div className="rounded border px-3 py-2 text-[11px]" style={{ borderColor: border, background: 'rgba(255,255,255,0.025)', color: startupSyncError ? '#fda4af' : muted }}>
                {startupSyncPending
                  ? 'Updating OS startup registration...'
                  : startupSyncError
                    ? `Startup registration failed: ${startupSyncError}`
                  : `Current status: startup ${settings.system.launchAtStartup ? 'enabled' : 'disabled'} · tray ${settings.system.hideAppInTray ? 'enabled' : 'disabled'} · ${platform === 'macos' ? 'Dock' : 'taskbar'} ${settings.system.showInTaskbar ? 'enabled' : 'disabled'}`}
              </div>
            </div>
          </section>
            )}

            {activeSection === 'explorer' && (
              <section className="rounded border p-4" style={{ borderColor: border, background: 'rgba(255,255,255,0.03)' }}>
            <SectionTitle
              icon={<FolderOpen size={12} />}
              title="Explorer"
              subtitle="Startup path, folder activation, visibility rules, and bookmark quality-of-life."
            />

            <div className="mt-4 space-y-3">
              <div className="rounded border p-3" style={{ borderColor: border, background: 'rgba(255,255,255,0.025)' }}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-60">File Clicking</div>
                    <p className="mt-1 text-[11px] opacity-40">
                      Choose how folders activate in the browser. Files still preview on single click and open on double click.
                    </p>
                  </div>
                  <span className="rounded border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ borderColor: border, background: 'rgba(255,255,255,0.04)', color: text }}>
                    {settings.explorer.folderClickMode === 'single' ? 'Single Click' : 'Double Click'}
                  </span>
                </div>

                <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
                  {([
                    {
                      value: 'single',
                      label: 'Single Click',
                      description: 'Open folders on the first plain click, closer to a content-browser flow.',
                    },
                    {
                      value: 'double',
                      label: 'Double Click',
                      description: 'Keep folders selection-first and require a second click to enter them.',
                    },
                  ] as const).map(option => {
                    const active = settings.explorer.folderClickMode === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => updateExplorer({ folderClickMode: option.value })}
                        className="rounded px-3 py-3 text-left transition-colors"
                        style={{
                          border: `1px solid ${active ? accent : border}`,
                          background: active ? `${accent}14` : 'rgba(255,255,255,0.03)',
                          color: text,
                        }}
                      >
                        <div className="text-[11px] font-semibold">{option.label}</div>
                        <p className="mt-1 text-[11px] opacity-45">{option.description}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

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
                      src={getNamedFolderIconSrc(settings.explorer.defaultFolderIcon, false, themeIconTheme)}
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
                            src={getNamedFolderIconSrc(rule.icon, false, themeIconTheme)}
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
                  <OverlayScrollArea style={{ marginTop: 12, maxHeight: 220 }} viewportStyle={{ paddingRight: 4 }}>
                  <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
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
                  </OverlayScrollArea>
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
            )}

            {activeSection === 'theme-json' && (
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
                  onClick={() => setThemeDraft(serializeTheme(appearance.baseTheme))}
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
            )}
          </div>
        </OverlayScrollArea>
      </main>
    </div>
  );
}
