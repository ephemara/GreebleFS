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

export interface MobileShareThemeSnapshot {
  themeId: string;
  themeName: string;
  uiFontFamily: string;
  monoFontFamily: string;
  palette: MobileShareThemePaletteSnapshot;
  metrics: MobileShareThemeMetricsSnapshot;
  shadow: string;
  iconTheme: MobileShareIconThemeSnapshot;
  folderIconRules: MobileShareFolderIconRuleSnapshot[];
  defaultFolderIcon: string;
  layout: MobileShareThemeLayoutSnapshot;
}

export interface CreateMobileShareThemeSnapshotOptions {
  folderIconRules?: readonly FolderIconRule[];
  defaultFolderIcon?: FolderIconValue;
  layout?: MobileLayoutSettings;
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

export function createMobileShareThemeSnapshot(
  appearance: ResolvedOverlayAppearance,
  options: CreateMobileShareThemeSnapshotOptions = {},
): MobileShareThemeSnapshot {
  const palette = appearance.theme.palette;
  const metrics = appearance.workbenchTheme.metrics;
  const resolvedIconTheme =
    appearance.theme.assets?.iconTheme ?? getBuiltInIconTheme();

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
    },
    metrics: {
      controlRadius: metrics.controlRadius,
      panelRadius: metrics.panelRadius,
      pagePadding: metrics.pagePadding,
      panelGap: metrics.panelGap,
    },
    shadow: appearance.theme.effects.shadow,
    iconTheme: cloneIconThemeSnapshot(resolvedIconTheme),
    folderIconRules: cloneFolderIconRules(options.folderIconRules),
    defaultFolderIcon:
      options.defaultFolderIcon ?? DEFAULT_FOLDER_ICON_VALUE,
    layout: normalizeMobileLayoutSettings(
      defaultMobileLayoutSettings,
      options.layout,
    ),
  };
}
