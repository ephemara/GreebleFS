import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { resolve } from 'path';
import { describe, expect, it, vi } from 'vitest';
import PluginsManager from '../components/PluginsManager';
import type { OverlayPluginPreviewLaneContribution } from '../config/pluginContributions';
import { pluginSystemConfig } from '../config/plugins';
import { joinPlatformPath } from '../config/platform';
import { normalizeExplorerPreviewWorkbenchChromeMetadata } from '../config/previewWorkbenchChrome';

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

function makeWorkbenchPlugin() {
  return {
    id: 'media-workbench',
    name: 'Media Workbench',
    filePath: resolve(pluginSystemConfig.pluginsDirectory, 'media-workbench/plugin.json'),
    pluginRoot: pluginSystemConfig.pluginsDirectory,
    pluginDirectory: joinPlatformPath(pluginSystemConfig.pluginsDirectory, 'media-workbench'),
    backendDirectory: joinPlatformPath(
      joinPlatformPath(pluginSystemConfig.pluginsDirectory, 'media-workbench'),
      pluginSystemConfig.backendDirectoryName,
    ),
    modified: 1,
    enabled: true,
    defaultOpen: false,
    keepMounted: false,
    component: null,
    error: null,
    diagnostics: {
      sourceKind: 'package-plugin',
      sourceLabel: 'Media Workbench',
      manifestPath: 'plugins/media-workbench/plugin.json',
      category: 'First-party Workbenches',
      tags: ['workbench', 'preview'],
      testFiles: [
        {
          id: 'audio-tone',
          label: 'Audio Tone',
          path: 'plugins/media-workbench/examples/audio-tone.wav',
          extension: 'wav',
          isDirectory: false,
        },
        {
          id: 'video-slate',
          label: 'Video Slate',
          path: 'plugins/media-workbench/examples/video-slate.mp4',
          extension: 'mp4',
          isDirectory: false,
        },
      ],
      warnings: [],
      capabilities: {
        panel: false,
        themes: 0,
        shaders: 0,
        fonts: 0,
        commands: 0,
        actions: 0,
        explorerActions: 0,
        contextMenuItems: 0,
        previewLanes: 1,
        settingsSlots: 0,
      },
    },
  } as never;
}

