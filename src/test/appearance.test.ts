import { describe, expect, it } from 'vitest';
import {
  ensureFontFamilyLoaded,
  getThemeSourceLabel,
  isThemeCompatibleWithShellBlueprint,
  normalizeThemeDefinition,
  overlayFontCatalog,
  overlayThemePresets,
  parseImportedTheme,
  resolveOverlayAppearance,
  serializeTheme,
  setOverlayPluginFonts,
  upsertCustomTheme,
  type OverlayThemeDefinition,
} from '../config/appearance';

describe('appearance config helpers', () => {
  it('normalizes partial themes against the pilot fallback shape', () => {
    const normalized = normalizeThemeDefinition({
      id: 'custom-lab',
      name: 'Custom Lab',
      palette: {
        accent: '#123456',
      },
      effects: {
        shadow: '0 0 0 #000',
      },
    } as Partial<OverlayThemeDefinition>);

    expect(normalized.id).toBe('custom-lab');
    expect(normalized.name).toBe('Custom Lab');
    expect(normalized.palette.accent).toBe('#123456');
    expect(normalized.effects.shadow).toBe('0 0 0 #000');
    expect(normalized.palette.textPrimary.length).toBeGreaterThan(0);
    expect(normalized.xterm.cursor.length).toBeGreaterThan(0);
  });

  it('exposes pilot dark and light as the leading built-in themes and resolves pilot dark by default', () => {
    expect(overlayThemePresets[0]?.id).toBe('pilot-dark');
    expect(overlayThemePresets[1]?.id).toBe('pilot-light');

    const resolved = resolveOverlayAppearance();
    expect(resolved.theme.id).toBe('pilot-dark');
    expect(resolved.app.baseTheme.id).toBe('pilot-dark');
    expect(resolved.dock.baseTheme.id).toBe('pilot-dark');
  });

  it('upserts custom themes by id without duplicating entries', () => {
    const base = normalizeThemeDefinition({
      id: 'my-theme',
      name: 'My Theme',
      palette: { accent: '#111111' },
    } as Partial<OverlayThemeDefinition>);

    const inserted = upsertCustomTheme([], base);
    expect(inserted).toHaveLength(1);
    expect(inserted[0].palette.accent).toBe('#111111');

    const updated = upsertCustomTheme(inserted, {
      ...base,
      palette: { ...base.palette, accent: '#222222' },
    });
    expect(updated).toHaveLength(1);
    expect(updated[0].palette.accent).toBe('#222222');
  });

  it('parses imported theme payloads from direct and wrapped shapes', () => {
    const wrapped = parseImportedTheme(JSON.stringify({
      theme: { id: 'wrapped', name: 'Wrapped Theme', palette: { accent: '#abcdef' } },
    }));
    expect(wrapped.id).toBe('wrapped');
    expect(wrapped.palette.accent).toBe('#abcdef');

    const direct = parseImportedTheme(JSON.stringify({
      id: 'direct',
      name: 'Direct Theme',
      palette: { accent: '#fedcba' },
    }));
    expect(direct.id).toBe('direct');
    expect(direct.palette.accent).toBe('#fedcba');
  });

  it('serializes themes to readable JSON that can round-trip through parsing', () => {
    const sourceTheme = normalizeThemeDefinition({
      id: 'roundtrip-theme',
      name: 'Roundtrip Theme',
      palette: { accent: '#ff00aa' },
    } as Partial<OverlayThemeDefinition>);

    const serialized = serializeTheme(sourceTheme);
    expect(serialized).toContain('"roundtrip-theme"');
    expect(serialized).toContain('\n');

    const parsed = parseImportedTheme(serialized);
    expect(parsed.id).toBe(sourceTheme.id);
    expect(parsed.palette.accent).toBe('#ff00aa');
  });

  it('resolves active theme, fonts, and css vars with custom theme precedence', () => {
    const customTheme = normalizeThemeDefinition({
      id: 'custom-active',
      name: 'Custom Active',
      palette: {
        accent: '#00ffaa',
        appBackground: '#010203',
      },
    } as Partial<OverlayThemeDefinition>);

    const resolved = resolveOverlayAppearance({
      activeThemeId: 'custom-active',
      customThemes: [customTheme],
      uiFontFamily: '"Space Grotesk", Inter, sans-serif',
      monoFontFamily: '"JetBrains Mono", monospace',
    });

    expect(resolved.theme.id).toBe('custom-active');
    expect(resolved.baseTheme.id).toBe('custom-active');
    expect(resolved.fonts.ui).toContain('Space Grotesk');
    expect(resolved.fonts.mono).toContain('JetBrains Mono');
    expect(resolved.cssVars['--overlay-accent']).toBe('#00ffaa');
    expect(resolved.cssVars['--overlay-bg-app']).toBe('#010203');
    expect(resolved.themes).toHaveLength(overlayThemePresets.length + 1);
    expect(resolved.app.baseTheme.id).toBe('custom-active');
    expect(resolved.dock.baseTheme.id).toBe('custom-active');
  });

  it('applies dock-specific recipes while following the active application theme', () => {
    const hybridTheme = normalizeThemeDefinition({
      id: 'hybrid-dock',
      name: 'Hybrid Dock',
      workbench: {
        preset: 'workbench',
      },
      explorer: {
        toolbarStyle: 'solid',
      },
      dock: {
        workbench: {
          preset: 'xmb',
          brandLabel: 'Dock Cross Media',
        },
        explorer: {
          preset: 'xmb',
          toolbarStyle: 'floating',
        },
      },
    } as Partial<OverlayThemeDefinition>);

    const resolved = resolveOverlayAppearance({
      activeThemeId: 'hybrid-dock',
      customThemes: [hybridTheme],
      dockThemeMode: 'follow-app',
      windowMode: 'overlay',
    });

    expect(resolved.mode).toBe('overlay');
    expect(resolved.app.baseTheme.id).toBe('hybrid-dock');
    expect(resolved.dock.baseTheme.id).toBe('hybrid-dock');
    expect(resolved.app.workbenchTheme.preset).toBe('workbench');
    expect(resolved.dock.workbenchTheme.preset).toBe('xmb');
    expect(resolved.workbenchTheme.brandLabel).toBe('Dock Cross Media');
    expect(resolved.dock.explorerTheme.toolbarStyle).toBe('floating');
    expect(resolved.app.explorerTheme.toolbarStyle).toBe('solid');
  });

  it('uses the dock override theme in overlay mode and falls back to the app theme when the override is missing', () => {
    const appTheme = normalizeThemeDefinition({
      id: 'app-theme',
      name: 'App Theme',
      palette: {
        accent: '#22cc88',
      },
    } as Partial<OverlayThemeDefinition>);
    const dockTheme = normalizeThemeDefinition({
      id: 'dock-theme',
      name: 'Dock Theme',
      palette: {
        accent: '#ff8800',
      },
      fonts: {
        ui: '"Space Grotesk", sans-serif',
      },
    } as Partial<OverlayThemeDefinition>);

    const overrideResolved = resolveOverlayAppearance({
      activeThemeId: 'app-theme',
      activeDockThemeId: 'dock-theme',
      dockThemeMode: 'override',
      customThemes: [appTheme, dockTheme],
      windowMode: 'overlay',
    });
    const fallbackResolved = resolveOverlayAppearance({
      activeThemeId: 'app-theme',
      activeDockThemeId: 'missing-dock-theme',
      dockThemeMode: 'override',
      customThemes: [appTheme, dockTheme],
      windowMode: 'overlay',
    });

    expect(overrideResolved.theme.id).toBe('dock-theme');
    expect(overrideResolved.app.baseTheme.id).toBe('app-theme');
    expect(overrideResolved.dock.baseTheme.id).toBe('dock-theme');
    expect(overrideResolved.cssVars['--overlay-accent']).toBe('#ff8800');
    expect(overrideResolved.fonts.ui).toContain('Space Grotesk');

    expect(fallbackResolved.theme.id).toBe('app-theme');
    expect(fallbackResolved.dock.baseTheme.id).toBe('app-theme');
  });

  it('applies panel transparency to the resolved runtime theme without mutating the base theme', () => {
    const customTheme = normalizeThemeDefinition({
      id: 'glass-lab',
      name: 'Glass Lab',
      palette: {
        appBackground: '#112233',
        panelBackground: '#334455',
        border: 'rgba(255,255,255,0.2)',
      },
    } as Partial<OverlayThemeDefinition>);

    const resolved = resolveOverlayAppearance({
      activeThemeId: 'glass-lab',
      customThemes: [customTheme],
      panelTransparency: 0.5,
    });

    expect(resolved.panelTransparency).toBe(0.5);
    expect(resolved.baseTheme.palette.panelBackground).toBe('#334455');
    expect(resolved.theme.palette.panelBackground).toBe('rgba(51, 68, 85, 0.5)');
    expect(resolved.theme.palette.appBackground).toBe('#112233');
    expect(resolved.cssVars['--overlay-bg-panel']).toBe('rgba(51, 68, 85, 0.5)');
    expect(resolved.cssVars['--overlay-bg-app']).toBe('#112233');
    expect(resolved.cssVars['--overlay-panel-opacity']).toBe('0.5');
  });

  it('includes package themes in the resolved catalog and preserves package metadata', () => {
    const packageTheme = normalizeThemeDefinition({
      id: 'vista-glass',
      name: 'Vista Glass',
      source: 'package',
      defaultOpenAnimationId: 'dissolve',
      defaultCloseAnimationId: 'burn',
      assets: {
        backgroundUrl: 'asset://localhost/themes/vista-glass/assets/wallpaper.svg',
        iconEntries: {
          folder: 'asset://localhost/themes/vista-glass/icons/folder.svg',
        },
      },
      visuals: [
        {
          id: 'glow',
          backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.3), transparent)',
        },
      ],
      compatibility: {
        shellBlueprints: ['classic-dock', 'xmb-cross-media'],
        tags: ['glass', 'cinematic'],
      },
      palette: {
        accent: '#7dd3ff',
      },
    } as unknown as Partial<OverlayThemeDefinition>);

    const resolved = resolveOverlayAppearance({
      activeThemeId: 'vista-glass',
      packageThemes: [packageTheme],
      customThemes: [],
    });

    expect(resolved.theme.id).toBe('vista-glass');
    expect(resolved.theme.source).toBe('package');
    expect(resolved.theme.assets?.backgroundUrl).toContain('wallpaper.svg');
    expect(resolved.theme.assets?.iconEntries?.folder).toContain('folder.svg');
    expect(resolved.theme.visuals).toHaveLength(1);
    expect(resolved.theme.defaultOpenAnimationId).toBe('dissolve');
    expect(resolved.theme.defaultCloseAnimationId).toBe('burn');
    expect(resolved.theme.compatibility?.shellBlueprints).toEqual(['classic-dock', 'xmb-cross-media']);
    expect(resolved.theme.compatibility?.tags).toEqual(['glass', 'cinematic']);
    expect(resolved.themes.some(theme => theme.id === 'vista-glass')).toBe(true);
    expect(getThemeSourceLabel(resolved.theme)).toBe('Package');
  });

  it('recomputes identical appearance values for repeated equivalent theme selections', () => {
    const customTheme = normalizeThemeDefinition({
      id: 'cache-lab',
      name: 'Cache Lab',
      palette: {
        accent: '#44ffaa',
        panelBackground: '#102030',
      },
    } as Partial<OverlayThemeDefinition>);
    const selection = {
      activeThemeId: 'cache-lab',
      customThemes: [customTheme],
      uiFontFamily: '"Space Grotesk", Inter, sans-serif',
      monoFontFamily: '"JetBrains Mono", monospace',
      panelTransparency: 0.35,
    } satisfies Parameters<typeof resolveOverlayAppearance>[0];

    const first = resolveOverlayAppearance(selection);
    const second = resolveOverlayAppearance(selection);

    expect(second).toStrictEqual(first);
    expect(second).not.toBe(first);
    expect(second.theme).not.toBe(first.theme);
    expect(second.baseTheme).not.toBe(first.baseTheme);
    expect(second.cssVars).not.toBe(first.cssVars);
    expect(second.themes).not.toBe(first.themes);
  });

  it('invalidates the resolved appearance cache when panel transparency changes', () => {
    const customTheme = normalizeThemeDefinition({
      id: 'cache-bust-lab',
      name: 'Cache Bust Lab',
      palette: {
        panelBackground: '#203040',
      },
    } as Partial<OverlayThemeDefinition>);
    const customThemes = [customTheme];

    const opaque = resolveOverlayAppearance({
      activeThemeId: 'cache-bust-lab',
      customThemes,
      panelTransparency: 0,
    });
    const translucent = resolveOverlayAppearance({
      activeThemeId: 'cache-bust-lab',
      customThemes,
      panelTransparency: 0.45,
    });

    expect(translucent).not.toBe(opaque);
    expect(translucent.theme).not.toBe(opaque.theme);
    expect(translucent.theme.palette.panelBackground).not.toBe(opaque.theme.palette.panelBackground);
    expect(translucent.cssVars['--overlay-panel-transparency']).toBe('0.45');
  });

  it('treats missing compatibility metadata as broadly supported and honors explicit shell targeting', () => {
    const universalTheme = normalizeThemeDefinition({
      id: 'universal',
      name: 'Universal',
    } as Partial<OverlayThemeDefinition>);
    const targetedTheme = normalizeThemeDefinition({
      id: 'targeted',
      name: 'Targeted',
      compatibility: {
        shellBlueprints: ['retro-desktop'],
      },
    } as Partial<OverlayThemeDefinition>);

    expect(isThemeCompatibleWithShellBlueprint(universalTheme, 'xmb-cross-media')).toBe(true);
    expect(isThemeCompatibleWithShellBlueprint(targetedTheme, 'retro-desktop')).toBe(true);
    expect(isThemeCompatibleWithShellBlueprint(targetedTheme, 'classic-dock')).toBe(false);
  });

  it('preserves package theme compatibility targeting after appearance resolution', () => {
    const packageTheme = normalizeThemeDefinition({
      id: 'vista-targeted',
      name: 'Vista Targeted',
      source: 'package',
      compatibility: {
        shellBlueprints: ['classic-dock'],
        tags: ['glass', 'focused'],
      },
    } as Partial<OverlayThemeDefinition>);

    const resolved = resolveOverlayAppearance({
      activeThemeId: 'vista-targeted',
      packageThemes: [packageTheme],
    });

    expect(resolved.theme.source).toBe('package');
    expect(resolved.theme.compatibility?.shellBlueprints).toEqual(['classic-dock']);
    expect(resolved.theme.compatibility?.tags).toEqual(['glass', 'focused']);
    expect(isThemeCompatibleWithShellBlueprint(resolved.theme, 'classic-dock')).toBe(true);
    expect(isThemeCompatibleWithShellBlueprint(resolved.theme, 'retro-desktop')).toBe(false);
    expect(getThemeSourceLabel(resolved.theme)).toBe('Package');
  });

  it('normalizes compatibility metadata by trimming duplicates and inheriting fallback targeting', () => {
    const fallback = normalizeThemeDefinition({
      id: 'fallback-shells',
      name: 'Fallback Shells',
      compatibility: {
        shellBlueprints: ['classic-dock'],
        tags: ['fallback'],
      },
    } as Partial<OverlayThemeDefinition>);

    const normalized = normalizeThemeDefinition({
      id: 'deduped-shells',
      name: 'Deduped Shells',
      compatibility: {
        shellBlueprints: ['classic-dock', ' classic-dock ', 'retro-desktop'],
        tags: [' glass ', 'glass', 'focused'],
      },
    } as Partial<OverlayThemeDefinition>, fallback);
    const inherited = normalizeThemeDefinition({
      id: 'inherited-shells',
      name: 'Inherited Shells',
    } as Partial<OverlayThemeDefinition>, fallback);

    expect(normalized.compatibility?.shellBlueprints).toEqual(['classic-dock', 'retro-desktop']);
    expect(normalized.compatibility?.tags).toEqual(['glass', 'focused']);
    expect(inherited.compatibility?.shellBlueprints).toEqual(['classic-dock']);
    expect(inherited.compatibility?.tags).toEqual(['fallback']);
    expect(isThemeCompatibleWithShellBlueprint(normalized, 'retro-desktop')).toBe(true);
    expect(isThemeCompatibleWithShellBlueprint(inherited, 'classic-dock')).toBe(true);
  });

  it('treats explicit empty compatibility arrays as a universal override instead of inheriting fallback targeting', () => {
    const fallback = normalizeThemeDefinition({
      id: 'fallback-targeted',
      name: 'Fallback Targeted',
      compatibility: {
        shellBlueprints: ['classic-dock'],
        tags: ['fallback'],
      },
    } as Partial<OverlayThemeDefinition>);

    const normalized = normalizeThemeDefinition({
      id: 'universal-override',
      name: 'Universal Override',
      compatibility: {
        shellBlueprints: [],
        tags: [],
      },
    } as Partial<OverlayThemeDefinition>, fallback);

    expect(normalized.compatibility?.shellBlueprints).toEqual([]);
    expect(normalized.compatibility?.tags).toEqual([]);
    expect(isThemeCompatibleWithShellBlueprint(normalized, 'classic-dock')).toBe(true);
    expect(isThemeCompatibleWithShellBlueprint(normalized, 'retro-desktop')).toBe(true);
  });

  it('lets custom themes override package themes with the same id while keeping package metadata in the catalog', () => {
    const packageTheme = normalizeThemeDefinition({
      id: 'shared-theme',
      name: 'Shared Theme Package',
      source: 'package',
      compatibility: {
        shellBlueprints: ['classic-dock'],
        tags: ['package'],
      },
      palette: {
        accent: '#7dd3ff',
      },
    } as Partial<OverlayThemeDefinition>);
    const customTheme = normalizeThemeDefinition({
      id: 'shared-theme',
      name: 'Shared Theme Custom',
      source: 'custom',
      compatibility: {
        shellBlueprints: ['retro-desktop'],
        tags: ['custom'],
      },
      palette: {
        accent: '#ff7a18',
      },
    } as Partial<OverlayThemeDefinition>);

    const resolved = resolveOverlayAppearance({
      activeThemeId: 'shared-theme',
      packageThemes: [packageTheme],
      customThemes: [customTheme],
    });

    expect(resolved.theme.name).toBe('Shared Theme Custom');
    expect(resolved.theme.source).toBe('custom');
    expect(resolved.theme.palette.accent).toBe('#ff7a18');
    expect(isThemeCompatibleWithShellBlueprint(resolved.theme, 'retro-desktop')).toBe(true);
    expect(isThemeCompatibleWithShellBlueprint(resolved.theme, 'classic-dock')).toBe(false);
    expect(resolved.themes.filter(theme => theme.id === 'shared-theme').map(theme => theme.source)).toEqual(['package', 'custom']);
  });

  it('normalizes theme animation defaults and inherits them from the fallback when omitted', () => {
    const normalized = normalizeThemeDefinition({
      id: 'motion-lab',
      name: 'Motion Lab',
      defaultOpenAnimationId: ' lift ',
      defaultCloseAnimationId: ' fizzle ',
    } as Partial<OverlayThemeDefinition>);

    expect(normalized.defaultOpenAnimationId).toBe('lift');
    expect(normalized.defaultCloseAnimationId).toBe('fizzle');

    const inherited = normalizeThemeDefinition({
      id: 'inherit-lab',
      name: 'Inherit Lab',
    } as Partial<OverlayThemeDefinition>, normalized);

    expect(inherited.defaultOpenAnimationId).toBe('lift');
    expect(inherited.defaultCloseAnimationId).toBe('fizzle');
  });

  it('falls back to the first preset when selected theme id is unknown', () => {
    const resolved = resolveOverlayAppearance({
      activeThemeId: 'does-not-exist',
      customThemes: [],
    });

    expect(resolved.theme.id).toBe(overlayThemePresets[0].id);
  });

  it('adds one stylesheet link for a custom font family and skips generic-only families', () => {
    const genericBefore = document.head.querySelectorAll('link[rel="stylesheet"]').length;
    ensureFontFamilyLoaded('sans-serif, serif');
    const genericAfter = document.head.querySelectorAll('link[rel="stylesheet"]').length;
    expect(genericAfter).toBe(genericBefore);

    const uniqueFamilyName = `Overlay Unit Font ${Date.now()}`;
    const customBefore = document.head.querySelectorAll('link[rel="stylesheet"]').length;
    ensureFontFamilyLoaded(`"${uniqueFamilyName}", sans-serif`);
    ensureFontFamilyLoaded(`"${uniqueFamilyName}", sans-serif`);
    const customAfter = document.head.querySelectorAll('link[rel="stylesheet"]').length;

    expect(customAfter).toBe(customBefore + 1);

    const addedLinks = Array.from(document.head.querySelectorAll('link[rel="stylesheet"]'));
    const matchingLinks = addedLinks.filter(link =>
      String(link.getAttribute('href')).includes(encodeURIComponent(uniqueFamilyName)),
    );
    expect(matchingLinks).toHaveLength(1);
  });

  it('registers plugin fonts locally without fetching them from Google Fonts', () => {
    const pluginFamily = `Overlay Plugin Font ${Date.now()}`;
    const stylesheetLinksBefore = document.head.querySelectorAll('link[rel="stylesheet"]').length;

    setOverlayPluginFonts([
      {
        id: 'plugin-font',
        name: 'Plugin Font',
        family: `"${pluginFamily}", sans-serif`,
        faceName: pluginFamily,
        sourceUrl: 'asset://localhost/plugins/mega-plugin/fonts/plugin-font.ttf',
      },
    ]);

    expect(overlayFontCatalog.some(font => font.id === 'plugin-font')).toBe(true);
    expect(document.head.querySelector('#overlayterm-plugin-fonts')?.textContent).toContain(pluginFamily);

    ensureFontFamilyLoaded(`"${pluginFamily}", sans-serif`);

    const stylesheetLinksAfter = document.head.querySelectorAll('link[rel="stylesheet"]').length;
    expect(stylesheetLinksAfter).toBe(stylesheetLinksBefore);

    setOverlayPluginFonts([]);
  });
});
