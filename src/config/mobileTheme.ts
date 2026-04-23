import type { ResolvedOverlayAppearance } from './appearance';

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

export interface MobileShareThemeSnapshot {
  themeId: string;
  themeName: string;
  uiFontFamily: string;
  monoFontFamily: string;
  palette: MobileShareThemePaletteSnapshot;
  metrics: MobileShareThemeMetricsSnapshot;
  shadow: string;
}

export function createMobileShareThemeSnapshot(
  appearance: ResolvedOverlayAppearance,
): MobileShareThemeSnapshot {
  const palette = appearance.theme.palette;
  const metrics = appearance.workbenchTheme.metrics;

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
  };
}
