import type {
  ExplorerPerformanceMetadata,
  ExplorerPerformanceMetricId,
} from './performanceTelemetry';

export interface FsRuntimeCachePolicy {
  dirListCacheTtlMs: number;
  searchNameIndexCacheTtlMs: number;
  searchContentIndexCacheTtlMs: number;
  entrySizeCacheTtlMs: number;
  entrySizeScanBudgetMs: number;
  searchContentIndexTotalBytesBudget: number;
  maxSearchContentFileBytes: number;
  searchMaxIndexedEntries: number;
}

export type RuntimeCachePolicyTelemetryStatus = 'pending' | 'ready' | 'failed' | 'unavailable';

export type RuntimeCachePolicyTelemetryMetadata = ExplorerPerformanceMetadata & {
  runtimeCachePolicyStatus: RuntimeCachePolicyTelemetryStatus;
  runtimeCachePolicyFingerprint: string | null;
};

export interface PendingExplorerMetricSample {
  metricId: ExplorerPerformanceMetricId;
  durationMs: number;
  recordedAt: number;
  metadata?: ExplorerPerformanceMetadata;
}

const RUNTIME_CACHE_POLICY_METADATA_FIELDS = [
  ['runtimeCachePolicyDirListCacheTtlMs', 'dirListCacheTtlMs'],
  ['runtimeCachePolicySearchNameIndexCacheTtlMs', 'searchNameIndexCacheTtlMs'],
  ['runtimeCachePolicySearchContentIndexCacheTtlMs', 'searchContentIndexCacheTtlMs'],
  ['runtimeCachePolicyEntrySizeCacheTtlMs', 'entrySizeCacheTtlMs'],
  ['runtimeCachePolicyEntrySizeScanBudgetMs', 'entrySizeScanBudgetMs'],
  ['runtimeCachePolicySearchContentIndexTotalBytesBudget', 'searchContentIndexTotalBytesBudget'],
  ['runtimeCachePolicyMaxSearchContentFileBytes', 'maxSearchContentFileBytes'],
  ['runtimeCachePolicySearchMaxIndexedEntries', 'searchMaxIndexedEntries'],
] as const satisfies ReadonlyArray<
  readonly [metadataKey: string, policyKey: keyof FsRuntimeCachePolicy]
>;

export function buildRuntimeCachePolicyFingerprint(policy: FsRuntimeCachePolicy): string {
  return RUNTIME_CACHE_POLICY_METADATA_FIELDS
    .map(([, policyKey]) => String(policy[policyKey]))
    .join(':');
}

export function getRuntimeCachePolicyTelemetryMetadata(
  policy: FsRuntimeCachePolicy | null,
  status: RuntimeCachePolicyTelemetryStatus,
): RuntimeCachePolicyTelemetryMetadata {
  const metadata: RuntimeCachePolicyTelemetryMetadata = {
    runtimeCachePolicyStatus: status,
    runtimeCachePolicyFingerprint: policy ? buildRuntimeCachePolicyFingerprint(policy) : null,
  };

  if (!policy) {
    return metadata;
  }

  for (const [metadataKey, policyKey] of RUNTIME_CACHE_POLICY_METADATA_FIELDS) {
    metadata[metadataKey] = policy[policyKey];
  }

  return metadata;
}

export function finalizePendingExplorerMetricSamples(
  samples: readonly PendingExplorerMetricSample[],
  runtimePolicyMetadata: RuntimeCachePolicyTelemetryMetadata,
): PendingExplorerMetricSample[] {
  return samples.map((sample) => ({
    ...sample,
    metadata: {
      ...runtimePolicyMetadata,
      ...(sample.metadata ?? {}),
    },
  }));
}
