import { describe, expect, it } from "vitest";

import {
  EXPLORER_DOUBLE_CLICK_SECOND_CLICK_TO_NAVIGATE_DISPATCH_BUDGET_MS,
  EXPLORER_FOLDER_DOUBLE_CLICK_DEDUPE_WINDOW_MS,
  EXPLORER_FOLDER_DOUBLE_CLICK_PREVIEW_DELAY_MS,
  EXPLORER_FOLDER_DOUBLE_CLICK_SECOND_CLICK_IMMEDIATE_NAVIGATION,
  EXPLORER_POINTER_DOWN_DIRECTORY_WARM_ENABLED,
  EXPLORER_VIEWPORT_SCHEDULER_POLICY,
  explorerPerformance,
  normalizeExplorerPerformanceManifest,
} from "../config/explorerPerformance";

describe("explorerPerformance", () => {
  it("loads folder activation speed policy from the shipped /usr config", () => {
    expect(explorerPerformance.id).toBe("greeblefs-core-explorer-performance");
    expect(EXPLORER_FOLDER_DOUBLE_CLICK_PREVIEW_DELAY_MS).toBe(180);
    expect(EXPLORER_FOLDER_DOUBLE_CLICK_SECOND_CLICK_IMMEDIATE_NAVIGATION).toBe(true);
    expect(EXPLORER_FOLDER_DOUBLE_CLICK_DEDUPE_WINDOW_MS).toBe(96);
    expect(EXPLORER_POINTER_DOWN_DIRECTORY_WARM_ENABLED).toBe(true);
    expect(EXPLORER_DOUBLE_CLICK_SECOND_CLICK_TO_NAVIGATE_DISPATCH_BUDGET_MS).toBe(1);
    expect(explorerPerformance.viewportScheduling).toEqual({
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
    });
    expect(EXPLORER_VIEWPORT_SCHEDULER_POLICY.batchSize).toBe(12);
    expect(EXPLORER_VIEWPORT_SCHEDULER_POLICY.maxConcurrentThumbnailReads).toBe(4);
    expect(EXPLORER_VIEWPORT_SCHEDULER_POLICY.maxCandidateQueueDepth).toBe(96);
    expect(EXPLORER_VIEWPORT_SCHEDULER_POLICY.previewPrefetch.batchSize).toBe(4);
  });

  it("normalizes viewport scheduling defaults and clamps authored policy values", () => {
    const normalized = normalizeExplorerPerformanceManifest({
      viewportScheduling: {
        enabled: false,
        batchSize: Number.POSITIVE_INFINITY,
        maxConcurrentThumbnailReads: 0,
        settleDelayMs: -10,
        forwardPrefetchViewports: Number.NaN,
        backwardPrefetchViewports: 99,
        cancelStaleBatches: false,
        maxCandidateQueueDepth: 4096,
        queueOverflowStrategy: "drop-oldest",
        previewPrefetch: {
          enabled: false,
          batchSize: 999,
          maxConcurrentPreviewReads: 0,
          forwardPrefetchViewports: 99,
          backwardPrefetchViewports: Number.NaN,
        },
      },
    });

    expect(normalized.viewportScheduling).toEqual({
      enabled: false,
      batchSize: 12,
      maxConcurrentThumbnailReads: 1,
      settleDelayMs: 0,
      forwardPrefetchViewports: 1,
      backwardPrefetchViewports: 8,
      cancelStaleBatches: false,
      maxCandidateQueueDepth: 1024,
      queueOverflowStrategy: "drop-oldest",
      previewPrefetch: {
        enabled: false,
        batchSize: 64,
        maxConcurrentPreviewReads: 1,
        forwardPrefetchViewports: 4,
        backwardPrefetchViewports: 0.25,
      },
    });
  });

  it("falls back to safe queue defaults for malformed scheduler policy", () => {
    const normalized = normalizeExplorerPerformanceManifest({
      viewportScheduling: {
        maxCandidateQueueDepth: Number.NaN,
        queueOverflowStrategy: "explode" as never,
        previewPrefetch: {
          batchSize: Number.POSITIVE_INFINITY,
          maxConcurrentPreviewReads: Number.NEGATIVE_INFINITY,
          forwardPrefetchViewports: "fast" as never,
        },
      },
    });

    expect(normalized.viewportScheduling.maxCandidateQueueDepth).toBe(96);
    expect(normalized.viewportScheduling.queueOverflowStrategy).toBe(
      "drop-lowest-priority",
    );
    expect(normalized.viewportScheduling.previewPrefetch).toEqual({
      enabled: true,
      batchSize: 4,
      maxConcurrentPreviewReads: 2,
      forwardPrefetchViewports: 0.5,
      backwardPrefetchViewports: 0.25,
    });
  });
});
