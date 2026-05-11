import { describe, expect, it } from "vitest";

import type { ExplorerViewportSchedulerPolicy } from "../config/explorerPerformance";
import {
  buildExplorerViewportThumbnailWorkCandidates,
  runExplorerViewportThumbnailScheduler,
  selectExplorerViewportThumbnailScheduledCandidates,
} from "../runtime/explorerViewportThumbnailScheduler";

interface TestEntry {
  path: string;
  entityId: string;
  contentRevision: string;
  extension: string;
}

const basePolicy: ExplorerViewportSchedulerPolicy = {
  enabled: true,
  batchSize: 12,
  maxConcurrentThumbnailReads: 4,
  settleDelayMs: 88,
  forwardPrefetchViewports: 1,
  backwardPrefetchViewports: 0.5,
  cancelStaleBatches: true,
  maxCandidateQueueDepth: 96,
  queueOverflowStrategy: "drop-lowest-priority",
  previewPrefetch: {
    enabled: true,
    batchSize: 4,
    maxConcurrentPreviewReads: 2,
    forwardPrefetchViewports: 0.5,
    backwardPrefetchViewports: 0.25,
    maxPreviewBytesPerEntry: 512 * 1024,
    maxBatchBytes: 1024 * 1024,
    imagePrefetchMode: "dataUri",
  },
};

function createEntry(
  index: number,
  overrides: Partial<TestEntry> = {},
): TestEntry {
  return {
    path: `/entry-${index}.png`,
    entityId: `entity-${index}`,
    contentRevision: `revision-${index}`,
    extension: "png",
    ...overrides,
  };
}

function buildCandidates(
  entries: readonly TestEntry[],
  policy: ExplorerViewportSchedulerPolicy = basePolicy,
  hoveredEntryPath: string | null = null,
) {
  return buildExplorerViewportThumbnailWorkCandidates({
    entries,
    viewportStartIndex: 3,
    viewportEndIndex: 5,
    hoveredEntryPath,
    policy,
    getEntryPath: (entry) => entry.path,
    getEntryIdentityKey: (entry) =>
      `${entry.entityId}::${entry.contentRevision}`,
    shouldScheduleEntry: () => true,
    isModelPreviewEntry: (entry) => entry.extension === "glb",
  });
}

