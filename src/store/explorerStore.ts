import { create } from 'zustand';
import {
  createDefaultExplorerRailSnapshot,
  defaultExplorerRailSnapshot,
  migrateLegacyExplorerBookmarks,
  normalizeExplorerRailSnapshot,
  type ExplorerRailSnapshot,
} from '../components/explorer/explorerRailState';
import {
  getExplorerShellLayoutDefinition,
  type ExplorerShellLayoutId,
} from '../config/explorerShellLayouts';
import {
  normalizeExplorerChromeLayoutId,
  normalizeExplorerChromeOverrideSnapshot,
  type ExplorerChromeControlId,
  type ExplorerChromeLayoutId,
  type ExplorerChromeOverrideSnapshot,
  type ExplorerChromeResolvedSurface,
  type ExplorerChromeSurfaceId,
} from '../config/explorerChromeLayouts';

export const EXPLORER_STATE_STORAGE_KEY = 'overlayterm-explorer-state-v3';
export const EXPLORER_STATE_BACKUP_KEY = 'overlayterm-explorer-state-v3.backup';
export const EXPLORER_LEGACY_BOOKMARKS_KEY = 'fs-bookmarks-v2';
export const EXPLORER_STATE_VERSION = 5;
export const PRIMARY_EXPLORER_INSTANCE_ID = 'primary';
export const PRIMARY_EXPLORER_TAB_ID = 'tab-primary';
const EXPLORER_PERSIST_DEBOUNCE_MS = (() => {
  // Vitest runs in a browser-like environment; keep persistence synchronous so unit tests
  // can assert immediately after calling store actions.
  const env = (import.meta as unknown as { env?: Record<string, unknown> }).env;
  const isTest = env?.MODE === 'test' || Boolean(env?.VITEST);
  return isTest ? 0 : 600;
})();

export type ExplorerDocumentViewMode = 'edit' | 'preview';
export type ExplorerInstanceId = string;
export type ExplorerPaneId = 'left' | 'right';
export type ExplorerWorkspaceLayoutMode = 'single' | 'dual';
export type ExplorerClipboardAction = 'copy' | 'cut';

export interface ExplorerClipboardEntry {
  path: string;
  name: string;
  is_dir: boolean;
}

export interface ExplorerClipboardSnapshot {
  action: ExplorerClipboardAction;
  entries: ExplorerClipboardEntry[];
}

export interface ExplorerTabSnapshot {
  id: string;
  instanceId: ExplorerInstanceId;
  pane: ExplorerPaneId;
  title: string;
}

export interface ExplorerWorkspaceSnapshot {
  tabs: ExplorerTabSnapshot[];
  activeTabIdByPane: Record<ExplorerPaneId, string | null>;
  layoutMode: ExplorerWorkspaceLayoutMode;
  focusedPane: ExplorerPaneId;
  splitRatio: number;
  nextTabOrdinal: number;
}

export interface ExplorerSessionSnapshot {
  currentPath: string;
  history: string[];
  historyIdx: number;
  sidebarWidth: number | null;
  previewWidth: number | null;
  previewEnabled: boolean;
  shellLayoutId: ExplorerShellLayoutId;
  search: string;
  searchIncludeContent: boolean;
  documentViewMode: ExplorerDocumentViewMode;
  sourcesVisible: boolean;
}

export interface ExplorerPersistenceNotice {
  status: 'ready' | 'legacy-imported' | 'backup-restored' | 'corrupted-reset' | 'restored-backup' | 'save-error';
  message: string | null;
  hasBackup: boolean;
}

export interface ExplorerChromeEditSession {
  themeId: string;
  layoutId: ExplorerChromeLayoutId;
  draftOverride: ExplorerChromeOverrideSnapshot;
  draggingControlId: ExplorerChromeControlId | null;
  registeredSurfaces: Partial<Record<ExplorerChromeSurfaceId, ExplorerChromeResolvedSurface>>;
}

export const defaultExplorerWorkspace: ExplorerWorkspaceSnapshot = {
  tabs: [{
    id: PRIMARY_EXPLORER_TAB_ID,
    instanceId: PRIMARY_EXPLORER_INSTANCE_ID,
    pane: 'left',
    title: 'Explorer',
  }],
  activeTabIdByPane: {
    left: PRIMARY_EXPLORER_TAB_ID,
    right: null,
  },
  layoutMode: 'single',
  focusedPane: 'left',
  splitRatio: 0.5,
  nextTabOrdinal: 2,
};

