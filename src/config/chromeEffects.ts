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
