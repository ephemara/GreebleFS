import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { KainUiSettingsSection } from '../components/settings/sections/KainUiSettingsSection';
import type { KainAppManifest } from '../runtime/kainManifest';
import type { KainFfiCatalog } from '../runtime/kainFfiCatalog';
import type { KainLatticeCatalog } from '../runtime/kainLatticeCatalog';
import type { KainUiGraph } from '../runtime/kainUiGraph';
import type { KainPluginCatalog } from '../runtime/kainPluginCatalog';
import type { KainUiScaffold } from '../runtime/kainUiScaffold';

const graph: KainUiGraph = {
  schemaVersion: 1,
  kind: 'greeblefs.ui.graph',
  source: 'src-kain/app/main.kn',
  theme: {
    selectionMode: 'catalog',
    recommendedThemeId: 'kain-ion-lattice',
    authoredThemes: [
      {
        id: 'ion-lattice',
        name: 'Ion Lattice',
        description: 'Usr-authored Kain UI theme.',
        source: 'usr/profiles/default/kain-ui/themes/ion-lattice/main.kn',
        compatibilityThemeId: 'kain-ion-lattice',
        compatibilityBundlePath: 'usr/themes/kain-ion-lattice/theme.json',
        status: 'selectable',
        selectable: true,
      },
    ],
  },
  chrome: {
    density: 'compact',
  },
  layout: {
    settingsRailMode: 'streamlined',
  },
  motion: {
    preset: 'subtle',
  },
  settings: {
    mode: 'streamlined',
    categories: [
      {
        key: 'start',
        label: 'Start',
        description: 'Start lane.',
        sectionKeys: ['overview', 'system', 'kain-ui'],
      },
    ],
    hiddenSectionKeys: ['theme-json'],
    primarySectionKeys: ['overview', 'system', 'kain-ui'],
  },
  profile: {
    source: 'app',
    scope: 'global',
    overlays: ['usr/kain-ui/main.kn'],
  },
};

const manifest: KainAppManifest = {
  schemaVersion: 1,
  kind: 'greeblefs.kain.manifest',
  source: 'src-kain/app/main.kn',
  label: 'GreebleFS Kain Manifest',
  summary: 'Kain-authored contribution map.',
  bridge: {
    runtimeId: 'greeblefs-kain-app',
    entry: 'src-kain/app/main.kn',
    dispatchFunction: 'kain_bridge_dispatch',
    transport: 'tauron.kain.bridge.json-lines',
    supervisor: 'tauri-plugin-kain',
  },
  capabilities: [
    {
      id: 'kain.app.manifest',
      lane: 'bridge',
      label: 'Kain app manifest',
      summary: 'Kain can describe app-level features.',
      status: 'live',
      implemented: true,
    },
    {
      id: 'kain.node.ffi',
      lane: 'ffi',
      label: 'Node FFI bridge',
      summary: 'Kain can call Node/native packages.',
      status: 'available-in-kain',
      implemented: false,
    },
  ],
  dispatch: [
    {
      namespace: 'greeblefs.kain',
      method: 'manifest',
      summary: 'Return Kain contributions.',
      consumedBy: 'src/runtime/kainManifest.ts',
    },
  ],
  generatedArtifacts: [
    {
      id: 'kain.plugin.proof',
      kind: 'plugin-manifest',
      source: 'plugin_authoring.kn',
      target: 'generated/plugin-proof.json',
      status: 'proof',
    },
  ],
  settingsSchemas: [
    {
      id: 'greeblefs.kain.ui',
      label: 'Kain UI Settings',
      source: 'src-kain/app/main.kn',
      consumer: 'Settings > Kain UI',
      status: 'live',
    },
  ],
  pipelines: [
    {
      id: 'kain.plugin.first-class',
      label: 'Plugin manifest generation',
      summary: 'Emit compatibility artifacts.',
      status: 'next',
    },
  ],
  ffiLanes: [
    {
      id: 'node',
      label: 'Node FFI',
      summary: 'Use npm-native tooling.',
      status: 'available-in-kain',
    },
  ],
  consumers: ['src/components/settings/sections/KainUiSettingsSection.tsx'],
};

