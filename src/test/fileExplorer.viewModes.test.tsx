import React from 'react';
import { createEvent, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { FileExplorer, invalidateExplorerResultCaches } from '../components/FileExplorer';
import { normalizeThemeDefinition, resolveOverlayAppearance } from '../config/appearance';
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
  {
    name: 'preview.png',
    path: `${REPO_ROOT}\\preview.png`,
    is_dir: false,
    size: 4096,
    modified: 0,
    extension: 'png',
    is_hidden: false,
    is_symlink: false,
  },
  {
    name: 'large.txt',
    path: `${REPO_ROOT}\\large.txt`,
    is_dir: false,
    size: 24 * 1024 * 1024,
    modified: 0,
    extension: 'txt',
    is_hidden: false,
    is_symlink: false,
  },
  {
    name: 'broken.png',
    path: `${REPO_ROOT}\\broken.png`,
    is_dir: false,
    size: 2048,
    modified: 0,
    extension: 'png',
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

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });

  return {
    promise,
    resolve,
    reject,
  };
}

function resetOverlayTermStorage(storage: Storage) {
  storage.removeItem(SETTINGS_STORAGE_KEY);
  storage.removeItem(EXPLORER_STATE_STORAGE_KEY);
  storage.removeItem(EXPLORER_STATE_BACKUP_KEY);
  storage.removeItem(EXPLORER_LEGACY_BOOKMARKS_KEY);
}

function renderExplorer(options: {
  appearance?: ReturnType<typeof resolveOverlayAppearance>;
  chromeControlSurface?: 'toolbar' | 'topbar';
  layoutMode?: 'full' | 'dock';
} = {}) {
  const appearance = options.appearance ?? resolveOverlayAppearance({ activeThemeId: 'operator' });
  return {
    appearance,
    ...render(
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
        chromeControlSurface={options.chromeControlSurface}
        layoutMode={options.layoutMode}
        onOpenInTerminal={() => {}}
        onAddBookmark={async () => {}}
      />,
    ),
  };
}

