import { describe, expect, it } from 'vitest';
import { resolveOverlayShellEffectsPolicy } from '../config/workbenchPerformance';

describe('workbenchPerformance', () => {
  it('defaults linux shells to the reduced effects tier', () => {
    const policy = resolveOverlayShellEffectsPolicy({
      runtimePlatform: 'linux',
      frameStats: null,
      requestedBlurEnabled: true,
      requestedBlurStrength: 18,
    });

    expect(policy.tier).toBe('reduced');
    expect(policy.blurEnabled).toBe(true);
    expect(policy.blurStrength).toBeLessThanOrEqual(10);
    expect(policy.showBackgroundShader).toBe(false);
    expect(policy.showWallpaperBackdrop).toBe(true);
  });

  it('drops to minimal effects when shell frame pressure is sustained', () => {
    const policy = resolveOverlayShellEffectsPolicy({
      runtimePlatform: 'windows',
      frameStats: {
        avgFrameMs: 17.2,
        avgFps: 58.1,
        p95FrameMs: 18.4,
        worstFrameMs: 22.5,
        frameCount: 96,
        overBudgetCount: 62,
        withinTarget: false,
        windowDurationMs: 1600,
      },
      requestedBlurEnabled: true,
      requestedBlurStrength: 20,
    });

    expect(policy.tier).toBe('minimal');
    expect(policy.blurEnabled).toBe(false);
    expect(policy.blurStrength).toBe(0);
    expect(policy.showWallpaperBackdrop).toBe(false);
    expect(policy.showAnimationOverlay).toBe(false);
  });
});
