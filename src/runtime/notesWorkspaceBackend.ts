import {
  createExplorerDir,
  deleteExplorerPath,
  listExplorerDir,
  readExplorerTextFile,
  renameExplorerPath,
  writeExplorerFile,
  type ExplorerFileEntry,
} from './explorerBackend';
import {
  getManagedNotesRootDirectory,
  isManagedNotesDocumentFileName,
  joinManagedNotesPath,
  notesWorkspaceConfig,
} from '../config/notes';

export interface NotesDirectoryRecord {
  path: string;
  name: string;
  parentPath: string | null;
  modifiedAt: number;
  directDocumentCount: number;
  recursiveDocumentCount: number;
  childDirectoryPaths: string[];
}

export interface NotesDocumentRecord {
  path: string;
  directoryPath: string;
  fileName: string;
  title: string;
  markdown: string;
  previewText: string;
  wordCount: number;
  modifiedAt: number;
  legacyTitleHint: string | null;
}

export interface NotesWorkspaceSnapshot {
  rootDirectoryPath: string;
  directories: NotesDirectoryRecord[];
  documents: NotesDocumentRecord[];
}

interface NotesPathRecord {
  name: string;
  path: string;
}

const WINDOWS_RESERVED_PATH_SEGMENTS = new Set([
  'CON',
  'PRN',
  'AUX',
  'NUL',
  'COM1',
  'COM2',
  'COM3',
  'COM4',
  'COM5',
  'COM6',
  'COM7',
  'COM8',
  'COM9',
  'LPT1',
  'LPT2',
  'LPT3',
  'LPT4',
  'LPT5',
  'LPT6',
  'LPT7',
  'LPT8',
  'LPT9',
]);

export async function ensureNotesWorkspaceRoot(): Promise<string> {
  const rootDirectoryPath = getManagedNotesRootDirectory();

  try {
    await listExplorerDir(rootDirectoryPath, false);
  } catch {
    await createExplorerDir(rootDirectoryPath);
  }

  return rootDirectoryPath;
}

export async function loadNotesWorkspaceSnapshot(): Promise<NotesWorkspaceSnapshot> {
  const rootDirectoryPath = await ensureNotesWorkspaceRoot();
  const { directories, documents } = await scanNotesDirectoryTree(rootDirectoryPath, null);

  return {
    rootDirectoryPath,
    directories,
    documents,
  };
}

export async function createNotesDirectory(parentDirectoryPath: string, desiredName?: string): Promise<string> {
  const directoryPath = await createUniqueDirectoryPath(
    parentDirectoryPath,
    desiredName ?? notesWorkspaceConfig.defaultDirectoryName,
  );
  await createExplorerDir(directoryPath);
  return directoryPath;
}

export async function renameNotesDirectory(directoryPath: string, desiredName: string): Promise<string> {
  const parentDirectoryPath = getParentPath(directoryPath);
  const normalizedName = sanitizePathSegment(
    desiredName,
    notesWorkspaceConfig.defaultDirectoryName,
  );
  const nextDirectoryPath = await createUniquePathCandidate(
    parentDirectoryPath,
    normalizedName,
    await listDirectoryPathRecords(parentDirectoryPath, 'directory'),
    getLeafName(directoryPath),
  );

  if (nextDirectoryPath === directoryPath) {
    return directoryPath;
  }

  await renameExplorerPath(directoryPath, nextDirectoryPath);
  return nextDirectoryPath;
}

export async function deleteNotesDirectory(directoryPath: string): Promise<void> {
  await deleteExplorerPath(directoryPath, true);
}

export async function createNotesDocument(directoryPath: string, desiredTitle?: string): Promise<string> {
  const rootDirectoryPath = await ensureNotesWorkspaceRoot();
  const targetDirectoryPath = directoryPath || rootDirectoryPath;
  const documentPath = await createUniqueDocumentPath(
    targetDirectoryPath,
    desiredTitle ?? notesWorkspaceConfig.defaultDocumentTitle,
  );
  await writeExplorerFile(documentPath, '');
  return documentPath;
}

export async function saveNotesDocument(documentPath: string, markdown: string): Promise<void> {
  await writeExplorerFile(documentPath, markdown);
}

export async function renameNotesDocument(documentPath: string, desiredTitle: string): Promise<string> {
  const directoryPath = getParentPath(documentPath);
  const documentExtension = getExtensionWithDot(documentPath) || `.${notesWorkspaceConfig.documentFileExtension}`;
  const normalizedTitle = sanitizePathSegment(
    desiredTitle,
    notesWorkspaceConfig.defaultDocumentTitle,
  );
  const existingRecords = await listDirectoryPathRecords(directoryPath, 'document');
  const nextDocumentPath = await createUniquePathCandidate(
    directoryPath,
    `${normalizedTitle}${documentExtension}`,
    existingRecords,
    getLeafName(documentPath),
  );

  if (nextDocumentPath === documentPath) {
    return documentPath;
  }

  await renameExplorerPath(documentPath, nextDocumentPath);
  return nextDocumentPath;
}

