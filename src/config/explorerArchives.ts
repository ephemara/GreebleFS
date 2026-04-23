import type { FileEntry } from '../generated/tauri';

const EXPLORER_ARCHIVE_VIRTUAL_SCHEME = 'greeblefs://archive';

export type ExplorerArchiveFormatId =
  | 'zip'
  | 'seven-zip'
  | 'tar'
  | 'tar-gzip'
  | 'tar-bzip2'
  | 'tar-xz'
  | 'gzip'
  | 'bzip2'
  | 'xz';

export interface ExplorerArchiveFormatDescriptor {
  id: ExplorerArchiveFormatId;
  suffixes: readonly string[];
  label: string;
}

export interface ExplorerArchiveVirtualLocation {
  archivePath: string;
  entryPath: string;
}

export const EXPLORER_ARCHIVE_FORMATS: readonly ExplorerArchiveFormatDescriptor[] = [
  { id: 'tar-gzip', suffixes: ['.tar.gz', '.tgz'], label: 'Tar + Gzip Archive' },
  { id: 'tar-bzip2', suffixes: ['.tar.bz2', '.tbz2'], label: 'Tar + Bzip2 Archive' },
  { id: 'tar-xz', suffixes: ['.tar.xz', '.txz'], label: 'Tar + XZ Archive' },
  { id: 'seven-zip', suffixes: ['.7z'], label: '7-Zip Archive' },
  { id: 'zip', suffixes: ['.zip', '.cbz', '.jar', '.apk'], label: 'Zip Archive' },
  { id: 'tar', suffixes: ['.tar'], label: 'Tar Archive' },
  { id: 'gzip', suffixes: ['.gz'], label: 'Gzip Archive' },
  { id: 'bzip2', suffixes: ['.bz2'], label: 'Bzip2 Archive' },
  { id: 'xz', suffixes: ['.xz'], label: 'XZ Archive' },
];

function getArchiveFileName(value: string | Pick<FileEntry, 'name'>): string {
  return typeof value === 'string' ? value : value.name;
}

function getArchiveLeafFromPath(path: string): string {
  const trimmedPath = path.trim().replace(/[/\\]+$/, '');
  if (!trimmedPath) {
    return '';
  }

  const segments = trimmedPath.split(/[/\\]+/).filter(Boolean);
  return segments[segments.length - 1] ?? trimmedPath;
}

function getFilesystemParentPath(path: string): string | null {
  const trimmedPath = path.trim().replace(/[/\\]+$/, '');
  if (!trimmedPath) {
    return null;
  }

  if (/^[A-Za-z]:$/.test(trimmedPath)) {
    return `${trimmedPath}\\`;
  }

  const nextPath = trimmedPath.replace(/[/\\][^/\\]+$/, '');
  if (nextPath === trimmedPath) {
    return trimmedPath.startsWith('/') ? '/' : null;
  }

  if (/^[A-Za-z]:$/.test(nextPath)) {
    return `${nextPath}\\`;
  }

  return nextPath || (trimmedPath.startsWith('/') ? '/' : null);
}

export function normalizeExplorerArchiveEntryPath(value: string): string {
  const normalizedValue = value.trim().replace(/\\/g, '/');
  return normalizedValue.replace(/^\/+|\/+$/g, '');
}

export function buildExplorerArchiveVirtualPath(
  location: ExplorerArchiveVirtualLocation,
): string {
  const archivePath = location.archivePath.trim();
  if (!archivePath) {
    return EXPLORER_ARCHIVE_VIRTUAL_SCHEME;
  }

  const url = new URL(EXPLORER_ARCHIVE_VIRTUAL_SCHEME);
  url.searchParams.set('archive', archivePath);
  const entryPath = normalizeExplorerArchiveEntryPath(location.entryPath);
  if (entryPath) {
    url.searchParams.set('entry', entryPath);
  }
  return url.toString();
}

