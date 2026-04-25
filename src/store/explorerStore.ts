import { create } from "zustand";
import {
  createDefaultExplorerRailSnapshot,
  defaultExplorerRailSnapshot,
  migrateLegacyExplorerBookmarks,
  normalizeExplorerRailSnapshot,
  type ExplorerRailSnapshot,
} from "../components/explorer/explorerRailState";
import {
  getExplorerShellLayoutDefinition,
  type ExplorerShellLayoutId,
} from "../config/explorerShellLayouts";
import {
  clampExplorerWorkspaceAxisRatio,
  createEmptyExplorerPaneRecord,
  defaultExplorerWorkspaceAxisRatio,
  defaultExplorerWorkspaceLayoutMode,
  explorerPaneIds,
  getExplorerWorkspaceVisiblePaneIds,
  normalizeExplorerPaneId,
  normalizeExplorerWorkspaceLayoutMode,
  type ExplorerPaneId,
  type ExplorerWorkspaceLayoutMode,
} from "../config/explorerWorkspaceLayouts";
import {
  getExplorerChromeResolvedSurfaceSignature,
  normalizeExplorerChromeLayoutId,
  normalizeExplorerChromeOverrideSnapshot,
  type ExplorerChromeControlId,
  type ExplorerChromeLayoutId,
  type ExplorerChromeOverrideSnapshot,
  type ExplorerChromeResolvedSurface,
  type ExplorerChromeSurfaceId,
  type ExplorerChromeZoneId,
} from "../config/explorerChromeLayouts";
import {
  normalizeExplorerSearchMode,
  type ExplorerSearchModeValue,
} from "../config/semanticSearch";
import {
  CONSTELLATION_DEFAULT_LENS,
  normalizeConstellationLensId,
  type ConstellationLensId,
} from "../config/constellationGraph";

export const EXPLORER_STATE_STORAGE_KEY = "overlayterm-explorer-state-v3";
export const EXPLORER_STATE_BACKUP_KEY = "overlayterm-explorer-state-v3.backup";
export const EXPLORER_LEGACY_BOOKMARKS_KEY = "fs-bookmarks-v2";
export const EXPLORER_STATE_VERSION = 10;
export const PRIMARY_EXPLORER_INSTANCE_ID = "primary";
export const PRIMARY_EXPLORER_TAB_ID = "workspace-tab-primary";
const EXPLORER_PERSIST_DEBOUNCE_MS = (() => {
  // Vitest runs in a browser-like environment; keep persistence synchronous so unit tests
  // can assert immediately after calling store actions.
  const env = (import.meta as unknown as { env?: Record<string, unknown> }).env;
  const isTest = env?.MODE === "test" || Boolean(env?.VITEST);
  return isTest ? 0 : 600;
})();

export type ExplorerDocumentViewMode = "edit" | "preview";
export type ExplorerInstanceId = string;
export type ExplorerClipboardAction = "copy" | "cut";

export interface ExplorerClipboardEntry {
  path: string;
  name: string;
  is_dir: boolean;
}

export interface ExplorerClipboardSnapshot {
  action: ExplorerClipboardAction;
  entries: ExplorerClipboardEntry[];
}

export interface ExplorerWorkspacePaneSnapshot {
  instanceId: ExplorerInstanceId;
  title: string;
}

export interface ExplorerWorkspaceTabSnapshot {
  id: string;
  layoutMode: ExplorerWorkspaceLayoutMode;
  focusedPane: ExplorerPaneId;
  columnSplitRatio: number;
  rowSplitRatio: number;
  panes: Record<ExplorerPaneId, ExplorerWorkspacePaneSnapshot | null>;
}

export interface ExplorerWorkspaceSnapshot {
  tabs: ExplorerWorkspaceTabSnapshot[];
  activeWorkspaceTabId: string;
  nextTabOrdinal: number;
}

export interface ExplorerSessionSnapshot {
  currentPath: string;
  history: string[];
  historyIdx: number;
  sidebarWidth: number | null;
  previewWidth: number | null;
  actionsWidth: number | null;
  previewEnabled: boolean;
  previewLocked: boolean;
  previewSplitMode: "inline" | "pane";
  shellLayoutId: ExplorerShellLayoutId;
  search: string;
  searchMode: ExplorerSearchModeValue;
  documentViewMode: ExplorerDocumentViewMode;
  sourcesVisible: boolean;
  actionsVisible: boolean;
  constellation: ExplorerConstellationSessionSnapshot;
}

export interface ExplorerConstellationSessionSnapshot {
  activeLens: ConstellationLensId;
  routeModeEnabled: boolean;
  pinnedPaths: string[];
}

export type ExplorerPreviewSplitMode =
  ExplorerSessionSnapshot["previewSplitMode"];

export type ExplorerPropertiesPanelTab = "info" | "permissions" | "checksums";

export interface ExplorerJumpFilterSnapshot {
  active: boolean;
  query: string;
  resultIndex: number;
  resultPaths: string[];
}

export interface ExplorerPropertiesPanelSnapshot {
  loading: boolean;
  targetPaths: string[];
  tab: ExplorerPropertiesPanelTab;
  visible: boolean;
}

export interface ExplorerPendingTerminalCwdSync {
  path: string;
  shell: string | null;
  source: "navigation" | "open-terminal";
  updatedAt: number;
}

export interface ExplorerPendingOpenRequest {
  sequence: number;
  directoryPath: string;
  selectionPath: string | null;
  pushHistory: boolean;
}

export interface ExplorerRecursiveSizeCacheEntry {
  bytes: number;
  fileCount: number;
  folderCount: number;
  pending: boolean;
  updatedAt: number;
}

export interface ExplorerPersistenceNotice {
  status:
    | "ready"
    | "legacy-imported"
    | "backup-restored"
    | "corrupted-reset"
    | "restored-backup"
    | "save-error";
  message: string | null;
  hasBackup: boolean;
}

export interface ExplorerChromeEditSession {
  themeId: string;
  layoutId: ExplorerChromeLayoutId;
  draftOverride: ExplorerChromeOverrideSnapshot;
  draggingControlId: ExplorerChromeControlId | null;
  highlightedDropTarget: {
    surfaceId: ExplorerChromeSurfaceId;
    zoneId: ExplorerChromeZoneId;
    targetIndex: number;
  } | null;
  selectedControlId: ExplorerChromeControlId | null;
  pendingHotkeyControlId: ExplorerChromeControlId | null;
  registeredSurfaces: Partial<
    Record<ExplorerChromeSurfaceId, ExplorerChromeResolvedSurface>
  >;
}

function createEmptyExplorerWorkspacePaneSlots(): Record<
  ExplorerPaneId,
  ExplorerWorkspacePaneSnapshot | null
> {
  return createEmptyExplorerPaneRecord<ExplorerWorkspacePaneSnapshot | null>(
    () => null,
  );
}

