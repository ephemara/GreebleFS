import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { FileExplorer, invalidateExplorerResultCaches } from '../components/FileExplorer';
import { resolveOverlayAppearance } from '../config/appearance';
import type { FileSearchDiagnostics } from '../config/searchTelemetry';
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

const { explorerPolicyMockState } = vi.hoisted(() => ({
  explorerPolicyMockState: {
    sessions: new Map<
      string,
      {
        currentPath: string;
        history: string[];
        historyIdx: number;
      }
    >(),
  },
}));

vi.mock('../runtime/explorerBackend', async () => {
  const actual = await vi.importActual<typeof import('../runtime/explorerBackend')>(
    '../runtime/explorerBackend',
  );

  return {
    ...actual,
    explorerBackendContract: {
      ...actual.explorerBackendContract,
      bootstrapPolicySession: async (request: {
        sessionId: string;
        session: {
          currentPath: string;
          history: string[];
          historyIdx: number;
        };
      }) => {
        const snapshot = cloneMockExplorerPolicySessionSnapshot(request.session);
        explorerPolicyMockState.sessions.set(request.sessionId, snapshot);
        return { snapshot };
      },
      navigatePolicySession: async (request: {
        sessionId: string;
        path: string;
        pushHistory: boolean;
        historyIndex?: number | null;
        showHidden: boolean;
      }) => {
        const previous =
          explorerPolicyMockState.sessions.get(request.sessionId) ??
          createMockExplorerPolicySessionSnapshot(REPO_ROOT);
        const nextHistory = request.pushHistory
          ? [
              ...previous.history.slice(0, previous.historyIdx + 1),
              request.path,
            ]
          : [...previous.history];
        const nextHistoryIdx = request.pushHistory
          ? nextHistory.length - 1
          : request.historyIndex ?? previous.historyIdx;
        const snapshot = createMockExplorerPolicySessionSnapshot(
          request.path,
          nextHistory,
          nextHistoryIdx,
        );
        explorerPolicyMockState.sessions.set(request.sessionId, snapshot);
        const isHome = request.path === 'greeblefs://home';
        return {
          snapshot,
          listing: isHome
            ? null
            : await actual.explorerBackendContract.listLocation(
                request.path,
                request.showHidden,
              ),
          isHome,
          clearSelection: true,
        };
      },
      resolveEntryOpenWithPolicy: async (request: {
        entry: {
          path: string;
          is_dir: boolean;
          extension?: string;
        };
        previewEnabled: boolean;
      }) => {
        if (
          request.entry.is_dir ||
          isMockExplorerPolicyArchivePath(request.entry.path)
        ) {
          return {
            effect: 'navigate' as const,
            targetPath: request.entry.path,
            clearSelection: true,
          };
        }

        if (
          request.previewEnabled &&
          shouldMockExplorerPolicyPreviewEntry(request.entry.extension)
        ) {
          return {
            effect: 'preview' as const,
            targetPath: request.entry.path,
            clearSelection: false,
          };
        }

        return {
          effect: 'openPath' as const,
          targetPath: request.entry.path,
          requiresArchiveMaterialize: false,
          clearSelection: false,
        };
      },
    },
  };
});

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

interface TestSemanticIndexSummary {
  rootPath: string;
  indexed: boolean;
  stale: boolean;
  fileCount: number;
  chunkCount: number;
  indexedAt: number | null;
  modelId: string | null;
  backendKind: string | null;
  providerKind: string | null;
  lastError: string | null;
}

interface TestSemanticSearchResult extends TestFileEntry {
  relativePath: string;
  matchKind: null;
  snippet: string;
  lineNumber: number | null;
  semanticScore: number;
}

