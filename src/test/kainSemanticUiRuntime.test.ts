import { describe, expect, it } from 'vitest';
import { buildKainSemanticUiRegistry, resolveKainSemanticUiSurface } from '../runtime/kainSemanticUiRuntime';
import type { KainLatticeCatalog } from '../runtime/kainLatticeCatalog';
import type { KainUiScaffold } from '../runtime/kainUiScaffold';

const scaffold: KainUiScaffold = {
  schemaVersion: 1,
  kind: 'greeblefs.ui.scaffold',
  source: 'src-kain/app/main.kn',
  stdlib: 'src-kain/stdlib/greeblefs/ui.kn',
  renderer: 'src/components/kain/KainUiRenderer.tsx',
  summary: 'Semantic scaffold.',
  surfaces: [
    {
      id: 'settings:kain-lattice-proof',
      kind: 'settings-module',
      title: 'Lattice Shell Control',
      summary: 'Mounted.',
      source: 'src-kain/lattice/greeblefs-shell-control/main.kn',
      packageId: 'greeblefs.lattice.shell-control',
      componentId: 'ShellControlModule',
      mountId: 'settings:kain-lattice-proof',
      hostModels: ['host.kainBridge'],
      actions: ['kain.ui.reload'],
      root: {
        id: 'root',
        kind: 'stack',
        layout: {},
        props: {},
        children: [],
      },
    },
  ],
  primitives: [],
  tokens: [],
  actions: [{ id: 'kain.ui.reload', label: 'Reload', command: 'tauron.kain.reload', status: 'wired' }],
  consumers: [],
};

const latticeCatalog: KainLatticeCatalog = {
  schemaVersion: 1,
  kind: 'greeblefs.lattice.catalog',
  name: 'Kain Lattice',
  source: 'src-kain/app/main.kn',
  stdlib: 'src-kain/stdlib/greeblefs/lattice.kn',
  packageRoot: 'src-kain/lattice',
  summary: 'QML-like package catalog.',
  analogy: {
    reference: 'reference/plasma-desktop-master',
    qmlLike: 'components',
    nativeModelLike: 'host models',
    packageLike: 'packages',
  },
  imports: [],
  primitives: [],
  hostObjects: [{ id: 'host.profile', provider: 'usr profile runtime', summary: 'Profiles.', status: 'planned' }],
  packages: [
    {
      id: 'greeblefs.lattice.shell-control',
      kind: 'settings-module',
      title: 'Shell Control',
      summary: 'Reference package.',
      packagePath: 'src-kain/lattice/greeblefs-shell-control',
      entry: 'src-kain/lattice/greeblefs-shell-control/main.kn',
      metadata: 'lattice.toml',
      imports: ['gfs.ui'],
      surfaces: ['settings:kain-lattice-proof'],
      hostModels: ['host.settings', 'host.profile'],
      actions: ['settings.open'],
      permissions: ['kain.reload'],
      configSchema: {},
    },
  ],
  milestones: [],
  consumers: [],
};

describe('kainSemanticUiRuntime', () => {
  it('builds a mounted semantic registry from scaffold and Lattice package data', () => {
    const registry = buildKainSemanticUiRegistry(scaffold, latticeCatalog);

    expect(registry.surfaces).toHaveLength(1);
    expect(registry.mounts[0]).toMatchObject({
      id: 'settings:kain-lattice-proof',
      packageId: 'greeblefs.lattice.shell-control',
      componentId: 'ShellControlModule',
      status: 'lattice-mounted',
    });
    expect(registry.mounts[0]?.hostModels).toEqual(['host.kainBridge', 'host.settings', 'host.profile']);
    expect(registry.mounts[0]?.actions).toEqual(['kain.ui.reload', 'settings.open']);
    expect(registry.actionsById['kain.ui.reload']?.status).toBe('wired');
    expect(registry.hostModelIds).toContain('host.profile');
  });

  it('resolves surfaces by surface, mount, or package id', () => {
    expect(resolveKainSemanticUiSurface(scaffold, latticeCatalog, {
      surfaceId: 'settings:kain-lattice-proof',
    }).surface?.title).toBe('Lattice Shell Control');
    expect(resolveKainSemanticUiSurface(scaffold, latticeCatalog, {
      mountId: 'settings:kain-lattice-proof',
    }).mount?.packageId).toBe('greeblefs.lattice.shell-control');
    expect(resolveKainSemanticUiSurface(scaffold, latticeCatalog, {
      packageId: 'greeblefs.lattice.shell-control',
    }).surface?.id).toBe('settings:kain-lattice-proof');
  });
});
