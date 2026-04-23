import { describe, expect, it } from 'vitest';
import {
  allowsExplorerPickerMultipleSelection,
  buildExplorerPickerSavePath,
  normalizeSaveFileName,
  resolveExplorerPickerEntries,
  supportsCurrentDirectoryFallback,
} from '../components/explorer/explorerPickerState';
import { createExplorerPickerRequest } from '../runtime/explorerPicker';

describe('explorer picker state helpers', () => {
  it('falls back to the current folder when folder selection is empty', () => {
    const request = createExplorerPickerRequest({
      kind: 'openFolders',
      presentation: 'embedded',
    });

    expect(resolveExplorerPickerEntries({
      currentPath: 'C:\\workspace\\repo\\nested',
      hasAnySelection: false,
      request,
      selectedEntries: [],
    })).toEqual([
      {
        kind: 'folder',
        name: 'nested',
        path: 'C:\\workspace\\repo\\nested',
      },
    ]);
  });

  it('does not fall back to the current folder when the user selected only files', () => {
    const request = createExplorerPickerRequest({
      kind: 'openFolders',
      presentation: 'embedded',
    });

    expect(resolveExplorerPickerEntries({
      currentPath: 'C:\\workspace\\repo\\nested',
      hasAnySelection: true,
      request,
      selectedEntries: [],
    })).toEqual([]);
  });

  it('filters file selections by extension and truncates single-file requests', () => {
    const request = createExplorerPickerRequest({
      kind: 'openFile',
      presentation: 'embedded',
      allowedExtensions: ['txt'],
    });

    expect(resolveExplorerPickerEntries({
      currentPath: 'C:\\workspace\\repo',
      hasAnySelection: true,
      request,
      selectedEntries: [
        { path: 'C:\\workspace\\repo\\one.md', name: 'one.md', isDirectory: false },
        { path: 'C:\\workspace\\repo\\two.txt', name: 'two.txt', isDirectory: false },
        { path: 'C:\\workspace\\repo\\three.txt', name: 'three.txt', isDirectory: false },
      ],
    })).toEqual([
      {
        kind: 'file',
        name: 'two.txt',
        path: 'C:\\workspace\\repo\\two.txt',
      },
    ]);
  });

  it('builds save targets and appends the default extension when needed', () => {
    expect(normalizeSaveFileName('report', 'txt')).toBe('report.txt');
    expect(buildExplorerPickerSavePath({
      currentPath: 'C:\\workspace\\repo',
      fileName: 'report',
      defaultExtension: 'txt',
    })).toBe('C:\\workspace\\repo\\report.txt');
  });

  it('reports picker capability flags by kind', () => {
    expect(allowsExplorerPickerMultipleSelection('openFolders')).toBe(true);
    expect(allowsExplorerPickerMultipleSelection('openFile')).toBe(false);
    expect(supportsCurrentDirectoryFallback('pickDestinationFolder')).toBe(true);
    expect(supportsCurrentDirectoryFallback('openFile')).toBe(false);
  });
});