export async function deleteNotesDocument(documentPath: string): Promise<void> {
  await deleteExplorerPath(documentPath, false);
}

export async function readNotesDocumentMarkdown(documentPath: string): Promise<string> {
  const rawMarkdown = await readExplorerTextFile(documentPath);
  return normalizeLegacyNotesDocument(rawMarkdown).markdown;
}

async function scanNotesDirectoryTree(
  directoryPath: string,
  parentPath: string | null,
): Promise<{ directories: NotesDirectoryRecord[]; documents: NotesDocumentRecord[] }> {
  const entries = await listExplorerDir(directoryPath, false);
  const childDirectories = entries
    .filter((entry) => entry.is_dir)
    .sort(compareEntriesByName);
  const documentEntries = entries
    .filter((entry) => !entry.is_dir && isManagedNotesDocumentFileName(entry.name))
    .sort(compareEntriesByName);

  const documents = await Promise.all(documentEntries.map(toNotesDocumentRecord));
  const childResults = await Promise.all(
    childDirectories.map((entry) => scanNotesDirectoryTree(entry.path, directoryPath)),
  );

  const flattenedDirectories = childResults.flatMap((result) => result.directories);
  const flattenedDocuments = childResults.flatMap((result) => result.documents);
  const recursiveDocumentCount =
    documents.length
    + childResults.reduce((count, result) => count + result.documents.length, 0);

  const currentDirectoryRecord: NotesDirectoryRecord = {
    path: directoryPath,
    name: parentPath ? getLeafName(directoryPath) : 'Notes',
    parentPath,
    modifiedAt: Math.max(0, ...entries.map((entry) => entry.modified)),
    directDocumentCount: documents.length,
    recursiveDocumentCount,
    childDirectoryPaths: childDirectories.map((entry) => entry.path),
  };

  return {
    directories: [currentDirectoryRecord, ...flattenedDirectories],
    documents: [...documents, ...flattenedDocuments],
  };
}

async function toNotesDocumentRecord(entry: ExplorerFileEntry): Promise<NotesDocumentRecord> {
  const rawMarkdown = await readExplorerTextFile(entry.path);
  const normalizedDocument = normalizeLegacyNotesDocument(rawMarkdown);
  const title = normalizedDocument.legacyTitleHint
    ?? createDisplayTitleFromFileName(entry.name);

  return {
    path: entry.path,
    directoryPath: getParentPath(entry.path),
    fileName: entry.name,
    title,
    markdown: normalizedDocument.markdown,
    previewText: createNotesPreviewText(normalizedDocument.markdown),
    wordCount: countMarkdownWords(normalizedDocument.markdown),
    modifiedAt: entry.modified,
    legacyTitleHint: normalizedDocument.legacyTitleHint,
  };
}

async function createUniqueDirectoryPath(parentDirectoryPath: string, desiredName: string): Promise<string> {
  const existingRecords = await listDirectoryPathRecords(parentDirectoryPath, 'directory');
  const normalizedName = sanitizePathSegment(
    desiredName,
    notesWorkspaceConfig.defaultDirectoryName,
  );

  return createUniquePathCandidate(parentDirectoryPath, normalizedName, existingRecords);
}

async function createUniqueDocumentPath(parentDirectoryPath: string, desiredTitle: string): Promise<string> {
  const existingRecords = await listDirectoryPathRecords(parentDirectoryPath, 'document');
  const normalizedTitle = sanitizePathSegment(
    desiredTitle,
    notesWorkspaceConfig.defaultDocumentTitle,
  );

  return createUniquePathCandidate(
    parentDirectoryPath,
    `${normalizedTitle}.${notesWorkspaceConfig.documentFileExtension}`,
    existingRecords,
  );
}

async function createUniquePathCandidate(
  parentDirectoryPath: string,
  desiredLeafName: string,
  existingRecords: NotesPathRecord[],
  currentLeafName?: string,
): Promise<string> {
  const { stem, extension } = splitFileName(desiredLeafName);
  const baseName = sanitizePathSegment(
    stem,
    notesWorkspaceConfig.defaultDocumentTitle,
  );
  const normalizedCurrentLeafName = currentLeafName?.trim().toLowerCase() ?? null;
  const takenNames = new Set(
    existingRecords
      .map((record) => record.name.trim().toLowerCase())
      .filter((recordName) => recordName !== normalizedCurrentLeafName),
  );

  let suffix = 1;
  while (true) {
    const candidateName = suffix === 1
      ? `${baseName}${extension}`
      : `${baseName} ${suffix}${extension}`;
    const normalizedCandidateName = candidateName.trim().toLowerCase();

    if (!takenNames.has(normalizedCandidateName)) {
      return joinManagedNotesPath(parentDirectoryPath, candidateName);
    }

    suffix += 1;
  }
}

