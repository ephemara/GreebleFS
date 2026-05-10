import { describe, expect, it } from "vitest";

import {
  EXPLORER_DIRECTORY_RESULT_CACHE_TTL_MS,
  EXPLORER_DOUBLE_CLICK_SECOND_CLICK_TO_NAVIGATE_DISPATCH_BUDGET_MS,
  EXPLORER_FOLDER_DOUBLE_CLICK_DEDUPE_WINDOW_MS,
  EXPLORER_FOLDER_DOUBLE_CLICK_PREVIEW_DELAY_MS,
  EXPLORER_FOLDER_DOUBLE_CLICK_SECOND_CLICK_IMMEDIATE_NAVIGATION,
  EXPLORER_MESSAGE_STREAMS_POLICY,
  EXPLORER_NATIVE_TASK_GRAPH_POLICY,
  EXPLORER_PREVIEW_STREAMING_POLICY,
  EXPLORER_POINTER_DOWN_DIRECTORY_WARM_ENABLED,
  EXPLORER_VIEWPORT_SCHEDULER_POLICY,
  explorerPerformance,
  normalizeExplorerPerformanceManifest,
} from "../config/explorerPerformance";

describe("explorerPerformance", () => {
  it("loads folder activation speed policy from the shipped /usr config", () => {
    expect(explorerPerformance.id).toBe("greeblefs-core-explorer-performance");
    expect(EXPLORER_FOLDER_DOUBLE_CLICK_PREVIEW_DELAY_MS).toBe(180);
    expect(EXPLORER_FOLDER_DOUBLE_CLICK_SECOND_CLICK_IMMEDIATE_NAVIGATION).toBe(
      true,
    );
    expect(EXPLORER_FOLDER_DOUBLE_CLICK_DEDUPE_WINDOW_MS).toBe(96);
    expect(EXPLORER_POINTER_DOWN_DIRECTORY_WARM_ENABLED).toBe(true);
    expect(EXPLORER_DIRECTORY_RESULT_CACHE_TTL_MS).toBe(30000);
    expect(
      EXPLORER_DOUBLE_CLICK_SECOND_CLICK_TO_NAVIGATE_DISPATCH_BUDGET_MS,
    ).toBe(1);
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
    expect(EXPLORER_VIEWPORT_SCHEDULER_POLICY.maxConcurrentThumbnailReads).toBe(
      4,
    );
    expect(EXPLORER_VIEWPORT_SCHEDULER_POLICY.maxCandidateQueueDepth).toBe(96);
    expect(EXPLORER_VIEWPORT_SCHEDULER_POLICY.previewPrefetch.batchSize).toBe(
      4,
    );
    expect(explorerPerformance.nativeTaskGraph).toEqual({
      enabled: true,
      maxQueuedTasks: 256,
      staleCancellationEnabled: true,
      telemetryEnabled: true,
      progressEmitIntervalMs: 80,
      overflowPolicy: "cancelStaleQueuedFirst",
      laneConcurrency: {
        directoryScan: 2,
        recursiveSearch: 2,
        checksum: 1,
        thumbnailDecode: 4,
        previewRead: 2,
        archive: 1,
        indexing: 0,
        maintenance: 0,
      },
    });
    expect(
      EXPLORER_NATIVE_TASK_GRAPH_POLICY.laneConcurrency.directoryScan,
    ).toBe(2);
    expect(EXPLORER_NATIVE_TASK_GRAPH_POLICY.laneConcurrency.checksum).toBe(1);
    expect(EXPLORER_NATIVE_TASK_GRAPH_POLICY.laneConcurrency.previewRead).toBe(
      2,
    );
    expect(EXPLORER_NATIVE_TASK_GRAPH_POLICY.laneConcurrency.archive).toBe(1);
    expect(explorerPerformance.previewStreaming).toEqual({
      enabled: true,
      chunkBytes: 65536,
      textMaxBytes: 10485760,
      dataUriMaxBytes: 12582912,
      binaryMaxBytes: 268435456,
      archiveEntryMaxBytes: 268435456,
    });
    expect(EXPLORER_PREVIEW_STREAMING_POLICY.chunkBytes).toBe(65536);
    expect(EXPLORER_PREVIEW_STREAMING_POLICY.archiveEntryMaxBytes).toBe(
      268435456,
    );
    expect(explorerPerformance.messageStreams).toEqual({
      enabled: true,
      telemetryEnabled: true,
      maxFrameBytes: 32768,
      replayResponseLimit: 512,
      overflowPolicy: "drop-oldest",
      defaultTopic: {
        maxMessages: 256,
        maxBytes: 1048576,
      },
      terminal: {
        maxMessages: 2048,
        maxBytes: 4194304,
      },
      taskOutput: {
        maxMessages: 1024,
        maxBytes: 2097152,
      },
      telemetry: {
        maxMessages: 400,
        maxBytes: 2097152,
      },
    });
    expect(EXPLORER_MESSAGE_STREAMS_POLICY.terminal.maxMessages).toBe(2048);
    expect(EXPLORER_MESSAGE_STREAMS_POLICY.telemetry.maxBytes).toBe(2097152);
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

  it("normalizes native task graph defaults and clamps authored policy values", () => {
    const normalized = normalizeExplorerPerformanceManifest({
      nativeTaskGraph: {
        enabled: false,
        maxQueuedTasks: 999999,
        staleCancellationEnabled: false,
        telemetryEnabled: false,
        progressEmitIntervalMs: 1,
        overflowPolicy: "explode" as never,
        laneConcurrency: {
          directoryScan: 99,
          recursiveSearch: 0,
          checksum: 99,
          thumbnailDecode: 99,
          previewRead: -1,
          archive: 99,
          indexing: Number.NaN,
          maintenance: 99,
        },
      },
    });

    expect(normalized.nativeTaskGraph).toEqual({
      enabled: false,
      maxQueuedTasks: 4096,
      staleCancellationEnabled: false,
      telemetryEnabled: false,
      progressEmitIntervalMs: 16,
      overflowPolicy: "cancelStaleQueuedFirst",
      laneConcurrency: {
        directoryScan: 16,
        recursiveSearch: 1,
        checksum: 8,
        thumbnailDecode: 16,
        previewRead: 0,
        archive: 8,
        indexing: 0,
        maintenance: 4,
      },
    });

    const zeroThumbnailLane = normalizeExplorerPerformanceManifest({
      nativeTaskGraph: {
        laneConcurrency: {
          thumbnailDecode: 0,
        },
      },
    });
    expect(
      zeroThumbnailLane.nativeTaskGraph.laneConcurrency.thumbnailDecode,
    ).toBe(1);
  });

  it("normalizes message stream defaults and clamps authored policy values", () => {
    const normalized = normalizeExplorerPerformanceManifest({
      messageStreams: {
        enabled: false,
        telemetryEnabled: false,
        maxFrameBytes: 1,
        replayResponseLimit: 999999,
        overflowPolicy: "explode" as never,
        defaultTopic: {
          maxMessages: 0,
          maxBytes: 1,
        },
        terminal: {
          maxMessages: 999999,
          maxBytes: 999999999,
        },
        taskOutput: {
          maxMessages: Number.NaN,
          maxBytes: Number.NaN,
        },
        telemetry: {
          maxMessages: 12,
          maxBytes: 2048,
        },
      },
    });

    expect(normalized.messageStreams).toEqual({
      enabled: false,
      telemetryEnabled: false,
      maxFrameBytes: 1024,
      replayResponseLimit: 4096,
      overflowPolicy: "drop-oldest",
      defaultTopic: {
        maxMessages: 1,
        maxBytes: 1024,
      },
      terminal: {
        maxMessages: 65536,
        maxBytes: 256 * 1024 * 1024,
      },
      taskOutput: {
        maxMessages: 1024,
        maxBytes: 2 * 1024 * 1024,
      },
      telemetry: {
        maxMessages: 12,
        maxBytes: 2048,
      },
    });
  });

  it("normalizes preview streaming defaults and clamps authored policy values", () => {
    const normalized = normalizeExplorerPerformanceManifest({
      previewStreaming: {
        enabled: false,
        chunkBytes: 1,
        textMaxBytes: 1,
        dataUriMaxBytes: 999999999,
        binaryMaxBytes: 999999999,
        archiveEntryMaxBytes: 999999999,
      },
    });

    expect(normalized.previewStreaming).toEqual({
      enabled: false,
      chunkBytes: 4 * 1024,
      textMaxBytes: 1024,
      dataUriMaxBytes: 64 * 1024 * 1024,
      binaryMaxBytes: 512 * 1024 * 1024,
      archiveEntryMaxBytes: 512 * 1024 * 1024,
    });
  });
});