export const defaultExplorerWorkspace: ExplorerWorkspaceSnapshot = {
  tabs: [
    {
      id: PRIMARY_EXPLORER_TAB_ID,
      layoutMode: defaultExplorerWorkspaceLayoutMode,
      focusedPane: "pane-1",
      columnSplitRatio: defaultExplorerWorkspaceAxisRatio,
      rowSplitRatio: defaultExplorerWorkspaceAxisRatio,
      panes: {
        ...createEmptyExplorerWorkspacePaneSlots(),
        "pane-1": {
          instanceId: PRIMARY_EXPLORER_INSTANCE_ID,
          title: "Explorer",
        },
      },
    },
  ],
  activeWorkspaceTabId: PRIMARY_EXPLORER_TAB_ID,
  nextTabOrdinal: 2,
};

export const defaultExplorerSession: ExplorerSessionSnapshot = {
  currentPath: "",
  history: [],
  historyIdx: -1,
  sidebarWidth: null,
  previewWidth: null,
  actionsWidth: null,
  previewEnabled: true,
  previewLocked: false,
  previewSplitMode: "inline",
  shellLayoutId: "balanced",
  search: "",
  searchMode: "content",
  documentViewMode: "edit",
  sourcesVisible: true,
  actionsVisible: false,
  constellation: {
    activeLens: CONSTELLATION_DEFAULT_LENS,
    routeModeEnabled: false,
    pinnedPaths: [],
  },
};

const defaultExplorerPersistenceNotice: ExplorerPersistenceNotice = {
  status: "ready",
  message: null,
  hasBackup: false,
};

function cloneExplorerSessionSnapshot(
  session: ExplorerSessionSnapshot,
): ExplorerSessionSnapshot {
  return {
    ...session,
    history: [...session.history],
    constellation: {
      ...session.constellation,
      pinnedPaths: [...session.constellation.pinnedPaths],
    },
  };
}

function cloneExplorerWorkspacePaneSnapshot(
  pane: ExplorerWorkspacePaneSnapshot,
): ExplorerWorkspacePaneSnapshot {
  return {
    ...pane,
  };
}

function cloneExplorerWorkspacePaneRecord(
  panes: Record<ExplorerPaneId, ExplorerWorkspacePaneSnapshot | null>,
): Record<ExplorerPaneId, ExplorerWorkspacePaneSnapshot | null> {
  const nextPanes = createEmptyExplorerWorkspacePaneSlots();
  for (const paneId of explorerPaneIds) {
    const pane = panes[paneId];
    nextPanes[paneId] = pane ? cloneExplorerWorkspacePaneSnapshot(pane) : null;
  }
  return nextPanes;
}

function cloneExplorerWorkspaceTabSnapshot(
  tab: ExplorerWorkspaceTabSnapshot,
): ExplorerWorkspaceTabSnapshot {
  return {
    ...tab,
    panes: cloneExplorerWorkspacePaneRecord(tab.panes),
  };
}

function cloneExplorerWorkspaceSnapshot(
  workspace: ExplorerWorkspaceSnapshot,
): ExplorerWorkspaceSnapshot {
  return {
    ...workspace,
    tabs: workspace.tabs.map(cloneExplorerWorkspaceTabSnapshot),
  };
}

function createDefaultExplorerSessions(): Record<
  ExplorerInstanceId,
  ExplorerSessionSnapshot
> {
  return {
    [PRIMARY_EXPLORER_INSTANCE_ID]: cloneExplorerSessionSnapshot(
      defaultExplorerSession,
    ),
  };
}

function createDefaultExplorerWorkspace(): ExplorerWorkspaceSnapshot {
  return cloneExplorerWorkspaceSnapshot(defaultExplorerWorkspace);
}

