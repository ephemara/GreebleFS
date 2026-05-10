import {
  readExplorerThumbnailArtifact,
  readExplorerThumbnailArtifactsBatch,
  type ExplorerEntryThumbnailData,
  type ExplorerEntryThumbnailInput,
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

export interface ReadExplorerThumbnailsForEntriesBatchInput {
  requests: readonly ReadExplorerThumbnailForEntryInput[];
  generation?: number | null;
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

export async function readExplorerThumbnailsForEntriesBatch(
  input: ReadExplorerThumbnailsForEntriesBatchInput,
): Promise<Array<ExplorerEntryThumbnailData | null>> {
  if (input.requests.length === 0) {
    return [];
  }

  const resolvedThumbnails = new Array<ExplorerEntryThumbnailData | null>(
    input.requests.length,
  );
  const pendingReads: Array<{
    index: number;
    cacheKey: string;
    read: Promise<ExplorerEntryThumbnailData | null>;
  }> = [];
  const uncachedRequests: Array<{
    outputIndexes: number[];
    cacheKey: string;
    request: ReadExplorerThumbnailForEntryInput;
  }> = [];
  const uncachedRequestsByCacheKey = new Map<
    string,
    (typeof uncachedRequests)[number]
  >();

  for (const [index, request] of input.requests.entries()) {
    const cacheKey = buildExplorerArtifactThumbnailCacheKey(request);
    if (resolvedExplorerThumbnailCache.has(cacheKey)) {
      resolvedThumbnails[index] =
        resolvedExplorerThumbnailCache.get(cacheKey) ?? null;
      continue;
    }

    const pendingRead = pendingExplorerThumbnailReads.get(cacheKey);
    if (pendingRead) {
      pendingReads.push({ index, cacheKey, read: pendingRead });
      continue;
    }

    const existingUncachedRequest = uncachedRequestsByCacheKey.get(cacheKey);
    if (existingUncachedRequest) {
      existingUncachedRequest.outputIndexes.push(index);
      continue;
    }

    const uncachedRequest = { outputIndexes: [index], cacheKey, request };
    uncachedRequestsByCacheKey.set(cacheKey, uncachedRequest);
    uncachedRequests.push(uncachedRequest);
  }

  if (uncachedRequests.length > 0) {
    const batchRead = readExplorerThumbnailArtifactsBatch({
      requests: uncachedRequests.map(({ request }) =>
        toExplorerEntryThumbnailInput(request),
      ),
      generation: input.generation ?? null,
    })
      .then(async (response) => {
        const thumbnailsByCacheKey = new Map<
          string,
          ExplorerEntryThumbnailData | null
        >();
        await Promise.all(
          response.results.map(async (result) => {
            const pendingRequest = uncachedRequests[result.index];
            if (!pendingRequest) {
              return;
            }
            const thumbnail = result.artifact
              ? await mapThumbnailArtifactToEntryThumbnail(result.artifact)
              : null;
            resolvedExplorerThumbnailCache.set(
              pendingRequest.cacheKey,
              thumbnail,
            );
            thumbnailsByCacheKey.set(pendingRequest.cacheKey, thumbnail);
          }),
        );

        for (const pendingRequest of uncachedRequests) {
          if (!thumbnailsByCacheKey.has(pendingRequest.cacheKey)) {
            resolvedExplorerThumbnailCache.set(pendingRequest.cacheKey, null);
            thumbnailsByCacheKey.set(pendingRequest.cacheKey, null);
          }
        }

        return thumbnailsByCacheKey;
      })
      .catch(() => {
        const thumbnailsByCacheKey = new Map<
          string,
          ExplorerEntryThumbnailData | null
        >();
        for (const pendingRequest of uncachedRequests) {
          resolvedExplorerThumbnailCache.set(pendingRequest.cacheKey, null);
          thumbnailsByCacheKey.set(pendingRequest.cacheKey, null);
        }
        return thumbnailsByCacheKey;
      });

    for (const pendingRequest of uncachedRequests) {
      const read = batchRead
        .then(
          (thumbnailsByCacheKey) =>
            thumbnailsByCacheKey.get(pendingRequest.cacheKey) ?? null,
        )
        .finally(() => {
          pendingExplorerThumbnailReads.delete(pendingRequest.cacheKey);
        });
      pendingExplorerThumbnailReads.set(pendingRequest.cacheKey, read);
      for (const outputIndex of pendingRequest.outputIndexes) {
        pendingReads.push({
          index: outputIndex,
          cacheKey: pendingRequest.cacheKey,
          read,
        });
      }
    }
  }

  await Promise.all(
    pendingReads.map(async ({ index, read }) => {
      resolvedThumbnails[index] = await read;
    }),
  );

  return resolvedThumbnails;
}

function toExplorerEntryThumbnailInput(
  request: ReadExplorerThumbnailForEntryInput,
): ExplorerEntryThumbnailInput {
  return {
    path: request.entry.path,
    entityId: request.entry.entityId,
    contentRevision: request.entry.contentRevision,
    maxWidth: Math.max(1, Math.floor(request.maxWidth)),
    maxHeight: Math.max(1, Math.floor(request.maxHeight)),
    includeVideoHoverScrub: request.includeVideoHoverScrub,
    videoHoverFrameCount: request.videoHoverFrameCount,
  };
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
