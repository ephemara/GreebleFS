import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { KainUiSettingsSection } from '../components/settings/sections/KainUiSettingsSection';
import type { KainAppManifest } from '../runtime/kainManifest';
import type { KainLatticeCatalog } from '../runtime/kainLatticeCatalog';
import type { KainUiGraph } from '../runtime/kainUiGraph';
import type { KainUiScaffold } from '../runtime/kainUiScaffold';

const graph: KainUiGraph = {
  schemaVersion: 1,
  kind: 'greeblefs.ui.graph',
  source: 'src-kain/app/main.kn',
  theme: {
    activeThemeId: 'pilot-dark',
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
      id: 'settings.kain-authoring-proof',
      kind: 'settings-section',
      title: 'Kain UI Authoring Proof',
      summary: 'Kain can define UI.',
      root: {
        id: 'settings.kain-authoring.root',
        kind: 'stack',
        layout: { direction: 'column', gap: 'compact' },
        props: {},
        children: [
          {
            id: 'settings.kain-authoring.status',
            kind: 'section',
            title: 'Kain Authored Surface',
            description: 'Semantic UI is coming from Kain.',
            layout: {},
            props: {},
            children: [
              {
                id: 'settings.kain-authoring.renderer',
                kind: 'row',
                title: 'Renderer',
                description: 'Maps Kain nodes onto existing primitives.',
                layout: {},
                props: {},
                children: [
                  {
                    id: 'settings.kain-authoring.renderer.pill',
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

describe('KainUiSettingsSection', () => {
  it('renders live Kain manifest, UI scaffold, and Lattice proof hooks', () => {
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
    expect(screen.getByText('Kain Manifest')).toBeInTheDocument();
    expect(screen.getByText('Kain UI Scaffold')).toBeInTheDocument();
    expect(screen.getByText('Kain Lattice')).toBeInTheDocument();
    expect(screen.getByText(/QML-like Kain authoring system/)).toBeInTheDocument();
    expect(screen.getByText('Kain Authored Surface')).toBeInTheDocument();
    expect(screen.getByText(/Plugin manifest generation/)).toBeInTheDocument();
    expect(screen.getByText(/Node FFI/)).toBeInTheDocument();
  });
});
