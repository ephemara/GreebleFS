import type {
  ExplorerImageAdjustmentState,
  ExplorerImageFilterPresetId,
} from '../runtime/imageEditorBackend';

export type ImageEditorAdjustmentKey = keyof ExplorerImageAdjustmentState;

export interface ImageEditorAdjustmentDefinition {
  key: ImageEditorAdjustmentKey;
  label: string;
  min: number;
  max: number;
  step: number;
  formatValue: (value: number) => string;
}

export const IMAGE_EDITOR_BASE_IMAGE_CUSTOM_DATA = {
  hostRole: 'greeblefs-explorer-base-image',
} as const;

export const imageEditorAdjustmentDefinitions: ImageEditorAdjustmentDefinition[] = [
  {
    key: 'brightness',
    label: 'Brightness',
    min: -100,
    max: 100,
    step: 1,
    formatValue: value => `${Math.round(value)}`,
  },
  {
    key: 'contrast',
    label: 'Contrast',
    min: -100,
    max: 100,
    step: 1,
    formatValue: value => `${Math.round(value)}`,
  },
  {
    key: 'saturation',
    label: 'Saturation',
    min: -100,
    max: 100,
    step: 1,
    formatValue: value => `${Math.round(value)}`,
  },
  {
    key: 'temperature',
    label: 'Temperature',
    min: -100,
    max: 100,
    step: 1,
    formatValue: value => `${Math.round(value)}`,
  },
  {
    key: 'highlights',
    label: 'Highlights',
    min: -100,
    max: 100,
    step: 1,
    formatValue: value => `${Math.round(value)}`,
  },
  {
    key: 'shadows',
    label: 'Shadows',
    min: -100,
    max: 100,
    step: 1,
    formatValue: value => `${Math.round(value)}`,
  },
  {
    key: 'vignette',
    label: 'Vignette',
    min: 0,
    max: 100,
    step: 1,
    formatValue: value => `${Math.round(value)}`,
  },
];

export const IMAGE_EDITOR_ADJUSTMENT_DEFAULTS: ExplorerImageAdjustmentState =
  imageEditorAdjustmentDefinitions.reduce((result, definition) => {
    result[definition.key] = 0;
    return result;
  }, {} as ExplorerImageAdjustmentState);

export function createDefaultImageAdjustmentState(): ExplorerImageAdjustmentState {
  return { ...IMAGE_EDITOR_ADJUSTMENT_DEFAULTS };
}

export function findImageAdjustmentDefinition(
  key: ImageEditorAdjustmentKey,
): ImageEditorAdjustmentDefinition {
  return (
    imageEditorAdjustmentDefinitions.find(definition => definition.key === key)
    ?? imageEditorAdjustmentDefinitions[0]
  );
}

export const imageEditorAdjustmentRailOrder: ImageEditorAdjustmentKey[] =
  imageEditorAdjustmentDefinitions.map(definition => definition.key);

export const IMAGE_EDITOR_PRESET_CYCLE_ORDER: ExplorerImageFilterPresetId[] = [
  'original',
  'mono',
  'noir',
  'fade',
  'chrome',
  'warm',
  'cool',
  'vivid',
];