const scaffold: KainUiScaffold = {
  schemaVersion: 1,
  kind: 'greeblefs.ui.scaffold',
  source: 'src-kain/app/main.kn',
  stdlib: 'src-kain/stdlib/greeblefs/ui.kn',
  renderer: 'src/components/kain/KainUiRenderer.tsx',
  summary: 'Kain-authored semantic UI scaffold.',
  surfaces: [
    {
      id: 'settings:kain-lattice-proof',
      kind: 'settings-module',
      title: 'Lattice Shell Control',
      summary: 'Kain can define UI.',
      source: 'src-kain/lattice/greeblefs-shell-control/main.kn',
      packageId: 'greeblefs.lattice.shell-control',
      componentId: 'ShellControlModule',
      mountId: 'settings:kain-lattice-proof',
      mountSlot: 'settings.kain-ui',
      order: 10,
      hostModels: ['host.kainBridge'],
      actions: ['kain.ui.reload'],
      root: {
        id: 'settings.kain-lattice.root',
        kind: 'stack',
        layout: { direction: 'column', gap: 'compact' },
        props: {},
        children: [
          {
            id: 'settings.kain-lattice.module',
            kind: 'section',
            title: 'Lattice Shell Control',
            description: 'Semantic UI is coming from Kain.',
            layout: {},
            props: {},
            children: [
              {
                id: 'settings.kain-lattice.renderer',
                kind: 'row',
                title: 'Renderer',
                description: 'Maps Kain nodes onto existing primitives.',
                layout: {},
                props: {},
                children: [
                  {
                    id: 'settings.kain-lattice.renderer.pill',
                    kind: 'status-pill',
                    label: 'wired',
                    tone: 'live',
                    active: true,
                    layout: {},
                    props: {},
                    children: [],
                  },
                ],
              },
            ],
          },
        ],
      },
    },
    {
      id: 'applet:kain-runtime-status',
      kind: 'shell-applet',
      title: 'Kain Runtime',
      summary: 'Compact applet.',
      source: 'src-kain/lattice/greeblefs-shell-control/main.kn',
      packageId: 'greeblefs.lattice.shell-control',
      componentId: 'RuntimeStatusApplet',
      mountId: 'applet:kain-runtime-status',
      mountSlot: 'workbench.topbar.trailing',
      order: 20,
      hostModels: ['host.kainBridge'],
      actions: ['kain.ui.reload'],
      root: {
        id: 'applet.kain-runtime.root',
        kind: 'applet',
        layout: {},
        props: {},
        children: [],
      },
    },
  ],
  primitives: [
    { kind: 'section', mapsTo: 'SettingsSectionBlock', status: 'wired' },
    { kind: 'row', mapsTo: 'SettingsRow', status: 'wired' },
    { kind: 'shell-applet', mapsTo: 'KainSemanticAppletStrip', status: 'wired' },
  ],
  tokens: [
    {
      id: 'surface.settings.gap.compact',
      category: 'spacing',
      value: 'compact',
      mapsTo: 'Settings row spacing',
    },
  ],
  actions: [
    {
      id: 'kain.ui.reload',
      label: 'Reload Kain UI',
      command: 'tauron.kain.reload',
      status: 'planned',
    },
  ],
  consumers: ['src/components/kain/KainUiRenderer.tsx'],
};

