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
import { createExplorerPickerRequest, type ExplorerPickerRequestKind } from '../../runtime/explorerPicker';

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
  {
    name: 'draft.md',
    path: `${REPO_ROOT}\\draft.md`,
    is_dir: false,
    size: 42,
    modified: 0,
    extension: 'md',
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

function renderExplorerPicker(options: {
  kind: ExplorerPickerRequestKind;
  initialFileName?: string;
  defaultExtension?: string;
  allowedExtensions?: string[];
}) {
  const appearance = resolveOverlayAppearance({ activeThemeId: 'operator' });
  const onConfirm = vi.fn();

  const request = createExplorerPickerRequest({
    kind: options.kind,
    presentation: 'embedded',
    initialFileName: options.initialFileName,
    defaultExtension: options.defaultExtension,
    allowedExtensions: options.allowedExtensions,
    confirmLabel:
      options.kind === 'openFile'
        ? 'Choose File'
        : options.kind === 'openFiles'
          ? 'Choose Files'
          : options.kind === 'openFolder'
            ? 'Choose Folder'
            : options.kind === 'openFolders'
              ? 'Choose Folders'
              : options.kind === 'pickDestinationFolder'
                ? 'Choose Destination'
                : 'Save File',
  });

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
      onOpenInFilesystemAquarium={() => {}}
      onOpenInTerminal={() => {}}
      onAddBookmark={async () => {}}
      explorerPicker={request}
      onExplorerPickerConfirm={onConfirm}
      onExplorerPickerCancel={vi.fn()}
    />,
  );

  return { onConfirm, unmount: renderResult.unmount };
}

describe('FileExplorer picker browser coverage', () => {
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

  it('confirms a single file selection', async () => {
    const { onConfirm, unmount } = renderExplorerPicker({ kind: 'openFile' });

    await screen.findByText('notes.txt');
    fireEvent.click(screen.getByText('notes.txt'));
    fireEvent.click(screen.getByRole('button', { name: 'Choose File' }));

    expect(onConfirm).toHaveBeenCalledWith({
      currentDirectory: REPO_ROOT,
      entries: [{ path: `${REPO_ROOT}\\notes.txt`, name: 'notes.txt', kind: 'file' }],
    });
    unmount();
  });

  it('confirms multi-file and single-folder picker constraints', async () => {
    const multiFiles = renderExplorerPicker({ kind: 'openFiles' });

    await screen.findByText('notes.txt');
    fireEvent.click(screen.getByText('notes.txt'));
    fireEvent.click(screen.getByText('draft.md'), { ctrlKey: true });
    fireEvent.click(screen.getByRole('button', { name: 'Choose Files' }));

    expect(multiFiles.onConfirm).toHaveBeenCalledTimes(1);
    const [multiFileResult] = multiFiles.onConfirm.mock.calls[0] ?? [];
    expect({
      ...multiFileResult,
      entries: [...(multiFileResult?.entries ?? [])].sort((left, right) =>
        left.path.localeCompare(right.path),
      ),
    }).toEqual({
      currentDirectory: REPO_ROOT,
      entries: [
        { path: `${REPO_ROOT}\\draft.md`, name: 'draft.md', kind: 'file' },
        { path: `${REPO_ROOT}\\notes.txt`, name: 'notes.txt', kind: 'file' },
      ],
    });
    multiFiles.unmount();

    const singleFolder = renderExplorerPicker({ kind: 'openFolder' });
    await screen.findByText('alpha');
    fireEvent.click(screen.getByText('alpha'));
    fireEvent.click(screen.getByText('nested'), { ctrlKey: true });
    fireEvent.click(screen.getByRole('button', { name: 'Choose Folder' }));

    expect(singleFolder.onConfirm).toHaveBeenCalledWith({
      currentDirectory: REPO_ROOT,
      entries: [{ path: `${REPO_ROOT}\\nested`, name: 'nested', kind: 'folder' }],
    });
    singleFolder.unmount();
  });

  it('confirms multi-folder selection and current-folder fallback', async () => {
    const multiFolder = renderExplorerPicker({ kind: 'openFolders' });

    await screen.findByText('alpha');
    fireEvent.click(screen.getByText('alpha'));
    fireEvent.click(screen.getByText('nested'), { ctrlKey: true });
    fireEvent.click(screen.getByRole('button', { name: 'Choose Folders' }));

    expect(multiFolder.onConfirm).toHaveBeenCalledWith({
      currentDirectory: REPO_ROOT,
      entries: [
        { path: `${REPO_ROOT}\\alpha`, name: 'alpha', kind: 'folder' },
        { path: `${REPO_ROOT}\\nested`, name: 'nested', kind: 'folder' },
      ],
    });
    multiFolder.unmount();

    const destinationPicker = renderExplorerPicker({ kind: 'pickDestinationFolder' });
    await screen.findByText('alpha');
    expect(screen.getByText(/current folder will be used/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Choose Destination' }));

    expect(destinationPicker.onConfirm).toHaveBeenCalledWith({
      currentDirectory: REPO_ROOT,
      entries: [{ path: REPO_ROOT, name: 'repo', kind: 'folder' }],
    });
    destinationPicker.unmount();
  });

  it('confirms save mode, appends the default extension, and gates overwrite with a dialog', async () => {
    const { onConfirm, unmount } = renderExplorerPicker({
      kind: 'saveFile',
      initialFileName: 'notes',
      defaultExtension: 'txt',
    });

    await screen.findByText('notes.txt');
    fireEvent.click(screen.getByRole('button', { name: 'Save File' }));

    expect(screen.getByText(/overwrite existing file/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Overwrite' }));

    await waitFor(() => {
      expect(onConfirm).toHaveBeenCalledWith({
        currentDirectory: REPO_ROOT,
        entries: [{ path: `${REPO_ROOT}\\notes.txt`, name: 'notes.txt', kind: 'file' }],
      });
    });

    unmount();
  });
});
