import { describe, expect, it } from 'vitest';
import { resolveOverlayAppearance } from '../config/appearance';
import { resolvePreferredShaderId } from '../config/shaders';

describe('shader system precedence', () => {
  it('resolves the theme default shader when performance mode allows it', () => {
    const appearance = resolveOverlayAppearance({ activeThemeId: 'operator' });

    expect(appearance.baseTheme.defaultShaderId).toBe('nebula-flow');
    expect(resolvePreferredShaderId({
      availableShaderIds: ['none', 'nebula-flow', 'prism-wave'],
      themeDefaultShaderId: appearance.baseTheme.defaultShaderId,
      userOverrideId: null,
      performanceMode: 'balanced',
    })).toBe('nebula-flow');
  });

  it('falls back to none in performance mode when there is no explicit override', () => {
    expect(resolvePreferredShaderId({
      availableShaderIds: ['none', 'nebula-flow', 'prism-wave'],
      themeDefaultShaderId: 'nebula-flow',
      userOverrideId: null,
      performanceMode: 'performance',
    })).toBe('none');
  });

  it('prefers the global override over the theme default', () => {
    expect(resolvePreferredShaderId({
      availableShaderIds: ['none', 'nebula-flow', 'prism-wave'],
      themeDefaultShaderId: 'nebula-flow',
      userOverrideId: 'prism-wave',
    })).toBe('prism-wave');
  });

  it('falls back to none when both the override and theme default are missing', () => {
    expect(resolvePreferredShaderId({
      availableShaderIds: ['none', 'hologram-grid'],
      themeDefaultShaderId: 'missing-theme-shader',
      userOverrideId: 'missing-user-shader',
    })).toBe('none');
  });
});
