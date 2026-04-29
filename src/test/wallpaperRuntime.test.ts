import { beforeEach, describe, expect, it, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import {
  createMediaWallpaperFromFile,
  createThemeAssetWallpaper,
  resolveActiveWallpaper,
  type LoadedOverlayWallpaper,
} from '../components/wallpaperRuntime';
import { wallpaperSystemConfig } from '../config/wallpapers';

function createWallpaper(id: string): LoadedOverlayWallpaper {
  return {
    id,
    name: id,
    filePath: `wallpapers/${id}.mp4`,
    wallpaperRoot: 'wallpapers',
    source: 'folder',
    kind: 'video',
    assetUrl: `asset://localhost/wallpapers/${id}.mp4`,
    previewUrl: undefined,
    modified: 1,
    description: 'Test wallpaper',
    group: 'Tests',
    tags: ['test'],
    renderBackground: null,
    error: null,
  };
}

describe('wallpaperRuntime', () => {
  beforeEach(() => {
    vi.mocked(invoke).mockReset();
  });

  it('inlines managed SVG wallpapers into data URLs for dependable shell backdrops', async () => {
    vi.mocked(invoke).mockImplementation(async (command) => {
      if (command === 'fs_read_file_base64') {
        return 'PHN2Zy8+';
      }
      throw new Error(`Unexpected invoke call: ${command}`);
    });

    const wallpaper = await createMediaWallpaperFromFile({
      name: 'aurora.svg',
      path: 'wallpapers/aurora.svg',
      is_dir: false,
      extension: 'svg',
      modified: 1,
    });

    expect(wallpaper.assetUrl).toBe('data:image/svg+xml;base64,PHN2Zy8+');
    expect(wallpaper.previewUrl).toBe('data:image/svg+xml;base64,PHN2Zy8+');
  });

  it('keeps prebuilt SVG data URLs intact when the filesystem bridge already returns one', async () => {
    vi.mocked(invoke).mockImplementation(async (command) => {
      if (command === 'fs_read_file_base64') {
        return 'data:image/svg+xml;base64,PHN2Zy8+';
      }
      throw new Error(`Unexpected invoke call: ${command}`);
    });

    const wallpaper = await createMediaWallpaperFromFile({
      name: 'aurora.svg',
      path: 'wallpapers/aurora.svg',
      is_dir: false,
      extension: 'svg',
      modified: 1,
    });

    expect(wallpaper.assetUrl).toBe('data:image/svg+xml;base64,PHN2Zy8+');
    expect(wallpaper.previewUrl).toBe('data:image/svg+xml;base64,PHN2Zy8+');
  });

  it('keeps raster wallpapers on the direct asset path', async () => {
    const wallpaper = await createMediaWallpaperFromFile({
      name: 'aurora.png',
      path: 'wallpapers/aurora.png',
      is_dir: false,
      extension: 'png',
      modified: 1,
    });

    expect(wallpaper.assetUrl).toBe('asset://localhost/wallpapers/aurora.png');
    expect(wallpaper.previewUrl).toBe('asset://localhost/wallpapers/aurora.png');
    expect(vi.mocked(invoke)).not.toHaveBeenCalled();
  });

  it('follows the theme wallpaper when there is no user override', () => {
    const themeWallpaper = createThemeAssetWallpaper({
      themeId: 'vista-glass',
      themeName: 'Vista Glass',
      assetUrl: 'asset://localhost/themes/vista-glass/wallpaper.mp4',
    });

    const resolved = resolveActiveWallpaper({
      availableWallpapers: [createWallpaper('aurora')],
      userOverrideId: null,
      themeWallpaper,
    });

    expect(resolved.source).toBe('theme');
    expect(resolved.wallpaper?.id).toBe('theme:vista-glass');
    expect(resolved.wallpaper?.kind).toBe('video');
  });

  it('prefers the user wallpaper override over the theme wallpaper', () => {
    const resolved = resolveActiveWallpaper({
      availableWallpapers: [createWallpaper('aurora')],
      userOverrideId: 'aurora',
      themeWallpaper: createThemeAssetWallpaper({
        themeId: 'vista-glass',
        themeName: 'Vista Glass',
        assetUrl: 'asset://localhost/themes/vista-glass/wallpaper.png',
      }),
    });

    expect(resolved.source).toBe('user');
    expect(resolved.wallpaper?.id).toBe('aurora');
  });

  it('allows explicitly disabling the wallpaper layer', () => {
    const resolved = resolveActiveWallpaper({
      availableWallpapers: [createWallpaper('aurora')],
      userOverrideId: wallpaperSystemConfig.noneWallpaperId,
      themeWallpaper: createThemeAssetWallpaper({
        themeId: 'vista-glass',
        themeName: 'Vista Glass',
        assetUrl: 'asset://localhost/themes/vista-glass/wallpaper.png',
      }),
    });

    expect(resolved.source).toBe('none');
    expect(resolved.wallpaper).toBeNull();
  });
});
