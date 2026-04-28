import type {
  DriveInfo,
  ExecutionContextEntry,
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

export interface BuildExplorerExecutionContextSnapshotInput {
  paneId: string | null;
  activeDirectory: string | null;
  cwd?: string | null;
  drives: DriveInfo[];
  entries: ExplorerExecutionContextEntryLike[];
  selectedPaths: string[];
  previewSession?: ExplorerExecutionContextPreviewInput | null;
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
    repoContext: input.repoContext ?? null,
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
  drives: DriveInfo[],
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