function makePreviewLane(
  partial: Partial<OverlayPluginPreviewLaneContribution> &
    Pick<OverlayPluginPreviewLaneContribution, 'id' | 'title'>,
): OverlayPluginPreviewLaneContribution {
  return {
    id: partial.id,
    pluginId: partial.pluginId ?? 'media-workbench',
    pluginName: partial.pluginName ?? 'Media Workbench',
    title: partial.title,
    priority: partial.priority ?? 720,
    rendererEntry: partial.rendererEntry ?? 'preview/workbench.tsx',
    runtimeId: partial.runtimeId ?? null,
    match: partial.match ?? {
      appliesTo: 'file',
      extensions: ['wav'],
      fileNames: [],
      previewKinds: [],
    },
    capabilities: partial.capabilities ?? {
      editable: true,
      save: false,
      export: true,
      workflowTabs: false,
      contextMenu: false,
      prefetch: false,
      closeGuard: false,
    },
    workbenchChrome: partial.workbenchChrome ?? normalizeExplorerPreviewWorkbenchChromeMetadata(
      undefined,
      { includeEditTab: partial.capabilities?.editable ?? true },
    ),
    component: partial.component ?? (() => null),
  };
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
        onSetPluginEnabled={() => undefined}
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

    const onSetPluginEnabled = vi.fn();

    render(
      <PluginsManager
        appearance={makeAppearance()}
        plugins={plugins}
        isLoading={false}
        error="runtime warning"
        onRefreshPlugins={() => undefined}
        onOpenPluginsFolder={() => Promise.resolve()}
        onSetPluginEnabled={onSetPluginEnabled}
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
    fireEvent.click(screen.getAllByRole('switch', { name: /Disable Alpha/i })[0]);
    expect(onSetPluginEnabled).toHaveBeenCalledWith(plugins[0], false);

    fireEvent.click(screen.getByRole('button', { name: /Beta Enabled Load error/i }));

    await waitFor(() => {
      expect(screen.getByText(/Beta failed to load/i)).toBeInTheDocument();
      expect(screen.getByText('broken export')).toBeInTheDocument();
    });
  });

  it('collapses plugin rail categories and inspector sections', async () => {
    const PluginView = ({ plugin }: { plugin: { name: string } }) => <div>workspace:{plugin.name}</div>;
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
          category: 'First-party Workbenches',
          tags: ['workbench', 'preview'],
          testFiles: [],
          warnings: ['keep this fixture small'],
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

    const onSetPluginEnabled = vi.fn();

    render(
      <PluginsManager
        appearance={makeAppearance()}
        plugins={plugins}
        isLoading={false}
        error={null}
        onRefreshPlugins={() => undefined}
        onOpenPluginsFolder={() => Promise.resolve()}
        onSetPluginEnabled={onSetPluginEnabled}
        createPluginApi={() => ({}) as never}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('workspace:Alpha')).toBeInTheDocument();
    });

    const categoryToggle = screen.getByRole('button', { name: /First-party Workbenches 1 plugin/i });
    expect(categoryToggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: /Alpha Enabled Package plugin/i })).toBeInTheDocument();

    fireEvent.click(categoryToggle);

    expect(categoryToggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('button', { name: /Alpha Enabled Package plugin/i })).not.toBeInTheDocument();

    fireEvent.click(categoryToggle);

    expect(screen.getByRole('button', { name: /Alpha Enabled Package plugin/i })).toBeInTheDocument();
    expect(screen.getByText('keep this fixture small')).toBeInTheDocument();

    const diagnosticsToggle = screen.getByRole('button', { name: /Diagnostics section/i });
    fireEvent.click(diagnosticsToggle);

    expect(diagnosticsToggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('keep this fixture small')).not.toBeInTheDocument();
  });

  it('renders manifest-declared Preview/Edit/VST tabs for plugin workbench previews', async () => {
    const plugin = makeWorkbenchPlugin();
    const lane = makePreviewLane({
      id: 'media-workbench.preview-lane.audio',
      title: 'Audio Workbench',
      workbenchChrome: normalizeExplorerPreviewWorkbenchChromeMetadata({
        includePreviewTab: true,
        includeEditTab: true,
        wildcardTabs: [
          {
            id: 'vst',
            label: 'VST',
            baseMode: 'edit',
          },
        ],
      }),
      component: ({ viewMode, workflowTabId }) => (
        <div data-testid="plugin-preview-props">{viewMode}:{workflowTabId}</div>
      ),
    });

    render(
      <PluginsManager
        appearance={makeAppearance()}
        plugins={[plugin]}
        previewLanes={[lane]}
        isLoading={false}
        error={null}
        onRefreshPlugins={() => undefined}
        onOpenPluginsFolder={() => Promise.resolve()}
        onSetPluginEnabled={() => undefined}
        createPluginApi={() => ({}) as never}
      />,
    );

    const workflowTabs = await screen.findByRole('group', { name: /Preview workflow tabs/i });
    expect(within(workflowTabs).getByRole('button', { name: 'Preview' })).toBeInTheDocument();
    expect(within(workflowTabs).getByRole('button', { name: 'Edit' })).toBeInTheDocument();
    expect(within(workflowTabs).getByRole('button', { name: 'VST' })).toBeInTheDocument();
    expect(screen.getByTestId('plugin-preview-props')).toHaveTextContent('preview:preview');

    fireEvent.click(within(workflowTabs).getByRole('button', { name: 'Edit' }));
    await waitFor(() => {
      expect(screen.getByTestId('plugin-preview-props')).toHaveTextContent('edit:edit');
    });

    fireEvent.click(within(workflowTabs).getByRole('button', { name: 'VST' }));
    await waitFor(() => {
      expect(screen.getByTestId('plugin-preview-props')).toHaveTextContent('edit:vst');
    });
  });

  it('renders video-style Preview/Edit tabs without wildcard tabs', async () => {
    const plugin = makeWorkbenchPlugin();
    const lane = makePreviewLane({
      id: 'media-workbench.preview-lane.video',
      title: 'Video Workbench',
      match: {
        appliesTo: 'file',
        extensions: ['mp4'],
        fileNames: [],
        previewKinds: [],
      },
      workbenchChrome: normalizeExplorerPreviewWorkbenchChromeMetadata({
        includePreviewTab: true,
        includeEditTab: true,
      }),
      component: ({ viewMode, workflowTabId, file }) => (
        <div data-testid="plugin-video-preview-props">
          {file.name}:{viewMode}:{workflowTabId}
        </div>
      ),
    });

    render(
      <PluginsManager
        appearance={makeAppearance()}
        plugins={[plugin]}
        previewLanes={[lane]}
        isLoading={false}
        error={null}
        onRefreshPlugins={() => undefined}
        onOpenPluginsFolder={() => Promise.resolve()}
        onSetPluginEnabled={() => undefined}
        createPluginApi={() => ({}) as never}
      />,
    );

    const workflowTabs = await screen.findByRole('group', { name: /Preview workflow tabs/i });
    expect(within(workflowTabs).getByRole('button', { name: 'Preview' })).toBeInTheDocument();
    expect(within(workflowTabs).getByRole('button', { name: 'Edit' })).toBeInTheDocument();
    expect(within(workflowTabs).queryByRole('button', { name: 'VST' })).not.toBeInTheDocument();
    expect(screen.getByTestId('plugin-video-preview-props')).toHaveTextContent('video-slate.mp4:preview:preview');

    fireEvent.click(within(workflowTabs).getByRole('button', { name: 'Edit' }));
    await waitFor(() => {
      expect(screen.getByTestId('plugin-video-preview-props')).toHaveTextContent('video-slate.mp4:edit:edit');
    });
  });

  it('passes directory test files into workbench preview lanes', async () => {
    const basePlugin = makeWorkbenchPlugin() as any;
    const plugin = {
      ...basePlugin,
      id: 'folder-workbench',
      name: 'Folder Workbench',
      diagnostics: {
        ...basePlugin.diagnostics,
        testFiles: [
          {
            id: 'folder-fixture',
            label: 'Folder Fixture',
            path: 'plugins/folder-workbench/examples/folder-fixture',
            extension: '',
            isDirectory: true,
          },
        ],
      },
    } as never;
    const lane = makePreviewLane({
      id: 'folder-workbench.preview-lane.folder',
      pluginId: 'folder-workbench',
      pluginName: 'Folder Workbench',
      title: 'Folder Workbench',
      match: {
        appliesTo: 'directory',
        extensions: [],
        fileNames: [],
        previewKinds: ['folder'],
      },
      workbenchChrome: normalizeExplorerPreviewWorkbenchChromeMetadata({
        includePreviewTab: true,
        includeEditTab: false,
      }),
      component: ({ file }) => (
        <div data-testid="plugin-folder-preview-props">
          {file.name}:{String(file.isDirectory)}:{file.assetUrl}
        </div>
      ),
    });

    render(
      <PluginsManager
        appearance={makeAppearance()}
        plugins={[plugin]}
        previewLanes={[lane]}
        isLoading={false}
        error={null}
        onRefreshPlugins={() => undefined}
        onOpenPluginsFolder={() => Promise.resolve()}
        onSetPluginEnabled={() => undefined}
        createPluginApi={() => ({}) as never}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId('plugin-folder-preview-props')).toHaveTextContent(
        'folder-fixture:true:',
      );
    });
  });
});
