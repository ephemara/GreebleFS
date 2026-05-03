export type BoundedWorkLaneOverflowStrategy =
  | "drop-lowest-priority"
  | "drop-newest"
  | "drop-oldest";

export interface BoundedWorkLanePolicy {
  batchSize: number;
  maxConcurrentWork: number;
  maxCandidateQueueDepth: number;
  queueOverflowStrategy: BoundedWorkLaneOverflowStrategy;
  cancelStaleBatches: boolean;
}

export interface BoundedWorkLaneCandidate<TPriority extends string = string> {
  workKey: string;
  priority: TPriority;
  priorityRank: number;
  distanceFromFocus: number;
  sequence: number;
}

export interface BoundedWorkLaneTelemetry<TPriority extends string = string> {
  candidateCount: number;
  queuedCount: number;
  scheduledCount: number;
  completedCount: number;
  failedCount: number;
  droppedCount: number;
  coalescedCount: number;
  cancelled: boolean;
  maxConcurrentWork: number;
  maxCandidateQueueDepth: number;
  queueOverflowStrategy: BoundedWorkLaneOverflowStrategy;
  priorityCounts: Partial<Record<TPriority, number>>;
}

export interface BoundedWorkLaneCandidateResult<TCandidate, TValue> {
  candidate: TCandidate;
  scheduledIndex: number;
  status: "fulfilled" | "rejected";
  value: TValue | null;
  error: unknown | null;
}

export interface BoundedWorkLaneRunResult<
  TCandidate extends BoundedWorkLaneCandidate<TPriority>,
  TValue,
  TPriority extends string = string,
> {
  queuedCandidates: TCandidate[];
  scheduledCandidates: TCandidate[];
  droppedCandidates: TCandidate[];
  results: BoundedWorkLaneCandidateResult<TCandidate, TValue>[];
  telemetry: BoundedWorkLaneTelemetry<TPriority>;
}

export interface RunBoundedWorkLaneInput<
  TCandidate extends BoundedWorkLaneCandidate<TPriority>,
  TValue,
  TPriority extends string = string,
> {
  candidates: readonly TCandidate[];
  policy: BoundedWorkLanePolicy;
  runCandidate: (candidate: TCandidate) => Promise<TValue | null>;
  isStale?: () => boolean;
}

interface NormalizedBoundedWorkQueue<
  TCandidate extends BoundedWorkLaneCandidate<TPriority>,
  TPriority extends string,
> {
  queuedCandidates: TCandidate[];
  droppedCandidates: TCandidate[];
  coalescedCount: number;
}

export async function runBoundedWorkLane<
  TCandidate extends BoundedWorkLaneCandidate<TPriority>,
  TValue,
  TPriority extends string = string,
