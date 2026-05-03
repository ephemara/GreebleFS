import shippedExplorerPerformanceManifestJson from "../../usr/profiles/default/explorer-performance/greeblefs-core/explorer-performance.json";
import type { BoundedWorkLaneOverflowStrategy } from "../runtime/boundedWorkLane";

export interface ExplorerFolderActivationPerformance {
  doubleClickPreviewPrimeDelayMs: number;
  doubleClickSecondClickImmediateNavigation: boolean;
  doubleClickDedupeWindowMs: number;
  pointerDownDirectoryWarmEnabled: boolean;
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
}

export type ShippedExplorerViewportSchedulerPolicy =
  Partial<Omit<ExplorerViewportSchedulerPolicy, "previewPrefetch">> & {
    previewPrefetch?: Partial<ExplorerViewportPreviewPrefetchPolicy>;
  };

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

export type ShippedExplorerNativeTaskGraphPolicy =
  Partial<Omit<ExplorerNativeTaskGraphPolicy, "laneConcurrency">> & {
    laneConcurrency?: Partial<ExplorerNativeTaskGraphLaneConcurrency>;
  };

export interface ShippedExplorerPerformanceManifest {
  version?: number;
  id?: string;
  name?: string;
  description?: string;
  folderActivation?: Partial<ExplorerFolderActivationPerformance>;
  budgets?: Partial<ExplorerPerformanceBudgets>;
  viewportScheduling?: ShippedExplorerViewportSchedulerPolicy;
  nativeTaskGraph?: ShippedExplorerNativeTaskGraphPolicy;
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
}

const defaultFolderActivationPerformance: ExplorerFolderActivationPerformance = Object.freeze({
  doubleClickPreviewPrimeDelayMs: 180,
  doubleClickSecondClickImmediateNavigation: true,
  doubleClickDedupeWindowMs: 96,
  pointerDownDirectoryWarmEnabled: true,
});

const defaultExplorerPerformanceBudgets: ExplorerPerformanceBudgets = Object.freeze({
  doubleClickSecondClickToNavigateDispatchMs: 1,
});

const defaultExplorerViewportSchedulerPolicy: ExplorerViewportSchedulerPolicy = Object.freeze({
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
    batchSize: 4,
    maxConcurrentPreviewReads: 2,
    forwardPrefetchViewports: 0.5,
    backwardPrefetchViewports: 0.25,
  }),
});

const defaultExplorerNativeTaskGraphPolicy: ExplorerNativeTaskGraphPolicy = Object.freeze({
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
    thumbnailDecode: 0,
    previewRead: 0,
    archive: 0,
    indexing: 0,
    maintenance: 0,
  }),
});

