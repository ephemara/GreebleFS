const HOME_DIR = 'C:\\OverlayTerm';
const DIRECTORY_ENTRIES = [
  createEntry('Projects', `${HOME_DIR}\\Projects`, true),
  createEntry('Screenshots', `${HOME_DIR}\\Screenshots`, true),
  createEntry('README.md', `${HOME_DIR}\\README.md`, false, 'md', 4_096),
  createEntry('notes.txt', `${HOME_DIR}\\notes.txt`, false, 'txt', 512),
];

const RUNTIME_CACHE_POLICY = {
  listDirectoryTtlMs: 3_000,
  listDirectoryUncachedTtlMs: 0,
  searchResultTtlMs: 8_000,
  searchContentCacheTtlMs: 45_000,
  entrySizeCacheTtlMs: 30_000,
  nativeIconCacheTtlMs: 30_000,
  maxSearchCacheEntries: 24,
  maxSearchContentCacheEntries: 12,
  maxSearchContentCachedBytes: 2_000_000,
  maxSearchContentFileBytes: 250_000,
  maxSearchEntriesPerQuery: 500,
};

export async function invoke<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  switch (command) {
    case 'fs_get_home_dir':
      return HOME_DIR as T;
    case 'fs_get_drives':
      return [] as T;
    case 'fs_get_runtime_cache_policy':
      return RUNTIME_CACHE_POLICY as T;
    case 'fs_list_dir':
    case 'fs_list_dir_uncached':
      return DIRECTORY_ENTRIES as T;
    case 'fs_measure_entry_sizes':
      return ((args?.paths as string[] | undefined) ?? []).map(path => ({
        path,
        bytes: path.toLowerCase().endsWith('.md') ? 4_096 : 1_024,
        is_dir: !/\.[^\\/]+$/.test(path),
        is_complete: true,
      })) as T;
    case 'fs_resolve_native_icons':
      return [] as T;
    case 'fs_search_entries':
      return [] as T;
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
      } as T;
    case 'fs_read_text_file':
      return '' as T;
    case 'git_exec':
      return '' as T;
    default:
      return null as T;
  }
}

export function convertFileSrc(path: string): string {
  return `asset://localhost/${path}`;
}

export function isTauri(): boolean {
  return true;
}

function createEntry(
  name: string,
  path: string,
  is_dir: boolean,
  extension = '',
  size = 0,
) {
  return {
    name,
    path,
    is_dir,
    extension,
    modified: Date.now(),
    size,
    is_hidden: false,
    is_symlink: false,
  };
}
