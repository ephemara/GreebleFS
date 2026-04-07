import { createEvent, fireEvent, render, screen, waitFor } from '@testing-library/react';
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

function createDataTransfer() {
  const store = new Map<string, string>();
  return {
    dropEffect: 'move',
    effectAllowed: 'all',
    files: [],
    items: [],
    types: [],
    clearData: vi.fn((format?: string) => {
      if (format) {
        store.delete(format);
        return;
      }
      store.clear();
    }),
    getData: vi.fn((format: string) => store.get(format) ?? ''),
    setData: vi.fn((format: string, value: string) => {
      store.set(format, value);
    }),
    setDragImage: vi.fn(),
  };
}

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

function getExplorerViewport(anchorText: string) {
  const anchor = screen.getByText(anchorText);
  const viewport = anchor.closest('.overlay-scroll-area__content')?.parentElement as HTMLElement | null;
  if (!viewport) {
    throw new Error('Explorer viewport not found');
  }
  return viewport;
}

function dispatchLayoutWheel(anchorText: string, deltaY: number) {
  const viewport = getExplorerViewport(anchorText);
  viewport.dispatchEvent(new WheelEvent('wheel', {
    bubbles: true,
    cancelable: true,
    ctrlKey: true,
    deltaY,
  }));
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
        case 'fs_is_process_elevated':
          return false;
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
        case 'fs_start_native_file_drag':
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

  it('renders a dedicated experimental modes button and menu next to the standard layout control', async () => {
    renderExplorer();
    await screen.findByText('alpha');

    fireEvent.click(screen.getByRole('button', { name: /experimental view modes:/i }));

    expect(screen.getByRole('menu', { name: /explorer experimental modes menu/i })).toBeTruthy();
    expect(screen.getByRole('menuitemradio', { name: /adaptive semantic grid/i })).toBeTruthy();
    expect(screen.getByRole('menuitemradio', { name: /constellation view/i })).toBeDisabled();
    expect(screen.getByRole('menuitemradio', { name: /timeline surface/i })).toBeDisabled();
  });

  it('activates adaptive semantic grid without mutating the saved normal layout mode', async () => {
    useSettingsStore.getState().updateExplorer({ viewMode: 'columns' });

    renderExplorer();
    await screen.findByText('alpha');

    fireEvent.click(screen.getByRole('button', { name: /experimental view modes:/i }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: /adaptive semantic grid/i }));

    expect(useSettingsStore.getState().settings.explorer.experimentalViewMode).toBe('adaptive-semantic-grid');
    expect(useSettingsStore.getState().settings.explorer.viewMode).toBe('columns');
    expect(screen.getAllByText(/adaptive semantic grid/i).length).toBeGreaterThan(0);
  });

  it('scales the explorer grid with ctrl-wheel without changing app zoom', async () => {
    useSettingsStore.getState().updateExplorer({ viewMode: 'icons-m', gridZoom: 0 });

    renderExplorer();
    await screen.findByText('alpha');

    const appearanceZoomBefore = useSettingsStore.getState().settings.appearance.appZoom;
    dispatchLayoutWheel('alpha', -120);

    await waitFor(() => {
      expect(useSettingsStore.getState().settings.explorer.viewMode).toBe('icons-l');
      expect(useSettingsStore.getState().settings.explorer.gridZoom).toBeGreaterThan(0);
    });
    expect(useSettingsStore.getState().settings.appearance.appZoom).toBe(appearanceZoomBefore);
  });

  it('smoothly scales icon layouts before switching away from the grid', async () => {
    useSettingsStore.getState().updateExplorer({ viewMode: 'icons-l', gridZoom: 0.5 });

    renderExplorer();
    await screen.findByText('alpha');

    dispatchLayoutWheel('alpha', -120);

    await waitFor(() => {
      expect(useSettingsStore.getState().settings.explorer.gridZoom).toBeGreaterThan(0.5);
      expect(useSettingsStore.getState().settings.explorer.viewMode).toBe('icons-xl');
    });
  });

  it('changes adaptive density with ctrl-wheel without leaving the experimental mode', async () => {
    useSettingsStore.getState().updateExplorer({
      experimentalViewMode: 'adaptive-semantic-grid',
      experimentalDensity: 0.4,
      viewMode: 'details',
    });

    renderExplorer();
    await screen.findByText('alpha');

    dispatchLayoutWheel('alpha', -120);

    await waitFor(() => {
      expect(useSettingsStore.getState().settings.explorer.experimentalViewMode).toBe('adaptive-semantic-grid');
      expect(useSettingsStore.getState().settings.explorer.experimentalDensity).toBeGreaterThan(0.4);
      expect(useSettingsStore.getState().settings.explorer.viewMode).toBe('details');
    });
  });

  it('extends the selection with shift+arrow navigation', async () => {
    renderExplorer();
    await screen.findByText('alpha');

    fireEvent.click(screen.getByText('alpha'));
    expect(screen.getByText(/1 selected/i)).toBeTruthy();

    fireEvent.keyDown(window, { key: 'ArrowDown', shiftKey: true });

    await waitFor(() => {
      expect(screen.getByText(/2 selected/i)).toBeTruthy();
    });
  });

  it('starts the native drag bridge when alt-dragging an explorer entry', async () => {
    renderExplorer();
    const entry = await screen.findByText('notes.txt');
    const dataTransfer = createDataTransfer();
    const dragSource = entry.closest('[data-overlay-drag-source="file"]');
    if (!(dragSource instanceof HTMLElement)) {
      throw new Error('Expected draggable explorer entry');
    }

    const event = createEvent.dragStart(dragSource, { dataTransfer });
    Object.defineProperty(event, 'altKey', { value: true });
    fireEvent(dragSource, event);

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith('fs_start_native_file_drag', {
        paths: [`${REPO_ROOT}\\notes.txt`],
      });
    });
    expect(dataTransfer.setData).toHaveBeenCalledWith(
      'application/x-overlayterm-drag-intent',
      'native-out',
    );
  });

});
