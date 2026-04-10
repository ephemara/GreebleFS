import { getManagedContentDirectory } from './appContentDirectories';
import { joinPlatformPath } from './platform';

export const noteCategoryDirectoryNames = {
  notes: 'notes',
  todos: 'todos',
  bugs: 'bugs',
  prompts: 'prompts',
} as const;

export type ManagedNoteCategoryId = keyof typeof noteCategoryDirectoryNames;

export function getManagedNotesRootDirectory(): string {
  return getManagedContentDirectory('notes');
}

export function getManagedNoteCategoryDirectory(category: ManagedNoteCategoryId): string {
  return joinPlatformPath(getManagedNotesRootDirectory(), noteCategoryDirectoryNames[category]);
}

export function joinManagedNotePath(directory: string, fileName: string): string {
  return joinPlatformPath(directory, fileName);
}
