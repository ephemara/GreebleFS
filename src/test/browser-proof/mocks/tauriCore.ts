import {
  buildEntrySizeResults,
  EXPLORER_ENTRIES,
  REPO_ROOT,
  RUNTIME_POLICY,
} from '../fileExplorer.repositoryPicker.fixtureData';

export async function invoke<T>(command: string, args?: unknown): Promise<T> {
  const payload = args as { paths?: string[] } | undefined;

  switch (command) {
    case 'fs_get_drives':
      return [] as T;
    case 'fs_get_home_dir':
      return REPO_ROOT as T;
    case 'fs_get_runtime_cache_policy':
      return RUNTIME_POLICY as T;
    case 'fs_list_dir':
    case 'fs_list_dir_uncached':
      return EXPLORER_ENTRIES as T;
    case 'fs_measure_entry_sizes':
      return buildEntrySizeResults(payload?.paths ?? []) as T;
    case 'fs_resolve_native_icons':
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
    case 'fs_watch_entry_size_root':
    case 'fs_unwatch_entry_size_root':
    case 'fs_cancel_search_entries':
      return null as T;
    default:
      throw new Error(`Unexpected proof invoke command: ${command}`);
  }
}

export function convertFileSrc(path: string): string {
  return `asset://localhost/${path}`;
}

export function isTauri(): boolean {
  return true;
}
