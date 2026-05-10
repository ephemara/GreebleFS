import {
  createDefaultGlobalSearchQueryOptions,
  createDefaultGlobalSearchScanSettings,
  globalSearchPaletteConfig,
  normalizeGlobalSearchPriorityPaths,
} from "../config/globalSearch";
import {
  commands,
  unwrapTauriResult,
} from "./tauriClient";
import { searchExplorerPathIndex } from "./explorerPathIndex";
import type {
  DriveInfo,
  FileEntry,
  GlobalSearchIndexQueryRequest,
  GlobalSearchQueryOptions,
  GlobalSearchResultEntry,
  GlobalSearchScanSettings,
  GlobalSearchStatus,
} from "../generated/tauri";

export type GlobalSearchStatusValue = GlobalSearchStatus;
export type GlobalSearchResultValue = GlobalSearchResultEntry;
export type GlobalSearchQueryOptionsValue = GlobalSearchQueryOptions;
export type GlobalSearchIndexQueryRequestValue = GlobalSearchIndexQueryRequest;
export type GlobalSearchScanSettingsValue = GlobalSearchScanSettings;

function deduplicateDriveRoots(drives: DriveInfo[]): string[] {
  const seen = new Set<string>();
  const roots: string[] = [];

  for (const drive of drives) {
    const root = drive.path.trim();
    if (!root || seen.has(root)) {
      continue;
    }
    seen.add(root);
    roots.push(root);
  }

  return roots;
}

function shouldAutoIndexDrive(drive: DriveInfo): boolean {
  if (!drive.supportsScan || drive.isNetwork || drive.isRemovable) {
    return false;
  }

  return (
    drive.classification !== "optical"
    && drive.classification !== "virtual"
    && drive.classification !== "unknown"
  );
}

function mergeGlobalSearchResults(args: {
  indexedResults: GlobalSearchResultEntry[];
  priorityResults: GlobalSearchResultEntry[];
  limit: number;
}): GlobalSearchResultEntry[] {
  const mergedByPath = new Map<string, GlobalSearchResultEntry>();

  for (const result of args.priorityResults) {
    mergedByPath.set(result.path, result);
  }
  for (const result of args.indexedResults) {
    if (!mergedByPath.has(result.path)) {
      mergedByPath.set(result.path, result);
    }
  }

  const mergedResults = [...mergedByPath.values()];
  mergedResults.sort((left, right) => {
    return right.score - left.score
      || right.modifiedTime - left.modifiedTime
      || left.path.localeCompare(right.path);
  });
  return mergedResults.slice(0, args.limit);
}

function scorePathIndexResult(query: string, name: string): number {
  const queryLower = query.trim().toLowerCase();
  const nameLower = name.trim().toLowerCase();
  if (!queryLower || !nameLower) {
    return 0;
  }
  if (nameLower === queryLower) {
    return 1;
  }
  if (nameLower.startsWith(queryLower)) {
    return 0.95 + Math.min(queryLower.length / nameLower.length, 1) * 0.05;
  }
  if (nameLower.includes(queryLower)) {
    return 0.8 + Math.min(queryLower.length / nameLower.length, 1) * 0.15;
  }
  return 0.5;
}

function pathIndexEntryToGlobalSearchResult(
  entry: FileEntry,
  query: string,
): GlobalSearchResultEntry {
  return {
    name: entry.name,
    extension: entry.extension || null,
    path: entry.path,
    size: entry.size,
    modifiedTime: entry.modified,
    accessedTime: 0,
    createdTime: 0,
    isFile: !entry.is_dir,
    isDir: entry.is_dir,
    isSymlink: entry.is_symlink,
    isHidden: entry.is_hidden,
    score: scorePathIndexResult(query, entry.name),
  };
}

async function queryPathIndexAsGlobalSearchResults(args: {
  query: string;
  rootPath?: string | null;
  limit: number;
  options: GlobalSearchQueryOptionsValue;
}): Promise<GlobalSearchResultEntry[]> {
  try {
    const entries = await searchExplorerPathIndex({
      rootPath: args.rootPath ?? null,
      query: args.query,
      limit: args.limit,
      includeHidden: false,
    });
    return entries
      .filter((entry) => {
        if (entry.is_dir) {
          return args.options.includeDirectories;
        }
        return args.options.includeFiles;
      })
      .map((entry) => pathIndexEntryToGlobalSearchResult(entry, args.query));
  } catch {
    return [];
  }
}

export async function initGlobalSearch(): Promise<GlobalSearchStatusValue> {
  return unwrapTauriResult(await commands.globalSearchInit());
}

export async function getGlobalSearchStatus(): Promise<GlobalSearchStatusValue> {
  return unwrapTauriResult(await commands.globalSearchGetStatus());
}

export async function getGlobalSearchDriveRoots(): Promise<string[]> {
  const drives = unwrapTauriResult(await commands.fsGetDrives());
  return deduplicateDriveRoots(drives.filter(shouldAutoIndexDrive));
}

