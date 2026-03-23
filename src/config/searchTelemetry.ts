import type { ExplorerPerformanceMetadata } from './performanceTelemetry';

export type FileSearchExecutionStrategy =
  | 'name_index_cache_hit'
  | 'content_index_cache_hit'
  | 'live_scan';

export type FileSearchContentCacheStatus =
  | 'not_requested'
  | 'cache_hit'
  | 'warmed'
  | 'disabled'
  | 'over_budget_fallback'
  | 'read_failure_fallback';

export interface FileSearchDiagnostics {
  executionStrategy: FileSearchExecutionStrategy;
  contentCacheStatus: FileSearchContentCacheStatus;
  scannedEntryCount: number;
  indexedEntryCount: number;
  contentCacheStoredFileCount: number;
  contentCacheStoredByteCount: number;
  truncatedByScanBudget: boolean;
}

export interface FileSearchResponse<Result> {
  results: Result[];
  diagnostics: FileSearchDiagnostics;
}

const SEARCH_DIAGNOSTIC_METADATA_FIELDS = [
  ['explorerSearchExecutionStrategy', 'executionStrategy'],
  ['explorerSearchContentCacheStatus', 'contentCacheStatus'],
  ['explorerSearchScannedEntryCount', 'scannedEntryCount'],
  ['explorerSearchIndexedEntryCount', 'indexedEntryCount'],
  ['explorerSearchContentCacheStoredFileCount', 'contentCacheStoredFileCount'],
  ['explorerSearchContentCacheStoredByteCount', 'contentCacheStoredByteCount'],
  ['explorerSearchTruncatedByScanBudget', 'truncatedByScanBudget'],
] as const satisfies ReadonlyArray<
  readonly [metadataKey: string, diagnosticsKey: keyof FileSearchDiagnostics]
>;

export function getExplorerSearchTelemetryMetadata(
  diagnostics: FileSearchDiagnostics,
): ExplorerPerformanceMetadata {
  const metadata: ExplorerPerformanceMetadata = {};

  for (const [metadataKey, diagnosticsKey] of SEARCH_DIAGNOSTIC_METADATA_FIELDS) {
    metadata[metadataKey] = diagnostics[diagnosticsKey];
  }

  return metadata;
}