const latticeCatalog: KainLatticeCatalog = {
  schemaVersion: 1,
  kind: 'greeblefs.lattice.catalog',
  name: 'Kain Lattice',
  source: 'src-kain/app/main.kn',
  stdlib: 'src-kain/stdlib/greeblefs/lattice.kn',
  packageRoot: 'src-kain/lattice',
  summary: 'QML-like Kain authoring system.',
  analogy: {
    reference: 'reference/plasma-desktop-master',
    qmlLike: 'Kain components declare properties and bindings.',
    nativeModelLike: 'Rust exposes host objects.',
    packageLike: 'Lattice packages map to applets and settings modules.',
  },
  imports: [
    { id: 'gfs.shell', label: 'Shell', mapsTo: 'panels', status: 'planned' },
  ],
  primitives: [
    { id: 'component', qmlAnalogy: 'QML component', summary: 'Declarative object.', status: 'reference' },
    { id: 'action', qmlAnalogy: 'PlasmaCore.Action', summary: 'Host command.', status: 'planned' },
  ],
  hostObjects: [
    { id: 'host.kainBridge', provider: 'Tauron', summary: 'Kain bridge.', status: 'live' },
  ],
  packages: [
    {
      id: 'greeblefs.lattice.shell-control',
      kind: 'shell-package',
      title: 'Shell Control',
      summary: 'Reference Kain Lattice package.',
      packagePath: 'src-kain/lattice/greeblefs-shell-control',
      entry: 'src-kain/lattice/greeblefs-shell-control/main.kn',
      metadata: 'src-kain/lattice/greeblefs-shell-control/lattice.toml',
      imports: ['gfs.shell'],
      surfaces: ['settings:kain-lattice-proof', 'applet:kain-runtime-status'],
      hostModels: ['host.kainBridge'],
      actions: ['kain.ui.reload'],
      permissions: ['kain.reload'],
      configSchema: { status: 'reference' },
    },
  ],
  milestones: [
    { id: 'lattice.catalog', label: 'Catalog', summary: 'Expose the catalog.', status: 'live' },
    { id: 'lattice.settings-module', label: 'Settings Module', summary: 'Render one KCM-style module.', status: 'live' },
    { id: 'lattice.applet', label: 'Applet', summary: 'Render one shell applet.', status: 'live' },
  ],
  consumers: ['src/runtime/kainLatticeCatalog.ts'],
};

const ffiCatalog: KainFfiCatalog = {
  schemaVersion: 1,
  kind: 'greeblefs.ffi.catalog',
  name: 'Kain FFI',
  source: 'src-kain/app/main.kn',
  registry: 'src-kain/ffi/registry.kn',
  root: 'src-kain/ffi',
  summary: 'Kain-owned cross-language bridge map.',
  lanes: [
    {
      id: 'python',
      label: 'Python FFI',
      kind: 'python-sidecar',
      sourcePath: 'src-kain/ffi/python',
      hostPath: 'src-python/greeblefs_sidecar/actions.py:kain.ffi.catalog',
      bridge: 'GreebleFS Python sidecar + Kain Python FFI',
      status: 'sidecar-hooked',
      implemented: true,
      summary: 'Python analysis lane.',
      nextAction: 'Build analyzer.',
    },
    {
      id: 'node',
      label: 'Node FFI',
      kind: 'node-ffi',
      sourcePath: 'src-kain/ffi/node',
      hostPath: 'Node/native npm packages',
      bridge: 'Kain Node FFI',
      status: 'scaffold',
      implemented: false,
      summary: 'Node package lane.',
      nextAction: 'Expose a Node-backed analyzer.',
    },
  ],
  analysisPipelines: ['ts-frontend-ui-inventory'],
  consumers: ['src/runtime/kainFfiCatalog.ts'],
};

