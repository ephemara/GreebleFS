import type { ResolvedOverlayAppearance } from './appearance';
import type {
  ThemeDensity,
  ThemeIconStyle,
  ThemeMotionStyle,
} from '../generated/tauri';
import type {
  AdaptiveSemanticDensityStopDefinition,
  ExplorerExperimentalViewMode,
} from './explorerExperimentalModes';
import type {
  ExplorerGridIconMetrics,
  ExplorerGridLayoutMetrics,
  ExplorerGridMetrics,
  ExplorerRowMetrics,
  ExplorerViewMode,
} from './explorerViewModes';
import {
  normalizeExplorerMenuPresentationRecipe,
  type ExplorerMenuPresentationRecipe,
} from './explorerContextMenu';
import {
  readThemeBooleanProp,
  readThemeNumberProp,
  readThemeStringProp,
  resolveThemeEngineBindings,
} from './themeEngineBindings';
import {
  defaultExplorerChromeLayoutId,
  normalizeExplorerChromeLayoutId,
  type ExplorerChromeLayoutId,
} from './explorerChromeLayouts';
import {
  defaultExplorerModeProfileId,
  normalizeExplorerModeProfileId,
  type ExplorerModeProfileId,
} from './explorerModeProfiles';
import {
  explorerRailSectionOrder,
  type ExplorerRailActiveBranchStyle,
  type ExplorerRailHierarchyGuideStyle,
  type ExplorerRailIconTone,
  type ExplorerRailRowChrome,
  type ExplorerRailSectionChrome,
  type ExplorerRailSectionId,
  type ExplorerRailViewMode,
} from './explorerRail';

export type OverlayExplorerThemePreset = 'workbench' | 'xmb' | 'channel-grid' | 'custom';
export type OverlayExplorerToolbarStyle = 'solid' | 'glass' | 'floating' | 'minimal';
export type OverlayExplorerBreadcrumbStyle = 'plain' | 'segmented' | 'capsule';
export type OverlayExplorerSelectionStyle = 'fill' | 'outline' | 'glow';
export type OverlayExplorerHoverStyle = 'fill' | 'lift' | 'glow';
export type OverlayExplorerPreviewStyle = 'attached' | 'floating' | 'glass';
export type OverlayExplorerStatusBarStyle = 'solid' | 'floating' | 'hidden';
export type OverlayExplorerLabelMode = 'stacked' | 'inline';
export type OverlayExplorerRailPosition = 'left' | 'right';
export type OverlayExplorerRailSectionHeaderTextTransform = 'uppercase' | 'none';
export type OverlayExplorerBookmarkChromeStyle = 'full' | 'minimal';
export type OverlayExplorerWorkspaceTabStyle = 'underline' | 'capsule' | 'segment' | 'windows';
export type OverlayExplorerTabCloseButtonMode = 'active-only' | 'always' | 'never';

export interface OverlayExplorerRailThemeRecipe {
  defaultViewMode?: ExplorerRailViewMode;
  showViewModeSelector?: boolean;
  showAutoExpandToggle?: boolean;
  autoExpandToOpenFolder?: boolean;
  sectionOrder?: ExplorerRailSectionId[];
  hiddenSectionIds?: ExplorerRailSectionId[];
  sectionLabels?: Partial<Record<ExplorerRailSectionId, string>>;
  sectionChrome?: ExplorerRailSectionChrome;
  rowChrome?: ExplorerRailRowChrome;
  hierarchyGuideStyle?: ExplorerRailHierarchyGuideStyle;
  activeBranchStyle?: ExplorerRailActiveBranchStyle;
  iconTone?: ExplorerRailIconTone;
  treeIndentStep?: number;
  showSupportingMeta?: boolean;
  showDriveCapacity?: boolean;
  flattenDriveRows?: boolean;
  showSectionHeaders?: boolean;
  sectionHeaderTextTransform?: OverlayExplorerRailSectionHeaderTextTransform;
  bookmarkChromeStyle?: OverlayExplorerBookmarkChromeStyle;
  sectionGap?: number;
}

export interface ResolvedExplorerRailThemeRecipe {
  defaultViewMode: ExplorerRailViewMode | null;
  showViewModeSelector: boolean;
  showAutoExpandToggle: boolean;
  autoExpandToOpenFolder: boolean | null;
  sectionOrder: ExplorerRailSectionId[];
  hiddenSectionIds: ExplorerRailSectionId[];
  sectionLabels: Partial<Record<ExplorerRailSectionId, string>>;
  sectionChrome: ExplorerRailSectionChrome | null;
  rowChrome: ExplorerRailRowChrome | null;
  hierarchyGuideStyle: ExplorerRailHierarchyGuideStyle | null;
  activeBranchStyle: ExplorerRailActiveBranchStyle | null;
  iconTone: ExplorerRailIconTone | null;
  treeIndentStep: number | null;
  showSupportingMeta: boolean | null;
  showDriveCapacity: boolean | null;
  flattenDriveRows: boolean | null;
  showSectionHeaders: boolean;
  sectionHeaderTextTransform: OverlayExplorerRailSectionHeaderTextTransform;
  bookmarkChromeStyle: OverlayExplorerBookmarkChromeStyle;
  sectionGap: number | null;
}

export interface OverlayExplorerWorkspaceTabsThemeRecipe {
  style?: OverlayExplorerWorkspaceTabStyle;
  showPaneSwitcher?: boolean;
  showLeadingStatusDot?: boolean;
  showPaneCountBadge?: boolean;
  showActiveIndicator?: boolean;
  closeButtonMode?: OverlayExplorerTabCloseButtonMode;
}

export interface ResolvedExplorerWorkspaceTabsThemeRecipe {
  style: OverlayExplorerWorkspaceTabStyle;
  showPaneSwitcher: boolean;
  showLeadingStatusDot: boolean;
  showPaneCountBadge: boolean;
  showActiveIndicator: boolean;
  closeButtonMode: OverlayExplorerTabCloseButtonMode;
}

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
  chromeLayoutId?: ExplorerChromeLayoutId;
  defaultModeProfileId?: ExplorerModeProfileId;
  layoutPrimitiveId?: string;
  navigationPatternId?: string;
  renderStyleId?: string;
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
  menuPresentation?: ExplorerMenuPresentationRecipe;
  rail?: OverlayExplorerRailThemeRecipe;
  workspaceTabs?: OverlayExplorerWorkspaceTabsThemeRecipe;
  metrics?: OverlayExplorerThemeMetrics;
  surfaces?: OverlayExplorerThemeSurfaces;
  typography?: OverlayExplorerThemeTypography;
  cssVars?: Record<string, string>;
}

