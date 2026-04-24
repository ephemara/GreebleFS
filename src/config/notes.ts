import { getManagedContentDirectory } from './appContentDirectories';
import { joinPlatformPath } from './platform';

export const notesWorkspaceConfig = {
  defaultDirectoryName: 'New Folder',
  defaultDocumentTitle: 'Untitled Note',
  documentFileExtension: 'md',
  supportedDocumentExtensions: ['md', 'markdown', 'mdx'],
} as const;

export type NotesDocumentExtension = typeof notesWorkspaceConfig.supportedDocumentExtensions[number];

export function getManagedNotesRootDirectory(): string {
  return getManagedContentDirectory('notes');
}

export function joinManagedNotesPath(basePath: string, segment: string): string {
  return joinPlatformPath(basePath, segment);
}

export function isManagedNotesDocumentFileName(fileName: string): boolean {
  const extension = fileName.split('.').pop()?.trim().toLowerCase() ?? '';
  return notesWorkspaceConfig.supportedDocumentExtensions.includes(extension as NotesDocumentExtension);
}
