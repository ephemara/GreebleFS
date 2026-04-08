import type { ResolvedOverlayAppearance } from './appearance';
import type {
  AdaptiveSemanticDensityStopDefinition,
  ExplorerExperimentalViewMode,
} from './explorerExperimentalModes';
import type {
  ExplorerGridMetrics,
  ExplorerRowMetrics,
  ExplorerViewMode,
} from './explorerViewModes';

export type OverlayExplorerThemePreset = 'workbench' | 'xmb' | 'channel-grid' | 'custom';
export type OverlayExplorerToolbarStyle = 'solid' | 'glass' | 'floating' | 'minimal';
export type OverlayExplorerBreadcrumbStyle = 'plain' | 'segmented' | 'capsule';
export type OverlayExplorerSelectionStyle = 'fill' | 'outline' | 'glow';
export type OverlayExplorerHoverStyle = 'fill' | 'lift' | 'glow';
export type OverlayExplorerPreviewStyle = 'attached' | 'floating' | 'glass';
export type OverlayExplorerStatusBarStyle = 'solid' | 'floating' | 'hidden';
export type OverlayExplorerLabelMode = 'stacked' | 'inline';
export type OverlayExplorerRailPosition = 'left' | 'right';

export interface OverlayExplorerThemeMetrics {
  railWidth?: number;
  previewWidth?: number;
  chromeInset?: number;
  toolbarPaddingX?: number;
  toolbarPaddingY?: number;
  toolbarGap?: number;
  controlRadius?: number;
  panelRadius?: number;
  spacingScale?: number;
  gridScale?: number;
  rowHeightScale?: number;
  iconScale?: number;
  hoverLiftPx?: number;
}

export interface OverlayExplorerThemeSurfaces {
  rootBackground?: string;
  contentBackground?: string;
  sidebarBackground?: string;
  sidebarBorder?: string;
  toolbarBackground?: string;
  toolbarBorder?: string;
  toolbarShadow?: string;
  omniboxBackground?: string;
  omniboxBorder?: string;
  previewBackground?: string;
  previewHeaderBackground?: string;
  previewBorder?: string;
  statusBarBackground?: string;
  statusBarBorder?: string;
  itemHoverBackground?: string;
  itemHoverBorder?: string;
  itemSelectedBackground?: string;
  itemSelectedBorder?: string;
  itemDropBackground?: string;
  itemDropBorder?: string;
  itemFocusShadow?: string;
  inputBackground?: string;
  inputBorder?: string;
  chipBackground?: string;
  chipBorder?: string;
  chipActiveBackground?: string;
  chipActiveBorder?: string;
  chipActiveText?: string;
}

export interface OverlayExplorerThemeTypography {
  railEyebrowSize?: number;
  railTitleSize?: number;
  toolbarFontSize?: number;
  breadcrumbFontSize?: number;
  entryTitleSize?: number;
  entryMetaSize?: number;
  statusFontSize?: number;
  entryTitleWeight?: number;
  labelLetterSpacing?: string;
}

export interface OverlayExplorerThemeRecipe {
  preset?: OverlayExplorerThemePreset;
  railPosition?: OverlayExplorerRailPosition;
  railBrandLabel?: string;
  toolbarStyle?: OverlayExplorerToolbarStyle;
  breadcrumbStyle?: OverlayExplorerBreadcrumbStyle;
  selectionStyle?: OverlayExplorerSelectionStyle;
  hoverStyle?: OverlayExplorerHoverStyle;
  previewStyle?: OverlayExplorerPreviewStyle;
  statusBarStyle?: OverlayExplorerStatusBarStyle;
  labelMode?: OverlayExplorerLabelMode;
  preferredViewMode?: ExplorerViewMode;
  preferredExperimentalViewMode?: ExplorerExperimentalViewMode;
  metrics?: OverlayExplorerThemeMetrics;
  surfaces?: OverlayExplorerThemeSurfaces;
  typography?: OverlayExplorerThemeTypography;
  cssVars?: Record<string, string>;
}

export interface ResolvedExplorerThemeRecipe {
  preset: OverlayExplorerThemePreset;
  railPosition: OverlayExplorerRailPosition;
  railBrandLabel: string;
  toolbarStyle: OverlayExplorerToolbarStyle;
  breadcrumbStyle: OverlayExplorerBreadcrumbStyle;
  selectionStyle: OverlayExplorerSelectionStyle;
  hoverStyle: OverlayExplorerHoverStyle;
  previewStyle: OverlayExplorerPreviewStyle;
  statusBarStyle: OverlayExplorerStatusBarStyle;
  labelMode: OverlayExplorerLabelMode;
  preferredViewMode: ExplorerViewMode | null;
  preferredExperimentalViewMode: ExplorerExperimentalViewMode | null;
  metrics: Required<OverlayExplorerThemeMetrics>;
  surfaces: Required<OverlayExplorerThemeSurfaces>;
  typography: Required<OverlayExplorerThemeTypography>;
  cssVars: Record<string, string>;
}

