import { getManagedContentDirectory } from './appContentDirectories';

export const screenshotCaptureModes = [
  {
    id: 'region',
    label: 'Area Snip',
    description: 'Draw or refine a precise region before finishing the capture.',
  },
  {
    id: 'monitor',
    label: 'Full Monitor',
    description: 'Capture the entire selected monitor at native resolution.',
  },
] as const;

export const screenshotOutputActions = [
  {
    id: 'copy',
    label: 'Copy',
    description: 'Send the current selection to the system clipboard without saving a file.',
  },
  {
    id: 'save',
    label: 'Save',
    description: 'Write the current selection to the screenshot folder.',
  },
  {
    id: 'save-copy',
    label: 'Save + Copy',
    description: 'Save the capture to disk and place the same image on the clipboard.',
  },
] as const;

export const screenshotFeatureConfig = {
  get defaultSaveDirectory(): string {
    return getManagedContentDirectory('screenshots');
  },
  supportedExtensions: ['png', 'jpg', 'jpeg', 'webp', 'bmp'] as const,
  filePrefix: 'overlayterm-shot',
  defaultCaptureMode: screenshotCaptureModes[0].id,
  defaultOutputAction: screenshotOutputActions[2].id,
  maxGalleryItems: 24,
  galleryThumbnail: {
    maxWidth: 320,
    maxHeight: 200,
  },
  editor: {
    hideWindowDelayMs: 260,
    minSelectionSize: 8,
    defaultInsetRatio: 0.12,
    keyboardNudgeStep: 1,
    keyboardLargeNudgeStep: 10,
    minZoom: 0.6,
    maxZoom: 1.8,
    zoomStep: 0.1,
    initialZoom: 1,
  },
  captureModes: screenshotCaptureModes,
  outputActions: screenshotOutputActions,
};

export type SupportedScreenshotExtension =
  typeof screenshotFeatureConfig.supportedExtensions[number];
export type ScreenshotCaptureModeId =
  typeof screenshotCaptureModes[number]['id'];
export type ScreenshotOutputActionId =
  typeof screenshotOutputActions[number]['id'];

export function isScreenshotCaptureModeId(value: unknown): value is ScreenshotCaptureModeId {
  return typeof value === 'string'
    && screenshotCaptureModes.some(mode => mode.id === value);
}

export function isScreenshotOutputActionId(value: unknown): value is ScreenshotOutputActionId {
  return typeof value === 'string'
    && screenshotOutputActions.some(action => action.id === value);
}
