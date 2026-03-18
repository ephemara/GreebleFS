import { beforeEach, describe, expect, it } from 'vitest';
import { createDefaultCommandBookmarks } from '../config/platform';
import { useTerminalStore, type Bookmark } from '../store/terminalStore';

function makeBookmark(id: string, name: string, value: string): Bookmark {
  return { id, name, value };
}

beforeEach(() => {
  useTerminalStore.setState({
    isInitialized: false,
    directoryBookmarks: [],
    commandBookmarks: [],
  });
});

describe('useTerminalStore', () => {
  it('hydrates defaults on first init and marks store initialized', async () => {
    await useTerminalStore.getState().initStore();

    const state = useTerminalStore.getState();
    expect(state.isInitialized).toBe(true);
    expect(state.directoryBookmarks).toEqual([]);
    expect(state.commandBookmarks).toEqual(createDefaultCommandBookmarks());
  });

  it('does not reinitialize once already initialized', async () => {
    useTerminalStore.setState({
      isInitialized: true,
      directoryBookmarks: [makeBookmark('dir-1', 'Repo', 'M:\\Code')],
      commandBookmarks: [makeBookmark('cmd-1', 'Build', 'cargo build')],
    });

    await useTerminalStore.getState().initStore();

    const state = useTerminalStore.getState();
    expect(state.directoryBookmarks).toEqual([makeBookmark('dir-1', 'Repo', 'M:\\Code')]);
    expect(state.commandBookmarks).toEqual([makeBookmark('cmd-1', 'Build', 'cargo build')]);
  });

  it('adds, updates, and removes directory bookmarks', async () => {
    const first = makeBookmark('dir-1', 'OverlayTerm', 'M:\\OverlayTerm');
    await useTerminalStore.getState().addDirectoryBookmark(first);
    expect(useTerminalStore.getState().directoryBookmarks).toEqual([first]);

    const updated = makeBookmark('dir-1', 'OverlayTerm Root', 'M:\\OverlayTerm');
    await useTerminalStore.getState().updateDirectoryBookmark(updated);
    expect(useTerminalStore.getState().directoryBookmarks).toEqual([updated]);

    await useTerminalStore.getState().removeDirectoryBookmark('dir-1');
    expect(useTerminalStore.getState().directoryBookmarks).toEqual([]);
  });

  it('adds, updates, and removes command bookmarks', async () => {
    const first = makeBookmark('cmd-1', 'Status', 'git status');
    await useTerminalStore.getState().addCommandBookmark(first);
    expect(useTerminalStore.getState().commandBookmarks).toEqual([first]);

    const updated = makeBookmark('cmd-1', 'Status Short', 'git status -s');
    await useTerminalStore.getState().updateCommandBookmark(updated);
    expect(useTerminalStore.getState().commandBookmarks).toEqual([updated]);

    await useTerminalStore.getState().removeCommandBookmark('cmd-1');
    expect(useTerminalStore.getState().commandBookmarks).toEqual([]);
  });
});
