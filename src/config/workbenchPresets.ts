import {
  OVERLAY_WORKBENCH_PRESETS as GENERATED_OVERLAY_WORKBENCH_PRESETS,
  type ThemeDensity as GeneratedThemeDensity,
  type WorkbenchInputMode as GeneratedWorkbenchInputMode,
  type WorkbenchInputProfile as GeneratedWorkbenchInputProfile,
  type WorkbenchPanelBinding as GeneratedWorkbenchPanelBinding,
  type WorkbenchPreset as GeneratedWorkbenchPreset,
  type WorkbenchRegionId as GeneratedWorkbenchRegionId,
  type WorkbenchWindowMode as GeneratedWorkbenchWindowMode,
  type WorkbenchWindowProfile as GeneratedWorkbenchWindowProfile,
} from '../generated/tauri';
import {
  getShellBlueprint,
  normalizeShellBlueprintId,
  type OverlayShellBlueprintId,
  type OverlayShellNavigationModel,
} from './shellBlueprints';

export type WorkbenchRegionId = GeneratedWorkbenchRegionId;
export type WorkbenchWindowMode = GeneratedWorkbenchWindowMode;
export type WorkbenchInputMode = GeneratedWorkbenchInputMode;
export type WorkbenchDensityMode = GeneratedThemeDensity;
export type WorkbenchWindowAnchor = 'top' | 'bottom' | 'left' | 'right' | 'center';

export type WorkbenchPanelBinding = GeneratedWorkbenchPanelBinding;
export type WorkbenchWindowProfile = GeneratedWorkbenchWindowProfile;
export type WorkbenchInputProfile = GeneratedWorkbenchInputProfile;
export type WorkbenchPreset = GeneratedWorkbenchPreset;

type LooseRecord = Record<string, unknown>;
type GeneratedWorkbenchPresetConstant = (typeof GENERATED_OVERLAY_WORKBENCH_PRESETS)[number];

function asRecord(value: unknown): LooseRecord | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  return value as LooseRecord;
}

function asString(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : fallback;
}

function asBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function asNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function normalizeWindowMode(value: unknown, fallback: WorkbenchWindowMode): WorkbenchWindowMode {
  return value === 'windowed' || value === 'fullscreen' ? value : fallback;
}

function normalizeInputMode(value: unknown, fallback: WorkbenchInputMode): WorkbenchInputMode {
  return value === 'pointer' || value === 'controller' || value === 'touch' ? value : fallback;
}

function normalizeWindowAnchor(value: unknown, fallback?: WorkbenchWindowAnchor): WorkbenchWindowAnchor | undefined {
  switch (value) {
    case 'top':
    case 'bottom':
    case 'left':
    case 'right':
    case 'center':
      return value;
    default:
      return fallback;
  }
}

function normalizeDensityMode(value: unknown, fallback: WorkbenchDensityMode): WorkbenchDensityMode {
  return value === 'compact' || value === 'immersive' ? value : fallback;
}

function normalizeRegionId(value: unknown, fallback: WorkbenchRegionId): WorkbenchRegionId {
  switch (value) {
    case 'secondary':
    case 'rail':
    case 'dock':
    case 'desktop':
    case 'modal':
      return value;
    default:
      return fallback;
  }
}

function normalizeNavigationModel(
  value: unknown,
  shellBlueprint: OverlayShellBlueprintId,
): OverlayShellNavigationModel {
  const fallback = getShellBlueprint(shellBlueprint).navigationModel;
  switch (value) {
    case 'tabs':
    case 'cross-axis':
    case 'desktop':
    case 'tiles':
    case 'stacked-dual-pane':
      return value;
    default:
      return fallback;
  }
}

function normalizePanelBinding(
  input: unknown,
  fallback: WorkbenchPanelBinding,
): WorkbenchPanelBinding {
  const source = asRecord(input);
  if (!source) {
    return fallback;
  }

  return {
    panelId: asString(source.panelId, fallback.panelId),
    region: normalizeRegionId(source.region, fallback.region),
    order: Math.max(0, Math.round(asNumber(source.order, fallback.order))),
    defaultOpen: asBoolean(source.defaultOpen, fallback.defaultOpen),
    preferredSize: typeof source.preferredSize === 'number'
      ? Math.max(120, Math.round(source.preferredSize))
      : fallback.preferredSize,
  };
}

