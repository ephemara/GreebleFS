import { describe, expect, it } from 'vitest';
import {
  ensureFontFamilyLoaded,
  getThemeSourceLabel,
  normalizeThemeDefinition,
  overlayThemePresets,
  parseImportedTheme,
  resolveOverlayAppearance,
  serializeTheme,
  upsertCustomTheme,
  type OverlayThemeDefinition,
} from '../config/appearance';

describe('appearance config helpers', () => {
  it('normalizes partial themes against the operator fallback shape', () => {
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
    expect(resolved.fonts.ui).toContain('Space Grotesk');
    expect(resolved.fonts.mono).toContain('JetBrains Mono');
    expect(resolved.cssVars['--overlay-accent']).toBe('#00ffaa');
    expect(resolved.cssVars['--overlay-bg-app']).toBe('#010203');
    expect(resolved.themes).toHaveLength(overlayThemePresets.length + 1);
  });

  it('includes package themes in the resolved catalog and preserves package metadata', () => {
    const packageTheme = normalizeThemeDefinition({
      id: 'vista-glass',
      name: 'Vista Glass',
      source: 'package',
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
    expect(resolved.themes.some(theme => theme.id === 'vista-glass')).toBe(true);
    expect(getThemeSourceLabel(resolved.theme)).toBe('Package');
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
});
