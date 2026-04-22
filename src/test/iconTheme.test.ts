import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { getBuiltInIconTheme } from '../config/iconTheme';

const appIconsSourcePath = resolve(process.cwd(), 'src/components/AppIcons.tsx');
const appIconsSourceText = readFileSync(appIconsSourcePath, 'utf8');
const appIconBindings = [...appIconsSourceText.matchAll(/createThemedIcon\('([^']+)',\s*LucideIcons\.([A-Za-z0-9]+)\)/g)]
  .map((match) => [match[1], `lucide:${match[2]}`] as const);

describe('built-in icon theme', () => {
  it('exposes every AppIcons slot through canonical uiIcons mappings', () => {
    const builtInIconTheme = getBuiltInIconTheme();

    expect(Object.keys(builtInIconTheme.uiIcons).length).toBeGreaterThanOrEqual(appIconBindings.length);
    for (const [slotId, lucideReference] of appIconBindings) {
      expect(builtInIconTheme.uiIcons[slotId]).toBe(lucideReference);
    }
  });
});
