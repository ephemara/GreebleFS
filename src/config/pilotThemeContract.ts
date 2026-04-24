import { DEFAULT_ADAPTIVE_SEMANTIC_DENSITY } from './explorerExperimentalModes';
import type { OverlayExplorerThemeRecipe } from './explorerTheme';
import type { ExplorerShellLayoutId } from './explorerShellLayouts';
import type { ExplorerViewMode } from './explorerViewModes';
import type { ShaderPerformanceMode } from './shaders';
import type { OverlayWallpaperFitMode } from './wallpapers';
import type { OverlayWorkbenchThemeRecipe } from './workbenchTheme';

export const DEFAULT_PILOT_DARK_THEME_ID = 'pilot-dark';
export const DEFAULT_PILOT_LIGHT_THEME_ID = 'pilot-light';
export const DEFAULT_PILOT_UI_FONT_FAMILY = 'system-ui, sans-serif';
export const DEFAULT_PILOT_MONO_FONT_FAMILY = '"JetBrains Mono", "Cascadia Code", monospace';
export const DEFAULT_PILOT_LAYOUT_PROFILE_ID = 'overlay-classic';
export const DEFAULT_PILOT_ACCENT_COLOR = '#f5f5f5';

export interface ThemeSelectionAppearanceDefaults {
  theme?: 'dark' | 'light' | 'system';
  dockThemeMode?: 'follow-app' | 'override';
  activeDockThemeId?: string | null;
  activeWallpaperId?: string | null;
  wallpaperFitMode?: OverlayWallpaperFitMode;
  wallpaperOpacity?: number;
  wallpaperMuted?: boolean;
  activeShaderId?: string | null;
  shaderPerformanceMode?: ShaderPerformanceMode;
  uiFontFamily?: string;
  useNativeOsIcons?: boolean;
  appOpacity?: number;
  panelTransparency?: number;
  appZoom?: number;
  appBlur?: boolean;
  appBlurStrength?: number;
  appOpenAnimation?: string | null;
  appCloseAnimation?: string | null;
}

export interface ThemeSelectionExplorerDefaults {
  showHiddenFiles?: boolean;
  viewMode?: ExplorerViewMode;
  experimentalViewMode?: 'off' | 'adaptive-semantic-grid' | 'constellation' | 'timeline-surface';
  experimentalDensity?: number;
  folderClickMode?: 'single' | 'double';
}

export interface ThemeSelectionExplorerSessionDefaults {
  sidebarWidth?: number | null;
  previewWidth?: number | null;
  previewEnabled?: boolean;
  shellLayoutId?: ExplorerShellLayoutId;
  sourcesVisible?: boolean;
}

export interface ThemeSelectionLayoutDefaults {
  activeProfileId?: string;
}

export interface ThemeSelectionDefaults {
  appearance?: ThemeSelectionAppearanceDefaults;
  explorer?: ThemeSelectionExplorerDefaults;
  explorerSession?: ThemeSelectionExplorerSessionDefaults;
  layout?: ThemeSelectionLayoutDefaults;
}

export const pilotWorkbenchThemeRecipe: OverlayWorkbenchThemeRecipe = {
  preset: 'workbench',
  brandLabel: 'GreebleFS',
  topBarStyle: 'solid',
  panelStyle: 'solid',
  commandPaletteStyle: 'solid',
  terminalStyle: 'solid',
  terminalRenderer: 'auto',
  terminalFx: {
    preset: 'subtle',
    opacity: 1,
    scanlineOpacity: 0.08,
    noiseOpacity: 0.032,
    vignetteOpacity: 0.16,
    glowOpacity: 0.12,
    tintOpacity: 0.05,
    tintColor: 'var(--overlay-accent)',
    curvature: 0.1,
    saturation: 0.08,
    contrast: 0.14,
  },
  settingsStyle: 'solid',
  tabStyle: 'segment',
  metrics: {
    chromeHeight: 38,
    controlRadius: 8,
    panelRadius: 12,
    shellInset: 0,
    commandPaletteWidth: 760,
    commandPaletteTopInset: 56,
    pagePadding: 12,
    panelGap: 10,
  },
  surfaces: {
    shellBackground: 'var(--overlay-bg-shell-solid)',
    chromeBackground: 'var(--overlay-bg-topbar)',
    chromeMenuBackground: 'var(--overlay-bg-topbar-menu)',
    chromeBorder: 'var(--overlay-border)',
    chromeButtonBackground: 'color-mix(in srgb, var(--overlay-text-primary) 3%, transparent)',
    chromeButtonHoverBackground: 'color-mix(in srgb, var(--overlay-text-primary) 6%, transparent)',
    chromeButtonActiveBackground: 'var(--overlay-bg-selection)',
    chromeButtonActiveBorder: 'var(--overlay-border-strong)',
    chromeTabBackground: 'var(--overlay-bg-panel-alt)',
    chromeTabActiveBackground: 'var(--overlay-bg-panel)',
    chromeTabBorder: 'var(--overlay-border)',
    shellShadow: '0 18px 48px rgba(0, 0, 0, 0.28)',
    commandPaletteScrimBackground: 'rgba(0, 0, 0, 0.36)',
    commandPaletteBackground: 'var(--overlay-bg-panel)',
    commandPaletteBorder: 'var(--overlay-border)',
    commandPaletteInputBackground: 'var(--overlay-bg-input)',
    commandPaletteItemBackground: 'color-mix(in srgb, var(--overlay-text-primary) 2%, transparent)',
    commandPaletteItemActiveBackground: 'var(--overlay-bg-selection)',
    settingsBackground: 'linear-gradient(180deg, var(--overlay-bg-app-alt) 0%, var(--overlay-bg-panel) 100%)',
    settingsRailBackground: 'color-mix(in srgb, var(--overlay-text-primary) 3%, transparent)',
    settingsCardBackground: 'var(--overlay-bg-panel)',
    settingsCardBorder: 'var(--overlay-border)',
    settingsBadgeBackground: 'color-mix(in srgb, var(--overlay-text-primary) 3%, transparent)',
    settingsBadgeBorder: 'var(--overlay-border)',
    terminalBackground: 'var(--overlay-bg-shell-solid)',
    terminalPanelBackground: 'var(--overlay-bg-panel)',
    terminalPaneBackground: 'var(--overlay-bg-terminal)',
    terminalBorder: 'var(--overlay-border)',
    terminalStatusBackground: 'var(--overlay-bg-selection)',
  },
  typography: {
    chromeLabelSize: 11,
    chromeMetaSize: 8,
    tabLabelSize: 11,
    pageTitleSize: 16,
    pageBodySize: 11,
    badgeSize: 9,
    labelLetterSpacing: '0.06em',
  },
};