function getChromeControl(controlId: string) {
  return document.querySelector(`[data-overlay-explorer-control="${controlId}"]`) as HTMLElement | null;
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
    invalidateExplorerResultCaches();

    vi.mocked(invoke).mockReset();
    vi.mocked(invoke).mockImplementation(async (command: string, args?: unknown) => {
      const payload = args as { path?: string; paths?: string[] } | undefined;
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
        case 'fs_read_text_file':
          if (payload?.path === `${REPO_ROOT}\\large.txt`) {
            throw new Error('File is too large to preview (> 10 MB)');
          }
          return 'hello from preview';
        case 'fs_read_file_base64':
          if (payload?.path === `${REPO_ROOT}\\broken.png`) {
            throw new Error('File is too large to preview (> 12 MB)');
          }
          return 'data:text/plain;base64,aGVsbG8=';
        case 'fs_read_image_thumbnail':
          if (payload?.path === `${REPO_ROOT}\\broken.png`) {
            throw new Error('Image is too large to thumbnail (> 64 MB)');
          }
          return 'data:image/png;base64,ZmFrZQ==';
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

  it('lets the user switch explorer modes from the toolbar without mutating the live session shell preset', async () => {
    renderExplorer();
    await screen.findByText('alpha');

    expect(screen.getByRole('button', { name: /manage/i })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /explorer mode:/i }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: /focus/i }));

    await waitFor(() => {
      expect(useSettingsStore.getState().settings.explorer.modeProfileOverridesByThemeId.operator).toBe('focus');
      expect(useExplorerStore.getState().session.shellLayoutId).toBe('balanced');
      expect(screen.queryByRole('button', { name: /manage/i })).toBeNull();
    });
  });

  it('moves toolbar controls when the active theme changes the default mode profile', async () => {
    const appearance = resolveOverlayAppearance({
      activeThemeId: 'focused-layout',
      customThemes: [
        normalizeThemeDefinition({
          id: 'focused-layout',
          name: 'Focused Layout',
          explorer: {
            defaultModeProfileId: 'focus',
          },
        }),
      ],
    });

    renderExplorer({ appearance });
    await screen.findByText('alpha');

    expect(getChromeControl('toggleSources')?.getAttribute('data-overlay-explorer-control-zone')).toBe('secondaryStart');
  });

  it('can render global controls on the explorer topbar surface', async () => {
    renderExplorer({ chromeControlSurface: 'topbar' });
    await screen.findByText('alpha');

    const toggleSources = getChromeControl('toggleSources');
    expect(toggleSources?.closest('[data-overlay-explorer-surface="explorerTopbar"]')).not.toBeNull();
    expect(document.querySelector('[data-overlay-explorer-surface="explorerToolbar"] [data-overlay-explorer-control="toggleSources"]')).toBeNull();
  });

  it('applies persisted chrome layout overrides without mutating shell layout state', async () => {
    useExplorerStore.getState().updateSession({
      shellLayoutId: 'focus',
      sourcesVisible: false,
    });
    useSettingsStore.getState().setExplorerChromeLayoutOverride('operator', 'default', {
      entries: [
        {
          controlId: 'refresh',
          surfaceId: 'explorerToolbar',
          zone: 'primaryStart',
          order: 5,
        },
      ],
    });

    renderExplorer();
    await screen.findByText('alpha');

    expect(getChromeControl('refresh')?.getAttribute('data-overlay-explorer-control-zone')).toBe('primaryStart');
    expect(useExplorerStore.getState().session.shellLayoutId).toBe('focus');
    expect(useExplorerStore.getState().session.sourcesVisible).toBe(false);
  });

  it('honors the preview toggle before opening previewable files', async () => {
    renderExplorer();
    await screen.findByText('notes.txt');

    fireEvent.click(screen.getByRole('button', { name: /^preview$/i }));

    await waitFor(() => {
      expect(useExplorerStore.getState().session.previewEnabled).toBe(false);
    });

    fireEvent.click(screen.getByText('notes.txt'));

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /copy path/i })).toBeNull();
    });
    expect(vi.mocked(invoke).mock.calls.some(([command]) => command === 'fs_read_text_file')).toBe(false);
  });

  it('keeps inline previews closed in dock mode', async () => {
    renderExplorer({ layoutMode: 'dock' });
    await screen.findByText('notes.txt');

    fireEvent.click(screen.getByText('notes.txt'));

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /copy path/i })).toBeNull();
    });
    expect(vi.mocked(invoke).mock.calls.some(([command]) => command === 'fs_read_text_file')).toBe(false);
  });

  it('closes an open inline preview when switching into dock mode and keeps it closed on return', async () => {
    const { appearance, rerender } = renderExplorer();
    await screen.findByText('notes.txt');

    fireEvent.click(screen.getByText('notes.txt'));
    await screen.findByRole('button', { name: /copy path/i });

    rerender(
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
        layoutMode="dock"
        onOpenInTerminal={() => {}}
        onAddBookmark={async () => {}}
      />,
    );

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /copy path/i })).toBeNull();
    });

    rerender(
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
        layoutMode="full"
        onOpenInTerminal={() => {}}
        onAddBookmark={async () => {}}
      />,
    );

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /copy path/i })).toBeNull();
    });
  });

  it('ignores stale directory responses after a newer refresh updates the explorer state', async () => {
    const lateDirectoryResponse = createDeferred<typeof ENTRIES[number][]>();
    const hiddenEntry = {
      name: 'secret.txt',
      path: `${REPO_ROOT}\\secret.txt`,
      is_dir: false,
      size: 96,
      modified: 0,
      extension: 'txt',
      is_hidden: true,
      is_symlink: false,
    } as const;

    vi.mocked(invoke).mockReset();
    vi.mocked(invoke).mockImplementation(async (command: string, args?: unknown) => {
      const payload = args as { path?: string; paths?: string[]; showHidden?: boolean } | undefined;
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
          return lateDirectoryResponse.promise;
        case 'fs_list_dir_uncached':
          return payload?.showHidden ? [...ENTRIES, hiddenEntry] : ENTRIES;
        case 'fs_read_text_file':
          return 'hello from preview';
        case 'fs_read_file_base64':
          return 'data:text/plain;base64,aGVsbG8=';
        case 'fs_read_image_thumbnail':
          return 'data:image/png;base64,ZmFrZQ==';
        case 'fs_measure_entry_sizes':
          return (payload?.paths ?? []).map(path => ({
            path,
            bytes: [...ENTRIES, hiddenEntry].find(entry => entry.path === path)?.size ?? 0,
            is_dir: [...ENTRIES, hiddenEntry].find(entry => entry.path === path)?.is_dir ?? false,
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

    renderExplorer();

    await waitFor(() => {
      expect(vi.mocked(invoke).mock.calls.some(([command]) => command === 'fs_list_dir')).toBe(true);
    });

    useSettingsStore.getState().updateExplorer({ showHiddenFiles: true });

    await screen.findByText('secret.txt');

    lateDirectoryResponse.resolve([...ENTRIES]);

    await waitFor(() => {
      expect(screen.getByText('secret.txt')).toBeTruthy();
    });
  });

  it('does not trip the boot navigation mount path under StrictMode', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const appearance = resolveOverlayAppearance({ activeThemeId: 'operator' });

    render(
      <React.StrictMode>
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
        />
      </React.StrictMode>,
    );

    await screen.findByText('alpha');
    expect(consoleErrorSpy).not.toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });

  it('shows fallback preview states for oversized text and broken image previews', async () => {
    renderExplorer();
    await screen.findByText('large.txt');

    fireEvent.click(screen.getByText('large.txt'));
    await screen.findByText(/text preview unavailable/i);
    expect(screen.getByText(/file is too large to preview/i)).toBeTruthy();

    fireEvent.click(screen.getByText('broken.png'));
    await screen.findByText(/image preview unavailable/i);
    expect(screen.getByText(/file is too large to preview/i)).toBeTruthy();
  });

  it('renders grid thumbnails for visible image entries in icon layouts', async () => {
    const clientWidthDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth');
    const clientHeightDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientHeight');
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
      configurable: true,
      get() {
        return 1280;
      },
    });
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
      configurable: true,
      get() {
        return 900;
      },
    });
    useSettingsStore.getState().updateExplorer({ viewMode: 'icons-l' });

    try {
      renderExplorer();
      await screen.findByAltText('Thumbnail for preview.png');
      expect(vi.mocked(invoke)).toHaveBeenCalledWith('fs_read_image_thumbnail', {
        path: `${REPO_ROOT}\\preview.png`,
        maxWidth: 256,
        maxHeight: 256,
      });
    } finally {
      if (clientWidthDescriptor) {
        Object.defineProperty(HTMLElement.prototype, 'clientWidth', clientWidthDescriptor);
      } else {
        delete (HTMLElement.prototype as Partial<HTMLElement>).clientWidth;
      }
      if (clientHeightDescriptor) {
        Object.defineProperty(HTMLElement.prototype, 'clientHeight', clientHeightDescriptor);
      } else {
        delete (HTMLElement.prototype as Partial<HTMLElement>).clientHeight;
      }
    }
  });

  it('renders a dedicated experimental modes button and menu next to the standard layout control', async () => {
    renderExplorer();
    await screen.findByText('alpha');

    fireEvent.click(screen.getByRole('button', { name: /experimental view modes:/i }));

    expect(screen.getByRole('menu', { name: /explorer experimental modes menu/i })).toBeTruthy();
    expect(screen.getByRole('menuitemradio', { name: /adaptive semantic grid/i })).toBeTruthy();
    expect(screen.getByRole('menuitemradio', { name: /constellation view/i })).not.toBeDisabled();
    expect(screen.getByRole('menuitemradio', { name: /timeline surface/i })).not.toBeDisabled();
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

  it('activates constellation view without mutating the saved normal layout mode', async () => {
    useSettingsStore.getState().updateExplorer({ viewMode: 'details' });

    renderExplorer();
    await screen.findByText('alpha');

    fireEvent.click(screen.getByRole('button', { name: /experimental view modes:/i }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: /constellation view/i }));

    expect(useSettingsStore.getState().settings.explorer.experimentalViewMode).toBe('constellation');
    expect(useSettingsStore.getState().settings.explorer.viewMode).toBe('details');
    expect(screen.getAllByText(/constellation view/i).length).toBeGreaterThan(0);
  });

  it('activates timeline surface without mutating the saved normal layout mode', async () => {
    useSettingsStore.getState().updateExplorer({ viewMode: 'columns' });

    renderExplorer();
    await screen.findByText('alpha');

    fireEvent.click(screen.getByRole('button', { name: /experimental view modes:/i }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: /timeline surface/i }));

    expect(useSettingsStore.getState().settings.explorer.experimentalViewMode).toBe('timeline-surface');
    expect(useSettingsStore.getState().settings.explorer.viewMode).toBe('columns');
    expect(screen.getAllByText(/timeline surface/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/undated/i).length).toBeGreaterThan(0);
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

  it('starts the native drag bridge when no modifier is held for supported local entries', async () => {
    renderExplorer();
    const entry = await screen.findByText('notes.txt');
    const dataTransfer = createDataTransfer();
    const dragSource = entry.closest('[data-overlay-drag-source="file"]');
    if (!(dragSource instanceof HTMLElement)) {
      throw new Error('Expected draggable explorer entry');
    }

    const event = createEvent.dragStart(dragSource, { dataTransfer });
    fireEvent(dragSource, event);

    expect(dataTransfer.setData).toHaveBeenCalledWith(
      'application/x-overlayterm-drag-intent',
      'native-out',
    );
    expect(vi.mocked(invoke).mock.calls.some(([command]) => command === 'fs_start_native_file_drag')).toBe(true);
  });

  it('keeps drag intent internal when shift is held', async () => {
    renderExplorer();
    const entry = await screen.findByText('notes.txt');
    const dataTransfer = createDataTransfer();
    const dragSource = entry.closest('[data-overlay-drag-source=\"file\"]');
    if (!(dragSource instanceof HTMLElement)) {
      throw new Error('Expected draggable explorer entry');
    }

    const event = createEvent.dragStart(dragSource, { dataTransfer });
    Object.defineProperty(event, 'shiftKey', { value: true });
    fireEvent(dragSource, event);

    expect(invoke).not.toHaveBeenCalledWith('fs_start_native_file_drag', {
      paths: [`${REPO_ROOT}\\\\notes.txt`],
    });
    expect(dataTransfer.setData).toHaveBeenCalledWith('application/x-overlayterm-drag-intent', 'internal');
  });

});