export interface ResolvedExplorerThemeRecipe {
  preset: OverlayExplorerThemePreset;
  chromeLayoutId: ExplorerChromeLayoutId;
  defaultModeProfileId: ExplorerModeProfileId | null;
  layoutPrimitiveId: string | null;
  navigationPatternId: string | null;
  renderStyleId: string | null;
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
  menuPresentation: ExplorerMenuPresentationRecipe;
  rail: ResolvedExplorerRailThemeRecipe;
  workspaceTabs: ResolvedExplorerWorkspaceTabsThemeRecipe;
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
  sidebarBackground: 'color-mix(in srgb, var(--overlay-bg-sidebar) 96%, transparent)',
  sidebarBorder: 'color-mix(in srgb, var(--overlay-accent) 10%, var(--overlay-border))',
  toolbarBackground: 'color-mix(in srgb, var(--overlay-bg-panel) 90%, transparent)',
  toolbarBorder: 'color-mix(in srgb, var(--overlay-accent) 10%, var(--overlay-border))',
  toolbarShadow: '0 14px 34px rgba(0,0,0,0.18)',
  omniboxBackground: 'color-mix(in srgb, var(--overlay-bg-shell) 88%, transparent)',
  omniboxBorder: 'color-mix(in srgb, var(--overlay-accent) 12%, var(--overlay-border))',
  previewBackground: 'color-mix(in srgb, var(--overlay-bg-panel) 92%, transparent)',
  previewHeaderBackground: 'color-mix(in srgb, var(--overlay-bg-sidebar) 92%, transparent)',
  previewBorder: 'color-mix(in srgb, var(--overlay-accent) 8%, var(--overlay-border))',
  statusBarBackground: 'color-mix(in srgb, var(--overlay-bg-sidebar) 90%, transparent)',
  statusBarBorder: 'color-mix(in srgb, var(--overlay-accent) 8%, var(--overlay-border))',
  itemHoverBackground: 'rgba(255,255,255,0.04)',
  itemHoverBorder: 'rgba(255,255,255,0.09)',
  itemSelectedBackground: 'var(--overlay-bg-selection)',
  itemSelectedBorder: 'color-mix(in srgb, var(--overlay-accent) 72%, transparent)',
  itemDropBackground: 'color-mix(in srgb, var(--overlay-accent) 16%, transparent)',
  itemDropBorder: 'var(--overlay-accent)',
  itemFocusShadow: '0 12px 28px color-mix(in srgb, var(--overlay-accent) 14%, transparent)',
  inputBackground: 'var(--overlay-bg-input)',
  inputBorder: 'var(--overlay-accent)',
  chipBackground: 'transparent',
  chipBorder: 'var(--overlay-border)',
  chipActiveBackground: 'color-mix(in srgb, var(--overlay-accent) 14%, transparent)',
  chipActiveBorder: 'color-mix(in srgb, var(--overlay-accent) 45%, transparent)',
  chipActiveText: 'var(--overlay-accent)',
};

const defaultExplorerRailSectionLabels = {
  'quick-access': 'Quick Access',
  drives: 'Drives',
  'saved-searches': 'Saved Searches',
  tags: 'Tags',
  bookmarks: 'Bookmarks',
} as const satisfies Record<ExplorerRailSectionId, string>;

const defaultExplorerRailTheme: ResolvedExplorerRailThemeRecipe = {
  defaultViewMode: null,
  showViewModeSelector: true,
  showAutoExpandToggle: true,
  autoExpandToOpenFolder: null,
  sectionOrder: [...explorerRailSectionOrder],
  hiddenSectionIds: [],
  sectionLabels: {},
  sectionChrome: null,
  rowChrome: null,
  hierarchyGuideStyle: null,
  activeBranchStyle: null,
  iconTone: null,
  treeIndentStep: null,
  showSupportingMeta: null,
  showDriveCapacity: null,
  flattenDriveRows: null,
  showSectionHeaders: true,
  sectionHeaderTextTransform: 'uppercase',
  bookmarkChromeStyle: 'full',
  sectionGap: null,
};