export const defaultExplorerSession: ExplorerSessionSnapshot = {
  currentPath: '',
  history: [],
  historyIdx: -1,
  sidebarWidth: null,
  previewWidth: null,
  previewEnabled: true,
  shellLayoutId: 'balanced',
  search: '',
  searchIncludeContent: true,
  documentViewMode: 'edit',
  sourcesVisible: true,
};

const defaultExplorerPersistenceNotice: ExplorerPersistenceNotice = {
  status: 'ready',
  message: null,
  hasBackup: false,
};

function cloneExplorerSessionSnapshot(session: ExplorerSessionSnapshot): ExplorerSessionSnapshot {
  return {
    ...session,
    history: [...session.history],
  };
}

function cloneExplorerTabSnapshot(tab: ExplorerTabSnapshot): ExplorerTabSnapshot {
  return {
    ...tab,
  };
}

function cloneExplorerWorkspaceSnapshot(
  workspace: ExplorerWorkspaceSnapshot,
): ExplorerWorkspaceSnapshot {
  return {
    ...workspace,
    tabs: workspace.tabs.map(cloneExplorerTabSnapshot),
    activeTabIdByPane: {
      left: workspace.activeTabIdByPane.left,
      right: workspace.activeTabIdByPane.right,
    },
  };
}

function createDefaultExplorerSessions(): Record<ExplorerInstanceId, ExplorerSessionSnapshot> {
  return {
    [PRIMARY_EXPLORER_INSTANCE_ID]: cloneExplorerSessionSnapshot(defaultExplorerSession),
  };
}

function createDefaultExplorerWorkspace(): ExplorerWorkspaceSnapshot {
  return cloneExplorerWorkspaceSnapshot(defaultExplorerWorkspace);
}

function getPrimaryExplorerSession(
  sessions: Record<ExplorerInstanceId, ExplorerSessionSnapshot>,
): ExplorerSessionSnapshot {
  return sessions[PRIMARY_EXPLORER_INSTANCE_ID] ?? cloneExplorerSessionSnapshot(defaultExplorerSession);
}

export interface PersistedExplorerState {
  version: number;
  session?: ExplorerSessionSnapshot;
  sessions?: Record<ExplorerInstanceId, ExplorerSessionSnapshot>;
  workspace?: ExplorerWorkspaceSnapshot;
  rail: ExplorerRailSnapshot;
}

interface ExplorerStoreState {
  sessions: Record<ExplorerInstanceId, ExplorerSessionSnapshot>;
  session: ExplorerSessionSnapshot;
  workspace: ExplorerWorkspaceSnapshot;
  rail: ExplorerRailSnapshot;
  clipboard: ExplorerClipboardSnapshot | null;
  persistence: ExplorerPersistenceNotice;
  chromeEditSession: ExplorerChromeEditSession | null;
  getSession: (instanceId?: ExplorerInstanceId) => ExplorerSessionSnapshot;
  updateSession: (updates: Partial<ExplorerSessionSnapshot>) => void;
  updateSessionForInstance: (instanceId: ExplorerInstanceId, updates: Partial<ExplorerSessionSnapshot>) => void;
  resetSession: () => void;
  resetSessionForInstance: (instanceId: ExplorerInstanceId) => void;
  copySession: (sourceInstanceId: ExplorerInstanceId, targetInstanceId: ExplorerInstanceId) => void;
  createWorkspaceTab: (args?: {
    sourceInstanceId?: ExplorerInstanceId;
    pane?: ExplorerPaneId;
    title?: string;
    activate?: boolean;
  }) => ExplorerTabSnapshot;
  closeWorkspaceTab: (tabId: string) => void;
  focusWorkspaceTab: (tabId: string) => void;
  moveWorkspaceTabToPane: (tabId: string, pane: ExplorerPaneId) => void;
  updateWorkspaceTabTitle: (tabId: string, title: string) => void;
  setWorkspaceLayoutMode: (layoutMode: ExplorerWorkspaceLayoutMode) => void;
  setFocusedPane: (pane: ExplorerPaneId) => void;
  setWorkspaceSplitRatio: (splitRatio: number) => void;
  updateRail: (updates: Partial<ExplorerRailSnapshot> | ((current: ExplorerRailSnapshot) => ExplorerRailSnapshot)) => void;
  replaceRail: (nextRail: ExplorerRailSnapshot) => void;
  restoreRailBackup: () => void;
  clearPersistenceNotice: () => void;
  openChromeEditSession: (args: {
    themeId: string;
    layoutId: ExplorerChromeLayoutId;
    initialOverride?: ExplorerChromeOverrideSnapshot | null;
  }) => void;
  updateChromeEditDraft: (draftOverride: ExplorerChromeOverrideSnapshot) => void;
  setChromeEditDraggingControl: (controlId: ExplorerChromeControlId | null) => void;
  registerChromeEditSurface: (surface: ExplorerChromeResolvedSurface) => void;
  unregisterChromeEditSurface: (surfaceId: ExplorerChromeSurfaceId) => void;
  closeChromeEditSession: () => void;
}

