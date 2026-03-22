import {
  getExplorerSearchTelemetryMetadata,
  type FileSearchDiagnostics,
} from '../config/searchTelemetry';

describe('searchTelemetry', () => {
  it('maps backend search diagnostics into stable explorer telemetry metadata fields', () => {
    const diagnostics: FileSearchDiagnostics = {
      executionStrategy: 'content_index_cache_hit',
      contentCacheStatus: 'cache_hit',
      scannedEntryCount: 0,
      indexedEntryCount: 64,
      contentCacheStoredFileCount: 0,
      contentCacheStoredByteCount: 0,
    };

    expect(getExplorerSearchTelemetryMetadata(diagnostics)).toEqual({
      explorerSearchExecutionStrategy: 'content_index_cache_hit',
      explorerSearchContentCacheStatus: 'cache_hit',
      explorerSearchScannedEntryCount: 0,
      explorerSearchIndexedEntryCount: 64,
      explorerSearchContentCacheStoredFileCount: 0,
      explorerSearchContentCacheStoredByteCount: 0,
    });
  });
});
