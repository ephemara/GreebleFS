import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { FileExplorer } from '../components/FileExplorer';
import { resolveOverlayAppearance } from '../config/appearance';
import {
  EXPLORER_PERFORMANCE_HISTORY_KEY,
  loadExplorerPerformanceSnapshot,
  resetExplorerPerformanceSnapshot,
} from '../config/performanceTelemetry';
import type { FsRuntimeCachePolicy } from '../config/runtimeCachePolicy';
import { createDefaultExplorerRailSnapshot } from '../components/explorer/explorerRailState';
import {
  EXPLORER_LEGACY_BOOKMARKS_KEY,
  EXPLORER_STATE_BACKUP_KEY,
  EXPLORER_STATE_STORAGE_KEY,
} from '../store/explorerStore';
import { useSettingsStore } from '../store/settingsStore';
import { useExplorerStore } from '../store/explorerStore';

interface TestFileEntry {
  name: string;
  path: string;
  is_dir: boolean;
  size: number;
  modified: number;
  extension: string;
  is_hidden: boolean;
  is_symlink: boolean;
}

interface TestFileSearchResult extends TestFileEntry {
  relative_path: string;
  match_kind: 'name' | 'content' | 'name_and_content';
  snippet: string | null;
  line_number: number | null;
}

const REPO_ROOT = 'C:\\workspace\\repo';
const SETTINGS_STORAGE_KEY = 'ultacode-settings';

const EXPLORER_ENTRIES: TestFileEntry[] = [
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
    size: 12,
    modified: 0,
    extension: 'txt',
    is_hidden: false,
    is_symlink: false,
  },
];

function buildEntrySizeResults(paths: string[]) {
  return paths.map(path => {
    const matchingEntry = EXPLORER_ENTRIES.find(entry => entry.path === path);
    return {
      path,
      bytes: matchingEntry?.size ?? 0,
      is_dir: matchingEntry?.is_dir ?? false,
      is_complete: true,
    };
  });
}

function resetOverlayTermStorage(storage: Storage) {
  storage.removeItem(SETTINGS_STORAGE_KEY);
  storage.removeItem(EXPLORER_STATE_STORAGE_KEY);
  storage.removeItem(EXPLORER_STATE_BACKUP_KEY);
  storage.removeItem(EXPLORER_LEGACY_BOOKMARKS_KEY);
  storage.removeItem(EXPLORER_PERFORMANCE_HISTORY_KEY);
}

const SEARCH_RESULT: TestFileSearchResult = {
  name: 'needle.txt',
  path: `${REPO_ROOT}\\alpha\\needle.txt`,
  is_dir: false,
  size: 24,
  modified: 0,
  extension: 'txt',
  is_hidden: false,
  is_symlink: false,
  relative_path: 'alpha\\needle.txt',
  match_kind: 'content',
  snippet: 'needle found in file',
  line_number: 7,
};

const RUNTIME_POLICY: FsRuntimeCachePolicy = {
  dirListCacheTtlMs: 2000,
  searchNameIndexCacheTtlMs: 1500,
  searchContentIndexCacheTtlMs: 1000,
  entrySizeCacheTtlMs: 10000,
  entrySizeScanBudgetMs: 900,
  searchContentIndexTotalBytesBudget: 12 * 1024 * 1024,
  maxSearchContentFileBytes: 8 * 1024 * 1024,
  searchMaxIndexedEntries: 25000,
};

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

describe('FileExplorer search telemetry', () => {
  beforeEach(() => {
    resetOverlayTermStorage(window.localStorage);
    resetExplorerPerformanceSnapshot(window.localStorage);
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
          return RUNTIME_POLICY;
        case 'fs_list_dir':
        case 'fs_list_dir_uncached':
          return EXPLORER_ENTRIES;
        case 'fs_measure_entry_sizes':
          return buildEntrySizeResults(payload?.paths ?? []);
        case 'fs_resolve_native_icons':
          return [];
        case 'fs_search_entries_with_diagnostics':
          return {
            results: [SEARCH_RESULT],
            diagnostics: {
              executionStrategy: 'content_index_cache_hit',
              contentCacheStatus: 'cache_hit',
              scannedEntryCount: 0,
              indexedEntryCount: 64,
              contentCacheStoredFileCount: 0,
              contentCacheStoredByteCount: 0,
              truncatedByScanBudget: false,
            },
          };
        case 'fs_cancel_search_entries':
        case 'fs_watch_entry_size_root':
        case 'fs_unwatch_entry_size_root':
          return null;
        default:
          throw new Error(`Unexpected invoke command: ${command}`);
      }
    });
  });

  it('records backend search diagnostics alongside runtime cache policy metadata', async () => {
    renderExplorer();

    await screen.findByText('alpha');

    fireEvent.keyDown(window, { key: 'l', ctrlKey: true });
    const omnibox = await screen.findByPlaceholderText(/Search or enter path/i);
    fireEvent.change(omnibox, { target: { value: 'needle' } });
    fireEvent.keyDown(omnibox, { key: 'Enter' });

    await waitFor(() => {
      expect(vi.mocked(invoke)).toHaveBeenCalledWith(
        'fs_search_entries_with_diagnostics',
        expect.objectContaining({
          path: REPO_ROOT,
          query: 'needle',
          requestScope: 'primary_file_explorer',
        }),
      );
      expect(loadExplorerPerformanceSnapshot(window.localStorage).samples.explorer_search).toHaveLength(1);
    });

    const searchSample = loadExplorerPerformanceSnapshot(window.localStorage).samples.explorer_search[0];

    expect(searchSample).toBeTruthy();
    expect(searchSample?.durationMs).toBeGreaterThanOrEqual(0);
    expect(searchSample?.metadata).toMatchObject({
      success: true,
      includeContent: true,
      queryLength: 6,
      resultCount: 1,
      runtimeCachePolicyStatus: 'ready',
      runtimeCachePolicyFingerprint: '2000:1500:1000:10000:900:12582912:8388608:25000',
      runtimeCachePolicyDirListCacheTtlMs: 2000,
      runtimeCachePolicySearchNameIndexCacheTtlMs: 1500,
      runtimeCachePolicySearchContentIndexCacheTtlMs: 1000,
      runtimeCachePolicyEntrySizeCacheTtlMs: 10000,
      runtimeCachePolicyEntrySizeScanBudgetMs: 900,
      runtimeCachePolicySearchContentIndexTotalBytesBudget: 12582912,
      runtimeCachePolicyMaxSearchContentFileBytes: 8388608,
      runtimeCachePolicySearchMaxIndexedEntries: 25000,
      explorerSearchExecutionStrategy: 'content_index_cache_hit',
      explorerSearchContentCacheStatus: 'cache_hit',
      explorerSearchScannedEntryCount: 0,
      explorerSearchIndexedEntryCount: 64,
      explorerSearchContentCacheStoredFileCount: 0,
      explorerSearchContentCacheStoredByteCount: 0,
      explorerSearchTruncatedByScanBudget: false,
    });
  });
});
