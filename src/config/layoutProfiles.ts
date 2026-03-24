import { invoke } from '@tauri-apps/api/core';
import { parse as parseToml } from 'smol-toml';
import {
  normalizeShellBlueprintId,
  type OverlayShellBlueprintId,
} from './shellBlueprints';


export type LayoutBarPosition = 'top' | 'bottom';
export type LayoutDockSide = 'left' | 'right';
export type ExplorerLayoutMode = 'full' | 'compact-dock';

export interface LayoutPinnedPanel {
  panelId: string;
  side: LayoutDockSide;
  size: number;
  mode: ExplorerLayoutMode;
}

export interface LayoutChromeConfig {
  barPosition: LayoutBarPosition;
  showSettingsShortcut: boolean;
  showPanelMenu: boolean;
  showBlurToggle: boolean;
  showShortcutBadge: boolean;
}

export interface LayoutControlDockConfig {
  enabled: boolean;
  side: LayoutDockSide;
  inset: number;
}

export interface LayoutBehaviorConfig {
  cycleOrder: number;
  defaultActivePanelId: string;
  enforcedOpenPanelIds: string[];
}

export interface LayoutProfile {
  id: string;
  label: string;
  description: string;
  shellBlueprint: OverlayShellBlueprintId;
  chrome: LayoutChromeConfig;
  controlDock: LayoutControlDockConfig;
  pinnedPanels: LayoutPinnedPanel[];
  behavior: LayoutBehaviorConfig;
}

export interface LayoutManifest {
  version: number;
  extendsBuiltIns: boolean;
  profiles: LayoutProfile[];
}

type LooseRecord = Record<string, unknown>;

const MIN_PINNED_PANEL_SIZE = 220;
const MAX_PINNED_PANEL_SIZE = 640;
const DEFAULT_LAYOUT_VERSION = 1;
const DEFAULT_LAYOUT_CONFIG_LOCATIONS = [
  { relativeDir: '.greeble', basename: 'greeble.layouts' },
  { relativeDir: '.overlayterm', basename: 'snapyard.layouts' },
] as const;
const DEFAULT_CONFIG_EXTENSIONS = ['json', 'toml'] as const;

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

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

function asStringArray(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) {
    return fallback;
  }

  const next = value
    .filter((entry): entry is string => typeof entry === 'string')
    .map(entry => entry.trim())
    .filter(Boolean);

  return next.length > 0 ? Array.from(new Set(next)) : fallback;
}

function normalizePinnedPanel(input: unknown): LayoutPinnedPanel | null {
  const source = asRecord(input);
  if (!source) {
    return null;
  }

  const panelId = asString(source.panelId, '');
  if (!panelId) {
    return null;
  }

  const side = source.side === 'right' ? 'right' : 'left';
  const mode = source.mode === 'compact-dock' ? 'compact-dock' : 'full';

  return {
    panelId,
    side,
    mode,
    size: clampNumber(asNumber(source.size, 320), MIN_PINNED_PANEL_SIZE, MAX_PINNED_PANEL_SIZE),
  };
}