async function listDirectoryPathRecords(
  directoryPath: string,
  kind: 'directory' | 'document',
): Promise<NotesPathRecord[]> {
  const entries = await listExplorerDir(directoryPath, false);
  return entries
    .filter((entry) => {
      if (kind === 'directory') {
        return entry.is_dir;
      }
      return !entry.is_dir && isManagedNotesDocumentFileName(entry.name);
    })
    .map((entry) => ({
      name: entry.name,
      path: entry.path,
    }));
}

function normalizeLegacyNotesDocument(rawMarkdown: string): {
  markdown: string;
  legacyTitleHint: string | null;
} {
  const legacyDocumentMatch = rawMarkdown.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);

  if (!legacyDocumentMatch) {
    return {
      markdown: rawMarkdown,
      legacyTitleHint: null,
    };
  }

  try {
    const metadata = JSON.parse(legacyDocumentMatch[1]) as { title?: unknown };
    return {
      markdown: legacyDocumentMatch[2],
      legacyTitleHint: typeof metadata.title === 'string' && metadata.title.trim().length > 0
        ? metadata.title.trim()
        : null,
    };
  } catch {
    return {
      markdown: rawMarkdown,
      legacyTitleHint: null,
    };
  }
}

function createDisplayTitleFromFileName(fileName: string): string {
  const { stem } = splitFileName(fileName);
  return stem.trim().length > 0 ? stem : notesWorkspaceConfig.defaultDocumentTitle;
}

function createNotesPreviewText(markdown: string): string {
  const normalized = markdown
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^>\s?/gm, '')
    .replace(/^[-+*]\s+\[[ xX]\]\s+/gm, '')
    .replace(/^[-+*]\s+/gm, '')
    .replace(/^\d+\.\s+/gm, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/~~([^~]+)~~/g, '$1')
    .replace(/\+\+([^+]+)\+\+/g, '$1')
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\|/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return normalized.slice(0, 180);
}

function countMarkdownWords(markdown: string): number {
  const text = createNotesPreviewText(markdown);
  return text.length === 0 ? 0 : text.split(/\s+/).filter(Boolean).length;
}

function sanitizePathSegment(input: string, fallback: string): string {
  const normalizedInput = input
    .normalize('NFKC')
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/[. ]+$/g, '')
    .trim();

  const nextValue = normalizedInput.length > 0 ? normalizedInput : fallback;
  return WINDOWS_RESERVED_PATH_SEGMENTS.has(nextValue.toUpperCase())
    ? `${nextValue} Item`
    : nextValue;
}

function splitFileName(fileName: string): { stem: string; extension: string } {
  const lastDotIndex = fileName.lastIndexOf('.');
  if (lastDotIndex <= 0) {
    return {
      stem: fileName,
      extension: '',
    };
  }

  return {
    stem: fileName.slice(0, lastDotIndex),
    extension: fileName.slice(lastDotIndex),
  };
}

function getParentPath(path: string): string {
  const normalizedPath = path.replace(/[\\/]+$/, '');
  const separatorIndex = Math.max(
    normalizedPath.lastIndexOf('/'),
    normalizedPath.lastIndexOf('\\'),
  );

  if (separatorIndex <= 0) {
    return normalizedPath.slice(0, separatorIndex + 1) || normalizedPath;
  }

  return normalizedPath.slice(0, separatorIndex);
}

function getLeafName(path: string): string {
  const normalizedPath = path.replace(/[\\/]+$/, '');
  const separatorIndex = Math.max(
    normalizedPath.lastIndexOf('/'),
    normalizedPath.lastIndexOf('\\'),
  );
  return separatorIndex >= 0 ? normalizedPath.slice(separatorIndex + 1) : normalizedPath;
}

function getExtensionWithDot(path: string): string {
  const leafName = getLeafName(path);
  const extensionIndex = leafName.lastIndexOf('.');
  return extensionIndex > 0 ? leafName.slice(extensionIndex) : '';
}

function compareEntriesByName(left: ExplorerFileEntry, right: ExplorerFileEntry): number {
  return left.name.localeCompare(right.name, undefined, {
    sensitivity: 'base',
    numeric: true,
  });
}
