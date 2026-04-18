export type ImageEditorFilterKey =
  | 'brightness'
  | 'contrast'
  | 'saturate'
  | 'grayscale'
  | 'sepia'
  | 'invert'
  | 'hue-rotate'
  | 'blur';

export interface ImageEditorFilterDefinition {
  key: ImageEditorFilterKey;
  label: string;
  cssFunction: string;
  min: number;
  max: number;
  step: number;
  default: number;
  unit: string;
}

export type ExplorerImageFiltersState = Record<ImageEditorFilterKey, number>;

export const imageEditorFilterDefinitions: ImageEditorFilterDefinition[] = [
  { key: 'brightness', label: 'Brightness', cssFunction: 'brightness', min: 0, max: 200, step: 1, default: 100, unit: '%' },
  { key: 'contrast', label: 'Contrast', cssFunction: 'contrast', min: 0, max: 200, step: 1, default: 100, unit: '%' },
  { key: 'saturate', label: 'Saturation', cssFunction: 'saturate', min: 0, max: 200, step: 1, default: 100, unit: '%' },
  { key: 'hue-rotate', label: 'Hue', cssFunction: 'hue-rotate', min: 0, max: 360, step: 1, default: 0, unit: 'deg' },
  { key: 'grayscale', label: 'Grayscale', cssFunction: 'grayscale', min: 0, max: 100, step: 1, default: 0, unit: '%' },
  { key: 'sepia', label: 'Sepia', cssFunction: 'sepia', min: 0, max: 100, step: 1, default: 0, unit: '%' },
  { key: 'invert', label: 'Invert', cssFunction: 'invert', min: 0, max: 100, step: 1, default: 0, unit: '%' },
  { key: 'blur', label: 'Blur', cssFunction: 'blur', min: 0, max: 20, step: 1, default: 0, unit: 'px' },
];

export function createDefaultImageFiltersState(): ExplorerImageFiltersState {
  return imageEditorFilterDefinitions.reduce((result, definition) => {
    result[definition.key] = definition.default;
    return result;
  }, {} as ExplorerImageFiltersState);
}

export function buildCSSFilterString(state: ExplorerImageFiltersState): string {
  if (!state) return 'none';
  return imageEditorFilterDefinitions
    .map(def => `${def.cssFunction}(${state[def.key]}${def.unit})`)
    .join(' ');
}
