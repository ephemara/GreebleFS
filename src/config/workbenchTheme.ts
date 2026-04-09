import type {
  ThemeChromeStyle,
  ThemeDensity,
} from '../generated/tauri';
import type { OverlayThemeDefinition } from './appearance';
import {
  readThemeNumberProp,
  resolveThemeEngineBindings,
} from './themeEngineBindings';

export type OverlayWorkbenchThemePreset = 'workbench' | 'xmb' | 'channel-grid' | 'custom';
export type OverlayWorkbenchChromeStyle = 'solid' | 'glass' | 'floating' | 'minimal';
export type OverlayWorkbenchPanelStyle = 'solid' | 'glass' | 'floating';
export type OverlayWorkbenchTabStyle = 'underline' | 'capsule' | 'segment';

export interface OverlayWorkbenchThemeMetrics {
  chromeHeight?: number;
  controlRadius?: number;
  panelRadius?: number;
  shellInset?: number;
  commandPaletteWidth?: number;
  commandPaletteTopInset?: number;
  pagePadding?: number;
  panelGap?: number;
}

export interface OverlayWorkbenchThemeSurfaces {
  shellBackground?: string;
  chromeBackground?: string;
  chromeMenuBackground?: string;
  chromeBorder?: string;
  chromeButtonBackground?: string;
  chromeButtonHoverBackground?: string;
  chromeButtonActiveBackground?: string;
  chromeButtonActiveBorder?: string;
  chromeTabBackground?: string;
  chromeTabActiveBackground?: string;
  chromeTabBorder?: string;
  shellShadow?: string;
  commandPaletteScrimBackground?: string;
  commandPaletteBackground?: string;
  commandPaletteBorder?: string;
  commandPaletteInputBackground?: string;
  commandPaletteItemBackground?: string;
  commandPaletteItemActiveBackground?: string;
  settingsBackground?: string;
  settingsRailBackground?: string;
  settingsCardBackground?: string;
  settingsCardBorder?: string;
  settingsBadgeBackground?: string;
  settingsBadgeBorder?: string;
  terminalBackground?: string;
  terminalPanelBackground?: string;
  terminalPaneBackground?: string;
  terminalBorder?: string;
  terminalStatusBackground?: string;
}

export interface OverlayWorkbenchThemeTypography {
  chromeLabelSize?: number;
  chromeMetaSize?: number;
  tabLabelSize?: number;
  pageTitleSize?: number;
  pageBodySize?: number;
  badgeSize?: number;
  labelLetterSpacing?: string;
}

export interface OverlayWorkbenchThemeRecipe {
  preset?: OverlayWorkbenchThemePreset;
  brandLabel?: string;
  layoutPrimitiveId?: string;
  navigationPatternId?: string;
  renderStyleId?: string;
  topBarStyle?: OverlayWorkbenchChromeStyle;
  panelStyle?: OverlayWorkbenchPanelStyle;
  commandPaletteStyle?: OverlayWorkbenchPanelStyle;
  terminalStyle?: OverlayWorkbenchPanelStyle;
  settingsStyle?: OverlayWorkbenchPanelStyle;
  tabStyle?: OverlayWorkbenchTabStyle;
  metrics?: OverlayWorkbenchThemeMetrics;
  surfaces?: OverlayWorkbenchThemeSurfaces;
  typography?: OverlayWorkbenchThemeTypography;
  cssVars?: Record<string, string>;
}

export interface ResolvedWorkbenchThemeRecipe {
  preset: OverlayWorkbenchThemePreset;
  brandLabel: string;
  layoutPrimitiveId: string | null;
  navigationPatternId: string | null;
  renderStyleId: string | null;
  topBarStyle: OverlayWorkbenchChromeStyle;
  panelStyle: OverlayWorkbenchPanelStyle;
  commandPaletteStyle: OverlayWorkbenchPanelStyle;
  terminalStyle: OverlayWorkbenchPanelStyle;
  settingsStyle: OverlayWorkbenchPanelStyle;
  tabStyle: OverlayWorkbenchTabStyle;
  metrics: Required<OverlayWorkbenchThemeMetrics>;
  surfaces: Required<OverlayWorkbenchThemeSurfaces>;
  typography: Required<OverlayWorkbenchThemeTypography>;
  cssVars: Record<string, string>;
}

const defaultMetrics: Required<OverlayWorkbenchThemeMetrics> = {
  chromeHeight: 36,
  controlRadius: 6,
  panelRadius: 14,
  shellInset: 0,
  commandPaletteWidth: 760,
  commandPaletteTopInset: 56,
  pagePadding: 12,
  panelGap: 10,
};