const defaultExplorerWorkspaceTabsTheme: ResolvedExplorerWorkspaceTabsThemeRecipe = {
  style: 'capsule',
  showPaneSwitcher: true,
  showLeadingStatusDot: true,
  showPaneCountBadge: true,
  showActiveIndicator: true,
  closeButtonMode: 'always',
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

function isExplorerRailViewModeValue(value: unknown): value is ExplorerRailViewMode {
  return value === 'default' || value === 'compact' || value === 'tree';
}

function asExplorerRailSectionChrome(value: unknown): ExplorerRailSectionChrome | undefined {
  return value === 'carded'
    || value === 'compact'
    || value === 'tree'
    || value === 'plain'
    ? value
    : undefined;
}

function asExplorerRailRowChrome(value: unknown): ExplorerRailRowChrome | undefined {
  return value === 'carded'
    || value === 'compact'
    || value === 'tree'
    || value === 'plain'
    ? value
    : undefined;
}

function asExplorerRailHierarchyGuideStyle(
  value: unknown,
): ExplorerRailHierarchyGuideStyle | undefined {
  return value === 'none' || value === 'soft' || value === 'strong'
    ? value
    : undefined;
}

function asExplorerRailActiveBranchStyle(
  value: unknown,
): ExplorerRailActiveBranchStyle | undefined {
  return value === 'soft' || value === 'bold' || value === 'lane'
    ? value
    : undefined;
}

function asExplorerRailIconTone(value: unknown): ExplorerRailIconTone | undefined {
  return value === 'muted' || value === 'contrast' || value === 'accented'
    ? value
    : undefined;
}

function asExplorerRailSectionId(value: unknown): ExplorerRailSectionId | undefined {
  return value === 'quick-access'
    || value === 'drives'
    || value === 'saved-searches'
    || value === 'tags'
    || value === 'bookmarks'
    ? value
    : undefined;
}

function asExplorerRailSectionHeaderTextTransform(
  value: unknown,
): OverlayExplorerRailSectionHeaderTextTransform | undefined {
  return value === 'uppercase' || value === 'none' ? value : undefined;
}

function asExplorerBookmarkChromeStyle(
  value: unknown,
): OverlayExplorerBookmarkChromeStyle | undefined {
  return value === 'full' || value === 'minimal' ? value : undefined;
}

function asExplorerWorkspaceTabStyle(
  value: unknown,
): OverlayExplorerWorkspaceTabStyle | undefined {
  return value === 'underline'
    || value === 'capsule'
    || value === 'segment'
    || value === 'windows'
    ? value
    : undefined;
}

function asExplorerTabCloseButtonMode(
  value: unknown,
): OverlayExplorerTabCloseButtonMode | undefined {
  return value === 'active-only' || value === 'always' || value === 'never'
    ? value
    : undefined;
}

function normalizeExplorerRailSectionOrder(
  value: unknown,
): ExplorerRailSectionId[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const seen = new Set<ExplorerRailSectionId>();
  const orderedIds = value
    .map(entry => asExplorerRailSectionId(entry))
    .filter((entry): entry is ExplorerRailSectionId => Boolean(entry))
    .filter((entry) => {
      if (seen.has(entry)) {
        return false;
      }
      seen.add(entry);
      return true;
    });

  return orderedIds.length > 0 ? orderedIds : undefined;
}

function normalizeExplorerRailSectionLabels(
  value: Record<string, unknown> | undefined,
): Partial<Record<ExplorerRailSectionId, string>> {
  if (!value) {
    return {};
  }

  const labels: Partial<Record<ExplorerRailSectionId, string>> = {};
  for (const [key, label] of Object.entries(value)) {
    const sectionId = asExplorerRailSectionId(key);
    const normalizedLabel = asTrimmedString(label);
    if (!sectionId || !normalizedLabel) {
      continue;
    }
    labels[sectionId] = normalizedLabel;
  }
  return labels;
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

function normalizeExplorerRailThemeRecipe(
  recipe?: OverlayExplorerRailThemeRecipe,
  fallback?: OverlayExplorerRailThemeRecipe,
): OverlayExplorerRailThemeRecipe | undefined {
  if (!recipe && !fallback) {
    return undefined;
  }

  const mergedSectionLabels = {
    ...normalizeExplorerRailSectionLabels(fallback?.sectionLabels as Record<string, unknown> | undefined),
    ...normalizeExplorerRailSectionLabels(recipe?.sectionLabels as Record<string, unknown> | undefined),
  };
  const hiddenSectionIds = normalizeExplorerRailSectionOrder(
    recipe?.hiddenSectionIds ?? fallback?.hiddenSectionIds,
  );

  return {
    defaultViewMode: isExplorerRailViewModeValue(recipe?.defaultViewMode)
      ? recipe.defaultViewMode
      : isExplorerRailViewModeValue(fallback?.defaultViewMode)
        ? fallback.defaultViewMode
        : undefined,
    showViewModeSelector: recipe?.showViewModeSelector ?? fallback?.showViewModeSelector,
    showAutoExpandToggle: recipe?.showAutoExpandToggle ?? fallback?.showAutoExpandToggle,
    autoExpandToOpenFolder:
      recipe?.autoExpandToOpenFolder ?? fallback?.autoExpandToOpenFolder,
    sectionOrder: normalizeExplorerRailSectionOrder(recipe?.sectionOrder)
      ?? normalizeExplorerRailSectionOrder(fallback?.sectionOrder),
    hiddenSectionIds,
    sectionLabels: mergedSectionLabels,
    sectionChrome: asExplorerRailSectionChrome(recipe?.sectionChrome)
      ?? asExplorerRailSectionChrome(fallback?.sectionChrome),
    rowChrome: asExplorerRailRowChrome(recipe?.rowChrome)
      ?? asExplorerRailRowChrome(fallback?.rowChrome),
    hierarchyGuideStyle: asExplorerRailHierarchyGuideStyle(recipe?.hierarchyGuideStyle)
      ?? asExplorerRailHierarchyGuideStyle(fallback?.hierarchyGuideStyle),
    activeBranchStyle: asExplorerRailActiveBranchStyle(recipe?.activeBranchStyle)
      ?? asExplorerRailActiveBranchStyle(fallback?.activeBranchStyle),
    iconTone: asExplorerRailIconTone(recipe?.iconTone)
      ?? asExplorerRailIconTone(fallback?.iconTone),
    treeIndentStep: asFiniteNumber(recipe?.treeIndentStep)
      ?? asFiniteNumber(fallback?.treeIndentStep),
    showSupportingMeta: recipe?.showSupportingMeta ?? fallback?.showSupportingMeta,
    showDriveCapacity: recipe?.showDriveCapacity ?? fallback?.showDriveCapacity,
    flattenDriveRows: recipe?.flattenDriveRows ?? fallback?.flattenDriveRows,
    showSectionHeaders: recipe?.showSectionHeaders ?? fallback?.showSectionHeaders,
    sectionHeaderTextTransform:
      asExplorerRailSectionHeaderTextTransform(recipe?.sectionHeaderTextTransform)
      ?? asExplorerRailSectionHeaderTextTransform(fallback?.sectionHeaderTextTransform),
    bookmarkChromeStyle: asExplorerBookmarkChromeStyle(recipe?.bookmarkChromeStyle)
      ?? asExplorerBookmarkChromeStyle(fallback?.bookmarkChromeStyle),
    sectionGap: asFiniteNumber(recipe?.sectionGap)
      ?? asFiniteNumber(fallback?.sectionGap),
  };
}

function normalizeExplorerWorkspaceTabsThemeRecipe(
  recipe?: OverlayExplorerWorkspaceTabsThemeRecipe,
  fallback?: OverlayExplorerWorkspaceTabsThemeRecipe,
): OverlayExplorerWorkspaceTabsThemeRecipe | undefined {
  if (!recipe && !fallback) {
    return undefined;
  }

  return {
    style: asExplorerWorkspaceTabStyle(recipe?.style)
      ?? asExplorerWorkspaceTabStyle(fallback?.style),
    showPaneSwitcher: recipe?.showPaneSwitcher ?? fallback?.showPaneSwitcher,
    showLeadingStatusDot:
      recipe?.showLeadingStatusDot ?? fallback?.showLeadingStatusDot,
    showPaneCountBadge:
      recipe?.showPaneCountBadge ?? fallback?.showPaneCountBadge,
    showActiveIndicator:
      recipe?.showActiveIndicator ?? fallback?.showActiveIndicator,
    closeButtonMode: asExplorerTabCloseButtonMode(recipe?.closeButtonMode)
      ?? asExplorerTabCloseButtonMode(fallback?.closeButtonMode),
  };
}

export function normalizeExplorerThemeRecipe(
  recipe?: OverlayExplorerThemeRecipe,
  fallback?: OverlayExplorerThemeRecipe,
): OverlayExplorerThemeRecipe | undefined {
  if (!recipe && !fallback) {
    return undefined;
  }

  const source = recipe ?? fallback;
  const mergedMetrics = source?.metrics ?? {};
  const mergedSurfaces = source?.surfaces ?? {};
  const mergedTypography = source?.typography ?? {};
  const mergedRail = normalizeExplorerRailThemeRecipe(recipe?.rail, fallback?.rail);
  const mergedWorkspaceTabs = normalizeExplorerWorkspaceTabsThemeRecipe(
    recipe?.workspaceTabs,
    fallback?.workspaceTabs,
  );

  const next: OverlayExplorerThemeRecipe = {
    preset: source?.preset,
    chromeLayoutId: source?.chromeLayoutId
      ? normalizeExplorerChromeLayoutId(source.chromeLayoutId)
      : undefined,
    defaultModeProfileId: source?.defaultModeProfileId
      ? normalizeExplorerModeProfileId(source.defaultModeProfileId)
      : undefined,
    layoutPrimitiveId: asTrimmedString(source?.layoutPrimitiveId),
    navigationPatternId: asTrimmedString(source?.navigationPatternId),
    renderStyleId: asTrimmedString(source?.renderStyleId),
    railPosition: source?.railPosition,
    railBrandLabel: asTrimmedString(source?.railBrandLabel),
    toolbarStyle: source?.toolbarStyle,
    breadcrumbStyle: source?.breadcrumbStyle,
    selectionStyle: source?.selectionStyle,
    hoverStyle: source?.hoverStyle,
    previewStyle: source?.previewStyle,
    statusBarStyle: source?.statusBarStyle,
    labelMode: source?.labelMode,
    preferredViewMode: isExplorerViewMode(source?.preferredViewMode)
      ? source.preferredViewMode
      : undefined,
    preferredExperimentalViewMode: isExplorerExperimentalViewMode(source?.preferredExperimentalViewMode)
      ? source.preferredExperimentalViewMode
      : undefined,
    menuPresentation: normalizeExplorerMenuPresentationRecipe(source?.menuPresentation),
    rail: mergedRail,
    workspaceTabs: mergedWorkspaceTabs,
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
      ...normalizeCssVarRecord(source?.cssVars),
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
        defaultModeProfileId: 'navigator',
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
        defaultModeProfileId: 'navigator',
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
        defaultModeProfileId: 'balanced',
        railPosition: 'left',
        railBrandLabel: '',
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
        defaultModeProfileId: 'balanced',
        railPosition: 'left',
        railBrandLabel: '',
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

function inferExplorerPresetFromEngine(appearance?: ResolvedOverlayAppearance): OverlayExplorerThemePreset | undefined {
  const bindings = resolveThemeEngineBindings(appearance?.baseTheme.compiledEngineManifest, appearance?.baseTheme.explorer);
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

function getDensitySpacingScale(density: ThemeDensity | null | undefined): number {
  switch (density) {
    case 'compact':
      return 0.92;
    case 'immersive':
      return 1.16;
    default:
      return 1;
  }
}

function getIconStyleScale(iconStyle: ThemeIconStyle | null | undefined): number {
  switch (iconStyle) {
    case 'pixel':
      return 0.94;
    case 'skeuomorphic':
      return 1.18;
    default:
      return 1;
  }
}

function getHoverLiftFromMotion(motionStyle: ThemeMotionStyle | null | undefined): number {
  switch (motionStyle) {
    case 'instant':
      return 0;
    case 'snappy':
      return 1;
    case 'dramatic':
      return 4;
    default:
      return 2;
  }
}

function createExplorerStyleSeed(
  appearance?: ResolvedOverlayAppearance,
): Pick<
  OverlayExplorerThemeRecipe,
  'toolbarStyle' | 'breadcrumbStyle' | 'selectionStyle' | 'hoverStyle' | 'previewStyle' | 'statusBarStyle' | 'labelMode'
> {
  const chromeStyle = appearance?.baseTheme.compiledEngineManifest?.manifest.presentation.chromeStyle;
  switch (chromeStyle) {
    case 'floating':
      return {
        toolbarStyle: 'floating',
        breadcrumbStyle: 'segmented',
        selectionStyle: 'outline',
        hoverStyle: 'lift',
        previewStyle: 'floating',
        statusBarStyle: 'floating',
        labelMode: 'stacked',
      };
    case 'minimal':
      return {
        toolbarStyle: 'minimal',
        breadcrumbStyle: 'plain',
        selectionStyle: 'outline',
        hoverStyle: 'lift',
        previewStyle: 'floating',
        statusBarStyle: 'hidden',
        labelMode: 'stacked',
      };
    case 'ornate':
      return {
        toolbarStyle: 'glass',
        breadcrumbStyle: 'capsule',
        selectionStyle: 'glow',
        hoverStyle: 'glow',
        previewStyle: 'glass',
        statusBarStyle: 'floating',
        labelMode: 'stacked',
      };
    default:
      return {
        toolbarStyle: 'solid',
        breadcrumbStyle: 'plain',
        selectionStyle: 'fill',
        hoverStyle: 'fill',
        previewStyle: 'attached',
        statusBarStyle: 'solid',
        labelMode: 'stacked',
      };
  }
}

function createExplorerEngineRecipe(
  appearance?: ResolvedOverlayAppearance,
): OverlayExplorerThemeRecipe {
  if (!appearance?.baseTheme.compiledEngineManifest) {
    return {};
  }

  const userRecipe = appearance?.baseTheme.explorer;
  const bindings = resolveThemeEngineBindings(appearance?.baseTheme.compiledEngineManifest, userRecipe);
  const presentation = bindings.presentation;
  const layoutPrimitive = bindings.layoutPrimitive;
  const navigationPattern = bindings.navigationPattern;
  const renderStyle = bindings.renderStyle;
  const navigationProps = navigationPattern?.props;
  const styleSeed = createExplorerStyleSeed(appearance);
  const spacingScale = getDensitySpacingScale(presentation?.density);
  const panelSpacing = clampNumber(
    Math.round(presentation?.panelSpacing ?? workbenchMetrics.toolbarGap),
    4,
    24,
  );
  const panelRadius = clampNumber(
    Math.round(presentation?.cornerRadius ?? workbenchMetrics.panelRadius),
    8,
    48,
  );
  let controlRadius = clampNumber(
    Math.round((presentation?.cornerRadius ?? workbenchMetrics.controlRadius) * 0.9),
    4,
    999,
  );
  const layoutGap = readThemeNumberProp(layoutPrimitive?.props, 'gap')
    ?? readThemeNumberProp(layoutPrimitive?.props, 'gutter')
    ?? panelSpacing;
  const layoutSide = readThemeStringProp(layoutPrimitive?.props, 'side');

  let railPosition: OverlayExplorerRailPosition = layoutSide === 'right' ? 'right' : 'left';
  let toolbarStyle = styleSeed.toolbarStyle;
  let breadcrumbStyle = styleSeed.breadcrumbStyle;
  let selectionStyle = styleSeed.selectionStyle;
  let hoverStyle = styleSeed.hoverStyle;
  let previewStyle = styleSeed.previewStyle;
  let statusBarStyle = styleSeed.statusBarStyle;
  let labelMode = styleSeed.labelMode;
  let preferredViewMode: ExplorerViewMode | null = null;
  let preferredExperimentalViewMode: ExplorerExperimentalViewMode | null = null;
  let railWidth = layoutPrimitive?.kind === 'dock' ? 236 : workbenchMetrics.railWidth;
  let previewWidth = layoutPrimitive?.kind === 'split' ? 440 : workbenchMetrics.previewWidth;
  let chromeInset = presentation?.chromeStyle === 'floating'
    ? Math.round(panelSpacing)
    : presentation?.chromeStyle === 'minimal'
      ? Math.round(panelSpacing * 0.5)
      : 0;
  let toolbarPaddingX = Math.max(8, Math.round(panelSpacing + 2));
  let toolbarPaddingY = Math.max(6, Math.round(panelSpacing * 0.7));
  let toolbarGap = Math.max(6, Math.round(layoutGap));
  let metricsSpacingScale = spacingScale;
  let gridScale = layoutPrimitive?.kind === 'grid' ? 1.18 : 1;
  let rowHeightScale = presentation?.density === 'compact'
    ? 0.94
    : presentation?.density === 'immersive'
      ? 1.08
      : 1;
  let iconScale = getIconStyleScale(presentation?.iconStyle);
  let hoverLiftPx = getHoverLiftFromMotion(presentation?.motionStyle);

  switch (layoutPrimitive?.kind) {
    case 'grid':
      preferredViewMode = 'icons-xl';
      labelMode = 'stacked';
      previewWidth = Math.max(previewWidth, 420);
      break;
    case 'freeform':
      preferredViewMode = 'icons-l';
      labelMode = 'stacked';
      previewStyle = previewStyle === 'attached' ? 'floating' : previewStyle;
      gridScale = Math.max(gridScale, 1.1);
      break;
    case 'split':
      preferredViewMode = 'columns';
      labelMode = 'inline';
      previewWidth = Math.max(previewWidth, 460);
      break;
    case 'stack':
      preferredViewMode = 'details';
      labelMode = 'inline';
      break;
    case 'dock':
      preferredViewMode = 'list';
      railWidth = Math.max(railWidth, 232);
      break;
    default:
      break;
  }

  switch (navigationPattern?.kind) {
    case 'xmb':
      toolbarStyle = 'floating';
      breadcrumbStyle = 'capsule';
      selectionStyle = 'glow';
      hoverStyle = 'glow';
      previewStyle = 'glass';
      statusBarStyle = 'floating';
      labelMode = 'stacked';
      preferredViewMode = preferredViewMode ?? 'icons-xl';
      preferredExperimentalViewMode = 'adaptive-semantic-grid';
      gridScale = Math.max(gridScale, 1.2);
      iconScale = Math.max(iconScale, 1.2);
      hoverLiftPx = Math.max(hoverLiftPx, 3);
      break;
    case 'spatial':
      breadcrumbStyle = 'capsule';
      selectionStyle = 'outline';
      hoverStyle = 'lift';
      previewStyle = previewStyle === 'attached' ? 'floating' : previewStyle;
      labelMode = 'stacked';
      preferredViewMode = preferredViewMode ?? 'icons-xl';
      gridScale = Math.max(gridScale, 1.14);
      break;
    case 'hierarchy':
      breadcrumbStyle = 'segmented';
      selectionStyle = 'outline';
      hoverStyle = 'lift';
      labelMode = 'inline';
      preferredViewMode = preferredViewMode ?? 'columns';
      break;
    case 'palette':
      toolbarStyle = toolbarStyle === 'minimal' ? toolbarStyle : 'solid';
      previewStyle = 'attached';
      preferredViewMode = preferredViewMode ?? 'list';
      break;
    case 'tabbed':
      breadcrumbStyle = 'segmented';
      preferredViewMode = preferredViewMode ?? 'columns';
      break;
    default:
      break;
  }

  switch (renderStyle?.kind) {
    case 'ps-3-xmb':
      toolbarStyle = 'floating';
      breadcrumbStyle = 'capsule';
      selectionStyle = 'glow';
      hoverStyle = 'glow';
      previewStyle = 'glass';
      statusBarStyle = 'floating';
      preferredViewMode = 'icons-xl';
      preferredExperimentalViewMode = 'adaptive-semantic-grid';
      controlRadius = 999;
      railWidth = Math.max(railWidth, 232);
      previewWidth = Math.max(previewWidth, 460);
      chromeInset = Math.max(chromeInset, 12);
      gridScale = Math.max(gridScale, 1.2);
      iconScale = Math.max(iconScale, 1.3);
      hoverLiftPx = Math.max(hoverLiftPx, 4);
      break;
    case 'wii-channels':
      toolbarStyle = 'minimal';
      breadcrumbStyle = 'segmented';
      selectionStyle = 'outline';
      hoverStyle = 'lift';
      previewStyle = 'floating';
      statusBarStyle = 'hidden';
      preferredViewMode = 'icons-xl';
      railWidth = Math.max(railWidth, 244);
      previewWidth = Math.max(previewWidth, 420);
      chromeInset = Math.max(chromeInset, 10);
      gridScale = Math.max(gridScale, 1.24);
      iconScale = Math.max(iconScale, 1.2);
      break;
    case 'ios-springboard':
      toolbarStyle = 'minimal';
      breadcrumbStyle = 'plain';
      selectionStyle = 'outline';
      hoverStyle = 'lift';
      previewStyle = 'floating';
      statusBarStyle = 'hidden';
      preferredViewMode = 'icons-xl';
      labelMode = 'stacked';
      railWidth = Math.max(railWidth, 220);
      previewWidth = Math.max(previewWidth, 400);
      chromeInset = Math.max(chromeInset, 8);
      gridScale = Math.max(gridScale, 1.22);
      iconScale = Math.max(iconScale, 1.12);
      break;
    case 'desktop-window-manager':
      toolbarStyle = 'solid';
      breadcrumbStyle = 'plain';
      selectionStyle = 'fill';
      hoverStyle = 'fill';
      previewStyle = 'attached';
      statusBarStyle = 'solid';
      preferredViewMode = preferredViewMode ?? 'details';
      labelMode = 'inline';
      railWidth = Math.max(railWidth, 260);
      break;
    default:
      break;
  }

  let railRecipe: OverlayExplorerRailThemeRecipe | undefined;
  let workspaceTabsRecipe: OverlayExplorerWorkspaceTabsThemeRecipe | undefined;

  const railSectionOrder = normalizeExplorerRailSectionOrder(
    readThemeStringProp(navigationProps, 'railSectionOrder')
      ?.split(',')
      .map(entry => entry.trim())
      .filter(Boolean),
  );
  const railHiddenSectionIds = normalizeExplorerRailSectionOrder(
    readThemeStringProp(navigationProps, 'railHiddenSectionIds')
      ?.split(',')
      .map(entry => entry.trim())
      .filter(Boolean),
  );

  if (navigationPattern?.kind === 'hierarchy') {
    railRecipe = normalizeExplorerRailThemeRecipe({
      defaultViewMode: 'tree',
      showSupportingMeta: false,
      showDriveCapacity: false,
      flattenDriveRows: true,
    }, railRecipe);
  } else if (navigationPattern?.kind === 'palette') {
    railRecipe = normalizeExplorerRailThemeRecipe({
      defaultViewMode: 'compact',
    }, railRecipe);
  }

  if (navigationPattern?.kind === 'tabbed') {
    workspaceTabsRecipe = normalizeExplorerWorkspaceTabsThemeRecipe({
      style: renderStyle?.kind === 'desktop-window-manager' ? 'windows' : 'segment',
    }, workspaceTabsRecipe);
  } else if (
    navigationPattern?.kind === 'xmb'
    || navigationPattern?.kind === 'spatial'
  ) {
    workspaceTabsRecipe = normalizeExplorerWorkspaceTabsThemeRecipe({
      style: 'capsule',
    }, workspaceTabsRecipe);
  }

  railRecipe = normalizeExplorerRailThemeRecipe({
    defaultViewMode: isExplorerRailViewModeValue(
      readThemeStringProp(navigationProps, 'railViewMode'),
    )
      ? readThemeStringProp(navigationProps, 'railViewMode') as ExplorerRailViewMode
      : undefined,
    showViewModeSelector: readThemeBooleanProp(
      navigationProps,
      'railShowViewModeSelector',
    ),
    showAutoExpandToggle: readThemeBooleanProp(
      navigationProps,
      'railShowAutoExpandToggle',
    ),
    autoExpandToOpenFolder: readThemeBooleanProp(
      navigationProps,
      'railAutoExpandToOpenFolder',
    ),
    sectionOrder: railSectionOrder,
    hiddenSectionIds: railHiddenSectionIds,
    sectionChrome: asExplorerRailSectionChrome(
      readThemeStringProp(navigationProps, 'railSectionChrome'),
    ),
    rowChrome: asExplorerRailRowChrome(
      readThemeStringProp(navigationProps, 'railRowChrome'),
    ),
    hierarchyGuideStyle: asExplorerRailHierarchyGuideStyle(
      readThemeStringProp(navigationProps, 'railHierarchyGuideStyle'),
    ),
    activeBranchStyle: asExplorerRailActiveBranchStyle(
      readThemeStringProp(navigationProps, 'railActiveBranchStyle'),
    ),
    iconTone: asExplorerRailIconTone(
      readThemeStringProp(navigationProps, 'railIconTone'),
    ),
    treeIndentStep: readThemeNumberProp(navigationProps, 'railTreeIndentStep'),
    showSupportingMeta: readThemeBooleanProp(
      navigationProps,
      'railShowSupportingMeta',
    ),
    showDriveCapacity: readThemeBooleanProp(
      navigationProps,
      'railShowDriveCapacity',
    ),
    flattenDriveRows: readThemeBooleanProp(
      navigationProps,
      'railFlattenDriveRows',
    ),
    showSectionHeaders: readThemeBooleanProp(
      navigationProps,
      'railShowSectionHeaders',
    ),
    sectionHeaderTextTransform: asExplorerRailSectionHeaderTextTransform(
      readThemeStringProp(navigationProps, 'railSectionHeaderTextTransform'),
    ),
    bookmarkChromeStyle: asExplorerBookmarkChromeStyle(
      readThemeStringProp(navigationProps, 'railBookmarkChromeStyle'),
    ),
    sectionGap: readThemeNumberProp(navigationProps, 'railSectionGap'),
  }, railRecipe);

  workspaceTabsRecipe = normalizeExplorerWorkspaceTabsThemeRecipe({
    style: asExplorerWorkspaceTabStyle(
      readThemeStringProp(navigationProps, 'workspaceTabStyle'),
    ),
    showPaneSwitcher: readThemeBooleanProp(
      navigationProps,
      'workspaceTabShowPaneSwitcher',
    ),
    showLeadingStatusDot: readThemeBooleanProp(
      navigationProps,
      'workspaceTabShowLeadingStatusDot',
    ),
    showPaneCountBadge: readThemeBooleanProp(
      navigationProps,
      'workspaceTabShowPaneCountBadge',
    ),
    showActiveIndicator: readThemeBooleanProp(
      navigationProps,
      'workspaceTabShowActiveIndicator',
    ),
    closeButtonMode: asExplorerTabCloseButtonMode(
      readThemeStringProp(navigationProps, 'workspaceTabCloseButtonMode'),
    ),
  }, workspaceTabsRecipe);

  return {
    layoutPrimitiveId: layoutPrimitive?.id,
    navigationPatternId: navigationPattern?.id,
    renderStyleId: renderStyle?.id,
    railPosition,
    toolbarStyle,
    breadcrumbStyle,
    selectionStyle,
    hoverStyle,
    previewStyle,
    statusBarStyle,
    labelMode,
    preferredViewMode: preferredViewMode ?? undefined,
    preferredExperimentalViewMode: preferredExperimentalViewMode ?? undefined,
    rail: railRecipe,
    workspaceTabs: workspaceTabsRecipe,
    metrics: {
      railWidth,
      previewWidth,
      chromeInset,
      toolbarPaddingX,
      toolbarPaddingY,
      toolbarGap,
      controlRadius,
      panelRadius,
      spacingScale: metricsSpacingScale,
      gridScale,
      rowHeightScale,
      iconScale,
      hoverLiftPx,
    },
  };
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
    ...compactObject(presetSurfaces),
    ...compactObject(overrideSurfaces),
  };
}

function resolveTypography(
  presetTypography: OverlayExplorerThemeTypography | undefined,
  overrideTypography: OverlayExplorerThemeTypography | undefined,
): Required<OverlayExplorerThemeTypography> {
  return {
    ...workbenchTypography,
    ...compactObject(presetTypography),
    ...compactObject(overrideTypography),
  };
}

function resolveExplorerRailThemeRecipe(
  presetRail: OverlayExplorerRailThemeRecipe | undefined,
  engineRail: OverlayExplorerRailThemeRecipe | undefined,
  userRail: OverlayExplorerRailThemeRecipe | undefined,
): ResolvedExplorerRailThemeRecipe {
  const normalized = normalizeExplorerRailThemeRecipe(
    userRail,
    normalizeExplorerRailThemeRecipe(engineRail, presetRail),
  );
  const hiddenSectionIds = normalizeExplorerRailSectionOrder(
    normalized?.hiddenSectionIds,
  ) ?? [];
  const orderedSectionIds = [
    ...(
      normalizeExplorerRailSectionOrder(normalized?.sectionOrder)
      ?? explorerRailSectionOrder
    ).filter(sectionId => !hiddenSectionIds.includes(sectionId)),
    ...explorerRailSectionOrder.filter(
      sectionId =>
        !hiddenSectionIds.includes(sectionId)
        && !(
          normalizeExplorerRailSectionOrder(normalized?.sectionOrder)
          ?? []
        ).includes(sectionId),
    ),
  ];

  return {
    defaultViewMode: isExplorerRailViewModeValue(normalized?.defaultViewMode)
      ? normalized.defaultViewMode
      : defaultExplorerRailTheme.defaultViewMode,
    showViewModeSelector:
      normalized?.showViewModeSelector ?? defaultExplorerRailTheme.showViewModeSelector,
    showAutoExpandToggle:
      normalized?.showAutoExpandToggle ?? defaultExplorerRailTheme.showAutoExpandToggle,
    autoExpandToOpenFolder:
      normalized?.autoExpandToOpenFolder
      ?? defaultExplorerRailTheme.autoExpandToOpenFolder,
    sectionOrder: orderedSectionIds,
    hiddenSectionIds,
    sectionLabels: {
      ...defaultExplorerRailSectionLabels,
      ...(normalized?.sectionLabels ?? defaultExplorerRailTheme.sectionLabels),
    },
    sectionChrome:
      normalized?.sectionChrome ?? defaultExplorerRailTheme.sectionChrome,
    rowChrome: normalized?.rowChrome ?? defaultExplorerRailTheme.rowChrome,
    hierarchyGuideStyle:
      normalized?.hierarchyGuideStyle ?? defaultExplorerRailTheme.hierarchyGuideStyle,
    activeBranchStyle:
      normalized?.activeBranchStyle ?? defaultExplorerRailTheme.activeBranchStyle,
    iconTone: normalized?.iconTone ?? defaultExplorerRailTheme.iconTone,
    treeIndentStep:
      normalized?.treeIndentStep ?? defaultExplorerRailTheme.treeIndentStep,
    showSupportingMeta:
      normalized?.showSupportingMeta ?? defaultExplorerRailTheme.showSupportingMeta,
    showDriveCapacity:
      normalized?.showDriveCapacity ?? defaultExplorerRailTheme.showDriveCapacity,
    flattenDriveRows:
      normalized?.flattenDriveRows ?? defaultExplorerRailTheme.flattenDriveRows,
    showSectionHeaders:
      normalized?.showSectionHeaders ?? defaultExplorerRailTheme.showSectionHeaders,
    sectionHeaderTextTransform:
      normalized?.sectionHeaderTextTransform
      ?? defaultExplorerRailTheme.sectionHeaderTextTransform,
    bookmarkChromeStyle:
      normalized?.bookmarkChromeStyle ?? defaultExplorerRailTheme.bookmarkChromeStyle,
    sectionGap: normalized?.sectionGap ?? defaultExplorerRailTheme.sectionGap,
  };
}

function resolveExplorerWorkspaceTabsThemeRecipe(
  presetTabs: OverlayExplorerWorkspaceTabsThemeRecipe | undefined,
  engineTabs: OverlayExplorerWorkspaceTabsThemeRecipe | undefined,
  userTabs: OverlayExplorerWorkspaceTabsThemeRecipe | undefined,
): ResolvedExplorerWorkspaceTabsThemeRecipe {
  const merged = normalizeExplorerWorkspaceTabsThemeRecipe(
    userTabs,
    normalizeExplorerWorkspaceTabsThemeRecipe(engineTabs, presetTabs),
  );

  return {
    style: merged?.style ?? defaultExplorerWorkspaceTabsTheme.style,
    showPaneSwitcher:
      merged?.showPaneSwitcher ?? defaultExplorerWorkspaceTabsTheme.showPaneSwitcher,
    showLeadingStatusDot:
      merged?.showLeadingStatusDot
      ?? defaultExplorerWorkspaceTabsTheme.showLeadingStatusDot,
    showPaneCountBadge:
      merged?.showPaneCountBadge ?? defaultExplorerWorkspaceTabsTheme.showPaneCountBadge,
    showActiveIndicator:
      merged?.showActiveIndicator ?? defaultExplorerWorkspaceTabsTheme.showActiveIndicator,
    closeButtonMode:
      merged?.closeButtonMode ?? defaultExplorerWorkspaceTabsTheme.closeButtonMode,
  };
}

export function resolveExplorerThemeRecipe(
  appearance?: ResolvedOverlayAppearance,
): ResolvedExplorerThemeRecipe {
  const userRecipe = appearance?.baseTheme.explorer;
  const engineRecipe = createExplorerEngineRecipe(appearance);
  const engineBindings = resolveThemeEngineBindings(appearance?.baseTheme.compiledEngineManifest, userRecipe);
  const preset = userRecipe?.preset
    ?? inferExplorerPresetFromEngine(appearance)
    ?? inferPreset(appearance);
  const presetRecipe = createPresetRecipe(preset);
  const metrics = resolveMetrics(
    {
      ...compactObject(presetRecipe.metrics),
      ...compactObject(engineRecipe.metrics),
    },
    userRecipe?.metrics,
  );
  const surfaces = resolveSurfaces(
    {
      ...compactObject(presetRecipe.surfaces),
      ...compactObject(engineRecipe.surfaces),
    },
    userRecipe?.surfaces,
  );
  const typography = resolveTypography(
    {
      ...compactObject(presetRecipe.typography),
      ...compactObject(engineRecipe.typography),
    },
    userRecipe?.typography,
  );
  const railBrandLabel = userRecipe?.railBrandLabel?.trim()
    || presetRecipe.railBrandLabel?.trim()
    || '';
  const preferredViewMode = userRecipe?.preferredViewMode
    ?? engineRecipe.preferredViewMode
    ?? presetRecipe.preferredViewMode
    ?? null;
  const preferredExperimentalViewMode = userRecipe?.preferredExperimentalViewMode
    ?? engineRecipe.preferredExperimentalViewMode
    ?? presetRecipe.preferredExperimentalViewMode
    ?? null;
  const menuPresentation = normalizeExplorerMenuPresentationRecipe(
    userRecipe?.menuPresentation
      ?? engineRecipe.menuPresentation
      ?? presetRecipe.menuPresentation
      ?? {
        renderer: 'classic',
        fallbackRenderer: 'classic',
      },
  );
  const defaultModeProfileId = normalizeExplorerModeProfileId(
    userRecipe?.defaultModeProfileId
      ?? engineRecipe.defaultModeProfileId
      ?? presetRecipe.defaultModeProfileId
      ?? defaultExplorerModeProfileId,
  );
  const rail = resolveExplorerRailThemeRecipe(
    presetRecipe.rail,
    engineRecipe.rail,
    userRecipe?.rail,
  );
  const workspaceTabs = resolveExplorerWorkspaceTabsThemeRecipe(
    presetRecipe.workspaceTabs,
    engineRecipe.workspaceTabs,
    userRecipe?.workspaceTabs,
  );

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
    '--overlay-explorer-modal-scrim': 'var(--overlay-bg-scrim)',
    '--overlay-explorer-modal-surface': 'var(--overlay-bg-panel)',
    '--overlay-explorer-modal-shadow': 'var(--overlay-shadow)',
    '--overlay-explorer-modal-border': 'var(--overlay-explorer-popup-border-width) solid var(--overlay-explorer-popup-border)',
    '--overlay-explorer-code-bg': 'var(--overlay-bg-terminal)',
    '--overlay-explorer-drag-preview-bg': 'var(--overlay-bg-card)',
    '--overlay-explorer-drag-preview-border': 'var(--overlay-border)',
    '--overlay-explorer-drag-preview-dot': 'var(--overlay-accent)',
    '--overlay-explorer-danger-soft-bg': 'color-mix(in srgb, var(--overlay-danger) 14%, transparent)',
    '--overlay-explorer-danger-soft-border': 'color-mix(in srgb, var(--overlay-danger) 34%, var(--overlay-border))',
    '--overlay-explorer-danger-text': 'var(--overlay-danger)',
    '--overlay-explorer-ctx-menu-shadow': 'var(--overlay-shadow)',
    '--overlay-explorer-context-menu-bg': 'var(--overlay-explorer-popup-bg)',
    '--overlay-explorer-context-menu-border': 'var(--overlay-explorer-popup-border)',
    '--overlay-explorer-context-menu-shadow': 'var(--overlay-explorer-ctx-menu-shadow)',
    '--overlay-explorer-context-menu-max-height': 'min(70vh, 40rem)',
    '--overlay-explorer-context-menu-separator': 'var(--overlay-explorer-preview-border)',
    '--overlay-explorer-context-menu-separator-margin': '0.25rem 0',
    '--overlay-explorer-context-menu-item-text': 'var(--overlay-text-primary)',
    '--overlay-explorer-context-menu-item-muted': 'var(--overlay-text-muted)',
    '--overlay-explorer-context-menu-item-active-bg': 'var(--overlay-explorer-popup-item-hover-bg)',
    '--overlay-explorer-context-menu-item-danger-bg': 'var(--overlay-explorer-danger-soft-bg)',
    '--overlay-explorer-context-menu-danger-text': 'var(--overlay-explorer-danger-text)',
    '--overlay-explorer-context-menu-icon-opacity': '0.78',
    '--overlay-explorer-context-menu-disabled-opacity': '0.55',
    '--overlay-explorer-context-menu-description-font-size': '0.625rem',
    '--overlay-explorer-context-menu-description-line-height': '1.2',
    '--overlay-explorer-context-menu-shortcut-font-size': '0.625rem',
    '--overlay-explorer-context-menu-shortcut-gap': '0.5rem',
    '--overlay-explorer-context-menu-shortcut-max-width': '8.5rem',
    '--overlay-explorer-context-menu-grid-template-columns':
      '16px minmax(0, 1fr) fit-content(var(--overlay-explorer-context-menu-shortcut-max-width))',
    '--overlay-explorer-context-menu-submenu-indicator-opacity': '0.7',
    '--overlay-explorer-context-menu-compact-min-width': '13rem',
    '--overlay-explorer-context-menu-compact-max-width': '17rem',
    '--overlay-explorer-context-menu-compact-padding': '0.125rem 0',
    '--overlay-explorer-context-menu-compact-item-gap': '0.5rem',
    '--overlay-explorer-context-menu-compact-item-padding': '0.375rem 0.625rem',
    '--overlay-explorer-context-menu-compact-font-size': '0.6875rem',
    '--overlay-explorer-context-menu-balanced-min-width': '14.25rem',
    '--overlay-explorer-context-menu-balanced-max-width': '18.75rem',
    '--overlay-explorer-context-menu-balanced-padding': '0.25rem 0',
    '--overlay-explorer-context-menu-balanced-item-gap': '0.625rem',
    '--overlay-explorer-context-menu-balanced-item-padding': '0.4375rem 0.75rem',
    '--overlay-explorer-context-menu-balanced-font-size': '0.75rem',
    '--overlay-explorer-context-menu-touch-min-width': '15.5rem',
    '--overlay-explorer-context-menu-touch-max-width': '21rem',
    '--overlay-explorer-context-menu-touch-padding': '0.375rem 0',
    '--overlay-explorer-context-menu-touch-item-gap': '0.75rem',
    '--overlay-explorer-context-menu-touch-item-padding': '0.625rem 0.875rem',
    '--overlay-explorer-context-menu-touch-font-size': '0.75rem',
    '--overlay-explorer-popup-border-width': 'thin',
    '--overlay-explorer-popup-border': 'var(--overlay-border)',
    '--overlay-explorer-popup-bg': 'var(--overlay-bg-menu)',
    '--overlay-explorer-popup-max-height': 'min(27.5rem, calc(100vh - 1.5rem))',
    '--overlay-explorer-preview-chooser-width': '20rem',
    '--overlay-explorer-view-menu-max-width': 'min(15rem, calc(100vw - 1rem))',
    '--overlay-explorer-popup-shadow': 'var(--overlay-shadow)',
    '--overlay-explorer-popup-item-hover-bg': 'var(--overlay-bg-card-hover)',
    '--overlay-explorer-popup-shadow-lg': 'var(--overlay-shadow)',
    '--overlay-explorer-hud-shadow': 'var(--overlay-shadow)',
    '--overlay-explorer-floating-hud-layer': '9996',
    '--overlay-explorer-floating-menu-layer': '9997',
    '--overlay-explorer-floating-context-layer': '9998',
    ...(userRecipe?.cssVars ?? {}),
  };

  return {
    preset,
    chromeLayoutId: normalizeExplorerChromeLayoutId(
      userRecipe?.chromeLayoutId
      ?? engineRecipe.chromeLayoutId
      ?? presetRecipe.chromeLayoutId
      ?? defaultExplorerChromeLayoutId,
    ),
    defaultModeProfileId,
    layoutPrimitiveId: engineBindings.layoutPrimitive?.id ?? null,
    navigationPatternId: engineBindings.navigationPattern?.id ?? null,
    renderStyleId: engineBindings.renderStyle?.id ?? null,
    railPosition: userRecipe?.railPosition ?? engineRecipe.railPosition ?? presetRecipe.railPosition ?? 'left',
    railBrandLabel,
    toolbarStyle: userRecipe?.toolbarStyle ?? engineRecipe.toolbarStyle ?? presetRecipe.toolbarStyle ?? 'solid',
    breadcrumbStyle: userRecipe?.breadcrumbStyle ?? engineRecipe.breadcrumbStyle ?? presetRecipe.breadcrumbStyle ?? 'plain',
    selectionStyle: userRecipe?.selectionStyle ?? engineRecipe.selectionStyle ?? presetRecipe.selectionStyle ?? 'fill',
    hoverStyle: userRecipe?.hoverStyle ?? engineRecipe.hoverStyle ?? presetRecipe.hoverStyle ?? 'fill',
    previewStyle: userRecipe?.previewStyle ?? engineRecipe.previewStyle ?? presetRecipe.previewStyle ?? 'attached',
    statusBarStyle: userRecipe?.statusBarStyle ?? engineRecipe.statusBarStyle ?? presetRecipe.statusBarStyle ?? 'solid',
    labelMode: userRecipe?.labelMode ?? engineRecipe.labelMode ?? presetRecipe.labelMode ?? 'stacked',
    preferredViewMode: preferredViewMode && isExplorerViewMode(preferredViewMode) ? preferredViewMode : null,
    preferredExperimentalViewMode: preferredExperimentalViewMode && isExplorerExperimentalViewMode(preferredExperimentalViewMode)
      ? preferredExperimentalViewMode
      : null,
    menuPresentation,
    rail,
    workspaceTabs,
    metrics,
    surfaces,
    typography,
    cssVars,
  };
}

export function applyExplorerThemeToGridLayoutMetrics(
  metrics: ExplorerGridLayoutMetrics,
  explorerTheme: ResolvedExplorerThemeRecipe,
): ExplorerGridLayoutMetrics {
  const spacingScale = explorerTheme.metrics.spacingScale;
  const gridScale = explorerTheme.metrics.gridScale;

  return {
    minWidth: Math.max(72, Math.round(metrics.minWidth * gridScale)),
    gap: Math.max(6, Math.round(metrics.gap * spacingScale)),
    padding: Math.max(8, Math.round(metrics.padding * spacingScale)),
    rowHeight: Math.max(84, Math.round(metrics.rowHeight * gridScale)),
    searchRowHeight: Math.max(104, Math.round(metrics.searchRowHeight * gridScale)),
    newItemHeight: Math.max(84, Math.round(metrics.newItemHeight * gridScale)),
    tileRadius: Math.max(8, Math.round(metrics.tileRadius * explorerTheme.metrics.spacingScale)),
    nameLines: metrics.nameLines,
  };
}

export function applyExplorerThemeToGridIconMetrics(
  metrics: ExplorerGridIconMetrics,
  explorerTheme: ResolvedExplorerThemeRecipe,
): ExplorerGridIconMetrics {
  const iconScale = explorerTheme.metrics.iconScale;

  return {
    iconSize: Math.max(16, Math.round(metrics.iconSize * iconScale)),
    iconStageSize: Math.max(20, Math.round(metrics.iconStageSize * iconScale)),
  };
}

export function applyExplorerThemeToGridMetrics(
  metrics: ExplorerGridMetrics,
  explorerTheme: ResolvedExplorerThemeRecipe,
): ExplorerGridMetrics {
  return {
    ...applyExplorerThemeToGridLayoutMetrics(metrics, explorerTheme),
    ...applyExplorerThemeToGridIconMetrics(metrics, explorerTheme),
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