interface ExplorerHydrationResult {
  sessions: Record<ExplorerInstanceId, ExplorerSessionSnapshot>;
  session: ExplorerSessionSnapshot;
  workspace: ExplorerWorkspaceSnapshot;
  rail: ExplorerRailSnapshot;
  clipboard: ExplorerClipboardSnapshot | null;
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
    previewEnabled: typeof source?.previewEnabled === 'boolean'
      ? source.previewEnabled
      : defaultExplorerSession.previewEnabled,
    shellLayoutId: getExplorerShellLayoutDefinition(source?.shellLayoutId).id,
    search: typeof source?.search === 'string' ? source.search : '',
    searchIncludeContent: typeof source?.searchIncludeContent === 'boolean' ? source.searchIncludeContent : true,
    documentViewMode: source?.documentViewMode === 'preview' ? 'preview' : 'edit',
    sourcesVisible: typeof source?.sourcesVisible === 'boolean'
      ? source.sourcesVisible
      : defaultExplorerSession.sourcesVisible,
  };
}

function normalizeExplorerSessionsSnapshot(
  value: unknown,
  legacyPrimarySession?: unknown,
): Record<ExplorerInstanceId, ExplorerSessionSnapshot> {
  const source = asRecord(value);
  const entries = source
    ? Object.entries(source)
      .filter(([instanceId]) => instanceId.trim().length > 0)
      .map(([instanceId, session]) => [instanceId, normalizeExplorerSessionSnapshot(session)] as const)
    : [];

  if (entries.length > 0) {
    const sessions = Object.fromEntries(entries);
    if (!sessions[PRIMARY_EXPLORER_INSTANCE_ID]) {
      sessions[PRIMARY_EXPLORER_INSTANCE_ID] = normalizeExplorerSessionSnapshot(legacyPrimarySession);
    }
    return sessions;
  }

  return {
    [PRIMARY_EXPLORER_INSTANCE_ID]: normalizeExplorerSessionSnapshot(legacyPrimarySession),
  };
}

function normalizeExplorerPaneId(value: unknown): ExplorerPaneId {
  return value === 'right' ? 'right' : 'left';
}

function clampExplorerWorkspaceSplitRatio(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return defaultExplorerWorkspace.splitRatio;
  }
  return Math.max(0.3, Math.min(0.7, value));
}

