import { beforeEach, describe, expect, it } from 'vitest';
import {
  EXPLORER_LEGACY_BOOKMARKS_KEY,
  EXPLORER_STATE_BACKUP_KEY,
  EXPLORER_STATE_STORAGE_KEY,
  EXPLORER_STATE_VERSION,
  PRIMARY_EXPLORER_TAB_ID,
  PRIMARY_EXPLORER_INSTANCE_ID,
  defaultExplorerWorkspace,
  defaultExplorerSession,
  loadExplorerPersistedState,
  persistExplorerState,
  useExplorerStore,
} from '../store/explorerStore';
import { createDefaultExplorerRailSnapshot, createExplorerBookmarkFolder } from '../components/explorer/explorerRailState';

beforeEach(() => {
  window.localStorage.clear();
  useExplorerStore.getState().resetSession();
  useExplorerStore.getState().replaceRail(createDefaultExplorerRailSnapshot());
  useExplorerStore.getState().clearPersistenceNotice();
});

function getActiveWorkspaceTab() {
  const { workspace } = useExplorerStore.getState();
  return workspace.tabs.find((tab) => tab.id === workspace.activeWorkspaceTabId) ?? workspace.tabs[0] ?? null;
}

describe('explorerStore persistence', () => {
  it('starts with the default explorer session snapshot', () => {
    expect(useExplorerStore.getState().session).toEqual(defaultExplorerSession);
    expect(useExplorerStore.getState().sessions[PRIMARY_EXPLORER_INSTANCE_ID]).toEqual(defaultExplorerSession);
    expect(useExplorerStore.getState().workspace).toEqual(defaultExplorerWorkspace);
    expect(useExplorerStore.getState().rail).toEqual(createDefaultExplorerRailSnapshot());
  });

  it('persists session and rail updates together', () => {
    const folderResult = createExplorerBookmarkFolder(createDefaultExplorerRailSnapshot(), { name: 'Work' });
    const store = useExplorerStore.getState();

    store.updateSession({
      currentPath: 'M:\\OverlayTerm\\src',
      history: ['M:\\OverlayTerm', 'M:\\OverlayTerm\\src'],
      historyIdx: 1,
      sidebarWidth: 244,
      previewWidth: 420,
      previewEnabled: false,
      shellLayoutId: 'inspector',
      documentViewMode: 'preview',
    });
    store.replaceRail(folderResult.snapshot);

    const hydrated = loadExplorerPersistedState(window.localStorage);
    expect(hydrated.session.currentPath).toBe('M:\\OverlayTerm\\src');
    expect(hydrated.sessions[PRIMARY_EXPLORER_INSTANCE_ID]?.currentPath).toBe('M:\\OverlayTerm\\src');
    expect(hydrated.session.sidebarWidth).toBe(244);
    expect(hydrated.session.previewEnabled).toBe(false);
    expect(hydrated.session.shellLayoutId).toBe('inspector');
    expect(hydrated.session.documentViewMode).toBe('preview');
    expect(hydrated.workspace.tabs[0]?.id).toBe(PRIMARY_EXPLORER_TAB_ID);
    expect(hydrated.rail.nodes).toHaveLength(1);
    expect(hydrated.rail.nodes[0].kind).toBe('folder');
  });

  it('migrates legacy bookmark payloads into the new rail snapshot', () => {
    window.localStorage.clear();
    window.localStorage.setItem(EXPLORER_LEGACY_BOOKMARKS_KEY, JSON.stringify([
      { name: 'OverlayTerm', path: 'M:\\OverlayTerm' },
    ]));

    const hydrated = loadExplorerPersistedState(window.localStorage);
    expect(hydrated.persistence.status).toBe('legacy-imported');
    expect(hydrated.rail.nodes).toHaveLength(1);
    expect(hydrated.rail.nodes[0]).toMatchObject({
      kind: 'bookmark',
      name: 'OverlayTerm',
      path: 'M:\\OverlayTerm',
    });
  });

  it('recovers from a corrupted primary state using the backup snapshot', () => {
    persistExplorerState({
      version: 3,
      session: {
        ...defaultExplorerSession,
        currentPath: 'M:\\Recovered',
      },
      rail: createDefaultExplorerRailSnapshot(),
    }, window.localStorage);

    const saved = window.localStorage.getItem(EXPLORER_STATE_STORAGE_KEY);
    expect(saved).toBeTruthy();
    window.localStorage.setItem(EXPLORER_STATE_BACKUP_KEY, saved ?? '');
    window.localStorage.setItem(EXPLORER_STATE_STORAGE_KEY, '{not-valid-json');

    const hydrated = loadExplorerPersistedState(window.localStorage);
    expect(hydrated.persistence.status).toBe('backup-restored');
    expect(hydrated.session.currentPath).toBe('M:\\Recovered');
  });

  it('restores the rail from backup through the store action', () => {
    persistExplorerState({
      version: 3,
      session: {
        ...defaultExplorerSession,
        currentPath: 'M:\\Backup',
      },
      rail: createDefaultExplorerRailSnapshot(),
    }, window.localStorage);

    const initialPayload = window.localStorage.getItem(EXPLORER_STATE_STORAGE_KEY);
    window.localStorage.setItem(EXPLORER_STATE_BACKUP_KEY, initialPayload ?? '');

    useExplorerStore.getState().updateSession({ currentPath: 'M:\\Dirty' });
    expect(useExplorerStore.getState().session.currentPath).toBe('M:\\Dirty');

    useExplorerStore.getState().restoreRailBackup();
    expect(useExplorerStore.getState().session.currentPath).toBe('M:\\Backup');
    expect(useExplorerStore.getState().persistence.status).toBe('restored-backup');
  });

  it('persists named explorer sessions independently', () => {
    const store = useExplorerStore.getState();
    const compactExplorerInstanceId = 'compact-overlay';
    const workspaceExplorerInstanceId = 'workspace-secondary';

    store.updateSessionForInstance(compactExplorerInstanceId, {
      currentPath: 'M:\\Drawer',
      search: 'props',
      sourcesVisible: false,
    });
    store.copySession(compactExplorerInstanceId, workspaceExplorerInstanceId);
    store.updateSessionForInstance(workspaceExplorerInstanceId, {
      currentPath: 'M:\\Dock',
      search: 'materials',
    });

    const hydrated = loadExplorerPersistedState(window.localStorage);
    expect(hydrated.sessions[compactExplorerInstanceId]).toMatchObject({
      currentPath: 'M:\\Drawer',
      search: 'props',
      sourcesVisible: false,
    });
    expect(hydrated.sessions[workspaceExplorerInstanceId]).toMatchObject({
      currentPath: 'M:\\Dock',
      search: 'materials',
      sourcesVisible: false,
    });
  });

  it('hydrates legacy sources rail state and re-persists without the removed field', () => {
    const legacyFocusSession = {
      ...defaultExplorerSession,
      shellLayoutId: 'focus',
      sourcesVisible: true,
      sourcesRailPinnedOpen: true,
    };

    persistExplorerState({
      version: 6,
      session: legacyFocusSession as typeof defaultExplorerSession,
      sessions: {
        [PRIMARY_EXPLORER_INSTANCE_ID]: legacyFocusSession as typeof defaultExplorerSession,
      },
      workspace: defaultExplorerWorkspace,
      rail: createDefaultExplorerRailSnapshot(),
    }, window.localStorage);

    const hydrated = loadExplorerPersistedState(window.localStorage);
    expect(hydrated.session.sourcesVisible).toBe(true);
    expect(
      Object.prototype.hasOwnProperty.call(
        hydrated.session as unknown as Record<string, unknown>,
        'sourcesRailPinnedOpen',
      ),
    ).toBe(false);

    persistExplorerState({
      version: EXPLORER_STATE_VERSION,
      session: hydrated.session,
      sessions: hydrated.sessions,
      workspace: hydrated.workspace,
      rail: hydrated.rail,
    }, window.localStorage);

    const reparsed = JSON.parse(
      window.localStorage.getItem(EXPLORER_STATE_STORAGE_KEY) ?? '{}',
    ) as {
      session?: Record<string, unknown>;
      sessions?: Record<string, Record<string, unknown>>;
    };

    expect(reparsed.session?.sourcesRailPinnedOpen).toBeUndefined();
    expect(
      reparsed.sessions?.[PRIMARY_EXPLORER_INSTANCE_ID]?.sourcesRailPinnedOpen,
    ).toBeUndefined();
  });

  it('migrates legacy searchIncludeContent into the persisted searchMode field', () => {
    const { searchMode: _searchMode, ...legacySessionBase } = defaultExplorerSession;
    const secondaryInstanceId = 'secondary';

    const legacyPersistedState = {
      version: 7,
      session: {
        ...legacySessionBase,
        search: 'needle',
        searchIncludeContent: false,
      },
      sessions: {
        [PRIMARY_EXPLORER_INSTANCE_ID]: {
          ...legacySessionBase,
          search: 'needle',
          searchIncludeContent: true,
        },
        [secondaryInstanceId]: {
          ...legacySessionBase,
          search: 'secondary needle',
          searchIncludeContent: false,
        },
      },
      workspace: defaultExplorerWorkspace,
      rail: createDefaultExplorerRailSnapshot(),
    };

    persistExplorerState(
      legacyPersistedState as unknown as Parameters<typeof persistExplorerState>[0],
      window.localStorage,
    );

    const hydrated = loadExplorerPersistedState(window.localStorage);
    expect(hydrated.sessions[PRIMARY_EXPLORER_INSTANCE_ID]?.searchMode).toBe('content');
    expect(hydrated.session.searchMode).toBe('content');
    expect(hydrated.sessions[secondaryInstanceId]?.searchMode).toBe('name');

    persistExplorerState({
      version: EXPLORER_STATE_VERSION,
      session: hydrated.session,
      sessions: hydrated.sessions,
      workspace: hydrated.workspace,
      rail: hydrated.rail,
    }, window.localStorage);

    const reparsed = JSON.parse(
      window.localStorage.getItem(EXPLORER_STATE_STORAGE_KEY) ?? '{}',
    ) as {
      session?: Record<string, unknown>;
      sessions?: Record<string, Record<string, unknown>>;
    };

    expect(reparsed.session?.searchIncludeContent).toBeUndefined();
    expect(reparsed.session?.searchMode).toBe('content');
    expect(
      reparsed.sessions?.[PRIMARY_EXPLORER_INSTANCE_ID]?.searchIncludeContent,
    ).toBeUndefined();
    expect(reparsed.sessions?.[PRIMARY_EXPLORER_INSTANCE_ID]?.searchMode).toBe('content');
    expect(reparsed.sessions?.[secondaryInstanceId]?.searchIncludeContent).toBeUndefined();
    expect(reparsed.sessions?.[secondaryInstanceId]?.searchMode).toBe('name');
  });

  it('migrates legacy pane-local tabs into workspace-owned tabs', () => {
    window.localStorage.setItem(EXPLORER_STATE_STORAGE_KEY, JSON.stringify({
      version: 8,
      session: defaultExplorerSession,
      sessions: {
        [PRIMARY_EXPLORER_INSTANCE_ID]: {
          ...defaultExplorerSession,
          currentPath: 'C:\\primary',
        },
        secondary: {
          ...defaultExplorerSession,
          currentPath: 'C:\\secondary',
        },
        extra: {
          ...defaultExplorerSession,
          currentPath: 'C:\\extra',
        },
      },
      workspace: {
        layoutMode: 'split',
        focusedPane: 'pane-2',
        columnSplitRatio: 0.61,
        rowSplitRatio: 0.54,
        nextTabOrdinal: 4,
        activeTabIdByPane: {
          'pane-1': PRIMARY_EXPLORER_TAB_ID,
          'pane-2': 'secondary-tab',
        },
        tabs: [
          {
            id: PRIMARY_EXPLORER_TAB_ID,
            instanceId: PRIMARY_EXPLORER_INSTANCE_ID,
            pane: 'pane-1',
            title: 'Primary',
          },
          {
            id: 'secondary-tab',
            instanceId: 'secondary',
            pane: 'pane-2',
            title: 'Secondary',
          },
          {
            id: 'extra-tab',
            instanceId: 'extra',
            pane: 'pane-1',
            title: 'Extra',
          },
        ],
      },
      rail: createDefaultExplorerRailSnapshot(),
    }));

    const hydrated = loadExplorerPersistedState(window.localStorage);
    const activeWorkspaceTab = hydrated.workspace.tabs.find(
      (tab) => tab.id === hydrated.workspace.activeWorkspaceTabId,
    );

    expect(hydrated.workspace.activeWorkspaceTabId).toBe(PRIMARY_EXPLORER_TAB_ID);
    expect(activeWorkspaceTab).toMatchObject({
      id: PRIMARY_EXPLORER_TAB_ID,
      layoutMode: 'split',
      focusedPane: 'pane-2',
      columnSplitRatio: 0.61,
      rowSplitRatio: 0.54,
    });
    expect(activeWorkspaceTab?.panes['pane-1']).toMatchObject({
      instanceId: PRIMARY_EXPLORER_INSTANCE_ID,
      title: 'Primary',
    });
    expect(activeWorkspaceTab?.panes['pane-2']).toMatchObject({
      instanceId: 'secondary',
      title: 'Secondary',
    });
    expect(hydrated.workspace.tabs[1]).toMatchObject({
      id: 'extra-tab',
      layoutMode: 'single',
      focusedPane: 'pane-1',
    });
    expect(hydrated.workspace.tabs[1]?.panes['pane-1']).toMatchObject({
      instanceId: 'extra',
      title: 'Extra',
    });
  });

  it('creates, focuses, and closes explorer workspace tabs', () => {
    const store = useExplorerStore.getState();
    store.setWorkspaceLayoutMode('split');
    store.setFocusedPane('pane-2');
    const nextTab = store.createWorkspaceTab({ sourceWorkspaceTabId: PRIMARY_EXPLORER_TAB_ID });

    expect(useExplorerStore.getState().workspace.tabs).toHaveLength(2);
    expect(useExplorerStore.getState().workspace.activeWorkspaceTabId).toBe(nextTab.id);
    expect(nextTab.layoutMode).toBe('single');
    expect(nextTab.focusedPane).toBe('pane-1');
    expect(nextTab.panes['pane-1']).not.toBeNull();

    store.focusWorkspaceTab(PRIMARY_EXPLORER_TAB_ID);
    expect(useExplorerStore.getState().workspace.activeWorkspaceTabId).toBe(PRIMARY_EXPLORER_TAB_ID);

    store.closeWorkspaceTab(nextTab.id);
    expect(useExplorerStore.getState().workspace.tabs).toHaveLength(1);
    expect(useExplorerStore.getState().workspace.activeWorkspaceTabId).toBe(PRIMARY_EXPLORER_TAB_ID);
  });

  it('persists split workspace layout state', () => {
    const store = useExplorerStore.getState();
    store.setWorkspaceLayoutMode('split');
    store.setFocusedPane('pane-2');
    store.setWorkspaceColumnSplitRatio(0.61);

    const hydrated = loadExplorerPersistedState(window.localStorage);
    const activeWorkspaceTab = hydrated.workspace.tabs.find(
      (tab) => tab.id === hydrated.workspace.activeWorkspaceTabId,
    );
    expect(activeWorkspaceTab?.layoutMode).toBe('split');
    expect(activeWorkspaceTab?.focusedPane).toBe('pane-2');
    expect(activeWorkspaceTab?.panes['pane-2']).not.toBeNull();
    expect(activeWorkspaceTab?.columnSplitRatio).toBe(0.61);
  });

  it('preserves hidden pane sessions when moving 4-Up to 3-Up and back', () => {
    const store = useExplorerStore.getState();
    store.setWorkspaceLayoutMode('quad');
    const quadWorkspaceTab = getActiveWorkspaceTab();
    expect(quadWorkspaceTab?.panes['pane-3']).not.toBeNull();
    expect(quadWorkspaceTab?.panes['pane-4']).not.toBeNull();
    const paneThreeInstanceId = quadWorkspaceTab?.panes['pane-3']?.instanceId;
    const paneFourInstanceId = quadWorkspaceTab?.panes['pane-4']?.instanceId;

    store.setWorkspaceLayoutMode('triple');
    const tripleWorkspaceTab = getActiveWorkspaceTab();
    expect(tripleWorkspaceTab?.layoutMode).toBe('triple');
    expect(tripleWorkspaceTab?.panes['pane-3']?.instanceId).toBe(paneThreeInstanceId);
    expect(tripleWorkspaceTab?.panes['pane-4']?.instanceId).toBe(paneFourInstanceId);

    store.setWorkspaceLayoutMode('quad');
    const restoredWorkspaceTab = getActiveWorkspaceTab();
    expect(restoredWorkspaceTab?.layoutMode).toBe('quad');
    expect(restoredWorkspaceTab?.panes['pane-3']?.instanceId).toBe(paneThreeInstanceId);
    expect(restoredWorkspaceTab?.panes['pane-4']?.instanceId).toBe(paneFourInstanceId);
  });

  it('preserves hidden pane sessions when moving 3-Up to 2-Up and back', () => {
    const store = useExplorerStore.getState();
    store.setWorkspaceLayoutMode('triple');
    const tripleWorkspaceTab = getActiveWorkspaceTab();
    const paneTwoInstanceId = tripleWorkspaceTab?.panes['pane-2']?.instanceId;
    const paneThreeInstanceId = tripleWorkspaceTab?.panes['pane-3']?.instanceId;

    store.setWorkspaceLayoutMode('split');
    const splitWorkspaceTab = getActiveWorkspaceTab();
    expect(splitWorkspaceTab?.layoutMode).toBe('split');
    expect(splitWorkspaceTab?.panes['pane-2']?.instanceId).toBe(paneTwoInstanceId);
    expect(splitWorkspaceTab?.panes['pane-3']?.instanceId).toBe(paneThreeInstanceId);

    store.setWorkspaceLayoutMode('triple');
    const restoredWorkspaceTab = getActiveWorkspaceTab();
    expect(restoredWorkspaceTab?.layoutMode).toBe('triple');
    expect(restoredWorkspaceTab?.panes['pane-2']?.instanceId).toBe(paneTwoInstanceId);
    expect(restoredWorkspaceTab?.panes['pane-3']?.instanceId).toBe(paneThreeInstanceId);
  });

  it('creates a new single-pane workspace tab from the focused pane in a multi-pane workspace', () => {
    const store = useExplorerStore.getState();
    store.setWorkspaceLayoutMode('split');
    store.setFocusedPane('pane-2');

    const sourceWorkspaceTab = getActiveWorkspaceTab();
    const sourcePane = sourceWorkspaceTab?.panes['pane-2'];
    expect(sourcePane).not.toBeNull();
    store.updateSessionForInstance(sourcePane?.instanceId ?? '', {
      currentPath: 'C:\\focused-pane',
      history: ['C:\\', 'C:\\focused-pane'],
      historyIdx: 1,
    });

    const nextWorkspaceTab = store.createWorkspaceTab({
      sourceWorkspaceTabId: sourceWorkspaceTab?.id,
    });

    const createdWorkspaceTab = useExplorerStore.getState().workspace.tabs.find(
      (tab) => tab.id === nextWorkspaceTab.id,
    );
    const createdPane = createdWorkspaceTab?.panes['pane-1'];

    expect(createdWorkspaceTab).toMatchObject({
      id: nextWorkspaceTab.id,
      layoutMode: 'single',
      focusedPane: 'pane-1',
    });
    expect(createdPane?.instanceId).not.toBe(sourcePane?.instanceId);
    expect(useExplorerStore.getState().sessions[createdPane?.instanceId ?? '']).toMatchObject({
      currentPath: 'C:\\focused-pane',
      history: ['C:\\', 'C:\\focused-pane'],
      historyIdx: 1,
    });
  });
});

