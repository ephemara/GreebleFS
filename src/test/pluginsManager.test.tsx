import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { resolve } from 'path';
import { describe, expect, it, vi } from 'vitest';
import PluginsManager from '../components/PluginsManager';
import { pluginSystemConfig } from '../config/plugins';
import { joinPlatformPath } from '../config/platform';

function makeAppearance() {
  return {
    theme: {
      palette: {
        accent: '#44ff88',
        appBackground: '#090909',
        panelBackground: '#111111',
        panelAltBackground: '#141414',
        textPrimary: '#f5f5f5',
        textMuted: '#9a9a9a',
        textSecondary: '#d0d0d0',
        border: '#2a2a2a',
        danger: '#ff7777',
      },
    },
    fonts: {
      ui: 'Inter, system-ui, sans-serif',
      mono: 'JetBrains Mono, monospace',
    },
    cssVars: {},
  } as never;
}

describe('PluginsManager', () => {
  it('renders an empty state when no plugins are loaded', () => {
    const onOpenPluginsFolder = vi.fn();

    render(
      <PluginsManager
        appearance={makeAppearance()}
        plugins={[]}
        isLoading={false}
        error={null}
        onRefreshPlugins={() => undefined}
        onOpenPluginsFolder={onOpenPluginsFolder}
        createPluginApi={() => ({}) as never}
      />,
    );

    expect(screen.getByText(/No plugins found/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Open Plugins Folder/i }));
    expect(onOpenPluginsFolder).toHaveBeenCalledTimes(1);
  });

  it('switches between plugins and surfaces load errors', async () => {
    const PluginView = ({
      plugin,
      host,
    }: {
      plugin: { name: string };
      host?: { zoom?: number };
    }) => <div>workspace:{plugin.name}:zoom:{host?.zoom ?? 0}</div>;
    const plugins = [
      {
        id: 'alpha',
        name: 'Alpha',
        filePath: resolve(pluginSystemConfig.pluginsDirectory, 'alpha.tsx'),
        pluginRoot: pluginSystemConfig.pluginsDirectory,
        pluginDirectory: joinPlatformPath(pluginSystemConfig.pluginsDirectory, 'alpha'),
        backendDirectory: joinPlatformPath(
          joinPlatformPath(pluginSystemConfig.pluginsDirectory, 'alpha'),
          pluginSystemConfig.backendDirectoryName,
        ),
        modified: 1,
        defaultOpen: true,
        keepMounted: false,
        component: PluginView,
        error: null,
        diagnostics: {
          sourceKind: 'package-plugin',
          sourceLabel: 'Alpha Suite',
          manifestPath: 'plugins/alpha/plugin.json',
          warnings: ['shader glow.tsx: bad uniform'],
          capabilities: {
            panel: true,
            themes: 1,
            shaders: 1,
            fonts: 0,
            commands: 1,
            actions: 0,
            explorerActions: 0,
            contextMenuItems: 0,
            previewLanes: 1,
            settingsSlots: 1,
          },
        },
      },
      {
        id: 'beta',
        name: 'Beta',
        filePath: resolve(pluginSystemConfig.pluginsDirectory, 'beta.tsx'),
        pluginRoot: pluginSystemConfig.pluginsDirectory,
        pluginDirectory: joinPlatformPath(pluginSystemConfig.pluginsDirectory, 'beta'),
        backendDirectory: joinPlatformPath(
          joinPlatformPath(pluginSystemConfig.pluginsDirectory, 'beta'),
          pluginSystemConfig.backendDirectoryName,
        ),
        modified: 2,
        defaultOpen: true,
        keepMounted: false,
        component: null,
        error: 'broken export',
        diagnostics: {
          sourceKind: 'file-plugin',
          sourceLabel: resolve(pluginSystemConfig.pluginsDirectory, 'beta.tsx'),
          warnings: [],
          capabilities: {
            panel: true,
            themes: 0,
            shaders: 0,
            fonts: 0,
            commands: 0,
            actions: 0,
            explorerActions: 0,
            contextMenuItems: 0,
            previewLanes: 0,
            settingsSlots: 0,
          },
        },
      },
    ] as never;

    render(
      <PluginsManager
        appearance={makeAppearance()}
        plugins={plugins}
        isLoading={false}
        error="runtime warning"
        onRefreshPlugins={() => undefined}
        onOpenPluginsFolder={() => Promise.resolve()}
        createPluginApi={() => ({}) as never}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('workspace:Alpha:zoom:1')).toBeInTheDocument();
    });
    expect(screen.getByText('runtime warning')).toBeInTheDocument();
    expect(screen.getAllByText(/Package plugin/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Themes 1').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Preview 1').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Settings 1').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/1 warning/i).length).toBeGreaterThan(0);
    expect(screen.getByText('shader glow.tsx: bad uniform')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Beta Load error/i }));

    await waitFor(() => {
      expect(screen.getByText(/Beta failed to load/i)).toBeInTheDocument();
      expect(screen.getByText('broken export')).toBeInTheDocument();
    });
  });
});
