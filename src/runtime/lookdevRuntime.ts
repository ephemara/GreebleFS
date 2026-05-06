import type {
  AppearanceSettings,
  DockSettings,
  ExplorerSettings,
  PresentationSettings,
} from "../store/settingsStore";
import type {
  LookdevAppearanceOverrides,
  LookdevDockOverrides,
  LookdevExplorerOverrides,
  LookdevPresetScopedOverrides,
  LookdevPresentationOverrides,
} from "../config/lookdevPresets";

function cloneJsonValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export interface LookdevLiveSettingsSnapshot {
  appearance: AppearanceSettings;
  explorer: ExplorerSettings;
  dock: DockSettings;
  presentation: PresentationSettings;
}

export function captureLookdevAppearanceOverrides(
  appearance: AppearanceSettings,
): LookdevAppearanceOverrides {
  return {
    activeThemeId: appearance.activeThemeId,
    activeAppearancePackId: appearance.activeAppearancePackId,
    activeThemeRecipeId: appearance.activeThemeRecipeId,
    activeThemeEngineId: appearance.activeThemeEngineId,
    activeShellRendererId: appearance.activeShellRendererId,
    activeTopBarId: appearance.activeTopBarId,
    activeIconThemeId: appearance.activeIconThemeId,
    activeWallpaperId: appearance.activeWallpaperId ?? null,
    activeShaderId: appearance.activeShaderId ?? null,
    uiFontFamily: appearance.uiFontFamily,
    accentColor: appearance.accentColor,
    compactMode: appearance.compactMode,
    useNativeOsIcons: appearance.useNativeOsIcons,
    appOpacity: appearance.appOpacity,
    panelTransparency: appearance.panelTransparency,
    appZoom: appearance.appZoom,
    appBlur: appearance.appBlur,
    appBlurStrength: appearance.appBlurStrength,
    topBarLayoutSnapshotsById: cloneJsonValue(
      appearance.topBarLayoutSnapshotsById,
    ),
  };
}

export function captureLookdevExplorerOverrides(
  explorer: ExplorerSettings,
): LookdevExplorerOverrides {
  return {
    activeMenuPackId: explorer.activeMenuPackId,
    followThemeExplorerLayout: explorer.followThemeExplorerLayout,
    activeExplorerLayoutId: explorer.activeExplorerLayoutId,
    layoutSelectionByPresentationMode: cloneJsonValue(
      explorer.layoutSelectionByPresentationMode,
    ),
    modeProfileOverridesByThemeId: cloneJsonValue(
      explorer.modeProfileOverridesByThemeId,
    ),
    chromeLayoutOverridesByThemeId: cloneJsonValue(
      explorer.chromeLayoutOverridesByThemeId,
    ),
  };
}

export function captureLookdevDockOverrides(
  dock: DockSettings,
): LookdevDockOverrides {
  return {
    activePresentationId: dock.activePresentationId,
    placementMode: dock.placementMode,
    edgeSize: dock.edgeSize,
    edgeWidth: dock.edgeWidth,
    defaultTerminalRows: dock.defaultTerminalRows,
    defaultTerminalColumns: dock.defaultTerminalColumns,
    floatingBounds: cloneJsonValue(dock.floatingBounds),
    topBarId: dock.topBarId,
    previewEnabled: dock.previewEnabled,
    previewSplitMode: dock.previewSplitMode,
  };
}

export function captureLookdevPresentationOverrides(
  presentation: PresentationSettings,
): LookdevPresentationOverrides {
  return {
    windowMode: presentation.windowMode,
  };
}

export function captureLookdevScopedOverridesFromSettings(
  snapshot: LookdevLiveSettingsSnapshot,
): LookdevPresetScopedOverrides {
  return {
    appearance: captureLookdevAppearanceOverrides(snapshot.appearance),
    explorer: captureLookdevExplorerOverrides(snapshot.explorer),
    dock: captureLookdevDockOverrides(snapshot.dock),
    presentation: captureLookdevPresentationOverrides(snapshot.presentation),
  };
}

export interface LookdevApplyCallbacks {
  updateAppearance: (updates: Partial<AppearanceSettings>) => void;
  updateExplorer: (updates: Partial<ExplorerSettings>) => void;
  updateDock: (updates: Partial<DockSettings>) => void;
  updatePresentation: (updates: Partial<PresentationSettings>) => void;
}

export function applyLookdevScopedOverridesToSettings(
  overrides: LookdevPresetScopedOverrides,
  callbacks: LookdevApplyCallbacks,
): void {
  if (overrides.presentation) {
    callbacks.updatePresentation(
      cloneJsonValue(overrides.presentation as Partial<PresentationSettings>),
    );
  }
  if (overrides.dock) {
    callbacks.updateDock(
      cloneJsonValue(overrides.dock as Partial<DockSettings>),
    );
  }
  if (overrides.explorer) {
    callbacks.updateExplorer(
      cloneJsonValue(overrides.explorer as Partial<ExplorerSettings>),
    );
  }
  if (overrides.appearance) {
    callbacks.updateAppearance(
      cloneJsonValue(overrides.appearance as Partial<AppearanceSettings>),
    );
  }
}
