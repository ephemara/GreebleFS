import type {
  GlobalSearchQueryOptions,
  GlobalSearchScanSettings,
  GlobalSearchStatus,
} from "../generated/tauri";

export const globalSearchPaletteConfig = {
  minimumQueryLength: 2,
  searchDebounceMs: 160,
  activeStatusPollIntervalMs: 350,
  idleStatusPollIntervalMs: 5000,
  resultLimit: 18,
  priorityPathResultLimit: 12,
  defaultScanDepth: 7,
  defaultParallelScan: false,
  defaultIgnoredPaths: ["/node_modules"],
  autoStartScanOnPaletteOpenIfIndexMissing: true,
  commandPalettePlaceholder: "Search commands, panels, plugins, files...",
} as const;

export type GlobalSearchPaletteStatusTone =
  | "muted"
  | "accent"
  | "warning"
  | "error";

export interface GlobalSearchPaletteStatusMessage {
  text: string;
  tone: GlobalSearchPaletteStatusTone;
}

function formatCompactCount(value: number): string {
  return new Intl.NumberFormat(undefined, {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

export function shouldRunGlobalSearchQuery(query: string): boolean {
  return query.trim().length >= globalSearchPaletteConfig.minimumQueryLength;
}

export function createDefaultGlobalSearchQueryOptions(
  limit: number = globalSearchPaletteConfig.resultLimit,
): GlobalSearchQueryOptions {
  return {
    limit,
    includeFiles: true,
    includeDirectories: true,
    exactMatch: false,
    typoTolerance: true,
    minScoreThreshold: null,
  };
}

export function createDefaultGlobalSearchScanSettings(
  driveRoots: string[],
): GlobalSearchScanSettings {
  return {
    scanDepth: globalSearchPaletteConfig.defaultScanDepth,
    ignoredPaths: [...globalSearchPaletteConfig.defaultIgnoredPaths],
    driveRoots,
    parallelScan: globalSearchPaletteConfig.defaultParallelScan,
  };
}

export function normalizeGlobalSearchPriorityPaths(paths: string[]): string[] {
  const seen = new Set<string>();
  const normalizedPaths: string[] = [];

  for (const rawPath of paths) {
    const path = rawPath.trim();
    if (!path || seen.has(path)) {
      continue;
    }
    seen.add(path);
    normalizedPaths.push(path);
  }

  return normalizedPaths;
}

export function describeGlobalSearchPaletteStatus(args: {
  status: GlobalSearchStatus | null;
  lastError: string | null;
  isSearching: boolean;
  query: string;
}): GlobalSearchPaletteStatusMessage | null {
  const trimmedQuery = args.query.trim();
  if (args.lastError) {
    return {
      text: `Global search error: ${args.lastError}`,
      tone: "error",
    };
  }

  if (!args.status) {
    return {
      text: "Preparing global file search...",
      tone: "muted",
    };
  }

  if (args.isSearching && shouldRunGlobalSearchQuery(trimmedQuery)) {
    return {
      text: "Searching indexed files and priority folders...",
      tone: "accent",
    };
  }

  if (args.status.isScanInProgress || args.status.isCommitting) {
    const driveProgress = args.status.totalDrivesCount > 0
      ? `${args.status.scannedDrivesCount}/${args.status.totalDrivesCount} roots`
      : "drive roots";
    return {
      text: `Indexing ${driveProgress} · ${formatCompactCount(args.status.indexedItemCount)} items`,
      tone: "warning",
    };
  }

  if (!args.status.isIndexValid || args.status.indexedItemCount === 0) {
    return {
      text: "No global file index yet. The first scan starts from the command palette.",
      tone: "muted",
    };
  }

  return {
    text: `Indexed ${formatCompactCount(args.status.indexedItemCount)} items across local drives`,
    tone: "muted",
  };
}