describe("explorerViewportThumbnailScheduler", () => {
  it("orders hover, visible, forward prefetch, and backward prefetch work by lane priority", () => {
    const entries = Array.from({ length: 10 }, (_, index) =>
      createEntry(index, index === 7 ? { extension: "glb" } : undefined),
    );

    const candidates = buildCandidates(entries, basePolicy, entries[7].path);

    expect(
      candidates.map((candidate) => `${candidate.priority}:${candidate.path}`),
    ).toEqual([
      "hover:/entry-7.png",
      "visible:/entry-3.png",
      "visible:/entry-4.png",
      "forward-prefetch:/entry-5.png",
      "forward-prefetch:/entry-6.png",
      "backward-prefetch:/entry-2.png",
    ]);
    expect(candidates[0].isModelPreview).toBe(true);
  });

  it("dedupes thumbnail candidates by entityId and contentRevision", () => {
    const entries = [
      createEntry(0, { entityId: "same", contentRevision: "1" }),
      createEntry(1, { entityId: "same", contentRevision: "1" }),
      createEntry(2),
    ];

    const candidates = buildExplorerViewportThumbnailWorkCandidates({
      entries,
      viewportStartIndex: 0,
      viewportEndIndex: 2,
      policy: basePolicy,
      getEntryPath: (entry) => entry.path,
      getEntryIdentityKey: (entry) =>
        `${entry.entityId}::${entry.contentRevision}`,
      shouldScheduleEntry: () => true,
    });

    expect(candidates.map((candidate) => candidate.path)).toEqual([
      "/entry-0.png",
      "/entry-2.png",
    ]);
  });

  it("cancels stale batches before committing completed thumbnail reads", async () => {
    const entries = Array.from({ length: 4 }, (_, index) => createEntry(index));
    const candidates = buildExplorerViewportThumbnailWorkCandidates({
      entries,
      viewportStartIndex: 0,
      viewportEndIndex: 3,
      policy: { ...basePolicy, maxConcurrentThumbnailReads: 1 },
      getEntryPath: (entry) => entry.path,
      getEntryIdentityKey: (entry) =>
        `${entry.entityId}::${entry.contentRevision}`,
      shouldScheduleEntry: () => true,
    });
    let stale = false;
    let readCount = 0;

    const result = await runExplorerViewportThumbnailScheduler({
      candidates,
      policy: { ...basePolicy, maxConcurrentThumbnailReads: 1 },
      isStale: () => stale,
      readCandidate: async (candidate) => {
        readCount += 1;
        stale = true;
        return `thumbnail:${candidate.path}`;
      },
    });

    expect(readCount).toBe(1);
    expect(result.results).toEqual([]);
    expect(result.telemetry.cancelled).toBe(true);
    expect(result.telemetry.completedCount).toBe(0);
  });

  it("respects the max concurrent thumbnail read cap", async () => {
    const entries = Array.from({ length: 8 }, (_, index) => createEntry(index));
    const candidates = buildExplorerViewportThumbnailWorkCandidates({
      entries,
      viewportStartIndex: 0,
      viewportEndIndex: 6,
      policy: {
        ...basePolicy,
        batchSize: 6,
        maxConcurrentThumbnailReads: 2,
        forwardPrefetchViewports: 0,
        backwardPrefetchViewports: 0,
      },
      getEntryPath: (entry) => entry.path,
      getEntryIdentityKey: (entry) =>
        `${entry.entityId}::${entry.contentRevision}`,
      shouldScheduleEntry: () => true,
    });
    let activeReads = 0;
    let maxActiveReads = 0;

    const result = await runExplorerViewportThumbnailScheduler({
      candidates,
      policy: {
        ...basePolicy,
        batchSize: 6,
        maxConcurrentThumbnailReads: 2,
      },
      readCandidate: async (candidate) => {
        activeReads += 1;
        maxActiveReads = Math.max(maxActiveReads, activeReads);
        await new Promise((resolve) => setTimeout(resolve, 1));
        activeReads -= 1;
        return `thumbnail:${candidate.path}`;
      },
    });

    expect(result.results).toHaveLength(6);
    expect(result.telemetry.maxConcurrentThumbnailReads).toBe(2);
    expect(maxActiveReads).toBeLessThanOrEqual(2);
  });

  it("reports bounded queue telemetry and drops overflow work by priority", async () => {
    const entries = Array.from({ length: 8 }, (_, index) => createEntry(index));
    const policy: ExplorerViewportSchedulerPolicy = {
      ...basePolicy,
      batchSize: 8,
      maxCandidateQueueDepth: 3,
      forwardPrefetchViewports: 1,
      backwardPrefetchViewports: 0,
    };
    const candidates = buildExplorerViewportThumbnailWorkCandidates({
      entries,
      viewportStartIndex: 0,
      viewportEndIndex: 4,
      policy,
      getEntryPath: (entry) => entry.path,
      getEntryIdentityKey: (entry) =>
        `${entry.entityId}::${entry.contentRevision}`,
      shouldScheduleEntry: () => true,
    });

    const result = await runExplorerViewportThumbnailScheduler({
      candidates,
      policy,
      readCandidate: async (candidate) => `thumbnail:${candidate.path}`,
    });

    expect(result.scheduledCandidates.map((candidate) => candidate.path)).toEqual([
      "/entry-0.png",
      "/entry-1.png",
      "/entry-2.png",
    ]);
    expect(result.telemetry.queuedCount).toBe(3);
    expect(result.telemetry.droppedCount).toBe(5);
    expect(result.telemetry.maxCandidateQueueDepth).toBe(3);
    expect(result.telemetry.queueOverflowStrategy).toBe("drop-lowest-priority");
  });

  it("selects a bounded batch for the native thumbnail artifact lane", () => {
    const entries = Array.from({ length: 8 }, (_, index) => createEntry(index));
    const policy: ExplorerViewportSchedulerPolicy = {
      ...basePolicy,
      batchSize: 4,
      maxConcurrentThumbnailReads: 2,
      maxCandidateQueueDepth: 5,
      forwardPrefetchViewports: 1,
      backwardPrefetchViewports: 0,
    };
    const candidates = buildExplorerViewportThumbnailWorkCandidates({
      entries,
      viewportStartIndex: 0,
      viewportEndIndex: 4,
      policy,
      getEntryPath: (entry) => entry.path,
      getEntryIdentityKey: (entry) =>
        `${entry.entityId}::${entry.contentRevision}`,
      shouldScheduleEntry: () => true,
    });

    const selection = selectExplorerViewportThumbnailScheduledCandidates(
      candidates,
      policy,
    );

    expect(selection.scheduledCandidates.map((candidate) => candidate.path)).toEqual([
      "/entry-0.png",
      "/entry-1.png",
      "/entry-2.png",
      "/entry-3.png",
    ]);
    expect(selection.telemetry.scheduledCount).toBe(4);
    expect(selection.telemetry.queuedCount).toBe(5);
    expect(selection.telemetry.droppedCount).toBe(3);
    expect(selection.telemetry.completedCount).toBe(0);
    expect(selection.telemetry.maxConcurrentThumbnailReads).toBe(2);
  });
});
