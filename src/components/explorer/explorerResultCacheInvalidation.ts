import { invalidateExplorerDirectoryResultCaches } from "./explorerDirectoryCache";
import { invalidateExplorerPreviewCache } from "./explorerPreviewCache";

export type ExplorerSearchResultCacheInvalidator = (pathPrefix?: string) => void;

let activeSearchResultCacheInvalidator: ExplorerSearchResultCacheInvalidator | null = null;

export function registerExplorerSearchResultCacheInvalidator(
  invalidator: ExplorerSearchResultCacheInvalidator,
): void {
  activeSearchResultCacheInvalidator = invalidator;
}

export function invalidateExplorerResultCaches(pathPrefix?: string): void {
  invalidateExplorerDirectoryResultCaches(pathPrefix);
  invalidateExplorerPreviewCache(pathPrefix);
  activeSearchResultCacheInvalidator?.(pathPrefix);
}
