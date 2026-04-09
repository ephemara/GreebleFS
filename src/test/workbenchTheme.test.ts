import { describe, expect, it } from 'vitest';
import { normalizeThemeDefinition, resolveOverlayAppearance } from '../config/appearance';

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
});
