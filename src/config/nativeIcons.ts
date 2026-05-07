export const DEFAULT_NATIVE_ICON_SIZE = 96;

export const EXPLORER_NATIVE_APP_ICON_EXTENSIONS = [
  'appref-ms',
  'exe',
  'lnk',
  'msi',
  'url',
  'website',
] as const;

export interface OverlayNativeIconRequest {
  path: string;
  size?: number;
}

export interface OverlayNativeIconResponse {
  path: string;
  src?: string | null;
}

function normalizeNativeIconExtension(value: string | null | undefined): string {
  return (value ?? '').trim().replace(/^\./, '').toLowerCase();
}

function inferNativeIconExtensionFromName(entryName: string): string {
  const trimmedEntryName = entryName.trim();
  const lastDotIndex = trimmedEntryName.lastIndexOf('.');
  if (lastDotIndex <= 0 || lastDotIndex === trimmedEntryName.length - 1) {
    return '';
  }
  return trimmedEntryName.slice(lastDotIndex + 1).toLowerCase();
}

export function isExplorerNativeAppIconExtension(extension: string | null | undefined): boolean {
  const normalizedExtension = normalizeNativeIconExtension(extension);
  return EXPLORER_NATIVE_APP_ICON_EXTENSIONS.includes(
    normalizedExtension as (typeof EXPLORER_NATIVE_APP_ICON_EXTENSIONS)[number],
  );
}

export function isExplorerNativeAppIconEntry(entryName: string, extension: string | null | undefined): boolean {
  return (
    isExplorerNativeAppIconExtension(extension) ||
    isExplorerNativeAppIconExtension(inferNativeIconExtensionFromName(entryName))
  );
}

export function getNativeIconCacheKey(path: string, size = DEFAULT_NATIVE_ICON_SIZE): string {
  return `${path}::${size}`;
}
