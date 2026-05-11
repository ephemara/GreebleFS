import type {
  ExplorerViewportPreviewPrefetchPolicy,
  ExplorerViewportSchedulerPolicy,
} from "../config/explorerPerformance";
import {
  runBoundedWorkLane,
  type BoundedWorkLaneCandidate,
} from "./boundedWorkLane";

export type ExplorerViewportPreviewPrefetchPriority =
  | "selected-adjacent"
  | "visible"
  | "forward-prefetch"
  | "backward-prefetch";

export type ExplorerViewportPreviewPrefetchKind = "image" | "script" | "text";

export interface ExplorerViewportPreviewPrefetchWork {
  previewKind: ExplorerViewportPreviewPrefetchKind;
  previewCacheKey: string;
  estimatedByteSize?: number | null;
}

export interface ExplorerViewportPreviewPrefetchCandidate<TEntry>
  extends BoundedWorkLaneCandidate<ExplorerViewportPreviewPrefetchPriority> {
  entry: TEntry;
  path: string;
  identityKey: string;
  index: number;
  priority: ExplorerViewportPreviewPrefetchPriority;
  distanceFromViewport: number;
  sequence: number;
  previewKind: ExplorerViewportPreviewPrefetchKind;
  previewCacheKey: string;
  estimatedByteSize: number | null;
}

export interface ExplorerViewportPreviewPrefetchTelemetry {
  candidateCount: number;
  queuedCount: number;
  scheduledCount: number;
  completedCount: number;
  failedCount: number;
  droppedCount: number;
  budgetSkippedCount: number;
  coalescedCount: number;
  cancelled: boolean;
  maxConcurrentPreviewReads: number;
  maxPreviewBytesPerEntry: number;
  maxBatchBytes: number;
  imagePrefetchMode: ExplorerViewportPreviewPrefetchPolicy["imagePrefetchMode"];
  maxCandidateQueueDepth: number;
  queueOverflowStrategy: ExplorerViewportSchedulerPolicy["queueOverflowStrategy"];
  priorityCounts: Record<ExplorerViewportPreviewPrefetchPriority, number>;
}

export interface ExplorerViewportPreviewPrefetchCandidateResult<TEntry, TValue> {
  candidate: ExplorerViewportPreviewPrefetchCandidate<TEntry>;
  scheduledIndex: number;
  status: "fulfilled" | "rejected";
  value: TValue | null;
  error: unknown | null;
}

export interface ExplorerViewportPreviewPrefetchRunResult<TEntry, TValue> {
  scheduledCandidates: ExplorerViewportPreviewPrefetchCandidate<TEntry>[];
  results: ExplorerViewportPreviewPrefetchCandidateResult<TEntry, TValue>[];
  telemetry: ExplorerViewportPreviewPrefetchTelemetry;
}

export interface BuildExplorerViewportPreviewPrefetchCandidatesInput<TEntry> {
  entries: readonly TEntry[];
  viewportStartIndex: number;
  viewportEndIndex: number;
  selectedEntryPath?: string | null;
  selectedEntryIndex?: number | null;
  policy: ExplorerViewportPreviewPrefetchPolicy;
  getEntryPath: (entry: TEntry) => string;
  getEntryIdentityKey: (entry: TEntry) => string;
  resolvePreviewWork: (
    entry: TEntry,
  ) => ExplorerViewportPreviewPrefetchWork | null;
  shouldPrefetchEntry?: (entry: TEntry) => boolean;
}

export interface RunExplorerViewportPreviewPrefetchSchedulerInput<
  TEntry,
  TValue,
> {
  candidates: readonly ExplorerViewportPreviewPrefetchCandidate<TEntry>[];
  policy: ExplorerViewportSchedulerPolicy;
  prefetchCandidate: (
    candidate: ExplorerViewportPreviewPrefetchCandidate<TEntry>,
  ) => Promise<TValue | null>;
  isStale?: () => boolean;
}

const EMPTY_PRIORITY_COUNTS: Record<
  ExplorerViewportPreviewPrefetchPriority,
  number
> = {
  "selected-adjacent": 0,
  visible: 0,
  "forward-prefetch": 0,
  "backward-prefetch": 0,
};

