import { describe, expect, it } from "vitest";

import type { ExplorerViewportSchedulerPolicy } from "../config/explorerPerformance";
import {
  buildExplorerViewportPreviewPrefetchCandidates,
  runExplorerViewportPreviewPrefetchScheduler,
  type ExplorerViewportPreviewPrefetchKind,
  type ExplorerViewportPreviewPrefetchWork,
} from "../runtime/explorerViewportPreviewPrefetchScheduler";

interface TestEntry {
  path: string;
  entityId: string;
  contentRevision: string;
  previewKind: ExplorerViewportPreviewPrefetchKind;
  source: "local" | "cloud";
  isDir: boolean;
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
  },
};

function createEntry(
  index: number,
  overrides: Partial<TestEntry> = {},
): TestEntry {
  const previewKind = overrides.previewKind ?? "text";
  return {
    path: `/entry-${index}.${previewKind === "image" ? "png" : "txt"}`,
    entityId: `entity-${index}`,
    contentRevision: `revision-${index}`,
    previewKind,
    source: "local",
    isDir: false,
    ...overrides,
  };
}

function resolvePreviewWork(entry: TestEntry): ExplorerViewportPreviewPrefetchWork {
  return {
    previewKind: entry.previewKind,
    previewCacheKey: `${entry.previewKind}:${entry.path}`,
  };
}

describe("explorerViewportPreviewPrefetchScheduler", () => {
  it("orders selected-adjacent, visible, forward, and backward preview work", () => {
    const entries = Array.from({ length: 10 }, (_, index) => createEntry(index));

    const candidates = buildExplorerViewportPreviewPrefetchCandidates({
      entries,
      viewportStartIndex: 3,
      viewportEndIndex: 5,
      selectedEntryPath: entries[6].path,
      policy: {
        ...basePolicy.previewPrefetch,
        forwardPrefetchViewports: 1,
        backwardPrefetchViewports: 0.5,
      },
      getEntryPath: (entry) => entry.path,
      getEntryIdentityKey: (entry) =>
        `${entry.entityId}::${entry.contentRevision}`,
      resolvePreviewWork,
    });

    expect(candidates.map((candidate) => `${candidate.priority}:${candidate.path}`))
      .toEqual([
        "selected-adjacent:/entry-5.txt",
        "selected-adjacent:/entry-7.txt",
        "visible:/entry-3.txt",
        "visible:/entry-4.txt",
        "forward-prefetch:/entry-6.txt",
        "backward-prefetch:/entry-2.txt",
      ]);
  });

  it("dedupes cache and in-flight candidates through preview cache keys", () => {
    const cachedKeys = new Set(["text:/cached.txt"]);
    const inFlightKeys = new Set(["text:/in-flight.txt"]);
    const entries = [
      createEntry(0, { path: "/same-a.txt" }),
      createEntry(1, { path: "/same-b.txt" }),
      createEntry(2, { path: "/cached.txt" }),
      createEntry(3, { path: "/in-flight.txt" }),
    ];

    const candidates = buildExplorerViewportPreviewPrefetchCandidates({
      entries,
      viewportStartIndex: 0,
      viewportEndIndex: 4,
      policy: { ...basePolicy.previewPrefetch, forwardPrefetchViewports: 0 },
      getEntryPath: (entry) => entry.path,
      getEntryIdentityKey: (entry) =>
        `${entry.entityId}::${entry.contentRevision}`,
      resolvePreviewWork: (entry) => {
        const key = entry.path.startsWith("/same")
          ? "text:/same.txt"
          : `text:${entry.path}`;
        if (cachedKeys.has(key) || inFlightKeys.has(key)) {
          return null;
        }
        return { previewKind: "text", previewCacheKey: key };
      },
    });

    expect(candidates.map((candidate) => candidate.previewCacheKey)).toEqual([
      "text:/same.txt",
    ]);
  });

  it("filters non-local and directory entries before prefetch scheduling", () => {
    const entries = [
      createEntry(0),
      createEntry(1, { source: "cloud" }),
      createEntry(2, { isDir: true }),
    ];

    const candidates = buildExplorerViewportPreviewPrefetchCandidates({
      entries,
      viewportStartIndex: 0,
      viewportEndIndex: 3,
      policy: basePolicy.previewPrefetch,
      getEntryPath: (entry) => entry.path,
      getEntryIdentityKey: (entry) =>
        `${entry.entityId}::${entry.contentRevision}`,
      shouldPrefetchEntry: (entry) => entry.source === "local" && !entry.isDir,
      resolvePreviewWork,
    });

    expect(candidates.map((candidate) => candidate.path)).toEqual([
      "/entry-0.txt",
    ]);
  });

  it("cancels stale preview prefetch generations", async () => {
    const entries = Array.from({ length: 4 }, (_, index) => createEntry(index));
    const candidates = buildExplorerViewportPreviewPrefetchCandidates({
      entries,
      viewportStartIndex: 0,
      viewportEndIndex: 4,
      policy: basePolicy.previewPrefetch,
      getEntryPath: (entry) => entry.path,
      getEntryIdentityKey: (entry) =>
        `${entry.entityId}::${entry.contentRevision}`,
      resolvePreviewWork,
    });
    let stale = false;
    let prefetchCount = 0;

    const result = await runExplorerViewportPreviewPrefetchScheduler({
      candidates,
      policy: {
        ...basePolicy,
        previewPrefetch: {
          ...basePolicy.previewPrefetch,
          maxConcurrentPreviewReads: 1,
        },
      },
      isStale: () => stale,
      prefetchCandidate: async (candidate) => {
        prefetchCount += 1;
        stale = true;
        return candidate.previewCacheKey;
      },
    });

    expect(prefetchCount).toBe(1);
    expect(result.results).toEqual([]);
    expect(result.telemetry.cancelled).toBe(true);
    expect(result.telemetry.completedCount).toBe(0);
  });

  it("respects preview prefetch batch and concurrency caps", async () => {
    const entries = Array.from({ length: 10 }, (_, index) => createEntry(index));
    const candidates = buildExplorerViewportPreviewPrefetchCandidates({
      entries,
      viewportStartIndex: 0,
      viewportEndIndex: 8,
      policy: { ...basePolicy.previewPrefetch, forwardPrefetchViewports: 0 },
      getEntryPath: (entry) => entry.path,
      getEntryIdentityKey: (entry) =>
        `${entry.entityId}::${entry.contentRevision}`,
      resolvePreviewWork,
    });
    let activeReads = 0;
    let maxActiveReads = 0;

    const result = await runExplorerViewportPreviewPrefetchScheduler({
      candidates,
      policy: {
        ...basePolicy,
        previewPrefetch: {
          ...basePolicy.previewPrefetch,
          batchSize: 5,
          maxConcurrentPreviewReads: 2,
        },
      },
      prefetchCandidate: async (candidate) => {
        activeReads += 1;
        maxActiveReads = Math.max(maxActiveReads, activeReads);
        await new Promise((resolve) => setTimeout(resolve, 1));
        activeReads -= 1;
        return candidate.previewCacheKey;
      },
    });

    expect(result.results).toHaveLength(5);
    expect(result.telemetry.maxConcurrentPreviewReads).toBe(2);
    expect(maxActiveReads).toBeLessThanOrEqual(2);
  });
});