const defaultSurfaces: Required<OverlayWorkbenchThemeSurfaces> = {
  shellBackground: 'var(--overlay-bg-shell)',
  chromeBackground: 'var(--overlay-bg-topbar)',
  chromeMenuBackground: 'var(--overlay-bg-topbar-menu)',
  chromeBorder: 'var(--overlay-border)',
  chromeButtonBackground: 'rgba(255,255,255,0.025)',
  chromeButtonHoverBackground: 'rgba(255,255,255,0.06)',
  chromeButtonActiveBackground: 'color-mix(in srgb, var(--overlay-accent) 16%, transparent)',
  chromeButtonActiveBorder: 'color-mix(in srgb, var(--overlay-accent) 40%, var(--overlay-border))',
  chromeTabBackground: 'rgba(255,255,255,0.03)',
  chromeTabActiveBackground: 'color-mix(in srgb, var(--overlay-accent) 12%, transparent)',
  chromeTabBorder: 'var(--overlay-border)',
  shellShadow: 'var(--overlay-shadow)',
  commandPaletteScrimBackground: 'rgba(0, 0, 0, 0.36)',
  commandPaletteBackground: 'var(--overlay-bg-panel)',
  commandPaletteBorder: 'var(--overlay-border)',
  commandPaletteInputBackground: 'var(--overlay-bg-input)',
  commandPaletteItemBackground: 'rgba(255,255,255,0.02)',
  commandPaletteItemActiveBackground: 'color-mix(in srgb, var(--overlay-accent) 14%, transparent)',
  settingsBackground: 'linear-gradient(180deg, var(--overlay-bg-app-alt) 0%, var(--overlay-bg-panel) 100%)',
  settingsRailBackground: 'rgba(255,255,255,0.02)',
  settingsCardBackground: 'rgba(255,255,255,0.03)',
  settingsCardBorder: 'rgba(255,255,255,0.08)',
  settingsBadgeBackground: 'rgba(255,255,255,0.03)',
  settingsBadgeBorder: 'var(--overlay-border)',
  terminalBackground: 'var(--overlay-bg-shell)',
  terminalPanelBackground: 'var(--overlay-bg-panel)',
  terminalPaneBackground: 'var(--overlay-bg-terminal)',
  terminalBorder: 'var(--overlay-border)',
  terminalStatusBackground: 'color-mix(in srgb, var(--overlay-accent) 18%, transparent)',
};

const defaultTypography: Required<OverlayWorkbenchThemeTypography> = {
  chromeLabelSize: 11,
  chromeMetaSize: 8,
  tabLabelSize: 11,
  pageTitleSize: 16,
  pageBodySize: 11,
  badgeSize: 9,
  labelLetterSpacing: '0.08em',
};

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function asFiniteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function asTrimmedString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function normalizeCssVarRecord(value: Record<string, unknown> | undefined): Record<string, string> {
  if (!value) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value)
      .filter(([, entry]) => typeof entry === 'string' && entry.trim().length > 0),
  ) as Record<string, string>;
}

function compactObject<T extends object>(input: T | undefined): Partial<T> {
  if (!input) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined),
  ) as Partial<T>;
}