function normalizeExplorerWorkspaceSnapshot(
  value: unknown,
  sessions: Record<ExplorerInstanceId, ExplorerSessionSnapshot>,
): ExplorerWorkspaceSnapshot {
  const source = asRecord(value);
  const rawTabs = Array.isArray(source?.tabs) ? source.tabs : [];
  const normalizedTabs = rawTabs
    .map((candidate, index): ExplorerTabSnapshot | null => {
      const record = asRecord(candidate);
      if (!record) {
        return null;
      }
      const instanceId = typeof record.instanceId === 'string' && record.instanceId.trim().length > 0
        ? record.instanceId.trim()
        : null;
      if (!instanceId) {
        return null;
      }
      return {
        id: typeof record.id === 'string' && record.id.trim().length > 0
          ? record.id.trim()
          : `tab-${index + 1}`,
        instanceId,
        pane: normalizeExplorerPaneId(record.pane),
        title: typeof record.title === 'string' && record.title.trim().length > 0
          ? record.title
          : `Explorer ${index + 1}`,
      };
    })
    .filter((tab): tab is ExplorerTabSnapshot => Boolean(tab));

  const tabs = normalizedTabs.length > 0
    ? normalizedTabs.filter((tab, index, collection) => (
      collection.findIndex((candidate) => candidate.id === tab.id) === index
    ))
    : createDefaultExplorerWorkspace().tabs;

  const missingPrimaryTab = !tabs.some((tab) => tab.instanceId === PRIMARY_EXPLORER_INSTANCE_ID);
  if (missingPrimaryTab && sessions[PRIMARY_EXPLORER_INSTANCE_ID]) {
    tabs.unshift({
      id: PRIMARY_EXPLORER_TAB_ID,
      instanceId: PRIMARY_EXPLORER_INSTANCE_ID,
      pane: 'left',
      title: 'Explorer',
    });
  }

  const leftTabs = tabs.filter((tab) => tab.pane === 'left');
  const rightTabs = tabs.filter((tab) => tab.pane === 'right');
  const activeSource = asRecord(source?.activeTabIdByPane);
  const leftActiveCandidate = typeof activeSource?.left === 'string' ? activeSource.left : null;
  const rightActiveCandidate = typeof activeSource?.right === 'string' ? activeSource.right : null;
  const activeTabIdByPane = {
    left: leftTabs.some((tab) => tab.id === leftActiveCandidate)
      ? leftActiveCandidate
      : leftTabs[0]?.id ?? null,
    right: rightTabs.some((tab) => tab.id === rightActiveCandidate)
      ? rightActiveCandidate
      : rightTabs[0]?.id ?? null,
  } satisfies Record<ExplorerPaneId, string | null>;

  const nextTabOrdinalValue = typeof source?.nextTabOrdinal === 'number' && Number.isFinite(source.nextTabOrdinal)
    ? Math.max(1, Math.trunc(source.nextTabOrdinal))
    : tabs.length + 1;

  return {
    tabs,
    activeTabIdByPane,
    layoutMode: source?.layoutMode === 'dual' ? 'dual' : 'single',
    focusedPane: normalizeExplorerPaneId(source?.focusedPane),
    splitRatio: clampExplorerWorkspaceSplitRatio(source?.splitRatio),
    nextTabOrdinal: nextTabOrdinalValue,
  };
}

