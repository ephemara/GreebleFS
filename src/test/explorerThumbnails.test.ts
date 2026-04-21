import { describe, expect, it } from 'vitest';
import {
  EXPLORER_ENTRY_THUMBNAIL_BATCH_CONFIG,
  canRenderExplorerThumbnail,
  clampVideoHoverScrubFrameCount,
  defaultExplorerThumbnailSettings,
  isShaderThumbnailExtension,
  normalizeExplorerThumbnailSettings,
} from '../config/explorerThumbnails';

describe('explorerThumbnails', () => {
  it('normalizes thumbnail settings to the documented defaults', () => {
    expect(normalizeExplorerThumbnailSettings(undefined)).toEqual(defaultExplorerThumbnailSettings);
    expect(normalizeExplorerThumbnailSettings({
      enabled: false,
      includeImages: false,
      includeCode: false,
      includeShaders: false,
      includeAudio: false,
      includeVideo: false,
      enableVideoHoverScrub: false,
      videoHoverScrubFrameCount: 99,
    })).toEqual({
      enabled: false,
      includeImages: false,
      includeCode: false,
      includeShaders: false,
      includeAudio: false,
      includeVideo: false,
      enableVideoHoverScrub: false,
      videoHoverScrubFrameCount: 10,
    });
    expect(clampVideoHoverScrubFrameCount(0)).toBe(1);
    expect(clampVideoHoverScrubFrameCount(6)).toBe(defaultExplorerThumbnailSettings.videoHoverScrubFrameCount);
  });

  it('recognizes shader extensions and batches thumbnails with the expected throughput settings', () => {
    expect(isShaderThumbnailExtension('.WGSL')).toBe(true);
    expect(isShaderThumbnailExtension('glsl')).toBe(true);
    expect(isShaderThumbnailExtension('txt')).toBe(false);
    expect(EXPLORER_ENTRY_THUMBNAIL_BATCH_CONFIG.batchSize).toBe(12);
    expect(EXPLORER_ENTRY_THUMBNAIL_BATCH_CONFIG.maxDimensionPx).toBe(256);
  });

  it('gates thumbnail rendering by content family and the enabled flag', () => {
    expect(canRenderExplorerThumbnail('png', 2_048, defaultExplorerThumbnailSettings)).toBe(true);
    expect(canRenderExplorerThumbnail('mp3', 2_048, defaultExplorerThumbnailSettings)).toBe(true);
    expect(canRenderExplorerThumbnail('mp4', 2_048, defaultExplorerThumbnailSettings)).toBe(true);
    expect(canRenderExplorerThumbnail('wgsl', 2_048, defaultExplorerThumbnailSettings)).toBe(true);
    expect(canRenderExplorerThumbnail('ts', 4_096, defaultExplorerThumbnailSettings)).toBe(true);
    expect(
      canRenderExplorerThumbnail(
        'ts',
        4_096,
        defaultExplorerThumbnailSettings,
        'search',
      ),
    ).toBe(false);
    expect(canRenderExplorerThumbnail('png', 2_048, { ...defaultExplorerThumbnailSettings, enabled: false })).toBe(false);
  });
});
