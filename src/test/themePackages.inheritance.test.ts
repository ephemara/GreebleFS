import { describe, expect, it, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';

import { loadThemePackagesFromDirectoryEntries } from '../config/themePackages';

describe('theme package inheritance regressions', () => {
  it('loads TOML package chains and preserves child compatibility while inheriting base theme assets', async () => {
    vi.mocked(invoke).mockImplementation(async (command, args) => {
        const params = args as { path?: string } | undefined;
        const normalizedPath = String(params?.path).replace(/\\/g, '/');

        if (command === 'fs_read_text_file' && normalizedPath === 'themes/base/theme.toml') {
          return `
            id = "base-theme"
            name = "Base Theme"

            [theme.palette]
            accent = "#44aaee"

            [compatibility]
            shellBlueprints = ["classic-dock"]
            tags = ["base"]
          `;
        }

        if (command === 'fs_read_text_file' && normalizedPath === 'themes/child/theme.toml') {
          return `
            id = "child-theme"
            name = "Child Theme"
            extends = "base-theme"

            [presentation]
            panelSpacing = 12

            [compatibility]
            shellBlueprints = ["retro-desktop", " retro-desktop ", "typo-shell"]
            tags = [" focused ", "focused"]

            defaultRenderStyleId = "missing-render"

            [[renderStyles]]
            id = "child-render"
            label = "Child Render"
            kind = "desktop-window-manager"
            entryModule = "renderers/child.tsx"
            supportsLiveSwap = true
          `;
        }

        throw new Error(`Unexpected invoke call: ${command} ${JSON.stringify(args)}`);
      });

    const result = await loadThemePackagesFromDirectoryEntries([
      { name: 'base', path: 'themes/base' },
      { name: 'child', path: 'themes/child' },
    ], 'themes');

    expect(result.sourceError).toBeNull();
    expect(result.warnings).toEqual([]);

    const child = result.packages.find(entry => entry.id === 'child-theme');
    expect(child?.theme.extendsThemeId).toBe('base-theme');
    expect(child?.theme.palette.accent).toBe('#44aaee');
    expect(child?.theme.compatibility?.shellBlueprints).toEqual(['retro-desktop']);
    expect(child?.theme.compatibility?.tags).toEqual(['focused']);
    expect(child?.engineManifest?.presentation.panelSpacing).toBe(12);
    expect(child?.engineManifest?.defaultRenderStyleId).toBeNull();
    expect(child?.compiledEngineManifest?.defaultRenderStyle?.id).toBe('child-render');
  });

  it('inherits base compatibility metadata when a child package omits its own compatibility block', async () => {
    vi.mocked(invoke).mockImplementation(async (command, args) => {
      const params = args as { path?: string } | undefined;
      const normalizedPath = String(params?.path).replace(/\\/g, '/');

      if (command === 'fs_read_text_file' && normalizedPath === 'themes/base/theme.json') {
        return JSON.stringify({
          id: 'base-theme',
          name: 'Base Theme',
          compatibility: {
            shellBlueprints: ['classic-dock'],
            tags: ['base', 'glass'],
          },
        });
      }

      if (command === 'fs_read_text_file' && normalizedPath === 'themes/child/theme.json') {
        return JSON.stringify({
          id: 'child-theme',
          name: 'Child Theme',
          extends: 'base-theme',
          presentation: {
            panelSpacing: 16,
          },
        });
      }

      throw new Error(`Unexpected invoke call: ${command} ${JSON.stringify(args)}`);
    });

    const result = await loadThemePackagesFromDirectoryEntries([
      { name: 'base', path: 'themes/base' },
      { name: 'child', path: 'themes/child' },
    ], 'themes');

    expect(result.sourceError).toBeNull();
    expect(result.warnings).toEqual([]);

    const child = result.packages.find(entry => entry.id === 'child-theme');
    expect(child?.theme.compatibility?.shellBlueprints).toEqual(['classic-dock']);
    expect(child?.theme.compatibility?.tags).toEqual(['base', 'glass']);
    expect(child?.engineManifest).toBeUndefined();
  });

  it('propagates inherited compatibility into engine manifests when a child defines engine metadata', async () => {
    vi.mocked(invoke).mockImplementation(async (command, args) => {
      const params = args as { path?: string } | undefined;
      const normalizedPath = String(params?.path).replace(/\\/g, '/');

      if (command === 'fs_read_text_file' && normalizedPath === 'themes/base/theme.json') {
        return JSON.stringify({
          id: 'base-theme',
          name: 'Base Theme',
          compatibility: {
            shellBlueprints: ['retro-desktop'],
            tags: ['base', 'focused'],
          },
        });
      }

      if (command === 'fs_read_text_file' && normalizedPath === 'themes/child/theme.json') {
        return JSON.stringify({
          id: 'child-theme',
          name: 'Child Theme',
          extends: 'base-theme',
          renderStyles: [
            {
              id: 'child-render',
              label: 'Child Render',
              kind: 'desktop-window-manager',
              entryModule: 'renderers/child.tsx',
              supportsLiveSwap: true,
            },
          ],
        });
      }

      throw new Error(`Unexpected invoke call: ${command} ${JSON.stringify(args)}`);
    });

    const result = await loadThemePackagesFromDirectoryEntries([
      { name: 'base', path: 'themes/base' },
      { name: 'child', path: 'themes/child' },
    ], 'themes');

    expect(result.sourceError).toBeNull();
    expect(result.warnings).toEqual([]);

    const child = result.packages.find(entry => entry.id === 'child-theme');
    expect(child?.theme.compatibility?.shellBlueprints).toEqual(['retro-desktop']);
    expect(child?.theme.compatibility?.tags).toEqual(['base', 'focused']);
    expect(child?.engineManifest?.compatibility.shellBlueprints).toEqual(['retro-desktop']);
    expect(child?.engineManifest?.compatibility.tags).toEqual(['base', 'focused']);
    expect(child?.compiledEngineManifest?.manifest.compatibility.shellBlueprints).toEqual(['retro-desktop']);
    expect(child?.compiledEngineManifest?.manifest.compatibility.tags).toEqual(['base', 'focused']);
  });
});
