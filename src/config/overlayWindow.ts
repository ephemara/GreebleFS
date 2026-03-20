export interface OverlayVisualControlDefinition {
  min: number;
  max: number;
  step: number;
  defaultValue: number;
  formatValue: (value: number) => string;
}

function formatPercentValue(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function formatPixelValue(value: number): string {
  return `${Math.round(value)}px`;
}

export const overlayVisualControls = {
  opacity: {
    min: 0.15,
    max: 1,
    step: 0.02,
    defaultValue: 1,
    formatValue: formatPercentValue,
  },
  panelTransparency: {
    min: 0,
    max: 1,
    step: 0.02,
    defaultValue: 0,
    formatValue: formatPercentValue,
  },
  zoom: {
    min: 0.7,
    max: 1.35,
    step: 0.025,
    defaultValue: 1,
    formatValue: formatPercentValue,
  },
  blurStrength: {
    min: 0,
    max: 32,
    step: 1,
    defaultValue: 18,
    formatValue: formatPixelValue,
  },
} satisfies Record<string, OverlayVisualControlDefinition>;

export type OverlayVisualControlKey = keyof typeof overlayVisualControls;

export function clampOverlayVisualControlValue(
  key: OverlayVisualControlKey,
  value: number,
): number {
  const control = overlayVisualControls[key];
  if (!Number.isFinite(value)) {
    return control.defaultValue;
  }

  return Math.min(Math.max(value, control.min), control.max);
}

export function formatOverlayVisualControlValue(
  key: OverlayVisualControlKey,
  value: number,
): string {
  const control = overlayVisualControls[key];
  return control.formatValue(clampOverlayVisualControlValue(key, value));
}