export function parseExplorerArchiveVirtualPath(
  path: string,
): ExplorerArchiveVirtualLocation | null {
  const trimmedPath = path.trim();
  if (!trimmedPath) {
    return null;
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(trimmedPath);
  } catch {
    return null;
  }

  const normalizedBase = `${parsedUrl.protocol}//${parsedUrl.host}`.toLowerCase();
  if (normalizedBase !== EXPLORER_ARCHIVE_VIRTUAL_SCHEME) {
    return null;
  }

  const archivePath = parsedUrl.searchParams.get('archive')?.trim() ?? '';
  if (!archivePath) {
    return null;
  }

  return {
    archivePath,
    entryPath: normalizeExplorerArchiveEntryPath(
      parsedUrl.searchParams.get('entry') ?? '',
    ),
  };
}

export function isExplorerArchiveVirtualPath(path: string): boolean {
  return parseExplorerArchiveVirtualPath(path) != null;
}

export function getExplorerArchiveContainerPath(
  archivePath: string,
): string | null {
  return getFilesystemParentPath(archivePath);
}

export function getExplorerArchiveVirtualParentPath(
  path: string,
): string | null {
  const location = parseExplorerArchiveVirtualPath(path);
  if (!location) {
    return null;
  }

  if (!location.entryPath) {
    return getExplorerArchiveContainerPath(location.archivePath);
  }

  const entrySegments = location.entryPath.split('/').filter(Boolean);
  entrySegments.pop();
  if (entrySegments.length === 0) {
    return buildExplorerArchiveVirtualPath({
      archivePath: location.archivePath,
      entryPath: '',
    });
  }

  return buildExplorerArchiveVirtualPath({
    archivePath: location.archivePath,
    entryPath: entrySegments.join('/'),
  });
}

export function getExplorerArchiveVirtualCurrentFolderName(path: string): string {
  const location = parseExplorerArchiveVirtualPath(path);
  if (!location) {
    return 'archive';
  }

  if (!location.entryPath) {
    return getExplorerArchiveDefaultFolderName(location.archivePath);
  }

  const entrySegments = location.entryPath.split('/').filter(Boolean);
  return entrySegments[entrySegments.length - 1] ?? 'archive';
}

export function getExplorerArchiveVirtualRootLabel(path: string): string {
  const location = parseExplorerArchiveVirtualPath(path);
  if (!location) {
    return 'Archive';
  }

  return getArchiveLeafFromPath(location.archivePath) || 'Archive';
}

export function getExplorerArchiveDescriptor(
  value: string | Pick<FileEntry, 'name' | 'is_dir'>,
): ExplorerArchiveFormatDescriptor | null {
  if (typeof value !== 'string' && value.is_dir) {
    return null;
  }

  const lowerName = getArchiveFileName(value).trim().toLowerCase();
  if (!lowerName) {
    return null;
  }

  return EXPLORER_ARCHIVE_FORMATS.find((format) => (
    format.suffixes.some((suffix) => lowerName.endsWith(suffix))
  )) ?? null;
}

export function isExplorerArchiveEntry(entry: Pick<FileEntry, 'name' | 'is_dir'>): boolean {
  return getExplorerArchiveDescriptor(entry) != null;
}

export function getExplorerArchiveDefaultFolderName(value: string | Pick<FileEntry, 'name'>): string {
  const fileName = getArchiveFileName(value).trim();
  const descriptor = getExplorerArchiveDescriptor(fileName);
  if (!descriptor) {
    return fileName || 'archive';
  }

  const lowerName = fileName.toLowerCase();
  const matchedSuffix = descriptor.suffixes.find((suffix) => lowerName.endsWith(suffix)) ?? '';
  const nextName = matchedSuffix ? fileName.slice(0, -matchedSuffix.length) : fileName;
  const normalized = nextName.trim().replace(/\.+$/, '').trim();
  return normalized || 'archive';
}

export function getExplorerArchiveExtractToFolderLabel(
  value: string | Pick<FileEntry, 'name'>,
): string {
  return `Extract to "${getExplorerArchiveDefaultFolderName(value)}"/`;
}