export function normalizeWorkbenchThemeRecipe(
  recipe?: OverlayWorkbenchThemeRecipe,
  fallback?: OverlayWorkbenchThemeRecipe,
): OverlayWorkbenchThemeRecipe | undefined {
  if (!recipe && !fallback) {
    return undefined;
  }

  const mergedMetrics = {
    ...(fallback?.metrics ?? {}),
    ...(recipe?.metrics ?? {}),
  };
  const mergedSurfaces = {
    ...(fallback?.surfaces ?? {}),
    ...(recipe?.surfaces ?? {}),
  };
  const mergedTypography = {
    ...(fallback?.typography ?? {}),
    ...(recipe?.typography ?? {}),
  };

  return {
    preset: recipe?.preset ?? fallback?.preset,
    brandLabel: asTrimmedString(recipe?.brandLabel) ?? asTrimmedString(fallback?.brandLabel),
    layoutPrimitiveId: asTrimmedString(recipe?.layoutPrimitiveId) ?? asTrimmedString(fallback?.layoutPrimitiveId),
    navigationPatternId: asTrimmedString(recipe?.navigationPatternId) ?? asTrimmedString(fallback?.navigationPatternId),
    renderStyleId: asTrimmedString(recipe?.renderStyleId) ?? asTrimmedString(fallback?.renderStyleId),
    topBarStyle: recipe?.topBarStyle ?? fallback?.topBarStyle,
    panelStyle: recipe?.panelStyle ?? fallback?.panelStyle,
    commandPaletteStyle: recipe?.commandPaletteStyle ?? fallback?.commandPaletteStyle,
    terminalStyle: recipe?.terminalStyle ?? fallback?.terminalStyle,
    settingsStyle: recipe?.settingsStyle ?? fallback?.settingsStyle,
    tabStyle: recipe?.tabStyle ?? fallback?.tabStyle,
    metrics: {
      chromeHeight: asFiniteNumber(mergedMetrics.chromeHeight),
      controlRadius: asFiniteNumber(mergedMetrics.controlRadius),
      panelRadius: asFiniteNumber(mergedMetrics.panelRadius),
      shellInset: asFiniteNumber(mergedMetrics.shellInset),
      commandPaletteWidth: asFiniteNumber(mergedMetrics.commandPaletteWidth),
      commandPaletteTopInset: asFiniteNumber(mergedMetrics.commandPaletteTopInset),
      pagePadding: asFiniteNumber(mergedMetrics.pagePadding),
      panelGap: asFiniteNumber(mergedMetrics.panelGap),
    },
    surfaces: {
      shellBackground: asTrimmedString(mergedSurfaces.shellBackground),
      chromeBackground: asTrimmedString(mergedSurfaces.chromeBackground),
      chromeMenuBackground: asTrimmedString(mergedSurfaces.chromeMenuBackground),
      chromeBorder: asTrimmedString(mergedSurfaces.chromeBorder),
      chromeButtonBackground: asTrimmedString(mergedSurfaces.chromeButtonBackground),
      chromeButtonHoverBackground: asTrimmedString(mergedSurfaces.chromeButtonHoverBackground),
      chromeButtonActiveBackground: asTrimmedString(mergedSurfaces.chromeButtonActiveBackground),
      chromeButtonActiveBorder: asTrimmedString(mergedSurfaces.chromeButtonActiveBorder),
      chromeTabBackground: asTrimmedString(mergedSurfaces.chromeTabBackground),
      chromeTabActiveBackground: asTrimmedString(mergedSurfaces.chromeTabActiveBackground),
      chromeTabBorder: asTrimmedString(mergedSurfaces.chromeTabBorder),
      shellShadow: asTrimmedString(mergedSurfaces.shellShadow),
      commandPaletteScrimBackground: asTrimmedString(mergedSurfaces.commandPaletteScrimBackground),
      commandPaletteBackground: asTrimmedString(mergedSurfaces.commandPaletteBackground),
      commandPaletteBorder: asTrimmedString(mergedSurfaces.commandPaletteBorder),
      commandPaletteInputBackground: asTrimmedString(mergedSurfaces.commandPaletteInputBackground),
      commandPaletteItemBackground: asTrimmedString(mergedSurfaces.commandPaletteItemBackground),
      commandPaletteItemActiveBackground: asTrimmedString(mergedSurfaces.commandPaletteItemActiveBackground),
      settingsBackground: asTrimmedString(mergedSurfaces.settingsBackground),
      settingsRailBackground: asTrimmedString(mergedSurfaces.settingsRailBackground),
      settingsCardBackground: asTrimmedString(mergedSurfaces.settingsCardBackground),
      settingsCardBorder: asTrimmedString(mergedSurfaces.settingsCardBorder),
      settingsBadgeBackground: asTrimmedString(mergedSurfaces.settingsBadgeBackground),
      settingsBadgeBorder: asTrimmedString(mergedSurfaces.settingsBadgeBorder),
      terminalBackground: asTrimmedString(mergedSurfaces.terminalBackground),
      terminalPanelBackground: asTrimmedString(mergedSurfaces.terminalPanelBackground),
      terminalPaneBackground: asTrimmedString(mergedSurfaces.terminalPaneBackground),
      terminalBorder: asTrimmedString(mergedSurfaces.terminalBorder),
      terminalStatusBackground: asTrimmedString(mergedSurfaces.terminalStatusBackground),
    },
    typography: {
      chromeLabelSize: asFiniteNumber(mergedTypography.chromeLabelSize),
      chromeMetaSize: asFiniteNumber(mergedTypography.chromeMetaSize),
      tabLabelSize: asFiniteNumber(mergedTypography.tabLabelSize),
      pageTitleSize: asFiniteNumber(mergedTypography.pageTitleSize),
      pageBodySize: asFiniteNumber(mergedTypography.pageBodySize),
      badgeSize: asFiniteNumber(mergedTypography.badgeSize),
      labelLetterSpacing: asTrimmedString(mergedTypography.labelLetterSpacing),
    },
    cssVars: {
      ...normalizeCssVarRecord(fallback?.cssVars),
      ...normalizeCssVarRecord(recipe?.cssVars),
    },
  };
}

function inferWorkbenchPreset(theme: OverlayThemeDefinition): OverlayWorkbenchThemePreset {
  const tags = new Set(
    (theme.compatibility?.tags ?? [])
      .map(entry => entry.trim().toLowerCase())
      .filter(Boolean),
  );

  if (tags.has('xmb') || tags.has('ps3') || tags.has('console')) {
    return 'xmb';
  }
  if (tags.has('wii') || tags.has('channels') || tags.has('springboard')) {
    return 'channel-grid';
  }
  return 'workbench';
}

