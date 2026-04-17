import { beforeEach, describe, expect, it } from 'vitest';
import { calculateExplorerChecksumsFromBase64 } from '../components/explorerChecksums';
import { useExplorerStore } from '../store/explorerStore';

describe('explorer metadata workflows', () => {
  beforeEach(() => {
    useExplorerStore.getState().resetSession();
    useExplorerStore.getState().setPropertiesPanel(null);
    useExplorerStore.getState().setPendingTerminalCwdSync(null);
    useExplorerStore.getState().setRecursiveSizeCacheEntry('C:\\workspace\\repo\\notes.txt', null);
  });

  it('calculates md5 and sha256 checksums from base64 file content', async () => {
    const result = await calculateExplorerChecksumsFromBase64('aGVsbG8=');

    expect(result.md5).toMatch(/^[a-f0-9]{32}$/);
    expect(result.sha256).toBe('2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824');
  });

  it('tracks properties panel state, recursive size cache entries, and pending terminal cwd sync separately', () => {
    const store = useExplorerStore.getState();

    store.setPropertiesPanel({
      loading: true,
      targetPaths: ['C:\\workspace\\repo\\notes.txt'],
      tab: 'checksums',
      visible: true,
    });
    store.setPendingTerminalCwdSync({
      path: 'C:\\workspace\\repo',
      shell: 'pwsh.exe -NoLogo',
      source: 'navigation',
      updatedAt: 1234,
    });
    store.setRecursiveSizeCacheEntry('C:\\workspace\\repo', {
      bytes: 4096,
      fileCount: 8,
      folderCount: 2,
      pending: false,
      updatedAt: 5678,
    });

    expect(useExplorerStore.getState().propertiesPanel).toEqual({
      loading: true,
      targetPaths: ['C:\\workspace\\repo\\notes.txt'],
      tab: 'checksums',
      visible: true,
    });
    expect(useExplorerStore.getState().pendingTerminalCwdSync).toEqual({
      path: 'C:\\workspace\\repo',
      shell: 'pwsh.exe -NoLogo',
      source: 'navigation',
      updatedAt: 1234,
    });
    expect(useExplorerStore.getState().recursiveSizeCache['C:\\workspace\\repo']).toEqual({
      bytes: 4096,
      fileCount: 8,
      folderCount: 2,
      pending: false,
      updatedAt: 5678,
    });

    store.setPropertiesPanel(null);
    store.setRecursiveSizeCacheEntry('C:\\workspace\\repo', null);
    store.setPendingTerminalCwdSync(null);

    expect(useExplorerStore.getState().propertiesPanel).toEqual({
      loading: false,
      targetPaths: [],
      tab: 'info',
      visible: false,
    });
    expect(useExplorerStore.getState().recursiveSizeCache['C:\\workspace\\repo']).toBeUndefined();
    expect(useExplorerStore.getState().pendingTerminalCwdSync).toBeNull();
  });
});
