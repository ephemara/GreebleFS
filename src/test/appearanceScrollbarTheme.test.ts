import { describe, expect, it } from 'vitest';

import { resolveOverlayAppearance, type OverlayThemeDefinition } from '../config/appearance';

describe('appearance scrollbar theme contract', () => {
  it('emits structured scrollbar theme fields as core scrollbar css variables', () => {
    const theme: Partial<OverlayThemeDefinition> = {
      id: 'scrollbar-lab',
      name: 'Scrollbar Lab',
      extendsThemeId: 'github-dark',
      scrollbar: {
        colorScheme: 'light',
        size: 14,
        fileListSize: '16px',
        thumb: '#556677',
        thumbHover: '#778899',
        track: '#101820',
        corner: '#0b1018',
        radius: 6,
        thumbBorderWidth: 2,
        trackBorder: '#223344',
        trackShadow: 'none',
        thumbShadow: 'none',
      },
    };

    const appearance = resolveOverlayAppearance({
      activeThemeId: 'scrollbar-lab',
      customThemes: [theme as OverlayThemeDefinition],
    });

    expect(appearance.cssVars['--overlay-color-scheme']).toBe('light');
    expect(appearance.cssVars['--overlay-scrollbar-size']).toBe('14px');
    expect(appearance.cssVars['--overlay-scrollbar-file-list-size']).toBe('16px');
    expect(appearance.cssVars['--overlay-scrollbar-thumb']).toBe('#556677');
    expect(appearance.cssVars['--overlay-scrollbar-thumb-hover']).toBe('#778899');
    expect(appearance.cssVars['--overlay-scrollbar-track']).toBe('#101820');
    expect(appearance.cssVars['--overlay-scrollbar-corner']).toBe('#0b1018');
    expect(appearance.cssVars['--overlay-scrollbar-radius']).toBe('6px');
    expect(appearance.cssVars['--overlay-scrollbar-thumb-border-width']).toBe('2px');
    expect(appearance.cssVars['--overlay-scrollbar-track-border']).toBe('#223344');
    expect(appearance.cssVars['--overlay-scrollbar-track-shadow']).toBe('none');
    expect(appearance.cssVars['--overlay-scrollbar-thumb-shadow']).toBe('none');
  });

  it('keeps raw cssVars as the final escape hatch over structured scrollbar values', () => {
    const theme: Partial<OverlayThemeDefinition> = {
      id: 'scrollbar-css-var-lab',
      name: 'Scrollbar CSS Var Lab',
      extendsThemeId: 'github-dark',
      scrollbar: {
        thumb: '#111111',
        track: '#222222',
      },
      cssVars: {
        '--overlay-scrollbar-thumb': '#abcdef',
      },
    };

    const appearance = resolveOverlayAppearance({
      activeThemeId: 'scrollbar-css-var-lab',
      customThemes: [theme as OverlayThemeDefinition],
    });

    expect(appearance.cssVars['--overlay-scrollbar-thumb']).toBe('#abcdef');
    expect(appearance.cssVars['--overlay-scrollbar-track']).toBe('#222222');
  });

  it('infers light color-scheme for the built-in light theme', () => {
    const appearance = resolveOverlayAppearance({ activeThemeId: 'pilot-light' });

    expect(appearance.cssVars['--overlay-color-scheme']).toBe('light');
  });
});