function getPresetRecipe(preset: OverlayWorkbenchThemePreset): OverlayWorkbenchThemeRecipe {
  switch (preset) {
    case 'xmb':
      return {
        preset,
        brandLabel: 'Command Center',
        topBarStyle: 'floating',
        panelStyle: 'glass',
        commandPaletteStyle: 'glass',
        terminalStyle: 'glass',
        settingsStyle: 'glass',
        tabStyle: 'capsule',
        metrics: {
          chromeHeight: 40,
          controlRadius: 999,
          panelRadius: 24,
          shellInset: 12,
          commandPaletteWidth: 820,
          commandPaletteTopInset: 40,
          pagePadding: 14,
          panelGap: 12,
        },
        surfaces: {
          chromeBackground: 'color-mix(in srgb, var(--overlay-bg-topbar) 76%, transparent)',
          chromeMenuBackground: 'color-mix(in srgb, var(--overlay-bg-topbar-menu) 82%, transparent)',
          chromeBorder: 'color-mix(in srgb, var(--overlay-accent) 22%, var(--overlay-border))',
          chromeButtonBackground: 'color-mix(in srgb, var(--overlay-bg-panel) 74%, transparent)',
          chromeButtonHoverBackground: 'color-mix(in srgb, var(--overlay-accent) 16%, transparent)',
          chromeButtonActiveBackground: 'color-mix(in srgb, var(--overlay-accent) 18%, transparent)',
          chromeButtonActiveBorder: 'color-mix(in srgb, var(--overlay-accent) 42%, transparent)',
          chromeTabBackground: 'color-mix(in srgb, var(--overlay-bg-panel) 76%, transparent)',
          chromeTabActiveBackground: 'color-mix(in srgb, var(--overlay-accent) 16%, transparent)',
          chromeTabBorder: 'color-mix(in srgb, var(--overlay-accent) 18%, var(--overlay-border))',
          shellShadow: '0 18px 42px rgba(0,0,0,0.28)',
          commandPaletteScrimBackground: 'rgba(3, 6, 12, 0.42)',
          commandPaletteBackground: 'color-mix(in srgb, var(--overlay-bg-panel) 82%, transparent)',
          commandPaletteBorder: 'color-mix(in srgb, var(--overlay-accent) 26%, var(--overlay-border))',
          commandPaletteInputBackground: 'color-mix(in srgb, var(--overlay-bg-input) 78%, transparent)',
          commandPaletteItemBackground: 'color-mix(in srgb, var(--overlay-bg-panel) 78%, transparent)',
          commandPaletteItemActiveBackground: 'color-mix(in srgb, var(--overlay-accent) 18%, transparent)',
          settingsBackground: 'linear-gradient(180deg, color-mix(in srgb, var(--overlay-bg-app-alt) 90%, transparent) 0%, color-mix(in srgb, var(--overlay-bg-panel) 82%, transparent) 100%)',
          settingsRailBackground: 'color-mix(in srgb, var(--overlay-bg-sidebar) 74%, transparent)',
          settingsCardBackground: 'color-mix(in srgb, var(--overlay-bg-panel) 78%, transparent)',
          settingsCardBorder: 'color-mix(in srgb, var(--overlay-accent) 16%, var(--overlay-border))',
          settingsBadgeBackground: 'color-mix(in srgb, var(--overlay-bg-panel) 72%, transparent)',
          settingsBadgeBorder: 'color-mix(in srgb, var(--overlay-accent) 18%, var(--overlay-border))',
          terminalBackground: 'color-mix(in srgb, var(--overlay-bg-shell) 78%, transparent)',
          terminalPanelBackground: 'color-mix(in srgb, var(--overlay-bg-panel) 78%, transparent)',
          terminalPaneBackground: 'color-mix(in srgb, var(--overlay-bg-terminal) 84%, transparent)',
          terminalBorder: 'color-mix(in srgb, var(--overlay-accent) 16%, var(--overlay-border))',
          terminalStatusBackground: 'color-mix(in srgb, var(--overlay-accent) 16%, transparent)',
        },
      };
    case 'channel-grid':
      return {
        preset,
        brandLabel: 'Greeble Home',
        topBarStyle: 'minimal',
        panelStyle: 'floating',
        commandPaletteStyle: 'floating',
        terminalStyle: 'solid',
        settingsStyle: 'floating',
        tabStyle: 'capsule',
        metrics: {
          chromeHeight: 40,
          controlRadius: 18,
          panelRadius: 28,
          shellInset: 10,
          commandPaletteWidth: 780,
          commandPaletteTopInset: 46,
          pagePadding: 14,
          panelGap: 12,
        },
        surfaces: {
          chromeBackground: 'transparent',
          chromeMenuBackground: 'var(--overlay-bg-topbar-menu)',
          chromeBorder: 'color-mix(in srgb, var(--overlay-accent) 14%, var(--overlay-border))',
          chromeButtonBackground: 'rgba(255,255,255,0.45)',
          chromeButtonHoverBackground: 'rgba(255,255,255,0.7)',
          chromeButtonActiveBackground: 'color-mix(in srgb, var(--overlay-accent) 12%, white 18%)',
          chromeButtonActiveBorder: 'color-mix(in srgb, var(--overlay-accent) 42%, transparent)',
          chromeTabBackground: 'rgba(255,255,255,0.56)',
          chromeTabActiveBackground: 'rgba(255,255,255,0.9)',
          chromeTabBorder: 'color-mix(in srgb, var(--overlay-accent) 12%, var(--overlay-border))',
          shellShadow: '0 16px 34px rgba(0,0,0,0.14)',
          commandPaletteScrimBackground: 'rgba(8, 15, 28, 0.18)',
          commandPaletteBackground: 'rgba(255,255,255,0.92)',
          commandPaletteBorder: 'color-mix(in srgb, var(--overlay-accent) 16%, var(--overlay-border))',
          commandPaletteInputBackground: 'rgba(255,255,255,0.7)',
          commandPaletteItemBackground: 'rgba(255,255,255,0.48)',
          commandPaletteItemActiveBackground: 'color-mix(in srgb, var(--overlay-accent) 12%, white 24%)',
          settingsBackground: 'linear-gradient(180deg, color-mix(in srgb, var(--overlay-bg-app-alt) 92%, white 8%) 0%, color-mix(in srgb, var(--overlay-bg-panel) 94%, white 6%) 100%)',
          settingsRailBackground: 'rgba(255,255,255,0.4)',
          settingsCardBackground: 'rgba(255,255,255,0.58)',
          settingsCardBorder: 'color-mix(in srgb, var(--overlay-accent) 12%, var(--overlay-border))',
          settingsBadgeBackground: 'rgba(255,255,255,0.52)',
          settingsBadgeBorder: 'color-mix(in srgb, var(--overlay-accent) 12%, var(--overlay-border))',
          terminalBackground: 'var(--overlay-bg-shell)',
          terminalPanelBackground: 'var(--overlay-bg-panel)',
          terminalPaneBackground: 'var(--overlay-bg-terminal)',
          terminalBorder: 'var(--overlay-border)',
          terminalStatusBackground: 'rgba(255,255,255,0.08)',
        },
      };
    case 'custom':
      return {
        preset,
        brandLabel: 'Command Center',
        topBarStyle: 'solid',
        panelStyle: 'solid',
        commandPaletteStyle: 'solid',
        terminalStyle: 'solid',
        settingsStyle: 'solid',
        tabStyle: 'underline',
      };
    default:
      return {
        preset: 'workbench',
        brandLabel: 'Command Center',
        topBarStyle: 'solid',
        panelStyle: 'solid',
        commandPaletteStyle: 'solid',
        terminalStyle: 'solid',
        settingsStyle: 'solid',
        tabStyle: 'underline',
      };
  }
}

