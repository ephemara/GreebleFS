type FixtureFileEntry = {
  name: string;
  path: string;
  is_dir: boolean;
  size: number;
  modified: number;
  extension: string;
  is_hidden: boolean;
  is_symlink: boolean;
};

type UiRunnerFixture = {
  homeDir?: string;
  runtimeCachePolicy?: Record<string, unknown>;
  drives?: unknown[];
  directories?: Record<string, FixtureFileEntry[]>;
};

declare global {
  interface Window {
    __TAURON_UI_RUNNER__?: {
      fixture?: UiRunnerFixture;
      postMessage?: (payload: unknown) => void;
    };
  }
}

const FALLBACK_HOME_DIR = "C:\\workspace\\repo";
const FALLBACK_RUNTIME_CACHE_POLICY = {
  dirListCacheTtlMs: 2000,
  searchNameIndexCacheTtlMs: 1500,
  searchContentIndexCacheTtlMs: 1000,
  entrySizeCacheTtlMs: 10000,
  entrySizeScanBudgetMs: 900,
  searchContentIndexTotalBytesBudget: 12 * 1024 * 1024,
  maxSearchContentFileBytes: 8 * 1024 * 1024,
  searchMaxIndexedEntries: 25000,
};

function fixture(): UiRunnerFixture {
  return window.__TAURON_UI_RUNNER__?.fixture ?? {};
}

function homeDir(): string {
  return fixture().homeDir ?? FALLBACK_HOME_DIR;
}

function directoryEntries(path: string | undefined): FixtureFileEntry[] {
  const root = path || homeDir();
  return fixture().directories?.[root] ?? fixture().directories?.[homeDir()] ?? [];
}

function entrySizeResults(paths: string[]) {
  const allEntries = Object.values(fixture().directories ?? {})
    .flat()
    .filter(Boolean);
  return paths.map((path) => {
    const matchingEntry = allEntries.find((entry) => entry.path === path);
    return {
      path,
      bytes: matchingEntry?.size ?? 0,
      is_dir: matchingEntry?.is_dir ?? false,
      is_complete: true,
    };
  });
}

function logInvoke(command: string, args: unknown): void {
  window.__TAURON_UI_RUNNER__?.postMessage?.({
    kind: "fixture-host-invoke",
    command,
    args,
  });
}

export async function invoke<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  logInvoke(command, args ?? null);

  switch (command) {
    case "fs_get_home_dir":
      return homeDir() as T;
    case "fs_get_drives":
      return (fixture().drives ?? []) as T;
    case "fs_get_runtime_cache_policy":
      return (fixture().runtimeCachePolicy ?? FALLBACK_RUNTIME_CACHE_POLICY) as T;
    case "fs_list_dir":
    case "fs_list_dir_uncached":
      return directoryEntries(args?.path as string | undefined) as T;
    case "fs_measure_entry_sizes":
      return entrySizeResults((args?.paths as string[] | undefined) ?? []) as T;
    case "fs_resolve_native_icons":
    case "fs_search_entries":
      return [] as T;
    case "fs_search_entries_with_diagnostics":
      return {
        results: [],
        diagnostics: {
          executionStrategy: "fixture_host",
          contentCacheStatus: "not_requested",
          scannedEntryCount: 0,
          indexedEntryCount: 0,
          contentCacheStoredFileCount: 0,
          contentCacheStoredByteCount: 0,
          truncatedByScanBudget: false,
        },
      } as T;
    case "fs_read_text_file":
      return "" as T;
    case "fs_watch_entry_size_root":
    case "fs_unwatch_entry_size_root":
    case "fs_cancel_search_entries":
    case "git_exec":
      return null as T;
    default:
      console.warn(`Tauron UI fixture host returned null for ${command}`);
      return null as T;
  }
}

export function convertFileSrc(path: string): string {
  return `asset://localhost/${path}`;
}

export function isTauri(): boolean {
  return true;
}

export class Channel<T = unknown> {
  id = Math.random().toString(36).slice(2);
  onmessage?: ((message: T) => void) | null;

  send(message: T): void {
    this.onmessage?.(message);
  }
}