export function buildExplorerViewportPreviewPrefetchCandidates<TEntry>(
  input: BuildExplorerViewportPreviewPrefetchCandidatesInput<TEntry>,
): ExplorerViewportPreviewPrefetchCandidate<TEntry>[] {
  const totalEntries = input.entries.length;
  if (!input.policy.enabled || totalEntries === 0) {
    return [];
  }

  const startIndex = clampIndex(input.viewportStartIndex, totalEntries);
  const endIndex = Math.max(
    startIndex,
    clampIndex(input.viewportEndIndex, totalEntries),
  );
  const viewportEntryCount = Math.max(1, endIndex - startIndex);
  const forwardPrefetchCount = Math.ceil(
    viewportEntryCount * input.policy.forwardPrefetchViewports,
  );
  const backwardPrefetchCount = Math.ceil(
    viewportEntryCount * input.policy.backwardPrefetchViewports,
  );

  const candidates: ExplorerViewportPreviewPrefetchCandidate<TEntry>[] = [];
  const seenWorkKeys = new Set<string>();
  let sequence = 0;

  const pushCandidate = (
    index: number,
    priority: ExplorerViewportPreviewPrefetchPriority,
    distanceFromViewport: number,
  ) => {
    const entry = input.entries[index];
    if (!entry || input.shouldPrefetchEntry?.(entry) === false) {
      return;
    }

    const previewWork = input.resolvePreviewWork(entry);
    if (!previewWork || seenWorkKeys.has(previewWork.previewCacheKey)) {
      return;
    }
    if (
      previewWork.previewKind === "image" &&
      input.policy.imagePrefetchMode === "disabled"
    ) {
      return;
    }
    seenWorkKeys.add(previewWork.previewCacheKey);

    candidates.push({
      entry,
      path: input.getEntryPath(entry),
      identityKey: input.getEntryIdentityKey(entry),
      workKey: previewWork.previewCacheKey,
      index,
      priority,
      priorityRank: priorityRank(priority),
      distanceFromViewport,
      distanceFromFocus: distanceFromViewport,
      sequence,
      previewKind: previewWork.previewKind,
      previewCacheKey: previewWork.previewCacheKey,
      estimatedByteSize: normalizeEstimatedByteSize(
        previewWork.estimatedByteSize,
      ),
    });
    sequence += 1;
  };

  const selectedEntryPath = input.selectedEntryPath?.trim();
  if (selectedEntryPath) {
    const selectedEntryIndex = normalizeOptionalEntryIndex(
      input.selectedEntryIndex,
      totalEntries,
    );
    const indexedSelectedEntry =
      selectedEntryIndex === null ? undefined : input.entries[selectedEntryIndex];
    const selectedIndex =
      selectedEntryIndex !== null &&
      indexedSelectedEntry !== undefined &&
      input.getEntryPath(indexedSelectedEntry) === selectedEntryPath
        ? selectedEntryIndex
        : input.entries.findIndex(
            (entry) => input.getEntryPath(entry) === selectedEntryPath,
          );
    if (selectedIndex >= 0) {
      pushCandidate(selectedIndex - 1, "selected-adjacent", 0);
      pushCandidate(selectedIndex + 1, "selected-adjacent", 0);
    }
  }

  for (let index = startIndex; index < endIndex; index += 1) {
    pushCandidate(index, "visible", 0);
  }

  const forwardEndIndex = Math.min(totalEntries, endIndex + forwardPrefetchCount);
  for (let index = endIndex; index < forwardEndIndex; index += 1) {
    pushCandidate(index, "forward-prefetch", index - endIndex + 1);
  }

  const backwardStartIndex = Math.max(0, startIndex - backwardPrefetchCount);
  for (let index = startIndex - 1; index >= backwardStartIndex; index -= 1) {
    pushCandidate(index, "backward-prefetch", startIndex - index);
  }

  return candidates.sort(compareExplorerViewportPreviewPrefetchCandidates);
}

export async function runExplorerViewportPreviewPrefetchScheduler<
  TEntry,
  TValue,
