import { fireEvent, render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { KainSemanticSurfaceHost } from '../components/kain/KainSemanticSurfaceHost';
import type { KainLatticeCatalog } from '../runtime/kainLatticeCatalog';
import type { KainUiScaffold } from '../runtime/kainUiScaffold';

vi.mock('@/runtime/kainTauronBridge', () => ({
  reloadKainTauronBridge: vi.fn(async () => ({
    ok: true,
    reason: 'test',
    strategy: 'restart-runtime',
    manifestLoaded: true,
    schemaVersion: 1,
    runtime: { configured: true, enabled: true, running: true },
  })),
}));

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
      mountSlot: 'settings.kain-ui',
      order: 10,
      hostModels: ['host.kainBridge'],
      actions: ['kain.ui.reload'],
      root: {
        id: 'root',
        kind: 'row',
        title: 'Reload Bridge',
        description: 'Kain-authored action.',
        layout: {},
        props: {},
        children: [
          {
            id: 'reload',
            kind: 'button',
            label: 'reload',
            actionId: 'kain.ui.reload',
            layout: {},
            props: {},
            children: [],
          },
        ],
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
  summary: 'Catalog.',
  analogy: {
    reference: 'reference/plasma-desktop-master',
    qmlLike: 'components',
    nativeModelLike: 'host models',
    packageLike: 'packages',
  },
  imports: [],
  primitives: [],
  hostObjects: [],
  packages: [
    {
      id: 'greeblefs.lattice.shell-control',
      kind: 'shell-package',
      title: 'Shell Control',
      summary: 'Reference package.',
      packagePath: 'src-kain/lattice/greeblefs-shell-control',
      entry: 'src-kain/lattice/greeblefs-shell-control/main.kn',
      metadata: 'lattice.toml',
      imports: ['gfs.ui'],
      surfaces: ['settings:kain-lattice-proof'],
      hostModels: ['host.settings'],
      actions: ['settings.open'],
      permissions: ['kain.reload'],
      configSchema: {},
    },
  ],
  milestones: [],
  consumers: [],
};

describe('KainSemanticSurfaceHost', () => {
  it('mounts a Lattice semantic surface and runs trusted action handlers', async () => {
    const { container } = render(
      <KainSemanticSurfaceHost
        scaffold={scaffold}
        latticeCatalog={latticeCatalog}
        surfaceId="settings:kain-lattice-proof"
      />,
    );

    const host = container.querySelector('[data-kain-semantic-surface-host]');
    expect(host).toHaveAttribute('data-kain-semantic-package', 'greeblefs.lattice.shell-control');
    expect(host).toHaveAttribute('data-kain-semantic-mount-slot', 'settings.kain-ui');
    expect(host).toHaveAttribute('data-kain-semantic-order', '10');
    expect(host).toHaveAttribute('data-kain-semantic-host-models', '2');
    expect(host).toHaveAttribute('data-kain-semantic-actions', '2');

    const reloadButton = container.querySelector('[data-kain-action-id="kain.ui.reload"]');
    expect(reloadButton).not.toBeNull();
    fireEvent.click(reloadButton as HTMLElement);

    await waitFor(() => {
      expect(host).toHaveAttribute('data-kain-semantic-action-state', 'ok');
    });
  });
});