const pluginCatalog: KainPluginCatalog = {
  schemaVersion: 1,
  kind: 'greeblefs.kain.plugin.catalog',
  source: 'src-kain/plugins/registry.kn',
  root: 'usr/plugins-kain',
  stdlib: 'src-kain/plugins/stdlib/greeblefs/plugin.kn',
  host: 'src/runtime/kainPluginCatalog.ts',
  summary: 'Parallel Kain-native plugin catalog.',
  plugins: [
    {
      id: 'kain-workbench-smoke',
      name: 'Kain Workbench Smoke',
      version: '0.1.0',
      description: 'First Kain-native plugin package.',
      category: 'Kain Plugins',
      source: 'usr/plugins-kain/kain-workbench-smoke/plugin.kn',
      directory: 'usr/plugins-kain/kain-workbench-smoke',
      manifestPath: 'usr/plugins-kain/kain-workbench-smoke/plugin.kn',
      status: 'live',
      tags: ['kain', 'ffi'],
      permissions: [],
      ffiCapabilities: [
        {
          id: 'python.pipeline',
          label: 'Python FFI pipeline',
          lane: 'python',
          summary: 'Python analysis.',
          status: 'declared',
          required: true,
        },
        {
          id: 'cargo.pipeline',
          label: 'Cargo FFI pipeline',
          lane: 'cargo-ffi',
          summary: 'Cargo analysis.',
          status: 'declared',
          required: false,
        },
      ],
      runtimes: [],
      tools: [],
      hostUiKit: {
        id: 'greeblefs.workbench-kit',
        label: 'GreebleFS Workbench Kit',
        version: '0.1.0',
        status: 'live',
        summary: 'Trusted host UI controls for Kain plugins.',
        primitives: ['path-input', 'action-strip'],
        tokens: ['density.compact'],
        components: [
          {
            id: 'smoke-shell',
            kind: 'tool-shell',
            label: 'Smoke Shell',
            role: 'workbench',
            surface: 'workbench',
            density: 'compact',
            status: 'live',
            summary: 'Workbench shell.',
            primitives: ['action-strip'],
            actions: ['kain.plugin.inspect'],
            bindings: ['host.plugins'],
          },
        ],
      },
      hostUiComponents: [],
      workbenches: [
        {
          id: 'kain-workbench-smoke.main',
          title: 'Kain Workbench Smoke',
          summary: 'Workbench proof.',
          kind: 'workbench',
          mountSlot: 'workbench.panels',
          order: 20,
          rendererKind: 'kain-host',
          defaultOpen: false,
          hostModels: ['host.plugins'],
          actions: ['kain.plugin.inspect'],
          ffiLanes: ['python', 'cargo-ffi'],
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
          ffiLanes: ['python', 'cargo-ffi'],
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
          ffiLanes: ['python'],
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
      authoring: null,
      contracts: [],
      pipelineStages: [],
      fabricPipelines: [
        {
          id: 'smoke-fabric',
          label: 'Smoke Fabric',
          manifestPath: 'usr/plugins-kain/kain-workbench-smoke/KAIN.fabric.toml',
          workspaceRoot: '.',
          reportDirectory: '.kain/fabric/reports',
          status: 'declared',
          summary: 'Multi-FFI smoke pipeline.',
          eventStream: true,
          runtimes: ['kain', 'python'],
          ffiLanes: ['python', 'cargo-ffi'],
          requiredCapabilities: ['runtime.kain', 'runtime.python'],
          outputContracts: ['value'],
          steps: [
            {
              id: 'kain-probe',
              label: 'Kain Probe',
              runtime: 'kain',
              entry: 'plugin.kn',
              status: 'declared',
              summary: 'Catalog probe.',
              dependsOn: [],
              requires: ['runtime.kain'],
              outputs: [{ name: 'catalog', kind: 'value' }],
            },
          ],
        },
      ],
    },
  ],
  consumers: ['src/runtime/kainPluginCatalog.ts'],
};

describe('KainUiSettingsSection', () => {
  it('renders live Kain manifest, UI scaffold, Lattice, and FFI proof hooks', () => {
    const onApplyThemeSelection = vi.fn();
    const { container } = render(
      <KainUiSettingsSection
        graph={graph}
        error={null}
        manifest={manifest}
        manifestError={null}
        scaffold={scaffold}
        scaffoldError={null}
        latticeCatalog={latticeCatalog}
        latticeCatalogError={null}
        ffiCatalog={ffiCatalog}
        ffiCatalogError={null}
        pluginCatalog={pluginCatalog}
        pluginCatalogError={null}
        activeThemeId="pilot-dark"
        onApplyThemeSelection={onApplyThemeSelection}
      />,
    );

    const proof = container.querySelector('[data-kain-manifest-proof]');
    expect(proof).toHaveAttribute('data-kain-manifest-proof', 'live');
    expect(proof).toHaveAttribute('data-kain-manifest-kind', 'greeblefs.kain.manifest');
    expect(proof).toHaveAttribute('data-kain-manifest-capabilities', '2');
    expect(proof).toHaveAttribute('data-kain-ui-scaffold-proof', 'live');
    expect(proof).toHaveAttribute('data-kain-ui-scaffold-surfaces', '2');
    expect(proof).toHaveAttribute('data-kain-ui-scaffold-primitives', '3');
    expect(proof).toHaveAttribute('data-kain-lattice-proof', 'live');
    expect(proof).toHaveAttribute('data-kain-lattice-packages', '1');
    expect(proof).toHaveAttribute('data-kain-lattice-host-objects', '1');
    expect(proof).toHaveAttribute('data-kain-ffi-proof', 'live');
    expect(proof).toHaveAttribute('data-kain-ffi-lanes', '2');
    expect(proof).toHaveAttribute('data-kain-ffi-python', 'sidecar-hooked');
    expect(proof).toHaveAttribute('data-kain-plugin-catalog-proof', 'live');
    expect(proof).toHaveAttribute('data-kain-plugin-count', '1');
    expect(proof).toHaveAttribute('data-kain-plugin-preview-workbenches', '1');
    expect(proof).toHaveAttribute('data-kain-plugin-tools', '0');
    expect(proof).toHaveAttribute('data-kain-plugin-ffi-capabilities', '2');
    expect(proof).toHaveAttribute('data-kain-plugin-wasm-targets', '1');
    expect(proof).toHaveAttribute('data-kain-plugin-cargo-ffi-targets', '1');
    expect(proof).toHaveAttribute('data-kain-plugin-host-ui-components', '1');
    expect(proof).toHaveAttribute('data-kain-plugin-fabric-pipelines', '1');
    expect(proof).toHaveAttribute('data-kain-plugin-fabric-steps', '1');
    expect(proof).toHaveAttribute('data-kain-authored-theme-count', '1');
    expect(proof).toHaveAttribute('data-kain-authored-theme-selected', 'none');
    expect(proof).toHaveAttribute('data-kain-semantic-surface-count', '2');
    expect(proof).toHaveAttribute('data-kain-semantic-preview-surface', 'settings:kain-lattice-proof');
    expect(proof).toHaveAttribute('data-kain-semantic-settings-modules', '1');
    expect(proof).toHaveAttribute('data-kain-semantic-topbar-applets', '1');
    expect(container.querySelector('[data-kain-semantic-surface-host]')).toHaveAttribute('data-kain-semantic-package', 'greeblefs.lattice.shell-control');
    expect(screen.getByText('Kain Manifest')).toBeInTheDocument();
    expect(screen.getByText('Kain UI Scaffold')).toBeInTheDocument();
    expect(screen.getByText('Kain Lattice')).toBeInTheDocument();
    expect(screen.getByText('Kain FFI')).toBeInTheDocument();
    expect(screen.getByText('Kain Plugins')).toBeInTheDocument();
    expect(screen.getByText('Kain Authored Themes')).toBeInTheDocument();
    expect(screen.getByText('Ion Lattice')).toBeInTheDocument();
    expect(screen.getByText(/QML-like Kain authoring system/)).toBeInTheDocument();
    expect(screen.getByText(/Kain-owned cross-language bridge map/)).toBeInTheDocument();
    expect(screen.getAllByText('Lattice Shell Control').length).toBeGreaterThan(0);
    expect(screen.getByText('Semantic Host')).toBeInTheDocument();
    expect(screen.getByText('Shell Applets')).toBeInTheDocument();
    expect(screen.getByText(/Plugin manifest generation/)).toBeInTheDocument();
    expect(screen.getAllByText(/Node FFI/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Kain Workbench Smoke/).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: 'Select' }));
    expect(onApplyThemeSelection).toHaveBeenCalledWith('kain-ion-lattice');
  });
});
