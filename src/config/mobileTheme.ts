import type { ResolvedOverlayAppearance } from './appearance';
import {
  DEFAULT_FOLDER_ICON_VALUE,
  type FolderIconRule,
  type FolderIconValue,
} from './folderIcons';
import {
  defaultMobileLayoutSettings,
  normalizeMobileLayoutSettings,
  type MobileLayoutSettings,
} from './mobileLayout';
import {
  getBuiltInIconTheme,
  type OverlayResolvedIconTheme,
} from './iconTheme';
import {
  normalizeOverlayPluginSettingsValueMap,
  type OverlayPluginSettingsValue,
} from './pluginSettings';

export interface MobileShareThemePaletteSnapshot {
  appBackground: string;
  appBackgroundAlt: string;
  shellBackground: string;
  topBarBackground: string;
  panelBackground: string;
  inputBackground: string;
  textPrimary: string;
  textMuted: string;
  border: string;
  borderStrong: string;
  accent: string;
  accentStrong: string;
  accentSoft: string;
}

export interface MobileShareThemeMetricsSnapshot {
  controlRadius: number;
  panelRadius: number;
  pagePadding: number;
  panelGap: number;
  touchTarget?: number;
  bottomNavHeight?: number;
  actionStripHeight?: number;
  entryIconSize?: number;
  gridMinWidth?: number;
}

export interface OverlayMobileThemeRecipe {
  palette?: Partial<MobileShareThemePaletteSnapshot>;
  metrics?: Partial<MobileShareThemeMetricsSnapshot>;
  shadow?: string;
  cssVars?: Record<string, string>;
}

export interface MobileShareIconThemeSnapshot {
  id: string;
  name: string;
  file: string;
  folder: string;
  folderExpanded: string;
  iconDefinitions: Record<string, string>;
  fileExtensions: Record<string, string>;
  fileNames: Record<string, string>;
  folderNames: Record<string, string>;
  folderNamesExpanded: Record<string, string>;
  uiIcons: Record<string, string>;
}

export interface MobileShareFolderIconRuleSnapshot {
  id: string;
  label: string;
  matchers: string[];
  icon: string;
}

export interface MobileShareThemeLayoutSnapshot extends MobileLayoutSettings {}

export type MobileSharePluginSettingsSnapshot = Record<
  string,
  Record<string, OverlayPluginSettingsValue>
>;

export interface MobileShareThemeSnapshot {
  themeId: string;
  themeName: string;
  uiFontFamily: string;
  monoFontFamily: string;
  palette: MobileShareThemePaletteSnapshot;
  metrics: MobileShareThemeMetricsSnapshot;
  shadow: string;
  cssVars: Record<string, string>;
  iconTheme: MobileShareIconThemeSnapshot;
  folderIconRules: MobileShareFolderIconRuleSnapshot[];
  defaultFolderIcon: string;
  layout: MobileShareThemeLayoutSnapshot;
  pluginSettingsById: MobileSharePluginSettingsSnapshot;
}

export interface CreateMobileShareThemeSnapshotOptions {
  folderIconRules?: readonly FolderIconRule[];
  defaultFolderIcon?: FolderIconValue;
  layout?: MobileLayoutSettings;
  pluginSettingsById?: MobileSharePluginSettingsSnapshot;
}

function resolveMobileScrollbarCssValue(value: string | undefined, fallback: string): string {
  const trimmed = value?.trim();
  if (!trimmed || trimmed.includes('var(--overlay-')) {
    return fallback;
  }
  return trimmed;
}

function cloneIconThemeSnapshot(
  iconTheme: OverlayResolvedIconTheme,
): MobileShareIconThemeSnapshot {
  return {
    id: iconTheme.id,
    name: iconTheme.name,
    file: iconTheme.file,
    folder: iconTheme.folder,
    folderExpanded: iconTheme.folderExpanded,
    iconDefinitions: { ...iconTheme.iconDefinitions },
    fileExtensions: { ...iconTheme.fileExtensions },
    fileNames: { ...iconTheme.fileNames },
    folderNames: { ...iconTheme.folderNames },
    folderNamesExpanded: { ...iconTheme.folderNamesExpanded },
    uiIcons: { ...iconTheme.uiIcons },
  };
}

function cloneFolderIconRules(
  rules: readonly FolderIconRule[] | undefined,
): MobileShareFolderIconRuleSnapshot[] {
  return (rules ?? []).map((rule) => ({
    id: rule.id,
    label: rule.label,
    matchers: [...rule.matchers],
    icon: rule.icon,
  }));
}

