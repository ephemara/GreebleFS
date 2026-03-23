import {
  getShellBlueprint,
  normalizeShellBlueprintId,
  type OverlayShellBlueprintId,
  type OverlayShellNavigationModel,
} from './shellBlueprints';

export type WorkbenchRegionId =
  | 'primary'
  | 'secondary'
  | 'rail'
  | 'dock'
  | 'desktop'
  | 'modal';

export type WorkbenchWindowMode = 'overlay' | 'windowed' | 'fullscreen';
export type WorkbenchInputMode = 'keyboard' | 'pointer' | 'controller' | 'touch';
export type WorkbenchDensityMode = 'compact' | 'comfortable' | 'immersive';
export type WorkbenchWindowAnchor = 'top' | 'bottom' | 'left' | 'right' | 'center';

export interface WorkbenchPanelBinding {
  panelId: string;
  region: WorkbenchRegionId;
  order: number;
  defaultOpen: boolean;
  preferredSize?: number;
}

export interface WorkbenchWindowProfile {
  mode: WorkbenchWindowMode;
  anchor?: WorkbenchWindowAnchor;
  aspectRatio?: string;
}

export interface WorkbenchInputProfile {
  mode: WorkbenchInputMode;
  density: WorkbenchDensityMode;
  directionalNavigation: boolean;
  pointerGestures: boolean;
}

export interface WorkbenchPreset {
  id: string;
  label: string;
  description: string;
  shellBlueprint: OverlayShellBlueprintId;
  navigationModel: OverlayShellNavigationModel;
  preferredThemeIds: string[];
  panelBindings: WorkbenchPanelBinding[];
  windowProfile: WorkbenchWindowProfile;
  inputProfile: WorkbenchInputProfile;
}

type LooseRecord = Record<string, unknown>;

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

export const BUILT_IN_WORKBENCH_PRESETS: WorkbenchPreset[] = [
  {
    id: 'operator-classic',
    label: 'Operator Classic',
    description: 'Current shell baseline with dock chrome and tab-driven multitasking.',
    shellBlueprint: 'classic-dock',
    navigationModel: 'tabs',
    preferredThemeIds: ['operator', 'github-dark', 'nord'],
    panelBindings: [
      { panelId: 'terminal', region: 'primary', order: 0, defaultOpen: true },
      { panelId: 'explorer', region: 'rail', order: 0, defaultOpen: true, preferredSize: 320 },
      { panelId: 'git', region: 'primary', order: 1, defaultOpen: true },
      { panelId: 'notes', region: 'primary', order: 2, defaultOpen: true },
    ],
    windowProfile: {
      mode: 'overlay',
      anchor: 'bottom',
    },
    inputProfile: {
      mode: 'keyboard',
      density: 'comfortable',
      directionalNavigation: false,
      pointerGestures: true,
    },
  },
  {
    id: 'xmb-media-deck',
    label: 'XMB Media Deck',
    description: 'Cross-media rail with controller-friendly focus movement and fullscreen immersion.',
    shellBlueprint: 'xmb-cross-media',
    navigationModel: 'cross-axis',
    preferredThemeIds: ['vista-glass', 'operator', 'catppuccin'],
    panelBindings: [
      { panelId: 'terminal', region: 'primary', order: 0, defaultOpen: true },
      { panelId: 'explorer', region: 'primary', order: 1, defaultOpen: true },
      { panelId: 'plugins', region: 'primary', order: 2, defaultOpen: true },
    ],
    windowProfile: {
      mode: 'fullscreen',
      anchor: 'center',
    },
    inputProfile: {
      mode: 'controller',
      density: 'immersive',
      directionalNavigation: true,
      pointerGestures: false,
    },
  },
  {
    id: 'hackintosh-desktop',
    label: 'Hackintosh Desktop',
    description: 'Retro desktop metaphor with layered windows, menu chrome, and a wallpaper-first canvas.',
    shellBlueprint: 'retro-desktop',
    navigationModel: 'desktop',
    preferredThemeIds: ['vintage-macintosh', 'aqua-light'],
    panelBindings: [
      { panelId: 'terminal', region: 'desktop', order: 0, defaultOpen: true },
      { panelId: 'explorer', region: 'desktop', order: 1, defaultOpen: true },
      { panelId: 'notes', region: 'desktop', order: 2, defaultOpen: true },
      { panelId: 'git', region: 'desktop', order: 3, defaultOpen: false },
    ],
    windowProfile: {
      mode: 'windowed',
      anchor: 'center',
      aspectRatio: '4:3',
    },
    inputProfile: {
      mode: 'pointer',
      density: 'comfortable',
      directionalNavigation: false,
      pointerGestures: true,
    },
  },
  {
    id: 'metro-start',
    label: 'Metro Start',
    description: 'Tile-first launcher shell with dashboard surfaces and touch-sized targets.',
    shellBlueprint: 'tile-start',
    navigationModel: 'tiles',
    preferredThemeIds: ['plasma-flow', 'nord'],
    panelBindings: [
      { panelId: 'terminal', region: 'primary', order: 0, defaultOpen: true },
      { panelId: 'explorer', region: 'primary', order: 1, defaultOpen: true },
      { panelId: 'screenshots', region: 'secondary', order: 0, defaultOpen: true },
      { panelId: 'plugins', region: 'secondary', order: 1, defaultOpen: true },
    ],
    windowProfile: {
      mode: 'fullscreen',
      anchor: 'center',
    },
    inputProfile: {
      mode: 'touch',
      density: 'immersive',
      directionalNavigation: true,
      pointerGestures: true,
    },
  },
  {
    id: 'dual-screen-devkit',
    label: 'Dual Screen Devkit',
    description: 'Handheld-style stacked shell with a primary task surface and a persistent utility screen.',
    shellBlueprint: 'handheld-dual-screen',
    navigationModel: 'stacked-dual-pane',
    preferredThemeIds: ['vintage-macintosh', 'operator'],
    panelBindings: [
      { panelId: 'terminal', region: 'primary', order: 0, defaultOpen: true },
      { panelId: 'explorer', region: 'secondary', order: 0, defaultOpen: true },
      { panelId: 'plugins', region: 'secondary', order: 1, defaultOpen: false },
    ],
    windowProfile: {
      mode: 'windowed',
      anchor: 'center',
      aspectRatio: '10:9',
    },
    inputProfile: {
      mode: 'touch',
      density: 'compact',
      directionalNavigation: true,
      pointerGestures: true,
    },
  },
];

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
      anchor: normalizeWindowAnchor(asRecord(source.windowProfile)?.anchor, fallback.windowProfile.anchor),
      aspectRatio: asString(asRecord(source.windowProfile)?.aspectRatio, fallback.windowProfile.aspectRatio ?? '')
        || fallback.windowProfile.aspectRatio,
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
