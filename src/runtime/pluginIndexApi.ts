import { convertFileSrc } from "@tauri-apps/api/core";
import { EXPLORER_IMAGE_PREVIEW_EXTENSIONS } from "../config/filePreview";
import type { GlobalSearchIndexQueryRequest } from "../generated/tauri";
import {
  buildExplorerSemanticIndex,
  findSimilarExplorerSemantic,
  getExplorerSemanticIndexSummary,
  searchExplorerSemantic,
  type ExplorerSemanticFindSimilarInput,
  type ExplorerSemanticIndexBuildInput,
  type ExplorerSemanticIndexBuildStart,
  type ExplorerSemanticIndexSummaryValue,
  type ExplorerSemanticSearchInput,
  type ExplorerSemanticSearchOutput,
} from "./explorerBackend";
import {
  cancelGlobalSearchScan,
  findGlobalSearchByExtensions,
  getGlobalSearchStatus,
  initGlobalSearch,
  queryGlobalSearch,
  queryGlobalSearchIndex,
  queryGlobalSearchUnderPath,
  startGlobalSearchScan,
  type GlobalSearchIndexQueryRequestValue,
  type GlobalSearchQueryOptionsValue,
  type GlobalSearchResultValue,
  type GlobalSearchScanSettingsValue,
  type GlobalSearchStatusValue,
} from "./globalSearchBackend";

const DEFAULT_PLUGIN_MEDIA_RESULT_LIMIT = 240;

export interface PluginIndexTextSearchRequest {
  query: string;
  limit?: number;
  priorityPaths?: string[];
  queryOptions?: Partial<GlobalSearchQueryOptionsValue>;
}

export interface PluginIndexScopedTextSearchRequest {
  rootPath: string;
  query: string;
  limit?: number;
  queryOptions?: Partial<GlobalSearchQueryOptionsValue>;
}

export interface PluginIndexExtensionSearchRequest {
  extensions: string[];
  query?: string | null;
  limit?: number;
  offset?: number;
  rootPaths?: string[];
  includeHidden?: boolean;
  sortKey?: GlobalSearchIndexQueryRequest["sortKey"];
  sortDirection?: GlobalSearchIndexQueryRequest["sortDirection"];
}

export interface PluginIndexPictureSearchRequest {
  query?: string | null;
  limit?: number;
  offset?: number;
  rootPaths?: string[];
  includeHidden?: boolean;
  extensions?: string[];
}

export interface PluginIndexMediaEntry extends GlobalSearchResultValue {
  assetUrl: string;
  mediaKind: "picture";
}

export interface OverlayPluginIndexApi {
  global: {
    init: () => Promise<GlobalSearchStatusValue>;
    getStatus: () => Promise<GlobalSearchStatusValue>;
    startScan: (
      settings?: Partial<GlobalSearchScanSettingsValue>,
    ) => Promise<void>;
    cancelScan: () => Promise<void>;
    search: (
      request: PluginIndexTextSearchRequest,
    ) => Promise<GlobalSearchResultValue[]>;
    searchUnderPath: (
      request: PluginIndexScopedTextSearchRequest,
    ) => Promise<GlobalSearchResultValue[]>;
    query: (
      request: Partial<GlobalSearchIndexQueryRequestValue>,
    ) => Promise<GlobalSearchResultValue[]>;
    findByExtensions: (
      request: PluginIndexExtensionSearchRequest,
    ) => Promise<GlobalSearchResultValue[]>;
  };
  semantic: {
    getSummary: (
      rootPath: string,
    ) => Promise<ExplorerSemanticIndexSummaryValue>;
    build: (
      request: ExplorerSemanticIndexBuildInput,
    ) => Promise<ExplorerSemanticIndexBuildStart>;
    search: (
      request: ExplorerSemanticSearchInput,
    ) => Promise<ExplorerSemanticSearchOutput>;
    findSimilar: (
      request: ExplorerSemanticFindSimilarInput,
    ) => Promise<ExplorerSemanticSearchOutput>;
  };
  media: {
    findPictures: (
      request?: PluginIndexPictureSearchRequest,
    ) => Promise<PluginIndexMediaEntry[]>;
  };
}

function resolveFileAssetUrl(path: string): string {
  try {
    return convertFileSrc(path);
  } catch {
    const normalized = path.replace(/\\/g, "/");
    return normalized.startsWith("/")
      ? `file://${encodeURI(normalized)}`
      : `file:///${encodeURI(normalized)}`;
  }
}

function withMediaAssetUrls(
  entries: GlobalSearchResultValue[],
): PluginIndexMediaEntry[] {
  return entries.map((entry) => ({
    ...entry,
    assetUrl: resolveFileAssetUrl(entry.path),
    mediaKind: "picture",
  }));
}

export function createPluginIndexApi(): OverlayPluginIndexApi {
  return {
    global: {
      init: initGlobalSearch,
      getStatus: getGlobalSearchStatus,
      startScan: startGlobalSearchScan,
      cancelScan: cancelGlobalSearchScan,
      search: queryGlobalSearch,
      searchUnderPath: queryGlobalSearchUnderPath,
      query: queryGlobalSearchIndex,
      findByExtensions: findGlobalSearchByExtensions,
    },
    semantic: {
      getSummary: getExplorerSemanticIndexSummary,
      build: buildExplorerSemanticIndex,
      search: searchExplorerSemantic,
      findSimilar: findSimilarExplorerSemantic,
    },
    media: {
      findPictures: async (request = {}) => {
        const entries = await findGlobalSearchByExtensions({
          extensions: request.extensions ?? [...EXPLORER_IMAGE_PREVIEW_EXTENSIONS],
          query: request.query ?? null,
          limit: request.limit ?? DEFAULT_PLUGIN_MEDIA_RESULT_LIMIT,
          offset: request.offset ?? 0,
          rootPaths: request.rootPaths ?? [],
          includeHidden: request.includeHidden ?? false,
          sortKey: "modifiedTime",
          sortDirection: "desc",
        });

        return withMediaAssetUrls(entries);
      },
    },
  };
}
