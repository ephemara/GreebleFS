import { estimateStringPreviewCacheBytes, readCachedExplorerPreview, storeCachedExplorerPreview } from "../components/explorer/explorerPreviewCache";
import {
  getModelPreviewFormat,
  MODEL_THUMBNAIL_RENDER_CONFIG,
  type ModelPreviewFormat,
} from "../config/filePreview";
import { renderModelThumbnailDataUrl } from "./modelThumbnailRenderer";
import type { ExplorerEntryThumbnailData, ExplorerFileEntry } from "./explorerBackend";

export interface ExplorerModelThumbnailRequest {
  entry: Pick<
    ExplorerFileEntry,
    "path" | "size" | "modified" | "extension" | "entityId" | "contentRevision"
  >;
  maxWidth: number;
  maxHeight: number;
}

type ExplorerModelThumbnailSourceEntry = ExplorerModelThumbnailRequest["entry"];

const pendingModelThumbnailRenders = new Map<string, Promise<ExplorerEntryThumbnailData>>();

export async function readExplorerModelThumbnail(
  request: ExplorerModelThumbnailRequest,
): Promise<ExplorerEntryThumbnailData> {
  const format = getModelPreviewFormat(request.entry.extension);
  if (!format) {
    throw new Error(`Unsupported model thumbnail format: ${request.entry.extension}`);
  }

  const cacheKey = buildExplorerModelThumbnailCacheKey(
    request.entry,
    format,
    request.maxWidth,
    request.maxHeight,
  );
  const cachedThumbnail = readCachedExplorerPreview<ExplorerEntryThumbnailData>(cacheKey);
  if (cachedThumbnail) {
    return cachedThumbnail;
  }

  const pendingThumbnail = pendingModelThumbnailRenders.get(cacheKey);
  if (pendingThumbnail) {
    return pendingThumbnail;
  }

  const nextThumbnail = renderModelThumbnailDataUrl({
    format,
    sourcePath: request.entry.path,
    maxWidth: request.maxWidth,
    maxHeight: request.maxHeight,
  })
    .then((posterDataUrl) => {
      const thumbnail: ExplorerEntryThumbnailData = {
        kind: "image",
        posterDataUrl,
        hoverFrames: [],
        hoverFrameDelayMs: null,
      };

      storeCachedExplorerPreview({
        key: cacheKey,
        path: request.entry.path,
        value: thumbnail,
        bytes: estimateStringPreviewCacheBytes(posterDataUrl),
      });

      return thumbnail;
    })
    .finally(() => {
      pendingModelThumbnailRenders.delete(cacheKey);
    });

  pendingModelThumbnailRenders.set(cacheKey, nextThumbnail);
  return nextThumbnail;
}

function buildExplorerModelThumbnailCacheKey(
  entry: ExplorerModelThumbnailSourceEntry,
  format: ModelPreviewFormat,
  maxWidth: number,
  maxHeight: number,
): string {
  const normalizedWidth = Math.max(1, Math.floor(maxWidth));
  const normalizedHeight = Math.max(1, Math.floor(maxHeight));
  return [
    "model-thumbnail",
    MODEL_THUMBNAIL_RENDER_CONFIG.cacheVariant,
    format,
    entry.entityId,
    entry.contentRevision,
    normalizedWidth,
    normalizedHeight,
  ].join("::");
}
