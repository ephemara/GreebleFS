import type { ExplorerViewportSchedulerPolicy } from "../config/explorerPerformance";

export type ExplorerViewportWorkPriority =
  | "visible"
  | "forward-prefetch"
  | "backward-prefetch"
  | "hover";

export interface ExplorerViewportWorkCandidate<TEntry> {
  entry: TEntry;
  path: string;
  identityKey: string;
  index: number;
  priority: ExplorerViewportWorkPriority;
  distanceFromViewport: number;
  isModelPreview: boolean;
  sequence: number;
}

export interface ExplorerViewportSchedulerTelemetry {
  candidateCount: number;
  scheduledCount: number;
  completedCount: number;
  failedCount: number;
  cancelled: boolean;
  maxConcurrentThumbnailReads: number;
  priorityCounts: Record<ExplorerViewportWorkPriority, number>;
}

export interface ExplorerViewportSchedulerCandidateResult<TEntry, TValue> {
  candidate: ExplorerViewportWorkCandidate<TEntry>;
  scheduledIndex: number;
  status: "fulfilled" | "rejected";
  value: TValue | null;
  error: unknown | null;
}

export interface ExplorerViewportSchedulerRunResult<TEntry, TValue> {
  scheduledCandidates: ExplorerViewportWorkCandidate<TEntry>[];
  results: ExplorerViewportSchedulerCandidateResult<TEntry, TValue>[];
  telemetry: ExplorerViewportSchedulerTelemetry;
}

export interface BuildExplorerViewportThumbnailWorkCandidatesInput<TEntry> {
  entries: readonly TEntry[];
  viewportStartIndex: number;
  viewportEndIndex: number;
  hoveredEntryPath?: string | null;
  policy: ExplorerViewportSchedulerPolicy;
  getEntryPath: (entry: TEntry) => string;
  getEntryIdentityKey: (entry: TEntry) => string;
  shouldScheduleEntry: (entry: TEntry) => boolean;
  isModelPreviewEntry?: (entry: TEntry) => boolean;
}

export interface RunExplorerViewportThumbnailSchedulerInput<TEntry, TValue> {
  candidates: readonly ExplorerViewportWorkCandidate<TEntry>[];
  policy: ExplorerViewportSchedulerPolicy;
  readCandidate: (
    candidate: ExplorerViewportWorkCandidate<TEntry>,
  ) => Promise<TValue | null>;
  isStale?: () => boolean;
}

const EMPTY_PRIORITY_COUNTS: Record<ExplorerViewportWorkPriority, number> = {
  visible: 0,
  "forward-prefetch": 0,
  "backward-prefetch": 0,
  hover: 0,
};

