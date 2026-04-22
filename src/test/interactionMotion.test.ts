import { describe, expect, it } from 'vitest';

import {
  interactionMotionPresetOptions,
  resolveInteractionMotionProfileId,
  resolveInteractionMotionSurfaceStyle,
  type InteractionMotionAppearanceSettings,
  type OverlayInteractionMotionThemeRecipe,
} from '../config/interactionMotion';

const baseSettings: InteractionMotionAppearanceSettings = {
  interactionMotionEnabled: true,
  interactionMotionPresetId: null,
  interactionMotionIntensity: 1,
  interactionMotionModuleOverrides: {},
  interactionMotionSurfaceOverrides: {},
};

describe('interaction motion resolver', () => {
  it('uses user override first, then theme default, then built-in subtle fallback', () => {
    expect(resolveInteractionMotionProfileId({})).toBe('subtle');
    expect(resolveInteractionMotionProfileId({
      themeDefaultPresetId: 'spring',
    })).toBe('spring');
    expect(resolveInteractionMotionProfileId({
      userOverrideId: 'playful',
      themeDefaultPresetId: 'spring',
    })).toBe('playful');
  });

  it('disables motion when the global toggle is off or reduced motion is active', () => {
    const globallyDisabled = resolveInteractionMotionSurfaceStyle({
      surfaceId: 'explorerEntry',
      triggerState: { hover: true },
      settings: {
        ...baseSettings,
        interactionMotionEnabled: false,
      },
    });
    const reducedMotion = resolveInteractionMotionSurfaceStyle({
      surfaceId: 'explorerEntry',
      triggerState: { hover: true },
      settings: baseSettings,
      reducedMotion: true,
    });

    expect(globallyDisabled.enabled).toBe(false);
    expect(globallyDisabled.transform).toBeUndefined();
    expect(reducedMotion.enabled).toBe(false);
    expect(reducedMotion.transform).toBeUndefined();
  });

  it('lets per-surface overrides disable a surface without affecting the active preset', () => {
    const themeDefaults: OverlayInteractionMotionThemeRecipe = {
      defaultPresetId: 'spring',
      intensityMultiplier: 1,
      surfaceOverrides: {},
    };
    const resolved = resolveInteractionMotionSurfaceStyle({
      surfaceId: 'explorerEntry',
      triggerState: { hover: true },
      settings: {
        ...baseSettings,
        interactionMotionSurfaceOverrides: {
          explorerEntry: false,
        },
      },
      themeDefaults,
    });

    expect(resolved.presetId).toBe('spring');
    expect(resolved.enabled).toBe(false);
    expect(resolved.transform).toBeUndefined();
  });

  it('scales motion intensity across settings, theme defaults, and surface overrides', () => {
    const resolved = resolveInteractionMotionSurfaceStyle({
      surfaceId: 'explorerEntry',
      triggerState: { hover: true },
      settings: {
        ...baseSettings,
        interactionMotionIntensity: 2,
        interactionMotionSurfaceOverrides: {
          explorerEntry: {
            intensityMultiplier: 0.5,
          },
        },
      },
      themeDefaults: {
        defaultPresetId: 'subtle',
        intensityMultiplier: 1.5,
      },
    });

    expect(resolved.enabled).toBe(true);
    expect(resolved.intensity).toBe(1.5);
    expect(resolved.transform).toContain('translate3d(0.000px, -2.250px, 0)');
    expect(resolved.transform).toContain('scale(1.0120)');
  });

  it('exposes the KCloner-inspired preset suite, splits chrome/files lanes, and animates explorer icons independently', () => {
    expect(interactionMotionPresetOptions.map(option => option.id)).toEqual(expect.arrayContaining([
      'bounce',
      'lissajous',
      'shake',
      'float',
      'pulse',
      'elastic',
      'wobble',
      'sway',
      'heartbeat',
      'orbit',
    ]));

    const resolvedFileIcon = resolveInteractionMotionSurfaceStyle({
      surfaceId: 'explorerEntryIcon',
      triggerState: { hover: true },
      motionStepIndex: 3,
      settings: {
        ...baseSettings,
        interactionMotionModuleOverrides: {
          fileItems: {
            presetId: 'bounce',
            modifierValuesByPresetId: {
              bounce: {
                height: 1.8,
                squash: 1.4,
                pace: 1,
                step: 0.12,
              },
            },
          },
          shellChrome: {
            presetId: 'subtle',
          },
        },
      },
    });
    const resolvedChrome = resolveInteractionMotionSurfaceStyle({
      surfaceId: 'topBarButton',
      triggerState: { hover: true },
      settings: {
        ...baseSettings,
        interactionMotionModuleOverrides: {
          fileItems: {
            presetId: 'bounce',
          },
          shellChrome: {
            presetId: 'subtle',
          },
        },
      },
    });

    expect(resolvedFileIcon.enabled).toBe(true);
    expect(resolvedFileIcon.presetId).toBe('bounce');
    expect(resolvedFileIcon.animation).toContain('interaction-motion-bounce');
    expect(resolvedFileIcon.animation).toContain('-360ms');
    expect(resolvedFileIcon.customProperties['--interaction-motion-translate-y']).toBe('-18.000px');
    expect(resolvedFileIcon.dataAttributes['data-interaction-motion-surface']).toBe('explorerEntryIcon');
    expect(resolvedFileIcon.dataAttributes['data-interaction-motion-module']).toBe('fileItems');
    expect(resolvedFileIcon.dataAttributes['data-interaction-motion-step-index']).toBe('3');

    expect(resolvedChrome.enabled).toBe(true);
    expect(resolvedChrome.presetId).toBe('subtle');
    expect(resolvedChrome.animation).toBeUndefined();
    expect(resolvedChrome.dataAttributes['data-interaction-motion-module']).toBe('shellChrome');
  });
});
