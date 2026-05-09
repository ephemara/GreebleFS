import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { KainUiSettingsSection } from '../components/settings/sections/KainUiSettingsSection';
import type { KainAppManifest } from '../runtime/kainManifest';
import type { KainFfiCatalog } from '../runtime/kainFfiCatalog';
import type { KainLatticeCatalog } from '../runtime/kainLatticeCatalog';
import type { KainUiGraph } from '../runtime/kainUiGraph';
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
  ],
  primitives: [
    { kind: 'section', mapsTo: 'SettingsSectionBlock', status: 'wired' },
    { kind: 'row', mapsTo: 'SettingsRow', status: 'wired' },
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
      kind: 'settings-module',
      title: 'Shell Control',
      summary: 'Reference Kain Lattice package.',
      packagePath: 'src-kain/lattice/greeblefs-shell-control',
      entry: 'src-kain/lattice/greeblefs-shell-control/main.kn',
      metadata: 'src-kain/lattice/greeblefs-shell-control/lattice.toml',
      imports: ['gfs.shell'],
      surfaces: ['settings:kain-lattice-proof'],
      hostModels: ['host.kainBridge'],
      actions: ['kain.ui.reload'],
      permissions: ['kain.reload'],
      configSchema: { status: 'reference' },
    },
  ],
  milestones: [
    { id: 'lattice.catalog', label: 'Catalog', summary: 'Expose the catalog.', status: 'live' },
    { id: 'lattice.settings-module', label: 'Settings Module', summary: 'Render one KCM-style module.', status: 'next' },
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
        activeThemeId="pilot-dark"
        onApplyThemeSelection={onApplyThemeSelection}
      />,
    );

    const proof = container.querySelector('[data-kain-manifest-proof]');
    expect(proof).toHaveAttribute('data-kain-manifest-proof', 'live');
    expect(proof).toHaveAttribute('data-kain-manifest-kind', 'greeblefs.kain.manifest');
    expect(proof).toHaveAttribute('data-kain-manifest-capabilities', '2');
    expect(proof).toHaveAttribute('data-kain-ui-scaffold-proof', 'live');
    expect(proof).toHaveAttribute('data-kain-ui-scaffold-surfaces', '1');
    expect(proof).toHaveAttribute('data-kain-ui-scaffold-primitives', '2');
    expect(proof).toHaveAttribute('data-kain-lattice-proof', 'live');
    expect(proof).toHaveAttribute('data-kain-lattice-packages', '1');
    expect(proof).toHaveAttribute('data-kain-lattice-host-objects', '1');
    expect(proof).toHaveAttribute('data-kain-ffi-proof', 'live');
    expect(proof).toHaveAttribute('data-kain-ffi-lanes', '2');
    expect(proof).toHaveAttribute('data-kain-ffi-python', 'sidecar-hooked');
    expect(proof).toHaveAttribute('data-kain-authored-theme-count', '1');
    expect(proof).toHaveAttribute('data-kain-authored-theme-selected', 'none');
    expect(proof).toHaveAttribute('data-kain-semantic-surface-count', '1');
    expect(proof).toHaveAttribute('data-kain-semantic-preview-surface', 'settings:kain-lattice-proof');
    expect(container.querySelector('[data-kain-semantic-surface-host]')).toHaveAttribute('data-kain-semantic-package', 'greeblefs.lattice.shell-control');
    expect(screen.getByText('Kain Manifest')).toBeInTheDocument();
    expect(screen.getByText('Kain UI Scaffold')).toBeInTheDocument();
    expect(screen.getByText('Kain Lattice')).toBeInTheDocument();
    expect(screen.getByText('Kain FFI')).toBeInTheDocument();
    expect(screen.getByText('Kain Authored Themes')).toBeInTheDocument();
    expect(screen.getByText('Ion Lattice')).toBeInTheDocument();
    expect(screen.getByText(/QML-like Kain authoring system/)).toBeInTheDocument();
    expect(screen.getByText(/Kain-owned cross-language bridge map/)).toBeInTheDocument();
    expect(screen.getAllByText('Lattice Shell Control').length).toBeGreaterThan(0);
    expect(screen.getByText('Semantic Host')).toBeInTheDocument();
    expect(screen.getByText(/Plugin manifest generation/)).toBeInTheDocument();
    expect(screen.getAllByText(/Node FFI/).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: 'Select' }));
    expect(onApplyThemeSelection).toHaveBeenCalledWith('kain-ion-lattice');
  });
});
