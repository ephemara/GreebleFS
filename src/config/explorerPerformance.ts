import shippedExplorerPerformanceManifestJson from "../../usr/profiles/default/explorer-performance/greeblefs-core/explorer-performance.json";
import type { BoundedWorkLaneOverflowStrategy } from "../runtime/boundedWorkLane";

export interface ExplorerFolderActivationPerformance {
  doubleClickPreviewPrimeDelayMs: number;
  doubleClickSecondClickImmediateNavigation: boolean;
  doubleClickDedupeWindowMs: number;
  pointerDownDirectoryWarmEnabled: boolean;
  directoryResultCacheTtlMs: number;
}

export interface ExplorerPerformanceBudgets {
  doubleClickSecondClickToNavigateDispatchMs: number;
}

export interface ExplorerViewportSchedulerPolicy {
  enabled: boolean;
  batchSize: number;
  maxConcurrentThumbnailReads: number;
  settleDelayMs: number;
  forwardPrefetchViewports: number;
  backwardPrefetchViewports: number;
  cancelStaleBatches: boolean;
  maxCandidateQueueDepth: number;
  queueOverflowStrategy: BoundedWorkLaneOverflowStrategy;
  previewPrefetch: ExplorerViewportPreviewPrefetchPolicy;
}

export interface ExplorerViewportPreviewPrefetchPolicy {
  enabled: boolean;
  batchSize: number;
  maxConcurrentPreviewReads: number;
  forwardPrefetchViewports: number;
  backwardPrefetchViewports: number;
  maxPreviewBytesPerEntry: number;
  maxBatchBytes: number;
  imagePrefetchMode: ExplorerViewportPreviewPrefetchImageMode;
}

export type ExplorerViewportPreviewPrefetchImageMode = "disabled" | "dataUri";

export type ShippedExplorerViewportSchedulerPolicy = Partial<
  Omit<ExplorerViewportSchedulerPolicy, "previewPrefetch">
> & {
  previewPrefetch?: Partial<ExplorerViewportPreviewPrefetchPolicy>;
};

export interface ExplorerPathIndexWarmupPolicy {
  enabled: boolean;
  allowDriveRoots: boolean;
  minimumImplicitRootDepth: number;
  maxImplicitRootDepth: number;
  maxBuildingRoots: number;
  requestCooldownMs: number;
  failureCooldownMs: number;
  staleBuildingRootMs: number;
  excludedDirectoryNames: string[];
}

export type ShippedExplorerPathIndexWarmupPolicy =
  Partial<ExplorerPathIndexWarmupPolicy>;

export type ExplorerNativeTaskGraphOverflowPolicy = "cancelStaleQueuedFirst";

export interface ExplorerNativeTaskGraphLaneConcurrency {
  directoryScan: number;
  recursiveSearch: number;
  checksum: number;
  thumbnailDecode: number;
  previewRead: number;
  archive: number;
  indexing: number;
  maintenance: number;
}

export interface ExplorerNativeTaskGraphPolicy {
  enabled: boolean;
  maxQueuedTasks: number;
  staleCancellationEnabled: boolean;
  telemetryEnabled: boolean;
  progressEmitIntervalMs: number;
  overflowPolicy: ExplorerNativeTaskGraphOverflowPolicy;
  laneConcurrency: ExplorerNativeTaskGraphLaneConcurrency;
}

export type ShippedExplorerNativeTaskGraphPolicy = Partial<
  Omit<ExplorerNativeTaskGraphPolicy, "laneConcurrency">
> & {
  laneConcurrency?: Partial<ExplorerNativeTaskGraphLaneConcurrency>;
};

export type ExplorerMessageStreamOverflowPolicy = "drop-oldest";

export interface ExplorerMessageStreamRingPolicy {
  maxMessages: number;
  maxBytes: number;
}

export interface ExplorerMessageStreamsPolicy {
  enabled: boolean;
  telemetryEnabled: boolean;
  maxFrameBytes: number;
  replayResponseLimit: number;
  overflowPolicy: ExplorerMessageStreamOverflowPolicy;
  defaultTopic: ExplorerMessageStreamRingPolicy;
  terminal: ExplorerMessageStreamRingPolicy;
  taskOutput: ExplorerMessageStreamRingPolicy;
  telemetry: ExplorerMessageStreamRingPolicy;
}

export type ShippedExplorerMessageStreamsPolicy = Partial<
  Omit<
    ExplorerMessageStreamsPolicy,
    "defaultTopic" | "terminal" | "taskOutput" | "telemetry"
  >
