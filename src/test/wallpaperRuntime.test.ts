import { describe, expect, it } from 'vitest';
import {
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
