import { describe, expect, it } from 'vitest';

import { normalizeThemeDefinition, resolveOverlayAppearance } from '../config/appearance';
import { BUILT_IN_LAYOUT_MANIFEST, resolveLayoutProfile } from '../config/layoutProfiles';
import {
  groupPanelsForWorkbenchNavigation,
  resolveWorkbenchRenderRuntime,
} from '../config/workbenchRenderRuntime';
import { compileThemeEngineManifest, normalizeThemeManifestDraft } from '../runtime/themeEngineBackend';

describe('workbench render runtime', () => {
  it('selects the launcher-grid runtime for springboard-style render manifests', () => {
    const engineManifest = normalizeThemeManifestDraft({
      id: 'spring-grid',
      name: 'Spring Grid',
      presentation: {
        chromeStyle: 'minimal',
        density: 'immersive',
        iconStyle: 'vector',
        motionStyle: 'fluid',
        cornerRadius: 24,
        panelSpacing: 14,
      },
      layoutPrimitives: [
        { id: 'home-grid', name: 'Home Grid', kind: 'grid', props: { gap: 16 } },
      ],
      navigationPatterns: [
        { id: 'home-nav', name: 'Home Nav', kind: 'spatial', axis: 'both', props: {} },
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
      defaultNavigationPatternId: 'home-nav',
      defaultRenderStyleId: 'springboard',
    });

    const appearance = resolveOverlayAppearance({
      customThemes: [
        normalizeThemeDefinition({
          id: 'spring-grid',
          name: 'Spring Grid',
          engineManifest,
          compiledEngineManifest: compileThemeEngineManifest(engineManifest),
        }),
      ],
      activeThemeId: 'spring-grid',
    });
    const layoutProfile = resolveLayoutProfile(BUILT_IN_LAYOUT_MANIFEST, 'overlay-classic');
    const runtime = resolveWorkbenchRenderRuntime(appearance, layoutProfile);

    expect(runtime.kind).toBe('channel-launcher');
    expect(runtime.navigationSurface).toBe('launcher-grid');
    expect(runtime.contentLayout).toBe('spotlight');
    expect(runtime.navigationRailWidth).toBe(296);
    expect(runtime.showTabStrip).toBe(false);
  });

  it('falls back to the desktop runtime from the shell blueprint when the render style is generic', () => {
    const appearance = resolveOverlayAppearance({
      activeThemeId: 'operator',
    });
    const layoutProfile = {
      ...resolveLayoutProfile(BUILT_IN_LAYOUT_MANIFEST, 'overlay-classic'),
      shellBlueprint: 'retro-desktop' as const,
    };
    const runtime = resolveWorkbenchRenderRuntime(appearance, layoutProfile);

    expect(runtime.kind).toBe('desktop-stack');
    expect(runtime.navigationSurface).toBe('launcher-list');
    expect(runtime.contentLayout).toBe('desktop-card');
    expect(runtime.navigationRailWidth).toBe(244);
    expect(runtime.showExplorerShortcut).toBe(false);
  });

  it('groups panels by navigation metadata and preserves group and item order', () => {
    const groups = groupPanelsForWorkbenchNavigation([
      {
        id: 'plugins',
        label: 'Plugins',
        description: 'Extensions',
        navigation: { groupId: 'extensions', groupLabel: 'Extensions', groupOrder: 40, itemOrder: 20 },
      },
      {
        id: 'explorer',
        label: 'Explorer',
        description: 'Browse files',
        navigation: { groupId: 'browse', groupLabel: 'Browse', groupOrder: 10, itemOrder: 10 },
      },
      {
        id: 'terminal',
        label: 'Terminal',
        description: 'Run commands',
        navigation: { groupId: 'work', groupLabel: 'Work', groupOrder: 20, itemOrder: 10 },
      },
      {
        id: 'git',
        label: 'Source',
        description: 'Track changes',
        navigation: { groupId: 'work', groupLabel: 'Work', groupOrder: 20, itemOrder: 20 },
      },
    ]);

    expect(groups.map(group => group.id)).toEqual(['browse', 'work', 'extensions']);
    expect(groups[1]?.panels.map(panel => panel.id)).toEqual(['terminal', 'git']);
  });
});
