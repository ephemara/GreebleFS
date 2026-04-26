import { parseExplorerArchiveVirtualPath } from "../config/explorerArchives";
import { canRenderExplorerThumbnail, defaultExplorerThumbnailSettings } from "../config/explorerThumbnails";
import { getModelPreviewFormat } from "../config/filePreview";
import {
  materializeExplorerArchiveEntry,
  type ExplorerEntryThumbnailData,
  type ExplorerFileEntry,
} from "./explorerBackend";
import { readExplorerThumbnailForEntry } from "./explorerThumbnailArtifactRuntime";
import { readExplorerModelThumbnail } from "./modelThumbnailBackend";

const collectionPreviewArchiveMaterializationCache = new Map<
  string,
  Promise<string | null>
>();

const forcedCollectionPreviewThumbnailSettings = {
  ...defaultExplorerThumbnailSettings,
  enabled: true,
  includeImages: true,
  includeCode: true,
  includeShaders: true,
  includeModels: true,
  includeAudio: true,
  includeVideo: true,
} as const;

export interface ExplorerCollectionPreviewThumbnailRequest {
  entry: ExplorerFileEntry;
  maxWidth: number;
  maxHeight: number;
}

export function canRenderExplorerCollectionPreviewOverviewThumbnail(
  entry: ExplorerFileEntry,
): boolean {
  if (entry.is_dir) {
    return false;
  }
  return canRenderExplorerThumbnail(
    entry.extension,
    entry.size,
    forcedCollectionPreviewThumbnailSettings,
  );
}

export async function readExplorerCollectionPreviewOverviewThumbnail(
  request: ExplorerCollectionPreviewThumbnailRequest,
): Promise<ExplorerEntryThumbnailData | null> {
  if (!canRenderExplorerCollectionPreviewOverviewThumbnail(request.entry)) {
    return null;
  }

  const thumbnailEntry = await resolveCollectionPreviewThumbnailSourceEntry(
    request.entry,
  );
  if (!thumbnailEntry) {
    return null;
  }

  const modelPreviewFormat = getModelPreviewFormat(request.entry.extension);
  if (modelPreviewFormat) {
    return readExplorerModelThumbnail({
      entry: thumbnailEntry,
      maxWidth: request.maxWidth,
      maxHeight: request.maxHeight,
    });
  }

  return readExplorerThumbnailForEntry({
    entry: thumbnailEntry,
    maxWidth: request.maxWidth,
    maxHeight: request.maxHeight,
    includeVideoHoverScrub: false,
    videoHoverFrameCount: null,
  });
}

async function resolveCollectionPreviewThumbnailSourceEntry(
  entry: ExplorerFileEntry,
): Promise<ExplorerFileEntry | null> {
  const archiveLocation = parseExplorerArchiveVirtualPath(entry.path);
  if (!archiveLocation) {
    return entry;
  }

  const cacheKey = [
    archiveLocation.archivePath,
    archiveLocation.entryPath,
    entry.entityId,
    entry.contentRevision,
  ].join("::");
  const cachedMaterialization =
    collectionPreviewArchiveMaterializationCache.get(cacheKey);
  if (cachedMaterialization) {
    const outputPath = await cachedMaterialization;
    return outputPath ? { ...entry, path: outputPath } : null;
  }

  const pendingMaterialization = materializeExplorerArchiveEntry({
    archivePath: archiveLocation.archivePath,
    entryPath: archiveLocation.entryPath,
    entryIsDir: entry.is_dir,
    mode: "stageTemporary",
  })
    .then((result) => result.outputPath)
    .catch(() => null)
    .finally(() => {
      collectionPreviewArchiveMaterializationCache.delete(cacheKey);
    });

  collectionPreviewArchiveMaterializationCache.set(
    cacheKey,
    pendingMaterialization,
  );
  const outputPath = await pendingMaterialization;
  return outputPath ? { ...entry, path: outputPath } : null;
}