function inferWorkbenchPresetFromEngine(theme: OverlayThemeDefinition): OverlayWorkbenchThemePreset | undefined {
  const bindings = resolveThemeEngineBindings(theme.compiledEngineManifest, theme.workbench);
  const renderKind = bindings.renderStyle?.kind;
  if (renderKind === 'ps-3-xmb') {
    return 'xmb';
  }
  if (renderKind === 'wii-channels' || renderKind === 'ios-springboard') {
    return 'channel-grid';
  }
  if (bindings.navigationPattern?.kind === 'xmb') {
    return 'xmb';
  }
  if (bindings.layoutPrimitive?.kind === 'grid' && bindings.navigationPattern?.kind === 'spatial') {
    return 'channel-grid';
  }
  return undefined;
}

function createWorkbenchStyleSeed(
  chromeStyle: ThemeChromeStyle | null | undefined,
): Pick<
  OverlayWorkbenchThemeRecipe,
  'topBarStyle' | 'panelStyle' | 'commandPaletteStyle' | 'terminalStyle' | 'settingsStyle'
> {
  switch (chromeStyle) {
    case 'floating':
      return {
        topBarStyle: 'floating',
        panelStyle: 'floating',
        commandPaletteStyle: 'floating',
        terminalStyle: 'floating',
        settingsStyle: 'floating',
      };
    case 'minimal':
      return {
        topBarStyle: 'minimal',
        panelStyle: 'floating',
        commandPaletteStyle: 'floating',
        terminalStyle: 'solid',
        settingsStyle: 'floating',
      };
    case 'ornate':
      return {
        topBarStyle: 'glass',
        panelStyle: 'glass',
        commandPaletteStyle: 'glass',
        terminalStyle: 'glass',
        settingsStyle: 'glass',
      };
    default:
      return {
        topBarStyle: 'solid',
        panelStyle: 'solid',
        commandPaletteStyle: 'solid',
        terminalStyle: 'solid',
        settingsStyle: 'solid',
      };
  }
}

function getDensityMetricDelta(density: ThemeDensity | null | undefined): number {
  switch (density) {
    case 'compact':
      return -2;
    case 'immersive':
      return 4;
    default:
      return 0;
  }
}

