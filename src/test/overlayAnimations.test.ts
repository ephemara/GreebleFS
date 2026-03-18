import { describe, expect, it } from 'vitest';
import {
  OVERLAY_ANIMATION_DURATION_MAX,
  OVERLAY_ANIMATION_DURATION_MIN,
  OVERLAY_ANIMATION_INTENSITY_MAX,
  OVERLAY_ANIMATION_INTENSITY_MIN,
  clampOverlayAnimationDuration,
  clampOverlayAnimationIntensity,
  getOverlayAnimationPreset,
  getOverlayAnimationStyle,
  getOverlayAnimationTransition,
  getOverlayEffectStyle,
} from '../config/overlayAnimations';

describe('overlayAnimations config', () => {
  it('returns a known preset and falls back safely when id is unknown', () => {
    expect(getOverlayAnimationPreset('burn').id).toBe('burn');
    expect(getOverlayAnimationPreset('not-real' as never).id).toBe('none');
  });

  it('clamps animation duration and intensity into supported ranges', () => {
    expect(clampOverlayAnimationDuration(1)).toBe(OVERLAY_ANIMATION_DURATION_MIN);
    expect(clampOverlayAnimationDuration(5000)).toBe(OVERLAY_ANIMATION_DURATION_MAX);
    expect(clampOverlayAnimationIntensity(0.1)).toBe(OVERLAY_ANIMATION_INTENSITY_MIN);
    expect(clampOverlayAnimationIntensity(99)).toBe(OVERLAY_ANIMATION_INTENSITY_MAX);
  });

  it('returns no transition in stable open/closed phases and applies easing during motion', () => {
    expect(getOverlayAnimationTransition({
      phase: 'open',
      direction: 'enter',
      presetId: 'slide',
      durationMs: 300,
    })).toBe('none');

    expect(getOverlayAnimationTransition({
      phase: 'closed',
      direction: 'exit',
      presetId: 'slide',
      durationMs: 300,
    })).toBe('none');

    const transition = getOverlayAnimationTransition({
      phase: 'opening',
      direction: 'enter',
      presetId: 'slide',
      durationMs: 50,
    });
    expect(transition).toContain(`transform ${OVERLAY_ANIMATION_DURATION_MIN}ms`);
    expect(transition).toContain('cubic-bezier');
  });

  it('computes transform direction from vertical origin and uses open-state shape while open', () => {
    const closedFromTop = getOverlayAnimationStyle({
      phase: 'closed',
      direction: 'enter',
      presetId: 'slide',
      baseOpacity: 0.9,
      intensity: 1,
      durationMs: 280,
      verticalOrigin: 'top',
    });
    expect(String(closedFromTop.transform)).toContain('translate3d(0, -18%');
    expect(closedFromTop.opacity).toBe(0);

    const openState = getOverlayAnimationStyle({
      phase: 'open',
      direction: 'enter',
      presetId: 'slide',
      baseOpacity: 0.66,
      intensity: 1.4,
      durationMs: 320,
      verticalOrigin: 'bottom',
    });
    expect(openState.transform).toBe('translate3d(0, 0%, 0) scale(1) rotate(0deg)');
    expect(openState.opacity).toBe(0.66);
    expect(String(openState.filter)).toContain('blur(0px)');
  });

  it('returns effect styles for theatrical presets and null for no-effect preset', () => {
    expect(getOverlayEffectStyle({
      phase: 'opening',
      direction: 'enter',
      presetId: 'slide',
      durationMs: 200,
      intensity: 1,
      accentColor: '#22aaff',
    })).toBeNull();

    const burnEffect = getOverlayEffectStyle({
      phase: 'closing',
      direction: 'exit',
      presetId: 'burn',
      durationMs: 5000,
      intensity: 3.2,
      accentColor: '#ff6600',
      verticalOrigin: 'bottom',
    });
    expect(burnEffect).not.toBeNull();
    expect(String(burnEffect?.backgroundImage)).toContain('#ff6600');
    expect(String(burnEffect?.transition)).toContain(`${OVERLAY_ANIMATION_DURATION_MAX}ms`);
    expect(Number(burnEffect?.opacity)).toBeGreaterThan(0);
  });

  it('keeps effect overlay inactive when phase/direction indicates no active effect', () => {
    const dissolveInactive = getOverlayEffectStyle({
      phase: 'open',
      direction: 'enter',
      presetId: 'dissolve',
      durationMs: 300,
      intensity: 1.2,
      accentColor: '#00ffaa',
      verticalOrigin: 'top',
    });

    expect(dissolveInactive).not.toBeNull();
    expect(dissolveInactive?.opacity).toBe(0);
    expect(dissolveInactive?.transform).toBe('translate3d(0, 0, 0) scale(1)');
  });
});