> & {
  defaultTopic?: Partial<ExplorerMessageStreamRingPolicy>;
  terminal?: Partial<ExplorerMessageStreamRingPolicy>;
  taskOutput?: Partial<ExplorerMessageStreamRingPolicy>;
  telemetry?: Partial<ExplorerMessageStreamRingPolicy>;
};

export interface ExplorerPreviewStreamingPolicy {
  enabled: boolean;
  chunkBytes: number;
  textMaxBytes: number;
  dataUriMaxBytes: number;
  binaryMaxBytes: number;
  archiveEntryMaxBytes: number;
}

export type ShippedExplorerPreviewStreamingPolicy =
  Partial<ExplorerPreviewStreamingPolicy>;

export interface ExplorerNativeBufferPoolPolicy {
  directorySnapshotMaxConcurrent: number;
  previewByteReadMaxConcurrent: number;
  maxQueuedRequests: number;
}

export type ShippedExplorerNativeBufferPoolPolicy =
  Partial<ExplorerNativeBufferPoolPolicy>;

export interface ShippedExplorerPerformanceManifest {
  version?: number;
  id?: string;
  name?: string;
  description?: string;
  folderActivation?: Partial<ExplorerFolderActivationPerformance>;
  budgets?: Partial<ExplorerPerformanceBudgets>;
  viewportScheduling?: ShippedExplorerViewportSchedulerPolicy;
  nativeTaskGraph?: ShippedExplorerNativeTaskGraphPolicy;
  messageStreams?: ShippedExplorerMessageStreamsPolicy;
  previewStreaming?: ShippedExplorerPreviewStreamingPolicy;
  nativeBufferPool?: ShippedExplorerNativeBufferPoolPolicy;
  pathIndexWarmup?: ShippedExplorerPathIndexWarmupPolicy;
}

export interface ExplorerPerformanceManifest {
  version: number;
  id: string;
  name: string;
  description: string;
  folderActivation: ExplorerFolderActivationPerformance;
  budgets: ExplorerPerformanceBudgets;
  viewportScheduling: ExplorerViewportSchedulerPolicy;
  nativeTaskGraph: ExplorerNativeTaskGraphPolicy;
  messageStreams: ExplorerMessageStreamsPolicy;
  previewStreaming: ExplorerPreviewStreamingPolicy;
  nativeBufferPool: ExplorerNativeBufferPoolPolicy;
  pathIndexWarmup: ExplorerPathIndexWarmupPolicy;
}

const defaultFolderActivationPerformance: ExplorerFolderActivationPerformance =
  Object.freeze({
    doubleClickPreviewPrimeDelayMs: 180,
    doubleClickSecondClickImmediateNavigation: true,
    doubleClickDedupeWindowMs: 96,
    pointerDownDirectoryWarmEnabled: true,
    directoryResultCacheTtlMs: 30_000,
  });

const defaultExplorerPerformanceBudgets: ExplorerPerformanceBudgets =
  Object.freeze({
    doubleClickSecondClickToNavigateDispatchMs: 1,
  });

const defaultExplorerViewportSchedulerPolicy: ExplorerViewportSchedulerPolicy =
  Object.freeze({
    enabled: true,
    batchSize: 12,
    maxConcurrentThumbnailReads: 4,
    settleDelayMs: 88,
    forwardPrefetchViewports: 1,
    backwardPrefetchViewports: 0.5,
    cancelStaleBatches: true,
    maxCandidateQueueDepth: 96,
    queueOverflowStrategy: "drop-lowest-priority",
    previewPrefetch: Object.freeze({
      enabled: true,
      batchSize: 3,
      maxConcurrentPreviewReads: 1,
      forwardPrefetchViewports: 0.25,
      backwardPrefetchViewports: 0,
      maxPreviewBytesPerEntry: 512 * 1024,
      maxBatchBytes: 1024 * 1024,
      imagePrefetchMode: "disabled",
    }),
  });

const defaultExplorerNativeTaskGraphPolicy: ExplorerNativeTaskGraphPolicy =
  Object.freeze({
    enabled: true,
    maxQueuedTasks: 256,
    staleCancellationEnabled: true,
    telemetryEnabled: true,
    progressEmitIntervalMs: 80,
    overflowPolicy: "cancelStaleQueuedFirst",
    laneConcurrency: Object.freeze({
      directoryScan: 2,
      recursiveSearch: 2,
      checksum: 1,
      thumbnailDecode: 4,
      previewRead: 2,
      archive: 1,
      indexing: 1,
      maintenance: 0,
    }),
  });