function createWorkbenchEngineRecipe(theme: OverlayThemeDefinition): OverlayWorkbenchThemeRecipe {
  if (!theme.compiledEngineManifest) {
    return {};
  }

  const bindings = resolveThemeEngineBindings(theme.compiledEngineManifest, theme.workbench);
  const presentation = bindings.presentation;
  const layoutPrimitive = bindings.layoutPrimitive;
  const navigationPattern = bindings.navigationPattern;
  const renderStyle = bindings.renderStyle;
  const styleSeed = createWorkbenchStyleSeed(presentation?.chromeStyle);
  const densityMetricDelta = getDensityMetricDelta(presentation?.density);
  const panelSpacing = clampNumber(
    Math.round(presentation?.panelSpacing ?? defaultMetrics.panelGap),
    4,
    24,
  );
  const cornerRadius = clampNumber(
    Math.round(presentation?.cornerRadius ?? defaultMetrics.panelRadius),
    4,
    999,
  );
  const layoutGap = clampNumber(
    Math.round(
      readThemeNumberProp(layoutPrimitive?.props, 'gap')
      ?? readThemeNumberProp(layoutPrimitive?.props, 'gutter')
      ?? panelSpacing,
    ),
    4,
    32,
  );

  let topBarStyle = styleSeed.topBarStyle;
  let panelStyle = styleSeed.panelStyle;
  let commandPaletteStyle = styleSeed.commandPaletteStyle;
  let terminalStyle = styleSeed.terminalStyle;
  let settingsStyle = styleSeed.settingsStyle;
  let tabStyle: OverlayWorkbenchTabStyle = navigationPattern?.kind === 'tabbed'
    ? 'segment'
    : navigationPattern?.kind === 'hierarchy'
      ? 'underline'
      : navigationPattern?.kind === 'spatial' || navigationPattern?.kind === 'xmb'
        ? 'capsule'
        : 'underline';
  let chromeHeight = defaultMetrics.chromeHeight + densityMetricDelta;
  let controlRadius = cornerRadius;
  let panelRadius = clampNumber(Math.max(cornerRadius, 8), 8, 48);
  let shellInset = presentation?.chromeStyle === 'floating'
    ? panelSpacing
    : presentation?.chromeStyle === 'minimal'
      ? Math.round(panelSpacing * 0.5)
      : 0;
  let commandPaletteWidth = layoutPrimitive?.kind === 'grid'
    ? 840
    : layoutPrimitive?.kind === 'freeform'
      ? 800
      : layoutPrimitive?.kind === 'split'
        ? 780
        : defaultMetrics.commandPaletteWidth;
  let commandPaletteTopInset = defaultMetrics.commandPaletteTopInset + shellInset + Math.max(densityMetricDelta, 0);
  let pagePadding = panelSpacing + (presentation?.density === 'immersive' ? 4 : presentation?.density === 'compact' ? -1 : 1);
  let panelGap = layoutGap;

  if (navigationPattern?.kind === 'palette') {
    commandPaletteStyle = presentation?.chromeStyle === 'ornate' ? 'glass' : 'floating';
    commandPaletteWidth += 48;
  }

  switch (layoutPrimitive?.kind) {
    case 'grid':
      commandPaletteWidth += 24;
      pagePadding += 1;
      break;
    case 'dock':
      shellInset = Math.max(shellInset, panelSpacing);
      settingsStyle = settingsStyle === 'solid' ? 'floating' : settingsStyle;
      break;
    case 'freeform':
      panelStyle = 'floating';
      settingsStyle = 'floating';
      panelRadius = clampNumber(panelRadius + 4, 8, 48);
      shellInset = Math.max(shellInset, panelSpacing);
      break;
    default:
      break;
  }

  switch (renderStyle?.kind) {
    case 'ps-3-xmb':
      topBarStyle = 'floating';
      panelStyle = 'glass';
      commandPaletteStyle = 'glass';
      terminalStyle = 'glass';
      settingsStyle = 'glass';
      tabStyle = 'capsule';
      controlRadius = 999;
      panelRadius = clampNumber(Math.max(panelRadius, 24), 8, 48);
      shellInset = Math.max(shellInset, 12);
      commandPaletteWidth = Math.max(commandPaletteWidth, 820);
      break;
    case 'ios-springboard':
      topBarStyle = 'minimal';
      panelStyle = 'floating';
      commandPaletteStyle = 'floating';
      settingsStyle = 'floating';
      tabStyle = 'capsule';
      controlRadius = Math.max(controlRadius, 18);
      panelRadius = clampNumber(Math.max(panelRadius, 24), 8, 48);
      shellInset = Math.max(shellInset, panelSpacing);
      commandPaletteWidth = Math.max(commandPaletteWidth, 800);
      break;
    case 'wii-channels':
      topBarStyle = 'minimal';
      panelStyle = 'floating';
      commandPaletteStyle = 'floating';
      settingsStyle = 'floating';
      tabStyle = 'capsule';
      controlRadius = Math.max(controlRadius, 16);
      panelRadius = clampNumber(Math.max(panelRadius, 28), 8, 48);
      shellInset = Math.max(shellInset, 10);
      break;
    case 'desktop-window-manager':
      topBarStyle = 'solid';
      panelStyle = 'solid';
      commandPaletteStyle = 'solid';
      terminalStyle = 'solid';
      settingsStyle = 'solid';
      tabStyle = 'segment';
      controlRadius = clampNumber(Math.min(controlRadius, 8), 4, 999);
      panelRadius = clampNumber(Math.min(Math.max(panelRadius, 10), 18), 8, 48);
      shellInset = 0;
      break;
    default:
      break;
  }

  if (navigationPattern?.kind === 'xmb') {
    topBarStyle = 'floating';
    panelStyle = renderStyle?.kind === 'ps-3-xmb' ? panelStyle : 'glass';
    commandPaletteStyle = renderStyle?.kind === 'ps-3-xmb' ? commandPaletteStyle : 'glass';
    tabStyle = 'capsule';
  }

  return {
    layoutPrimitiveId: layoutPrimitive?.id,
    navigationPatternId: navigationPattern?.id,
    renderStyleId: renderStyle?.id,
    topBarStyle,
    panelStyle,
    commandPaletteStyle,
    terminalStyle,
    settingsStyle,
    tabStyle,
    metrics: {
      chromeHeight,
      controlRadius,
      panelRadius,
      shellInset,
      commandPaletteWidth,
      commandPaletteTopInset,
      pagePadding,
      panelGap,
    },
  };
}