function cloneWorkbenchPreset(preset: GeneratedWorkbenchPresetConstant): WorkbenchPreset {
  return {
    ...preset,
    preferredThemeIds: [...preset.preferredThemeIds],
    panelBindings: preset.panelBindings.map(binding => ({ ...binding })),
    windowProfile: { ...preset.windowProfile },
    inputProfile: { ...preset.inputProfile },
  };
}

export const BUILT_IN_WORKBENCH_PRESETS: WorkbenchPreset[] = GENERATED_OVERLAY_WORKBENCH_PRESETS
  .map(cloneWorkbenchPreset);

const builtInWorkbenchPresetMap = new Map(
  BUILT_IN_WORKBENCH_PRESETS.map(preset => [preset.id, preset] as const),
);

export function normalizeWorkbenchPreset(
  input: unknown,
  fallback: WorkbenchPreset = BUILT_IN_WORKBENCH_PRESETS[0],
): WorkbenchPreset {
  const source = asRecord(input);
  if (!source) {
    return fallback;
  }

  const shellBlueprint = normalizeShellBlueprintId(source.shellBlueprint, fallback.shellBlueprint);
  const fallbackNavigationModel = normalizeNavigationModel(undefined, shellBlueprint);
  const panelBindingsSource = Array.isArray(source.panelBindings) ? source.panelBindings : fallback.panelBindings;
  const fallbackWindowAnchor = normalizeWindowAnchor(fallback.windowProfile.anchor);
  const fallbackAspectRatio = fallback.windowProfile.aspectRatio ?? null;

  return {
    id: asString(source.id, fallback.id),
    label: asString(source.label, fallback.label),
    description: asString(source.description, fallback.description),
    shellBlueprint,
    navigationModel: normalizeNavigationModel(source.navigationModel, shellBlueprint) ?? fallbackNavigationModel,
    preferredThemeIds: Array.from(new Set(
      (Array.isArray(source.preferredThemeIds) ? source.preferredThemeIds : fallback.preferredThemeIds)
        .filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
        .map(entry => entry.trim()),
    )),
    panelBindings: panelBindingsSource.map((entry, index) => normalizePanelBinding(
      entry,
      fallback.panelBindings[index] ?? {
        panelId: `panel-${index}`,
        region: 'primary',
        order: index,
        defaultOpen: true,
      },
    )),
    windowProfile: {
      mode: normalizeWindowMode(asRecord(source.windowProfile)?.mode, fallback.windowProfile.mode),
      anchor: normalizeWindowAnchor(asRecord(source.windowProfile)?.anchor, fallbackWindowAnchor) ?? null,
      aspectRatio: asString(asRecord(source.windowProfile)?.aspectRatio, fallbackAspectRatio ?? '')
        || fallbackAspectRatio,
    },
    inputProfile: {
      mode: normalizeInputMode(asRecord(source.inputProfile)?.mode, fallback.inputProfile.mode),
      density: normalizeDensityMode(asRecord(source.inputProfile)?.density, fallback.inputProfile.density),
      directionalNavigation: asBoolean(
        asRecord(source.inputProfile)?.directionalNavigation,
        fallback.inputProfile.directionalNavigation,
      ),
      pointerGestures: asBoolean(
        asRecord(source.inputProfile)?.pointerGestures,
        fallback.inputProfile.pointerGestures,
      ),
    },
  };
}

export function resolveWorkbenchPreset(
  presetId: string | null | undefined,
): WorkbenchPreset {
  const normalizedId = (presetId ?? '').trim();
  return builtInWorkbenchPresetMap.get(normalizedId) ?? BUILT_IN_WORKBENCH_PRESETS[0];
}

export function getWorkbenchPresetsForShellBlueprint(
  shellBlueprint: OverlayShellBlueprintId,
): WorkbenchPreset[] {
  return BUILT_IN_WORKBENCH_PRESETS.filter(preset => preset.shellBlueprint === shellBlueprint);
}
