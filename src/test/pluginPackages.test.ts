import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { discoverOverlayPlugins } from '../config/pluginPackages';
import { pluginSystemConfig } from '../config/plugins';
import { createMockOverlayPluginApi } from './helpers/createMockOverlayPluginApi';

function makeAppearance() {
  return {
    theme: {
      id: 'test-theme',
    },
    fonts: {
      ui: 'sans-serif',
      mono: 'monospace',
    },
    cssVars: {},
  } as never;
}

function makePanelHost() {
  return {
    mode: 'panel-tab',
    width: 960,
    height: 640,
    zoom: 1,
    compact: false,
    density: 'regular',
  } as never;
}

function makePreviewHost() {
  return {
    mode: 'preview-pane',
    width: 800,
    height: 500,
    zoom: 1,
    compact: false,
    density: 'regular',
  } as never;
}

describe('plugin package discovery', () => {
  it('keeps loading legacy plugins when one file fails to parse', async () => {
    vi.mocked(invoke).mockImplementation(async (command, args) => {
      const params = args as { path?: string; showHidden?: boolean } | undefined;
      const normalizedPath = String(params?.path ?? '').replace(/\\/g, '/');

      if (command === 'fs_list_dir' && normalizedPath === pluginSystemConfig.pluginsDirectory) {
        return [
          {
            name: 'broken-panel.tsx',
            path: 'plugins/broken-panel.tsx',
            is_dir: false,
            extension: 'tsx',
            modified: 1,
          },
          {
            name: 'hello-panel.tsx',
            path: 'plugins/hello-panel.tsx',
            is_dir: false,
            extension: 'tsx',
            modified: 2,
          },
        ];
      }

      if (command === 'fs_read_text_file' && normalizedPath === 'plugins/broken-panel.tsx') {
        throw new Error('legacy parse failed');
      }

      if (command === 'fs_read_text_file' && normalizedPath === 'plugins/hello-panel.tsx') {
        return `
          import React from 'react';
          import { definePlugin } from 'overlayterm-plugin';

          export default definePlugin({
            name: 'Hello Panel',
            component: function HelloPanel() {
              return React.createElement('div', null, 'hello');
            },
          });
        `;
      }

      throw new Error(`Unexpected invoke call: ${command} ${JSON.stringify(args)}`);
    });

    const result = await discoverOverlayPlugins(() => createMockOverlayPluginApi());

    expect(result.plugins.map(plugin => plugin.name)).toEqual(['Hello Panel']);
    expect(result.warnings).toEqual([
      'broken-panel.tsx: Error: legacy parse failed',
    ]);
  });

  it('keeps disabled plugins in the catalog without loading their runtime contributions', async () => {
    vi.mocked(invoke).mockImplementation(async (command, args) => {
      const params = args as { path?: string; showHidden?: boolean } | undefined;
      const normalizedPath = String(params?.path ?? '').replace(/\\/g, '/');

      if (command === 'fs_list_dir' && normalizedPath === pluginSystemConfig.pluginsDirectory) {
        return [
          {
            name: 'hello-panel.tsx',
            path: 'plugins/hello-panel.tsx',
            is_dir: false,
            extension: 'tsx',
            modified: 10,
          },
          {
            name: 'mega-plugin',
            path: 'plugins/mega-plugin',
            is_dir: true,
            extension: '',
            modified: 20,
          },
        ];
      }

      if (command === 'fs_read_text_file' && normalizedPath === 'plugins/mega-plugin/plugin.json') {
        return JSON.stringify({
          id: 'mega-plugin',
          name: 'Mega Plugin',
          entry: 'dist/index.js',
          category: 'First-party Workbenches',
          contributions: {
            commands: [
              {
                id: 'build-project',
                name: 'Build Project',
                command: 'npm run build',
              },
            ],
            previewLanes: [
              {
                id: 'notes-preview',
                title: 'Notes Preview',
                renderer: 'preview/notes-preview.js',
              },
            ],
          },
        });
      }

      if (
        command === 'fs_read_text_file' &&
        (
          normalizedPath === 'plugins/hello-panel.tsx' ||
          normalizedPath === 'plugins/mega-plugin/dist/index.js' ||
          normalizedPath === 'plugins/mega-plugin/preview/notes-preview.js'
        )
      ) {
        throw new Error(`disabled runtime source should not load: ${normalizedPath}`);
      }

      throw new Error(`Unexpected invoke call: ${command} ${JSON.stringify(args)}`);
    });

    const result = await discoverOverlayPlugins(
      () => createMockOverlayPluginApi(),
      {
        disabledPluginIds: new Set(['hello-panel', 'mega-plugin']),
      },
    );

    expect(result.plugins.map(plugin => ({
      id: plugin.id,
      name: plugin.name,
      enabled: plugin.enabled,
      enablementKey: plugin.enablementKey,
    }))).toEqual([
      {
        id: 'hello-panel',
        name: 'Hello Panel',
        enabled: false,
        enablementKey: 'hello-panel',
      },
      {
        id: 'mega-plugin',
        name: 'Mega Plugin',
        enabled: false,
        enablementKey: 'mega-plugin',
      },
    ]);
    expect(result.commands).toEqual([]);
    expect(result.previewLanes).toEqual([]);
    expect(result.themePackages).toEqual([]);
    expect(result.shaders).toEqual([]);
    expect(result.fonts).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  it('maps VSIX activity bar contributions into explorer activity lanes', async () => {
    vi.mocked(invoke).mockImplementation(async (command, args) => {
      const params = args as { path?: string; request?: { archivePath?: string } } | undefined;
      const normalizedPath = String(params?.path ?? '').replace(/\\/g, '/');
      const archivePath = String(
        params?.request?.archivePath ?? params?.path ?? '',
      ).replace(/\\/g, '/');
      const pluginsRoot = pluginSystemConfig.pluginsDirectory.replace(/\\/g, '/');
      const packagesRoot = pluginSystemConfig.packagesDirectory.replace(/\\/g, '/');

      if (command === 'fs_list_dir' && normalizedPath === pluginsRoot) {
        return [
          {
            name: 'gitlens.vsix',
            path: `${pluginsRoot}/gitlens.vsix`,
            is_dir: false,
            extension: 'vsix',
            modified: 42,
          },
        ];
      }

      if (command === 'fs_list_dir' && normalizedPath === packagesRoot) {
        return [];
      }

      if (command === 'fs_open_archive' && archivePath === `${pluginsRoot}/gitlens.vsix`) {
        return {
          outputPath: '/cache/gitlens',
          extractedEntryCount: 3,
          reusedCachedOutput: false,
        };
      }

      if (command === 'fs_read_text_file' && normalizedPath === '/cache/gitlens/package.json') {
        return JSON.stringify({
          name: 'gitlens',
          publisher: 'eamodio',
          displayName: 'GitLens',
          description: 'Git superpowers',
          version: '1.2.3',
          main: './dist/extension.js',
          activationEvents: ['onView:gitlens.repositories'],
          contributes: {
            viewsContainers: {
              activitybar: [
                {
                  id: 'gitlens',
                  title: 'GitLens',
                  icon: 'images/gitlens.svg',
                },
              ],
            },
            views: {
              gitlens: [
                {
                  id: 'gitlens.repositories',
                  name: 'Repositories',
                },
              ],
            },
            commands: [
              {
                command: 'gitlens.open',
                title: 'Open GitLens',
              },
            ],
          },
        });
      }

      throw new Error(`Unexpected invoke call: ${command} ${JSON.stringify(args)}`);
    });

    const result = await discoverOverlayPlugins(() => createMockOverlayPluginApi());

    expect(result.plugins[0]).toMatchObject({
      id: 'eamodio.gitlens',
      name: 'GitLens',
      diagnostics: {
        sourceKind: 'vscode-vsix',
        capabilities: {
          explorerActivityLanes: 1,
          vscodeExtensions: 1,
        },
      },
    });
    expect(result.explorerActivityLanes).toHaveLength(1);
    expect(result.explorerActivityLanes[0]).toMatchObject({
      id: 'vscode:eamodio.gitlens:gitlens',
      label: 'GitLens',
      sourceKind: 'vscode-vsix',
      vscode: expect.objectContaining({
        extensionId: 'eamodio.gitlens',
        extensionName: 'GitLens',
        extensionRootPath: '/cache/gitlens',
        packageJsonPath: expect.stringMatching(/\/cache\/gitlens[\\/]package\.json$/),
        originalPath: `${pluginSystemConfig.pluginsDirectory}/gitlens.vsix`,
        main: './dist/extension.js',
        activationEvents: ['onView:gitlens.repositories'],
      }),
      views: [
        expect.objectContaining({
          id: 'vscode:eamodio.gitlens:gitlens.view.gitlens.repositories',
          title: 'Repositories',
          rendererKind: 'tree',
          providerPending: true,
          sourceKind: 'vscode-vsix',
          vscode: expect.objectContaining({
            extensionId: 'eamodio.gitlens',
            viewId: 'gitlens.repositories',
          }),
        }),
      ],
    });
    expect(result.commands).toEqual([
      expect.objectContaining({
        id: 'vscode-command:eamodio.gitlens:gitlens.open',
        pluginId: 'eamodio.gitlens',
        pluginName: 'GitLens',
        name: 'Open GitLens',
        command: 'gitlens.open',
        sourceKind: 'vscode-vsix',
        vscodeCommand: expect.objectContaining({
          extensionId: 'eamodio.gitlens',
          extensionName: 'GitLens',
          commandId: 'gitlens.open',
          main: './dist/extension.js',
          activationEvents: ['onView:gitlens.repositories'],
        }),
      }),
    ]);
  });

  it('loads declared module dependencies from usr packages and catalogs library packages', async () => {
    vi.mocked(invoke).mockImplementation(async (command, args) => {
      const params = args as { path?: string; showHidden?: boolean } | undefined;
      const normalizedPath = String(params?.path ?? '').replace(/\\/g, '/');
      const pluginsRoot = pluginSystemConfig.pluginsDirectory.replace(/\\/g, '/');
      const packagesRoot = pluginSystemConfig.packagesDirectory.replace(/\\/g, '/');

      if (command === 'fs_list_dir' && normalizedPath === pluginsRoot) {
        return [
          {
            name: 'dependency-consumer',
            path: `${pluginsRoot}/dependency-consumer`,
            is_dir: true,
            extension: '',
            modified: 20,
          },
        ];
      }

      if (command === 'fs_list_dir' && normalizedPath === packagesRoot) {
        return [
          {
            name: 'greeblefs-ui',
            path: `${packagesRoot}/greeblefs-ui`,
            is_dir: true,
            extension: '',
            modified: 10,
          },
        ];
      }

      if (command === 'fs_read_text_file' && normalizedPath === `${packagesRoot}/greeblefs-ui/extension.toml`) {
        return `
          id = "greeblefs-ui"
          version = "1.0.0"
          name = "GreebleFS UI"
          packageKind = "library"
          category = "First-party Libraries"

          [exports.modules]
          "@greeblefs/ui" = "src/index.tsx"
        `;
      }

      if (command === 'fs_read_text_file' && normalizedPath === `${pluginsRoot}/dependency-consumer/extension.toml`) {
        return `
          id = "dependency-consumer"
          version = "1.0.0"
          name = "Dependency Consumer"
          entry = "index.tsx"

          [[dependencies]]
          id = "greeblefs-ui"
          version = "^1.0.0"
          importAs = "@greeblefs/ui"
          required = true
        `;
      }

      if (command === 'fs_list_dir' && normalizedPath === `${packagesRoot}/greeblefs-ui/src`) {
        return [
          {
            name: 'index.tsx',
            path: `${packagesRoot}/greeblefs-ui/src/index.tsx`,
            is_dir: false,
            extension: 'tsx',
            modified: 11,
          },
        ];
      }

      if (command === 'fs_list_dir' && normalizedPath === `${pluginsRoot}/dependency-consumer`) {
        return [
          {
            name: 'index.tsx',
            path: `${pluginsRoot}/dependency-consumer/index.tsx`,
            is_dir: false,
            extension: 'tsx',
            modified: 21,
          },
        ];
      }

      if (command === 'fs_read_text_file' && normalizedPath === `${packagesRoot}/greeblefs-ui/src/index.tsx`) {
        return `
          import React from 'react';
          export function SharedBadge({ label }) {
            return React.createElement('strong', null, label);
          }
        `;
      }

      if (command === 'fs_read_text_file' && normalizedPath === `${pluginsRoot}/dependency-consumer/index.tsx`) {
        return `
          import React from 'react';
          import { definePlugin } from 'overlayterm-plugin';
          import { SharedBadge } from '@greeblefs/ui';

          export default definePlugin({
            component: function DependencyConsumer() {
              return React.createElement('div', null, React.createElement(SharedBadge, { label: 'dependency-ready' }));
            },
          });
        `;
      }

      if (command === 'fs_list_dir') {
        return [];
      }

      throw new Error(`Unexpected invoke call: ${command} ${JSON.stringify(args)}`);
    });

    const result = await discoverOverlayPlugins(() => createMockOverlayPluginApi());

    expect(result.warnings).toEqual([]);
    expect(result.plugins.map(plugin => plugin.id)).toEqual([
      'dependency-consumer',
      'greeblefs-ui',
    ]);
    expect(result.plugins.find(plugin => plugin.id === 'greeblefs-ui')?.diagnostics).toMatchObject({
      sourceKind: 'library-package',
      packageKind: 'library',
      moduleExports: ['@greeblefs/ui'],
    });
    const consumer = result.plugins.find(plugin => plugin.id === 'dependency-consumer')!;
    expect(consumer.diagnostics.dependencies?.[0]).toMatchObject({
      id: 'greeblefs-ui',
      importAs: '@greeblefs/ui',
      status: 'satisfied',
    });
    expect(renderToStaticMarkup(React.createElement(consumer.component as React.ComponentType))).toContain('dependency-ready');
  });

  it('allows declared source imports from open plugin packages in usr/plugins', async () => {
    vi.mocked(invoke).mockImplementation(async (command, args) => {
      const params = args as { path?: string; showHidden?: boolean } | undefined;
      const normalizedPath = String(params?.path ?? '').replace(/\\/g, '/');
      const pluginsRoot = pluginSystemConfig.pluginsDirectory.replace(/\\/g, '/');
      const packagesRoot = pluginSystemConfig.packagesDirectory.replace(/\\/g, '/');

      if (command === 'fs_list_dir' && normalizedPath === pluginsRoot) {
        return [
          { name: 'open-toolkit', path: `${pluginsRoot}/open-toolkit`, is_dir: true, extension: '', modified: 10 },
          { name: 'toolkit-consumer', path: `${pluginsRoot}/toolkit-consumer`, is_dir: true, extension: '', modified: 20 },
        ];
      }

      if (command === 'fs_list_dir' && normalizedPath === packagesRoot) {
        return [];
      }

      const manifests: Record<string, string> = {
        [`${pluginsRoot}/open-toolkit/extension.toml`]: `
          id = "open-toolkit"
          version = "1.0.0"
          name = "Open Toolkit"

          [source]
          visibility = "open"

          [exports.modules]
          "@open/toolkit" = "src/index.tsx"
        `,
        [`${pluginsRoot}/toolkit-consumer/extension.toml`]: `
          id = "toolkit-consumer"
          version = "1.0.0"
          name = "Toolkit Consumer"
          entry = "index.tsx"

          [[dependencies]]
          id = "open-toolkit"
          version = "^1.0.0"
          importAs = "@open/toolkit"
          required = true
        `,
      };

      if (command === 'fs_read_text_file' && manifests[normalizedPath]) {
        return manifests[normalizedPath];
      }

      if (command === 'fs_list_dir' && normalizedPath === `${pluginsRoot}/open-toolkit/src`) {
        return [
          { name: 'index.tsx', path: `${pluginsRoot}/open-toolkit/src/index.tsx`, is_dir: false, extension: 'tsx', modified: 11 },
        ];
      }

      if (command === 'fs_list_dir' && normalizedPath === `${pluginsRoot}/toolkit-consumer`) {
        return [
          { name: 'index.tsx', path: `${pluginsRoot}/toolkit-consumer/index.tsx`, is_dir: false, extension: 'tsx', modified: 21 },
        ];
      }

      if (command === 'fs_read_text_file' && normalizedPath === `${pluginsRoot}/open-toolkit/src/index.tsx`) {
        return `
          import React from 'react';
          export function OpenToolkitBadge() {
            return React.createElement('b', null, 'open-plugin-import');
          }
        `;
      }

      if (command === 'fs_read_text_file' && normalizedPath === `${pluginsRoot}/toolkit-consumer/index.tsx`) {
        return `
          import React from 'react';
          import { definePlugin } from 'overlayterm-plugin';
          import { OpenToolkitBadge } from '@open/toolkit';

          export default definePlugin({
            component: function ToolkitConsumer() {
              return React.createElement('div', null, React.createElement(OpenToolkitBadge));
            },
          });
        `;
      }

      if (command === 'fs_list_dir') {
        return [];
      }

      throw new Error(`Unexpected invoke call: ${command} ${JSON.stringify(args)}`);
    });

    const result = await discoverOverlayPlugins(() => createMockOverlayPluginApi());
    const consumer = result.plugins.find(plugin => plugin.id === 'toolkit-consumer')!;
    const provider = result.plugins.find(plugin => plugin.id === 'open-toolkit')!;

    expect(result.warnings).toEqual([]);
    expect(provider.diagnostics).toMatchObject({
      sourceKind: 'package-plugin',
      sourceVisibility: 'open',
      moduleExports: ['@open/toolkit'],
    });
    expect(consumer.diagnostics.dependencies?.[0]).toMatchObject({
      id: 'open-toolkit',
      importAs: '@open/toolkit',
      status: 'satisfied',
    });
    expect(renderToStaticMarkup(React.createElement(consumer.component as React.ComponentType))).toContain('open-plugin-import');
  });

  it('blocks source imports from private plugin packages in usr/plugins', async () => {
    vi.mocked(invoke).mockImplementation(async (command, args) => {
      const params = args as { path?: string; showHidden?: boolean } | undefined;
      const normalizedPath = String(params?.path ?? '').replace(/\\/g, '/');
      const pluginsRoot = pluginSystemConfig.pluginsDirectory.replace(/\\/g, '/');
      const packagesRoot = pluginSystemConfig.packagesDirectory.replace(/\\/g, '/');

      if (command === 'fs_list_dir' && normalizedPath === pluginsRoot) {
        return [
          { name: 'private-toolkit', path: `${pluginsRoot}/private-toolkit`, is_dir: true, extension: '', modified: 10 },
          { name: 'private-consumer', path: `${pluginsRoot}/private-consumer`, is_dir: true, extension: '', modified: 20 },
        ];
      }

      if (command === 'fs_list_dir' && normalizedPath === packagesRoot) {
        return [];
      }

      const manifests: Record<string, string> = {
        [`${pluginsRoot}/private-toolkit/extension.toml`]: `
          id = "private-toolkit"
          version = "1.0.0"
          name = "Private Toolkit"

          [exports.modules]
          "@private/toolkit" = "src/index.tsx"
        `,
        [`${pluginsRoot}/private-consumer/extension.toml`]: `
          id = "private-consumer"
          version = "1.0.0"
          name = "Private Consumer"
          entry = "index.tsx"

          [[dependencies]]
          id = "private-toolkit"
          version = "^1.0.0"
          importAs = "@private/toolkit"
          required = true
        `,
      };

      if (command === 'fs_read_text_file' && manifests[normalizedPath]) {
        return manifests[normalizedPath];
      }

      if (command === 'fs_read_text_file' && normalizedPath.endsWith('/index.tsx')) {
        throw new Error(`private dependency source should not load: ${normalizedPath}`);
      }

      if (command === 'fs_list_dir') {
        return [];
      }

      throw new Error(`Unexpected invoke call: ${command} ${JSON.stringify(args)}`);
    });

    const result = await discoverOverlayPlugins(() => createMockOverlayPluginApi());
    const byId = new Map(result.plugins.map(plugin => [plugin.id, plugin]));

    expect(byId.get('private-toolkit')?.diagnostics.sourceVisibility).toBe('private');
    expect(byId.get('private-consumer')?.component).toBeNull();
    expect(byId.get('private-consumer')?.diagnostics.dependencies?.[0]).toMatchObject({
      id: 'private-toolkit',
      importAs: '@private/toolkit',
      status: 'incompatible',
    });
    expect(byId.get('private-consumer')?.diagnostics.blockedReason).toContain('does not expose source modules');
  });

  it('blocks package plugins when required dependencies are missing disabled incompatible or cyclic', async () => {
    vi.mocked(invoke).mockImplementation(async (command, args) => {
      const params = args as { path?: string; showHidden?: boolean } | undefined;
      const normalizedPath = String(params?.path ?? '').replace(/\\/g, '/');
      const pluginsRoot = pluginSystemConfig.pluginsDirectory.replace(/\\/g, '/');
      const packagesRoot = pluginSystemConfig.packagesDirectory.replace(/\\/g, '/');

      if (command === 'fs_list_dir' && normalizedPath === pluginsRoot) {
        return [
          { name: 'missing-consumer', path: `${pluginsRoot}/missing-consumer`, is_dir: true, extension: '', modified: 10 },
          { name: 'disabled-consumer', path: `${pluginsRoot}/disabled-consumer`, is_dir: true, extension: '', modified: 11 },
          { name: 'version-consumer', path: `${pluginsRoot}/version-consumer`, is_dir: true, extension: '', modified: 12 },
          { name: 'cycle-a', path: `${pluginsRoot}/cycle-a`, is_dir: true, extension: '', modified: 13 },
          { name: 'cycle-b', path: `${pluginsRoot}/cycle-b`, is_dir: true, extension: '', modified: 14 },
        ];
      }

      if (command === 'fs_list_dir' && normalizedPath === packagesRoot) {
        return [
          { name: 'disabled-lib', path: `${packagesRoot}/disabled-lib`, is_dir: true, extension: '', modified: 20 },
          { name: 'old-lib', path: `${packagesRoot}/old-lib`, is_dir: true, extension: '', modified: 21 },
        ];
      }

      const manifests: Record<string, string> = {
        [`${pluginsRoot}/missing-consumer/extension.toml`]: `
          id = "missing-consumer"
          name = "Missing Consumer"
          entry = "index.tsx"
          [[dependencies]]
          id = "missing-lib"
          version = "^1.0.0"
          importAs = "@missing/lib"
        `,
        [`${pluginsRoot}/disabled-consumer/extension.toml`]: `
          id = "disabled-consumer"
          name = "Disabled Consumer"
          entry = "index.tsx"
          [[dependencies]]
          id = "disabled-lib"
          version = "^1.0.0"
          importAs = "@disabled/lib"
        `,
        [`${pluginsRoot}/version-consumer/extension.toml`]: `
          id = "version-consumer"
          name = "Version Consumer"
          entry = "index.tsx"
          [[dependencies]]
          id = "old-lib"
          version = "^2.0.0"
          importAs = "@old/lib"
        `,
        [`${pluginsRoot}/cycle-a/extension.toml`]: `
          id = "cycle-a"
          name = "Cycle A"
          entry = "index.tsx"
          [[dependencies]]
          id = "cycle-b"
          version = "*"
        `,
        [`${pluginsRoot}/cycle-b/extension.toml`]: `
          id = "cycle-b"
          name = "Cycle B"
          entry = "index.tsx"
          [[dependencies]]
          id = "cycle-a"
          version = "*"
        `,
        [`${packagesRoot}/disabled-lib/extension.toml`]: `
          id = "disabled-lib"
          version = "1.0.0"
          name = "Disabled Lib"
          packageKind = "library"
          [exports.modules]
          "@disabled/lib" = "src/index.ts"
        `,
        [`${packagesRoot}/old-lib/extension.toml`]: `
          id = "old-lib"
          version = "1.0.0"
          name = "Old Lib"
          packageKind = "library"
          [exports.modules]
          "@old/lib" = "src/index.ts"
        `,
      };

      if (command === 'fs_read_text_file' && manifests[normalizedPath]) {
        return manifests[normalizedPath];
      }

      if (command === 'fs_read_text_file' && normalizedPath.endsWith('/index.tsx')) {
        throw new Error(`blocked package source should not load: ${normalizedPath}`);
      }

      if (command === 'fs_list_dir') {
        return [];
      }

      throw new Error(`Unexpected invoke call: ${command} ${JSON.stringify(args)}`);
    });

    const result = await discoverOverlayPlugins(
      () => createMockOverlayPluginApi(),
      {
        disabledPluginIds: new Set(['disabled-lib']),
      },
    );

    const byId = new Map(result.plugins.map(plugin => [plugin.id, plugin]));
    expect(byId.get('missing-consumer')?.diagnostics.dependencies?.[0]?.status).toBe('missing');
    expect(byId.get('disabled-consumer')?.diagnostics.dependencies?.[0]?.status).toBe('disabled');
    expect(byId.get('version-consumer')?.diagnostics.dependencies?.[0]?.status).toBe('incompatible');
    expect(byId.get('cycle-a')?.diagnostics.blockedReason).toContain('cycle');
    expect(byId.get('cycle-b')?.diagnostics.blockedReason).toContain('cycle');
    expect(byId.get('disabled-lib')?.enabled).toBe(false);
    expect([...byId.values()].filter(plugin => plugin.id.endsWith('consumer') || plugin.id.startsWith('cycle-')).every(plugin => plugin.component == null)).toBe(true);
  });

  it('loads legacy plugins and manifest-based packages with contributions', async () => {
    vi.mocked(invoke).mockImplementation(async (command, args) => {
      const params = args as { path?: string; showHidden?: boolean } | undefined;
      const normalizedPath = String(params?.path ?? '').replace(/\\/g, '/');

      if (command === 'fs_list_dir' && normalizedPath === pluginSystemConfig.pluginsDirectory) {
        return [
          {
            name: 'hello-panel.tsx',
            path: 'plugins/hello-panel.tsx',
            is_dir: false,
            extension: 'tsx',
            modified: 10,
          },
          {
            name: 'mega-plugin',
            path: 'plugins/mega-plugin',
            is_dir: true,
            extension: '',
            modified: 20,
          },
        ];
      }

      if (command === 'fs_read_text_file' && normalizedPath === 'plugins/hello-panel.tsx') {
        return `
          import React from 'react';
          import { definePlugin } from 'overlayterm-plugin';

          export default definePlugin({
            name: 'Hello Panel',
            component: function HelloPanel() {
              return React.createElement('div', null, 'hello');
            },
          });
        `;
      }

      if (command === 'fs_read_text_file' && normalizedPath === 'plugins/mega-plugin/plugin.json') {
        return JSON.stringify({
          id: 'mega-plugin',
          name: 'Mega Plugin',
          entry: 'dist/index.js',
          category: 'First-party Workbenches',
          tags: ['workbench', 'preview', 'markdown'],
          testFiles: [
            {
              id: 'notes-fixture',
              label: 'Notes Fixture',
              path: 'examples/readme.md',
              description: 'A markdown preview sample.',
            },
          ],
          contributions: {
            shaders: ['shaders/halo.tsx'],
            fonts: [
              {
                id: 'mega-ui',
                name: 'Mega UI',
                family: '"Mega UI", sans-serif',
                faceName: 'Mega UI',
                src: 'fonts/mega-ui.ttf',
              },
            ],
            commands: [
              {
                id: 'build-project',
                name: 'Build Project',
                command: 'npm run build',
              },
            ],
            explorerActions: [
              {
                id: 'echo-path',
                label: 'Echo Path',
                command: 'echo {path}',
                appliesTo: 'file',
              },
            ],
            contextMenuItems: [
              {
                id: 'download-models-here',
                title: 'Download Models Here',
                contexts: ['background'],
                appliesTo: 'directory',
                panelRequest: {
                  panelId: 'sketchfab',
                  payload: {
                    destinationPath: '{path}',
                  },
                },
              },
              {
                id: 'send-to-aquarium',
                title: 'Send To Aquarium',
                contexts: ['entry', 'background'],
                appliesTo: 'directory',
                group: 'plugin',
                order: 640,
                command: 'aquarium {path}',
              },
              {
                id: 'compiled-index',
                title: 'Run Compiled Indexer',
                contexts: ['entry'],
                appliesTo: 'any',
                backend: {
                  entry: 'backend/indexer',
                  args: ['--path', '{path}'],
                },
              },
            ],
            previewLanes: [
              {
                id: 'notes-preview',
                title: 'Notes Preview',
                renderer: 'preview/notes-preview.js',
                runtimeId: 'notes-runtime',
                priority: 820,
                match: {
                  appliesTo: 'file',
                  extensions: ['md'],
                  fileNames: ['readme.md'],
                  previewKinds: ['text'],
                },
                capabilities: {
                  editable: true,
                  workflowTabs: true,
                  contextMenu: true,
                },
                workbenchChrome: {
                  includePreviewTab: true,
                  includeEditTab: true,
                  topBarLayoutId: 'compact-preview-header',
                  topBarDensity: 'compact',
                  wildcardTabs: [
                    {
                      id: 'vst',
                      label: 'VST',
                      baseMode: 'edit',
                    },
                    {
                      id: 'preview',
                      label: 'Reserved Preview',
                      baseMode: 'preview',
                    },
                    {
                      id: 'VST',
                      label: 'Duplicate VST',
                      baseMode: 'edit',
                    },
                    {
                      id: 'render',
                      label: 'Render',
                      baseMode: 'preview',
                    },
                  ],
                },
              },
            ],
            settingsSlots: [
              {
                id: 'notes-settings',
                title: 'Notes Settings',
                description: 'Tune the markdown preview lane.',
                iconName: 'SlidersHorizontal',
                keywords: ['notes', 'preview'],
                order: 25,
                renderer: 'settings/notes-settings.js',
                defaults: {
                  autoWrap: true,
                  density: 'cozy',
                },
                fields: [
                  {
                    id: 'autoWrap',
                    label: 'Auto Wrap',
                    kind: 'boolean',
                    defaultValue: true,
                  },
                  {
                    id: 'density',
                    label: 'Density',
                    kind: 'select',
                    defaultValue: 'compact',
                    options: ['cozy', 'compact'],
                  },
                  {
                    id: 'tabSize',
                    label: 'Tab Size',
                    kind: 'number',
                    defaultValue: 2,
                    min: 1,
                    max: 8,
                  },
                ],
              },
            ],
            mobilePanes: [
              {
                id: 'notes-mobile',
                title: 'Notes Mobile',
                renderer: 'mobile/notes-gallery.js',
                styles: ['mobile/notes-gallery.css'],
              },
            ],
          },
        });
      }

      if (command === 'fs_list_dir' && normalizedPath === 'plugins/mega-plugin/dist') {
        return [
          {
            name: 'index.js',
            path: 'plugins/mega-plugin/dist/index.js',
            is_dir: false,
            extension: 'js',
            modified: 42,
          },
          {
            name: 'panel-message.js',
            path: 'plugins/mega-plugin/dist/panel-message.js',
            is_dir: false,
            extension: 'js',
            modified: 43,
          },
        ];
      }

      if (command === 'fs_list_dir' && normalizedPath === 'plugins/mega-plugin/preview') {
        return [
          {
            name: 'notes-preview.js',
            path: 'plugins/mega-plugin/preview/notes-preview.js',
            is_dir: false,
            extension: 'js',
            modified: 44,
          },
        ];
      }

      if (command === 'fs_list_dir' && normalizedPath === 'plugins/mega-plugin/settings') {
        return [
          {
            name: 'notes-settings.js',
            path: 'plugins/mega-plugin/settings/notes-settings.js',
            is_dir: false,
            extension: 'js',
            modified: 45,
          },
        ];
      }

      if (command === 'fs_read_text_file' && normalizedPath === 'plugins/mega-plugin/dist/index.js') {
        return `
          import React from 'react';
          import { definePlugin } from 'overlayterm-plugin';
          import { panelMessage } from './panel-message';

          export default definePlugin({
            component: function MegaPluginPanel() {
              return React.createElement('div', null, panelMessage);
            },
          });
        `;
      }

      if (command === 'fs_read_text_file' && normalizedPath === 'plugins/mega-plugin/dist/panel-message.js') {
        return `export const panelMessage = 'mega';`;
      }

      if (command === 'fs_read_text_file' && normalizedPath === 'plugins/mega-plugin/preview/notes-preview.js') {
        return `
          import React from 'react';
          import { definePreviewLane } from 'overlayterm-plugin';

          export default definePreviewLane({
            component: function NotesPreviewLane({ file }) {
              return React.createElement('div', null, file.name);
            },
          });
        `;
      }

      if (command === 'fs_read_text_file' && normalizedPath === 'plugins/mega-plugin/settings/notes-settings.js') {
        return `
          import React from 'react';
          import { defineSettingsSlot } from 'overlayterm-plugin';

          export default defineSettingsSlot({
            component: function NotesSettingsSlot() {
              return React.createElement('div', null, 'notes settings');
            },
          });
        `;
      }

      if (command === 'fs_list_dir' && normalizedPath === 'plugins/mega-plugin/shaders') {
        return [
          {
            name: 'halo.tsx',
            path: 'plugins/mega-plugin/shaders/halo.tsx',
            is_dir: false,
            extension: 'tsx',
            modified: 99,
          },
        ];
      }

      if (command === 'fs_read_text_file' && normalizedPath === 'plugins/mega-plugin/shaders/halo.tsx') {
        return `
          import React from 'react';
          import { defineShader } from 'overlayterm-shader';

          export default defineShader({
            name: 'Plugin Halo',
            background: {
              render: function Halo() {
                return React.createElement('div', null, 'halo');
              },
            },
          });
        `;
      }

      throw new Error(`Unexpected invoke call: ${command} ${JSON.stringify(args)}`);
    });

    const result = await discoverOverlayPlugins(() => createMockOverlayPluginApi());

    expect(result.warnings).toEqual([]);
    expect(result.plugins.map(plugin => plugin.name)).toEqual(['Hello Panel', 'Mega Plugin']);
    expect(result.plugins[0]?.diagnostics.sourceKind).toBe('file-plugin');
    expect(result.plugins[1]?.diagnostics.sourceKind).toBe('package-plugin');
    expect(result.plugins[1]?.diagnostics.manifestPath?.replace(/\\/g, '/')).toBe('plugins/mega-plugin/plugin.json');
    expect(result.plugins[1]?.diagnostics.category).toBe('First-party Workbenches');
    expect(result.plugins[1]?.diagnostics.tags).toEqual(['workbench', 'preview', 'markdown']);
    expect(result.plugins[1]?.diagnostics.testFiles.map(testFile => ({
      ...testFile,
      path: testFile.path.replace(/\\/g, '/'),
    }))).toEqual([
      {
        id: 'notes-fixture',
        label: 'Notes Fixture',
        path: 'plugins/mega-plugin/examples/readme.md',
        description: 'A markdown preview sample.',
        extension: 'md',
        isDirectory: false,
      },
    ]);
    expect(result.plugins[1]?.diagnostics.capabilities.themes).toBe(0);
    expect(result.plugins[1]?.diagnostics.capabilities.shaders).toBe(1);
    expect(result.plugins[1]?.diagnostics.capabilities.commands).toBe(1);
    expect(result.plugins[1]?.diagnostics.capabilities.contextMenuItems).toBe(3);
    expect(result.plugins[1]?.diagnostics.capabilities.previewLanes).toBe(1);
    expect(result.plugins[1]?.diagnostics.capabilities.settingsSlots).toBe(1);
    expect(result.plugins[1]?.diagnostics.capabilities.mobilePanes).toBe(1);
    expect(result.themePackages).toHaveLength(0);
    expect(result.shaders).toHaveLength(1);
    expect(result.shaders[0]?.name).toBe('Plugin Halo');
    expect(result.fonts).toHaveLength(1);
    expect(result.fonts[0]?.sourceUrl?.replace(/\\/g, '/')).toContain('plugins/mega-plugin/fonts/mega-ui.ttf');
    expect(result.commands.map(command => command.name)).toEqual(['Build Project']);
    expect(result.explorerActions.map(action => action.label)).toEqual(['Echo Path']);
    expect(result.contextMenuItems.map(item => item.title)).toEqual([
      'Download Models Here',
      'Run Compiled Indexer',
      'Send To Aquarium',
    ]);
    expect(result.contextMenuItems[0]?.execution).toEqual({
      kind: 'panel-request',
      panelId: 'sketchfab',
      payload: {
        destinationPath: '{path}',
      },
    });
    expect(result.contextMenuItems[1]?.execution).toEqual({
      kind: 'plugin-backend',
      entry: 'backend/indexer',
      args: ['--path', '{path}'],
    });
    expect(result.contextMenuItems[2]?.execution).toEqual({
      kind: 'terminal-template',
      command: 'aquarium {path}',
      runOnSelect: true,
    });
    expect(result.previewLanes).toHaveLength(1);
    expect(result.previewLanes[0]).toMatchObject({
      id: 'mega-plugin.preview-lane.notes-preview',
      pluginId: 'mega-plugin',
      pluginName: 'Mega Plugin',
      title: 'Notes Preview',
      runtimeId: 'notes-runtime',
      priority: 820,
      rendererEntry: 'preview/notes-preview.js',
      match: {
        appliesTo: 'file',
        extensions: ['md'],
        fileNames: ['readme.md'],
        previewKinds: ['text'],
      },
      capabilities: {
        editable: true,
        save: false,
        export: false,
        workflowTabs: true,
        contextMenu: true,
        prefetch: false,
        closeGuard: false,
      },
      workbenchChrome: {
        includePreviewTab: true,
        includeEditTab: true,
        wildcardTabs: [
          {
            id: 'vst',
            label: 'VST',
            baseMode: 'edit',
          },
          {
            id: 'render',
            label: 'Render',
            baseMode: 'preview',
          },
        ],
        topBarLayoutId: 'compact-preview-header',
        topBarDensity: 'compact',
      },
    });
    expect(typeof result.previewLanes[0]?.component).toBe('function');
    expect(result.settingsSlots).toHaveLength(1);
    expect(result.settingsSlots[0]).toMatchObject({
      id: 'mega-plugin.settings-slot.notes-settings',
      pluginId: 'mega-plugin',
      pluginName: 'Mega Plugin',
      title: 'Notes Settings',
      description: 'Tune the markdown preview lane.',
      iconName: 'SlidersHorizontal',
      keywords: ['notes', 'preview'],
      order: 25,
      rendererEntry: 'settings/notes-settings.js',
      defaults: {
        autoWrap: true,
        density: 'cozy',
      },
    });
    expect(result.settingsSlots[0]?.fields).toEqual([
      expect.objectContaining({
        id: 'autoWrap',
        kind: 'boolean',
        defaultValue: true,
      }),
      expect.objectContaining({
        id: 'density',
        kind: 'select',
        defaultValue: 'compact',
        options: [
          { value: 'cozy', label: 'cozy' },
          { value: 'compact', label: 'compact' },
        ],
      }),
      expect.objectContaining({
        id: 'tabSize',
        kind: 'number',
        defaultValue: 2,
        min: 1,
        max: 8,
      }),
    ]);
    expect(typeof result.settingsSlots[0]?.component).toBe('function');
  });

  it('discovers plugin workflow contributions from package manifests', async () => {
    vi.mocked(invoke).mockImplementation(async (command, args) => {
      const params = args as { path?: string; showHidden?: boolean } | undefined;
      const normalizedPath = String(params?.path ?? '').replace(/\\/g, '/');

      if (command === 'fs_list_dir' && normalizedPath === pluginSystemConfig.pluginsDirectory) {
        return [
          {
            name: 'workflow-package',
            path: 'plugins/workflow-package',
            is_dir: true,
            extension: '',
            modified: 30,
          },
        ];
      }

      if (command === 'fs_read_text_file' && normalizedPath === 'plugins/workflow-package/plugin.json') {
        return JSON.stringify({
          id: 'workflow-package',
          name: 'Workflow Package',
          entry: 'dist/index.js',
          contributions: {
            workflows: [
              {
                id: 'rename-slate',
                title: 'Rename Slate',
                description: 'Package workflow contribution smoke test.',
                entry: 'workflows/rename.js',
                contexts: ['background', 'entry'],
                defaultSize: 'lg',
              },
            ],
          },
        });
      }

      if (command === 'fs_list_dir' && normalizedPath === 'plugins/workflow-package/dist') {
        return [
          {
            name: 'index.js',
            path: 'plugins/workflow-package/dist/index.js',
            is_dir: false,
            extension: 'js',
            modified: 31,
          },
        ];
      }

      if (command === 'fs_list_dir' && normalizedPath === 'plugins/workflow-package/workflows') {
        return [
          {
            name: 'rename.js',
            path: 'plugins/workflow-package/workflows/rename.js',
            is_dir: false,
            extension: 'js',
            modified: 32,
          },
        ];
      }

      if (command === 'fs_read_text_file' && normalizedPath === 'plugins/workflow-package/dist/index.js') {
        return `
          import React from 'react';
          import { definePlugin } from 'overlayterm-plugin';

          export default definePlugin({
            name: 'Workflow Package',
            component: function WorkflowPackagePanel() {
              return React.createElement('div', null, 'workflow-package');
            },
          });
        `;
      }

      if (command === 'fs_read_text_file' && normalizedPath === 'plugins/workflow-package/workflows/rename.js') {
        return `
          import React from 'react';
          import { defineWorkflow } from 'overlayterm-plugin';

          function RenameWorkflowSurface() {
            return React.createElement('div', null, 'rename-workflow');
          }

          export default defineWorkflow({
            component: RenameWorkflowSurface,
            descriptor: {
              title: 'Rename Slate',
              description: 'Package workflow contribution smoke test.',
              contexts: ['background', 'entry'],
              defaultSize: 'lg',
            },
          });
        `;
      }

      throw new Error(`Unexpected invoke call: ${command} ${JSON.stringify(args)}`);
    });

    const result = await discoverOverlayPlugins(() => createMockOverlayPluginApi());

    expect(result.workflows).toHaveLength(1);
    expect(result.workflows[0]).toMatchObject({
      id: 'workflow-package.workflow.rename-slate',
      pluginId: 'workflow-package',
      pluginName: 'Workflow Package',
      title: 'Rename Slate',
      description: 'Package workflow contribution smoke test.',
      contexts: ['background', 'entry'],
      defaultSize: 'lg',
    });
    expect(typeof result.workflows[0]?.component).toBe('function');
  });

  it('creates package panels from panelRuntime manifests without loading a React entrypoint', async () => {
    vi.mocked(invoke).mockImplementation(async (command, args) => {
      const params = args as { path?: string; showHidden?: boolean } | undefined;
      const normalizedPath = String(params?.path ?? '').replace(/\\/g, '/');

      if (command === 'fs_list_dir' && normalizedPath === pluginSystemConfig.pluginsDirectory) {
        return [
          {
            name: 'rust-panel-suite',
            path: 'plugins/rust-panel-suite',
            is_dir: true,
            extension: '',
            modified: 55,
          },
        ];
      }

      if (command === 'fs_read_text_file' && normalizedPath === 'plugins/rust-panel-suite/plugin.json') {
        return JSON.stringify({
          id: 'rust-panel-suite',
          name: 'Rust Panel Suite',
          panelRuntime: {
            runtimeId: 'rust-panel-runtime',
            buildTarget: 'wasm-bindgen-web',
          },
        });
      }

      throw new Error(`Unexpected invoke call: ${command} ${JSON.stringify(args)}`);
    });

    const result = await discoverOverlayPlugins(() => createMockOverlayPluginApi());

    expect(result.warnings).toEqual([]);
    expect(result.plugins).toHaveLength(1);
    expect(result.plugins[0]?.id).toBe('rust-panel-suite');
    expect(result.plugins[0]?.name).toBe('Rust Panel Suite');
    expect(result.plugins[0]?.diagnostics.sourceKind).toBe('package-plugin');
    expect(result.plugins[0]?.diagnostics.manifestPath?.replace(/\\/g, '/')).toBe(
      'plugins/rust-panel-suite/plugin.json',
    );
    expect(result.plugins[0]?.diagnostics.capabilities.panel).toBe(true);

    const markup = renderToStaticMarkup(
      React.createElement(result.plugins[0]!.component as React.ComponentType<any>, {
        plugin: result.plugins[0],
        api: createMockOverlayPluginApi(),
        appearance: makeAppearance(),
        host: makePanelHost(),
      }),
    );

    expect(markup).toContain('data-runtime-id="rust-panel-runtime"');
    expect(markup).toContain('Loading rust-panel-runtime');
  });

  it('creates wasm preview lanes from runtimeSurface manifests without a renderer entry', async () => {
    vi.mocked(invoke).mockImplementation(async (command, args) => {
      const params = args as { path?: string; showHidden?: boolean } | undefined;
      const normalizedPath = String(params?.path ?? '').replace(/\\/g, '/');

      if (command === 'fs_list_dir' && normalizedPath === pluginSystemConfig.pluginsDirectory) {
        return [
          {
            name: 'rust-preview-suite',
            path: 'plugins/rust-preview-suite',
            is_dir: true,
            extension: '',
            modified: 77,
          },
        ];
      }

      if (command === 'fs_read_text_file' && normalizedPath === 'plugins/rust-preview-suite/plugin.json') {
        return JSON.stringify({
          id: 'rust-preview-suite',
          name: 'Rust Preview Suite',
          contributions: {
            previewLanes: [
              {
                id: 'model-inspector',
                title: 'Model Inspector',
                rendererKind: 'wasm-panel',
                runtimeSurfaceId: 'rust-preview-runtime',
                buildTarget: 'wasm-bindgen-web',
                priority: 915,
                match: {
                  appliesTo: 'file',
                  extensions: ['glb'],
                  fileNames: [],
                  previewKinds: ['model3d'],
                },
                capabilities: {
                  editable: false,
                  workflowTabs: false,
                  contextMenu: false,
                },
              },
            ],
          },
        });
      }

      throw new Error(`Unexpected invoke call: ${command} ${JSON.stringify(args)}`);
    });

    const result = await discoverOverlayPlugins(() => createMockOverlayPluginApi());

    expect(result.warnings).toEqual([]);
    expect(result.previewLanes).toHaveLength(1);
    expect(result.previewLanes[0]).toMatchObject({
      id: 'rust-preview-suite.preview-lane.model-inspector',
      pluginId: 'rust-preview-suite',
      pluginName: 'Rust Preview Suite',
      title: 'Model Inspector',
      priority: 915,
      rendererKind: 'wasm-panel',
      rendererEntry: null,
      runtimeId: null,
      runtimeSurfaceId: 'rust-preview-runtime',
      buildTarget: 'wasm-bindgen-web',
      match: {
        appliesTo: 'file',
        extensions: ['glb'],
        previewKinds: ['model3d'],
      },
      capabilities: {
        editable: false,
        save: false,
        export: false,
        workflowTabs: false,
        contextMenu: false,
        prefetch: false,
        closeGuard: false,
      },
    });

    const markup = renderToStaticMarkup(
      React.createElement(result.previewLanes[0]!.component as React.ComponentType<any>, {
        plugin: {
          id: 'rust-preview-suite',
          name: 'Rust Preview Suite',
          filePath: 'plugins/rust-preview-suite/plugin.json',
          pluginRoot: pluginSystemConfig.pluginsDirectory,
          pluginDirectory: 'plugins/rust-preview-suite',
          backendDirectory: 'plugins/rust-preview-suite/backend',
        },
        api: createMockOverlayPluginApi(),
        appearance: makeAppearance(),
        host: makePreviewHost(),
        executionContext: null,
        lane: result.previewLanes[0],
        file: {
          path: '/tmp/model.glb',
          resolvedPath: '/tmp/model.glb',
          name: 'model.glb',
          extension: 'glb',
          size: 4096,
          assetUrl: 'asset:///tmp/model.glb',
          isDirectory: false,
        },
        runtime: {} as never,
        viewMode: 'preview',
        workflowTabId: 'preview',
        previewBackedByArchiveVirtual: false,
      }),
    );

    expect(markup).toContain('data-runtime-id="rust-preview-runtime"');
    expect(markup).toContain('Loading Model Inspector runtime');
  });

  it('rejects unsafe package-relative paths before loading bundled assets', async () => {
    vi.mocked(invoke).mockImplementation(async (command, args) => {
      const params = args as { path?: string; showHidden?: boolean } | undefined;
      const normalizedPath = String(params?.path ?? '').replace(/\\/g, '/');

      if (command === 'fs_list_dir' && normalizedPath === pluginSystemConfig.pluginsDirectory) {
        return [
          {
            name: 'unsafe-plugin',
            path: 'plugins/unsafe-plugin',
            is_dir: true,
            extension: '',
            modified: 1,
          },
        ];
      }

      if (command === 'fs_read_text_file' && normalizedPath === 'plugins/unsafe-plugin/plugin.json') {
        return JSON.stringify({
          id: 'unsafe-plugin',
          name: 'Unsafe Plugin',
          entry: '../escape.js',
          contributions: {
            fonts: [
              {
                name: 'Broken Font',
                src: '../../escape.ttf',
              },
            ],
            themes: ['../themes/escape'],
          },
        });
      }

      if (command === 'fs_read_text_file' && normalizedPath === 'plugins/unsafe-plugin/escape.js') {
        throw new Error('unsafe entry should not be loaded');
      }

      throw new Error(`Unexpected invoke call: ${command} ${JSON.stringify(args)}`);
    });

    const result = await discoverOverlayPlugins(() => createMockOverlayPluginApi());

    expect(result.plugins).toHaveLength(0);
    expect(result.themePackages).toHaveLength(0);
    expect(result.fonts).toHaveLength(0);
    expect(result.warnings).toEqual([
      'Unsafe Plugin: font Broken Font: invalid relative path',
    ]);
  });

  it('adapts Kain plugin catalog entries into metadata plugins and preview workbench lanes', async () => {
    vi.mocked(invoke).mockImplementation(async (command, args) => {
      const params = args as { path?: string; showHidden?: boolean } | undefined;
      const normalizedPath = String(params?.path ?? '').replace(/\\/g, '/');

      if (
        command === 'fs_list_dir' &&
        (
          normalizedPath === pluginSystemConfig.pluginsDirectory ||
          normalizedPath === pluginSystemConfig.packagesDirectory
        )
      ) {
        return [];
      }

      throw new Error(`Unexpected invoke call: ${command} ${JSON.stringify(args)}`);
    });

    const result = await discoverOverlayPlugins(() => createMockOverlayPluginApi(), {
      kainPluginCatalog: {
        schemaVersion: 1,
        kind: 'greeblefs.kain.plugin.catalog',
        source: 'src-kain/plugins/registry.kn',
        root: 'usr/plugins-kain',
        stdlib: 'src-kain/plugins/stdlib/greeblefs/plugin.kn',
        host: 'src/runtime/kainPluginCatalog.ts',
        summary: 'Kain plugin catalog.',
        consumers: [],
        plugins: [
          {
            id: 'kain-workbench-smoke',
            name: 'Kain Workbench Smoke',
            version: '0.1.0',
            description: 'Kain plugin proof.',
            category: 'Kain Plugins',
            source: 'usr/plugins-kain/kain-workbench-smoke/plugin.kn',
            directory: 'usr/plugins-kain/kain-workbench-smoke',
            manifestPath: 'usr/plugins-kain/kain-workbench-smoke/plugin.kn',
            status: 'live',
            tags: ['workbench', 'ffi'],
            permissions: [],
            ffiCapabilities: [
              {
                id: 'cargo.pipeline',
                label: 'Cargo FFI pipeline',
                lane: 'cargo-ffi',
                summary: 'Cargo lane.',
                status: 'declared',
                required: false,
              },
            ],
            runtimes: [],
            tools: [
              {
                id: 'image-tool',
                kind: 'image-converter',
                label: 'Image Tool',
                summary: 'Image conversion.',
                supportedInputExtensions: ['png'],
                resizeModes: ['contain'],
                formats: [],
                resizePresets: [],
                pipelineBackends: [],
                ui: {},
              },
            ],
            workbenches: [
              {
                id: 'kain-workbench-smoke.main',
                title: 'Kain Workbench Smoke',
                summary: 'Workbench proof.',
                kind: 'workbench',
                mountSlot: 'workbench.panels',
                order: 20,
                rendererKind: 'kain-host',
                toolId: 'image-tool',
                defaultOpen: false,
                hostModels: ['host.plugins'],
                actions: ['kain.plugin.inspect'],
                ffiLanes: ['cargo-ffi'],
              },
            ],
            previewWorkbenches: [
              {
                id: 'kain-workbench-smoke.preview.kn',
                title: 'Kain Source Preview',
                summary: 'Preview proof.',
                order: 980,
                rendererKind: 'kain-host',
                match: {
                  appliesTo: 'file',
                  extensions: ['kn'],
                  fileNames: [],
                  previewKinds: ['script'],
                },
                capabilities: {
                  editable: false,
                  save: false,
                  export: false,
                  workflowTabs: true,
                  contextMenu: true,
                  prefetch: true,
                  closeGuard: false,
                },
                workbenchChrome: {
                  includePreviewTab: true,
                  includeEditTab: false,
                  topBarDensity: 'compact',
                },
                actions: ['kain.plugin.inspect'],
                ffiLanes: ['cargo-ffi'],
              },
            ],
            actions: [
              {
                id: 'kain.plugin.inspect',
                label: 'Inspect',
                summary: 'Inspect proof.',
                command: 'greeblefs.plugins.action',
                kind: 'bridge-action',
                status: 'live',
                requiresTrust: true,
                ffiLanes: ['cargo-ffi'],
              },
            ],
            wasmTargets: [
              {
                id: 'kain-smoke-worker',
                label: 'Kain Smoke WASM Worker',
                source: 'plugin.runtime/wasm/smoke_worker.kn',
                target: 'plugin.runtime/wasm/dist/smoke_worker.wasm',
                buildTarget: 'wasm32-unknown-unknown',
                status: 'declared',
              },
            ],
            cargoFfiTargets: [
              {
                id: 'kain-smoke-cargo-ffi',
                label: 'Kain Smoke Cargo FFI',
                crateName: 'greeblefs-kain-smoke-tools',
                cratePath: 'plugin.runtime/cargo/greeblefs-kain-smoke-tools',
                feature: 'analysis',
                status: 'declared',
              },
            ],
            generatedArtifacts: [],
          },
        ],
      },
    });

    expect(result.plugins).toHaveLength(1);
    expect(result.plugins[0]).toMatchObject({
      id: 'kain-workbench-smoke',
      name: 'Kain Workbench Smoke',
      enabled: true,
      diagnostics: {
        sourceKind: 'kain-plugin',
        packageKind: 'runtime',
        category: 'Kain Plugins',
        capabilities: {
          panel: true,
          previewLanes: 1,
          actions: 1,
          kainWorkbenches: 1,
          kainPreviewWorkbenches: 1,
          kainTools: 1,
          kainFfiCapabilities: 1,
          kainWasmTargets: 1,
          kainCargoFfiTargets: 1,
        },
      },
    });
    expect(result.plugins[0]?.component).toBeTypeOf('function');
    expect(result.previewLanes).toHaveLength(1);
    expect(result.previewLanes[0]).toMatchObject({
      id: 'kain-workbench-smoke.preview-lane.kain-workbench-smoke.preview.kn',
      pluginId: 'kain-workbench-smoke',
      title: 'Kain Source Preview',
      rendererKind: 'react',
      match: {
        extensions: ['kn'],
        previewKinds: ['script'],
      },
      capabilities: {
        workflowTabs: true,
        contextMenu: true,
        prefetch: true,
      },
    });
  });
});
