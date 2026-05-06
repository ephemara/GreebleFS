import { create } from 'zustand';
import type { OverlayCommandPaletteQuickFilterId } from '../components/CommandPalette';

export const COMMAND_PALETTE_STATE_STORAGE_KEY = 'greeblefs-command-palette-v1';

const MAX_RECENT_COMMAND_PALETTE_ACTIONS = 12;

interface CommandPaletteSnapshot {
  pinnedActionIds: string[];
  recentActionIds: string[];
  lastQuickFilterId: OverlayCommandPaletteQuickFilterId;
}

interface CommandPaletteStoreState extends CommandPaletteSnapshot {
  pruneActionIds: (availableActionIds: string[]) => void;
  recordActionUsage: (actionId: string) => void;
  setLastQuickFilterId: (filterId: OverlayCommandPaletteQuickFilterId) => void;
  togglePinnedActionId: (actionId: string) => void;
}

const defaultCommandPaletteSnapshot: CommandPaletteSnapshot = {
  pinnedActionIds: [],
  recentActionIds: [],
  lastQuickFilterId: 'all',
};

function isStorageLike(candidate: unknown): candidate is Storage {
  return Boolean(candidate)
    && typeof (candidate as Storage).getItem === 'function'
    && typeof (candidate as Storage).setItem === 'function'
    && typeof (candidate as Storage).removeItem === 'function';
}

function getCommandPaletteStorage(): Storage | null {
  if (typeof window !== 'undefined' && isStorageLike(window.localStorage)) {
    return window.localStorage;
  }

  if (typeof globalThis !== 'undefined' && 'localStorage' in globalThis) {
    const candidate = globalThis.localStorage;
    if (isStorageLike(candidate)) {
      return candidate;
    }
  }

  return null;
}

function normalizeQuickFilterId(value: unknown): OverlayCommandPaletteQuickFilterId {
  switch (value) {
    case 'pinned':
    case 'recent':
    case 'commands':
    case 'files':
    case 'panels':
    case 'plugins':
      return value;
    case 'all':
    default:
      return 'all';
  }
}

function normalizeActionIdList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
    .map((entry) => entry.trim())
    .filter((entry, index, collection) => collection.indexOf(entry) === index);
}

function normalizeCommandPaletteSnapshot(value: unknown): CommandPaletteSnapshot {
  if (!value || typeof value !== 'object') {
    return { ...defaultCommandPaletteSnapshot };
  }

  const candidate = value as Partial<CommandPaletteSnapshot>;
  return {
    pinnedActionIds: normalizeActionIdList(candidate.pinnedActionIds),
    recentActionIds: normalizeActionIdList(candidate.recentActionIds)
      .slice(0, MAX_RECENT_COMMAND_PALETTE_ACTIONS),
    lastQuickFilterId: normalizeQuickFilterId(candidate.lastQuickFilterId),
  };
}

function readStoredCommandPaletteSnapshot(): CommandPaletteSnapshot {
  const storage = getCommandPaletteStorage();
  if (!storage) {
    return { ...defaultCommandPaletteSnapshot };
  }

  try {
    const rawValue = storage.getItem(COMMAND_PALETTE_STATE_STORAGE_KEY);
    if (!rawValue) {
      return { ...defaultCommandPaletteSnapshot };
    }

    return normalizeCommandPaletteSnapshot(JSON.parse(rawValue));
  } catch {
    return { ...defaultCommandPaletteSnapshot };
  }
}

function persistCommandPaletteSnapshot(snapshot: CommandPaletteSnapshot): void {
  const storage = getCommandPaletteStorage();
  if (!storage) {
    return;
  }

  try {
    storage.setItem(
      COMMAND_PALETTE_STATE_STORAGE_KEY,
      JSON.stringify(snapshot),
    );
  } catch {
    // Ignore storage failures so the palette still works in restricted hosts.
  }
}

function buildStateSnapshot(
  state: Pick<CommandPaletteStoreState, 'pinnedActionIds' | 'recentActionIds' | 'lastQuickFilterId'>,
): CommandPaletteSnapshot {
  return {
    pinnedActionIds: [...state.pinnedActionIds],
    recentActionIds: [...state.recentActionIds],
    lastQuickFilterId: state.lastQuickFilterId,
  };
}

const initialCommandPaletteSnapshot = readStoredCommandPaletteSnapshot();

export const useCommandPaletteStore = create<CommandPaletteStoreState>((set) => ({
  ...initialCommandPaletteSnapshot,
  pruneActionIds: (availableActionIds) => set((state) => {
    const snapshot = buildStateSnapshot(state);
    const availableActionIdSet = new Set(
      availableActionIds
        .filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
        .map((entry) => entry.trim()),
    );
    if (availableActionIdSet.size === 0) {
      return state;
    }

    const nextPinnedActionIds = snapshot.pinnedActionIds.filter((actionId) => availableActionIdSet.has(actionId));
    const nextRecentActionIds = snapshot.recentActionIds.filter((actionId) => availableActionIdSet.has(actionId));
    const pinnedIdsChanged = nextPinnedActionIds.length !== snapshot.pinnedActionIds.length;
    const recentIdsChanged = nextRecentActionIds.length !== snapshot.recentActionIds.length;
    if (!pinnedIdsChanged && !recentIdsChanged) {
      return state;
    }

    const nextSnapshot = {
      ...snapshot,
      pinnedActionIds: nextPinnedActionIds,
      recentActionIds: nextRecentActionIds,
    };
    persistCommandPaletteSnapshot(nextSnapshot);
    return nextSnapshot;
  }),
  recordActionUsage: (actionId) => set((state) => {
    const snapshot = buildStateSnapshot(state);
    const normalizedActionId = actionId.trim();
    if (!normalizedActionId) {
      return snapshot;
    }

    const nextSnapshot = {
      ...snapshot,
      recentActionIds: [
        normalizedActionId,
        ...snapshot.recentActionIds.filter((entry) => entry !== normalizedActionId),
      ].slice(0, MAX_RECENT_COMMAND_PALETTE_ACTIONS),
    };
    persistCommandPaletteSnapshot(nextSnapshot);
    return nextSnapshot;
  }),
  setLastQuickFilterId: (filterId) => set((state) => {
    const snapshot = buildStateSnapshot(state);
    const nextSnapshot = {
      ...snapshot,
      lastQuickFilterId: normalizeQuickFilterId(filterId),
    };
    persistCommandPaletteSnapshot(nextSnapshot);
    return nextSnapshot;
  }),
  togglePinnedActionId: (actionId) => set((state) => {
    const snapshot = buildStateSnapshot(state);
    const normalizedActionId = actionId.trim();
    if (!normalizedActionId) {
      return snapshot;
    }

    const isAlreadyPinned = snapshot.pinnedActionIds.includes(normalizedActionId);
    const nextSnapshot = {
      ...snapshot,
      pinnedActionIds: isAlreadyPinned
        ? snapshot.pinnedActionIds.filter((entry) => entry !== normalizedActionId)
        : [...snapshot.pinnedActionIds, normalizedActionId],
    };
    persistCommandPaletteSnapshot(nextSnapshot);
    return nextSnapshot;
  }),
}));

export function resetCommandPaletteStoreForTests(): void {
  persistCommandPaletteSnapshot(defaultCommandPaletteSnapshot);
  useCommandPaletteStore.setState({ ...defaultCommandPaletteSnapshot });
}
