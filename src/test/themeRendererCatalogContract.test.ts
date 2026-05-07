import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { loadThemeRendererFromSource } from '../components/themeRendererRuntime';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const themeRoots = [
  path.join(repoRoot, 'themes'),
  path.join(repoRoot, 'usr', 'themes'),
].filter(existsSync);

function listThemeRendererEntries(): Array<{
  themeId: string;
  themeJsonPath: string;
  entryModule: string;
  entryPath: string;
}> {
  return themeRoots
    .flatMap(themeRoot => readdirSync(themeRoot).map(themeId => ({ themeId, themeRoot })))
    .map(({ themeId, themeRoot }) => {
      const themeJsonPath = path.join(themeRoot, themeId, 'theme.json');
      if (!existsSync(themeJsonPath)) {
        return null;
      }

      const themeJson = JSON.parse(readFileSync(themeJsonPath, 'utf8'));
      const modernRendererId = typeof themeJson.rendererId === 'string'
        ? themeJson.rendererId
        : null;
      if (modernRendererId) {
        const rendererManifestPath = path.join(
          themeRoot,
          themeId,
          'shell-renderers',
          modernRendererId,
          'shell-renderer.json',
        );
        if (!existsSync(rendererManifestPath)) {
          return null;
        }

        const rendererManifest = JSON.parse(readFileSync(rendererManifestPath, 'utf8'));
        const entryModule = rendererManifest.entryModule;
        if (typeof entryModule !== 'string' || entryModule.length === 0) {
          return null;
        }

        return {
          themeId: typeof themeJson.id === 'string' ? themeJson.id : themeId,
          themeJsonPath,
          entryModule,
          entryPath: path.join(themeRoot, themeId, 'shell-renderers', modernRendererId, entryModule),
        };
      }

      const legacyEntryModule = themeJson.themeRenderer?.entryModule;
      if (typeof legacyEntryModule !== 'string' || legacyEntryModule.length === 0) {
        return null;
      }

      return {
        themeId: typeof themeJson.id === 'string' ? themeJson.id : themeId,
        themeJsonPath,
        entryModule: legacyEntryModule,
        entryPath: path.join(themeRoot, themeId, legacyEntryModule),
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
}

describe('theme renderer catalog contract', () => {
  const rendererEntries = listThemeRendererEntries();

  async function filesystemRelativeModuleSourceResolver({
    fromModulePath,
    specifier,
  }: {
    fromModulePath: string;
    specifier: string;
  }) {
    const fromDirectory = path.dirname(fromModulePath);
    const resolvedBasePath = path.resolve(fromDirectory, specifier);
    const candidatePaths = /\.[^./]+$/.test(resolvedBasePath)
      ? [resolvedBasePath]
      : [`${resolvedBasePath}.tsx`, `${resolvedBasePath}.ts`, `${resolvedBasePath}.jsx`, `${resolvedBasePath}.js`];

    for (const candidatePath of candidatePaths) {
      if (existsSync(candidatePath)) {
        return {
          modulePath: candidatePath,
          source: readFileSync(candidatePath, 'utf8'),
        };
      }
    }

    return null;
  }

  it('keeps all declared theme renderer entry modules on disk', () => {
    expect(Array.isArray(rendererEntries)).toBe(true);

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

  it('loads every declared theme renderer entry module through the runtime loader', async () => {
    for (const entry of rendererEntries) {
      const source = readFileSync(entry.entryPath, 'utf8');
      const renderer = await loadThemeRendererFromSource(source, {
        name: path.basename(entry.entryPath),
        path: entry.entryPath,
        is_dir: false,
        extension: path.extname(entry.entryPath).replace(/^\./, ''),
        modified: 1,
      }, {
        context: {
          id: `${entry.themeId}-renderer`,
          name: entry.themeId,
          filePath: entry.entryPath,
          rendererRoot: path.dirname(path.dirname(entry.entryPath)),
          entryModule: entry.entryModule,
        },
        resolveRelativeModuleSource: filesystemRelativeModuleSourceResolver,
      });

      expect(renderer.error, `${entry.themeId} should load without renderer errors`).toBeNull();
      expect(typeof renderer.component, `${entry.themeId} should export a live renderer component`).toBe('function');
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
