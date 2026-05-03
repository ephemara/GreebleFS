import shippedExplorerPerformanceManifestJson from "../../usr/profiles/default/explorer-performance/greeblefs-core/explorer-performance.json";

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
}

export interface ShippedExplorerPerformanceManifest {
  version?: number;
  id?: string;
  name?: string;
  description?: string;
  folderActivation?: Partial<ExplorerFolderActivationPerformance>;
  budgets?: Partial<ExplorerPerformanceBudgets>;
  viewportScheduling?: Partial<ExplorerViewportSchedulerPolicy>;
}

export interface ExplorerPerformanceManifest {
  version: number;
  id: string;
  name: string;
  description: string;
  folderActivation: ExplorerFolderActivationPerformance;
  budgets: ExplorerPerformanceBudgets;
  viewportScheduling: ExplorerViewportSchedulerPolicy;
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
}

applyUsrExplorerPerformanceManifest(
  shippedExplorerPerformanceManifestJson as ShippedExplorerPerformanceManifest,
);
