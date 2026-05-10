import { beforeEach, describe, expect, it, vi } from "vitest";
import { commands } from "../runtime/tauriClient";
import {
  cancelExplorerTask,
  deleteExplorerPaths,
  getExplorerAssociatedPrograms,
  getExplorerShellContextMenu,
  listExplorerTasks,
  openExplorerPathWithDialog,
  readExplorerThumbnailArtifact,
  readExplorerThumbnailArtifactsBatch,
  renameExplorerPath,
  searchExplorerEntriesWithDiagnostics,
  transferExplorerItems,
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
          executionStrategy: "live_scan" as const,
          contentCacheStatus: "not_requested" as const,
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
        includeVideoHoverScrub: false,
        videoHoverFrameCount: null,
        entityId: null,
        contentRevision: null,
      }),
    ).resolves.toBe(nativeArtifact);

    expect(nativeControlMock.callGreebleNativeWithInvokeFallback).toHaveBeenCalledWith(
      "explorer",
      "readThumbnailArtifact",
      {
        path: "D:/demo/image.png",
        maxWidth: 160,
        maxHeight: 120,
        includeVideoHoverScrub: false,
        videoHoverFrameCount: null,
        entityId: null,
        contentRevision: null,
      },
      expect.any(Function),
    );
    expect(invokeSpy).not.toHaveBeenCalled();
  });

  it("routes thumbnail artifact batches through native control with generated invoke fallback", async () => {
    const request = {
      requests: [
        {
          path: "D:/demo/image-a.png",
          maxWidth: 160,
          maxHeight: 120,
          includeVideoHoverScrub: false,
          videoHoverFrameCount: null,
          entityId: "entity-a",
          contentRevision: "rev-a",
        },
        {
          path: "D:/demo/image-b.png",
          maxWidth: 160,
          maxHeight: 120,
          includeVideoHoverScrub: false,
          videoHoverFrameCount: null,
          entityId: "entity-b",
          contentRevision: "rev-b",
        },
      ],
      generation: 42,
    };
    const nativeResponse = {
      results: [
        {
          index: 0,
          path: "D:/demo/image-a.png",
          artifact: artifact("D:/demo/image-a.png"),
          error: null,
        },
        {
          index: 1,
          path: "D:/demo/image-b.png",
          artifact: artifact("D:/demo/image-b.png"),
          error: null,
        },
      ],
      completedCount: 2,
      failedCount: 0,
    };
    nativeControlMock.callGreebleNativeWithInvokeFallback.mockResolvedValue(nativeResponse);
    const invokeSpy = vi.spyOn(commands, "fsReadEntryThumbnailArtifactsBatch");

    await expect(readExplorerThumbnailArtifactsBatch(request)).resolves.toBe(
      nativeResponse,
    );

    expect(nativeControlMock.callGreebleNativeWithInvokeFallback).toHaveBeenCalledWith(
      "explorer",
      "readThumbnailArtifactsBatch",
      request,
      expect.any(Function),
    );
    expect(invokeSpy).not.toHaveBeenCalled();
  });

  it("routes local shell actions through explorer native control", async () => {
    nativeControlMock.callGreebleNativeWithInvokeFallback.mockResolvedValue(undefined);
    const invokeSpy = vi.spyOn(commands, "fsOpenWithDialog");

    await openExplorerPathWithDialog("D:/demo/file.txt");

    expect(nativeControlMock.callGreebleNativeWithInvokeFallback).toHaveBeenCalledWith(
      "explorer",
      "openWithDialog",
      { path: "D:/demo/file.txt" },
      expect.any(Function),
    );
    expect(invokeSpy).not.toHaveBeenCalled();
  });

  it("routes associated-program lookup through explorer native control", async () => {
    const catalog = {
      recommendedPrograms: [],
      otherPrograms: [],
      defaultProgram: null,
    };
    nativeControlMock.callGreebleNativeWithInvokeFallback.mockResolvedValue(catalog);
    const invokeSpy = vi.spyOn(commands, "openWithGetAssociatedPrograms");

    await expect(getExplorerAssociatedPrograms("D:/demo/file.txt")).resolves.toBe(catalog);

    expect(nativeControlMock.callGreebleNativeWithInvokeFallback).toHaveBeenCalledWith(
      "explorer",
      "getAssociatedPrograms",
      { path: "D:/demo/file.txt" },
      expect.any(Function),
    );
    expect(invokeSpy).not.toHaveBeenCalled();
  });

  it("routes Windows shell context menus through explorer native control", async () => {
    const request = {
      targetKind: "entry" as const,
      currentDirectoryPath: "D:/demo",
      targetPaths: ["D:/demo/file.txt"],
    };
    nativeControlMock.callGreebleNativeWithInvokeFallback.mockResolvedValue([]);
    const invokeSpy = vi.spyOn(commands, "openWithGetShellContextMenu");

    await expect(getExplorerShellContextMenu(request)).resolves.toEqual([]);

    expect(nativeControlMock.callGreebleNativeWithInvokeFallback).toHaveBeenCalledWith(
      "explorer",
      "getShellContextMenu",
      request,
      expect.any(Function),
    );
    expect(invokeSpy).not.toHaveBeenCalled();
  });

  it("routes local file operation controls through explorer native control", async () => {
    nativeControlMock.callGreebleNativeWithInvokeFallback.mockResolvedValue(undefined);
    const renameSpy = vi.spyOn(commands, "fsRename");
    const deleteSpy = vi.spyOn(commands, "fsDeleteMany");

    await renameExplorerPath("D:/demo/old.txt", "D:/demo/new.txt");
    await deleteExplorerPaths(["D:/demo/new.txt"]);

    expect(nativeControlMock.callGreebleNativeWithInvokeFallback).toHaveBeenCalledWith(
      "explorer",
      "renamePath",
      { oldPath: "D:/demo/old.txt", newPath: "D:/demo/new.txt" },
      expect.any(Function),
    );
    expect(nativeControlMock.callGreebleNativeWithInvokeFallback).toHaveBeenCalledWith(
      "explorer",
      "deleteMany",
      { paths: ["D:/demo/new.txt"] },
      expect.any(Function),
    );
    expect(renameSpy).not.toHaveBeenCalled();
    expect(deleteSpy).not.toHaveBeenCalled();
  });

  it("routes local transfer controls through explorer native control", async () => {
    nativeControlMock.callGreebleNativeWithInvokeFallback.mockResolvedValue([]);
    const invokeSpy = vi.spyOn(commands, "fsTransferItems");

    await expect(
      transferExplorerItems(
        "D:/demo/target",
        ["D:/demo/source.txt"],
        "copy",
        "keep_both",
      ),
    ).resolves.toEqual([]);

    expect(nativeControlMock.callGreebleNativeWithInvokeFallback).toHaveBeenCalledWith(
      "explorer",
      "transferItems",
      {
        targetDir: "D:/demo/target",
        sources: ["D:/demo/source.txt"],
        operation: "copy",
        collisionPolicy: "keep_both",
      },
      expect.any(Function),
    );
    expect(invokeSpy).not.toHaveBeenCalled();
  });

  it("routes task-center controls through explorer native control", async () => {
    nativeControlMock.callGreebleNativeWithInvokeFallback
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce({
        id: "task-1",
        kind: "copy",
        status: "cancelled",
        title: "Copy",
        detail: "",
        progressCurrent: null,
        progressTotal: null,
        startedAt: 1,
        finishedAt: 2,
        sourcePaths: [],
        destinationPath: null,
        errorMessage: null,
        canRetry: false,
        canCancel: false,
        canRevealOutput: false,
        canOpenOutput: false,
        canUndo: false,
        schedulerTask: null,
      });
    const listSpy = vi.spyOn(commands, "fsListExplorerTasks");
    const cancelSpy = vi.spyOn(commands, "fsCancelExplorerTask");

    await expect(listExplorerTasks()).resolves.toEqual([]);
    await expect(cancelExplorerTask("task-1")).resolves.toMatchObject({
      id: "task-1",
      status: "cancelled",
    });

    expect(nativeControlMock.callGreebleNativeWithInvokeFallback).toHaveBeenCalledWith(
      "explorer",
      "listTasks",
      undefined,
      expect.any(Function),
    );
    expect(nativeControlMock.callGreebleNativeWithInvokeFallback).toHaveBeenCalledWith(
      "explorer",
      "cancelTask",
      { taskId: "task-1" },
      expect.any(Function),
    );
    expect(listSpy).not.toHaveBeenCalled();
    expect(cancelSpy).not.toHaveBeenCalled();
  });
});
