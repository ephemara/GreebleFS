import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { FileExplorer } from '../../components/FileExplorer';
import { resolveOverlayAppearance } from '../../config/appearance';
import { EXPLORER_PERFORMANCE_HISTORY_KEY } from '../../config/performanceTelemetry';
import { createDefaultExplorerRailSnapshot } from '../../components/explorer/explorerRailState';
import {
  EXPLORER_LEGACY_BOOKMARKS_KEY,
  EXPLORER_STATE_BACKUP_KEY,
  EXPLORER_STATE_STORAGE_KEY,
} from '../../store/explorerStore';
import { useSettingsStore } from '../../store/settingsStore';
import { useExplorerStore } from '../../store/explorerStore';

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
    name: 'nested',
    path: `${REPO_ROOT}\\nested`,
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

function renderRepositoryPicker(options?: {
  allowMultiple?: boolean;
  requestId?: number;
  onConfirm?: (paths: string[]) => void;
}) {
  const appearance = resolveOverlayAppearance({ activeThemeId: 'operator' });
  const onConfirm = options?.onConfirm ?? vi.fn();

  const renderResult = render(
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
      repositoryPicker={{
        active: true,
        allowMultiple: options?.allowMultiple ?? true,
        requestId: options?.requestId ?? 1,
        onConfirm,
        onCancel: vi.fn(),
      }}
    />,
  );

  return { onConfirm, unmount: renderResult.unmount };
}

describe('FileExplorer repository picker browser coverage', () => {
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
          return EXPLORER_ENTRIES;
        case 'fs_measure_entry_sizes':
          return buildEntrySizeResults(payload?.paths ?? []);
        case 'fs_resolve_native_icons':
        case 'fs_search_entries':
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

  it('confirms the current folder directly when repository-picker mode starts without a selection', async () => {
    const { onConfirm, unmount } = renderRepositoryPicker();

    await screen.findByText('alpha');
    expect(screen.getByRole('button', { name: 'Add Current Folder' })).toBeEnabled();
    expect(screen.getByText(/No folders selected yet, so OverlayTerm can add the current folder directly\./)).toBeInTheDocument();
    expect(screen.getByTitle(REPO_ROOT)).toHaveTextContent(`Current folder: ${REPO_ROOT}`);

    fireEvent.click(screen.getByRole('button', { name: 'Add Current Folder' }));

    expect(onConfirm).toHaveBeenCalledWith([REPO_ROOT]);
    unmount();
  });

  it('keeps repository-picker selection truly single-choice when multi-select is disabled', async () => {
    const { onConfirm, unmount } = renderRepositoryPicker({
      allowMultiple: false,
      requestId: 2,
    });

    await screen.findByText('alpha');
    fireEvent.click(screen.getByText('alpha'));
    fireEvent.click(screen.getByText('nested'), { ctrlKey: true });

    await waitFor(() => {
      expect(screen.getByText(/1 folder selected\./)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Add Selected Folder' }));

    expect(onConfirm).toHaveBeenCalledWith([`${REPO_ROOT}\\nested`]);
    unmount();
  });
});
