import { describe, expect, it } from 'vitest';
import {
  buildConstellationOrbitBands,
  type ConstellationOrbitBandInput,
} from '../components/explorer/constellationLayout';
import type { ExplorerFileEntry as FileEntry } from '../runtime/explorerBackend';

function makeEntry(index: number, overrides: Partial<FileEntry> = {}): FileEntry {
  return {
    name: `entry-${index}`,
    path: `C:\\workspace\\entry-${index}`,
    is_dir: false,
    size: 1024 + index,
    modified: 1_700_000_000_000 + index,
    extension: 'txt',
    is_hidden: false,
    is_symlink: false,
    ...overrides,
  };
}

describe('buildConstellationOrbitBands', () => {
  it('spreads dense dominant bands across the full orbit field instead of collapsing to one side', () => {
    const denseFolders = Array.from({ length: 18 }, (_, index) => makeEntry(index, {
      name: `app-${index}`,
      path: `C:\\workspace\\apps\\app-${index}`,
      is_dir: true,
      extension: '',
    }));

    const bands: ConstellationOrbitBandInput[] = [
      {
        id: 'folders',
        label: 'Folders',
        description: 'Anchors and destinations stay visually dominant.',
        dominant: true,
        entries: denseFolders,
      },
    ];

    const [orbitBand] = buildConstellationOrbitBands(bands, new Set(), 1);
    const xPositions = orbitBand.nodes.map((node) => node.x);
    const yPositions = orbitBand.nodes.map((node) => node.y);
    const leftCount = orbitBand.nodes.filter((node) => node.x < 50).length;
    const rightCount = orbitBand.nodes.filter((node) => node.x > 50).length;
    const nodesInsideCenterCard = orbitBand.nodes.filter((node) => (
      node.x > 40
      && node.x < 60
      && node.y > 35
      && node.y < 65
    ));

    expect(orbitBand.nodes).toHaveLength(18);
    expect(Math.min(...xPositions)).toBeLessThan(17);
    expect(Math.max(...xPositions)).toBeGreaterThan(84);
    expect(Math.max(...yPositions) - Math.min(...yPositions)).toBeGreaterThan(36);
    expect(Math.abs(leftCount - rightCount)).toBeLessThanOrEqual(2);
    expect(nodesInsideCenterCard).toHaveLength(0);
  });

  it('caps visible nodes by density and reports the hidden remainder', () => {
    const manyEntries = Array.from({ length: 40 }, (_, index) => makeEntry(index));
    const [orbitBand] = buildConstellationOrbitBands([
      {
        id: 'everything-else',
        label: 'Everything Else',
        description: 'Remaining files preserve the active explorer sort.',
        dominant: false,
        entries: manyEntries,
      },
    ], new Set(), 0);

    expect(orbitBand.nodes).toHaveLength(6);
    expect(orbitBand.hiddenEntryCount).toBe(34);
  });

  it('preserves selected emphasis while distributing entries', () => {
    const selectedEntry = makeEntry(1, { name: 'picked.txt', path: 'C:\\workspace\\picked.txt' });
    const [orbitBand] = buildConstellationOrbitBands([
      {
        id: 'recent',
        label: 'Recent Activity',
        description: 'Fresh work stays elevated without replacing the folder map.',
        dominant: false,
        entries: [
          makeEntry(0),
          selectedEntry,
          makeEntry(2, { name: 'folder', path: 'C:\\workspace\\folder', is_dir: true, extension: '' }),
        ],
      },
    ], new Set([selectedEntry.path]), 0.6);

    expect(orbitBand.nodes.find((node) => node.entry.path === selectedEntry.path)?.emphasis).toBe('selected');
  });
});
