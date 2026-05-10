import { afterEach, describe, expect, it } from 'vitest';
import {
  applyUsrExplorerRailTreeManifest,
  getExplorerRailTreeManifest,
  getExplorerRailTreeQuickAccessNodes,
  resolveExplorerRailTreeNodePath,
} from '../config/explorerRailTree';

const baselineExplorerRailTreeManifest = getExplorerRailTreeManifest();

afterEach(() => {
  applyUsrExplorerRailTreeManifest(baselineExplorerRailTreeManifest);
});

describe('explorerRailTree', () => {
  it('ships a data-authored Libraries root with home-relative children', () => {
    const quickAccessNodes = getExplorerRailTreeQuickAccessNodes('windows');
    const libraries = quickAccessNodes.find((node) => node.id === 'libraries');
    expect(libraries?.label).toBe('Libraries');
    expect(libraries?.children.map((child) => child.label)).toEqual(
      expect.arrayContaining(['Documents', 'Downloads', 'Pictures', 'Music', 'Videos']),
    );

    const documents = libraries?.children.find((child) => child.id === 'library-documents');
    expect(documents).toBeTruthy();
    expect(resolveExplorerRailTreeNodePath(documents!, {
      homeDir: 'C:\\Users\\Alex',
      platform: 'windows',
    })).toBe('C:\\Users\\Alex\\Documents');
  });

  it('lets profile manifests replace the quick access root order without JSX changes', () => {
    applyUsrExplorerRailTreeManifest({
      version: 1,
      id: 'test-rail-tree',
      name: 'Test Rail Tree',
      quickAccessNodes: [
        {
          id: 'assets',
          kind: 'path',
          path: 'D:\\Assets',
          label: 'Assets',
          icon: 'folder',
        },
        {
          id: 'home',
          kind: 'action',
          action: 'go-home',
          label: 'Home',
          icon: 'home',
        },
      ],
    });

    expect(getExplorerRailTreeQuickAccessNodes('windows').map((node) => node.id)).toEqual([
      'assets',
      'home',
    ]);
  });

  it('filters roots by platform before the side rail renders them', () => {
    const linuxRootIds = getExplorerRailTreeQuickAccessNodes('linux').map((node) => node.id);
    const windowsRootIds = getExplorerRailTreeQuickAccessNodes('windows').map((node) => node.id);

    expect(linuxRootIds).toContain('linux');
    expect(windowsRootIds).not.toContain('linux');
  });
});