function normalizeLayoutProfile(input: unknown, fallback: LayoutProfile, fallbackOrder: number): LayoutProfile {
  const source = asRecord(input);
  if (!source) {
    return {
      ...fallback,
      behavior: {
        ...fallback.behavior,
        cycleOrder: fallbackOrder,
      },
    };
  }

  const chrome = asRecord(source.chrome);
  const controlDock = asRecord(source.controlDock);
  const behavior = asRecord(source.behavior);
  const pinnedPanelsSource = Array.isArray(source.pinnedPanels) ? source.pinnedPanels : fallback.pinnedPanels;
  const pinnedPanels = pinnedPanelsSource
    .map(normalizePinnedPanel)
    .filter((entry): entry is LayoutPinnedPanel => Boolean(entry));

  return {
    id: asString(source.id, fallback.id),
    label: asString(source.label, fallback.label),
    description: asString(source.description, fallback.description),
    shellBlueprint: normalizeShellBlueprintId(source.shellBlueprint, fallback.shellBlueprint),
    chrome: {
      barPosition: chrome?.barPosition === 'bottom' ? 'bottom' : fallback.chrome.barPosition,
      showSettingsShortcut: asBoolean(chrome?.showSettingsShortcut, fallback.chrome.showSettingsShortcut),
      showPanelMenu: asBoolean(chrome?.showPanelMenu, fallback.chrome.showPanelMenu),
      showBlurToggle: asBoolean(chrome?.showBlurToggle, fallback.chrome.showBlurToggle),
      showShortcutBadge: asBoolean(chrome?.showShortcutBadge, fallback.chrome.showShortcutBadge),
    },
    controlDock: {
      enabled: asBoolean(controlDock?.enabled, fallback.controlDock.enabled),
      side: controlDock?.side === 'left' ? 'left' : controlDock?.side === 'right' ? 'right' : fallback.controlDock.side,
      inset: clampNumber(asNumber(controlDock?.inset, fallback.controlDock.inset), 0, 48),
    },
    pinnedPanels,
    behavior: {
      cycleOrder: asNumber(behavior?.cycleOrder, fallbackOrder),
      defaultActivePanelId: asString(behavior?.defaultActivePanelId, fallback.behavior.defaultActivePanelId),
      enforcedOpenPanelIds: asStringArray(
        behavior?.enforcedOpenPanelIds,
        fallback.behavior.enforcedOpenPanelIds,
      ),
    },
  };
}

function sortProfiles(profiles: LayoutProfile[]): LayoutProfile[] {
  return [...profiles].sort((left, right) => {
    if (left.behavior.cycleOrder !== right.behavior.cycleOrder) {
      return left.behavior.cycleOrder - right.behavior.cycleOrder;
    }
    return left.label.localeCompare(right.label);
  });
}

const BUILT_IN_PROFILES: LayoutProfile[] = sortProfiles([
  {
    id: 'overlay-classic',
    label: 'Classic Dock',
    description: 'Top chrome with a single active panel workspace.',
    shellBlueprint: 'classic-dock',
    chrome: {
      barPosition: 'top',
      showSettingsShortcut: true,
      showPanelMenu: true,
      showBlurToggle: true,
      showShortcutBadge: true,
    },
    controlDock: {
      enabled: true,
      side: 'right',
      inset: 12,
    },
    pinnedPanels: [],
    behavior: {
      cycleOrder: 10,
      defaultActivePanelId: 'explorer',
      enforcedOpenPanelIds: [],
    },
  },
  {
    id: 'navigator-bottom',
    label: 'Navigator Bottom',
    description: 'Classic dock workspace with the chrome bar flipped to the bottom edge.',
    shellBlueprint: 'classic-dock',
    chrome: {
      barPosition: 'bottom',
      showSettingsShortcut: true,
      showPanelMenu: true,
      showBlurToggle: true,
      showShortcutBadge: true,
    },
    controlDock: {
      enabled: true,
      side: 'right',
      inset: 12,
    },
    pinnedPanels: [],
    behavior: {
      cycleOrder: 20,
      defaultActivePanelId: 'explorer',
      enforcedOpenPanelIds: [],
    },
  },
]);

export const BUILT_IN_LAYOUT_MANIFEST: LayoutManifest = {
  version: DEFAULT_LAYOUT_VERSION,
  extendsBuiltIns: true,
  profiles: BUILT_IN_PROFILES,
};

export function normalizeLayoutManifest(input: unknown): LayoutManifest {
  const source = asRecord(input);
  if (!source) {
    return BUILT_IN_LAYOUT_MANIFEST;
  }

  const profileInputs = Array.isArray(source.profiles) ? source.profiles : [];
  const extendsBuiltIns = asBoolean(source.extendsBuiltIns, true);
  const baseProfiles = extendsBuiltIns ? BUILT_IN_PROFILES : [];
  const profileMap = new Map(baseProfiles.map(profile => [profile.id, profile]));

  profileInputs.forEach((profileInput, index) => {
    const inputRecord = asRecord(profileInput);
    const requestedId = asString(inputRecord?.id, '');
    const matchedProfile = requestedId ? profileMap.get(requestedId) : undefined;
    const baseProfile = matchedProfile ?? BUILT_IN_PROFILES[index] ?? BUILT_IN_PROFILES[0];
    const normalized = normalizeLayoutProfile(profileInput, baseProfile, (index + 1) * 10);
    profileMap.set(normalized.id, normalized);
  });

  const profiles = sortProfiles(Array.from(profileMap.values()));
  return {
    version: clampNumber(asNumber(source.version, DEFAULT_LAYOUT_VERSION), 1, 999),
    extendsBuiltIns,
    profiles: profiles.length > 0 ? profiles : BUILT_IN_PROFILES,
  };
}