function clonePluginSettingsSnapshot(
  settingsByPluginId: MobileSharePluginSettingsSnapshot | undefined,
): MobileSharePluginSettingsSnapshot {
  if (!settingsByPluginId) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(settingsByPluginId).flatMap(([pluginId, values]) => {
      const normalizedPluginId = pluginId.trim();
      if (!normalizedPluginId) {
        return [];
      }
      return [[
        normalizedPluginId,
        normalizeOverlayPluginSettingsValueMap(values),
      ]];
    }),
  );
}

export function createMobileShareThemeSnapshot(
  appearance: ResolvedOverlayAppearance,
  options: CreateMobileShareThemeSnapshotOptions = {},
): MobileShareThemeSnapshot {
  const palette = appearance.theme.palette;
  const metrics = appearance.workbenchTheme.metrics;
  const mobileRecipe = appearance.theme.mobile;
  const resolvedIconTheme =
    appearance.theme.assets?.iconTheme ?? getBuiltInIconTheme();
  const scrollbar = appearance.theme.scrollbar;
  const scrollbarCssVars = {
    '--mobile-color-scheme': appearance.cssVars['--overlay-color-scheme'] ?? 'dark',
    '--mobile-scrollbar-size': resolveMobileScrollbarCssValue(
      String(scrollbar?.size ?? appearance.cssVars['--overlay-scrollbar-size'] ?? ''),
      '11px',
    ),
    '--mobile-scrollbar-thumb': resolveMobileScrollbarCssValue(
      scrollbar?.thumb ?? appearance.cssVars['--overlay-scrollbar-thumb'],
      palette.borderStrong,
    ),
    '--mobile-scrollbar-thumb-hover': resolveMobileScrollbarCssValue(
      scrollbar?.thumbHover ?? appearance.cssVars['--overlay-scrollbar-thumb-hover'],
      palette.accent,
    ),
    '--mobile-scrollbar-track': resolveMobileScrollbarCssValue(
      scrollbar?.track ?? appearance.cssVars['--overlay-scrollbar-track'],
      palette.panelBackground,
    ),
    '--mobile-scrollbar-corner': resolveMobileScrollbarCssValue(
      scrollbar?.corner ?? appearance.cssVars['--overlay-scrollbar-corner'],
      palette.panelBackground,
    ),
    '--mobile-scrollbar-radius': resolveMobileScrollbarCssValue(
      String(scrollbar?.radius ?? appearance.cssVars['--overlay-scrollbar-radius'] ?? ''),
      '999px',
    ),
    '--mobile-scrollbar-thumb-border-width': resolveMobileScrollbarCssValue(
      String(scrollbar?.thumbBorderWidth ?? appearance.cssVars['--overlay-scrollbar-thumb-border-width'] ?? ''),
      '3px',
    ),
  };

  return {
    themeId: appearance.theme.id,
    themeName: appearance.theme.name,
    uiFontFamily: appearance.fonts.ui,
    monoFontFamily: appearance.fonts.mono,
    palette: {
      appBackground: palette.appBackground,
      appBackgroundAlt: palette.appBackgroundAlt,
      shellBackground: palette.shellBackgroundSolid,
      topBarBackground: palette.topBarBackground,
      panelBackground: palette.panelBackground,
      inputBackground: palette.inputBackground,
      textPrimary: palette.textPrimary,
      textMuted: palette.textMuted,
      border: palette.border,
      borderStrong: palette.borderStrong,
      accent: palette.accent,
      accentStrong: palette.info,
      accentSoft: palette.accentSoft,
      ...(mobileRecipe?.palette ?? {}),
    },
    metrics: {
      controlRadius: metrics.controlRadius,
      panelRadius: metrics.panelRadius,
      pagePadding: metrics.pagePadding,
      panelGap: metrics.panelGap,
      ...(mobileRecipe?.metrics ?? {}),
    },
    shadow: mobileRecipe?.shadow ?? appearance.theme.effects.shadow,
    cssVars: {
      ...scrollbarCssVars,
      ...(mobileRecipe?.cssVars ?? {}),
    },
    iconTheme: cloneIconThemeSnapshot(resolvedIconTheme),
    folderIconRules: cloneFolderIconRules(options.folderIconRules),
    defaultFolderIcon:
      options.defaultFolderIcon ?? DEFAULT_FOLDER_ICON_VALUE,
    layout: normalizeMobileLayoutSettings(
      defaultMobileLayoutSettings,
      options.layout,
    ),
    pluginSettingsById: clonePluginSettingsSnapshot(
      options.pluginSettingsById,
    ),
  };
}
