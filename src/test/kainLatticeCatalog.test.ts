import { describe, expect, it } from 'vitest';
import { normalizeKainLatticeCatalog } from '../runtime/kainLatticeCatalog';

describe('normalizeKainLatticeCatalog', () => {
  it('keeps valid Kain Lattice catalog documents', () => {
    const catalog = normalizeKainLatticeCatalog({
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
      imports: [{ id: 'gfs.shell', label: 'Shell', mapsTo: 'panels', status: 'planned' }],
      primitives: [{ id: 'component', qmlAnalogy: 'QML component', summary: 'Object graph.', status: 'reference' }],
      hostObjects: [{ id: 'host.kainBridge', provider: 'Tauron', summary: 'Bridge status.', status: 'live' }],
      packages: [
        {
          id: 'greeblefs.lattice.shell-control',
          kind: 'settings-module',
          title: 'Shell Control',
          summary: 'Reference package.',
          packagePath: 'src-kain/lattice/greeblefs-shell-control',
          entry: 'main.kn',
          metadata: 'lattice.toml',
          imports: ['gfs.shell'],
          surfaces: ['settings:kain-lattice-proof'],
          hostModels: ['host.kainBridge'],
          actions: ['kain.ui.reload'],
          permissions: ['kain.reload'],
          configSchema: { status: 'reference' },
        },
      ],
      milestones: [{ id: 'lattice.catalog', label: 'Catalog', summary: 'Live.', status: 'live' }],
      consumers: ['src/runtime/kainLatticeCatalog.ts'],
    });

    expect(catalog?.name).toBe('Kain Lattice');
    expect(catalog?.analogy.reference).toBe('reference/plasma-desktop-master');
    expect(catalog?.packages[0]?.id).toBe('greeblefs.lattice.shell-control');
    expect(catalog?.hostObjects[0]?.status).toBe('live');
  });

  it('rejects invalid Kain Lattice catalog documents', () => {
    expect(normalizeKainLatticeCatalog(null)).toBeNull();
    expect(normalizeKainLatticeCatalog({ schemaVersion: 1, kind: 'wrong' })).toBeNull();
    expect(normalizeKainLatticeCatalog({ schemaVersion: 0, kind: 'greeblefs.lattice.catalog' })).toBeNull();
  });
});
