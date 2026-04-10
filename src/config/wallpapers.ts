import { getManagedContentDirectory } from './appContentDirectories';
import { resolveRuntimeAssetPollingEnabled } from './runtimeAssetPolling';

export type OverlayWallpaperFitMode = 'cover' | 'contain' | 'fill';

export const overlayWallpaperFitModes = [
  {
    id: 'cover',
    label: 'Cover',
    description: 'Fill the shell and crop if needed.',
  },
  {
    id: 'contain',
    label: 'Contain',
    description: 'Keep the whole frame visible.',
  },
  {
    id: 'fill',
    label: 'Fill',
    description: 'Stretch to the shell bounds.',
  },
] as const;

export function resolveWallpapersDirectory(): string {
  return getManagedContentDirectory('wallpapers');
}

export const wallpaperSystemConfig = {
  get wallpapersDirectory(): string {
    return resolveWallpapersDirectory();
  },
  frontendExtensions: ['tsx', 'ts', 'jsx', 'js'] as const,
  imageExtensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg', 'avif'] as const,
  videoExtensions: ['mp4', 'webm', 'mov', 'm4v', 'ogv'] as const,
  runtimeModuleName: 'overlayterm-wallpaper',
  runtimeAssetPollingEnabled: resolveRuntimeAssetPollingEnabled(),
  scanIntervalMs: 2000,
  noneWallpaperId: 'none',
} as const;

export function normalizeOverlayWallpaperFitMode(value: unknown): OverlayWallpaperFitMode {
  return overlayWallpaperFitModes.find(mode => mode.id === value)?.id ?? 'cover';
}

export function getOverlayWallpaperFitModeLabel(mode: OverlayWallpaperFitMode): string {
  return overlayWallpaperFitModes.find(entry => entry.id === mode)?.label ?? mode;
}