export function getDefaultLayoutProfile(manifest: LayoutManifest = BUILT_IN_LAYOUT_MANIFEST): LayoutProfile {
  return manifest.profiles[0] ?? BUILT_IN_PROFILES[0];
}

export function resolveLayoutProfile(
  manifest: LayoutManifest,
  activeProfileId: string | null | undefined,
): LayoutProfile {
  if (activeProfileId) {
    const matched = manifest.profiles.find(profile => profile.id === activeProfileId);
    if (matched) {
      return matched;
    }
  }
  return getDefaultLayoutProfile(manifest);
}

export function getNextLayoutProfileId(
  manifest: LayoutManifest,
  activeProfileId: string | null | undefined,
): string {
  if (manifest.profiles.length === 0) {
    return BUILT_IN_PROFILES[0].id;
  }

  const currentIndex = manifest.profiles.findIndex(profile => profile.id === activeProfileId);
  const nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % manifest.profiles.length;
  return manifest.profiles[nextIndex]?.id ?? manifest.profiles[0].id;
}

export function getPinnedPanelIds(profile: LayoutProfile): string[] {
  return Array.from(new Set(profile.pinnedPanels.map(panel => panel.panelId)));
}

export function isPanelPinned(profile: LayoutProfile, panelId: string): boolean {
  return getPinnedPanelIds(profile).includes(panelId);
}

export function getTabbedOpenPanelIds(profile: LayoutProfile, openPanelIds: string[]): string[] {
  const pinned = new Set(getPinnedPanelIds(profile));
  return openPanelIds.filter(panelId => !pinned.has(panelId));
}

export function getPanelsBySide(profile: LayoutProfile, side: LayoutDockSide): LayoutPinnedPanel[] {
  return profile.pinnedPanels.filter(panel => panel.side === side);
}

export function buildDefaultLayoutConfigCandidates(homeDir: string): string[] {
  const normalizedHome = homeDir.replace(/[\\/]+$/, '');
  const candidates: string[] = [];

  for (const location of DEFAULT_LAYOUT_CONFIG_LOCATIONS) {
    for (const extension of DEFAULT_CONFIG_EXTENSIONS) {
      candidates.push(`${normalizedHome}\\${location.relativeDir}\\${location.basename}.${extension}`);
    }
  }

  return candidates;
}

function parseLayoutManifestText(text: string, filePath: string): LayoutManifest {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error(`Layout manifest is empty: ${filePath}`);
  }

  const lowerPath = filePath.toLowerCase();
  if (lowerPath.endsWith('.toml')) {
    return normalizeLayoutManifest(parseToml(trimmed));
  }

  return normalizeLayoutManifest(JSON.parse(trimmed));
}

export interface LoadedLayoutManifest {
  manifest: LayoutManifest;
  sourcePath: string | null;
  sourceType: 'built-in' | 'file';
  sourceError: string | null;
}

export async function loadExternalLayoutManifest(preferredPath?: string | null): Promise<LoadedLayoutManifest> {
  const requestedPath = preferredPath?.trim();
  const candidatePaths = requestedPath
    ? [requestedPath]
    : buildDefaultLayoutConfigCandidates(await invoke<string>('fs_get_home_dir'));
  let lastError: string | null = null;

  for (const candidatePath of candidatePaths) {
    try {
      const text = await invoke<string>('fs_read_text_file', { path: candidatePath });
      return {
        manifest: parseLayoutManifestText(text, candidatePath),
        sourcePath: candidatePath,
        sourceType: 'file',
        sourceError: null,
      };
    } catch (error) {
      lastError = String(error);
      continue;
    }
  }

  return {
    manifest: BUILT_IN_LAYOUT_MANIFEST,
    sourcePath: null,
    sourceType: 'built-in',
    sourceError: requestedPath ? lastError ?? `Unable to load layout manifest from ${requestedPath}` : null,
  };
}
