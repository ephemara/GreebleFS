import {
  buildRuntimeCachePolicyFingerprint,
  finalizePendingExplorerMetricSamples,
  getRuntimeCachePolicyTelemetryMetadata,
  type FsRuntimeCachePolicy,
} from '../config/runtimeCachePolicy';

describe('runtimeCachePolicy', () => {
  const basePolicy: FsRuntimeCachePolicy = {
    dirListCacheTtlMs: 2000,
    searchNameIndexCacheTtlMs: 1500,
    searchContentIndexCacheTtlMs: 1000,
    entrySizeCacheTtlMs: 10000,
    entrySizeScanBudgetMs: 900,
    searchContentIndexTotalBytesBudget: 12 * 1024 * 1024,
    maxSearchContentFileBytes: 8 * 1024 * 1024,
    searchMaxIndexedEntries: 25000,
    dirListCacheMaxKeys: 512,
    searchIndexCacheMaxKeys: 256,
    entrySizeCacheMaxKeys: 768,
    searchRequestScopeMaxKeys: 96,
    explorerTaskHistoryMaxEntries: 400,
    driveListCacheTtlMs: 5000,
  };
  const basePolicyFingerprint =
    '2000:1500:1000:10000:900:12582912:8388608:25000:512:256:768:96:400:5000';

  it('builds a stable fingerprint from the runtime cache policy values', () => {
    expect(buildRuntimeCachePolicyFingerprint(basePolicy)).toBe(
      basePolicyFingerprint,
    );
  });

  it('exposes telemetry metadata for a resolved runtime cache policy', () => {
    expect(getRuntimeCachePolicyTelemetryMetadata(basePolicy, 'ready')).toEqual({
      runtimeCachePolicyStatus: 'ready',
      runtimeCachePolicyFingerprint: basePolicyFingerprint,
      runtimeCachePolicyDirListCacheTtlMs: 2000,
      runtimeCachePolicySearchNameIndexCacheTtlMs: 1500,
      runtimeCachePolicySearchContentIndexCacheTtlMs: 1000,
      runtimeCachePolicyEntrySizeCacheTtlMs: 10000,
      runtimeCachePolicyEntrySizeScanBudgetMs: 900,
      runtimeCachePolicySearchContentIndexTotalBytesBudget: 12582912,
      runtimeCachePolicyMaxSearchContentFileBytes: 8388608,
      runtimeCachePolicySearchMaxIndexedEntries: 25000,
      runtimeCachePolicyDirListCacheMaxKeys: 512,
      runtimeCachePolicySearchIndexCacheMaxKeys: 256,
      runtimeCachePolicyEntrySizeCacheMaxKeys: 768,
      runtimeCachePolicySearchRequestScopeMaxKeys: 96,
      runtimeCachePolicyExplorerTaskHistoryMaxEntries: 400,
      runtimeCachePolicyDriveListCacheTtlMs: 5000,
    });
  });

  it('reports a missing runtime cache policy without stale numeric fields', () => {
    expect(getRuntimeCachePolicyTelemetryMetadata(null, 'failed')).toEqual({
      runtimeCachePolicyStatus: 'failed',
      runtimeCachePolicyFingerprint: null,
    });
  });

  it('finalizes queued explorer metrics with resolved runtime cache policy metadata', () => {
    expect(
      finalizePendingExplorerMetricSamples(
        [
          {
            metricId: 'explorer_navigation',
            durationMs: 45,
            recordedAt: 1234,
            metadata: {
              pathDepth: 3,
            },
          },
        ],
        getRuntimeCachePolicyTelemetryMetadata(basePolicy, 'ready'),
      ),
    ).toEqual([
      {
        metricId: 'explorer_navigation',
        durationMs: 45,
        recordedAt: 1234,
        metadata: {
          runtimeCachePolicyStatus: 'ready',
          runtimeCachePolicyFingerprint: basePolicyFingerprint,
          runtimeCachePolicyDirListCacheTtlMs: 2000,
          runtimeCachePolicySearchNameIndexCacheTtlMs: 1500,
          runtimeCachePolicySearchContentIndexCacheTtlMs: 1000,
          runtimeCachePolicyEntrySizeCacheTtlMs: 10000,
          runtimeCachePolicyEntrySizeScanBudgetMs: 900,
          runtimeCachePolicySearchContentIndexTotalBytesBudget: 12582912,
          runtimeCachePolicyMaxSearchContentFileBytes: 8388608,
          runtimeCachePolicySearchMaxIndexedEntries: 25000,
          runtimeCachePolicyDirListCacheMaxKeys: 512,
          runtimeCachePolicySearchIndexCacheMaxKeys: 256,
          runtimeCachePolicyEntrySizeCacheMaxKeys: 768,
          runtimeCachePolicySearchRequestScopeMaxKeys: 96,
          runtimeCachePolicyExplorerTaskHistoryMaxEntries: 400,
          runtimeCachePolicyDriveListCacheTtlMs: 5000,
          pathDepth: 3,
        },
      },
    ]);
  });
});
