export const screenshotFeatureConfig = {
  defaultSaveDirectory: 'M:\\Assets\\Showcase\\TermOverlay',
  supportedExtensions: ['png', 'jpg', 'jpeg', 'webp', 'bmp'] as const,
  filePrefix: 'overlayterm-shot',
} as const;

export type SupportedScreenshotExtension =
  typeof screenshotFeatureConfig.supportedExtensions[number];