const defaultExplorerMessageStreamsPolicy: ExplorerMessageStreamsPolicy =
  Object.freeze({
    enabled: true,
    telemetryEnabled: true,
    maxFrameBytes: 32768,
    replayResponseLimit: 512,
    overflowPolicy: "drop-oldest",
    defaultTopic: Object.freeze({
      maxMessages: 256,
      maxBytes: 1024 * 1024,
    }),
    terminal: Object.freeze({
      maxMessages: 2048,
      maxBytes: 4 * 1024 * 1024,
    }),
    taskOutput: Object.freeze({
      maxMessages: 1024,
      maxBytes: 2 * 1024 * 1024,
    }),
    telemetry: Object.freeze({
      maxMessages: 400,
      maxBytes: 2 * 1024 * 1024,
    }),
  });

const defaultExplorerPreviewStreamingPolicy: ExplorerPreviewStreamingPolicy =
  Object.freeze({
    enabled: true,
    chunkBytes: 64 * 1024,
    textMaxBytes: 10 * 1024 * 1024,
    dataUriMaxBytes: 12 * 1024 * 1024,
    binaryMaxBytes: 256 * 1024 * 1024,
    archiveEntryMaxBytes: 256 * 1024 * 1024,
  });

const defaultExplorerNativeBufferPoolPolicy: ExplorerNativeBufferPoolPolicy =
  Object.freeze({
    directorySnapshotMaxConcurrent: 2,
    previewByteReadMaxConcurrent: 2,
    maxQueuedRequests: 512,
  });

const defaultExplorerPathIndexWarmupPolicy: ExplorerPathIndexWarmupPolicy =
  Object.freeze({
    enabled: false,
    allowDriveRoots: false,
    minimumImplicitRootDepth: 1,
    maxImplicitRootDepth: 5,
    maxBuildingRoots: 1,
    requestCooldownMs: 30_000,
    failureCooldownMs: 60_000,
    staleBuildingRootMs: 10 * 60_000,
    excludedDirectoryNames: Object.freeze([
      ".git",
      ".cache",
      "appdata",
      "node_modules",
      "onedrive",
      "target",
    ]) as unknown as string[],
  });