const workbenchMetrics: Required<OverlayExplorerThemeMetrics> = {
  railWidth: 280,
  previewWidth: 380,
  chromeInset: 0,
  toolbarPaddingX: 10,
  toolbarPaddingY: 6,
  toolbarGap: 6,
  controlRadius: 6,
  panelRadius: 12,
  spacingScale: 1,
  gridScale: 1,
  rowHeightScale: 1,
  iconScale: 1,
  hoverLiftPx: 1,
};

const workbenchTypography: Required<OverlayExplorerThemeTypography> = {
  railEyebrowSize: 10,
  railTitleSize: 14,
  toolbarFontSize: 11,
  breadcrumbFontSize: 11,
  entryTitleSize: 11,
  entryMetaSize: 10,
  statusFontSize: 10,
  entryTitleWeight: 500,
  labelLetterSpacing: '0.08em',
};

const workbenchSurfaces: Required<OverlayExplorerThemeSurfaces> = {
  rootBackground: 'var(--overlay-bg-shell)',
  contentBackground: 'transparent',
  sidebarBackground: 'var(--overlay-bg-sidebar)',
  sidebarBorder: 'var(--overlay-border)',
  toolbarBackground: 'var(--overlay-bg-panel)',
  toolbarBorder: 'var(--overlay-border)',
  toolbarShadow: 'none',
  omniboxBackground: 'var(--overlay-bg-shell)',
  omniboxBorder: 'var(--overlay-border)',
  previewBackground: 'var(--overlay-bg-panel)',
  previewHeaderBackground: 'var(--overlay-bg-sidebar)',
  previewBorder: 'var(--overlay-border)',
  statusBarBackground: 'var(--overlay-bg-sidebar)',
  statusBarBorder: 'var(--overlay-border)',
  itemHoverBackground: 'rgba(255,255,255,0.035)',
  itemHoverBorder: 'rgba(255,255,255,0.08)',
  itemSelectedBackground: 'var(--overlay-bg-selection)',
  itemSelectedBorder: 'color-mix(in srgb, var(--overlay-accent) 70%, transparent)',
  itemDropBackground: 'color-mix(in srgb, var(--overlay-accent) 14%, transparent)',
  itemDropBorder: 'var(--overlay-accent)',
  itemFocusShadow: 'none',
  inputBackground: 'var(--overlay-bg-input)',
  inputBorder: 'var(--overlay-accent)',
  chipBackground: 'transparent',
  chipBorder: 'var(--overlay-border)',
  chipActiveBackground: 'color-mix(in srgb, var(--overlay-accent) 14%, transparent)',
  chipActiveBorder: 'color-mix(in srgb, var(--overlay-accent) 45%, transparent)',
  chipActiveText: 'var(--overlay-accent)',
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

function isExplorerViewMode(value: unknown): value is ExplorerViewMode {
  return value === 'icons-xl'
    || value === 'icons-l'
    || value === 'icons-m'
    || value === 'icons-s'
    || value === 'columns'
    || value === 'list'
    || value === 'details';
}

function isExplorerExperimentalViewMode(value: unknown): value is ExplorerExperimentalViewMode {
  return value === 'off'
    || value === 'adaptive-semantic-grid'
    || value === 'constellation'
    || value === 'timeline-surface';
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

export function normalizeExplorerThemeRecipe(
  recipe?: OverlayExplorerThemeRecipe,
  fallback?: OverlayExplorerThemeRecipe,
): OverlayExplorerThemeRecipe | undefined {
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

  const next: OverlayExplorerThemeRecipe = {
    preset: recipe?.preset ?? fallback?.preset,
    railPosition: recipe?.railPosition ?? fallback?.railPosition,
    railBrandLabel: asTrimmedString(recipe?.railBrandLabel) ?? asTrimmedString(fallback?.railBrandLabel),
    toolbarStyle: recipe?.toolbarStyle ?? fallback?.toolbarStyle,
    breadcrumbStyle: recipe?.breadcrumbStyle ?? fallback?.breadcrumbStyle,
    selectionStyle: recipe?.selectionStyle ?? fallback?.selectionStyle,
    hoverStyle: recipe?.hoverStyle ?? fallback?.hoverStyle,
    previewStyle: recipe?.previewStyle ?? fallback?.previewStyle,
    statusBarStyle: recipe?.statusBarStyle ?? fallback?.statusBarStyle,
    labelMode: recipe?.labelMode ?? fallback?.labelMode,
    preferredViewMode: isExplorerViewMode(recipe?.preferredViewMode)
      ? recipe?.preferredViewMode
      : (isExplorerViewMode(fallback?.preferredViewMode) ? fallback?.preferredViewMode : undefined),
    preferredExperimentalViewMode: isExplorerExperimentalViewMode(recipe?.preferredExperimentalViewMode)
      ? recipe?.preferredExperimentalViewMode
      : (isExplorerExperimentalViewMode(fallback?.preferredExperimentalViewMode) ? fallback?.preferredExperimentalViewMode : undefined),
    metrics: {
      railWidth: asFiniteNumber(mergedMetrics.railWidth),
      previewWidth: asFiniteNumber(mergedMetrics.previewWidth),
      chromeInset: asFiniteNumber(mergedMetrics.chromeInset),
      toolbarPaddingX: asFiniteNumber(mergedMetrics.toolbarPaddingX),
      toolbarPaddingY: asFiniteNumber(mergedMetrics.toolbarPaddingY),
      toolbarGap: asFiniteNumber(mergedMetrics.toolbarGap),
      controlRadius: asFiniteNumber(mergedMetrics.controlRadius),
      panelRadius: asFiniteNumber(mergedMetrics.panelRadius),
      spacingScale: asFiniteNumber(mergedMetrics.spacingScale),
      gridScale: asFiniteNumber(mergedMetrics.gridScale),
      rowHeightScale: asFiniteNumber(mergedMetrics.rowHeightScale),
      iconScale: asFiniteNumber(mergedMetrics.iconScale),
      hoverLiftPx: asFiniteNumber(mergedMetrics.hoverLiftPx),
    },
    surfaces: {
      rootBackground: asTrimmedString(mergedSurfaces.rootBackground),
      contentBackground: asTrimmedString(mergedSurfaces.contentBackground),
      sidebarBackground: asTrimmedString(mergedSurfaces.sidebarBackground),
      sidebarBorder: asTrimmedString(mergedSurfaces.sidebarBorder),
      toolbarBackground: asTrimmedString(mergedSurfaces.toolbarBackground),
      toolbarBorder: asTrimmedString(mergedSurfaces.toolbarBorder),
      toolbarShadow: asTrimmedString(mergedSurfaces.toolbarShadow),
      omniboxBackground: asTrimmedString(mergedSurfaces.omniboxBackground),
      omniboxBorder: asTrimmedString(mergedSurfaces.omniboxBorder),
      previewBackground: asTrimmedString(mergedSurfaces.previewBackground),
      previewHeaderBackground: asTrimmedString(mergedSurfaces.previewHeaderBackground),
      previewBorder: asTrimmedString(mergedSurfaces.previewBorder),
      statusBarBackground: asTrimmedString(mergedSurfaces.statusBarBackground),
      statusBarBorder: asTrimmedString(mergedSurfaces.statusBarBorder),
      itemHoverBackground: asTrimmedString(mergedSurfaces.itemHoverBackground),
      itemHoverBorder: asTrimmedString(mergedSurfaces.itemHoverBorder),
      itemSelectedBackground: asTrimmedString(mergedSurfaces.itemSelectedBackground),
      itemSelectedBorder: asTrimmedString(mergedSurfaces.itemSelectedBorder),
      itemDropBackground: asTrimmedString(mergedSurfaces.itemDropBackground),
      itemDropBorder: asTrimmedString(mergedSurfaces.itemDropBorder),
      itemFocusShadow: asTrimmedString(mergedSurfaces.itemFocusShadow),
      inputBackground: asTrimmedString(mergedSurfaces.inputBackground),
      inputBorder: asTrimmedString(mergedSurfaces.inputBorder),
      chipBackground: asTrimmedString(mergedSurfaces.chipBackground),
      chipBorder: asTrimmedString(mergedSurfaces.chipBorder),
      chipActiveBackground: asTrimmedString(mergedSurfaces.chipActiveBackground),
      chipActiveBorder: asTrimmedString(mergedSurfaces.chipActiveBorder),
      chipActiveText: asTrimmedString(mergedSurfaces.chipActiveText),
    },
    typography: {
      railEyebrowSize: asFiniteNumber(mergedTypography.railEyebrowSize),
      railTitleSize: asFiniteNumber(mergedTypography.railTitleSize),
      toolbarFontSize: asFiniteNumber(mergedTypography.toolbarFontSize),
      breadcrumbFontSize: asFiniteNumber(mergedTypography.breadcrumbFontSize),
      entryTitleSize: asFiniteNumber(mergedTypography.entryTitleSize),
      entryMetaSize: asFiniteNumber(mergedTypography.entryMetaSize),
      statusFontSize: asFiniteNumber(mergedTypography.statusFontSize),
      entryTitleWeight: asFiniteNumber(mergedTypography.entryTitleWeight),
      labelLetterSpacing: asTrimmedString(mergedTypography.labelLetterSpacing),
    },
    cssVars: {
      ...normalizeCssVarRecord(fallback?.cssVars),
      ...normalizeCssVarRecord(recipe?.cssVars),
    },
  };

  return next;
}

function inferPreset(appearance?: ResolvedOverlayAppearance): OverlayExplorerThemePreset {
  const tags = new Set(
    (appearance?.baseTheme.compatibility?.tags ?? [])
      .map(entry => entry.trim().toLowerCase())
      .filter(Boolean),
  );

  if (tags.has('xmb') || tags.has('ps3') || tags.has('console')) {
    return 'xmb';
  }
  if (tags.has('wii') || tags.has('springboard') || tags.has('channels')) {
    return 'channel-grid';
  }
  return 'workbench';
}

function createPresetRecipe(preset: OverlayExplorerThemePreset): OverlayExplorerThemeRecipe {
  switch (preset) {
    case 'xmb':
      return {
        preset,
        railPosition: 'left',
        railBrandLabel: 'Cross Media',
        toolbarStyle: 'floating',
        breadcrumbStyle: 'capsule',
        selectionStyle: 'glow',
        hoverStyle: 'glow',
        previewStyle: 'glass',
        statusBarStyle: 'floating',
        labelMode: 'stacked',
        preferredViewMode: 'icons-xl',
        preferredExperimentalViewMode: 'adaptive-semantic-grid',
        metrics: {
          railWidth: 232,
          previewWidth: 460,
          chromeInset: 14,
          toolbarPaddingX: 14,
          toolbarPaddingY: 10,
          toolbarGap: 8,
          controlRadius: 999,
          panelRadius: 24,
          spacingScale: 1.18,
          gridScale: 1.2,
          rowHeightScale: 1.08,
          iconScale: 1.34,
          hoverLiftPx: 4,
        },
        surfaces: {
          rootBackground: 'transparent',
          contentBackground: 'transparent',
          toolbarBackground: 'color-mix(in srgb, var(--overlay-bg-panel) 74%, transparent)',
          toolbarBorder: 'color-mix(in srgb, var(--overlay-accent) 24%, var(--overlay-border))',
          toolbarShadow: '0 18px 42px rgba(0,0,0,0.28)',
          omniboxBackground: 'color-mix(in srgb, var(--overlay-bg-shell-solid) 78%, transparent)',
          omniboxBorder: 'color-mix(in srgb, var(--overlay-accent) 30%, var(--overlay-border))',
          previewBackground: 'color-mix(in srgb, var(--overlay-bg-panel) 80%, transparent)',
          previewHeaderBackground: 'color-mix(in srgb, var(--overlay-bg-sidebar) 78%, transparent)',
          previewBorder: 'color-mix(in srgb, var(--overlay-accent) 24%, var(--overlay-border))',
          statusBarBackground: 'color-mix(in srgb, var(--overlay-bg-sidebar) 78%, transparent)',
          statusBarBorder: 'color-mix(in srgb, var(--overlay-accent) 18%, var(--overlay-border))',
          itemHoverBackground: 'color-mix(in srgb, var(--overlay-accent) 12%, transparent)',
          itemHoverBorder: 'color-mix(in srgb, var(--overlay-accent) 38%, transparent)',
          itemSelectedBackground: 'color-mix(in srgb, var(--overlay-accent) 16%, transparent)',
          itemSelectedBorder: 'var(--overlay-accent)',
          itemDropBackground: 'color-mix(in srgb, var(--overlay-accent) 18%, transparent)',
          itemDropBorder: 'var(--overlay-accent)',
          itemFocusShadow: '0 14px 36px color-mix(in srgb, var(--overlay-accent) 18%, transparent)',
          inputBackground: 'color-mix(in srgb, var(--overlay-bg-shell-solid) 74%, transparent)',
          inputBorder: 'var(--overlay-accent)',
          chipBackground: 'color-mix(in srgb, var(--overlay-bg-shell-solid) 64%, transparent)',
          chipBorder: 'color-mix(in srgb, var(--overlay-accent) 18%, var(--overlay-border))',
          chipActiveBackground: 'color-mix(in srgb, var(--overlay-accent) 16%, transparent)',
          chipActiveBorder: 'color-mix(in srgb, var(--overlay-accent) 40%, transparent)',
          chipActiveText: 'var(--overlay-accent)',
        },
        typography: {
          railEyebrowSize: 9,
          railTitleSize: 16,
          toolbarFontSize: 11,
          breadcrumbFontSize: 10.5,
          entryTitleSize: 11.5,
          entryMetaSize: 9.5,
          statusFontSize: 10,
          entryTitleWeight: 600,
          labelLetterSpacing: '0.14em',
        },
      };
    case 'channel-grid':
      return {
        preset,
        railPosition: 'left',
        railBrandLabel: 'Channels',
        toolbarStyle: 'minimal',
        breadcrumbStyle: 'segmented',
        selectionStyle: 'outline',
        hoverStyle: 'lift',
        previewStyle: 'floating',
        statusBarStyle: 'hidden',
        labelMode: 'stacked',
        preferredViewMode: 'icons-xl',
        preferredExperimentalViewMode: 'off',
        metrics: {
          railWidth: 248,
          previewWidth: 420,
          chromeInset: 10,
          toolbarPaddingX: 12,
          toolbarPaddingY: 8,
          toolbarGap: 8,
          controlRadius: 18,
          panelRadius: 28,
          spacingScale: 1.14,
          gridScale: 1.28,
          rowHeightScale: 1.06,
          iconScale: 1.24,
          hoverLiftPx: 3,
        },
        surfaces: {
          rootBackground: 'transparent',
          contentBackground: 'transparent',
          toolbarBackground: 'transparent',
          toolbarBorder: 'transparent',
          toolbarShadow: 'none',
          omniboxBackground: 'color-mix(in srgb, var(--overlay-bg-panel) 94%, white 6%)',
          omniboxBorder: 'color-mix(in srgb, var(--overlay-accent) 16%, var(--overlay-border))',
          previewBackground: 'color-mix(in srgb, var(--overlay-bg-panel) 96%, white 4%)',
          previewHeaderBackground: 'color-mix(in srgb, var(--overlay-bg-sidebar) 94%, white 6%)',
          previewBorder: 'color-mix(in srgb, var(--overlay-accent) 14%, var(--overlay-border))',
          statusBarBackground: 'transparent',
          statusBarBorder: 'transparent',
          itemHoverBackground: 'color-mix(in srgb, white 14%, transparent)',
          itemHoverBorder: 'color-mix(in srgb, var(--overlay-accent) 20%, var(--overlay-border))',
          itemSelectedBackground: 'color-mix(in srgb, white 16%, transparent)',
          itemSelectedBorder: 'color-mix(in srgb, var(--overlay-accent) 52%, transparent)',
          itemDropBackground: 'color-mix(in srgb, var(--overlay-accent) 10%, white 6%)',
          itemDropBorder: 'color-mix(in srgb, var(--overlay-accent) 60%, transparent)',
          itemFocusShadow: '0 12px 28px rgba(0,0,0,0.16)',
          inputBackground: 'color-mix(in srgb, var(--overlay-bg-input) 96%, white 4%)',
          inputBorder: 'color-mix(in srgb, var(--overlay-accent) 44%, transparent)',
          chipBackground: 'rgba(255,255,255,0.6)',
          chipBorder: 'color-mix(in srgb, var(--overlay-accent) 16%, var(--overlay-border))',
          chipActiveBackground: 'color-mix(in srgb, var(--overlay-accent) 12%, white 10%)',
          chipActiveBorder: 'color-mix(in srgb, var(--overlay-accent) 48%, transparent)',
          chipActiveText: 'var(--overlay-text-primary)',
        },
        typography: {
          railEyebrowSize: 9,
          railTitleSize: 16,
          toolbarFontSize: 11,
          breadcrumbFontSize: 10.5,
          entryTitleSize: 11.5,
          entryMetaSize: 9.5,
          statusFontSize: 10,
          entryTitleWeight: 600,
          labelLetterSpacing: '0.04em',
        },
      };
    case 'custom':
      return {
        preset,
        railPosition: 'left',
        railBrandLabel: 'Explorer',
        toolbarStyle: 'solid',
        breadcrumbStyle: 'plain',
        selectionStyle: 'fill',
        hoverStyle: 'fill',
        previewStyle: 'attached',
        statusBarStyle: 'solid',
        labelMode: 'stacked',
        preferredViewMode: null as unknown as ExplorerViewMode,
        preferredExperimentalViewMode: null as unknown as ExplorerExperimentalViewMode,
      };
    default:
      return {
        preset: 'workbench',
        railPosition: 'left',
        railBrandLabel: 'Explorer',
        toolbarStyle: 'solid',
        breadcrumbStyle: 'plain',
        selectionStyle: 'fill',
        hoverStyle: 'lift',
        previewStyle: 'attached',
        statusBarStyle: 'solid',
        labelMode: 'stacked',
        preferredViewMode: null as unknown as ExplorerViewMode,
        preferredExperimentalViewMode: null as unknown as ExplorerExperimentalViewMode,
      };
  }
}

function formatLength(value: number): string {
  return `${Math.round(value)}px`;
}

function resolveMetrics(
  presetMetrics: OverlayExplorerThemeMetrics | undefined,
  overrideMetrics: OverlayExplorerThemeMetrics | undefined,
): Required<OverlayExplorerThemeMetrics> {
  return {
    railWidth: Math.round(overrideMetrics?.railWidth ?? presetMetrics?.railWidth ?? workbenchMetrics.railWidth),
    previewWidth: Math.round(overrideMetrics?.previewWidth ?? presetMetrics?.previewWidth ?? workbenchMetrics.previewWidth),
    chromeInset: Math.round(overrideMetrics?.chromeInset ?? presetMetrics?.chromeInset ?? workbenchMetrics.chromeInset),
    toolbarPaddingX: Math.round(overrideMetrics?.toolbarPaddingX ?? presetMetrics?.toolbarPaddingX ?? workbenchMetrics.toolbarPaddingX),
    toolbarPaddingY: Math.round(overrideMetrics?.toolbarPaddingY ?? presetMetrics?.toolbarPaddingY ?? workbenchMetrics.toolbarPaddingY),
    toolbarGap: Math.round(overrideMetrics?.toolbarGap ?? presetMetrics?.toolbarGap ?? workbenchMetrics.toolbarGap),
    controlRadius: Math.round(overrideMetrics?.controlRadius ?? presetMetrics?.controlRadius ?? workbenchMetrics.controlRadius),
    panelRadius: Math.round(overrideMetrics?.panelRadius ?? presetMetrics?.panelRadius ?? workbenchMetrics.panelRadius),
    spacingScale: clampNumber(overrideMetrics?.spacingScale ?? presetMetrics?.spacingScale ?? workbenchMetrics.spacingScale, 0.5, 2.5),
    gridScale: clampNumber(overrideMetrics?.gridScale ?? presetMetrics?.gridScale ?? workbenchMetrics.gridScale, 0.65, 2.2),
    rowHeightScale: clampNumber(overrideMetrics?.rowHeightScale ?? presetMetrics?.rowHeightScale ?? workbenchMetrics.rowHeightScale, 0.75, 2),
    iconScale: clampNumber(overrideMetrics?.iconScale ?? presetMetrics?.iconScale ?? workbenchMetrics.iconScale, 0.7, 2.4),
    hoverLiftPx: clampNumber(overrideMetrics?.hoverLiftPx ?? presetMetrics?.hoverLiftPx ?? workbenchMetrics.hoverLiftPx, 0, 12),
  };
}

function resolveSurfaces(
  presetSurfaces: OverlayExplorerThemeSurfaces | undefined,
  overrideSurfaces: OverlayExplorerThemeSurfaces | undefined,
): Required<OverlayExplorerThemeSurfaces> {
  return {
    ...workbenchSurfaces,
    ...(presetSurfaces ?? {}),
    ...(overrideSurfaces ?? {}),
  };
}

function resolveTypography(
  presetTypography: OverlayExplorerThemeTypography | undefined,
  overrideTypography: OverlayExplorerThemeTypography | undefined,
): Required<OverlayExplorerThemeTypography> {
  return {
    ...workbenchTypography,
    ...(presetTypography ?? {}),
    ...(overrideTypography ?? {}),
  };
}

export function resolveExplorerThemeRecipe(
  appearance?: ResolvedOverlayAppearance,
): ResolvedExplorerThemeRecipe {
  const userRecipe = appearance?.baseTheme.explorer;
  const preset = userRecipe?.preset ?? inferPreset(appearance);
  const presetRecipe = createPresetRecipe(preset);
  const metrics = resolveMetrics(presetRecipe.metrics, userRecipe?.metrics);
  const surfaces = resolveSurfaces(presetRecipe.surfaces, userRecipe?.surfaces);
  const typography = resolveTypography(presetRecipe.typography, userRecipe?.typography);
  const railBrandLabel = userRecipe?.railBrandLabel?.trim()
    || presetRecipe.railBrandLabel
    || 'Explorer';
  const preferredViewMode = userRecipe?.preferredViewMode ?? presetRecipe.preferredViewMode ?? null;
  const preferredExperimentalViewMode = userRecipe?.preferredExperimentalViewMode ?? presetRecipe.preferredExperimentalViewMode ?? null;

  const cssVars = {
    '--overlay-explorer-root-bg': surfaces.rootBackground,
    '--overlay-explorer-content-bg': surfaces.contentBackground,
    '--overlay-explorer-sidebar-bg': surfaces.sidebarBackground,
    '--overlay-explorer-sidebar-border': surfaces.sidebarBorder,
    '--overlay-explorer-toolbar-bg': surfaces.toolbarBackground,
    '--overlay-explorer-toolbar-border': surfaces.toolbarBorder,
    '--overlay-explorer-toolbar-shadow': surfaces.toolbarShadow,
    '--overlay-explorer-omnibox-bg': surfaces.omniboxBackground,
    '--overlay-explorer-omnibox-border': surfaces.omniboxBorder,
    '--overlay-explorer-preview-bg': surfaces.previewBackground,
    '--overlay-explorer-preview-header-bg': surfaces.previewHeaderBackground,
    '--overlay-explorer-preview-border': surfaces.previewBorder,
    '--overlay-explorer-status-bg': surfaces.statusBarBackground,
    '--overlay-explorer-status-border': surfaces.statusBarBorder,
    '--overlay-explorer-item-hover-bg': surfaces.itemHoverBackground,
    '--overlay-explorer-item-hover-border': surfaces.itemHoverBorder,
    '--overlay-explorer-item-selected-bg': surfaces.itemSelectedBackground,
    '--overlay-explorer-item-selected-border': surfaces.itemSelectedBorder,
    '--overlay-explorer-item-drop-bg': surfaces.itemDropBackground,
    '--overlay-explorer-item-drop-border': surfaces.itemDropBorder,
    '--overlay-explorer-item-focus-shadow': surfaces.itemFocusShadow,
    '--overlay-explorer-input-bg': surfaces.inputBackground,
    '--overlay-explorer-input-border': surfaces.inputBorder,
    '--overlay-explorer-chip-bg': surfaces.chipBackground,
    '--overlay-explorer-chip-border': surfaces.chipBorder,
    '--overlay-explorer-chip-active-bg': surfaces.chipActiveBackground,
    '--overlay-explorer-chip-active-border': surfaces.chipActiveBorder,
    '--overlay-explorer-chip-active-text': surfaces.chipActiveText,
    '--overlay-explorer-toolbar-gap': formatLength(metrics.toolbarGap),
    '--overlay-explorer-toolbar-padding': `${formatLength(metrics.toolbarPaddingY)} ${formatLength(metrics.toolbarPaddingX)}`,
    '--overlay-explorer-control-radius': formatLength(metrics.controlRadius),
    '--overlay-explorer-panel-radius': formatLength(metrics.panelRadius),
    '--overlay-explorer-chrome-inset': formatLength(metrics.chromeInset),
    '--overlay-explorer-hover-lift': formatLength(metrics.hoverLiftPx),
    '--overlay-explorer-rail-width': formatLength(metrics.railWidth),
    '--overlay-explorer-preview-width': formatLength(metrics.previewWidth),
    '--overlay-explorer-toolbar-font-size': formatLength(typography.toolbarFontSize),
    '--overlay-explorer-breadcrumb-font-size': formatLength(typography.breadcrumbFontSize),
    '--overlay-explorer-entry-title-size': formatLength(typography.entryTitleSize),
    '--overlay-explorer-entry-meta-size': formatLength(typography.entryMetaSize),
    '--overlay-explorer-status-font-size': formatLength(typography.statusFontSize),
    '--overlay-explorer-rail-eyebrow-size': formatLength(typography.railEyebrowSize),
    '--overlay-explorer-rail-title-size': formatLength(typography.railTitleSize),
    '--overlay-explorer-entry-title-weight': String(Math.round(typography.entryTitleWeight)),
    '--overlay-explorer-label-spacing': typography.labelLetterSpacing,
    ...(userRecipe?.cssVars ?? {}),
  };

  return {
    preset,
    railPosition: userRecipe?.railPosition ?? presetRecipe.railPosition ?? 'left',
    railBrandLabel,
    toolbarStyle: userRecipe?.toolbarStyle ?? presetRecipe.toolbarStyle ?? 'solid',
    breadcrumbStyle: userRecipe?.breadcrumbStyle ?? presetRecipe.breadcrumbStyle ?? 'plain',
    selectionStyle: userRecipe?.selectionStyle ?? presetRecipe.selectionStyle ?? 'fill',
    hoverStyle: userRecipe?.hoverStyle ?? presetRecipe.hoverStyle ?? 'fill',
    previewStyle: userRecipe?.previewStyle ?? presetRecipe.previewStyle ?? 'attached',
    statusBarStyle: userRecipe?.statusBarStyle ?? presetRecipe.statusBarStyle ?? 'solid',
    labelMode: userRecipe?.labelMode ?? presetRecipe.labelMode ?? 'stacked',
    preferredViewMode: preferredViewMode && isExplorerViewMode(preferredViewMode) ? preferredViewMode : null,
    preferredExperimentalViewMode: preferredExperimentalViewMode && isExplorerExperimentalViewMode(preferredExperimentalViewMode)
      ? preferredExperimentalViewMode
      : null,
    metrics,
    surfaces,
    typography,
    cssVars,
  };
}

export function applyExplorerThemeToGridMetrics(
  metrics: ExplorerGridMetrics,
  explorerTheme: ResolvedExplorerThemeRecipe,
): ExplorerGridMetrics {
  const spacingScale = explorerTheme.metrics.spacingScale;
  const gridScale = explorerTheme.metrics.gridScale;
  const iconScale = explorerTheme.metrics.iconScale;

  return {
    minWidth: Math.max(72, Math.round(metrics.minWidth * gridScale)),
    gap: Math.max(6, Math.round(metrics.gap * spacingScale)),
    padding: Math.max(8, Math.round(metrics.padding * spacingScale)),
    rowHeight: Math.max(84, Math.round(metrics.rowHeight * gridScale)),
    searchRowHeight: Math.max(104, Math.round(metrics.searchRowHeight * gridScale)),
    newItemHeight: Math.max(84, Math.round(metrics.newItemHeight * gridScale)),
    iconSize: Math.max(16, Math.round(metrics.iconSize * iconScale)),
    iconStageSize: Math.max(20, Math.round(metrics.iconStageSize * iconScale)),
    tileRadius: Math.max(8, Math.round(metrics.tileRadius * explorerTheme.metrics.spacingScale)),
    nameLines: metrics.nameLines,
  };
}

export function applyExplorerThemeToRowMetrics(
  metrics: ExplorerRowMetrics | undefined,
  explorerTheme: ResolvedExplorerThemeRecipe,
): ExplorerRowMetrics | undefined {
  if (!metrics) {
    return metrics;
  }

  return {
    rowHeight: Math.max(30, Math.round(metrics.rowHeight * explorerTheme.metrics.rowHeightScale)),
    searchRowHeight: Math.max(44, Math.round(metrics.searchRowHeight * explorerTheme.metrics.rowHeightScale)),
    newItemHeight: Math.max(34, Math.round(metrics.newItemHeight * explorerTheme.metrics.rowHeightScale)),
    iconSize: Math.max(14, Math.round(metrics.iconSize * explorerTheme.metrics.iconScale)),
  };
}

export function applyExplorerThemeToAdaptiveDensityStop(
  densityStop: AdaptiveSemanticDensityStopDefinition | null,
  explorerTheme: ResolvedExplorerThemeRecipe,
): AdaptiveSemanticDensityStopDefinition | null {
  if (!densityStop) {
    return densityStop;
  }

  return {
    ...densityStop,
    grid: densityStop.grid
      ? {
          minWidth: Math.max(84, Math.round(densityStop.grid.minWidth * explorerTheme.metrics.gridScale)),
          gap: Math.max(6, Math.round(densityStop.grid.gap * explorerTheme.metrics.spacingScale)),
          padding: Math.max(6, Math.round(densityStop.grid.padding * explorerTheme.metrics.spacingScale)),
          minHeight: Math.max(82, Math.round(densityStop.grid.minHeight * explorerTheme.metrics.gridScale)),
          iconSize: Math.max(16, Math.round(densityStop.grid.iconSize * explorerTheme.metrics.iconScale)),
          iconStageSize: Math.max(18, Math.round(densityStop.grid.iconStageSize * explorerTheme.metrics.iconScale)),
          titleLines: densityStop.grid.titleLines,
        }
      : undefined,
    table: densityStop.table
      ? {
          rowHeight: Math.max(30, Math.round(densityStop.table.rowHeight * explorerTheme.metrics.rowHeightScale)),
          iconSize: Math.max(14, Math.round(densityStop.table.iconSize * explorerTheme.metrics.iconScale)),
          showRichMeta: densityStop.table.showRichMeta,
        }
      : undefined,
  };
}
