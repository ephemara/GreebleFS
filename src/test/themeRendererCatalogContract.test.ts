import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const repoRoot = '/home/ephemara/Dev/Apps-2D/GreebleFS';
const themesRoot = path.join(repoRoot, 'themes');

function listThemeRendererEntries(): Array<{
  themeId: string;
  themeJsonPath: string;
  entryModule: string;
  entryPath: string;
}> {
  return readdirSync(themesRoot)
    .map(themeId => {
      const themeJsonPath = path.join(themesRoot, themeId, 'theme.json');
      if (!existsSync(themeJsonPath)) {
        return null;
      }

      const themeJson = JSON.parse(readFileSync(themeJsonPath, 'utf8'));
      const entryModule = themeJson.themeRenderer?.entryModule;
      if (typeof entryModule !== 'string' || entryModule.length === 0) {
        return null;
      }

      return {
        themeId,
        themeJsonPath,
        entryModule,
        entryPath: path.join(themesRoot, themeId, entryModule),
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
}

describe('theme renderer catalog contract', () => {
  const rendererEntries = listThemeRendererEntries();

  it('keeps all declared theme renderer entry modules on disk', () => {
    expect(rendererEntries.length).toBeGreaterThan(0);

    for (const entry of rendererEntries) {
      expect(existsSync(entry.entryPath), `${entry.themeId} is missing ${entry.entryModule}`).toBe(true);
    }
  });

  it('declares explicit surface ownership on every custom theme renderer', () => {
    for (const entry of rendererEntries) {
      const source = readFileSync(entry.entryPath, 'utf8');
      expect(source, `${entry.themeId} should declare surfaceOwnership`).toContain('surfaceOwnership');
    }
  });

  it('avoids legacy renderer host composition patterns', () => {
    const legacyPatternExceptions = new Set([
      'vector-monolith',
    ]);

    for (const entry of rendererEntries) {
      if (legacyPatternExceptions.has(entry.themeId)) {
        continue;
      }

      const source = readFileSync(entry.entryPath, 'utf8');
      expect(source, `${entry.themeId} should not use raw host.panels`).not.toContain('host.panels');
      expect(source, `${entry.themeId} should not use host.renderChromeBar()`).not.toContain('renderChromeBar(');
    }
  });
});
