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
import type {
  DriveInfo,
  GlobalSearchQueryOptions,
  GlobalSearchResultEntry,
  GlobalSearchScanSettings,
  GlobalSearchStatus,
} from "../generated/tauri";

export type GlobalSearchStatusValue = GlobalSearchStatus;
export type GlobalSearchResultValue = GlobalSearchResultEntry;
export type GlobalSearchQueryOptionsValue = GlobalSearchQueryOptions;
export type GlobalSearchScanSettingsValue = GlobalSearchScanSettings;

function deduplicateDriveRoots(drives: DriveInfo[]): string[] {
  const seen = new Set<string>();
  const roots: string[] = [];

  for (const drive of drives) {
    const root = drive.letter.trim();
    if (!root || seen.has(root)) {
      continue;
    }
    seen.add(root);
    roots.push(root);
  }

  return roots;
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

export async function initGlobalSearch(): Promise<GlobalSearchStatusValue> {
  return unwrapTauriResult(await commands.globalSearchInit());
}

export async function getGlobalSearchStatus(): Promise<GlobalSearchStatusValue> {
  return unwrapTauriResult(await commands.globalSearchGetStatus());
}

export async function getGlobalSearchDriveRoots(): Promise<string[]> {
  const drives = unwrapTauriResult(await commands.fsGetDrives());
  return deduplicateDriveRoots(drives);
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

  const [indexedResults, priorityResults] = await Promise.all([
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
  ]);

  return mergeGlobalSearchResults({
    indexedResults,
    priorityResults,
    limit,
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

  return unwrapTauriResult(
    await commands.globalSearchQueryUnderPath(
      args.rootPath,
      args.query,
      queryOptions,
    ),
  );
}