function clampNumber(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

function asFiniteNumber(
  value: unknown,
  fallback: number,
  options: { minimum: number; maximum: number },
): number {
  const candidate = typeof value === "number" && Number.isFinite(value)
    ? value
    : fallback;
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

function normalizeFolderActivationPerformance(
  value: ShippedExplorerPerformanceManifest["folderActivation"],
): ExplorerFolderActivationPerformance {
  return {
    doubleClickPreviewPrimeDelayMs: Math.round(asFiniteNumber(
      value?.doubleClickPreviewPrimeDelayMs,
      defaultFolderActivationPerformance.doubleClickPreviewPrimeDelayMs,
      { minimum: 0, maximum: 1000 },
    )),
    doubleClickSecondClickImmediateNavigation: asBoolean(
      value?.doubleClickSecondClickImmediateNavigation,
      defaultFolderActivationPerformance.doubleClickSecondClickImmediateNavigation,
    ),
    doubleClickDedupeWindowMs: Math.round(asFiniteNumber(
      value?.doubleClickDedupeWindowMs,
      defaultFolderActivationPerformance.doubleClickDedupeWindowMs,
      { minimum: 0, maximum: 1000 },
    )),
    pointerDownDirectoryWarmEnabled: asBoolean(
      value?.pointerDownDirectoryWarmEnabled,
      defaultFolderActivationPerformance.pointerDownDirectoryWarmEnabled,
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
    batchSize: Math.round(asFiniteNumber(
      value?.batchSize,
      defaultExplorerViewportSchedulerPolicy.batchSize,
      { minimum: 1, maximum: 128 },
    )),
    maxConcurrentThumbnailReads: Math.round(asFiniteNumber(
      value?.maxConcurrentThumbnailReads,
      defaultExplorerViewportSchedulerPolicy.maxConcurrentThumbnailReads,
      { minimum: 1, maximum: 32 },
    )),
    settleDelayMs: Math.round(asFiniteNumber(
      value?.settleDelayMs,
      defaultExplorerViewportSchedulerPolicy.settleDelayMs,
      { minimum: 0, maximum: 1000 },
    )),
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
    maxCandidateQueueDepth: Math.round(asFiniteNumber(
      value?.maxCandidateQueueDepth,
      defaultExplorerViewportSchedulerPolicy.maxCandidateQueueDepth,
      { minimum: 1, maximum: 1024 },
    )),
    queueOverflowStrategy: asQueueOverflowStrategy(
      value?.queueOverflowStrategy,
      defaultExplorerViewportSchedulerPolicy.queueOverflowStrategy,
    ),
    previewPrefetch: {
      enabled: asBoolean(
        previewPrefetch?.enabled,
        defaultExplorerViewportSchedulerPolicy.previewPrefetch.enabled,
      ),
      batchSize: Math.round(asFiniteNumber(
        previewPrefetch?.batchSize,
        defaultExplorerViewportSchedulerPolicy.previewPrefetch.batchSize,
        { minimum: 1, maximum: 64 },
      )),
      maxConcurrentPreviewReads: Math.round(asFiniteNumber(
        previewPrefetch?.maxConcurrentPreviewReads,
        defaultExplorerViewportSchedulerPolicy.previewPrefetch
          .maxConcurrentPreviewReads,
        { minimum: 1, maximum: 16 },
      )),
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
    },
  };
}

function normalizeNativeTaskGraph(
  value: ShippedExplorerPerformanceManifest["nativeTaskGraph"],
): ExplorerNativeTaskGraphPolicy {
  const laneConcurrency = value?.laneConcurrency;
  const defaultLanes = defaultExplorerNativeTaskGraphPolicy.laneConcurrency;

  return {
    enabled: asBoolean(value?.enabled, defaultExplorerNativeTaskGraphPolicy.enabled),
    maxQueuedTasks: Math.round(asFiniteNumber(
      value?.maxQueuedTasks,
      defaultExplorerNativeTaskGraphPolicy.maxQueuedTasks,
      { minimum: 1, maximum: 4096 },
    )),
    staleCancellationEnabled: asBoolean(
      value?.staleCancellationEnabled,
      defaultExplorerNativeTaskGraphPolicy.staleCancellationEnabled,
    ),
    telemetryEnabled: asBoolean(
      value?.telemetryEnabled,
      defaultExplorerNativeTaskGraphPolicy.telemetryEnabled,
    ),
    progressEmitIntervalMs: Math.round(asFiniteNumber(
      value?.progressEmitIntervalMs,
      defaultExplorerNativeTaskGraphPolicy.progressEmitIntervalMs,
      { minimum: 16, maximum: 1000 },
    )),
    overflowPolicy: asNativeTaskGraphOverflowPolicy(
      value?.overflowPolicy,
      defaultExplorerNativeTaskGraphPolicy.overflowPolicy,
    ),
    laneConcurrency: {
      directoryScan: Math.round(asFiniteNumber(
        laneConcurrency?.directoryScan,
        defaultLanes.directoryScan,
        { minimum: 1, maximum: 16 },
      )),
      recursiveSearch: Math.round(asFiniteNumber(
        laneConcurrency?.recursiveSearch,
        defaultLanes.recursiveSearch,
        { minimum: 1, maximum: 16 },
      )),
      checksum: Math.round(asFiniteNumber(
        laneConcurrency?.checksum,
        defaultLanes.checksum,
        { minimum: 1, maximum: 8 },
      )),
      thumbnailDecode: Math.round(asFiniteNumber(
        laneConcurrency?.thumbnailDecode,
        defaultLanes.thumbnailDecode,
        { minimum: 0, maximum: 16 },
      )),
      previewRead: Math.round(asFiniteNumber(
        laneConcurrency?.previewRead,
        defaultLanes.previewRead,
        { minimum: 0, maximum: 16 },
      )),
      archive: Math.round(asFiniteNumber(
        laneConcurrency?.archive,
        defaultLanes.archive,
        { minimum: 0, maximum: 8 },
      )),
      indexing: Math.round(asFiniteNumber(
        laneConcurrency?.indexing,
        defaultLanes.indexing,
        { minimum: 0, maximum: 8 },
      )),
      maintenance: Math.round(asFiniteNumber(
        laneConcurrency?.maintenance,
        defaultLanes.maintenance,
        { minimum: 0, maximum: 4 },
      )),
    },
  };
}

export function normalizeExplorerPerformanceManifest(
  manifest: ShippedExplorerPerformanceManifest | null | undefined,
): ExplorerPerformanceManifest {
  return Object.freeze({
    version: Math.max(
      1,
      Math.round(asFiniteNumber(manifest?.version, 1, { minimum: 1, maximum: 1000 })),
    ),
    id: asString(manifest?.id, "greeblefs-core-explorer-performance"),
    name: asString(
      manifest?.name,
      "GreebleFS Core Explorer Performance",
    ),
    description: asString(
      manifest?.description,
      "Canonical Explorer hot-path interaction tuning and latency budgets.",
    ),
    folderActivation: normalizeFolderActivationPerformance(
      manifest?.folderActivation,
    ),
    budgets: normalizeBudgets(manifest?.budgets),
    viewportScheduling: normalizeViewportScheduling(manifest?.viewportScheduling),
    nativeTaskGraph: normalizeNativeTaskGraph(manifest?.nativeTaskGraph),
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

export let EXPLORER_DOUBLE_CLICK_SECOND_CLICK_TO_NAVIGATE_DISPATCH_BUDGET_MS =
  defaultExplorerPerformanceBudgets.doubleClickSecondClickToNavigateDispatchMs;

export let EXPLORER_VIEWPORT_SCHEDULER_POLICY =
  defaultExplorerViewportSchedulerPolicy;

export let EXPLORER_NATIVE_TASK_GRAPH_POLICY =
  defaultExplorerNativeTaskGraphPolicy;

export function applyUsrExplorerPerformanceManifest(
  manifest: ShippedExplorerPerformanceManifest | null | undefined,
): void {
  explorerPerformance = normalizeExplorerPerformanceManifest(manifest);
  EXPLORER_FOLDER_DOUBLE_CLICK_PREVIEW_DELAY_MS =
    explorerPerformance.folderActivation.doubleClickPreviewPrimeDelayMs;
  EXPLORER_FOLDER_DOUBLE_CLICK_SECOND_CLICK_IMMEDIATE_NAVIGATION =
    explorerPerformance.folderActivation.doubleClickSecondClickImmediateNavigation;
  EXPLORER_FOLDER_DOUBLE_CLICK_DEDUPE_WINDOW_MS =
    explorerPerformance.folderActivation.doubleClickDedupeWindowMs;
  EXPLORER_POINTER_DOWN_DIRECTORY_WARM_ENABLED =
    explorerPerformance.folderActivation.pointerDownDirectoryWarmEnabled;
  EXPLORER_DOUBLE_CLICK_SECOND_CLICK_TO_NAVIGATE_DISPATCH_BUDGET_MS =
    explorerPerformance.budgets.doubleClickSecondClickToNavigateDispatchMs;
  EXPLORER_VIEWPORT_SCHEDULER_POLICY =
    explorerPerformance.viewportScheduling;
  EXPLORER_NATIVE_TASK_GRAPH_POLICY = explorerPerformance.nativeTaskGraph;
}

applyUsrExplorerPerformanceManifest(
  shippedExplorerPerformanceManifestJson as ShippedExplorerPerformanceManifest,
);