export const pilotExplorerThemeRecipe: OverlayExplorerThemeRecipe = {
  preset: 'workbench',
  chromeLayoutId: 'default',
  defaultModeProfileId: 'balanced',
  railPosition: 'left',
  railBrandLabel: '',
  toolbarStyle: 'solid',
  breadcrumbStyle: 'segmented',
  selectionStyle: 'fill',
  hoverStyle: 'fill',
  previewStyle: 'attached',
  statusBarStyle: 'solid',
  labelMode: 'inline',
  preferredViewMode: 'details',
  preferredExperimentalViewMode: 'off',
  metrics: {
    railWidth: 264,
    previewWidth: 360,
    chromeInset: 0,
    toolbarPaddingX: 10,
    toolbarPaddingY: 6,
    toolbarGap: 6,
    controlRadius: 8,
    panelRadius: 10,
    spacingScale: 1,
    gridScale: 1,
    rowHeightScale: 1.02,
    iconScale: 1,
    hoverLiftPx: 0,
  },
  surfaces: {
    rootBackground: 'var(--overlay-bg-shell)',
    contentBackground: 'transparent',
    sidebarBackground: 'var(--overlay-bg-sidebar)',
    sidebarBorder: 'var(--overlay-border)',
    toolbarBackground: 'var(--overlay-bg-panel)',
    toolbarBorder: 'var(--overlay-border)',
    toolbarShadow: 'none',
    omniboxBackground: 'var(--overlay-bg-input)',
    omniboxBorder: 'var(--overlay-border-strong)',
    previewBackground: 'var(--overlay-bg-panel)',
    previewHeaderBackground: 'var(--overlay-bg-sidebar)',
    previewBorder: 'var(--overlay-border)',
    statusBarBackground: 'var(--overlay-bg-sidebar)',
    statusBarBorder: 'var(--overlay-border)',
    itemHoverBackground: 'color-mix(in srgb, var(--overlay-text-primary) 4%, transparent)',
    itemHoverBorder: 'color-mix(in srgb, var(--overlay-border-strong) 80%, transparent)',
    itemSelectedBackground: 'var(--overlay-bg-selection)',
    itemSelectedBorder: 'color-mix(in srgb, var(--overlay-accent) 28%, var(--overlay-border-strong))',
    itemDropBackground: 'color-mix(in srgb, var(--overlay-accent) 10%, transparent)',
    itemDropBorder: 'var(--overlay-border-strong)',
    itemFocusShadow: 'none',
    inputBackground: 'var(--overlay-bg-input)',
    inputBorder: 'var(--overlay-border-strong)',
    chipBackground: 'transparent',
    chipBorder: 'var(--overlay-border)',
    chipActiveBackground: 'var(--overlay-bg-selection)',
    chipActiveBorder: 'color-mix(in srgb, var(--overlay-accent) 24%, var(--overlay-border-strong))',
    chipActiveText: 'var(--overlay-text-primary)',
  },
  typography: {
    railEyebrowSize: 10,
    railTitleSize: 14,
    toolbarFontSize: 11,
    breadcrumbFontSize: 11,
    entryTitleSize: 11,
    entryMetaSize: 10,
    statusFontSize: 10,
    entryTitleWeight: 500,
    labelLetterSpacing: '0.04em',
  },
};

