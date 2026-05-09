import { fireEvent, render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { KainSemanticAppletStrip } from '../components/kain/KainSemanticAppletStrip';
import type { KainLatticeCatalog } from '../runtime/kainLatticeCatalog';
import type { KainUiScaffold } from '../runtime/kainUiScaffold';

const { reloadMock } = vi.hoisted(() => ({
  reloadMock: vi.fn(async () => ({
    ok: true,
    reason: 'test',
    strategy: 'restart-runtime',
    manifestLoaded: true,
    schemaVersion: 1,
    runtime: { configured: true, enabled: true, running: true },
  })),
}));

vi.mock('@/runtime/kainTauronBridge', () => ({
  reloadKainTauronBridge: reloadMock,
}));

const appletNode = (id: string, label: string) => ({
  id: `${id}.root`,
  kind: 'applet',
  title: label,
  layout: {},
  props: { tooltip: `${label} runtime` },
  children: [
    {
      id: `${id}.indicator`,
      kind: 'indicator',
      label,
      tone: 'live',
      active: true,
      layout: {},
      props: {},
      children: [],
    },
    {
      id: `${id}.reload`,
      kind: 'icon-button',
      label: 'reload',
      actionId: 'kain.ui.reload',
      layout: {},
      props: {},
      children: [],
    },
  ],
});

const scaffold: KainUiScaffold = {
  schemaVersion: 1,
  kind: 'greeblefs.ui.scaffold',
  source: 'src-kain/app/main.kn',
  stdlib: 'src-kain/stdlib/greeblefs/ui.kn',
  renderer: 'src/components/kain/KainUiRenderer.tsx',
  summary: 'Semantic scaffold.',
  surfaces: [
    {
      id: 'applet:second',
      kind: 'shell-applet',
      title: 'Second',
      summary: 'Second applet.',
      source: 'src-kain/lattice/greeblefs-shell-control/main.kn',
      packageId: 'greeblefs.lattice.shell-control',
      componentId: 'RuntimeStatusApplet',
      mountId: 'applet:second',
      mountSlot: 'workbench.topbar.trailing',
      order: 20,
      hostModels: ['host.kainBridge'],
      actions: ['kain.ui.reload'],
      root: appletNode('second', 'Second'),
    },
    {
      id: 'applet:first',
      kind: 'shell-applet',
      title: 'First',
      summary: 'First applet.',
      source: 'src-kain/lattice/greeblefs-shell-control/main.kn',
      packageId: 'greeblefs.lattice.shell-control',
      componentId: 'RuntimeStatusApplet',
      mountId: 'applet:first',
      mountSlot: 'workbench.topbar.trailing',
      order: 10,
      hostModels: ['host.kainBridge'],
      actions: ['kain.ui.reload'],
      root: appletNode('first', 'First'),
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
      surfaces: ['applet:first', 'applet:second'],
      hostModels: ['host.profile'],
      actions: ['settings.open'],
      permissions: ['kain.reload'],
      configSchema: {},
    },
  ],
  milestones: [],
  consumers: [],
};

describe('KainSemanticAppletStrip', () => {
  it('renders ordered top-bar applets and runs trusted reload actions', async () => {
    reloadMock.mockClear();
    const { container } = render(
      <KainSemanticAppletStrip
        scaffold={scaffold}
        latticeCatalog={latticeCatalog}
      />,
    );

    const strip = container.querySelector('[data-kain-semantic-applet-strip]');
    expect(strip).toHaveAttribute('data-kain-semantic-applet-count', '2');
    expect(strip).toHaveAttribute('data-kain-semantic-applet-packages', 'greeblefs.lattice.shell-control|greeblefs.lattice.shell-control');

    const mountedSurfaces = Array.from(container.querySelectorAll('[data-kain-semantic-surface]'))
      .map((node) => node.getAttribute('data-kain-semantic-surface'));
    expect(mountedSurfaces).toEqual(['applet:first', 'applet:second']);

    const reloadButton = container.querySelector('[data-kain-action-id="kain.ui.reload"]');
    expect(reloadButton).toHaveAttribute('data-kain-action-enabled', 'true');
    fireEvent.click(reloadButton as HTMLElement);

    await waitFor(() => expect(reloadMock).toHaveBeenCalledTimes(1));
  });
});
