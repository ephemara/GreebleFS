export interface RgbaColor {
  r: number;
  g: number;
  b: number;
  a: number;
}

export function clampColorChannel(value: number): number {
  return Math.min(255, Math.max(0, Math.round(value)));
}

export function clampUnitInterval(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export function clampRgbaColor(color: RgbaColor): RgbaColor {
  return {
    r: clampColorChannel(color.r),
    g: clampColorChannel(color.g),
    b: clampColorChannel(color.b),
    a: clampUnitInterval(color.a),
  };
}

export function rgbaToCssString(color: RgbaColor): string {
  const normalized = clampRgbaColor(color);
  return `rgba(${normalized.r}, ${normalized.g}, ${normalized.b}, ${normalized.a})`;
}

export function rgbaToHexString(color: RgbaColor): string {
  const normalized = clampRgbaColor(color);
  return `#${normalized.r.toString(16).padStart(2, '0')}${normalized.g.toString(16).padStart(2, '0')}${normalized.b.toString(16).padStart(2, '0')}`;
}

export function hexToRgbaColor(hex: string, alpha = 1): RgbaColor {
  const normalizedHex = hex.trim().replace(/^#/, '');
  const fullHex = normalizedHex.length === 3
    ? normalizedHex.split('').map((character) => `${character}${character}`).join('')
    : normalizedHex;
  if (!/^[0-9a-fA-F]{6}$/.test(fullHex)) {
    return {
      r: 255,
      g: 255,
      b: 255,
      a: clampUnitInterval(alpha),
    };
  }
  return {
    r: Number.parseInt(fullHex.slice(0, 2), 16),
    g: Number.parseInt(fullHex.slice(2, 4), 16),
    b: Number.parseInt(fullHex.slice(4, 6), 16),
    a: clampUnitInterval(alpha),
  };
}

export function formatRgbaColorLabel(color: RgbaColor, includeAlpha = true): string {
  const normalized = clampRgbaColor(color);
  const hex = rgbaToHexString(normalized).toUpperCase();
  if (!includeAlpha) {
    return hex;
  }
  return `${hex} ${Math.round(normalized.a * 100)}%`;
}

export function interpolateRgbaColors(startColor: RgbaColor, endColor: RgbaColor, factor: number): RgbaColor {
  const normalizedFactor = clampUnitInterval(factor);
  const start = clampRgbaColor(startColor);
  const end = clampRgbaColor(endColor);
  return {
    r: start.r + ((end.r - start.r) * normalizedFactor),
    g: start.g + ((end.g - start.g) * normalizedFactor),
    b: start.b + ((end.b - start.b) * normalizedFactor),
    a: start.a + ((end.a - start.a) * normalizedFactor),
  };
}
