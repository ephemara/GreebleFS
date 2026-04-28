import type {
  ExecutionContextEntry,
  FileTypeDescriptor,
  ExecutionContextPreviewSession,
  ExecutionContextRepoContext,
  ExecutionContextRoot,
  ExecutionContextSnapshot,
} from '../generated/tauri';

export interface ExplorerExecutionContextEntryLike {
  path: string;
  name: string;
  extension: string;
  is_dir: boolean;
}

export interface ExplorerExecutionContextPreviewInput {
  laneId?: string | null;
  laneType: string;
  viewMode?: string | null;
  workflowTabId?: string | null;
  filePath?: string | null;
  resolvedPath?: string | null;
}

export interface ExplorerExecutionContextDriveLike {
  id: string;
  label: string;
  path: string;
}

export interface BuildExplorerExecutionContextSnapshotInput {
  paneId: string | null;
  workspaceTabId?: string | null;
  activeDirectory: string | null;
  cwd?: string | null;
  drives: ExplorerExecutionContextDriveLike[];
  entries: ExplorerExecutionContextEntryLike[];
  selectedPaths: string[];
  previewSession?: ExplorerExecutionContextPreviewInput | null;
  activeFileType?: FileTypeDescriptor | null;
  revision?: string | null;
  repoContext?: ExecutionContextRepoContext | null;
}

export function buildExplorerExecutionContextSnapshot(
  input: BuildExplorerExecutionContextSnapshotInput,
): ExecutionContextSnapshot {
  const entryByPath = new Map(
    input.entries.map((entry) => [entry.path, toExecutionContextEntry(entry)]),
  );
  const selectedEntries = input.selectedPaths
    .map((path) => entryByPath.get(path))
    .filter((entry): entry is ExecutionContextEntry => entry != null);
  const fallbackFocusedPath =
    input.previewSession?.filePath?.trim() || input.activeDirectory?.trim() || null;
  const focusedEntry =
    selectedEntries[0] ??
    (fallbackFocusedPath ? entryByPath.get(fallbackFocusedPath) ?? null : null);

  return {
    roots: buildExecutionContextRoots(input.drives, input.activeDirectory),
    activeDirectory: normalizeOptionalString(input.activeDirectory),
    cwd: normalizeOptionalString(input.cwd ?? input.activeDirectory),
    focusedEntry,
    selectedEntries,
    previewSession: toExecutionContextPreviewSession(input.previewSession),
    paneId: normalizeOptionalString(input.paneId),
    workspaceTabId: normalizeOptionalString(input.workspaceTabId),
    repoContext: input.repoContext ?? null,
    activeFileType:
      input.activeFileType ??
      inferExplorerExecutionContextFileType({
        focusedEntry,
        previewSession: input.previewSession,
      }),
    revision:
      normalizeOptionalString(input.revision) ??
      buildExplorerExecutionContextRevision({
        activeDirectory: input.activeDirectory,
        cwd: input.cwd ?? input.activeDirectory,
        paneId: input.paneId,
        workspaceTabId: input.workspaceTabId ?? null,
        previewFilePath:
          input.previewSession?.resolvedPath ?? input.previewSession?.filePath ?? null,
        selectedPaths: input.selectedPaths,
      }),
  };
}

function toExecutionContextEntry(
  entry: ExplorerExecutionContextEntryLike,
): ExecutionContextEntry {
  return {
    path: entry.path,
    name: entry.name,
    kind: entry.is_dir ? 'directory' : 'file',
    extension: normalizeOptionalString(entry.extension.replace(/^\./, '')),
    isDirectory: entry.is_dir,
  };
}

function toExecutionContextPreviewSession(
  previewSession: ExplorerExecutionContextPreviewInput | null | undefined,
): ExecutionContextPreviewSession | null {
  if (!previewSession) {
    return null;
  }
  return {
    laneId: normalizeOptionalString(previewSession.laneId),
    laneType: previewSession.laneType,
    viewMode: normalizeOptionalString(previewSession.viewMode),
    workflowTabId: normalizeOptionalString(previewSession.workflowTabId),
    filePath: normalizeOptionalString(previewSession.filePath),
    resolvedPath: normalizeOptionalString(previewSession.resolvedPath),
  };
}

