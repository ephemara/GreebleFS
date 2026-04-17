import {
  isAudioPreviewExtension,
  isEditableTextExtension,
  isImagePreviewExtension,
  isVideoPreviewExtension,
} from './filePreview';

export interface ExplorerThumbnailSettings {
  enabled: boolean;
  includeImages: boolean;
  includeCode: boolean;
  includeShaders: boolean;
  includeAudio: boolean;
  includeVideo: boolean;
  enableVideoHoverScrub: boolean;
  videoHoverScrubFrameCount: number;
}

export const defaultExplorerThumbnailSettings: ExplorerThumbnailSettings = {
  enabled: true,
  includeImages: true,
  includeCode: true,
  includeShaders: true,
  includeAudio: true,
  includeVideo: true,
  enableVideoHoverScrub: true,
  videoHoverScrubFrameCount: 6,
};

export const EXPLORER_ENTRY_THUMBNAIL_BATCH_CONFIG = {
  batchSize: 12,
  maxDimensionPx: 256,
  minStagePx: 18,
  hoverFrameDelayMs: 150,
} as const;

const SHADER_THUMBNAIL_EXTENSION_SET = new Set(['glsl', 'hlsl', 'wgsl']);

export function normalizeExplorerThumbnailSettings(
  value: unknown,
): ExplorerThumbnailSettings {
  const source = value && typeof value === 'object'
    ? value as Partial<ExplorerThumbnailSettings>
    : {};
  return {
    enabled: source.enabled !== false,
    includeImages: source.includeImages !== false,
    includeCode: source.includeCode !== false,
    includeShaders: source.includeShaders !== false,
    includeAudio: source.includeAudio !== false,
    includeVideo: source.includeVideo !== false,
    enableVideoHoverScrub: source.enableVideoHoverScrub !== false,
    videoHoverScrubFrameCount: clampVideoHoverScrubFrameCount(
      source.videoHoverScrubFrameCount,
    ),
  };
}

export function isShaderThumbnailExtension(extension: string): boolean {
  return SHADER_THUMBNAIL_EXTENSION_SET.has(
    extension.trim().toLowerCase().replace(/^\./, ''),
  );
}

export function canRenderExplorerThumbnail(
  extension: string,
  size: number,
  settings: ExplorerThumbnailSettings,
): boolean {
  if (!settings.enabled) {
    return false;
  }
  if (settings.includeImages && isImagePreviewExtension(extension)) {
    return true;
  }
  if (settings.includeAudio && isAudioPreviewExtension(extension)) {
    return true;
  }
  if (settings.includeVideo && isVideoPreviewExtension(extension)) {
    return true;
  }
  if (settings.includeShaders && isShaderThumbnailExtension(extension)) {
    return true;
  }
  if (settings.includeCode && isEditableTextExtension(extension, size)) {
    return true;
  }
  return false;
}

export function clampVideoHoverScrubFrameCount(value: unknown): number {
  const numericValue = typeof value === 'number' && Number.isFinite(value)
    ? Math.round(value)
    : defaultExplorerThumbnailSettings.videoHoverScrubFrameCount;
  return Math.min(10, Math.max(1, numericValue));
}