export const pilotDockWorkbenchThemeRecipe: OverlayWorkbenchThemeRecipe = {
  ...pilotWorkbenchThemeRecipe,
  brandLabel: 'Dock',
  metrics: {
    ...pilotWorkbenchThemeRecipe.metrics,
    chromeHeight: 34,
    controlRadius: 10,
    panelRadius: 12,
    shellInset: 8,
    commandPaletteTopInset: 44,
    pagePadding: 10,
    panelGap: 8,
  },
  surfaces: {
    ...pilotWorkbenchThemeRecipe.surfaces,
    shellBackground: 'color-mix(in srgb, var(--overlay-bg-shell-solid) 96%, transparent)',
    chromeBackground: 'color-mix(in srgb, var(--overlay-bg-topbar) 96%, transparent)',
    shellShadow: '0 18px 42px rgba(0, 0, 0, 0.32)',
  },
};

export const pilotDockExplorerThemeRecipe: OverlayExplorerThemeRecipe = {
  ...pilotExplorerThemeRecipe,
  metrics: {
    ...pilotExplorerThemeRecipe.metrics,
    railWidth: 228,
    previewWidth: 320,
    chromeInset: 8,
    toolbarPaddingX: 8,
    toolbarPaddingY: 5,
    toolbarGap: 5,
    panelRadius: 12,
  },
  surfaces: {
    ...pilotExplorerThemeRecipe.surfaces,
    toolbarBackground: 'color-mix(in srgb, var(--overlay-bg-panel) 96%, transparent)',
    sidebarBackground: 'color-mix(in srgb, var(--overlay-bg-sidebar) 98%, transparent)',
    previewBackground: 'color-mix(in srgb, var(--overlay-bg-panel) 96%, transparent)',
  },
};

const sharedBuiltInThemeSelectionDefaults: ThemeSelectionDefaults = {
  appearance: {
    uiFontFamily: DEFAULT_PILOT_UI_FONT_FAMILY,
    dockThemeMode: 'follow-app',
    activeDockThemeId: null,
    activeWallpaperId: null,
    wallpaperFitMode: 'cover',
    wallpaperOpacity: 1,
    wallpaperMuted: true,
    activeShaderId: null,
    useNativeOsIcons: false,
    appOpacity: 1,
    panelTransparency: 0,
    appZoom: 1,
    appBlur: false,
    appBlurStrength: 18,
    appOpenAnimation: null,
    appCloseAnimation: null,
  },
  explorer: {
    showHiddenFiles: false,
    viewMode: 'details',
    experimentalViewMode: 'off',
    experimentalDensity: DEFAULT_ADAPTIVE_SEMANTIC_DENSITY,
    folderClickMode: 'double',
  },
  explorerSession: {
    sidebarWidth: null,
    previewWidth: null,
    previewEnabled: true,
    shellLayoutId: 'balanced',
    sourcesVisible: true,
  },
  layout: {
    activeProfileId: DEFAULT_PILOT_LAYOUT_PROFILE_ID,
  },
};

function createBuiltInThemeSelectionDefaults(
  themeMode: 'dark' | 'light',
  overrides?: ThemeSelectionDefaults,
): ThemeSelectionDefaults {
  return {
    appearance: {
      ...sharedBuiltInThemeSelectionDefaults.appearance,
      theme: themeMode,
      ...(overrides?.appearance ?? {}),
    },
    explorer: {
      ...sharedBuiltInThemeSelectionDefaults.explorer,
      ...(overrides?.explorer ?? {}),
    },
    explorerSession: {
      ...sharedBuiltInThemeSelectionDefaults.explorerSession,
      ...(overrides?.explorerSession ?? {}),
    },
    layout: {
      ...sharedBuiltInThemeSelectionDefaults.layout,
      ...(overrides?.layout ?? {}),
    },
  };
}

const themeSelectionDefaultsById: Record<string, ThemeSelectionDefaults> = {
  [DEFAULT_PILOT_DARK_THEME_ID]: createBuiltInThemeSelectionDefaults('dark', {
    appearance: {},
  }),
  [DEFAULT_PILOT_LIGHT_THEME_ID]: createBuiltInThemeSelectionDefaults('light', {
    appearance: {},
  }),
  operator: createBuiltInThemeSelectionDefaults('dark'),
  dracula: createBuiltInThemeSelectionDefaults('dark'),
  nord: createBuiltInThemeSelectionDefaults('dark'),
  monokai: createBuiltInThemeSelectionDefaults('dark'),
  'github-dark': createBuiltInThemeSelectionDefaults('dark'),
  catppuccin: createBuiltInThemeSelectionDefaults('dark'),
  andromeda: createBuiltInThemeSelectionDefaults('dark', {
    appearance: {
      shaderPerformanceMode: 'performance',
    },
  }),
};

export function getThemeSelectionDefaults(
  themeId: string | null | undefined,
): ThemeSelectionDefaults | null {
  if (!themeId) {
    return null;
  }

  return themeSelectionDefaultsById[themeId.trim()] ?? null;
}

export function isPilotThemeId(themeId: string | null | undefined): boolean {
  const normalizedThemeId = themeId?.trim();
  return normalizedThemeId === DEFAULT_PILOT_DARK_THEME_ID || normalizedThemeId === DEFAULT_PILOT_LIGHT_THEME_ID;
}