function getPrimaryExplorerSession(
  sessions: Record<ExplorerInstanceId, ExplorerSessionSnapshot>,
): ExplorerSessionSnapshot {
  return (
    sessions[PRIMARY_EXPLORER_INSTANCE_ID] ??
    cloneExplorerSessionSnapshot(defaultExplorerSession)
  );
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
  jumpFilter: ExplorerJumpFilterSnapshot;
  propertiesPanel: ExplorerPropertiesPanelSnapshot;
  pendingTerminalCwdSync: ExplorerPendingTerminalCwdSync | null;
  pendingOpenRequest: ExplorerPendingOpenRequest | null;
  recursiveSizeCache: Record<string, ExplorerRecursiveSizeCacheEntry>;
  clipboard: ExplorerClipboardSnapshot | null;
  persistence: ExplorerPersistenceNotice;
  chromeEditSession: ExplorerChromeEditSession | null;
  chromeHotkeyCaptureControlId: ExplorerChromeControlId | null;
  getSession: (instanceId?: ExplorerInstanceId) => ExplorerSessionSnapshot;
  updateSession: (updates: Partial<ExplorerSessionSnapshot>) => void;
  updateSessionForInstance: (
    instanceId: ExplorerInstanceId,
    updates: Partial<ExplorerSessionSnapshot>,
  ) => void;
  resetSession: () => void;
  resetSessionForInstance: (instanceId: ExplorerInstanceId) => void;
  copySession: (
    sourceInstanceId: ExplorerInstanceId,
    targetInstanceId: ExplorerInstanceId,
  ) => void;
  createWorkspaceTab: (args?: {
    sourceWorkspaceTabId?: string;
    activate?: boolean;
  }) => ExplorerWorkspaceTabSnapshot;
  duplicateWorkspaceTab: (
    tabId?: string,
  ) => ExplorerWorkspaceTabSnapshot | null;
  closeWorkspaceTab: (tabId: string) => void;
  focusWorkspaceTab: (tabId: string) => void;
  updateWorkspaceTabTitle: (tabId: string, title: string) => void;
  setWorkspaceLayoutMode: (layoutMode: ExplorerWorkspaceLayoutMode) => void;
  setFocusedPane: (pane: ExplorerPaneId) => void;
  setWorkspaceColumnSplitRatio: (splitRatio: number) => void;
  setWorkspaceRowSplitRatio: (splitRatio: number) => void;
  setClipboard: (clipboard: ExplorerClipboardSnapshot | null) => void;
  updateRail: (
    updates:
      | Partial<ExplorerRailSnapshot>
      | ((current: ExplorerRailSnapshot) => ExplorerRailSnapshot),
  ) => void;
  replaceRail: (nextRail: ExplorerRailSnapshot) => void;
  restoreRailBackup: () => void;
  clearPersistenceNotice: () => void;
  setJumpFilter: (updates: Partial<ExplorerJumpFilterSnapshot> | null) => void;
  setPropertiesPanel: (
    updates: Partial<ExplorerPropertiesPanelSnapshot> | null,
  ) => void;
  setPendingTerminalCwdSync: (
    nextSync: ExplorerPendingTerminalCwdSync | null,
  ) => void;
  requestOpenInExplorer: (request: {
    directoryPath: string;
    selectionPath?: string | null;
    pushHistory?: boolean;
  }) => void;
  setRecursiveSizeCacheEntry: (
    path: string,
    entry: ExplorerRecursiveSizeCacheEntry | null,
  ) => void;
  openChromeEditSession: (args: {
    themeId: string;
    layoutId: ExplorerChromeLayoutId;
    initialOverride?: ExplorerChromeOverrideSnapshot | null;
  }) => void;
  updateChromeEditDraft: (
    draftOverride: ExplorerChromeOverrideSnapshot,
  ) => void;
  setChromeEditDraggingControl: (
    controlId: ExplorerChromeControlId | null,
  ) => void;
  setChromeEditHighlightedDropTarget: (
    target: {
      surfaceId: ExplorerChromeSurfaceId;
      zoneId: ExplorerChromeZoneId;
      targetIndex: number;
    } | null,
  ) => void;
  setChromeEditSelectedControl: (
    controlId: ExplorerChromeControlId | null,
  ) => void;
  setChromeEditPendingHotkeyControl: (
    controlId: ExplorerChromeControlId | null,
  ) => void;
  setChromeHotkeyCaptureControl: (
    controlId: ExplorerChromeControlId | null,
  ) => void;
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

export function normalizeExplorerSessionSnapshot(
  value: unknown,
): ExplorerSessionSnapshot {
  const source = asRecord(value);
  const history = Array.isArray(source?.history)
    ? source.history.filter(
        (entry): entry is string => typeof entry === "string",
      )
    : [];
  const historyIdxValue =
    typeof source?.historyIdx === "number" && Number.isFinite(source.historyIdx)
      ? Math.trunc(source.historyIdx)
      : -1;
  const normalizedShellLayoutId = getExplorerShellLayoutDefinition(
    source?.shellLayoutId,
  ).id;
  const legacyLayout = getExplorerShellLayoutDefinition(
    normalizedShellLayoutId,
  );
  const legacySourcesVisible =
    typeof source?.sourcesRailPinnedOpen === "boolean"
      ? source.sourcesRailPinnedOpen || legacyLayout.defaultSourcesVisible
      : legacyLayout.defaultSourcesVisible;
  const rawConstellation = asRecord(source?.constellation);
  const pinnedPaths = Array.isArray(rawConstellation?.pinnedPaths)
    ? rawConstellation.pinnedPaths
        .filter(
          (entry): entry is string =>
            typeof entry === "string" && entry.trim().length > 0,
        )
        .map((entry) => entry.trim())
        .filter(
          (entry, index, collection) => collection.indexOf(entry) === index,
        )
    : [...defaultExplorerSession.constellation.pinnedPaths];
  return {
    currentPath:
      typeof source?.currentPath === "string" ? source.currentPath : "",
    history,
    historyIdx: Math.max(-1, Math.min(history.length - 1, historyIdxValue)),
    sidebarWidth: normalizeOptionalNumber(source?.sidebarWidth),
    previewWidth: normalizeOptionalNumber(source?.previewWidth),
    actionsWidth: normalizeOptionalNumber(source?.actionsWidth),
    previewEnabled:
      typeof source?.previewEnabled === "boolean"
        ? source.previewEnabled
        : defaultExplorerSession.previewEnabled,
    previewLocked:
      typeof source?.previewLocked === "boolean"
        ? source.previewLocked
        : defaultExplorerSession.previewLocked,
    previewSplitMode: source?.previewSplitMode === "pane" ? "pane" : "inline",
    shellLayoutId: normalizedShellLayoutId,
    search: typeof source?.search === "string" ? source.search : "",
    searchMode: normalizeExplorerSearchMode(
      source?.searchMode,
      typeof source?.searchIncludeContent === "boolean"
        ? source.searchIncludeContent
        : defaultExplorerSession.searchMode === "content",
    ),
    documentViewMode:
      source?.documentViewMode === "preview" ? "preview" : "edit",
    sourcesVisible:
      typeof source?.sourcesVisible === "boolean"
        ? source.sourcesVisible
        : legacySourcesVisible,
    actionsVisible:
      typeof source?.actionsVisible === "boolean"
        ? source.actionsVisible
        : defaultExplorerSession.actionsVisible,
    constellation: {
      activeLens: normalizeConstellationLensId(rawConstellation?.activeLens),
      routeModeEnabled:
        typeof rawConstellation?.routeModeEnabled === "boolean"
          ? rawConstellation.routeModeEnabled
          : defaultExplorerSession.constellation.routeModeEnabled,
      pinnedPaths,
    },
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
        .map(
          ([instanceId, session]) =>
            [instanceId, normalizeExplorerSessionSnapshot(session)] as const,
        )
    : [];

  if (entries.length > 0) {
    const sessions = Object.fromEntries(entries);
    if (!sessions[PRIMARY_EXPLORER_INSTANCE_ID]) {
      sessions[PRIMARY_EXPLORER_INSTANCE_ID] =
        normalizeExplorerSessionSnapshot(legacyPrimarySession);
    }
    return sessions;
  }

  return {
    [PRIMARY_EXPLORER_INSTANCE_ID]:
      normalizeExplorerSessionSnapshot(legacyPrimarySession),
  };
}

interface LegacyExplorerTabSnapshot {
  id: string;
  instanceId: ExplorerInstanceId;
  pane: ExplorerPaneId;
  title: string;
}

function normalizeExplorerWorkspacePaneSnapshot(
  value: unknown,
  fallbackTitle: string,
): ExplorerWorkspacePaneSnapshot | null {
  const source = asRecord(value);
  const instanceId =
    typeof source?.instanceId === "string" &&
    source.instanceId.trim().length > 0
      ? source.instanceId.trim()
      : null;
  if (!instanceId) {
    return null;
  }
  return {
    instanceId,
    title:
      typeof source?.title === "string" && source.title.trim().length > 0
        ? source.title
        : fallbackTitle,
  };
}

function getFirstOccupiedExplorerPaneId(
  panes: Record<ExplorerPaneId, ExplorerWorkspacePaneSnapshot | null>,
  paneIds: ExplorerPaneId[] = explorerPaneIds,
): ExplorerPaneId | null {
  return paneIds.find((paneId) => panes[paneId] != null) ?? null;
}

function normalizeExplorerWorkspaceTabSnapshot(
  value: unknown,
  index: number,
): ExplorerWorkspaceTabSnapshot | null {
  const source = asRecord(value);
  if (!source) {
    return null;
  }

  const panes = createEmptyExplorerWorkspacePaneSlots();
  const rawPanes = asRecord(source.panes);
  for (const paneId of explorerPaneIds) {
    panes[paneId] = normalizeExplorerWorkspacePaneSnapshot(
      rawPanes?.[paneId],
      `Explorer ${index + 1}`,
    );
  }

  const firstOccupiedPaneId = getFirstOccupiedExplorerPaneId(panes);
  if (!firstOccupiedPaneId) {
    return null;
  }

  const layoutMode = normalizeExplorerWorkspaceLayoutMode(source.layoutMode);
  const visiblePaneIds = getExplorerWorkspaceVisiblePaneIds(layoutMode);
  const focusedPaneCandidate = normalizeExplorerPaneId(source.focusedPane);
  const focusedPane =
    visiblePaneIds.includes(focusedPaneCandidate) && panes[focusedPaneCandidate]
      ? focusedPaneCandidate
      : (getFirstOccupiedExplorerPaneId(panes, visiblePaneIds) ??
        firstOccupiedPaneId);

  return {
    id:
      typeof source.id === "string" && source.id.trim().length > 0
        ? source.id.trim()
        : `workspace-tab-${index + 1}`,
    layoutMode,
    focusedPane,
    columnSplitRatio: clampExplorerWorkspaceAxisRatio(
      source.columnSplitRatio ?? source.splitRatio,
    ),
    rowSplitRatio: clampExplorerWorkspaceAxisRatio(source.rowSplitRatio),
    panes,
  };
}

function normalizeLegacyExplorerTabSnapshots(
  rawTabs: unknown[],
  sessions: Record<ExplorerInstanceId, ExplorerSessionSnapshot>,
): LegacyExplorerTabSnapshot[] {
  const normalizedTabs = rawTabs
    .map((candidate, index): LegacyExplorerTabSnapshot | null => {
      const record = asRecord(candidate);
      if (!record) {
        return null;
      }
      const instanceId =
        typeof record.instanceId === "string" &&
        record.instanceId.trim().length > 0
          ? record.instanceId.trim()
          : null;
      if (!instanceId) {
        return null;
      }
      return {
        id:
          typeof record.id === "string" && record.id.trim().length > 0
            ? record.id.trim()
            : `legacy-tab-${index + 1}`,
        instanceId,
        pane: normalizeExplorerPaneId(record.pane),
        title:
          typeof record.title === "string" && record.title.trim().length > 0
            ? record.title
            : `Explorer ${index + 1}`,
      };
    })
    .filter((tab): tab is LegacyExplorerTabSnapshot => Boolean(tab));

  const dedupedTabs = normalizedTabs.filter(
    (tab, index, collection) =>
      collection.findIndex((candidate) => candidate.id === tab.id) === index,
  );
  const missingPrimaryTab = !dedupedTabs.some(
    (tab) => tab.instanceId === PRIMARY_EXPLORER_INSTANCE_ID,
  );
  if (missingPrimaryTab && sessions[PRIMARY_EXPLORER_INSTANCE_ID]) {
    dedupedTabs.unshift({
      id: PRIMARY_EXPLORER_TAB_ID,
      instanceId: PRIMARY_EXPLORER_INSTANCE_ID,
      pane: "pane-1",
      title: "Explorer",
    });
  }
  return dedupedTabs;
}

function migrateLegacyExplorerWorkspaceSnapshot(
  source: Record<string, unknown> | null,
  sessions: Record<ExplorerInstanceId, ExplorerSessionSnapshot>,
): ExplorerWorkspaceSnapshot {
  const legacyTabs = normalizeLegacyExplorerTabSnapshots(
    Array.isArray(source?.tabs) ? source.tabs : [],
    sessions,
  );
  if (legacyTabs.length === 0) {
    return createDefaultExplorerWorkspace();
  }

  const legacyLayoutMode = normalizeExplorerWorkspaceLayoutMode(
    source?.layoutMode,
  );
  const visiblePaneIds = getExplorerWorkspaceVisiblePaneIds(legacyLayoutMode);
  const activeSource = asRecord(source?.activeTabIdByPane);
  const activeTabIdByPane = createEmptyExplorerPaneRecord<string | null>(
    () => null,
  );
  for (const paneId of explorerPaneIds) {
    const paneTabs = legacyTabs.filter((tab) => tab.pane === paneId);
    const activeCandidate =
      typeof activeSource?.[paneId] === "string"
        ? activeSource[paneId]
        : paneId === "pane-1"
          ? typeof activeSource?.left === "string"
            ? activeSource.left
            : null
          : paneId === "pane-2"
            ? typeof activeSource?.right === "string"
              ? activeSource.right
              : null
            : null;
    activeTabIdByPane[paneId] = paneTabs.some(
      (tab) => tab.id === activeCandidate,
    )
      ? activeCandidate
      : (paneTabs[0]?.id ?? null);
  }

  const activeWorkspacePanes = createEmptyExplorerWorkspacePaneSlots();
  const consumedLegacyTabIds = new Set<string>();
  for (const paneId of visiblePaneIds) {
    const activeTabId = activeTabIdByPane[paneId];
    const activeLegacyTab = legacyTabs.find(
      (tab) => tab.pane === paneId && tab.id === activeTabId,
    );
    if (!activeLegacyTab) {
      continue;
    }
    activeWorkspacePanes[paneId] = {
      instanceId: activeLegacyTab.instanceId,
      title: activeLegacyTab.title,
    };
    consumedLegacyTabIds.add(activeLegacyTab.id);
  }

  if (
    !activeWorkspacePanes["pane-1"] &&
    sessions[PRIMARY_EXPLORER_INSTANCE_ID]
  ) {
    activeWorkspacePanes["pane-1"] = {
      instanceId: PRIMARY_EXPLORER_INSTANCE_ID,
      title: "Explorer",
    };
  }

  const focusedPaneCandidate = normalizeExplorerPaneId(source?.focusedPane);
  const focusedPane =
    visiblePaneIds.includes(focusedPaneCandidate) &&
    activeWorkspacePanes[focusedPaneCandidate]
      ? focusedPaneCandidate
      : (getFirstOccupiedExplorerPaneId(activeWorkspacePanes, visiblePaneIds) ??
        "pane-1");

  const migratedTabs: ExplorerWorkspaceTabSnapshot[] = [
    {
      id: PRIMARY_EXPLORER_TAB_ID,
      layoutMode: legacyLayoutMode,
      focusedPane,
      columnSplitRatio: clampExplorerWorkspaceAxisRatio(
        source?.columnSplitRatio ?? source?.splitRatio,
      ),
      rowSplitRatio: clampExplorerWorkspaceAxisRatio(source?.rowSplitRatio),
      panes: activeWorkspacePanes,
    },
  ];

  const remainingLegacyTabs = legacyTabs.filter(
    (tab) => !consumedLegacyTabIds.has(tab.id),
  );
  for (const legacyTab of remainingLegacyTabs) {
    migratedTabs.push({
      id: legacyTab.id,
      layoutMode: "single",
      focusedPane: "pane-1",
      columnSplitRatio: defaultExplorerWorkspaceAxisRatio,
      rowSplitRatio: defaultExplorerWorkspaceAxisRatio,
      panes: {
        ...createEmptyExplorerWorkspacePaneSlots(),
        "pane-1": {
          instanceId: legacyTab.instanceId,
          title: legacyTab.title,
        },
      },
    });
  }

  const nextTabOrdinalValue =
    typeof source?.nextTabOrdinal === "number" &&
    Number.isFinite(source.nextTabOrdinal)
      ? Math.max(Math.trunc(source.nextTabOrdinal), migratedTabs.length + 1)
      : migratedTabs.length + 1;

  return {
    tabs: migratedTabs,
    activeWorkspaceTabId: PRIMARY_EXPLORER_TAB_ID,
    nextTabOrdinal: nextTabOrdinalValue,
  };
}

function normalizeExplorerWorkspaceSnapshot(
  value: unknown,
  sessions: Record<ExplorerInstanceId, ExplorerSessionSnapshot>,
): ExplorerWorkspaceSnapshot {
  const source = asRecord(value);
  if (
    source &&
    Array.isArray(source.tabs) &&
    source.tabs.some((candidate) => Boolean(asRecord(candidate)?.instanceId))
  ) {
    return migrateLegacyExplorerWorkspaceSnapshot(source, sessions);
  }

  const normalizedTabs = (Array.isArray(source?.tabs) ? source.tabs : [])
    .map((candidate, index) =>
      normalizeExplorerWorkspaceTabSnapshot(candidate, index),
    )
    .filter((tab): tab is ExplorerWorkspaceTabSnapshot => Boolean(tab))
    .filter(
      (tab, index, collection) =>
        collection.findIndex((candidate) => candidate.id === tab.id) === index,
    );
  const tabs =
    normalizedTabs.length > 0
      ? normalizedTabs
      : createDefaultExplorerWorkspace().tabs;
  const activeWorkspaceTabId =
    typeof source?.activeWorkspaceTabId === "string" &&
    tabs.some((tab) => tab.id === source.activeWorkspaceTabId)
      ? source.activeWorkspaceTabId
      : (tabs[0]?.id ?? PRIMARY_EXPLORER_TAB_ID);
  const nextTabOrdinalValue =
    typeof source?.nextTabOrdinal === "number" &&
    Number.isFinite(source.nextTabOrdinal)
      ? Math.max(Math.trunc(source.nextTabOrdinal), tabs.length + 1)
      : tabs.length + 1;

  return {
    tabs,
    activeWorkspaceTabId,
    nextTabOrdinal: nextTabOrdinalValue,
  };
}

export function loadExplorerPersistedState(
  storage: Storage | null = getStorage(),
): ExplorerHydrationResult {
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
      const parsed = JSON.parse(
        primaryValue,
      ) as Partial<PersistedExplorerState>;
      const sessions = normalizeExplorerSessionsSnapshot(
        parsed.sessions,
        parsed.session,
      );
      const workspace = normalizeExplorerWorkspaceSnapshot(
        parsed.workspace,
        sessions,
      );
      return {
        sessions,
        session: getPrimaryExplorerSession(sessions),
        workspace,
        rail: normalizeExplorerRailSnapshot(parsed.rail),
        clipboard: null,
        persistence: {
          status: "ready",
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
            status: "backup-restored",
            message:
              "Explorer layout recovered from backup after a corrupted saved state.",
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
          status: "corrupted-reset",
          message:
            "Explorer layout was reset because the saved state could not be decoded.",
          hasBackup: false,
        },
      };
    }
  }

  const legacyValue = storage.getItem(EXPLORER_LEGACY_BOOKMARKS_KEY);
  if (legacyValue) {
    try {
      const legacyBookmarks = migrateLegacyExplorerBookmarks(
        JSON.parse(legacyValue),
      );
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
            status: "legacy-imported",
            message:
              "Legacy explorer bookmarks were imported into the new bookmark folders system.",
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
      status: "ready",
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
    const sessions = normalizeExplorerSessionsSnapshot(
      state.sessions,
      state.session,
    );
    const primarySession = getPrimaryExplorerSession(sessions);
    const workspace = normalizeExplorerWorkspaceSnapshot(
      state.workspace,
      sessions,
    );
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
  let pendingOpenSequence = 0;

  const persistLatest = (
    successNotice?: Partial<ExplorerPersistenceNotice>,
  ) => {
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
            status:
              successNotice?.status ??
              (state.persistence.status === "save-error"
                ? "ready"
                : state.persistence.status),
            message:
              successNotice?.message ??
              (successNotice?.status && successNotice.status !== "ready"
                ? state.persistence.message
                : null),
            hasBackup: result.hasBackup,
          }
        : {
            status: "save-error",
            message: `Explorer state could not be saved: ${result.error}`,
            hasBackup: result.hasBackup,
          },
    }));
  };

  const persistLatestNow = (
    successNotice?: Partial<ExplorerPersistenceNotice>,
  ) => {
    if (persistTimer !== null) {
      clearTimeout(persistTimer);
      persistTimer = null;
    }
    pendingNotice = undefined;
    persistLatest(successNotice);
  };

  const schedulePersistLatest = (
    successNotice?: Partial<ExplorerPersistenceNotice>,
  ) => {
    if (typeof window === "undefined") {
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
    if (typeof window === "undefined") {
      return;
    }
    const marker = "__overlayterm_explorer_persist_flush_installed__";
    const globalAny = globalThis as unknown as Record<string, unknown>;
    if (globalAny[marker]) {
      return;
    }
    globalAny[marker] = true;

    const flush = () => persistLatestNow();
    window.addEventListener("pagehide", flush);
    window.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") {
        flush();
      }
    });
  };

  installFlushListeners();

  const createExplorerInstanceId = () =>
    `explorer-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const createWorkspaceTabId = () =>
    `workspace-tab-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const getActiveWorkspaceTab = (
    workspace: ExplorerWorkspaceSnapshot = get().workspace,
  ): ExplorerWorkspaceTabSnapshot | null =>
    workspace.tabs.find((tab) => tab.id === workspace.activeWorkspaceTabId) ??
    workspace.tabs[0] ??
    null;
  const getPreferredWorkspacePaneId = (
    tab: ExplorerWorkspaceTabSnapshot,
  ): ExplorerPaneId => {
    const visiblePaneIds = getExplorerWorkspaceVisiblePaneIds(tab.layoutMode);
    if (
      visiblePaneIds.includes(tab.focusedPane) &&
      tab.panes[tab.focusedPane]
    ) {
      return tab.focusedPane;
    }
    return (
      getFirstOccupiedExplorerPaneId(tab.panes, visiblePaneIds) ??
      getFirstOccupiedExplorerPaneId(tab.panes) ??
      "pane-1"
    );
  };
  const cloneExplorerSessionEntry = (
    sessions: Record<ExplorerInstanceId, ExplorerSessionSnapshot>,
    sourceInstanceId: ExplorerInstanceId,
  ) => {
    const nextInstanceId = createExplorerInstanceId();
    return {
      instanceId: nextInstanceId,
      sessions: {
        ...sessions,
        [nextInstanceId]: cloneExplorerSessionSnapshot(
          sessions[sourceInstanceId] ??
            cloneExplorerSessionSnapshot(defaultExplorerSession),
        ),
      },
    };
  };
  const ensureWorkspaceTabVisiblePanes = (args: {
    tab: ExplorerWorkspaceTabSnapshot;
    sessions: Record<ExplorerInstanceId, ExplorerSessionSnapshot>;
    layoutMode: ExplorerWorkspaceLayoutMode;
  }) => {
    const nextTab = cloneExplorerWorkspaceTabSnapshot({
      ...args.tab,
      layoutMode: args.layoutMode,
    });
    let nextSessions = args.sessions;
    const sourcePaneId = getPreferredWorkspacePaneId(nextTab);
    const sourcePane = nextTab.panes[sourcePaneId];
    const sourceInstanceId =
      sourcePane?.instanceId ?? PRIMARY_EXPLORER_INSTANCE_ID;
    const sourceTitle = sourcePane?.title ?? "Explorer";
    for (const paneId of getExplorerWorkspaceVisiblePaneIds(args.layoutMode)) {
      if (!nextTab.panes[paneId]) {
        const clonedSession = cloneExplorerSessionEntry(
          nextSessions,
          sourceInstanceId,
        );
        nextSessions = clonedSession.sessions;
        nextTab.panes[paneId] = {
          instanceId: clonedSession.instanceId,
          title: sourceTitle,
        };
      }
    }
    const visiblePaneIds = getExplorerWorkspaceVisiblePaneIds(
      nextTab.layoutMode,
    );
    if (
      !visiblePaneIds.includes(nextTab.focusedPane) ||
      !nextTab.panes[nextTab.focusedPane]
    ) {
      nextTab.focusedPane =
        getFirstOccupiedExplorerPaneId(nextTab.panes, visiblePaneIds) ??
        visiblePaneIds[0] ??
        "pane-1";
    }
    return {
      tab: nextTab,
      sessions: nextSessions,
    };
  };
  const collectReferencedExplorerInstanceIds = (
    workspace: ExplorerWorkspaceSnapshot,
  ) => {
    const referencedInstanceIds = new Set<ExplorerInstanceId>();
    for (const tab of workspace.tabs) {
      for (const paneId of explorerPaneIds) {
        const pane = tab.panes[paneId];
        if (pane) {
          referencedInstanceIds.add(pane.instanceId);
        }
      }
    }
    return referencedInstanceIds;
  };

  return {
    sessions: hydratedState.sessions,
    session: hydratedState.session,
    workspace: hydratedState.workspace,
    rail: hydratedState.rail,
    jumpFilter: {
      active: false,
      query: "",
      resultIndex: -1,
      resultPaths: [],
    },
    propertiesPanel: {
      loading: false,
      targetPaths: [],
      tab: "info",
      visible: false,
    },
    pendingTerminalCwdSync: null,
    pendingOpenRequest: null,
    recursiveSizeCache: {},
    clipboard: hydratedState.clipboard,
    persistence: hydratedState.persistence,
    chromeEditSession: null,
    chromeHotkeyCaptureControlId: null,
    getSession: (instanceId = PRIMARY_EXPLORER_INSTANCE_ID) =>
      get().sessions[instanceId] ??
      cloneExplorerSessionSnapshot(defaultExplorerSession),
    updateSession: (updates) => {
      const current =
        get().sessions[PRIMARY_EXPLORER_INSTANCE_ID] ??
        cloneExplorerSessionSnapshot(defaultExplorerSession);
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
      schedulePersistLatest(
        hydratedState.persistence.status === "legacy-imported"
          ? { status: "ready", message: null }
          : undefined,
      );
    },
    updateSessionForInstance: (instanceId, updates) => {
      const normalizedInstanceId =
        instanceId.trim() || PRIMARY_EXPLORER_INSTANCE_ID;
      const current =
        get().sessions[normalizedInstanceId] ??
        cloneExplorerSessionSnapshot(defaultExplorerSession);
      const nextSession = normalizeExplorerSessionSnapshot({
        ...current,
        ...updates,
      });
      set((state) => ({
        sessions: {
          ...state.sessions,
          [normalizedInstanceId]: nextSession,
        },
        session:
          normalizedInstanceId === PRIMARY_EXPLORER_INSTANCE_ID
            ? nextSession
            : state.session,
      }));
      schedulePersistLatest(
        hydratedState.persistence.status === "legacy-imported"
          ? { status: "ready", message: null }
          : undefined,
      );
    },
    resetSession: () => {
      const sessions = createDefaultExplorerSessions();
      set({
        sessions,
        session: getPrimaryExplorerSession(sessions),
        workspace: createDefaultExplorerWorkspace(),
        pendingOpenRequest: null,
      });
      schedulePersistLatest();
    },
    resetSessionForInstance: (instanceId) => {
      const normalizedInstanceId =
        instanceId.trim() || PRIMARY_EXPLORER_INSTANCE_ID;
      const nextSession = cloneExplorerSessionSnapshot(defaultExplorerSession);
      set((state) => ({
        sessions: {
          ...state.sessions,
          [normalizedInstanceId]: nextSession,
        },
        session:
          normalizedInstanceId === PRIMARY_EXPLORER_INSTANCE_ID
            ? nextSession
            : state.session,
      }));
      schedulePersistLatest();
    },
    copySession: (sourceInstanceId, targetInstanceId) => {
      const sourceId = sourceInstanceId.trim() || PRIMARY_EXPLORER_INSTANCE_ID;
      const targetId = targetInstanceId.trim() || PRIMARY_EXPLORER_INSTANCE_ID;
      const sourceSession =
        get().sessions[sourceId] ??
        cloneExplorerSessionSnapshot(defaultExplorerSession);
      const nextSession = cloneExplorerSessionSnapshot(sourceSession);
      set((state) => ({
        sessions: {
          ...state.sessions,
          [targetId]: nextSession,
        },
        session:
          targetId === PRIMARY_EXPLORER_INSTANCE_ID
            ? nextSession
            : state.session,
      }));
      schedulePersistLatest(
        hydratedState.persistence.status === "legacy-imported"
          ? { status: "ready", message: null }
          : undefined,
      );
    },
    createWorkspaceTab: (args = {}) => {
      const workspace = get().workspace;
      const sourceWorkspaceTab = args.sourceWorkspaceTabId
        ? workspace.tabs.find((tab) => tab.id === args.sourceWorkspaceTabId)
        : getActiveWorkspaceTab(workspace);
      const sourcePaneId = sourceWorkspaceTab
        ? getPreferredWorkspacePaneId(sourceWorkspaceTab)
        : "pane-1";
      const sourcePane = sourceWorkspaceTab?.panes[sourcePaneId];
      const clonedSession = cloneExplorerSessionEntry(
        get().sessions,
        sourcePane?.instanceId ?? PRIMARY_EXPLORER_INSTANCE_ID,
      );
      const nextTab: ExplorerWorkspaceTabSnapshot = {
        id: createWorkspaceTabId(),
        layoutMode: "single",
        focusedPane: "pane-1",
        columnSplitRatio: defaultExplorerWorkspaceAxisRatio,
        rowSplitRatio: defaultExplorerWorkspaceAxisRatio,
        panes: {
          ...createEmptyExplorerWorkspacePaneSlots(),
          "pane-1": {
            instanceId: clonedSession.instanceId,
            title: sourcePane?.title ?? `Explorer ${workspace.nextTabOrdinal}`,
          },
        },
      };
      set((state) => {
        const nextSessions = {
          ...state.sessions,
          ...clonedSession.sessions,
        };
        const nextWorkspace = normalizeExplorerWorkspaceSnapshot(
          {
            ...state.workspace,
            tabs: [...state.workspace.tabs, nextTab],
            activeWorkspaceTabId:
              args.activate === false
                ? state.workspace.activeWorkspaceTabId
                : nextTab.id,
            nextTabOrdinal: state.workspace.nextTabOrdinal + 1,
          },
          nextSessions,
        );
        return {
          sessions: nextSessions,
          workspace: nextWorkspace,
        };
      });
      schedulePersistLatest();
      return nextTab;
    },
    duplicateWorkspaceTab: (tabId) => {
      const workspace = get().workspace;
      const sourceTab = tabId
        ? workspace.tabs.find((candidate) => candidate.id === tabId)
        : getActiveWorkspaceTab(workspace);
      if (!sourceTab) {
        return null;
      }

      let nextSessions = get().sessions;
      const nextPanes = createEmptyExplorerWorkspacePaneSlots();
      for (const paneId of explorerPaneIds) {
        const sourcePane = sourceTab.panes[paneId];
        if (!sourcePane) {
          continue;
        }
        const clonedSession = cloneExplorerSessionEntry(
          nextSessions,
          sourcePane.instanceId,
        );
        nextSessions = clonedSession.sessions;
        nextPanes[paneId] = {
          instanceId: clonedSession.instanceId,
          title: sourcePane.title,
        };
      }

      const nextTab: ExplorerWorkspaceTabSnapshot = {
        id: createWorkspaceTabId(),
        layoutMode: sourceTab.layoutMode,
        focusedPane: sourceTab.focusedPane,
        columnSplitRatio: sourceTab.columnSplitRatio,
        rowSplitRatio: sourceTab.rowSplitRatio,
        panes: nextPanes,
      };

      set((state) => ({
        sessions: nextSessions,
        workspace: normalizeExplorerWorkspaceSnapshot(
          {
            ...state.workspace,
            tabs: [...state.workspace.tabs, nextTab],
            activeWorkspaceTabId: nextTab.id,
            nextTabOrdinal: state.workspace.nextTabOrdinal + 1,
          },
          nextSessions,
        ),
      }));
      schedulePersistLatest();
      return nextTab;
    },
    closeWorkspaceTab: (tabId) => {
      const workspace = get().workspace;
      if (workspace.tabs.length <= 1) {
        return;
      }
      const tabIndex = workspace.tabs.findIndex(
        (candidate) => candidate.id === tabId,
      );
      if (tabIndex === -1) {
        return;
      }
      const nextTabs = workspace.tabs.filter(
        (candidate) => candidate.id !== tabId,
      );
      const nextActiveWorkspaceTabId =
        workspace.activeWorkspaceTabId === tabId
          ? (nextTabs[Math.min(tabIndex, nextTabs.length - 1)]?.id ??
            nextTabs[0]?.id ??
            PRIMARY_EXPLORER_TAB_ID)
          : workspace.activeWorkspaceTabId;
      set((state) => {
        const nextWorkspace = normalizeExplorerWorkspaceSnapshot(
          {
            ...state.workspace,
            tabs: nextTabs,
            activeWorkspaceTabId: nextActiveWorkspaceTabId,
          },
          state.sessions,
        );
        const referencedInstanceIds =
          collectReferencedExplorerInstanceIds(nextWorkspace);
        const nextSessions = Object.fromEntries(
          Object.entries(state.sessions).filter(
            ([instanceId]) =>
              instanceId === PRIMARY_EXPLORER_INSTANCE_ID ||
              referencedInstanceIds.has(instanceId),
          ),
        );
        return {
          sessions: nextSessions,
          session: getPrimaryExplorerSession(nextSessions),
          workspace: normalizeExplorerWorkspaceSnapshot(
            nextWorkspace,
            nextSessions,
          ),
        };
      });
      schedulePersistLatest();
    },
    focusWorkspaceTab: (tabId) => {
      const workspace = get().workspace;
      if (!workspace.tabs.some((candidate) => candidate.id === tabId)) {
        return;
      }
      set((state) => ({
        workspace: normalizeExplorerWorkspaceSnapshot(
          {
            ...state.workspace,
            activeWorkspaceTabId: tabId,
          },
          state.sessions,
        ),
      }));
      schedulePersistLatest();
    },
    updateWorkspaceTabTitle: (tabId, title) => {
      const trimmedTitle = title.trim();
      if (!trimmedTitle) {
        return;
      }
      set((state) => ({
        workspace: normalizeExplorerWorkspaceSnapshot(
          {
            ...state.workspace,
            tabs: state.workspace.tabs.map((tab) =>
              tab.id === tabId
                ? {
                    ...tab,
                    panes: {
                      ...tab.panes,
                      [tab.focusedPane]: tab.panes[tab.focusedPane]
                        ? {
                            ...tab.panes[tab.focusedPane],
                            title: trimmedTitle,
                          }
                        : tab.panes[tab.focusedPane],
                    },
                  }
                : tab,
            ),
          },
          state.sessions,
        ),
      }));
      schedulePersistLatest();
    },
    setWorkspaceLayoutMode: (layoutMode) => {
      set((state) => {
        const activeTab = getActiveWorkspaceTab(state.workspace);
        if (!activeTab) {
          return state;
        }
        const ensured = ensureWorkspaceTabVisiblePanes({
          tab: activeTab,
          sessions: state.sessions,
          layoutMode,
        });
        return {
          sessions: ensured.sessions,
          workspace: normalizeExplorerWorkspaceSnapshot(
            {
              ...state.workspace,
              tabs: state.workspace.tabs.map((tab) =>
                tab.id === activeTab.id ? ensured.tab : tab,
              ),
            },
            ensured.sessions,
          ),
        };
      });
      schedulePersistLatest();
    },
    setFocusedPane: (pane) => {
      set((state) => {
        const activeTab = getActiveWorkspaceTab(state.workspace);
        if (!activeTab) {
          return state;
        }
        const nextFocusedPane = normalizeExplorerPaneId(pane);
        const visiblePaneIds = getExplorerWorkspaceVisiblePaneIds(
          activeTab.layoutMode,
        );
        if (
          !visiblePaneIds.includes(nextFocusedPane) ||
          !activeTab.panes[nextFocusedPane]
        ) {
          return state;
        }
        return {
          workspace: normalizeExplorerWorkspaceSnapshot(
            {
              ...state.workspace,
              tabs: state.workspace.tabs.map((tab) =>
                tab.id === activeTab.id
                  ? { ...tab, focusedPane: nextFocusedPane }
                  : tab,
              ),
            },
            state.sessions,
          ),
        };
      });
      schedulePersistLatest();
    },
    setWorkspaceColumnSplitRatio: (splitRatio) => {
      set((state) => {
        const activeTab = getActiveWorkspaceTab(state.workspace);
        if (!activeTab) {
          return state;
        }
        return {
          workspace: normalizeExplorerWorkspaceSnapshot(
            {
              ...state.workspace,
              tabs: state.workspace.tabs.map((tab) =>
                tab.id === activeTab.id
                  ? {
                      ...tab,
                      columnSplitRatio:
                        clampExplorerWorkspaceAxisRatio(splitRatio),
                    }
                  : tab,
              ),
            },
            state.sessions,
          ),
        };
      });
      schedulePersistLatest();
    },
    setWorkspaceRowSplitRatio: (splitRatio) => {
      set((state) => {
        const activeTab = getActiveWorkspaceTab(state.workspace);
        if (!activeTab) {
          return state;
        }
        return {
          workspace: normalizeExplorerWorkspaceSnapshot(
            {
              ...state.workspace,
              tabs: state.workspace.tabs.map((tab) =>
                tab.id === activeTab.id
                  ? {
                      ...tab,
                      rowSplitRatio:
                        clampExplorerWorkspaceAxisRatio(splitRatio),
                    }
                  : tab,
              ),
            },
            state.sessions,
          ),
        };
      });
      schedulePersistLatest();
    },
    setClipboard: (clipboard) => {
      set({ clipboard });
    },
    setJumpFilter: (updates) => {
      if (updates === null) {
        set({
          jumpFilter: {
            active: false,
            query: "",
            resultIndex: -1,
            resultPaths: [],
          },
        });
        return;
      }

      set((state) => ({
        jumpFilter: {
          ...state.jumpFilter,
          ...updates,
        },
      }));
    },
    setPropertiesPanel: (updates) => {
      if (updates === null) {
        set({
          propertiesPanel: {
            loading: false,
            targetPaths: [],
            tab: "info",
            visible: false,
          },
        });
        return;
      }

      set((state) => ({
        propertiesPanel: {
          ...state.propertiesPanel,
          ...updates,
        },
      }));
    },
    setPendingTerminalCwdSync: (nextSync) => {
      set({ pendingTerminalCwdSync: nextSync });
    },
    requestOpenInExplorer: (request) => {
      const directoryPath = request.directoryPath.trim();
      if (!directoryPath) {
        return;
      }

      pendingOpenSequence += 1;
      set({
        pendingOpenRequest: {
          sequence: pendingOpenSequence,
          directoryPath,
          selectionPath: request.selectionPath?.trim() || null,
          pushHistory: request.pushHistory ?? true,
        },
      });
    },
    setRecursiveSizeCacheEntry: (path, entry) => {
      const normalizedPath = path.trim();
      if (!normalizedPath) {
        return;
      }

      set((state) => {
        const nextCache = { ...state.recursiveSizeCache };
        if (entry === null) {
          delete nextCache[normalizedPath];
        } else {
          nextCache[normalizedPath] = entry;
        }
        return { recursiveSizeCache: nextCache };
      });
    },
    updateRail: (updates) => {
      set((state) => ({
        rail: normalizeExplorerRailSnapshot(
          typeof updates === "function"
            ? updates(state.rail)
            : { ...state.rail, ...updates },
        ),
      }));
      schedulePersistLatest(
        hydratedState.persistence.status === "legacy-imported"
          ? { status: "ready", message: null }
          : undefined,
      );
    },
    replaceRail: (nextRail) => {
      set({
        rail: normalizeExplorerRailSnapshot(nextRail),
      });
      schedulePersistLatest(
        hydratedState.persistence.status === "legacy-imported"
          ? { status: "ready", message: null }
          : undefined,
      );
    },
    restoreRailBackup: () => {
      const backup = loadExplorerBackup();
      if (!backup) {
        set((state) => ({
          persistence: {
            ...state.persistence,
            status: "save-error",
            message: "Explorer backup was not available.",
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
        status: "restored-backup",
        message: "Explorer layout restored from the last known good backup.",
      });
    },
    clearPersistenceNotice: () => {
      set((state) => ({
        persistence: {
          ...state.persistence,
          status: "ready",
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
          draftOverride:
            normalizeExplorerChromeOverrideSnapshot(initialOverride),
          draggingControlId: null,
          highlightedDropTarget: null,
          selectedControlId: null,
          pendingHotkeyControlId: null,
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
            draftOverride:
              normalizeExplorerChromeOverrideSnapshot(draftOverride),
            draggingControlId: null,
            highlightedDropTarget: null,
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
    setChromeEditHighlightedDropTarget: (target) => {
      set((state) => {
        if (!state.chromeEditSession) {
          return state;
        }

        return {
          chromeEditSession: {
            ...state.chromeEditSession,
            highlightedDropTarget: target,
          },
        };
      });
    },
    setChromeEditSelectedControl: (controlId) => {
      set((state) => {
        if (!state.chromeEditSession) {
          return state;
        }

        return {
          chromeEditSession: {
            ...state.chromeEditSession,
            selectedControlId: controlId,
          },
        };
      });
    },
    setChromeEditPendingHotkeyControl: (controlId) => {
      set((state) => {
        if (!state.chromeEditSession) {
          return state;
        }

        return {
          chromeEditSession: {
            ...state.chromeEditSession,
            pendingHotkeyControlId: controlId,
          },
        };
      });
    },
    setChromeHotkeyCaptureControl: (controlId) => {
      set({ chromeHotkeyCaptureControlId: controlId });
    },
    registerChromeEditSurface: (surface) => {
      set((state) => {
        if (!state.chromeEditSession) {
          return state;
        }

        const existingSurface =
          state.chromeEditSession.registeredSurfaces[surface.surfaceId];
        if (
          existingSurface &&
          getExplorerChromeResolvedSurfaceSignature(existingSurface) ===
            getExplorerChromeResolvedSurfaceSignature(surface)
        ) {
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

        if (!state.chromeEditSession.registeredSurfaces[surfaceId]) {
          return state;
        }

        const nextRegisteredSurfaces = {
          ...state.chromeEditSession.registeredSurfaces,
        };
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
      set({
        chromeEditSession: null,
        chromeHotkeyCaptureControlId: null,
      });
    },
  };
});

installExplorerStorageSync();

function loadExplorerBackup(
  storage: Storage | null = getStorage(),
): Omit<ExplorerHydrationResult, "persistence"> | null {
  if (!storage) {
    return null;
  }

  const backupValue = storage.getItem(EXPLORER_STATE_BACKUP_KEY);
  if (!backupValue) {
    return null;
  }

  try {
    const parsed = JSON.parse(backupValue) as Partial<PersistedExplorerState>;
    const sessions = normalizeExplorerSessionsSnapshot(
      parsed.sessions,
      parsed.session,
    );
    const workspace = normalizeExplorerWorkspaceSnapshot(
      parsed.workspace,
      sessions,
    );
    return {
      sessions,
      session: getPrimaryExplorerSession(sessions),
      workspace,
      rail: normalizeExplorerRailSnapshot(parsed.rail),
      clipboard: null,
    };
  } catch {
    return null;
  }
}

function normalizeOptionalNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function getStorage(): Storage | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}

function installExplorerStorageSync(): void {
  if (typeof window === "undefined") {
    return;
  }

  const marker = "__greeblefs_explorer_storage_sync_installed__";
  const globalState = globalThis as typeof globalThis & Record<string, unknown>;
  if (globalState[marker]) {
    return;
  }
  globalState[marker] = true;

  window.addEventListener("storage", (event) => {
    if (
      event.key !== null &&
      event.key !== EXPLORER_STATE_STORAGE_KEY &&
      event.key !== EXPLORER_STATE_BACKUP_KEY &&
      event.key !== EXPLORER_LEGACY_BOOKMARKS_KEY
    ) {
      return;
    }

    const nextHydratedState = loadExplorerPersistedState();
    useExplorerStore.setState((state) => ({
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
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}
