import { beforeEach, describe, expect, it } from 'vitest';
import { defaultExplorerSession, useExplorerStore } from '../store/explorerStore';

beforeEach(() => {
  useExplorerStore.getState().resetSession();
});

describe('useExplorerStore', () => {
  it('starts with the default explorer session snapshot', () => {
    expect(useExplorerStore.getState().session).toEqual(defaultExplorerSession);
  });

  it('merges session updates without dropping unrelated state', () => {
    const store = useExplorerStore.getState();

    store.updateSession({
      currentPath: 'M:\\OverlayTerm\\src',
      history: ['M:\\OverlayTerm', 'M:\\OverlayTerm\\src'],
      historyIdx: 1,
      sidebarWidth: 260,
      previewWidth: 520,
    });
    store.updateSession({
      search: 'zustand',
    });

    expect(useExplorerStore.getState().session).toEqual({
      currentPath: 'M:\\OverlayTerm\\src',
      history: ['M:\\OverlayTerm', 'M:\\OverlayTerm\\src'],
      historyIdx: 1,
      sidebarWidth: 260,
      previewWidth: 520,
      search: 'zustand',
      searchIncludeContent: true,
    });
  });
});
