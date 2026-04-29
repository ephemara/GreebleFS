import type { OverlayFrameTelemetryStats } from './frameTelemetry';
import type { RuntimePlatform } from './platform';

export type OverlayShellEffectsTier = 'full' | 'reduced' | 'minimal';

export interface OverlayShellEffectsPolicy {
  tier: OverlayShellEffectsTier;
  blurEnabled: boolean;
  blurStrength: number;
  showWallpaperBackdrop: boolean;
  showThemeEffectBackdrop: boolean;
  showThemeVisuals: boolean;
  showBackgroundShader: boolean;
  showBorderShader: boolean;
  showTopBarShader: boolean;
  showAnimationOverlay: boolean;
}

export const workbenchPerformanceConfig = {
  linuxDefaultTier: 'reduced' as const,
  reducedTierP95ThresholdMs: 12,
  minimalTierP95ThresholdMs: 16.7,
  reducedTierBlurStrengthCapPx: 10,
} as const;

export function resolveOverlayShellEffectsPolicy(args: {
  runtimePlatform: RuntimePlatform;
  frameStats: OverlayFrameTelemetryStats | null;
  requestedBlurEnabled: boolean;
  requestedBlurStrength: number;
}): OverlayShellEffectsPolicy {
  const tier = resolveOverlayShellEffectsTier(args.runtimePlatform, args.frameStats);
  const blurEnabled = args.requestedBlurEnabled && tier !== 'minimal';
  const blurStrength = !blurEnabled
    ? 0
    : tier === 'full'
      ? args.requestedBlurStrength
      : Math.min(
          args.requestedBlurStrength,
          workbenchPerformanceConfig.reducedTierBlurStrengthCapPx,
        );

  return {
    tier,
    blurEnabled,
    blurStrength,
    // Keep the selected/theme wallpaper as the durable base layer even when
    // adaptive effects shed blur, shaders, and decorative theme overlays.
    showWallpaperBackdrop: true,
    showThemeEffectBackdrop: tier === 'full',
    showThemeVisuals: tier === 'full',
    showBackgroundShader: tier === 'full',
    showBorderShader: tier === 'full',
    showTopBarShader: tier === 'full',
    showAnimationOverlay: tier === 'full',
  };
}

function resolveOverlayShellEffectsTier(
  runtimePlatform: RuntimePlatform,
  frameStats: OverlayFrameTelemetryStats | null,
): OverlayShellEffectsTier {
  if (
    frameStats != null
    && frameStats.p95FrameMs >= workbenchPerformanceConfig.minimalTierP95ThresholdMs
  ) {
    return 'minimal';
  }

  if (
    runtimePlatform === 'linux'
    || (
      frameStats != null
      && frameStats.p95FrameMs >= workbenchPerformanceConfig.reducedTierP95ThresholdMs
    )
  ) {
    return workbenchPerformanceConfig.linuxDefaultTier;
  }

  return 'full';
}
