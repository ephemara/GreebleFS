import { describe, expect, it } from 'vitest';
import { normalizeThemeDefinition, resolveOverlayAppearance } from '../config/appearance';
import { compileThemeEngineManifest, normalizeThemeManifestDraft } from '../runtime/themeEngineBackend';

describe('workbench theme recipe', () => {
  it('resolves xmb-style workbench defaults and preserves custom vars', () => {
    const appearance = resolveOverlayAppearance({
      customThemes: [
        normalizeThemeDefinition({
          id: 'xmb-workbench',
          name: 'XMB Workbench',
          workbench: {
            preset: 'xmb',
            brandLabel: 'Cross Media',
            cssVars: {
              '--overlay-workbench-brand': 'cross-media',
            },
          },
        }),
      ],
      activeThemeId: 'xmb-workbench',
    });

    expect(appearance.workbenchTheme.preset).toBe('xmb');
    expect(appearance.workbenchTheme.topBarStyle).toBe('floating');
    expect(appearance.workbenchTheme.commandPaletteStyle).toBe('glass');
    expect(appearance.workbenchTheme.tabStyle).toBe('capsule');
    expect(appearance.workbenchTheme.brandLabel).toBe('Cross Media');
    expect(appearance.workbenchTheme.cssVars['--overlay-workbench-brand']).toBe('cross-media');
  });

  it('merges workbench recipe vars into resolved appearance css vars', () => {
    const appearance = resolveOverlayAppearance({
      customThemes: [
        normalizeThemeDefinition({
          id: 'channel-home',
          name: 'Channel Home',
          workbench: {
            preset: 'channel-grid',
            metrics: {
              commandPaletteWidth: 804,
            },
          },
        }),
      ],
      activeThemeId: 'channel-home',
    });

    expect(appearance.cssVars['--overlay-workbench-command-palette-width']).toBe('804px');
    expect(appearance.cssVars['--overlay-workbench-chrome-bg']).toBeTruthy();
    expect(appearance.workbenchTheme.settingsStyle).toBe('floating');
  });

  it('derives workbench defaults from generic engine manifests even without an explicit preset', () => {
    const engineManifest = normalizeThemeManifestDraft({
      id: 'spring-home',
      name: 'Spring Home',
      presentation: {
        chromeStyle: 'floating',
        density: 'immersive',
        iconStyle: 'vector',
        motionStyle: 'fluid',
        cornerRadius: 24,
        panelSpacing: 14,
      },
      layoutPrimitives: [
        {
          id: 'home-grid',
          name: 'Home Grid',
          kind: 'grid',
          props: {
            gap: 16,
          },
        },
      ],
      navigationPatterns: [
        {
          id: 'spatial-home',
          name: 'Spatial Home',
          kind: 'spatial',
          axis: 'both',
          props: {},
        },
      ],
      renderStyles: [
        {
          id: 'springboard',
          label: 'Springboard',
          kind: 'ios-springboard',
          entryModule: 'renderers/springboard.tsx',
          supportsLiveSwap: false,
          description: null,
        },
      ],
      defaultLayoutPrimitiveId: 'home-grid',
      defaultNavigationPatternId: 'spatial-home',
      defaultRenderStyleId: 'springboard',
    });

    const appearance = resolveOverlayAppearance({
      customThemes: [
        normalizeThemeDefinition({
          id: 'spring-home',
          name: 'Spring Home',
          engineManifest,
          compiledEngineManifest: compileThemeEngineManifest(engineManifest),
        }),
      ],
      activeThemeId: 'spring-home',
    });

    expect(appearance.workbenchTheme.preset).toBe('channel-grid');
    expect(appearance.workbenchTheme.layoutPrimitiveId).toBe('home-grid');
    expect(appearance.workbenchTheme.navigationPatternId).toBe('spatial-home');
    expect(appearance.workbenchTheme.renderStyleId).toBe('springboard');
    expect(appearance.workbenchTheme.topBarStyle).toBe('minimal');
    expect(appearance.workbenchTheme.tabStyle).toBe('capsule');
    expect(appearance.workbenchTheme.metrics.panelRadius).toBe(24);
    expect(appearance.workbenchTheme.metrics.commandPaletteWidth).toBeGreaterThanOrEqual(800);
  });
});