interface TestSemanticSearchResponse {
  results: TestSemanticSearchResult[];
  diagnostics: {
    queryKind: 'query' | 'similarity';
    backendKind: string;
    providerKind: string;
    modelId: string;
    indexedFileCount: number;
    indexedChunkCount: number;
    staleIndex: boolean;
    resultLimit: number;
    forceCpu: boolean;
  };
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

function cloneMockExplorerPolicySessionSnapshot(snapshot: {
  currentPath: string;
  history: string[];
  historyIdx: number;
}) {
  return {
    currentPath: snapshot.currentPath,
    history: [...snapshot.history],
    historyIdx: snapshot.historyIdx,
  };
}

function createMockExplorerPolicySessionSnapshot(
  currentPath: string,
  history: string[] = [currentPath],
  historyIdx: number = Math.max(history.length - 1, 0),
) {
  return cloneMockExplorerPolicySessionSnapshot({
    currentPath,
    history,
    historyIdx,
  });
}

function isMockExplorerPolicyArchivePath(path: string) {
  return /\.(zip|rar|7z|tar|gz|tgz|bz2|xz)$/i.test(path);
}

function shouldMockExplorerPolicyPreviewEntry(extension: string | undefined) {
  if (!extension) {
    return false;
  }
  return !/^(exe|bat|cmd|ps1|sh|appimage)$/i.test(extension);
}

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

const DEFAULT_SEARCH_DIAGNOSTICS: FileSearchDiagnostics = {
  executionStrategy: 'content_index_cache_hit',
  contentCacheStatus: 'cache_hit',
  scannedEntryCount: 0,
  indexedEntryCount: 64,
  contentCacheStoredFileCount: 0,
  contentCacheStoredByteCount: 0,
  truncatedByScanBudget: false,
};

const DEFAULT_SEMANTIC_INDEX_SUMMARY: TestSemanticIndexSummary = {
  rootPath: REPO_ROOT,
  indexed: true,
  stale: false,
  fileCount: 2,
  chunkCount: 4,
  indexedAt: 1710000000000,
  modelId: 'sentence-transformers/all-MiniLM-L6-v2',
  backendKind: 'onnx',
  providerKind: 'cudaPython',
  lastError: null,
};

const DEFAULT_SEMANTIC_SEARCH_RESPONSE: TestSemanticSearchResponse = {
  results: [
    {
      name: 'notes.txt',
      path: `${REPO_ROOT}\\notes.txt`,
      is_dir: false,
      size: 12,
      modified: 0,
      extension: 'txt',
      is_hidden: false,
      is_symlink: false,
      relativePath: 'notes.txt',
      matchKind: null,
      snippet: 'notes about greebles and semantic clustering',
      lineNumber: 3,
      semanticScore: 0.987,
    },
  ],
  diagnostics: {
    queryKind: 'query',
    backendKind: 'onnx',
    providerKind: 'cudaPython',
    modelId: 'sentence-transformers/all-MiniLM-L6-v2',
    indexedFileCount: 2,
    indexedChunkCount: 4,
    staleIndex: false,
    resultLimit: 60,
    forceCpu: false,
  },
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
      onOpenInFilesystemAquarium={() => {}}
      onOpenInTerminal={() => {}}
      onAddBookmark={async () => {}}
    />,
  );
}

function installExplorerBackendMock(
  diagnostics: FileSearchDiagnostics,
  options?: {
    semanticIndexSummary?: TestSemanticIndexSummary;
    semanticSearchResponse?: TestSemanticSearchResponse;
  },
) {
  const semanticIndexSummary =
    options?.semanticIndexSummary ?? DEFAULT_SEMANTIC_INDEX_SUMMARY;
  const semanticSearchResponse =
    options?.semanticSearchResponse ?? DEFAULT_SEMANTIC_SEARCH_RESPONSE;
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
          diagnostics,
        };
      case 'explorer_semantic_index_get_summary':
        return semanticIndexSummary;
      case 'explorer_semantic_search':
        return semanticSearchResponse;
      case 'fs_cancel_search_entries':
      case 'fs_watch_entry_size_root':
      case 'fs_unwatch_entry_size_root':
        return null;
      default:
        throw new Error(`Unexpected invoke command: ${command}`);
    }
  });
}