export async function startGlobalSearchScan(
  settings?: Partial<GlobalSearchScanSettingsValue>,
): Promise<void> {
  const driveRoots = settings?.driveRoots?.length
    ? settings.driveRoots
    : await getGlobalSearchDriveRoots();
  if (driveRoots.length === 0) {
    throw new Error("No local drive roots are available for global search.");
  }

  const resolvedSettings: GlobalSearchScanSettingsValue = {
    ...createDefaultGlobalSearchScanSettings(driveRoots),
    ...settings,
    driveRoots,
  };

  unwrapTauriResult(await commands.globalSearchStartScan(resolvedSettings));
}

export async function cancelGlobalSearchScan(): Promise<void> {
  unwrapTauriResult(await commands.globalSearchCancelScan());
}

export async function queryGlobalSearch(args: {
  query: string;
  limit?: number;
  priorityPaths?: string[];
  queryOptions?: Partial<GlobalSearchQueryOptionsValue>;
}): Promise<GlobalSearchResultValue[]> {
  const limit = args.limit ?? globalSearchPaletteConfig.resultLimit;
  const queryOptions: GlobalSearchQueryOptionsValue = {
    ...createDefaultGlobalSearchQueryOptions(limit),
    ...args.queryOptions,
    limit,
  };
  const priorityPaths = normalizeGlobalSearchPriorityPaths(
    args.priorityPaths ?? [],
  );

  const [indexedResults, priorityResults, pathIndexResults] = await Promise.all([
    commands.globalSearchQuery(args.query, queryOptions).then(unwrapTauriResult),
    priorityPaths.length > 0
      ? commands.globalSearchQueryPaths(
        priorityPaths,
        args.query,
        {
          ...queryOptions,
          limit: Math.min(
            limit,
            globalSearchPaletteConfig.priorityPathResultLimit,
          ),
        },
      ).then(unwrapTauriResult)
      : Promise.resolve([]),
    queryPathIndexAsGlobalSearchResults({
      query: args.query,
      limit,
      options: queryOptions,
    }),
  ]);

  return mergeGlobalSearchResults({
    indexedResults: [...indexedResults, ...pathIndexResults],
    priorityResults,
    limit,
  });
}

export async function queryGlobalSearchIndex(
  request: Partial<GlobalSearchIndexQueryRequestValue>,
): Promise<GlobalSearchResultValue[]> {
  const limit = request.limit ?? globalSearchPaletteConfig.resultLimit;
  const resolvedRequest: GlobalSearchIndexQueryRequestValue = {
    query: request.query ?? null,
    limit,
    offset: request.offset ?? 0,
    includeFiles: request.includeFiles ?? true,
    includeDirectories: request.includeDirectories ?? false,
    includeHidden: request.includeHidden ?? false,
    extensions: request.extensions ?? [],
    rootPaths: request.rootPaths ?? [],
    exactMatch: request.exactMatch ?? false,
    typoTolerance: request.typoTolerance ?? true,
    minScoreThreshold: request.minScoreThreshold ?? null,
    sortKey: request.sortKey ?? null,
    sortDirection: request.sortDirection ?? null,
  };

  return unwrapTauriResult(await commands.globalSearchQueryIndex(resolvedRequest));
}

export async function findGlobalSearchByExtensions(args: {
  extensions: string[];
  query?: string | null;
  limit?: number;
  offset?: number;
  rootPaths?: string[];
  includeHidden?: boolean;
  sortKey?: GlobalSearchIndexQueryRequestValue["sortKey"];
  sortDirection?: GlobalSearchIndexQueryRequestValue["sortDirection"];
}): Promise<GlobalSearchResultValue[]> {
  return queryGlobalSearchIndex({
    query: args.query ?? null,
    limit: args.limit,
    offset: args.offset,
    includeFiles: true,
    includeDirectories: false,
    includeHidden: args.includeHidden ?? false,
    extensions: args.extensions,
    rootPaths: args.rootPaths ?? [],
    sortKey: args.sortKey ?? "modifiedTime",
    sortDirection: args.sortDirection ?? "desc",
  });
}

export async function queryGlobalSearchUnderPath(args: {
  rootPath: string;
  query: string;
  limit?: number;
  queryOptions?: Partial<GlobalSearchQueryOptionsValue>;
}): Promise<GlobalSearchResultValue[]> {
  const limit = args.limit ?? globalSearchPaletteConfig.resultLimit;
  const queryOptions: GlobalSearchQueryOptionsValue = {
    ...createDefaultGlobalSearchQueryOptions(limit),
    ...args.queryOptions,
    limit,
  };

  const [indexedResults, pathIndexResults] = await Promise.all([
    commands.globalSearchQueryUnderPath(
      args.rootPath,
      args.query,
      queryOptions,
    ).then(unwrapTauriResult),
    queryPathIndexAsGlobalSearchResults({
      query: args.query,
      rootPath: args.rootPath,
      limit,
      options: queryOptions,
    }),
  ]);

  return mergeGlobalSearchResults({
    indexedResults: [...indexedResults, ...pathIndexResults],
    priorityResults: [],
    limit,
  });
}