function clampNumber(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

function asFiniteNumber(
  value: unknown,
  fallback: number,
  options: { minimum: number; maximum: number },
): number {
  const candidate =
    typeof value === "number" && Number.isFinite(value) ? value : fallback;
  return clampNumber(candidate, options.minimum, options.maximum);
}

function asBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function asString(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : fallback;
}

function asQueueOverflowStrategy(
  value: unknown,
  fallback: BoundedWorkLaneOverflowStrategy,
): BoundedWorkLaneOverflowStrategy {
  if (
    value === "drop-lowest-priority" ||
    value === "drop-newest" ||
    value === "drop-oldest"
  ) {
    return value;
  }
  return fallback;
}

function asNativeTaskGraphOverflowPolicy(
  value: unknown,
  fallback: ExplorerNativeTaskGraphOverflowPolicy,
): ExplorerNativeTaskGraphOverflowPolicy {
  return value === "cancelStaleQueuedFirst" ? value : fallback;
}

function asMessageStreamOverflowPolicy(
  value: unknown,
  fallback: ExplorerMessageStreamOverflowPolicy,
): ExplorerMessageStreamOverflowPolicy {
  return value === "drop-oldest" ? value : fallback;
}

function asPreviewPrefetchImageMode(
  value: unknown,
  fallback: ExplorerViewportPreviewPrefetchImageMode,
): ExplorerViewportPreviewPrefetchImageMode {
  return value === "dataUri" || value === "disabled" ? value : fallback;
}

function asStringArray(value: unknown, fallback: readonly string[]): string[] {
  if (!Array.isArray(value)) {
    return [...fallback];
  }
  const normalized = value
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter((entry) => entry.length > 0);
  return normalized.length > 0 ? normalized : [...fallback];
}

function normalizeFolderActivationPerformance(
  value: ShippedExplorerPerformanceManifest["folderActivation"],
): ExplorerFolderActivationPerformance {
  return {
    doubleClickPreviewPrimeDelayMs: Math.round(
      asFiniteNumber(
        value?.doubleClickPreviewPrimeDelayMs,
        defaultFolderActivationPerformance.doubleClickPreviewPrimeDelayMs,
        { minimum: 0, maximum: 1000 },
      ),
    ),
    doubleClickSecondClickImmediateNavigation: asBoolean(
      value?.doubleClickSecondClickImmediateNavigation,
      defaultFolderActivationPerformance.doubleClickSecondClickImmediateNavigation,
    ),
    doubleClickDedupeWindowMs: Math.round(
      asFiniteNumber(
        value?.doubleClickDedupeWindowMs,
        defaultFolderActivationPerformance.doubleClickDedupeWindowMs,
        { minimum: 0, maximum: 1000 },
      ),
    ),
    pointerDownDirectoryWarmEnabled: asBoolean(
      value?.pointerDownDirectoryWarmEnabled,
      defaultFolderActivationPerformance.pointerDownDirectoryWarmEnabled,
    ),
    directoryResultCacheTtlMs: Math.round(
      asFiniteNumber(
        value?.directoryResultCacheTtlMs,
        defaultFolderActivationPerformance.directoryResultCacheTtlMs,
        { minimum: 0, maximum: 300_000 },
      ),
    ),
  };
}

function normalizeBudgets(
  value: ShippedExplorerPerformanceManifest["budgets"],
): ExplorerPerformanceBudgets {
  return {
    doubleClickSecondClickToNavigateDispatchMs: asFiniteNumber(
      value?.doubleClickSecondClickToNavigateDispatchMs,
      defaultExplorerPerformanceBudgets.doubleClickSecondClickToNavigateDispatchMs,
      { minimum: 0, maximum: 100 },
    ),
  };
}

function normalizeViewportScheduling(
  value: ShippedExplorerPerformanceManifest["viewportScheduling"],
): ExplorerViewportSchedulerPolicy {
  const previewPrefetch = value?.previewPrefetch;
  return {
    enabled: asBoolean(
      value?.enabled,
      defaultExplorerViewportSchedulerPolicy.enabled,
    ),
    batchSize: Math.round(
      asFiniteNumber(
        value?.batchSize,
        defaultExplorerViewportSchedulerPolicy.batchSize,
        { minimum: 1, maximum: 128 },
      ),
    ),
    maxConcurrentThumbnailReads: Math.round(
      asFiniteNumber(
        value?.maxConcurrentThumbnailReads,
        defaultExplorerViewportSchedulerPolicy.maxConcurrentThumbnailReads,
        { minimum: 1, maximum: 32 },
      ),
    ),
    settleDelayMs: Math.round(
      asFiniteNumber(
        value?.settleDelayMs,
        defaultExplorerViewportSchedulerPolicy.settleDelayMs,
        { minimum: 0, maximum: 1000 },
      ),
    ),
    forwardPrefetchViewports: asFiniteNumber(
      value?.forwardPrefetchViewports,
      defaultExplorerViewportSchedulerPolicy.forwardPrefetchViewports,
      { minimum: 0, maximum: 8 },
    ),
    backwardPrefetchViewports: asFiniteNumber(
      value?.backwardPrefetchViewports,
      defaultExplorerViewportSchedulerPolicy.backwardPrefetchViewports,
      { minimum: 0, maximum: 8 },
    ),
    cancelStaleBatches: asBoolean(
      value?.cancelStaleBatches,
      defaultExplorerViewportSchedulerPolicy.cancelStaleBatches,
    ),
    maxCandidateQueueDepth: Math.round(
      asFiniteNumber(
        value?.maxCandidateQueueDepth,
        defaultExplorerViewportSchedulerPolicy.maxCandidateQueueDepth,
        { minimum: 1, maximum: 1024 },
      ),
    ),
    queueOverflowStrategy: asQueueOverflowStrategy(
      value?.queueOverflowStrategy,
      defaultExplorerViewportSchedulerPolicy.queueOverflowStrategy,
    ),
    previewPrefetch: {
      enabled: asBoolean(
        previewPrefetch?.enabled,
        defaultExplorerViewportSchedulerPolicy.previewPrefetch.enabled,
      ),
      batchSize: Math.round(
        asFiniteNumber(
          previewPrefetch?.batchSize,
          defaultExplorerViewportSchedulerPolicy.previewPrefetch.batchSize,
          { minimum: 1, maximum: 64 },
        ),
      ),
      maxConcurrentPreviewReads: Math.round(
        asFiniteNumber(
          previewPrefetch?.maxConcurrentPreviewReads,
          defaultExplorerViewportSchedulerPolicy.previewPrefetch
            .maxConcurrentPreviewReads,
          { minimum: 1, maximum: 16 },
        ),
      ),
      forwardPrefetchViewports: asFiniteNumber(
        previewPrefetch?.forwardPrefetchViewports,
        defaultExplorerViewportSchedulerPolicy.previewPrefetch
          .forwardPrefetchViewports,
        { minimum: 0, maximum: 4 },
      ),
      backwardPrefetchViewports: asFiniteNumber(
        previewPrefetch?.backwardPrefetchViewports,
        defaultExplorerViewportSchedulerPolicy.previewPrefetch
          .backwardPrefetchViewports,
        { minimum: 0, maximum: 4 },
      ),
      maxPreviewBytesPerEntry: Math.round(
        asFiniteNumber(
          previewPrefetch?.maxPreviewBytesPerEntry,
          defaultExplorerViewportSchedulerPolicy.previewPrefetch
            .maxPreviewBytesPerEntry,
          { minimum: 1024, maximum: 32 * 1024 * 1024 },
        ),
      ),
      maxBatchBytes: Math.round(
        asFiniteNumber(
          previewPrefetch?.maxBatchBytes,
          defaultExplorerViewportSchedulerPolicy.previewPrefetch.maxBatchBytes,
          { minimum: 1024, maximum: 64 * 1024 * 1024 },
        ),
      ),
      imagePrefetchMode: asPreviewPrefetchImageMode(
        previewPrefetch?.imagePrefetchMode,
        defaultExplorerViewportSchedulerPolicy.previewPrefetch
          .imagePrefetchMode,
      ),
    },
  };
}

function normalizeNativeTaskGraph(
  value: ShippedExplorerPerformanceManifest["nativeTaskGraph"],
): ExplorerNativeTaskGraphPolicy {
  const laneConcurrency = value?.laneConcurrency;
  const defaultLanes = defaultExplorerNativeTaskGraphPolicy.laneConcurrency;

  return {
    enabled: asBoolean(
      value?.enabled,
      defaultExplorerNativeTaskGraphPolicy.enabled,
    ),
    maxQueuedTasks: Math.round(
      asFiniteNumber(
        value?.maxQueuedTasks,
        defaultExplorerNativeTaskGraphPolicy.maxQueuedTasks,
        { minimum: 1, maximum: 4096 },
      ),
    ),
    staleCancellationEnabled: asBoolean(
      value?.staleCancellationEnabled,
      defaultExplorerNativeTaskGraphPolicy.staleCancellationEnabled,
    ),
    telemetryEnabled: asBoolean(
      value?.telemetryEnabled,
      defaultExplorerNativeTaskGraphPolicy.telemetryEnabled,
    ),
    progressEmitIntervalMs: Math.round(
      asFiniteNumber(
        value?.progressEmitIntervalMs,
        defaultExplorerNativeTaskGraphPolicy.progressEmitIntervalMs,
        { minimum: 16, maximum: 1000 },
      ),
    ),
    overflowPolicy: asNativeTaskGraphOverflowPolicy(
      value?.overflowPolicy,
      defaultExplorerNativeTaskGraphPolicy.overflowPolicy,
    ),
    laneConcurrency: {
      directoryScan: Math.round(
        asFiniteNumber(
          laneConcurrency?.directoryScan,
          defaultLanes.directoryScan,
          { minimum: 1, maximum: 16 },
        ),
      ),
      recursiveSearch: Math.round(
        asFiniteNumber(
          laneConcurrency?.recursiveSearch,
          defaultLanes.recursiveSearch,
          { minimum: 1, maximum: 16 },
        ),
      ),
      checksum: Math.round(
        asFiniteNumber(laneConcurrency?.checksum, defaultLanes.checksum, {
          minimum: 1,
          maximum: 8,
        }),
      ),
      thumbnailDecode: Math.round(
        asFiniteNumber(
          laneConcurrency?.thumbnailDecode,
          defaultLanes.thumbnailDecode,
          { minimum: 1, maximum: 16 },
        ),
      ),
      previewRead: Math.round(
        asFiniteNumber(laneConcurrency?.previewRead, defaultLanes.previewRead, {
          minimum: 0,
          maximum: 16,
        }),
      ),
      archive: Math.round(
        asFiniteNumber(laneConcurrency?.archive, defaultLanes.archive, {
          minimum: 0,
          maximum: 8,
        }),
      ),
      indexing: Math.round(
        asFiniteNumber(laneConcurrency?.indexing, defaultLanes.indexing, {
          minimum: 0,
          maximum: 8,
        }),
      ),
      maintenance: Math.round(
        asFiniteNumber(laneConcurrency?.maintenance, defaultLanes.maintenance, {
          minimum: 0,
          maximum: 4,
        }),
      ),
    },
  };
}

function normalizeMessageStreamRing(
  value: Partial<ExplorerMessageStreamRingPolicy> | undefined,
  fallback: ExplorerMessageStreamRingPolicy,
  maxFrameBytes: number,
): ExplorerMessageStreamRingPolicy {
  return {
    maxMessages: Math.round(
      asFiniteNumber(value?.maxMessages, fallback.maxMessages, {
        minimum: 1,
        maximum: 65536,
      }),
    ),
    maxBytes: Math.round(
      asFiniteNumber(value?.maxBytes, fallback.maxBytes, {
        minimum: maxFrameBytes,
        maximum: 256 * 1024 * 1024,
      }),
    ),
  };
}

function normalizeMessageStreams(
  value: ShippedExplorerPerformanceManifest["messageStreams"],
): ExplorerMessageStreamsPolicy {
  const maxFrameBytes = Math.round(
    asFiniteNumber(
      value?.maxFrameBytes,
      defaultExplorerMessageStreamsPolicy.maxFrameBytes,
      { minimum: 1024, maximum: 1024 * 1024 },
    ),
  );
  return {
    enabled: asBoolean(
      value?.enabled,
      defaultExplorerMessageStreamsPolicy.enabled,
    ),
    telemetryEnabled: asBoolean(
      value?.telemetryEnabled,
      defaultExplorerMessageStreamsPolicy.telemetryEnabled,
    ),
    maxFrameBytes,
    replayResponseLimit: Math.round(
      asFiniteNumber(
        value?.replayResponseLimit,
        defaultExplorerMessageStreamsPolicy.replayResponseLimit,
        { minimum: 1, maximum: 4096 },
      ),
    ),
    overflowPolicy: asMessageStreamOverflowPolicy(
      value?.overflowPolicy,
      defaultExplorerMessageStreamsPolicy.overflowPolicy,
    ),
    defaultTopic: normalizeMessageStreamRing(
      value?.defaultTopic,
      defaultExplorerMessageStreamsPolicy.defaultTopic,
      maxFrameBytes,
    ),
    terminal: normalizeMessageStreamRing(
      value?.terminal,
      defaultExplorerMessageStreamsPolicy.terminal,
      maxFrameBytes,
    ),
    taskOutput: normalizeMessageStreamRing(
      value?.taskOutput,
      defaultExplorerMessageStreamsPolicy.taskOutput,
      maxFrameBytes,
    ),
    telemetry: normalizeMessageStreamRing(
      value?.telemetry,
      defaultExplorerMessageStreamsPolicy.telemetry,
      maxFrameBytes,
    ),
  };
}

function normalizePreviewStreaming(
  value: ShippedExplorerPerformanceManifest["previewStreaming"],
): ExplorerPreviewStreamingPolicy {
  return {
    enabled: asBoolean(
      value?.enabled,
      defaultExplorerPreviewStreamingPolicy.enabled,
    ),
    chunkBytes: Math.round(
      asFiniteNumber(
        value?.chunkBytes,
        defaultExplorerPreviewStreamingPolicy.chunkBytes,
        { minimum: 4 * 1024, maximum: 1024 * 1024 },
      ),
    ),
    textMaxBytes: Math.round(
      asFiniteNumber(
        value?.textMaxBytes,
        defaultExplorerPreviewStreamingPolicy.textMaxBytes,
        { minimum: 1024, maximum: 64 * 1024 * 1024 },
      ),
    ),
    dataUriMaxBytes: Math.round(
      asFiniteNumber(
        value?.dataUriMaxBytes,
        defaultExplorerPreviewStreamingPolicy.dataUriMaxBytes,
        { minimum: 1024, maximum: 64 * 1024 * 1024 },
      ),
    ),
    binaryMaxBytes: Math.round(
      asFiniteNumber(
        value?.binaryMaxBytes,
        defaultExplorerPreviewStreamingPolicy.binaryMaxBytes,
        { minimum: 1024, maximum: 512 * 1024 * 1024 },
      ),
    ),
    archiveEntryMaxBytes: Math.round(
      asFiniteNumber(
        value?.archiveEntryMaxBytes,
        defaultExplorerPreviewStreamingPolicy.archiveEntryMaxBytes,
        { minimum: 1024, maximum: 512 * 1024 * 1024 },
      ),
    ),
  };
}

function normalizeNativeBufferPool(
  value: ShippedExplorerPerformanceManifest["nativeBufferPool"],
): ExplorerNativeBufferPoolPolicy {
  return {
    directorySnapshotMaxConcurrent: Math.round(
      asFiniteNumber(
        value?.directorySnapshotMaxConcurrent,
        defaultExplorerNativeBufferPoolPolicy.directorySnapshotMaxConcurrent,
        { minimum: 1, maximum: 8 },
      ),
    ),
    previewByteReadMaxConcurrent: Math.round(
      asFiniteNumber(
        value?.previewByteReadMaxConcurrent,
        defaultExplorerNativeBufferPoolPolicy.previewByteReadMaxConcurrent,
        { minimum: 1, maximum: 8 },
      ),
    ),
    maxQueuedRequests: Math.round(
      asFiniteNumber(
        value?.maxQueuedRequests,
        defaultExplorerNativeBufferPoolPolicy.maxQueuedRequests,
        { minimum: 16, maximum: 4096 },
      ),
    ),
  };
}

function normalizePathIndexWarmup(
  value: ShippedExplorerPerformanceManifest["pathIndexWarmup"],
): ExplorerPathIndexWarmupPolicy {
  const minimumImplicitRootDepth = Math.round(
    asFiniteNumber(
      value?.minimumImplicitRootDepth,
      defaultExplorerPathIndexWarmupPolicy.minimumImplicitRootDepth,
      { minimum: 0, maximum: 16 },
    ),
  );
  const maxImplicitRootDepth = Math.round(
    asFiniteNumber(
      value?.maxImplicitRootDepth,
      defaultExplorerPathIndexWarmupPolicy.maxImplicitRootDepth,
      { minimum: minimumImplicitRootDepth, maximum: 32 },
    ),
  );

  return {
    enabled: asBoolean(
      value?.enabled,
      defaultExplorerPathIndexWarmupPolicy.enabled,
    ),
    allowDriveRoots: asBoolean(
      value?.allowDriveRoots,
      defaultExplorerPathIndexWarmupPolicy.allowDriveRoots,
    ),
    minimumImplicitRootDepth,
    maxImplicitRootDepth,
    maxBuildingRoots: Math.round(
      asFiniteNumber(
        value?.maxBuildingRoots,
        defaultExplorerPathIndexWarmupPolicy.maxBuildingRoots,
        { minimum: 0, maximum: 16 },
      ),
    ),
    requestCooldownMs: Math.round(
      asFiniteNumber(
        value?.requestCooldownMs,
        defaultExplorerPathIndexWarmupPolicy.requestCooldownMs,
        { minimum: 0, maximum: 10 * 60_000 },
      ),
    ),
    failureCooldownMs: Math.round(
      asFiniteNumber(
        value?.failureCooldownMs,
        defaultExplorerPathIndexWarmupPolicy.failureCooldownMs,
        { minimum: 0, maximum: 30 * 60_000 },
      ),
    ),
    staleBuildingRootMs: Math.round(
      asFiniteNumber(
        value?.staleBuildingRootMs,
        defaultExplorerPathIndexWarmupPolicy.staleBuildingRootMs,
        { minimum: 60_000, maximum: 24 * 60 * 60_000 },
      ),
    ),
    excludedDirectoryNames: asStringArray(
      value?.excludedDirectoryNames,
      defaultExplorerPathIndexWarmupPolicy.excludedDirectoryNames,
    ),
  };
}

export function normalizeExplorerPerformanceManifest(
  manifest: ShippedExplorerPerformanceManifest | null | undefined,
): ExplorerPerformanceManifest {
  return Object.freeze({
    version: Math.max(
      1,
      Math.round(
        asFiniteNumber(manifest?.version, 1, { minimum: 1, maximum: 1000 }),
      ),
    ),
    id: asString(manifest?.id, "greeblefs-core-explorer-performance"),
    name: asString(manifest?.name, "GreebleFS Core Explorer Performance"),
    description: asString(
      manifest?.description,
      "Canonical Explorer hot-path interaction tuning and latency budgets.",
    ),
    folderActivation: normalizeFolderActivationPerformance(
      manifest?.folderActivation,
    ),
    budgets: normalizeBudgets(manifest?.budgets),
    viewportScheduling: normalizeViewportScheduling(
      manifest?.viewportScheduling,
    ),
    nativeTaskGraph: normalizeNativeTaskGraph(manifest?.nativeTaskGraph),
    messageStreams: normalizeMessageStreams(manifest?.messageStreams),
    previewStreaming: normalizePreviewStreaming(manifest?.previewStreaming),
    nativeBufferPool: normalizeNativeBufferPool(manifest?.nativeBufferPool),
    pathIndexWarmup: normalizePathIndexWarmup(manifest?.pathIndexWarmup),
  });
}

export let explorerPerformance: ExplorerPerformanceManifest =
  normalizeExplorerPerformanceManifest(null);

export let EXPLORER_FOLDER_DOUBLE_CLICK_PREVIEW_DELAY_MS =
  defaultFolderActivationPerformance.doubleClickPreviewPrimeDelayMs;

export let EXPLORER_FOLDER_DOUBLE_CLICK_SECOND_CLICK_IMMEDIATE_NAVIGATION =
  defaultFolderActivationPerformance.doubleClickSecondClickImmediateNavigation;

export let EXPLORER_FOLDER_DOUBLE_CLICK_DEDUPE_WINDOW_MS =
  defaultFolderActivationPerformance.doubleClickDedupeWindowMs;

export let EXPLORER_POINTER_DOWN_DIRECTORY_WARM_ENABLED =
  defaultFolderActivationPerformance.pointerDownDirectoryWarmEnabled;

export let EXPLORER_DIRECTORY_RESULT_CACHE_TTL_MS =
  defaultFolderActivationPerformance.directoryResultCacheTtlMs;

export let EXPLORER_DOUBLE_CLICK_SECOND_CLICK_TO_NAVIGATE_DISPATCH_BUDGET_MS =
  defaultExplorerPerformanceBudgets.doubleClickSecondClickToNavigateDispatchMs;

export let EXPLORER_VIEWPORT_SCHEDULER_POLICY =
  defaultExplorerViewportSchedulerPolicy;

export let EXPLORER_NATIVE_TASK_GRAPH_POLICY =
  defaultExplorerNativeTaskGraphPolicy;

export let EXPLORER_MESSAGE_STREAMS_POLICY =
  defaultExplorerMessageStreamsPolicy;

export let EXPLORER_PREVIEW_STREAMING_POLICY =
  defaultExplorerPreviewStreamingPolicy;

export let EXPLORER_NATIVE_BUFFER_POOL_POLICY =
  defaultExplorerNativeBufferPoolPolicy;

export let EXPLORER_PATH_INDEX_WARMUP_POLICY =
  defaultExplorerPathIndexWarmupPolicy;

export function applyUsrExplorerPerformanceManifest(
  manifest: ShippedExplorerPerformanceManifest | null | undefined,
): void {
  explorerPerformance = normalizeExplorerPerformanceManifest(manifest);
  EXPLORER_FOLDER_DOUBLE_CLICK_PREVIEW_DELAY_MS =
    explorerPerformance.folderActivation.doubleClickPreviewPrimeDelayMs;
  EXPLORER_FOLDER_DOUBLE_CLICK_SECOND_CLICK_IMMEDIATE_NAVIGATION =
    explorerPerformance.folderActivation
      .doubleClickSecondClickImmediateNavigation;
  EXPLORER_FOLDER_DOUBLE_CLICK_DEDUPE_WINDOW_MS =
    explorerPerformance.folderActivation.doubleClickDedupeWindowMs;
  EXPLORER_POINTER_DOWN_DIRECTORY_WARM_ENABLED =
    explorerPerformance.folderActivation.pointerDownDirectoryWarmEnabled;
  EXPLORER_DIRECTORY_RESULT_CACHE_TTL_MS =
    explorerPerformance.folderActivation.directoryResultCacheTtlMs;
  EXPLORER_DOUBLE_CLICK_SECOND_CLICK_TO_NAVIGATE_DISPATCH_BUDGET_MS =
    explorerPerformance.budgets.doubleClickSecondClickToNavigateDispatchMs;
  EXPLORER_VIEWPORT_SCHEDULER_POLICY = explorerPerformance.viewportScheduling;
  EXPLORER_NATIVE_TASK_GRAPH_POLICY = explorerPerformance.nativeTaskGraph;
  EXPLORER_MESSAGE_STREAMS_POLICY = explorerPerformance.messageStreams;
  EXPLORER_PREVIEW_STREAMING_POLICY = explorerPerformance.previewStreaming;
  EXPLORER_NATIVE_BUFFER_POOL_POLICY = explorerPerformance.nativeBufferPool;
  EXPLORER_PATH_INDEX_WARMUP_POLICY = explorerPerformance.pathIndexWarmup;
}

applyUsrExplorerPerformanceManifest(
  shippedExplorerPerformanceManifestJson as ShippedExplorerPerformanceManifest,
);
