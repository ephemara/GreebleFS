export const EXPLORER_HOME_PATH = 'greeblefs://home';
const EXPLORER_VIRTUAL_SCHEME = 'greeblefs://';

export function normalizeExplorerVirtualPath(path: string): string {
  const trimmedPath = path.trim();
  if (!trimmedPath) {
    return trimmedPath;
  }

  if (!trimmedPath.toLowerCase().startsWith(EXPLORER_VIRTUAL_SCHEME)) {
    return trimmedPath;
  }

  const [schemeAndPath, ...queryParts] = trimmedPath.split('?');
  const normalizedBase = schemeAndPath.replace(/\/+$/, '').toLowerCase();
  return queryParts.length > 0
    ? `${normalizedBase}?${queryParts.join('?')}`
    : normalizedBase;
}

export function isExplorerVirtualPath(path: string): boolean {
  return normalizeExplorerVirtualPath(path).startsWith(EXPLORER_VIRTUAL_SCHEME);
}

export function isExplorerHomePath(path: string): boolean {
  return normalizeExplorerVirtualPath(path) === EXPLORER_HOME_PATH;
}

export function isExplorerTrackableFolderPath(path: string): boolean {
  const trimmedPath = path.trim();
  return trimmedPath.length > 0
    && !trimmedPath.startsWith('cloud://')
    && !isExplorerVirtualPath(trimmedPath);
}
