import {
  getExplorerShellLayoutDefinition,
  type ExplorerShellLayoutId,
} from './explorerShellLayouts';
import {
  defaultExplorerChromeLayoutId,
  normalizeExplorerChromeLayoutId,
  type ExplorerChromeLayoutId,
} from './explorerChromeLayouts';
import type { ExplorerExperimentalViewMode } from './explorerExperimentalModes';
import type { ExplorerViewMode } from './explorerViewModes';

export type BuiltInExplorerModeProfileId = 'balanced' | 'navigator' | 'focus' | 'inspector';
export type ExplorerModeProfileId = BuiltInExplorerModeProfileId | (string & {});
export type ExplorerModeViewBias = 'balanced' | 'browsing' | 'content-focus' | 'preview-heavy';

export interface ExplorerModeProfileDefinition {
  id: ExplorerModeProfileId;
  label: string;
  shortLabel: string;
  description: string;
  paneLayoutId: ExplorerShellLayoutId;
  chromeLayoutId: ExplorerChromeLayoutId;
  viewBias: ExplorerModeViewBias;
  preferredViewMode?: ExplorerViewMode;
  preferredExperimentalViewMode?: ExplorerExperimentalViewMode;
}

const builtInExplorerModeProfiles: Record<BuiltInExplorerModeProfileId, ExplorerModeProfileDefinition> = {
  balanced: {
    id: 'balanced',
    label: 'Balanced',
    shortLabel: 'Balanced',
    description: 'Balanced browsing with the rail and preview both available.',
    paneLayoutId: 'balanced',
    chromeLayoutId: 'default',
    viewBias: 'balanced',
  },
  navigator: {
    id: 'navigator',
    label: 'Navigator',
    shortLabel: 'Navigator',
    description: 'Rail-first browsing with a stronger emphasis on source navigation.',
    paneLayoutId: 'navigator',
    chromeLayoutId: 'default',
    viewBias: 'browsing',
  },
  focus: {
    id: 'focus',
    label: 'Focus',
    shortLabel: 'Focus',
    description: 'Minimal browsing chrome with search-forward emphasis.',
    paneLayoutId: 'focus',
    chromeLayoutId: 'focused-search',
    viewBias: 'content-focus',
  },
  inspector: {
    id: 'inspector',
    label: 'Inspector',
    shortLabel: 'Inspector',
    description: 'Preview-heavy browsing tuned for inspection and triage.',
    paneLayoutId: 'inspector',
    chromeLayoutId: 'default',
    viewBias: 'preview-heavy',
  },
};

export const defaultExplorerModeProfileId: BuiltInExplorerModeProfileId = 'balanced';
export const explorerModeProfiles = Object.values(builtInExplorerModeProfiles);

export function stepExplorerModeProfile(input: {
  currentModeProfileId?: ExplorerModeProfileId | null;
  direction?: 'next' | 'previous';
}): ExplorerModeProfileDefinition {
  const direction = input.direction ?? 'next';
  const currentModeProfileId = normalizeExplorerModeProfileId(
    input.currentModeProfileId,
  );
  const currentIndex = explorerModeProfiles.findIndex(
    (modeProfile) => modeProfile.id === currentModeProfileId,
  );
  const safeCurrentIndex = currentIndex >= 0 ? currentIndex : 0;
  const offset = direction === 'previous' ? -1 : 1;
  const nextIndex =
    (safeCurrentIndex + offset + explorerModeProfiles.length) %
    explorerModeProfiles.length;
  return explorerModeProfiles[nextIndex] ?? explorerModeProfiles[0];
}

function asTrimmedString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : null;
}

export function normalizeExplorerModeProfileId(value: unknown): ExplorerModeProfileId {
  return (asTrimmedString(value) as ExplorerModeProfileId | null) ?? defaultExplorerModeProfileId;
}

export function getExplorerModeProfileDefinition(
  modeProfileId?: ExplorerModeProfileId | null,
): ExplorerModeProfileDefinition {
  const normalizedModeProfileId = normalizeExplorerModeProfileId(modeProfileId);
  return builtInExplorerModeProfiles[normalizedModeProfileId as BuiltInExplorerModeProfileId]
    ?? builtInExplorerModeProfiles[defaultExplorerModeProfileId];
}

export function mapLegacyShellLayoutIdToExplorerModeProfileId(
  shellLayoutId?: ExplorerShellLayoutId | null,
): ExplorerModeProfileId {
  return getExplorerShellLayoutDefinition(shellLayoutId).id;
}

export function resolveEffectiveExplorerModeProfileId(input: {
  themeOverrideModeProfileId?: ExplorerModeProfileId | null;
  themeDefaultModeProfileId?: ExplorerModeProfileId | null;
  legacyShellLayoutId?: ExplorerShellLayoutId | null;
}): ExplorerModeProfileId {
  if (input.themeOverrideModeProfileId) {
    return normalizeExplorerModeProfileId(input.themeOverrideModeProfileId);
  }
  if (input.themeDefaultModeProfileId) {
    return normalizeExplorerModeProfileId(input.themeDefaultModeProfileId);
  }
  if (input.legacyShellLayoutId) {
    return mapLegacyShellLayoutIdToExplorerModeProfileId(input.legacyShellLayoutId);
  }
  return defaultExplorerModeProfileId;
}

export function resolveEffectiveExplorerModeProfile(input: {
  themeOverrideModeProfileId?: ExplorerModeProfileId | null;
  themeDefaultModeProfileId?: ExplorerModeProfileId | null;
  legacyShellLayoutId?: ExplorerShellLayoutId | null;
}): ExplorerModeProfileDefinition {
  return getExplorerModeProfileDefinition(resolveEffectiveExplorerModeProfileId(input));
}

export function resolveExplorerModeProfileChromeLayoutId(input: {
  modeProfile?: Pick<ExplorerModeProfileDefinition, 'chromeLayoutId'> | null;
  themeChromeLayoutId?: ExplorerChromeLayoutId | null;
}): ExplorerChromeLayoutId {
  return normalizeExplorerChromeLayoutId(
    input.modeProfile?.chromeLayoutId
      ?? input.themeChromeLayoutId
      ?? defaultExplorerChromeLayoutId,
  );
}