export function buildExplorerViewportThumbnailWorkCandidates<TEntry>(
  input: BuildExplorerViewportThumbnailWorkCandidatesInput<TEntry>,
): ExplorerViewportWorkCandidate<TEntry>[] {
  const totalEntries = input.entries.length;
  if (totalEntries === 0) {
    return [];
  }

  const startIndex = clampIndex(input.viewportStartIndex, totalEntries);
  const endIndex = Math.max(
    startIndex,
    clampIndex(input.viewportEndIndex, totalEntries),
  );
  const viewportEntryCount = Math.max(1, endIndex - startIndex);
  const forwardPrefetchCount = input.policy.enabled
    ? Math.ceil(viewportEntryCount * input.policy.forwardPrefetchViewports)
    : 0;
  const backwardPrefetchCount = input.policy.enabled
    ? Math.ceil(viewportEntryCount * input.policy.backwardPrefetchViewports)
    : 0;

  const candidates: ExplorerViewportWorkCandidate<TEntry>[] = [];
  const seenIdentityKeys = new Set<string>();
  let sequence = 0;

  const pushCandidate = (
    index: number,
    priority: ExplorerViewportWorkPriority,
    distanceFromViewport: number,
  ) => {
    const entry = input.entries[index];
    if (!entry || !input.shouldScheduleEntry(entry)) {
      return;
    }

    const identityKey = input.getEntryIdentityKey(entry);
    if (seenIdentityKeys.has(identityKey)) {
      return;
    }
    seenIdentityKeys.add(identityKey);

    candidates.push({
      entry,
      path: input.getEntryPath(entry),
      identityKey,
      index,
      priority,
      distanceFromViewport,
      isModelPreview: input.isModelPreviewEntry?.(entry) ?? false,
      sequence,
    });
    sequence += 1;
  };

  const hoveredEntryPath = input.hoveredEntryPath?.trim();
  if (hoveredEntryPath) {
    const hoveredEntryIndex = input.entries.findIndex(
      (entry) => input.getEntryPath(entry) === hoveredEntryPath,
    );
    if (hoveredEntryIndex >= 0) {
      pushCandidate(hoveredEntryIndex, "hover", 0);
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

  return candidates.sort(compareExplorerViewportWorkCandidates);
}

export async function runExplorerViewportThumbnailScheduler<TEntry, TValue>(
  input: RunExplorerViewportThumbnailSchedulerInput<TEntry, TValue>,
): Promise<ExplorerViewportSchedulerRunResult<TEntry, TValue>> {
  const scheduledCandidates = input.candidates.slice(
    0,
    Math.max(1, Math.floor(input.policy.batchSize)),
  );
  const priorityCounts = createPriorityCounts(scheduledCandidates);
  const maxConcurrentThumbnailReads = Math.max(
    1,
    Math.min(
      Math.floor(input.policy.maxConcurrentThumbnailReads),
      scheduledCandidates.length || 1,
    ),
  );
  const results: ExplorerViewportSchedulerCandidateResult<TEntry, TValue>[] = [];
  let nextCandidateIndex = 0;
  let cancelled = false;

  const takeNextCandidate = () => {
    if (input.policy.cancelStaleBatches && input.isStale?.()) {
      cancelled = true;
      return null;
    }
    if (nextCandidateIndex >= scheduledCandidates.length) {
      return null;
    }
    const scheduledIndex = nextCandidateIndex;
    nextCandidateIndex += 1;
    return {
      candidate: scheduledCandidates[scheduledIndex],
      scheduledIndex,
    };
  };

  const workers = Array.from(
    { length: maxConcurrentThumbnailReads },
    async () => {
      for (;;) {
        const next = takeNextCandidate();
        if (!next) {
          return;
        }

        try {
          const value = await input.readCandidate(next.candidate);
          if (input.policy.cancelStaleBatches && input.isStale?.()) {
            cancelled = true;
            return;
          }
          results.push({
            candidate: next.candidate,
            scheduledIndex: next.scheduledIndex,
            status: "fulfilled",
            value,
            error: null,
          });
        } catch (error) {
          if (input.policy.cancelStaleBatches && input.isStale?.()) {
            cancelled = true;
            return;
          }
          results.push({
            candidate: next.candidate,
            scheduledIndex: next.scheduledIndex,
            status: "rejected",
            value: null,
            error,
          });
        }
      }
    },
  );

  await Promise.all(workers);
  results.sort((left, right) => left.scheduledIndex - right.scheduledIndex);

  const failedCount = results.filter((result) => result.status === "rejected")
    .length;
  return {
    scheduledCandidates,
    results,
    telemetry: {
      candidateCount: input.candidates.length,
      scheduledCount: scheduledCandidates.length,
      completedCount: results.length,
      failedCount,
      cancelled,
      maxConcurrentThumbnailReads,
      priorityCounts,
    },
  };
}

function compareExplorerViewportWorkCandidates<TEntry>(
  left: ExplorerViewportWorkCandidate<TEntry>,
  right: ExplorerViewportWorkCandidate<TEntry>,
): number {
  const priorityDelta =
    priorityRank(left.priority) - priorityRank(right.priority);
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
  candidates: readonly ExplorerViewportWorkCandidate<TEntry>[],
): Record<ExplorerViewportWorkPriority, number> {
  const counts = { ...EMPTY_PRIORITY_COUNTS };
  for (const candidate of candidates) {
    counts[candidate.priority] += 1;
  }
  return counts;
}

function priorityRank(priority: ExplorerViewportWorkPriority): number {
  switch (priority) {
    case "hover":
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
