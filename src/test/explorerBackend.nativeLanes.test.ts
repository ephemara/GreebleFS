import { beforeEach, describe, expect, it, vi } from "vitest";
import { commands } from "../runtime/tauriClient";
import {
  readExplorerThumbnailArtifact,
  searchExplorerEntriesWithDiagnostics,
} from "../runtime/explorerBackend";

const nativeStreamsMock = vi.hoisted(() => ({
  available: true,
  isExplorerNativeRingSearchStreamAvailable: vi.fn(() => nativeStreamsMock.available),
  searchExplorerEntriesWithDiagnosticsViaNativeStream: vi.fn(),
}));

const nativeControlMock = vi.hoisted(() => ({
  available: true,
  isGreebleNativeControlAvailable: vi.fn(() => nativeControlMock.available),
  callGreebleNativeWithInvokeFallback: vi.fn(),
}));

vi.mock("../runtime/explorerNativeStreams", () => nativeStreamsMock);

vi.mock("../runtime/nativeControl", () => nativeControlMock);

function artifact(path: string) {
  return {
    entityId: `entity:${path}`,
    contentRevision: "rev",
    kind: "image",
    poster: {
      id: "poster",
      artifactKind: "thumbnail",
      mimeType: "image/png",
      byteLength: 8,
      resourceRid: 7,
      retention: "session",
      identityKey: `entity:${path}`,
      revision: "rev",
    },
    hoverFrames: [],
    hoverFrameDelayMs: null,
  };
}

describe("explorer backend native lanes", () => {
  beforeEach(() => {
    nativeStreamsMock.available = true;
    nativeStreamsMock.isExplorerNativeRingSearchStreamAvailable.mockClear();
    nativeStreamsMock.searchExplorerEntriesWithDiagnosticsViaNativeStream.mockReset();
    nativeControlMock.available = true;
    nativeControlMock.isGreebleNativeControlAvailable.mockClear();
    nativeControlMock.callGreebleNativeWithInvokeFallback.mockReset();
    vi.restoreAllMocks();
  });

  it("prefers the native search stream when the ring lane is available", async () => {
    const response = {
      results: [],
      diagnostics: {
        executionStrategy: "live_scan",
        contentCacheStatus: "not_requested",
        scannedEntryCount: 0,
        indexedEntryCount: 0,
        contentCacheStoredFileCount: 0,
        contentCacheStoredByteCount: 0,
        truncatedByScanBudget: false,
      },
    };
    nativeStreamsMock.searchExplorerEntriesWithDiagnosticsViaNativeStream.mockResolvedValue(
      response,
    );
    const invokeSpy = vi.spyOn(commands, "fsSearchEntriesWithDiagnostics");

    await expect(
      searchExplorerEntriesWithDiagnostics({
        path: "D:/demo",
        query: "needle",
        showHidden: false,
      }),
    ).resolves.toBe(response);

    expect(nativeStreamsMock.searchExplorerEntriesWithDiagnosticsViaNativeStream).toHaveBeenCalledWith({
      path: "D:/demo",
      query: "needle",
      showHidden: false,
    });
    expect(invokeSpy).not.toHaveBeenCalled();
  });

  it("falls back to generated search invoke when the native stream fails", async () => {
    nativeStreamsMock.searchExplorerEntriesWithDiagnosticsViaNativeStream.mockRejectedValue(
      new Error("stream unavailable"),
    );
    const fallbackResponse = {
      status: "ok" as const,
      data: {
        results: [],
        diagnostics: {
          executionStrategy: "live_scan",
          contentCacheStatus: "not_requested",
          scannedEntryCount: 1,
          indexedEntryCount: 0,
          contentCacheStoredFileCount: 0,
          contentCacheStoredByteCount: 0,
          truncatedByScanBudget: false,
        },
      },
    };
    const invokeSpy = vi
      .spyOn(commands, "fsSearchEntriesWithDiagnostics")
      .mockResolvedValue(fallbackResponse);

    await expect(
      searchExplorerEntriesWithDiagnostics({
        path: "D:/demo",
        query: "needle",
        showHidden: false,
      }),
    ).resolves.toEqual(fallbackResponse.data);

    expect(invokeSpy).toHaveBeenCalledWith(
      "D:/demo",
      "needle",
      false,
      false,
      null,
      null,
      null,
    );
  });

  it("routes thumbnail artifacts through native control with generated invoke fallback", async () => {
    const nativeArtifact = artifact("D:/demo/image.png");
    nativeControlMock.callGreebleNativeWithInvokeFallback.mockResolvedValue(nativeArtifact);
    const invokeSpy = vi.spyOn(commands, "fsReadEntryThumbnailArtifact");

    await expect(
      readExplorerThumbnailArtifact({
        path: "D:/demo/image.png",
        maxWidth: 160,
        maxHeight: 120,
      }),
    ).resolves.toBe(nativeArtifact);

    expect(nativeControlMock.callGreebleNativeWithInvokeFallback).toHaveBeenCalledWith(
      "explorer",
      "readThumbnailArtifact",
      {
        path: "D:/demo/image.png",
        maxWidth: 160,
        maxHeight: 120,
      },
      expect.any(Function),
    );
    expect(invokeSpy).not.toHaveBeenCalled();
  });
});
