import { create } from 'zustand';
import {
  createDefaultExplorerRailSnapshot,
  defaultExplorerRailSnapshot,
  migrateLegacyExplorerBookmarks,
  normalizeExplorerRailSnapshot,
  type ExplorerRailSnapshot,
} from '../components/explorer/explorerRailState';

export const EXPLORER_STATE_STORAGE_KEY = 'overlayterm-explorer-state-v3';
export const EXPLORER_STATE_BACKUP_KEY = 'overlayterm-explorer-state-v3.backup';
export const EXPLORER_LEGACY_BOOKMARKS_KEY = 'fs-bookmarks-v2';
export const EXPLORER_STATE_VERSION = 3;
const EXPLORER_PERSIST_DEBOUNCE_MS = (() => {
  // Vitest runs in a browser-like environment; keep persistence synchronous so unit tests
  // can assert immediately after calling store actions.
  const env = (import.meta as unknown as { env?: Record<string, unknown> }).env;
  const isTest = env?.MODE === 'test' || Boolean(env?.VITEST);
  return isTest ? 0 : 600;
})();

export type ExplorerDocumentViewMode = 'edit' | 'preview';

export interface ExplorerSessionSnapshot {
  currentPath: string;
  history: string[];
  historyIdx: number;
  sidebarWidth: number | null;
  previewWidth: number | null;
  search: string;
  searchIncludeContent: boolean;
  documentViewMode: ExplorerDocumentViewMode;
}

export interface ExplorerPersistenceNotice {
  status: 'ready' | 'legacy-imported' | 'backup-restored' | 'corrupted-reset' | 'restored-backup' | 'save-error';
  message: string | null;
  hasBackup: boolean;
}

export const defaultExplorerSession: ExplorerSessionSnapshot = {
  currentPath: '',
  history: [],
  historyIdx: -1,
  sidebarWidth: null,
  previewWidth: null,
  search: '',
  searchIncludeContent: true,
  documentViewMode: 'edit',
};

const defaultExplorerPersistenceNotice: ExplorerPersistenceNotice = {
  status: 'ready',
  message: null,
  hasBackup: false,
};

export interface PersistedExplorerState {
  version: number;
  session: ExplorerSessionSnapshot;
  rail: ExplorerRailSnapshot;
}

interface ExplorerStoreState {
  session: ExplorerSessionSnapshot;
  rail: ExplorerRailSnapshot;
  persistence: ExplorerPersistenceNotice;
  updateSession: (updates: Partial<ExplorerSessionSnapshot>) => void;
  resetSession: () => void;
  updateRail: (updates: Partial<ExplorerRailSnapshot> | ((current: ExplorerRailSnapshot) => ExplorerRailSnapshot)) => void;
  replaceRail: (nextRail: ExplorerRailSnapshot) => void;
  restoreRailBackup: () => void;
  clearPersistenceNotice: () => void;
}

interface ExplorerHydrationResult {
  session: ExplorerSessionSnapshot;
  rail: ExplorerRailSnapshot;
  persistence: ExplorerPersistenceNotice;
}

const hydratedState = loadExplorerPersistedState();

export function normalizeExplorerSessionSnapshot(value: unknown): ExplorerSessionSnapshot {
  const source = asRecord(value);
  const history = Array.isArray(source?.history)
    ? source.history.filter((entry): entry is string => typeof entry === 'string')
    : [];
  const historyIdxValue = typeof source?.historyIdx === 'number' && Number.isFinite(source.historyIdx)
    ? Math.trunc(source.historyIdx)
    : -1;
  return {
    currentPath: typeof source?.currentPath === 'string' ? source.currentPath : '',
    history,
    historyIdx: Math.max(-1, Math.min(history.length - 1, historyIdxValue)),
    sidebarWidth: normalizeOptionalNumber(source?.sidebarWidth),
    previewWidth: normalizeOptionalNumber(source?.previewWidth),
    search: typeof source?.search === 'string' ? source.search : '',
    searchIncludeContent: typeof source?.searchIncludeContent === 'boolean' ? source.searchIncludeContent : true,
    documentViewMode: source?.documentViewMode === 'preview' ? 'preview' : 'edit',
  };
}

