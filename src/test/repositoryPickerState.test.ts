import { describe, expect, it } from 'vitest';
import {
  getRepositoryPickerConfirmLabel,
  resolveRepositoryPickerConfirmationPaths,
} from '../components/explorer/repositoryPickerState';

describe('repository picker state helpers', () => {
  it('falls back to the current folder when nothing is selected', () => {
    expect(resolveRepositoryPickerConfirmationPaths({
      allowMultiple: true,
      currentPath: 'C:\\workspace\\repo\\nested',
      hasAnySelection: false,
      selectedDirectoryPaths: [],
    })).toEqual(['C:\\workspace\\repo\\nested']);
  });

  it('does not fall back to the current folder when the user selected only files', () => {
    expect(resolveRepositoryPickerConfirmationPaths({
      allowMultiple: true,
      currentPath: 'C:\\workspace\\repo\\nested',
      hasAnySelection: true,
      selectedDirectoryPaths: [],
    })).toEqual([]);
  });

  it('deduplicates and trims selected directory paths before confirming them', () => {
    expect(resolveRepositoryPickerConfirmationPaths({
      allowMultiple: true,
      currentPath: 'C:\\workspace\\repo',
      hasAnySelection: true,
      selectedDirectoryPaths: [' C:\\workspace\\repo ', 'C:\\workspace\\repo', 'D:\\other'],
    })).toEqual(['C:\\workspace\\repo', 'D:\\other']);
  });

  it('describes whether the picker will add the current folder or selected folders', () => {
    expect(getRepositoryPickerConfirmLabel({
      allowMultiple: true,
      currentPath: 'C:\\workspace\\repo',
      hasAnySelection: false,
      selectedDirectoryCount: 0,
    })).toBe('Add Current Folder');

    expect(getRepositoryPickerConfirmLabel({
      allowMultiple: true,
      currentPath: 'C:\\workspace\\repo',
      hasAnySelection: true,
      selectedDirectoryCount: 2,
    })).toBe('Add 2 Folders');
  });

  it('keeps the confirm label singular when picker mode only allows one folder', () => {
    expect(getRepositoryPickerConfirmLabel({
      allowMultiple: false,
      currentPath: 'C:\\workspace\\repo',
      hasAnySelection: true,
      selectedDirectoryCount: 2,
    })).toBe('Add Selected Folder');
  });
});
