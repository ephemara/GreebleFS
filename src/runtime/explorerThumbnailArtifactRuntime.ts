import {
  readExplorerThumbnailArtifact,
  type ExplorerEntryThumbnailData,
  type ExplorerFileEntry,
} from "./explorerBackend";
import { resolveIpcArtifactUrl } from "./ipc";

type ExplorerThumbnailSourceEntry = Pick<
  ExplorerFileEntry,
  "path" | "entityId" | "contentRevision"
>;

export interface ReadExplorerThumbnailForEntryInput {
  entry: ExplorerThumbnailSourceEntry;
  maxWidth: number;
  maxHeight: number;
  includeVideoHoverScrub: boolean | null;
  videoHoverFrameCount: number | null;
}

const resolvedExplorerThumbnailCache = new Map<
  string,
  ExplorerEntryThumbnailData | null
>();
const pendingExplorerThumbnailReads = new Map<
  string,
  Promise<ExplorerEntryThumbnailData | null>
>();

export function invalidateExplorerThumbnailArtifactRuntimeCache(): void {
  resolvedExplorerThumbnailCache.clear();
  pendingExplorerThumbnailReads.clear();
}

export function peekExplorerThumbnailForEntry(
  request: ReadExplorerThumbnailForEntryInput,
): ExplorerEntryThumbnailData | null | undefined {
  const cacheKey = buildExplorerArtifactThumbnailCacheKey(request);
  if (!resolvedExplorerThumbnailCache.has(cacheKey)) {
    return undefined;
  }
  return resolvedExplorerThumbnailCache.get(cacheKey) ?? null;
}

export async function readExplorerThumbnailForEntry(
  request: ReadExplorerThumbnailForEntryInput,
): Promise<ExplorerEntryThumbnailData | null> {
  const cacheKey = buildExplorerArtifactThumbnailCacheKey(request);
  if (resolvedExplorerThumbnailCache.has(cacheKey)) {
    return resolvedExplorerThumbnailCache.get(cacheKey) ?? null;
  }

  const pendingRead = pendingExplorerThumbnailReads.get(cacheKey);
  if (pendingRead) {
    return pendingRead;
  }

  const nextRead = readExplorerThumbnailArtifact({
    path: request.entry.path,
    entityId: request.entry.entityId,
    contentRevision: request.entry.contentRevision,
    maxWidth: Math.max(1, Math.floor(request.maxWidth)),
    maxHeight: Math.max(1, Math.floor(request.maxHeight)),
    includeVideoHoverScrub: request.includeVideoHoverScrub,
    videoHoverFrameCount: request.videoHoverFrameCount,
  })
    .then((artifact) => mapThumbnailArtifactToEntryThumbnail(artifact))
    .catch(() => null)
    .then((thumbnail) => {
      resolvedExplorerThumbnailCache.set(cacheKey, thumbnail);
      return thumbnail;
    })
    .finally(() => {
      pendingExplorerThumbnailReads.delete(cacheKey);
    });

  pendingExplorerThumbnailReads.set(cacheKey, nextRead);
  return nextRead;
}

function buildExplorerArtifactThumbnailCacheKey(
  request: ReadExplorerThumbnailForEntryInput,
): string {
  return [
    "explorer-thumbnail-artifact",
    request.entry.entityId,
    request.entry.contentRevision,
    Math.max(1, Math.floor(request.maxWidth)),
    Math.max(1, Math.floor(request.maxHeight)),
    request.includeVideoHoverScrub ? "hover" : "poster",
    request.videoHoverFrameCount ?? 0,
  ].join("::");
}

async function mapThumbnailArtifactToEntryThumbnail(artifact: Awaited<
  ReturnType<typeof readExplorerThumbnailArtifact>
>): Promise<ExplorerEntryThumbnailData> {
  const hoverFrameDelayMs = artifact.hoverFrameDelayMs ?? null;
  const timestampStepSeconds = Math.max(hoverFrameDelayMs ?? 0, 1) / 1000;
  const [posterDataUrl, hoverFrameImageUrls] = await Promise.all([
    resolveIpcArtifactUrl(artifact.poster),
    Promise.all(
      artifact.hoverFrames.map((hoverFrameArtifact) =>
        resolveIpcArtifactUrl(hoverFrameArtifact),
      ),
    ),
  ]);

  return {
    kind: artifact.kind,
    posterDataUrl,
    hoverFrames: hoverFrameImageUrls.map((imageDataUrl, index) => ({
      imageDataUrl,
      timestampSeconds: Number((index * timestampStepSeconds).toFixed(3)),
    })),
    hoverFrameDelayMs,
  };
}