export function loadExplorerPersistedState(storage: Storage | null = getStorage()): ExplorerHydrationResult {
  const hasBackup = Boolean(storage?.getItem(EXPLORER_STATE_BACKUP_KEY));
  if (!storage) {
    return {
      session: defaultExplorerSession,
      rail: defaultExplorerRailSnapshot,
      persistence: defaultExplorerPersistenceNotice,
    };
  }

  const primaryValue = storage.getItem(EXPLORER_STATE_STORAGE_KEY);
  if (primaryValue) {
    try {
      const parsed = JSON.parse(primaryValue) as Partial<PersistedExplorerState>;
      return {
        session: normalizeExplorerSessionSnapshot(parsed.session),
        rail: normalizeExplorerRailSnapshot(parsed.rail),
        persistence: {
          status: 'ready',
          message: null,
          hasBackup,
        },
      };
    } catch {
      const backup = loadExplorerBackup(storage);
      if (backup) {
        return {
          ...backup,
          persistence: {
            status: 'backup-restored',
            message: 'Explorer layout recovered from backup after a corrupted saved state.',
            hasBackup: true,
          },
        };
      }

      return {
        session: defaultExplorerSession,
        rail: createDefaultExplorerRailSnapshot(),
        persistence: {
          status: 'corrupted-reset',
          message: 'Explorer layout was reset because the saved state could not be decoded.',
          hasBackup: false,
        },
      };
    }
  }

  const legacyValue = storage.getItem(EXPLORER_LEGACY_BOOKMARKS_KEY);
  if (legacyValue) {
    try {
      const legacyBookmarks = migrateLegacyExplorerBookmarks(JSON.parse(legacyValue));
      if (legacyBookmarks.length > 0) {
        return {
          session: defaultExplorerSession,
          rail: {
            ...createDefaultExplorerRailSnapshot(),
            nodes: legacyBookmarks,
          },
          persistence: {
            status: 'legacy-imported',
            message: 'Legacy explorer bookmarks were imported into the new bookmark folders system.',
            hasBackup,
          },
        };
      }
    } catch {
      // Ignore invalid legacy payloads. The new store can safely start empty.
    }
  }

  return {
    session: defaultExplorerSession,
    rail: createDefaultExplorerRailSnapshot(),
    persistence: {
      status: 'ready',
      message: null,
      hasBackup,
    },
  };
}

