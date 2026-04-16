import type { FileEntry } from '../generated/tauri';

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