export function loadExplorerPersistedState(storage: Storage | null = getStorage()): ExplorerHydrationResult {
  const hasBackup = Boolean(storage?.getItem(EXPLORER_STATE_BACKUP_KEY));
  if (!storage) {
    const sessions = createDefaultExplorerSessions();
    return {
      sessions,
      session: getPrimaryExplorerSession(sessions),
      workspace: createDefaultExplorerWorkspace(),
      rail: defaultExplorerRailSnapshot,
      clipboard: null,
      persistence: defaultExplorerPersistenceNotice,
    };
  }

  const primaryValue = storage.getItem(EXPLORER_STATE_STORAGE_KEY);
  if (primaryValue) {
    try {
      const parsed = JSON.parse(primaryValue) as Partial<PersistedExplorerState>;
      const sessions = normalizeExplorerSessionsSnapshot(parsed.sessions, parsed.session);
      const workspace = normalizeExplorerWorkspaceSnapshot(parsed.workspace, sessions);
      return {
        sessions,
        session: getPrimaryExplorerSession(sessions),
        workspace,
        rail: normalizeExplorerRailSnapshot(parsed.rail),
        clipboard: null,
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
        sessions: createDefaultExplorerSessions(),
        session: cloneExplorerSessionSnapshot(defaultExplorerSession),
        workspace: createDefaultExplorerWorkspace(),
        rail: createDefaultExplorerRailSnapshot(),
        clipboard: null,
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
          sessions: createDefaultExplorerSessions(),
          session: cloneExplorerSessionSnapshot(defaultExplorerSession),
          workspace: createDefaultExplorerWorkspace(),
          rail: {
            ...createDefaultExplorerRailSnapshot(),
            nodes: legacyBookmarks,
          },
          clipboard: null,
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

  const sessions = createDefaultExplorerSessions();
  return {
    sessions,
    session: getPrimaryExplorerSession(sessions),
    workspace: createDefaultExplorerWorkspace(),
    rail: createDefaultExplorerRailSnapshot(),
    clipboard: null,
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
    const sessions = normalizeExplorerSessionsSnapshot(state.sessions, state.session);
    const primarySession = getPrimaryExplorerSession(sessions);
    const workspace = normalizeExplorerWorkspaceSnapshot(state.workspace, sessions);
    const serialized = JSON.stringify({
      version: EXPLORER_STATE_VERSION,
      session: primarySession,
      sessions,
      workspace,
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
      sessions: get().sessions,
      session: get().session,
      workspace: get().workspace,
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
    sessions: hydratedState.sessions,
    session: hydratedState.session,
    workspace: hydratedState.workspace,
    rail: hydratedState.rail,
    clipboard: hydratedState.clipboard,
    persistence: hydratedState.persistence,
    chromeEditSession: null,
    getSession: (instanceId = PRIMARY_EXPLORER_INSTANCE_ID) => (
      get().sessions[instanceId] ?? cloneExplorerSessionSnapshot(defaultExplorerSession)
    ),
    updateSession: (updates) => {
      const current = get().sessions[PRIMARY_EXPLORER_INSTANCE_ID] ?? cloneExplorerSessionSnapshot(defaultExplorerSession);
      const nextSession = normalizeExplorerSessionSnapshot({
        ...current,
        ...updates,
      });
      set((state) => ({
        sessions: {
          ...state.sessions,
          [PRIMARY_EXPLORER_INSTANCE_ID]: nextSession,
        },
        session: nextSession,
      }));
      schedulePersistLatest(hydratedState.persistence.status === 'legacy-imported'
        ? { status: 'ready', message: null }
        : undefined);
    },
    updateSessionForInstance: (instanceId, updates) => {
      const normalizedInstanceId = instanceId.trim() || PRIMARY_EXPLORER_INSTANCE_ID;
      const current = get().sessions[normalizedInstanceId] ?? cloneExplorerSessionSnapshot(defaultExplorerSession);
      const nextSession = normalizeExplorerSessionSnapshot({
        ...current,
        ...updates,
      });
      set((state) => ({
        sessions: {
          ...state.sessions,
          [normalizedInstanceId]: nextSession,
        },
        session: normalizedInstanceId === PRIMARY_EXPLORER_INSTANCE_ID ? nextSession : state.session,
      }));
      schedulePersistLatest(hydratedState.persistence.status === 'legacy-imported'
        ? { status: 'ready', message: null }
        : undefined);
    },
    resetSession: () => {
      const sessions = createDefaultExplorerSessions();
      set({
        sessions,
        session: getPrimaryExplorerSession(sessions),
        workspace: createDefaultExplorerWorkspace(),
      });
      schedulePersistLatest();
    },
    resetSessionForInstance: (instanceId) => {
      const normalizedInstanceId = instanceId.trim() || PRIMARY_EXPLORER_INSTANCE_ID;
      const nextSession = cloneExplorerSessionSnapshot(defaultExplorerSession);
      set((state) => ({
        sessions: {
          ...state.sessions,
          [normalizedInstanceId]: nextSession,
        },
        session: normalizedInstanceId === PRIMARY_EXPLORER_INSTANCE_ID ? nextSession : state.session,
      }));
      schedulePersistLatest();
    },
    copySession: (sourceInstanceId, targetInstanceId) => {
      const sourceId = sourceInstanceId.trim() || PRIMARY_EXPLORER_INSTANCE_ID;
      const targetId = targetInstanceId.trim() || PRIMARY_EXPLORER_INSTANCE_ID;
      const sourceSession = get().sessions[sourceId] ?? cloneExplorerSessionSnapshot(defaultExplorerSession);
      const nextSession = cloneExplorerSessionSnapshot(sourceSession);
      set((state) => ({
        sessions: {
          ...state.sessions,
          [targetId]: nextSession,
        },
        session: targetId === PRIMARY_EXPLORER_INSTANCE_ID ? nextSession : state.session,
      }));
      schedulePersistLatest(hydratedState.persistence.status === 'legacy-imported'
        ? { status: 'ready', message: null }
        : undefined);
    },
    createWorkspaceTab: (args = {}) => {
      const workspace = get().workspace;
      const pane = args.pane ?? workspace.focusedPane;
      const sourceInstanceId = args.sourceInstanceId?.trim() || PRIMARY_EXPLORER_INSTANCE_ID;
      const nextInstanceId = `explorer-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const nextTab: ExplorerTabSnapshot = {
        id: `tab-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        instanceId: nextInstanceId,
        pane,
        title: args.title?.trim() || `Explorer ${workspace.nextTabOrdinal}`,
      };
      const sourceSession = get().sessions[sourceInstanceId] ?? cloneExplorerSessionSnapshot(defaultExplorerSession);
      const nextSession = cloneExplorerSessionSnapshot(sourceSession);
      set((state) => ({
        sessions: {
          ...state.sessions,
          [nextInstanceId]: nextSession,
        },
        workspace: {
          ...state.workspace,
          tabs: [...state.workspace.tabs, nextTab],
          activeTabIdByPane: {
            ...state.workspace.activeTabIdByPane,
            [pane]: args.activate === false ? state.workspace.activeTabIdByPane[pane] : nextTab.id,
          },
          focusedPane: pane,
          nextTabOrdinal: state.workspace.nextTabOrdinal + 1,
        },
      }));
      schedulePersistLatest();
      return nextTab;
    },
    closeWorkspaceTab: (tabId) => {
      const workspace = get().workspace;
      if (workspace.tabs.length <= 1) {
        return;
      }
      const tab = workspace.tabs.find((candidate) => candidate.id === tabId);
      if (!tab) {
        return;
      }
      const nextTabs = workspace.tabs.filter((candidate) => candidate.id !== tabId);
      const nextActiveTabIdByPane = { ...workspace.activeTabIdByPane };
      const paneTabs = nextTabs.filter((candidate) => candidate.pane === tab.pane);
      if (nextActiveTabIdByPane[tab.pane] === tabId) {
        nextActiveTabIdByPane[tab.pane] = paneTabs[0]?.id ?? null;
      }
      const referencedInstanceIds = new Set(nextTabs.map((candidate) => candidate.instanceId));
      const nextFocusedPane = workspace.focusedPane === tab.pane && !nextActiveTabIdByPane[tab.pane]
        ? (tab.pane === 'left' ? 'right' : 'left')
        : workspace.focusedPane;
      set((state) => {
        const nextSessions = Object.fromEntries(
          Object.entries(state.sessions).filter(([instanceId]) => (
            instanceId === PRIMARY_EXPLORER_INSTANCE_ID || referencedInstanceIds.has(instanceId)
          )),
        );
        return {
          sessions: nextSessions,
          session: getPrimaryExplorerSession(nextSessions),
          workspace: {
            ...state.workspace,
            tabs: nextTabs,
            activeTabIdByPane: nextActiveTabIdByPane,
            focusedPane: nextFocusedPane,
          },
        };
      });
      schedulePersistLatest();
    },
    focusWorkspaceTab: (tabId) => {
      const workspace = get().workspace;
      const tab = workspace.tabs.find((candidate) => candidate.id === tabId);
      if (!tab) {
        return;
      }
      set((state) => ({
        workspace: {
          ...state.workspace,
          activeTabIdByPane: {
            ...state.workspace.activeTabIdByPane,
            [tab.pane]: tab.id,
          },
          focusedPane: tab.pane,
        },
      }));
      schedulePersistLatest();
    },
    moveWorkspaceTabToPane: (tabId, pane) => {
      const workspace = get().workspace;
      const tab = workspace.tabs.find((candidate) => candidate.id === tabId);
      if (!tab || tab.pane === pane) {
        return;
      }
      const originPane = tab.pane;
      const nextTabs = workspace.tabs.map((candidate) => (
        candidate.id === tabId
          ? { ...candidate, pane }
          : candidate
      ));
      const nextActiveTabIdByPane = { ...workspace.activeTabIdByPane };
      if (nextActiveTabIdByPane[originPane] === tabId) {
        nextActiveTabIdByPane[originPane] = nextTabs.find((candidate) => candidate.pane === originPane)?.id ?? null;
      }
      nextActiveTabIdByPane[pane] = tabId;
      set((state) => ({
        workspace: {
          ...state.workspace,
          tabs: nextTabs,
          activeTabIdByPane: nextActiveTabIdByPane,
          focusedPane: pane,
        },
      }));
      schedulePersistLatest();
    },
    updateWorkspaceTabTitle: (tabId, title) => {
      set((state) => ({
        workspace: {
          ...state.workspace,
          tabs: state.workspace.tabs.map((tab) => (
            tab.id === tabId
              ? { ...tab, title: title.trim() || tab.title }
              : tab
          )),
        },
      }));
      schedulePersistLatest();
    },
    setWorkspaceLayoutMode: (layoutMode) => {
      set((state) => ({
        workspace: {
          ...state.workspace,
          layoutMode,
        },
      }));
      schedulePersistLatest();
    },
    setFocusedPane: (pane) => {
      set((state) => ({
        workspace: {
          ...state.workspace,
          focusedPane: pane,
        },
      }));
      schedulePersistLatest();
    },
    setWorkspaceSplitRatio: (splitRatio) => {
      set((state) => ({
        workspace: {
          ...state.workspace,
          splitRatio: clampExplorerWorkspaceSplitRatio(splitRatio),
        },
      }));
      schedulePersistLatest();
    },
    setClipboard: (clipboard) => {
      set({ clipboard });
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
        sessions: backup.sessions,
        session: backup.session,
        workspace: backup.workspace,
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
    openChromeEditSession: ({ themeId, layoutId, initialOverride }) => {
      const trimmedThemeId = themeId.trim();
      if (!trimmedThemeId) {
        return;
      }

      set({
        chromeEditSession: {
          themeId: trimmedThemeId,
          layoutId: normalizeExplorerChromeLayoutId(layoutId),
          draftOverride: normalizeExplorerChromeOverrideSnapshot(initialOverride),
          draggingControlId: null,
          registeredSurfaces: {},
        },
      });
    },
    updateChromeEditDraft: (draftOverride) => {
      set((state) => {
        if (!state.chromeEditSession) {
          return state;
        }

        return {
          chromeEditSession: {
            ...state.chromeEditSession,
            draftOverride: normalizeExplorerChromeOverrideSnapshot(draftOverride),
            draggingControlId: null,
          },
        };
      });
    },
    setChromeEditDraggingControl: (controlId) => {
      set((state) => {
        if (!state.chromeEditSession) {
          return state;
        }

        return {
          chromeEditSession: {
            ...state.chromeEditSession,
            draggingControlId: controlId,
          },
        };
      });
    },
    registerChromeEditSurface: (surface) => {
      set((state) => {
        if (!state.chromeEditSession) {
          return state;
        }

        return {
          chromeEditSession: {
            ...state.chromeEditSession,
            registeredSurfaces: {
              ...state.chromeEditSession.registeredSurfaces,
              [surface.surfaceId]: surface,
            },
          },
        };
      });
    },
    unregisterChromeEditSurface: (surfaceId) => {
      set((state) => {
        if (!state.chromeEditSession) {
          return state;
        }

        const nextRegisteredSurfaces = { ...state.chromeEditSession.registeredSurfaces };
        delete nextRegisteredSurfaces[surfaceId];
        return {
          chromeEditSession: {
            ...state.chromeEditSession,
            registeredSurfaces: nextRegisteredSurfaces,
          },
        };
      });
    },
    closeChromeEditSession: () => {
      set({ chromeEditSession: null });
    },
  };
});

installExplorerStorageSync();

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
    const sessions = normalizeExplorerSessionsSnapshot(parsed.sessions, parsed.session);
    const workspace = normalizeExplorerWorkspaceSnapshot(parsed.workspace, sessions);
    return {
      sessions,
      session: getPrimaryExplorerSession(sessions),
      workspace,
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

function installExplorerStorageSync(): void {
  if (typeof window === 'undefined') {
    return;
  }

  const marker = '__greeblefs_explorer_storage_sync_installed__';
  const globalState = globalThis as typeof globalThis & Record<string, unknown>;
  if (globalState[marker]) {
    return;
  }
  globalState[marker] = true;

  window.addEventListener('storage', event => {
    if (
      event.key !== null
      && event.key !== EXPLORER_STATE_STORAGE_KEY
      && event.key !== EXPLORER_STATE_BACKUP_KEY
      && event.key !== EXPLORER_LEGACY_BOOKMARKS_KEY
    ) {
      return;
    }

    const nextHydratedState = loadExplorerPersistedState();
    useExplorerStore.setState(state => ({
      ...state,
      sessions: nextHydratedState.sessions,
      session: nextHydratedState.session,
      workspace: nextHydratedState.workspace,
      rail: nextHydratedState.rail,
      persistence: nextHydratedState.persistence,
    }));
  });
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}