export function persistExplorerState(
  state: PersistedExplorerState,
  storage: Storage | null = getStorage(),
): { ok: boolean; hasBackup: boolean; error?: string } {
  if (!storage) {
    return {
      ok: true,
      hasBackup: false,
    };
  }

  try {
    const serialized = JSON.stringify({
      version: EXPLORER_STATE_VERSION,
      session: normalizeExplorerSessionSnapshot(state.session),
      rail: normalizeExplorerRailSnapshot(state.rail),
    } satisfies PersistedExplorerState);
    const previous = storage.getItem(EXPLORER_STATE_STORAGE_KEY);
    if (previous && previous !== serialized) {
      storage.setItem(EXPLORER_STATE_BACKUP_KEY, previous);
    }
    storage.setItem(EXPLORER_STATE_STORAGE_KEY, serialized);
    storage.removeItem(EXPLORER_LEGACY_BOOKMARKS_KEY);
    return {
      ok: true,
      hasBackup: Boolean(storage.getItem(EXPLORER_STATE_BACKUP_KEY)),
    };
  } catch (error) {
    return {
      ok: false,
      hasBackup: Boolean(storage.getItem(EXPLORER_STATE_BACKUP_KEY)),
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export const useExplorerStore = create<ExplorerStoreState>((set, get) => {
  let persistTimer: ReturnType<typeof setTimeout> | null = null;
  let pendingNotice: Partial<ExplorerPersistenceNotice> | undefined;

  const persistLatest = (successNotice?: Partial<ExplorerPersistenceNotice>) => {
    const result = persistExplorerState({
      version: EXPLORER_STATE_VERSION,
      session: get().session,
      rail: get().rail,
    });
    set((state) => ({
      persistence: result.ok
        ? {
          status: successNotice?.status ?? (state.persistence.status === 'save-error' ? 'ready' : state.persistence.status),
          message: successNotice?.message ?? (successNotice?.status && successNotice.status !== 'ready' ? state.persistence.message : null),
          hasBackup: result.hasBackup,
        }
        : {
          status: 'save-error',
          message: `Explorer state could not be saved: ${result.error}`,
          hasBackup: result.hasBackup,
        },
    }));
  };

  const persistLatestNow = (successNotice?: Partial<ExplorerPersistenceNotice>) => {
    if (persistTimer !== null) {
      clearTimeout(persistTimer);
      persistTimer = null;
    }
    pendingNotice = undefined;
    persistLatest(successNotice);
  };

  const schedulePersistLatest = (successNotice?: Partial<ExplorerPersistenceNotice>) => {
    if (typeof window === 'undefined') {
      persistLatest(successNotice);
      return;
    }
    if (EXPLORER_PERSIST_DEBOUNCE_MS <= 0) {
      persistLatestNow(successNotice);
      return;
    }
    if (successNotice) {
      pendingNotice = successNotice;
    }
    if (persistTimer !== null) {
      clearTimeout(persistTimer);
    }
    persistTimer = setTimeout(() => {
      persistTimer = null;
      const notice = pendingNotice;
      pendingNotice = undefined;
      persistLatest(notice);
    }, EXPLORER_PERSIST_DEBOUNCE_MS);
  };

  // Best-effort flush so the latest session isn't lost on close/navigation.
  const installFlushListeners = () => {
    if (typeof window === 'undefined') {
      return;
    }
    const marker = '__overlayterm_explorer_persist_flush_installed__';
    const globalAny = globalThis as unknown as Record<string, unknown>;
    if (globalAny[marker]) {
      return;
    }
    globalAny[marker] = true;

    const flush = () => persistLatestNow();
    window.addEventListener('pagehide', flush);
    window.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        flush();
      }
    });
  };

  installFlushListeners();

  return {
    session: hydratedState.session,
    rail: hydratedState.rail,
    persistence: hydratedState.persistence,
    updateSession: (updates) => {
      set((state) => ({
        session: {
          ...state.session,
          ...updates,
        },
      }));
      schedulePersistLatest(hydratedState.persistence.status === 'legacy-imported'
        ? { status: 'ready', message: null }
        : undefined);
    },
    resetSession: () => {
      set({ session: defaultExplorerSession });
      schedulePersistLatest();
    },
    updateRail: (updates) => {
      set((state) => ({
        rail: normalizeExplorerRailSnapshot(
          typeof updates === 'function'
            ? updates(state.rail)
            : { ...state.rail, ...updates },
        ),
      }));
      schedulePersistLatest(hydratedState.persistence.status === 'legacy-imported'
        ? { status: 'ready', message: null }
        : undefined);
    },
    replaceRail: (nextRail) => {
      set({
        rail: normalizeExplorerRailSnapshot(nextRail),
      });
      schedulePersistLatest(hydratedState.persistence.status === 'legacy-imported'
        ? { status: 'ready', message: null }
        : undefined);
    },
    restoreRailBackup: () => {
      const backup = loadExplorerBackup();
      if (!backup) {
        set((state) => ({
          persistence: {
            ...state.persistence,
            status: 'save-error',
            message: 'Explorer backup was not available.',
          },
        }));
        return;
      }

      set({
        session: backup.session,
        rail: backup.rail,
      });
      persistLatestNow({
        status: 'restored-backup',
        message: 'Explorer layout restored from the last known good backup.',
      });
    },
    clearPersistenceNotice: () => {
      set((state) => ({
        persistence: {
          ...state.persistence,
          status: 'ready',
          message: null,
        },
      }));
    },
  };
});

function loadExplorerBackup(storage: Storage | null = getStorage()): Omit<ExplorerHydrationResult, 'persistence'> | null {
  if (!storage) {
    return null;
  }

  const backupValue = storage.getItem(EXPLORER_STATE_BACKUP_KEY);
  if (!backupValue) {
    return null;
  }

  try {
    const parsed = JSON.parse(backupValue) as Partial<PersistedExplorerState>;
    return {
      session: normalizeExplorerSessionSnapshot(parsed.session),
      rail: normalizeExplorerRailSnapshot(parsed.rail),
    };
  } catch {
    return null;
  }
}

function normalizeOptionalNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function getStorage(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}
