import type {
  ExplorerBackendContract,
  ExplorerLocationListing,
} from '../../runtime/explorerBackend';

const explorerDirectoryResultCache = new Map<string, Promise<ExplorerLocationListing> | ExplorerLocationListing>();

export function getExplorerDirectoryCacheKey(path: string, showHidden: boolean): string {
  return `${showHidden ? 'hidden' : 'visible'}::${path}`;
}

export async function loadCachedExplorerLocation(args: {
  path: string;
  showHidden: boolean;
  listLocation: ExplorerBackendContract['listLocation'];
}): Promise<ExplorerLocationListing> {
  const key = getExplorerDirectoryCacheKey(args.path, args.showHidden);
  const cachedValue = explorerDirectoryResultCache.get(key);
  if (cachedValue) {
    return cachedValue instanceof Promise ? cachedValue : cachedValue;
  }

  const pending = args.listLocation(args.path, args.showHidden)
    .then((listing) => {
      explorerDirectoryResultCache.set(key, listing);
      return listing;
    })
    .catch((error) => {
      explorerDirectoryResultCache.delete(key);
      throw error;
    });
  explorerDirectoryResultCache.set(key, pending);
  return pending;
}

export function storeExplorerCachedLocation(args: {
  path: string;
  showHidden: boolean;
  listing: ExplorerLocationListing;
}): void {
  explorerDirectoryResultCache.set(
    getExplorerDirectoryCacheKey(args.path, args.showHidden),
    args.listing,
  );
}

export function invalidateExplorerDirectoryResultCaches(pathPrefix?: string): void {
  if (!pathPrefix) {
    explorerDirectoryResultCache.clear();
    return;
  }

  for (const key of [...explorerDirectoryResultCache.keys()]) {
    const [, cachedPath] = key.split('::');
    if (cachedPath && cachedPath.startsWith(pathPrefix)) {
      explorerDirectoryResultCache.delete(key);
    }
  }
}