>(
  input: RunExplorerViewportPreviewPrefetchSchedulerInput<TEntry, TValue>,
): Promise<ExplorerViewportPreviewPrefetchRunResult<TEntry, TValue>> {
  const budgetedCandidates = applyPreviewPrefetchBudgets(
    input.candidates,
    input.policy.previewPrefetch,
  );
  const laneResult = await runBoundedWorkLane<
    ExplorerViewportPreviewPrefetchCandidate<TEntry>,
    TValue,
    ExplorerViewportPreviewPrefetchPriority
  >({
    candidates: budgetedCandidates.candidates,
    policy: {
      batchSize: input.policy.previewPrefetch.batchSize,
      maxConcurrentWork: input.policy.previewPrefetch.maxConcurrentPreviewReads,
      maxCandidateQueueDepth: input.policy.maxCandidateQueueDepth,
      queueOverflowStrategy: input.policy.queueOverflowStrategy,
      cancelStaleBatches: input.policy.cancelStaleBatches,
    },
    isStale: input.isStale,
    runCandidate: input.prefetchCandidate,
  });

  return {
    scheduledCandidates: laneResult.scheduledCandidates,
    results: laneResult.results,
    telemetry: {
      candidateCount: input.candidates.length,
      queuedCount: laneResult.telemetry.queuedCount,
      scheduledCount: laneResult.telemetry.scheduledCount,
      completedCount: laneResult.telemetry.completedCount,
      failedCount: laneResult.telemetry.failedCount,
      droppedCount: laneResult.telemetry.droppedCount,
      budgetSkippedCount: budgetedCandidates.skippedCount,
      coalescedCount: laneResult.telemetry.coalescedCount,
      cancelled: laneResult.telemetry.cancelled,
      maxConcurrentPreviewReads: laneResult.telemetry.maxConcurrentWork,
      maxPreviewBytesPerEntry:
        input.policy.previewPrefetch.maxPreviewBytesPerEntry,
      maxBatchBytes: input.policy.previewPrefetch.maxBatchBytes,
      imagePrefetchMode: input.policy.previewPrefetch.imagePrefetchMode,
      maxCandidateQueueDepth: laneResult.telemetry.maxCandidateQueueDepth,
      queueOverflowStrategy: laneResult.telemetry.queueOverflowStrategy,
      priorityCounts: createPriorityCounts(laneResult.scheduledCandidates),
    },
  };
}

function applyPreviewPrefetchBudgets<TEntry>(
  candidates: readonly ExplorerViewportPreviewPrefetchCandidate<TEntry>[],
  policy: ExplorerViewportPreviewPrefetchPolicy,
): {
  candidates: ExplorerViewportPreviewPrefetchCandidate<TEntry>[];
  skippedCount: number;
} {
  const orderedCandidates = [...candidates].sort(
    compareExplorerViewportPreviewPrefetchCandidates,
  );
  const maxEntryBytes = Math.max(1024, policy.maxPreviewBytesPerEntry);
  const maxBatchBytes = Math.max(maxEntryBytes, policy.maxBatchBytes);
  const accepted: ExplorerViewportPreviewPrefetchCandidate<TEntry>[] = [];
  let accumulatedBytes = 0;
  let skippedCount = 0;

  for (const candidate of orderedCandidates) {
    if (
      candidate.previewKind === "image" &&
      policy.imagePrefetchMode === "disabled"
    ) {
      skippedCount += 1;
      continue;
    }

    const estimatedBytes = candidate.estimatedByteSize ?? maxEntryBytes;
    if (estimatedBytes > maxEntryBytes) {
      skippedCount += 1;
      continue;
    }
    if (accumulatedBytes + estimatedBytes > maxBatchBytes) {
      skippedCount += 1;
      continue;
    }

    accumulatedBytes += estimatedBytes;
    accepted.push(candidate);
  }

  return { candidates: accepted, skippedCount };
}

function compareExplorerViewportPreviewPrefetchCandidates<TEntry>(
  left: ExplorerViewportPreviewPrefetchCandidate<TEntry>,
  right: ExplorerViewportPreviewPrefetchCandidate<TEntry>,
): number {
  const priorityDelta = left.priorityRank - right.priorityRank;
  if (priorityDelta !== 0) {
    return priorityDelta;
  }

  const distanceDelta = left.distanceFromViewport - right.distanceFromViewport;
  if (distanceDelta !== 0) {
    return distanceDelta;
  }

  return left.sequence - right.sequence;
}

function createPriorityCounts<TEntry>(
  candidates: readonly ExplorerViewportPreviewPrefetchCandidate<TEntry>[],
): Record<ExplorerViewportPreviewPrefetchPriority, number> {
  const counts = { ...EMPTY_PRIORITY_COUNTS };
  for (const candidate of candidates) {
    counts[candidate.priority] += 1;
  }
  return counts;
}

function priorityRank(priority: ExplorerViewportPreviewPrefetchPriority): number {
  switch (priority) {
    case "selected-adjacent":
      return 0;
    case "visible":
      return 1;
    case "forward-prefetch":
      return 2;
    case "backward-prefetch":
      return 3;
  }
}

function clampIndex(index: number, totalEntries: number): number {
  if (!Number.isFinite(index)) {
    return 0;
  }
  return Math.max(0, Math.min(totalEntries, Math.floor(index)));
}

function normalizeOptionalEntryIndex(
  index: number | null | undefined,
  totalEntries: number,
): number | null {
  if (typeof index !== "number" || !Number.isFinite(index)) {
    return null;
  }
  const normalizedIndex = Math.floor(index);
  return normalizedIndex >= 0 && normalizedIndex < totalEntries
    ? normalizedIndex
    : null;
}

function normalizeEstimatedByteSize(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? Math.floor(value)
    : null;
}