describe('explorerStore transient explorer state', () => {
  it('stores trimmed pending explorer open requests with monotonic sequence ids', () => {
    const store = useExplorerStore.getState();

    store.requestOpenInExplorer({
      directoryPath: '  C:\\Workspace\\Repo  ',
      selectionPath: '  C:\\Workspace\\Repo\\notes.md  ',
      pushHistory: false,
    });

    const firstRequest = useExplorerStore.getState().pendingOpenRequest;
    expect(firstRequest).toMatchObject({
      directoryPath: 'C:\\Workspace\\Repo',
      selectionPath: 'C:\\Workspace\\Repo\\notes.md',
      pushHistory: false,
    });

    store.requestOpenInExplorer({ directoryPath: '   ' });
    expect(useExplorerStore.getState().pendingOpenRequest).toEqual(firstRequest);

    store.requestOpenInExplorer({ directoryPath: 'C:\\Workspace\\Next' });
    const secondRequest = useExplorerStore.getState().pendingOpenRequest;

    expect(secondRequest).toMatchObject({
      directoryPath: 'C:\\Workspace\\Next',
      selectionPath: null,
      pushHistory: true,
    });
    expect(secondRequest?.sequence ?? 0).toBeGreaterThan(firstRequest?.sequence ?? 0);
  });

  it('stores and clears jump-filter state in a single transition', () => {
    const store = useExplorerStore.getState();

    store.setJumpFilter({
      active: true,
      query: 'notes',
      resultIndex: 1,
      resultPaths: ['C:\\workspace\\repo\\notes.txt', 'C:\\workspace\\repo\\preview.png'],
    });

    expect(useExplorerStore.getState().jumpFilter).toEqual({
      active: true,
      query: 'notes',
      resultIndex: 1,
      resultPaths: ['C:\\workspace\\repo\\notes.txt', 'C:\\workspace\\repo\\preview.png'],
    });

    store.setJumpFilter(null);

    expect(useExplorerStore.getState().jumpFilter).toEqual({
      active: false,
      query: '',
      resultIndex: -1,
      resultPaths: [],
    });
  });
});
