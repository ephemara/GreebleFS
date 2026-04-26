import { beforeEach, describe, expect, it, vi } from "vitest";

import { buildExplorerArchiveVirtualPath } from "../config/explorerArchives";
import { readExplorerCollectionPreviewOverviewThumbnail } from "../runtime/explorerCollectionPreviewThumbnails";
import { materializeExplorerArchiveEntry } from "../runtime/explorerBackend";
import { readExplorerThumbnailForEntry } from "../runtime/explorerThumbnailArtifactRuntime";
import { readExplorerModelThumbnail } from "../runtime/modelThumbnailBackend";
import { createTestExplorerFileEntry } from "./helpers/explorerEntries";

vi.mock("../runtime/explorerBackend", () => ({
  materializeExplorerArchiveEntry: vi.fn(),
}));

vi.mock("../runtime/explorerThumbnailArtifactRuntime", () => ({
  readExplorerThumbnailForEntry: vi.fn(),
}));

vi.mock("../runtime/modelThumbnailBackend", () => ({
  readExplorerModelThumbnail: vi.fn(),
}));

describe("explorerCollectionPreviewThumbnails", () => {
  beforeEach(() => {
    vi.mocked(materializeExplorerArchiveEntry).mockReset();
    vi.mocked(readExplorerThumbnailForEntry).mockReset();
    vi.mocked(readExplorerModelThumbnail).mockReset();
  });

  it("reads local overview thumbnails directly from the explorer thumbnail artifact runtime", async () => {
    const thumbnail = {
      kind: "image" as const,
      posterDataUrl: "data:image/png;base64,bG9jYWw=",
      hoverFrames: [],
      hoverFrameDelayMs: null,
    };
    const entry = createTestExplorerFileEntry({
      name: "preview.png",
      path: "C:\\Assets\\preview.png",
      extension: "png",
      size: 4096,
    });

    vi.mocked(readExplorerThumbnailForEntry).mockResolvedValue(thumbnail);

    await expect(
      readExplorerCollectionPreviewOverviewThumbnail({
        entry,
        maxWidth: 180,
        maxHeight: 180,
      }),
    ).resolves.toEqual(thumbnail);

    expect(readExplorerThumbnailForEntry).toHaveBeenCalledWith({
      entry,
      maxWidth: 180,
      maxHeight: 180,
      includeVideoHoverScrub: false,
      videoHoverFrameCount: null,
    });
  });

  it("stages archive entries before reading forced overview thumbnails", async () => {
    const archivePath = "C:\\Assets\\demo.zip";
    const archiveEntryPath = buildExplorerArchiveVirtualPath({
      archivePath,
      entryPath: "docs/preview.png",
    });
    const stagedPath = "C:\\Temp\\greeblefs-stage\\preview.png";
    const thumbnail = {
      kind: "image" as const,
      posterDataUrl: "data:image/png;base64,YXJjaGl2ZQ==",
      hoverFrames: [],
      hoverFrameDelayMs: null,
    };
    const entry = createTestExplorerFileEntry({
      name: "preview.png",
      path: archiveEntryPath,
      extension: "png",
      size: 2048,
    });

    vi.mocked(materializeExplorerArchiveEntry).mockResolvedValue({
      outputPath: stagedPath,
    } as Awaited<ReturnType<typeof materializeExplorerArchiveEntry>>);
    vi.mocked(readExplorerThumbnailForEntry).mockResolvedValue(thumbnail);

    await expect(
      readExplorerCollectionPreviewOverviewThumbnail({
        entry,
        maxWidth: 200,
        maxHeight: 200,
      }),
    ).resolves.toEqual(thumbnail);

    expect(materializeExplorerArchiveEntry).toHaveBeenCalledWith({
      archivePath,
      entryPath: "docs/preview.png",
      entryIsDir: false,
      mode: "stageTemporary",
    });
    expect(readExplorerThumbnailForEntry).toHaveBeenCalledWith({
      entry: expect.objectContaining({
        path: stagedPath,
        entityId: entry.entityId,
        contentRevision: entry.contentRevision,
      }),
      maxWidth: 200,
      maxHeight: 200,
      includeVideoHoverScrub: false,
      videoHoverFrameCount: null,
    });
  });

  it("routes model entries through the model thumbnail renderer path", async () => {
    const thumbnail = {
      kind: "image" as const,
      posterDataUrl: "data:image/png;base64,bW9kZWw=",
      hoverFrames: [],
      hoverFrameDelayMs: null,
    };
    const entry = createTestExplorerFileEntry({
      name: "scene.glb",
      path: "C:\\Assets\\scene.glb",
      extension: "glb",
      size: 8192,
    });

    vi.mocked(readExplorerModelThumbnail).mockResolvedValue(thumbnail);

    await expect(
      readExplorerCollectionPreviewOverviewThumbnail({
        entry,
        maxWidth: 220,
        maxHeight: 220,
      }),
    ).resolves.toEqual(thumbnail);

    expect(readExplorerModelThumbnail).toHaveBeenCalledWith({
      entry,
      maxWidth: 220,
      maxHeight: 220,
    });
    expect(readExplorerThumbnailForEntry).not.toHaveBeenCalled();
  });
});
