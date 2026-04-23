import type {
  ExplorerPickerEntry,
  ExplorerPickerRequest,
} from '../../runtime/explorerPicker';

export interface ExplorerPickerSelectableEntry {
  isDirectory: boolean;
  name: string;
  path: string;
}

export interface ResolveExplorerPickerEntriesArgs {
  currentPath: string;
  hasAnySelection: boolean;
  request: ExplorerPickerRequest | null | undefined;
  saveFileName?: string;
  selectedEntries: ExplorerPickerSelectableEntry[];
}

export function resolveExplorerPickerEntries(
  args: ResolveExplorerPickerEntriesArgs,
): ExplorerPickerEntry[] {
  const request = args.request;
  if (!request) {
    return [];
  }

  if (request.kind === 'saveFile') {
    const normalizedPath = buildExplorerPickerSavePath({
      currentPath: args.currentPath,
      defaultExtension: request.defaultExtension,
      fileName: args.saveFileName ?? request.initialFileName ?? '',
    });
    if (!normalizedPath) {
      return [];
    }

    return [{
      kind: 'file',
      name: getPathLeaf(normalizedPath),
      path: normalizedPath,
    }];
  }

  const selectedEntries = sanitizeSelectedEntries(
    args.selectedEntries,
    request.allowedExtensions,
  );
  if (request.kind === 'openFile' || request.kind === 'openFiles') {
    const fileEntries = selectedEntries.filter((entry) => !entry.isDirectory);
    if (fileEntries.length === 0) {
      return [];
    }

    const effectiveEntries =
      request.kind === 'openFiles' ? fileEntries : [fileEntries[0]!];
    return effectiveEntries.map((entry) => ({
      kind: 'file',
      name: entry.name,
      path: entry.path,
    }));
  }

  const folderEntries = selectedEntries.filter((entry) => entry.isDirectory);
  if (folderEntries.length > 0) {
    const effectiveEntries =
      request.kind === 'openFolders' ? folderEntries : [folderEntries[0]!];
    return effectiveEntries.map((entry) => ({
      kind: 'folder',
      name: entry.name,
      path: entry.path,
    }));
  }

  const normalizedCurrentPath = args.currentPath.trim();
  if (
    args.hasAnySelection
    || !normalizedCurrentPath
    || !supportsCurrentDirectoryFallback(request.kind)
  ) {
    return [];
  }

  return [{
    kind: 'folder',
    name: getPathLeaf(normalizedCurrentPath),
    path: normalizedCurrentPath,
  }];
}

export function supportsCurrentDirectoryFallback(
  kind: ExplorerPickerRequest['kind'],
): boolean {
  return kind === 'openFolder'
    || kind === 'openFolders'
    || kind === 'pickDestinationFolder';
}

export function allowsExplorerPickerMultipleSelection(
  kind: ExplorerPickerRequest['kind'],
): boolean {
  return kind === 'openFiles' || kind === 'openFolders';
}

export function buildExplorerPickerSavePath(args: {
  currentPath: string;
  defaultExtension?: string | null;
  fileName: string;
}): string | null {
  const currentPath = args.currentPath.trim();
  const fileName = normalizeSaveFileName(args.fileName, args.defaultExtension);
  if (!currentPath || !fileName) {
    return null;
  }

  const separator = currentPath.includes('\\') && !currentPath.startsWith('cloud://')
    ? '\\'
    : '/';
  const trimmedParent = currentPath.replace(/[/\\]+$/, '');
  return trimmedParent ? `${trimmedParent}${separator}${fileName}` : fileName;
}

export function normalizeSaveFileName(
  fileName: string,
  defaultExtension?: string | null,
): string {
  const trimmedFileName = fileName.trim().replace(/^[/\\]+/, '');
  if (!trimmedFileName) {
    return '';
  }

  const normalizedExtension = normalizeExtension(defaultExtension);
  if (!normalizedExtension || /\.[^./\\]+$/.test(trimmedFileName)) {
    return trimmedFileName;
  }

  return `${trimmedFileName}.${normalizedExtension}`;
}

export function getPathLeaf(path: string): string {
  const trimmed = path.trim().replace(/[/\\]+$/, '');
  if (!trimmed) {
    return path.trim();
  }
  const segments = trimmed.split(/[\\/]/).filter(Boolean);
  return segments[segments.length - 1] ?? trimmed;
}

function sanitizeSelectedEntries(
  entries: ExplorerPickerSelectableEntry[],
  allowedExtensions: string[],
): ExplorerPickerSelectableEntry[] {
  const uniqueEntries = new Map<string, ExplorerPickerSelectableEntry>();
  const normalizedExtensions = allowedExtensions.map((entry) => entry.toLowerCase());
  for (const entry of entries) {
    const normalizedPath = entry.path.trim();
    const normalizedName = entry.name.trim() || getPathLeaf(normalizedPath);
    if (!normalizedPath || uniqueEntries.has(normalizedPath)) {
      continue;
    }

    if (
      !entry.isDirectory
      && normalizedExtensions.length > 0
      && !normalizedExtensions.includes(getEntryExtension(normalizedName))
    ) {
      continue;
    }

    uniqueEntries.set(normalizedPath, {
      isDirectory: entry.isDirectory,
      name: normalizedName,
      path: normalizedPath,
    });
  }

  return [...uniqueEntries.values()];
}

function normalizeExtension(value: string | null | undefined): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim().replace(/^\.+/, '').toLowerCase();
  return normalized || null;
}

function getEntryExtension(name: string): string {
  const match = name.trim().toLowerCase().match(/\.([^./\\]+)$/);
  return match?.[1] ?? '';
}
