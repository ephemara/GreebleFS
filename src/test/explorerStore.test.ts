import { beforeEach, describe, expect, it } from 'vitest';
import {
  EXPLORER_LEGACY_BOOKMARKS_KEY,
  EXPLORER_STATE_BACKUP_KEY,
  EXPLORER_STATE_STORAGE_KEY,
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
    });
    store.replaceRail(folderResult.snapshot);

    const hydrated = loadExplorerPersistedState(window.localStorage);
    expect(hydrated.session.currentPath).toBe('M:\\OverlayTerm\\src');
    expect(hydrated.session.sidebarWidth).toBe(244);
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
});
