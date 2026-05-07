import {
  converter,
  formatHex,
  formatHex8,
  parse as parseCssColor,
} from "culori";

export interface ParsedOverlayColor {
  red: number;
  green: number;
  blue: number;
  alpha: number;
}

const convertColorToRgb = converter("rgb");

function clampByte(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(255, Math.round(value)));
}

function clampUnitInterval(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(1, value));
}

function resolveParsedOverlayColor(color: string) {
  const parsedColor = parseCssColor(color);
  if (!parsedColor) {
    return null;
  }

  return convertColorToRgb(parsedColor);
}

export function parseOverlayColor(color: string): ParsedOverlayColor | null {
  const parsedColor = resolveParsedOverlayColor(color);
  if (!parsedColor) {
    return null;
  }

  if (
    typeof parsedColor.r !== "number"
    || typeof parsedColor.g !== "number"
    || typeof parsedColor.b !== "number"
  ) {
    return null;
  }

  return {
    red: clampByte(parsedColor.r * 255),
    green: clampByte(parsedColor.g * 255),
    blue: clampByte(parsedColor.b * 255),
    alpha: clampUnitInterval(parsedColor.alpha ?? 1),
  };
}

export function withOverlayColorAlpha(color: string, alpha: number): string {
  const parsedColor = parseOverlayColor(color);
  if (!parsedColor) {
    return color;
  }

  return `rgba(${parsedColor.red}, ${parsedColor.green}, ${parsedColor.blue}, ${clampUnitInterval(alpha).toFixed(3)})`;
}

export function getOverlayColorAlpha(color: string, fallback = 1): number {
  return parseOverlayColor(color)?.alpha ?? fallback;
}

function formatOverlayColorHexChannel(value: number): string {
  return clampByte(value).toString(16).padStart(2, "0");
}

export function normalizeOverlayColorInputValue(
  color: string | undefined,
  fallback = "#000000",
): string {
  const parsedColor = typeof color === "string" ? parseOverlayColor(color) : null;
  if (!parsedColor) {
    return fallback;
  }

  return `#${formatOverlayColorHexChannel(parsedColor.red)}${formatOverlayColorHexChannel(parsedColor.green)}${formatOverlayColorHexChannel(parsedColor.blue)}`;
}

export function mergeOverlayColorInputValue(
  nextColorInputValue: string,
  previousColor: string | undefined,
): string {
  const parsedColor = parseOverlayColor(nextColorInputValue);
  if (!parsedColor) {
    return nextColorInputValue;
  }

  const previousAlpha = typeof previousColor === "string"
    ? getOverlayColorAlpha(previousColor, 1)
    : 1;

  if (previousAlpha < 0.999) {
    return `rgba(${parsedColor.red}, ${parsedColor.green}, ${parsedColor.blue}, ${previousAlpha.toFixed(3)})`;
  }

  return nextColorInputValue;
}

export function normalizeMonacoLiteralColor(color: string | undefined): string | undefined {
  if (typeof color !== "string") {
    return color;
  }

  const trimmedColor = color.trim();
  if (!trimmedColor) {
    return trimmedColor;
  }

  const parsedColor = resolveParsedOverlayColor(trimmedColor);
  if (!parsedColor) {
    return trimmedColor;
  }

  const hasVisibleAlpha = (parsedColor.alpha ?? 1) < 0.999;
  return hasVisibleAlpha ? formatHex8(parsedColor) : formatHex(parsedColor);
}