>(
  input: RunBoundedWorkLaneInput<TCandidate, TValue, TPriority>,
): Promise<BoundedWorkLaneRunResult<TCandidate, TValue, TPriority>> {
  const queue = normalizeBoundedWorkQueue<TCandidate, TPriority>(
    input.candidates,
    input.policy,
  );
  const scheduledCandidates = queue.queuedCandidates.slice(
    0,
    normalizePositiveInteger(input.policy.batchSize, 1),
  );
  const maxConcurrentWork = Math.max(
    1,
    Math.min(
      normalizePositiveInteger(input.policy.maxConcurrentWork, 1),
      scheduledCandidates.length || 1,
    ),
  );
  const results: BoundedWorkLaneCandidateResult<TCandidate, TValue>[] = [];
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

  const workers = Array.from({ length: maxConcurrentWork }, async () => {
    for (;;) {
      const next = takeNextCandidate();
      if (!next) {
        return;
      }

      try {
        const value = await input.runCandidate(next.candidate);
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
  });

  await Promise.all(workers);
  results.sort((left, right) => left.scheduledIndex - right.scheduledIndex);

  const failedCount = results.filter((result) => result.status === "rejected")
    .length;
  return {
    queuedCandidates: queue.queuedCandidates,
    scheduledCandidates,
    droppedCandidates: queue.droppedCandidates,
    results,
    telemetry: {
      candidateCount: input.candidates.length,
      queuedCount: queue.queuedCandidates.length,
      scheduledCount: scheduledCandidates.length,
      completedCount: results.length,
      failedCount,
      droppedCount: queue.droppedCandidates.length,
      coalescedCount: queue.coalescedCount,
      cancelled,
      maxConcurrentWork,
      maxCandidateQueueDepth: normalizePositiveInteger(
        input.policy.maxCandidateQueueDepth,
        1,
      ),
      queueOverflowStrategy: input.policy.queueOverflowStrategy,
      priorityCounts: createPriorityCounts<TCandidate, TPriority>(
        scheduledCandidates,
      ),
    },
  };
}

function normalizeBoundedWorkQueue<
  TCandidate extends BoundedWorkLaneCandidate<TPriority>,
  TPriority extends string,
>(
  candidates: readonly TCandidate[],
  policy: BoundedWorkLanePolicy,
): NormalizedBoundedWorkQueue<TCandidate, TPriority> {
  const candidatesByKey = new Map<string, TCandidate>();
  let coalescedCount = 0;

  for (const candidate of candidates) {
    const workKey = candidate.workKey.trim();
    if (!workKey) {
      continue;
    }
    const existing = candidatesByKey.get(workKey);
    if (!existing) {
      candidatesByKey.set(workKey, candidate);
      continue;
    }
    coalescedCount += 1;
    if (compareBoundedWorkLaneCandidates(candidate, existing) < 0) {
      candidatesByKey.set(workKey, candidate);
    }
  }

  const coalescedCandidates = [...candidatesByKey.values()];
  const maxCandidateQueueDepth = normalizePositiveInteger(
    policy.maxCandidateQueueDepth,
    1,
  );
  if (coalescedCandidates.length <= maxCandidateQueueDepth) {
    return {
      queuedCandidates: coalescedCandidates.sort(compareBoundedWorkLaneCandidates),
      droppedCandidates: [],
      coalescedCount,
    };
  }

  const { queuedCandidates, droppedCandidates } = applyOverflowStrategy(
    coalescedCandidates,
    maxCandidateQueueDepth,
    policy.queueOverflowStrategy,
  );
  return {
    queuedCandidates: queuedCandidates.sort(compareBoundedWorkLaneCandidates),
    droppedCandidates,
    coalescedCount,
  };
}

function applyOverflowStrategy<
  TCandidate extends BoundedWorkLaneCandidate<TPriority>,
  TPriority extends string,
>(
  candidates: readonly TCandidate[],
  maxCandidateQueueDepth: number,
  strategy: BoundedWorkLaneOverflowStrategy,
): { queuedCandidates: TCandidate[]; droppedCandidates: TCandidate[] } {
  if (strategy === "drop-newest") {
    const orderedByArrival = [...candidates].sort(
      (left, right) => left.sequence - right.sequence,
    );
    return {
      queuedCandidates: orderedByArrival.slice(0, maxCandidateQueueDepth),
      droppedCandidates: orderedByArrival.slice(maxCandidateQueueDepth),
    };
  }

  if (strategy === "drop-oldest") {
    const orderedByArrival = [...candidates].sort(
      (left, right) => left.sequence - right.sequence,
    );
    return {
      queuedCandidates: orderedByArrival.slice(-maxCandidateQueueDepth),
      droppedCandidates: orderedByArrival.slice(
        0,
        Math.max(0, orderedByArrival.length - maxCandidateQueueDepth),
      ),
    };
  }

  const orderedByPriority = [...candidates].sort(compareBoundedWorkLaneCandidates);
  return {
    queuedCandidates: orderedByPriority.slice(0, maxCandidateQueueDepth),
    droppedCandidates: orderedByPriority.slice(maxCandidateQueueDepth),
  };
}

function compareBoundedWorkLaneCandidates<
  TCandidate extends BoundedWorkLaneCandidate<TPriority>,
  TPriority extends string,
>(left: TCandidate, right: TCandidate): number {
  const priorityDelta = left.priorityRank - right.priorityRank;
  if (priorityDelta !== 0) {
    return priorityDelta;
  }

  const distanceDelta = left.distanceFromFocus - right.distanceFromFocus;
  if (distanceDelta !== 0) {
    return distanceDelta;
  }

  return left.sequence - right.sequence;
}

function createPriorityCounts<
  TCandidate extends BoundedWorkLaneCandidate<TPriority>,
  TPriority extends string,
>(
  candidates: readonly TCandidate[],
): Partial<Record<TPriority, number>> {
  return candidates.reduce<Partial<Record<TPriority, number>>>(
    (counts, candidate) => {
      counts[candidate.priority] = (counts[candidate.priority] ?? 0) + 1;
      return counts;
    },
    {},
  );
}

function normalizePositiveInteger(value: number, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(1, Math.floor(value))
    : fallback;
}
