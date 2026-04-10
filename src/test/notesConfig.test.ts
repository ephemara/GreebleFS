import { describe, expect, it } from 'vitest';
import {
  getManagedNoteCategoryDirectory,
  getManagedNotesRootDirectory,
  joinManagedNotePath,
} from '../config/notes';

describe('notes config', () => {
  it('stores notes under the managed notes root instead of a hardcoded Windows drive path', () => {
    expect(getManagedNotesRootDirectory()).toBe('notes');
    expect(getManagedNoteCategoryDirectory('notes')).toBe('notes/notes');
    expect(getManagedNoteCategoryDirectory('prompts')).toBe('notes/prompts');
  });

  it('joins note file paths with the active platform separator', () => {
    expect(joinManagedNotePath('notes/prompts', 'idea.md')).toBe('notes/prompts/idea.md');
  });
});
