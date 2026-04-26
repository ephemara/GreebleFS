import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  getBuiltInIconTheme,
  resolveFileIcon,
  resolveFileIconSrc,
} from '../config/iconTheme';

const appIconsSourcePath = resolve(process.cwd(), 'src/components/AppIcons.tsx');
const appIconsSourceText = readFileSync(appIconsSourcePath, 'utf8');
const appIconBindings = [...appIconsSourceText.matchAll(/createThemedIcon\('([^']+)',\s*LucideIcons\.([A-Za-z0-9]+)\)/g)]
  .map((match) => [match[1], `lucide:${match[2]}`] as const);

describe('built-in icon theme', () => {
  it('exposes every AppIcons slot through canonical uiIcons mappings', () => {
    const builtInIconTheme = getBuiltInIconTheme();

    for (const [slotId, lucideReference] of appIconBindings) {
      expect(builtInIconTheme.uiIcons[slotId]).toBe(lucideReference);
    }
  });

  it('recovers semantic file icons from filename extensions before falling back to generic file icons', () => {
    const builtInIconTheme = getBuiltInIconTheme();

    expect(resolveFileIcon('IMG_3738.png', 'mystery', builtInIconTheme)).toMatchObject({
      iconId: 'image',
      matchKind: 'extension',
    });
    expect(resolveFileIcon('genericacoustic.wav', 'unknown', builtInIconTheme)).toMatchObject({
      iconId: 'audio',
      matchKind: 'extension',
    });
    expect(resolveFileIcon('GreebleFS-fresh-install.sh', 'txt', builtInIconTheme)).toMatchObject({
      iconId: 'shell',
      matchKind: 'extension',
    });
    expect(resolveFileIcon('forms.pdf', 'blob', builtInIconTheme)).toMatchObject({
      iconId: 'pdf',
      matchKind: 'extension',
    });
  });

  it('resolves the recovered semantic icon source for explorer fallbacks', () => {
    const builtInIconTheme = getBuiltInIconTheme();

    expect(resolveFileIconSrc('IMG_3738.png', 'mystery', builtInIconTheme)).toContain('/icons/image.svg');
    expect(resolveFileIconSrc('genericacoustic.wav', 'unknown', builtInIconTheme)).toContain('/icons/audio.svg');
  });
});
