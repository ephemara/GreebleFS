export const DEFAULT_NATIVE_ICON_SIZE = 32;

export interface OverlayNativeIconRequest {
  path: string;
  size?: number;
}

export interface OverlayNativeIconResponse {
  path: string;
  src?: string | null;
}

export function getNativeIconCacheKey(path: string, size = DEFAULT_NATIVE_ICON_SIZE): string {
  return `${path}::${size}`;
}