function buildExecutionContextRoots(
  drives: ExplorerExecutionContextDriveLike[],
  activeDirectory: string | null,
): ExecutionContextRoot[] {
  if (drives.length > 0) {
    return drives.map((drive) => ({
      id: drive.id,
      label: drive.label,
      path: drive.path,
      kind: 'drive',
    }));
  }

  const fallbackRoot = deriveRootFromPath(activeDirectory);
  return fallbackRoot ? [fallbackRoot] : [];
}

function deriveRootFromPath(path: string | null): ExecutionContextRoot | null {
  const normalized = normalizeOptionalString(path);
  if (!normalized) {
    return null;
  }

  const windowsDriveMatch = normalized.match(/^[A-Za-z]:[\\/]/);
  if (windowsDriveMatch) {
    const drivePath = `${normalized.slice(0, 2)}\\`;
    return {
      id: drivePath.toLowerCase(),
      label: drivePath,
      path: drivePath,
      kind: 'drive',
    };
  }

  if (normalized.startsWith('/')) {
    return {
      id: '/',
      label: '/',
      path: '/',
      kind: 'filesystem-root',
    };
  }

  const remoteRoot = normalized.split('/').slice(0, 3).join('/');
  if (remoteRoot) {
    return {
      id: remoteRoot.toLowerCase(),
      label: remoteRoot,
      path: remoteRoot,
      kind: 'virtual-root',
    };
  }

  return null;
}

function normalizeOptionalString(value: string | null | undefined): string | null {
  const normalized = value?.trim() ?? '';
  return normalized.length > 0 ? normalized : null;
}

function inferExplorerExecutionContextFileType(input: {
  focusedEntry: ExecutionContextEntry | null | undefined;
  previewSession?: ExplorerExecutionContextPreviewInput | null;
}): FileTypeDescriptor | null {
  const focusedEntry = input.focusedEntry ?? null;
  const previewFilePath =
    input.previewSession?.resolvedPath?.trim() ||
    input.previewSession?.filePath?.trim() ||
    focusedEntry?.path?.trim() ||
    '';
  if (!previewFilePath) {
    return null;
  }
  const extension =
    focusedEntry?.extension?.trim().toLowerCase() ||
    previewFilePath.split('.').pop()?.trim().toLowerCase() ||
    '';
  const normalizedExtension = extension.length > 0 ? extension : null;
  const isDirectory = focusedEntry?.isDirectory === true;
  return {
    id: isDirectory
      ? 'directory'
      : normalizedExtension
        ? `extension:${normalizedExtension}`
        : 'file:unknown',
    extensions: normalizedExtension ? [normalizedExtension] : [],
    fileNames: [],
    languageId: normalizedExtension,
    iconKey: normalizedExtension,
    openBehavior: isDirectory ? 'directory' : 'preview',
    previewOwner: input.previewSession?.laneType ?? null,
    runtimeAffinity: input.previewSession?.laneId ?? null,
    editable: false,
  };
}

function buildExplorerExecutionContextRevision(input: {
  activeDirectory: string | null;
  cwd: string | null | undefined;
  paneId: string | null;
  workspaceTabId: string | null | undefined;
  previewFilePath: string | null;
  selectedPaths: string[];
}): string {
  return [
    normalizeOptionalString(input.workspaceTabId) ?? '',
    normalizeOptionalString(input.paneId) ?? '',
    normalizeOptionalString(input.activeDirectory) ?? '',
    normalizeOptionalString(input.cwd) ?? '',
    normalizeOptionalString(input.previewFilePath) ?? '',
    [...input.selectedPaths].sort().join('|'),
  ].join('::');
}
