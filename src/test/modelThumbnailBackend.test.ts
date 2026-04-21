import { beforeEach, describe, expect, it, vi } from "vitest";
import { invalidateExplorerPreviewCache } from "../components/explorer/explorerPreviewCache";

const { renderModelThumbnailDataUrlMock } = vi.hoisted(() => ({
  renderModelThumbnailDataUrlMock: vi.fn(),
}));

vi.mock("../runtime/modelThumbnailRenderer", () => ({
  renderModelThumbnailDataUrl: renderModelThumbnailDataUrlMock,
}));

import { readExplorerModelThumbnail } from "../runtime/modelThumbnailBackend";

describe("modelThumbnailBackend", () => {
  beforeEach(() => {
    invalidateExplorerPreviewCache();
    renderModelThumbnailDataUrlMock.mockReset();
  });

  it("renders model thumbnails through the shared GPU renderer and caches the result", async () => {
    renderModelThumbnailDataUrlMock.mockResolvedValueOnce("data:image/png;base64,thumb-one");

    const entry = {
      path: "/models/cube.glb",
      size: 2048,
      modified: 172,
      extension: "glb",
    };

    const firstThumbnail = await readExplorerModelThumbnail({
      entry,
      maxWidth: 256,
      maxHeight: 256,
    });
    const secondThumbnail = await readExplorerModelThumbnail({
      entry,
      maxWidth: 256,
      maxHeight: 256,
    });

    expect(firstThumbnail).toEqual({
      kind: "image",
      posterDataUrl: "data:image/png;base64,thumb-one",
      hoverFrames: [],
      hoverFrameDelayMs: null,
    });
    expect(secondThumbnail).toBe(firstThumbnail);
    expect(renderModelThumbnailDataUrlMock).toHaveBeenCalledTimes(1);
    expect(renderModelThumbnailDataUrlMock).toHaveBeenCalledWith({
      format: "glb",
      sourcePath: "/models/cube.glb",
      maxWidth: 256,
      maxHeight: 256,
    });
  });
});
