import { beforeEach, describe, expect, it } from 'vitest';
import {
  EXPLORER_LEGACY_BOOKMARKS_KEY,
  EXPLORER_STATE_BACKUP_KEY,
  EXPLORER_STATE_STORAGE_KEY,
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

  it('creates, focuses, and closes explorer workspace tabs across panes', () => {
    const store = useExplorerStore.getState();
    const nextTab = store.createWorkspaceTab({
      sourceInstanceId: PRIMARY_EXPLORER_INSTANCE_ID,
      pane: 'right',
    });

    expect(useExplorerStore.getState().workspace.tabs).toHaveLength(2);
    expect(useExplorerStore.getState().workspace.activeTabIdByPane.right).toBe(nextTab.id);

    store.focusWorkspaceTab(PRIMARY_EXPLORER_TAB_ID);
    expect(useExplorerStore.getState().workspace.activeTabIdByPane.left).toBe(PRIMARY_EXPLORER_TAB_ID);

    store.closeWorkspaceTab(nextTab.id);
    expect(useExplorerStore.getState().workspace.tabs).toHaveLength(1);
    expect(useExplorerStore.getState().workspace.activeTabIdByPane.right).toBeNull();
  });

  it('persists dual-pane workspace layout state', () => {
    const store = useExplorerStore.getState();
    const rightTab = store.createWorkspaceTab({ pane: 'right' });
    store.setWorkspaceLayoutMode('dual');
    store.setFocusedPane('right');
    store.setWorkspaceSplitRatio(0.61);

    const hydrated = loadExplorerPersistedState(window.localStorage);
    expect(hydrated.workspace.layoutMode).toBe('dual');
    expect(hydrated.workspace.focusedPane).toBe('right');
    expect(hydrated.workspace.activeTabIdByPane.right).toBe(rightTab.id);
    expect(hydrated.workspace.splitRatio).toBe(0.61);
  });
});