describe('FileExplorer search telemetry', () => {
  beforeEach(() => {
    explorerPolicyMockState.sessions.clear();
    resetOverlayTermStorage(window.localStorage);
    resetExplorerPerformanceSnapshot(window.localStorage);
    invalidateExplorerResultCaches();
    useSettingsStore.getState().resetToDefaults();
    useSettingsStore.getState().updateExplorer({ defaultPath: REPO_ROOT });
    useExplorerStore.getState().resetSession();
    useExplorerStore.getState().replaceRail(createDefaultExplorerRailSnapshot());
    useExplorerStore.getState().clearPersistenceNotice();

    installExplorerBackendMock(DEFAULT_SEARCH_DIAGNOSTICS);
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
          requestScope: expect.stringMatching(/^file-explorer:/),
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

  it.each([
    ['cold live scan', {
      executionStrategy: 'live_scan',
      contentCacheStatus: 'not_requested',
      scannedEntryCount: 384,
      indexedEntryCount: 0,
      contentCacheStoredFileCount: 0,
      contentCacheStoredByteCount: 0,
      truncatedByScanBudget: false,
    }],
    ['warm cache path', {
      executionStrategy: 'content_index_cache_hit',
      contentCacheStatus: 'warmed',
      scannedEntryCount: 0,
      indexedEntryCount: 96,
      contentCacheStoredFileCount: 12,
      contentCacheStoredByteCount: 4096,
      truncatedByScanBudget: false,
    }],
    ['over-budget fallback', {
      executionStrategy: 'live_scan',
      contentCacheStatus: 'over_budget_fallback',
      scannedEntryCount: 9000,
      indexedEntryCount: 0,
      contentCacheStoredFileCount: 0,
      contentCacheStoredByteCount: 0,
      truncatedByScanBudget: true,
    }],
  ] as const)('records %s search telemetry', async (_, diagnostics) => {
    installExplorerBackendMock(diagnostics);
    renderExplorer();

    await screen.findByText('alpha');
    fireEvent.keyDown(window, { key: 'l', ctrlKey: true });
    const omnibox = await screen.findByPlaceholderText(/Search or enter path/i);
    fireEvent.change(omnibox, { target: { value: 'needle' } });
    fireEvent.keyDown(omnibox, { key: 'Enter' });

    await waitFor(() => {
      expect(loadExplorerPerformanceSnapshot(window.localStorage).samples.explorer_search).toHaveLength(1);
    });

    const searchSample = loadExplorerPerformanceSnapshot(window.localStorage).samples.explorer_search[0];
    expect(searchSample?.metadata).toMatchObject({
      explorerSearchExecutionStrategy: diagnostics.executionStrategy,
      explorerSearchContentCacheStatus: diagnostics.contentCacheStatus,
      explorerSearchScannedEntryCount: diagnostics.scannedEntryCount,
      explorerSearchIndexedEntryCount: diagnostics.indexedEntryCount,
      explorerSearchContentCacheStoredFileCount: diagnostics.contentCacheStoredFileCount,
      explorerSearchContentCacheStoredByteCount: diagnostics.contentCacheStoredByteCount,
      explorerSearchTruncatedByScanBudget: diagnostics.truncatedByScanBudget,
    });
  });

  it('records semantic search telemetry and renders semantic result affordances', async () => {
    renderExplorer();

    await screen.findByText('alpha');
    fireEvent.keyDown(window, { key: 'f', ctrlKey: true, altKey: true });
    fireEvent.keyDown(window, { key: 'l', ctrlKey: true });

    const omnibox = await screen.findByPlaceholderText(/Search or enter path/i);
    fireEvent.change(omnibox, { target: { value: 'meaningful notes' } });
    fireEvent.keyDown(omnibox, { key: 'Enter' });

    await waitFor(() => {
      expect(vi.mocked(invoke)).toHaveBeenCalledWith(
        'explorer_semantic_search',
        expect.objectContaining({
          request: expect.objectContaining({
            rootPath: REPO_ROOT,
            query: 'meaningful notes',
          }),
        }),
      );
      expect(loadExplorerPerformanceSnapshot(window.localStorage).samples.explorer_search).toHaveLength(1);
    });

    expect(await screen.findByText('notes about greebles and semantic clustering')).toBeTruthy();
    expect(await screen.findByText('98.7%')).toBeTruthy();

    const searchSample = loadExplorerPerformanceSnapshot(window.localStorage).samples.explorer_search[0];
    expect(searchSample?.metadata).toMatchObject({
      success: true,
      includeContent: false,
      semanticSearch: true,
      semanticQueryKind: 'query',
      semanticBackendKind: 'onnx',
      semanticProviderKind: 'cudaPython',
      semanticIndexedFileCount: 2,
      semanticIndexedChunkCount: 4,
      semanticStaleIndex: false,
      semanticForcedCpu: false,
      resultCount: 1,
    });
  });

  it('emits a scoped cancel request when the search query is cleared', async () => {
    renderExplorer();

    await screen.findByText('alpha');
    fireEvent.keyDown(window, { key: 'l', ctrlKey: true });
    const omnibox = await screen.findByPlaceholderText(/Search or enter path/i);
    fireEvent.change(omnibox, { target: { value: 'needle' } });
    fireEvent.change(omnibox, { target: { value: '' } });

    await waitFor(() => {
      expect(vi.mocked(invoke)).toHaveBeenCalledWith(
        'fs_cancel_search_entries',
        expect.objectContaining({
          path: REPO_ROOT,
          requestScope: expect.stringMatching(/^file-explorer:/),
        }),
      );
    });
  });
});
