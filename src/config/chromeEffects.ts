import {
  detectClientPlatform,
  type RuntimePlatform,
} from './platform';

export const BOUNDED_CHROME_CONTAINMENT_STYLE = {
  contain: 'layout paint style',
  isolation: 'isolate',
} as const;

export function resolveConditionalBlurFilter(args: {
  enabled: boolean;
  blurPx: number;
  saturateBoost?: number;
}): string {
  if (!args.enabled || args.blurPx <= 0) {
    return 'none';
  }

  const saturateBoost = args.saturateBoost ?? 0.35;
  const blurRatio = Math.min(Math.max(args.blurPx / 18, 0), 1);
  return `blur(${args.blurPx}px) saturate(${(1.05 + blurRatio * saturateBoost).toFixed(2)})`;
}

export function resolveInnerSurfaceBlurFilter(args: {
  enabled: boolean;
  blurPx: number;
  platform?: RuntimePlatform;
  saturateBoost?: number;
  linuxBlurCapPx?: number;
}): string {
  const platform = args.platform ?? detectClientPlatform();
  const effectiveBlurPx =
    platform === 'linux'
      ? Math.min(args.blurPx, args.linuxBlurCapPx ?? 12)
      : args.blurPx;

  return resolveConditionalBlurFilter({
    enabled: args.enabled,
    blurPx: effectiveBlurPx,
    saturateBoost: args.saturateBoost,
  });
}
