import { useEffect, useMemo, useState, type CSSProperties } from 'react';

import {
  resolveOverlayAppearance,
  type OverlayAppearanceSelection,
  type OverlayThemePalette,
  type ResolvedOverlayAppearance,
} from '../config/appearance';
import {
  listenToSyncedOverlayAppearanceSnapshots,
  readSyncedOverlayAppearanceSnapshot,
  type SyncedOverlayAppearanceSnapshot,
} from '../runtime/appearanceSync';

export interface SyncedWindowAppearance {
  cssVars: CSSProperties;
  explorerCssVars: CSSProperties;
  fonts: ResolvedOverlayAppearance['fonts'];
  iconTheme: NonNullable<ResolvedOverlayAppearance['theme']['assets']>['iconTheme'] | undefined;
  palette: OverlayThemePalette;
  themeId: string;
  themeName: string;
}

export function useSyncedWindowAppearance(
  appearanceSelection?: OverlayAppearanceSelection,
): SyncedWindowAppearance {
  const fallbackAppearance = useMemo(
    () => resolveOverlayAppearance(appearanceSelection),
    [appearanceSelection],
  );
  const [snapshot, setSnapshot] = useState<SyncedOverlayAppearanceSnapshot | null>(() =>
    readSyncedOverlayAppearanceSnapshot(),
  );

  useEffect(() => {
    return listenToSyncedOverlayAppearanceSnapshots(setSnapshot);
  }, []);

  return useMemo(() => {
    const activeSnapshot = snapshot;
    const cssVars = {
      ...fallbackAppearance.cssVars,
      ...(activeSnapshot?.cssVars ?? {}),
    } as CSSProperties;
    const explorerCssVars = {
      ...fallbackAppearance.explorerTheme.cssVars,
      ...(activeSnapshot?.explorerCssVars ?? {}),
    } as CSSProperties;

    return {
      cssVars,
      explorerCssVars,
      fonts: activeSnapshot?.fonts ?? fallbackAppearance.fonts,
      iconTheme: fallbackAppearance.theme.assets?.iconTheme,
      palette: activeSnapshot?.palette ?? fallbackAppearance.theme.palette,
      themeId: activeSnapshot?.themeId ?? fallbackAppearance.theme.id,
      themeName: activeSnapshot?.themeName ?? fallbackAppearance.theme.name,
    };
  }, [fallbackAppearance, snapshot]);
}