function formatLength(value: number): string {
  return `${Math.round(value)}px`;
}

export function resolveWorkbenchThemeRecipe(
  theme: OverlayThemeDefinition,
): ResolvedWorkbenchThemeRecipe {
  const userRecipe = theme.workbench;
  const engineRecipe = createWorkbenchEngineRecipe(theme);
  const engineBindings = resolveThemeEngineBindings(theme.compiledEngineManifest, userRecipe);
  const preset = userRecipe?.preset
    ?? inferWorkbenchPresetFromEngine(theme)
    ?? inferWorkbenchPreset(theme);
  const presetRecipe = getPresetRecipe(preset);
  const metrics = {
    chromeHeight: Math.round(userRecipe?.metrics?.chromeHeight ?? engineRecipe.metrics?.chromeHeight ?? presetRecipe.metrics?.chromeHeight ?? defaultMetrics.chromeHeight),
    controlRadius: Math.round(userRecipe?.metrics?.controlRadius ?? engineRecipe.metrics?.controlRadius ?? presetRecipe.metrics?.controlRadius ?? defaultMetrics.controlRadius),
    panelRadius: Math.round(userRecipe?.metrics?.panelRadius ?? engineRecipe.metrics?.panelRadius ?? presetRecipe.metrics?.panelRadius ?? defaultMetrics.panelRadius),
    shellInset: Math.round(userRecipe?.metrics?.shellInset ?? engineRecipe.metrics?.shellInset ?? presetRecipe.metrics?.shellInset ?? defaultMetrics.shellInset),
    commandPaletteWidth: Math.round(userRecipe?.metrics?.commandPaletteWidth ?? engineRecipe.metrics?.commandPaletteWidth ?? presetRecipe.metrics?.commandPaletteWidth ?? defaultMetrics.commandPaletteWidth),
    commandPaletteTopInset: Math.round(userRecipe?.metrics?.commandPaletteTopInset ?? engineRecipe.metrics?.commandPaletteTopInset ?? presetRecipe.metrics?.commandPaletteTopInset ?? defaultMetrics.commandPaletteTopInset),
    pagePadding: Math.round(userRecipe?.metrics?.pagePadding ?? engineRecipe.metrics?.pagePadding ?? presetRecipe.metrics?.pagePadding ?? defaultMetrics.pagePadding),
    panelGap: Math.round(userRecipe?.metrics?.panelGap ?? engineRecipe.metrics?.panelGap ?? presetRecipe.metrics?.panelGap ?? defaultMetrics.panelGap),
  };
  const surfaces = {
    ...defaultSurfaces,
    ...compactObject(presetRecipe.surfaces),
    ...compactObject(engineRecipe.surfaces),
    ...compactObject(userRecipe?.surfaces),
  };
  const typography = {
    ...defaultTypography,
    ...compactObject(presetRecipe.typography),
    ...compactObject(engineRecipe.typography),
    ...compactObject(userRecipe?.typography),
  };
  const cssVars = {
    '--overlay-workbench-shell-bg': surfaces.shellBackground,
    '--overlay-workbench-chrome-bg': surfaces.chromeBackground,
    '--overlay-workbench-chrome-menu-bg': surfaces.chromeMenuBackground,
    '--overlay-workbench-chrome-border': surfaces.chromeBorder,
    '--overlay-workbench-chrome-button-bg': surfaces.chromeButtonBackground,
    '--overlay-workbench-chrome-button-hover-bg': surfaces.chromeButtonHoverBackground,
    '--overlay-workbench-chrome-button-active-bg': surfaces.chromeButtonActiveBackground,
    '--overlay-workbench-chrome-button-active-border': surfaces.chromeButtonActiveBorder,
    '--overlay-workbench-chrome-tab-bg': surfaces.chromeTabBackground,
    '--overlay-workbench-chrome-tab-active-bg': surfaces.chromeTabActiveBackground,
    '--overlay-workbench-chrome-tab-border': surfaces.chromeTabBorder,
    '--overlay-workbench-shell-shadow': surfaces.shellShadow,
    '--overlay-workbench-command-palette-scrim-bg': surfaces.commandPaletteScrimBackground,
    '--overlay-workbench-command-palette-bg': surfaces.commandPaletteBackground,
    '--overlay-workbench-command-palette-border': surfaces.commandPaletteBorder,
    '--overlay-workbench-command-palette-input-bg': surfaces.commandPaletteInputBackground,
    '--overlay-workbench-command-palette-item-bg': surfaces.commandPaletteItemBackground,
    '--overlay-workbench-command-palette-item-active-bg': surfaces.commandPaletteItemActiveBackground,
    '--overlay-workbench-settings-bg': surfaces.settingsBackground,
    '--overlay-workbench-settings-rail-bg': surfaces.settingsRailBackground,
    '--overlay-workbench-settings-card-bg': surfaces.settingsCardBackground,
    '--overlay-workbench-settings-card-border': surfaces.settingsCardBorder,
    '--overlay-workbench-settings-badge-bg': surfaces.settingsBadgeBackground,
    '--overlay-workbench-settings-badge-border': surfaces.settingsBadgeBorder,
    '--overlay-workbench-terminal-bg': surfaces.terminalBackground,
    '--overlay-workbench-terminal-panel-bg': surfaces.terminalPanelBackground,
    '--overlay-workbench-terminal-pane-bg': surfaces.terminalPaneBackground,
    '--overlay-workbench-terminal-border': surfaces.terminalBorder,
    '--overlay-workbench-terminal-status-bg': surfaces.terminalStatusBackground,
    '--overlay-workbench-chrome-height': formatLength(metrics.chromeHeight),
    '--overlay-workbench-control-radius': formatLength(metrics.controlRadius),
    '--overlay-workbench-panel-radius': formatLength(metrics.panelRadius),
    '--overlay-workbench-shell-inset': formatLength(metrics.shellInset),
    '--overlay-workbench-command-palette-width': formatLength(metrics.commandPaletteWidth),
    '--overlay-workbench-command-palette-top-inset': formatLength(metrics.commandPaletteTopInset),
    '--overlay-workbench-page-padding': formatLength(metrics.pagePadding),
    '--overlay-workbench-panel-gap': formatLength(metrics.panelGap),
    '--overlay-workbench-chrome-label-size': formatLength(typography.chromeLabelSize),
    '--overlay-workbench-chrome-meta-size': formatLength(typography.chromeMetaSize),
    '--overlay-workbench-tab-label-size': formatLength(typography.tabLabelSize),
    '--overlay-workbench-page-title-size': formatLength(typography.pageTitleSize),
    '--overlay-workbench-page-body-size': formatLength(typography.pageBodySize),
    '--overlay-workbench-badge-size': formatLength(typography.badgeSize),
    '--overlay-workbench-label-spacing': typography.labelLetterSpacing,
    ...(userRecipe?.cssVars ?? {}),
  };

  return {
    preset,
    brandLabel: userRecipe?.brandLabel?.trim() || presetRecipe.brandLabel || 'Command Center',
    layoutPrimitiveId: engineBindings.layoutPrimitive?.id ?? null,
    navigationPatternId: engineBindings.navigationPattern?.id ?? null,
    renderStyleId: engineBindings.renderStyle?.id ?? null,
    topBarStyle: userRecipe?.topBarStyle ?? engineRecipe.topBarStyle ?? presetRecipe.topBarStyle ?? 'solid',
    panelStyle: userRecipe?.panelStyle ?? engineRecipe.panelStyle ?? presetRecipe.panelStyle ?? 'solid',
    commandPaletteStyle: userRecipe?.commandPaletteStyle ?? engineRecipe.commandPaletteStyle ?? presetRecipe.commandPaletteStyle ?? 'solid',
    terminalStyle: userRecipe?.terminalStyle ?? engineRecipe.terminalStyle ?? presetRecipe.terminalStyle ?? 'solid',
    settingsStyle: userRecipe?.settingsStyle ?? engineRecipe.settingsStyle ?? presetRecipe.settingsStyle ?? 'solid',
    tabStyle: userRecipe?.tabStyle ?? engineRecipe.tabStyle ?? presetRecipe.tabStyle ?? 'underline',
    metrics: {
      chromeHeight: clampNumber(metrics.chromeHeight, 30, 72),
      controlRadius: clampNumber(metrics.controlRadius, 4, 999),
      panelRadius: clampNumber(metrics.panelRadius, 8, 48),
      shellInset: clampNumber(metrics.shellInset, 0, 32),
      commandPaletteWidth: clampNumber(metrics.commandPaletteWidth, 420, 1100),
      commandPaletteTopInset: clampNumber(metrics.commandPaletteTopInset, 16, 180),
      pagePadding: clampNumber(metrics.pagePadding, 8, 32),
      panelGap: clampNumber(metrics.panelGap, 4, 24),
    },
    surfaces,
    typography: {
      chromeLabelSize: clampNumber(typography.chromeLabelSize, 9, 18),
      chromeMetaSize: clampNumber(typography.chromeMetaSize, 7, 14),
      tabLabelSize: clampNumber(typography.tabLabelSize, 9, 18),
      pageTitleSize: clampNumber(typography.pageTitleSize, 12, 28),
      pageBodySize: clampNumber(typography.pageBodySize, 10, 18),
      badgeSize: clampNumber(typography.badgeSize, 8, 14),
      labelLetterSpacing: typography.labelLetterSpacing,
    },
    cssVars,
  };
}
