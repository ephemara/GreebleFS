import { beforeEach, describe, expect, it, vi } from "vitest";

const explorerBackendMock = vi.hoisted(() => ({
  readExplorerThumbnailArtifact: vi.fn(),
  readExplorerThumbnailArtifactsBatch: vi.fn(),
}));

const ipcMock = vi.hoisted(() => ({
  resolveIpcArtifactUrl: vi.fn(async (artifact: { id: string }) => {
    return `artifact://${artifact.id}`;
  }),
}));

vi.mock("../runtime/explorerBackend", () => explorerBackendMock);
vi.mock("../runtime/ipc", () => ipcMock);

import {
  invalidateExplorerThumbnailArtifactRuntimeCache,
  readExplorerThumbnailsForEntriesBatch,
} from "../runtime/explorerThumbnailArtifactRuntime";

function request(path: string, identitySuffix: string) {
  return {
    entry: {
      path,
      entityId: `entity-${identitySuffix}`,
      contentRevision: `revision-${identitySuffix}`,
    },
    maxWidth: 160.9,
    maxHeight: 120.2,
    includeVideoHoverScrub: false,
    videoHoverFrameCount: null,
  };
}

function artifact(id: string, identitySuffix: string) {
  return {
    entityId: `entity-${identitySuffix}`,
    contentRevision: `revision-${identitySuffix}`,
    kind: "image",
    poster: {
      id,
      kind: "thumbnail",
      resourceRid: 1,
      mediaType: "image/png",
      byteLength: 8,
      retention: "session",
      identityKey: `entity-${identitySuffix}`,
      contentRevision: `revision-${identitySuffix}`,
    },
    hoverFrames: [],
    hoverFrameDelayMs: null,
  };
}

describe("explorerThumbnailArtifactRuntime", () => {
  beforeEach(() => {
    invalidateExplorerThumbnailArtifactRuntimeCache();
    explorerBackendMock.readExplorerThumbnailArtifact.mockReset();
    explorerBackendMock.readExplorerThumbnailArtifactsBatch.mockReset();
    ipcMock.resolveIpcArtifactUrl.mockClear();
  });

  it("reads uncached thumbnail artifacts as one native batch and caches resolved URLs", async () => {
    const firstRequest = request("D:/demo/a.png", "a");
    const secondRequest = request("D:/demo/b.png", "b");
    explorerBackendMock.readExplorerThumbnailArtifactsBatch.mockResolvedValue({
      results: [
        {
          index: 0,
          path: firstRequest.entry.path,
          artifact: artifact("poster-a", "a"),
          error: null,
        },
        {
          index: 1,
          path: secondRequest.entry.path,
          artifact: artifact("poster-b", "b"),
          error: null,
        },
      ],
      completedCount: 2,
      failedCount: 0,
    });

    await expect(
      readExplorerThumbnailsForEntriesBatch({
        requests: [firstRequest, secondRequest],
        generation: 7,
      }),
    ).resolves.toEqual([
      {
        kind: "image",
        posterDataUrl: "artifact://poster-a",
        hoverFrames: [],
        hoverFrameDelayMs: null,
      },
      {
        kind: "image",
        posterDataUrl: "artifact://poster-b",
        hoverFrames: [],
        hoverFrameDelayMs: null,
      },
    ]);

    expect(explorerBackendMock.readExplorerThumbnailArtifactsBatch).toHaveBeenCalledWith({
      requests: [
        {
          path: "D:/demo/a.png",
          entityId: "entity-a",
          contentRevision: "revision-a",
          maxWidth: 160,
          maxHeight: 120,
          includeVideoHoverScrub: false,
          videoHoverFrameCount: null,
        },
        {
          path: "D:/demo/b.png",
          entityId: "entity-b",
          contentRevision: "revision-b",
          maxWidth: 160,
          maxHeight: 120,
          includeVideoHoverScrub: false,
          videoHoverFrameCount: null,
        },
      ],
      generation: 7,
    });

    explorerBackendMock.readExplorerThumbnailArtifactsBatch.mockClear();
    await expect(
      readExplorerThumbnailsForEntriesBatch({
        requests: [firstRequest],
        generation: 8,
      }),
    ).resolves.toEqual([
      {
        kind: "image",
        posterDataUrl: "artifact://poster-a",
        hoverFrames: [],
        hoverFrameDelayMs: null,
      },
    ]);
    expect(explorerBackendMock.readExplorerThumbnailArtifactsBatch).not.toHaveBeenCalled();
  });

  it("coalesces duplicate identities before submitting a native thumbnail batch", async () => {
    const duplicateRequest = request("D:/demo/a.png", "a");
    explorerBackendMock.readExplorerThumbnailArtifactsBatch.mockResolvedValue({
      results: [
        {
          index: 0,
          path: duplicateRequest.entry.path,
          artifact: artifact("poster-a", "a"),
          error: null,
        },
      ],
      completedCount: 1,
      failedCount: 0,
    });

    await expect(
      readExplorerThumbnailsForEntriesBatch({
        requests: [duplicateRequest, duplicateRequest],
        generation: 11,
      }),
    ).resolves.toEqual([
      {
        kind: "image",
        posterDataUrl: "artifact://poster-a",
        hoverFrames: [],
        hoverFrameDelayMs: null,
      },
      {
        kind: "image",
        posterDataUrl: "artifact://poster-a",
        hoverFrames: [],
        hoverFrameDelayMs: null,
      },
    ]);

    expect(
      explorerBackendMock.readExplorerThumbnailArtifactsBatch.mock.calls[0][0]
        .requests,
    ).toHaveLength(1);
  });
});
