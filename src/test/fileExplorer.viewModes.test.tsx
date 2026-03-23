import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { FileExplorer } from '../components/FileExplorer';
import { resolveOverlayAppearance } from '../config/appearance';
import { createDefaultExplorerRailSnapshot } from '../components/explorer/explorerRailState';
import {
  EXPLORER_LEGACY_BOOKMARKS_KEY,
  EXPLORER_STATE_BACKUP_KEY,
  EXPLORER_STATE_STORAGE_KEY,
} from '../store/explorerStore';
import { useSettingsStore } from '../store/settingsStore';
import { useExplorerStore } from '../store/explorerStore';

const SETTINGS_STORAGE_KEY = 'ultacode-settings';
const REPO_ROOT = 'C:\\workspace\\repo';
const ENTRIES = [
  {
    name: 'alpha',
    path: `${REPO_ROOT}\\alpha`,
    is_dir: true,
    size: 0,
    modified: 0,
    extension: '',
    is_hidden: false,
    is_symlink: false,
  },
  {
    name: 'notes.txt',
    path: `${REPO_ROOT}\\notes.txt`,
    is_dir: false,
    size: 128,
    modified: 0,
    extension: 'txt',
    is_hidden: false,
    is_symlink: false,
  },
] as const;

function resetOverlayTermStorage(storage: Storage) {
  storage.removeItem(SETTINGS_STORAGE_KEY);
  storage.removeItem(EXPLORER_STATE_STORAGE_KEY);
  storage.removeItem(EXPLORER_STATE_BACKUP_KEY);
  storage.removeItem(EXPLORER_LEGACY_BOOKMARKS_KEY);
}

function renderExplorer() {
  const appearance = resolveOverlayAppearance({ activeThemeId: 'operator' });
  return render(
    <FileExplorer
      theme={{
        accent: appearance.theme.palette.accent,
        bg: appearance.theme.palette.appBackground,
        bgPanel: appearance.theme.palette.panelBackground,
        text: appearance.theme.palette.textPrimary,
        border: appearance.theme.palette.border,
        textMuted: appearance.theme.palette.textMuted,
      }}
      appearance={appearance}
      onOpenInTerminal={() => {}}
      onAddBookmark={async () => {}}
    />,
  );
}

describe('FileExplorer view modes', () => {
  beforeEach(() => {
    resetOverlayTermStorage(window.localStorage);
    useSettingsStore.getState().resetToDefaults();
    useExplorerStore.getState().resetSession();
    useExplorerStore.getState().replaceRail(createDefaultExplorerRailSnapshot());
    useExplorerStore.getState().clearPersistenceNotice();

    vi.mocked(invoke).mockReset();
    vi.mocked(invoke).mockImplementation(async (command: string, args?: unknown) => {
      const payload = args as { paths?: string[] } | undefined;
      switch (command) {
        case 'fs_get_drives':
          return [];
        case 'fs_get_home_dir':
          return REPO_ROOT;
        case 'fs_get_runtime_cache_policy':
          return {
            dirListCacheTtlMs: 2000,
            searchNameIndexCacheTtlMs: 1500,
            searchContentIndexCacheTtlMs: 1000,
            entrySizeCacheTtlMs: 10000,
            entrySizeScanBudgetMs: 900,
            searchContentIndexTotalBytesBudget: 12 * 1024 * 1024,
            maxSearchContentFileBytes: 8 * 1024 * 1024,
            searchMaxIndexedEntries: 25000,
          };
        case 'fs_list_dir':
        case 'fs_list_dir_uncached':
          return ENTRIES;
        case 'fs_measure_entry_sizes':
          return (payload?.paths ?? []).map(path => ({
            path,
            bytes: ENTRIES.find(entry => entry.path === path)?.size ?? 0,
            is_dir: ENTRIES.find(entry => entry.path === path)?.is_dir ?? false,
            is_complete: true,
          }));
        case 'fs_resolve_native_icons':
          return [];
        case 'fs_search_entries_with_diagnostics':
          return {
            results: [],
            diagnostics: {
              executionStrategy: 'live_scan',
              contentCacheStatus: 'not_requested',
              scannedEntryCount: 0,
              indexedEntryCount: 0,
              contentCacheStoredFileCount: 0,
              contentCacheStoredByteCount: 0,
              truncatedByScanBudget: false,
            },
          };
        case 'fs_watch_entry_size_root':
        case 'fs_unwatch_entry_size_root':
        case 'fs_cancel_search_entries':
          return null;
        default:
          throw new Error(`Unexpected invoke command: ${command}`);
      }
    });
  });

  it('lets the user pick columns from the explorer layout menu', async () => {
    renderExplorer();
    await screen.findByText('alpha');

    fireEvent.click(screen.getByRole('button', { name: /explorer layout:/i }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: /columns/i }));

    expect(useSettingsStore.getState().settings.explorer.viewMode).toBe('columns');
  });

  it('steps the explorer layout with ctrl-wheel without changing app zoom', async () => {
    renderExplorer();
    await screen.findByText('alpha');

    const appearanceZoomBefore = useSettingsStore.getState().settings.appearance.appZoom;
    fireEvent.wheel(screen.getByText('alpha'), { ctrlKey: true, deltaY: -120 });

    await waitFor(() => {
      expect(useSettingsStore.getState().settings.explorer.viewMode).toBe('list');
    });
    expect(useSettingsStore.getState().settings.appearance.appZoom).toBe(appearanceZoomBefore);
  });
});
