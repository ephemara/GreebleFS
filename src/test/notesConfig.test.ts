import { describe, expect, it } from 'vitest';
import {
  getManagedNotesRootDirectory,
  isManagedNotesDocumentFileName,
  joinManagedNotesPath,
  notesWorkspaceConfig,
} from '../config/notes';

describe('notes config', () => {
  it('stores the notes workspace under the managed notes root instead of hardcoded category folders', () => {
    expect(getManagedNotesRootDirectory()).toBe('notes');
    expect(notesWorkspaceConfig.defaultDirectoryName).toBe('New Folder');
    expect(notesWorkspaceConfig.defaultDocumentTitle).toBe('Untitled Note');
  });

  it('joins workspace paths with the active platform separator', () => {
    expect(joinManagedNotesPath('notes/projects', 'ship-plan.md')).toBe('notes/projects/ship-plan.md');
  });

  it('recognizes the supported markdown note file names', () => {
    expect(isManagedNotesDocumentFileName('alpha.md')).toBe(true);
    expect(isManagedNotesDocumentFileName('alpha.markdown')).toBe(true);
    expect(isManagedNotesDocumentFileName('alpha.txt')).toBe(false);
  });
});
