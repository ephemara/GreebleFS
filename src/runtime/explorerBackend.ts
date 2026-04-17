import type { FileSearchResponse } from '../config/searchTelemetry';
import type { FsRuntimeCachePolicy } from '../config/runtimeCachePolicy';
import { commands, events, unwrapTauriResult } from './tauriClient';
import { useExplorerStore } from '../store/explorerStore';
import {
  type CloudAccountStatus,
  type CloudAccountSummary,
  type CloudAccountsSnapshot,
  type CloudAuthSession,
  type CloudAuthStatus,
  type CloudBreadcrumb,
  type CloudProviderConfigurationSource,
  type CloudProviderConfigurationStatus,
  type CloudProviderId,
  type DriveInfo,
  type EntryStorageInfo,
  type ExplorerDuplicateScanStartResponse,
  type ExplorerDuplicateScanStatus,
  type ExplorerEntryThumbnail,
  type ExplorerEntryThumbnailRequest,
  type ExplorerSavedSearchRecord,
  type ExplorerSavedSearchSaveRequest,
  type FsArchiveExtractionMode,
  type FsArchiveExtractionRequest,
  type FsArchiveExtractionResult,
  type ExplorerTaskHistoryClearScope,
  type ExplorerTaskKind,
  type ExplorerTagMutationRequest,
  type ExplorerTaskRecord,
  type ExplorerTagSnapshot,
  type ExplorerTrashActionRecord,
  type ExplorerTrashRestoreResult,
  type ExplorerTaskProgressEvent,
  type ExplorerTaskStatus,
  type FileEntry,
  type FileSearchResult,
  type FileTransferCollision,
  type FileTransferCollisionPolicy,
  type FileTransferDisposition,
  type FileTransferOperation,
  type FileTransferResult,
  type FsWriteFileContent,
  type FsBatchRenameItem,
  type FsBatchRenameResult,
  type YaziSchedulerTaskSnap,
} from '../generated/tauri';

export type ExplorerFileEntry = FileEntry;
export type ExplorerFileSearchResult = FileSearchResult;
export type ExplorerEntryStorageInfo = EntryStorageInfo;
export type ExplorerFileTransferOperation = FileTransferOperation;
export type ExplorerFileTransferResult = FileTransferResult;
export type ExplorerFileTransferCollision = FileTransferCollision;
export type ExplorerFileTransferCollisionPolicy = FileTransferCollisionPolicy;
export type ExplorerFileTransferDisposition = FileTransferDisposition;
export type ExplorerTaskProgress = ExplorerTaskProgressEvent;
export type ExplorerTaskSnapshot = ExplorerTaskRecord;
export type ExplorerSchedulerTask = YaziSchedulerTaskSnap;
export type ExplorerTaskHistoryScope = ExplorerTaskHistoryClearScope;
export type ExplorerTaskKindValue = ExplorerTaskKind;
export type ExplorerTaskStatusValue = ExplorerTaskStatus;
export type ExplorerWritableContent = string | number[];
export type ExplorerCloudProviderId = CloudProviderId;
export type ExplorerCloudAccountStatus = CloudAccountStatus;
export type ExplorerCloudAccountSummary = CloudAccountSummary;
export type ExplorerCloudAccountsSnapshot = CloudAccountsSnapshot;
export type ExplorerCloudAuthSession = CloudAuthSession;
export type ExplorerCloudAuthStatus = CloudAuthStatus;
export type ExplorerCloudProviderConfigurationSource = CloudProviderConfigurationSource;
export type ExplorerCloudProviderConfigurationStatus = CloudProviderConfigurationStatus;
export type ExplorerTagMetadataSnapshot = ExplorerTagSnapshot;
export type ExplorerTagMutation = ExplorerTagMutationRequest;
export type ExplorerSavedSearch = ExplorerSavedSearchRecord;
export type ExplorerSavedSearchInput = ExplorerSavedSearchSaveRequest;
export type ExplorerArchiveExtractionMode = FsArchiveExtractionMode;
export type ExplorerArchiveExtractionInput = FsArchiveExtractionRequest;
export type ExplorerArchiveExtractionOutcome = FsArchiveExtractionResult;
export type ExplorerTrashAction = ExplorerTrashActionRecord;
export type ExplorerTrashRestore = ExplorerTrashRestoreResult;
export type ExplorerBatchRenameItem = FsBatchRenameItem;
export type ExplorerBatchRenameResult = FsBatchRenameResult;
export type ExplorerDuplicateScanStart = ExplorerDuplicateScanStartResponse;
export type ExplorerDuplicateScan = ExplorerDuplicateScanStatus;
export type ExplorerEntryThumbnailData = ExplorerEntryThumbnail;
export type ExplorerEntryThumbnailInput = ExplorerEntryThumbnailRequest;

export type ExplorerLocationBreadcrumb = {
  label: string;
  path: string;
};

export type ExplorerLocationListing = {
  kind: 'local' | 'cloud';
  path: string;
  parentPath: string | null;
  breadcrumbs: ExplorerLocationBreadcrumb[];
  entries: ExplorerFileEntry[];
};

export type ExplorerLocalDriveInfo = DriveInfo & {
  kind: 'local';
  id: string;
  path: string;
};

export type ExplorerCloudDriveInfo = {
  kind: 'cloud';
  id: string;
  path: string;
  label: string;
  provider: ExplorerCloudProviderId;
  accountId: string;
  email: string;
  status: ExplorerCloudAccountStatus;
  avatarUrl: string | null;
};

export type ExplorerDriveInfo = ExplorerLocalDriveInfo | ExplorerCloudDriveInfo;

function toWritablePayload(content: ExplorerWritableContent): FsWriteFileContent {
  return typeof content === 'string'
    ? { kind: 'text', value: content }
    : { kind: 'bytes', value: content };
}

export function isCloudExplorerPath(path: string): boolean {
  return path.trim().startsWith('cloud://');
}

function buildLocalBreadcrumbs(path: string): ExplorerLocationBreadcrumb[] {
  const normalizedPath = path.trim();
  if (!normalizedPath) {
    return [];
  }

  if (/^[A-Za-z]:\\?$/.test(normalizedPath)) {
    const drivePath = normalizedPath.endsWith('\\') ? normalizedPath : `${normalizedPath}\\`;
    return [{ label: drivePath, path: drivePath }];
  }

  if (/^[A-Za-z]:[\\/]/.test(normalizedPath)) {
    const drivePath = `${normalizedPath.slice(0, 2)}\\`;
    const parts = normalizedPath.replace(/[/\\]+$/, '').split(/[/\\]/).filter(Boolean);
    const breadcrumbs: ExplorerLocationBreadcrumb[] = [{ label: drivePath, path: drivePath }];

    for (let index = 1; index < parts.length; index += 1) {
      const nextPath = `${parts.slice(0, index + 1).join('\\')}${index === parts.length - 1 ? '' : ''}`;
      breadcrumbs.push({ label: parts[index] ?? '', path: nextPath });
    }

    return breadcrumbs;
  }

  if (normalizedPath.startsWith('/')) {
    const parts = normalizedPath.replace(/\/+$/, '').split('/').filter(Boolean);
    const breadcrumbs: ExplorerLocationBreadcrumb[] = [{ label: '/', path: '/' }];
    for (let index = 0; index < parts.length; index += 1) {
      breadcrumbs.push({
        label: parts[index] ?? '',
        path: `/${parts.slice(0, index + 1).join('/')}`,
      });
    }
    return breadcrumbs;
  }

  const parts = normalizedPath.replace(/[/\\]+$/, '').split(/[/\\]/).filter(Boolean);
  return parts.map((label, index) => ({
    label,
    path: parts.slice(0, index + 1).join('/'),
  }));
}

function getLocalParentPath(path: string): string | null {
  const normalized = path.trim();
  if (!normalized) {
    return null;
  }

  if (/^[A-Za-z]:\\?$/.test(normalized) || normalized === '/') {
    return null;
  }

  const trimmed = normalized.replace(/[/\\]+$/, '');
  const parts = trimmed.split(/[/\\]/);
  if (parts.length <= 1) {
    return null;
  }

  if (/^[A-Za-z]:$/.test(parts[0] ?? '')) {
    return parts.length === 2 ? `${parts[0]}\\` : `${parts.slice(0, -1).join('\\')}\\`;
  }

  return trimmed.startsWith('/')
    ? `/${parts.slice(0, -1).filter(Boolean).join('/')}` || '/'
    : parts.slice(0, -1).join('/');
}

function getCloudParentPath(path: string): string | null {
  const trimmed = path.replace(/\/+$/, '');
  if (!trimmed.startsWith('cloud://')) {
    return null;
  }

  const segments = trimmed.split('/');
  if (segments.length <= 5) {
    return null;
  }

  return segments.slice(0, -1).join('/');
}

function toExplorerCloudBreadcrumbs(breadcrumbs: CloudBreadcrumb[]): ExplorerLocationBreadcrumb[] {
  return breadcrumbs.map((breadcrumb) => ({
    label: breadcrumb.label,
    path: breadcrumb.path,
  }));
}

function getLeafName(path: string): string {
  const trimmed = path.replace(/[/\\]+$/, '');
  const match = trimmed.match(/([^/\\]+)$/);
  return match?.[1] ?? trimmed;
}

function getParentDir(path: string): string {
  if (isCloudExplorerPath(path)) {
    const parentPath = getCloudParentPath(path);
    if (!parentPath) {
      throw new Error('Cloud root folders cannot be created without a parent path.');
    }
    return parentPath;
  }

  const trimmed = path.replace(/[/\\]+$/, '');
  const parentPath = trimmed.replace(/[/\\][^/\\]+$/, '');
  if (parentPath === trimmed) {
    throw new Error(`Unable to derive parent directory for ${path}`);
  }
  if (/^[A-Za-z]:$/.test(parentPath)) {
    return `${parentPath}\\`;
  }
  return parentPath || '/';
}

function toLocalDriveInfo(drive: DriveInfo): ExplorerLocalDriveInfo {
  return {
    ...drive,
    kind: 'local',
    id: drive.letter,
    path: drive.letter,
  };
}

function toCloudDriveInfo(account: CloudAccountSummary): ExplorerCloudDriveInfo {
  return {
    kind: 'cloud',
    id: account.id,
    path: account.root_path,
    label: account.drive_label,
    provider: account.provider,
    accountId: account.id,
    email: account.email,
    status: account.status,
    avatarUrl: account.avatar_url,
  };
}

export type ExplorerBackendContract = {
  listDir: typeof listExplorerDir;
  listDirUncached: typeof listExplorerDirUncached;
  listLocation: typeof listExplorerLocation;
  listLocationUncached: typeof listExplorerLocationUncached;
  getDrives: typeof getExplorerDrives;
  measureEntrySizes: typeof measureExplorerEntrySizes;
  getRuntimeCachePolicy: typeof getExplorerRuntimeCachePolicy;
  getHomeDir: typeof getExplorerHomeDir;
  searchEntriesWithDiagnostics: typeof searchExplorerEntriesWithDiagnostics;
  cancelSearchEntries: typeof cancelExplorerSearchEntries;
  watchEntrySizeRoot: typeof watchExplorerEntrySizeRoot;
  unwatchEntrySizeRoot: typeof unwatchExplorerEntrySizeRoot;
  planItemTransfer: typeof planExplorerItemTransfer;
  openPath: typeof openExplorerPath;
  openArchive: typeof openExplorerArchive;
  openWithDialog: typeof openExplorerPathWithDialog;
  revealPath: typeof revealExplorerPath;
  showPathProperties: typeof showExplorerPathProperties;
  openPathAsAdmin: typeof openExplorerPathAsAdmin;
  createDir: typeof createExplorerDir;
  createFile: typeof createExplorerFile;
  extractArchive: typeof extractExplorerArchive;
  transferItems: typeof transferExplorerItems;
  listTasks: typeof listExplorerTasks;
  clearTaskHistory: typeof clearExplorerTaskHistory;
  retryTask: typeof retryExplorerTask;
  cancelTask: typeof cancelExplorerTask;
  writeFile: typeof writeExplorerFile;
  readTextFile: typeof readExplorerTextFile;
  readFileBase64: typeof readExplorerFileBase64;
  readImageThumbnail: typeof readExplorerImageThumbnail;
  readEntryThumbnail: typeof readExplorerEntryThumbnail;
  renamePath: typeof renameExplorerPath;
  deletePath: typeof deleteExplorerPath;
  trashPaths: typeof trashExplorerPaths;
  restoreRecentTrashAction: typeof restoreExplorerTrashAction;
  batchRename: typeof batchRenameExplorerPaths;
  startDuplicateScan: typeof startExplorerDuplicateScan;
  pollDuplicateScan: typeof pollExplorerDuplicateScan;
  cancelDuplicateScan: typeof cancelExplorerDuplicateScan;
  listTags: typeof listExplorerTags;
  setTagsForPaths: typeof setExplorerTagsForPaths;
  listSavedSearches: typeof listExplorerSavedSearches;
  saveSavedSearch: typeof saveExplorerSavedSearch;
  deleteSavedSearch: typeof deleteExplorerSavedSearch;
  isCloudPath: typeof isCloudExplorerPath;
  supportsSearch: typeof supportsExplorerSearch;
  supportsNativeIntegration: typeof supportsExplorerNativeIntegration;
  supportsNativeDragOut: typeof supportsExplorerNativeDragOut;
};

export function queueExplorerTerminalDirectorySync(args: {
  path: string;
  shell?: string | null;
  source?: 'navigation' | 'open-terminal';
}): void {
  const path = args.path.trim();
  if (!path) {
    return;
  }

  useExplorerStore.getState().setPendingTerminalCwdSync({
    path,
    shell: args.shell ?? null,
    source: args.source ?? 'navigation',
    updatedAt: Date.now(),
  });

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('overlayterm:cdinject', {
      detail: {
        path,
        shell: args.shell ?? undefined,
      },
    }));
  }
}

export async function listExplorerLocation(
  path: string,
  showHidden: boolean,
): Promise<ExplorerLocationListing> {
  if (isCloudExplorerPath(path)) {
    const listing = unwrapTauriResult(await commands.cloudListDir(path));
    return {
      kind: 'cloud',
      path: listing.path,
      parentPath: listing.parent_path,
      breadcrumbs: toExplorerCloudBreadcrumbs(listing.breadcrumbs),
      entries: listing.entries,
    };
  }

  const normalizedPath = /^[A-Za-z]:$/.test(path) ? `${path}\\` : path;
  const entries = unwrapTauriResult(await commands.fsListDir(normalizedPath, showHidden));
  return {
    kind: 'local',
    path: normalizedPath,
    parentPath: getLocalParentPath(normalizedPath),
    breadcrumbs: buildLocalBreadcrumbs(normalizedPath),
    entries,
  };
}

export async function listExplorerLocationUncached(
  path: string,
  showHidden: boolean,
): Promise<ExplorerLocationListing> {
  if (isCloudExplorerPath(path)) {
    return listExplorerLocation(path, showHidden);
  }

  const normalizedPath = /^[A-Za-z]:$/.test(path) ? `${path}\\` : path;
  const entries = unwrapTauriResult(await commands.fsListDirUncached(normalizedPath, showHidden));
  return {
    kind: 'local',
    path: normalizedPath,
    parentPath: getLocalParentPath(normalizedPath),
    breadcrumbs: buildLocalBreadcrumbs(normalizedPath),
    entries,
  };
}

export async function listExplorerDir(path: string, showHidden: boolean): Promise<ExplorerFileEntry[]> {
  return (await listExplorerLocation(path, showHidden)).entries;
}

export async function listExplorerDirUncached(
  path: string,
  showHidden: boolean,
): Promise<ExplorerFileEntry[]> {
  return (await listExplorerLocationUncached(path, showHidden)).entries;
}

export async function getExplorerDrives(): Promise<ExplorerDriveInfo[]> {
  const [localDrives, cloudSnapshot] = await Promise.all([
    commands.fsGetDrives().then(unwrapTauriResult),
    listCloudAccounts().catch((): ExplorerCloudAccountsSnapshot => ({ accounts: [], providers: [] })),
  ]);

  return [
    ...localDrives.map(toLocalDriveInfo),
    ...cloudSnapshot.accounts
      .filter((account) => account.status === 'connected')
      .map(toCloudDriveInfo),
  ];
}

export async function measureExplorerEntrySizes(
  paths: string[],
  forceRefresh = false,
): Promise<ExplorerEntryStorageInfo[]> {
  const localPaths = paths.filter((path) => !isCloudExplorerPath(path));
  if (localPaths.length === 0) {
    return [];
  }
  return unwrapTauriResult(await commands.fsMeasureEntrySizes(localPaths, forceRefresh));
}

export async function getExplorerRuntimeCachePolicy(): Promise<FsRuntimeCachePolicy> {
  return commands.fsGetRuntimeCachePolicy();
}

export async function getExplorerHomeDir(): Promise<string> {
  return unwrapTauriResult(await commands.fsGetHomeDir());
}

export async function searchExplorerEntriesWithDiagnostics(args: {
  path: string;
  query: string;
  showHidden: boolean;
  includeContent?: boolean;
  limit?: number;
  requestId?: number;
  requestScope?: string;
}): Promise<FileSearchResponse<ExplorerFileSearchResult>> {
  if (isCloudExplorerPath(args.path)) {
    throw new Error('Search is not available for cloud drives yet.');
  }

  return unwrapTauriResult(await commands.fsSearchEntriesWithDiagnostics(
    args.path,
    args.query,
    args.showHidden,
    args.includeContent ?? false,
    args.limit ?? null,
    args.requestId ?? null,
    args.requestScope ?? null,
  )) as FileSearchResponse<ExplorerFileSearchResult>;
}

export async function cancelExplorerSearchEntries(args: {
  path: string;
  requestId?: number;
  requestScope?: string;
}): Promise<void> {
  if (isCloudExplorerPath(args.path)) {
    return;
  }

  unwrapTauriResult(await commands.fsCancelSearchEntries(
    args.path,
    args.requestId ?? null,
    args.requestScope ?? null,
  ));
}

export async function watchExplorerEntrySizeRoot(path: string): Promise<void> {
  if (isCloudExplorerPath(path)) {
    return;
  }
  unwrapTauriResult(await commands.fsWatchEntrySizeRoot(path));
}

export async function unwatchExplorerEntrySizeRoot(path: string): Promise<void> {
  if (isCloudExplorerPath(path)) {
    return;
  }
  unwrapTauriResult(await commands.fsUnwatchEntrySizeRoot(path));
}

export async function openExplorerPath(path: string): Promise<void> {
  if (isCloudExplorerPath(path)) {
    unwrapTauriResult(await commands.cloudOpenFile(path));
    return;
  }
  unwrapTauriResult(await commands.fsOpenFile(path));
}

export async function openExplorerArchive(path: string): Promise<ExplorerArchiveExtractionOutcome> {
  if (isCloudExplorerPath(path)) {
    throw new Error('Archive extraction is only available for local filesystem items.');
  }
  return unwrapTauriResult(await commands.fsOpenArchive(path));
}

export async function openExplorerPathWithDialog(path: string): Promise<void> {
  if (isCloudExplorerPath(path)) {
    throw new Error('Open With is only available for local filesystem items.');
  }
  unwrapTauriResult(await commands.fsOpenWithDialog(path));
}

export async function revealExplorerPath(path: string): Promise<void> {
  if (isCloudExplorerPath(path)) {
    throw new Error('Reveal in the OS file manager is only available for local filesystem items.');
  }
  unwrapTauriResult(await commands.fsRevealInExplorer(path));
}

export async function showExplorerPathProperties(path: string): Promise<void> {
  if (isCloudExplorerPath(path)) {
    throw new Error('Properties are only available for local filesystem items.');
  }
  unwrapTauriResult(await commands.fsShowItemProperties(path));
}

export async function openExplorerPathAsAdmin(path: string): Promise<void> {
  if (isCloudExplorerPath(path)) {
    throw new Error('Administrative open is only available for local filesystem items.');
  }
  unwrapTauriResult(await commands.fsOpenAsAdmin(path));
}

export async function createExplorerDir(path: string): Promise<void> {
  if (isCloudExplorerPath(path)) {
    unwrapTauriResult(await commands.cloudCreateDirectory(getParentDir(path), getLeafName(path)));
    return;
  }
  unwrapTauriResult(await commands.fsCreateDir(path));
}

export async function extractExplorerArchive(
  request: ExplorerArchiveExtractionInput,
): Promise<ExplorerArchiveExtractionOutcome> {
  if (isCloudExplorerPath(request.archivePath)) {
    throw new Error('Archive extraction is only available for local filesystem items.');
  }
  return unwrapTauriResult(await commands.fsExtractArchive(request));
}

export async function createExplorerFile(
  parentPath: string,
  name: string,
  content: ExplorerWritableContent = '',
): Promise<void> {
  if (isCloudExplorerPath(parentPath)) {
    unwrapTauriResult(await commands.cloudCreateFile(parentPath, name, toWritablePayload(content)));
    return;
  }

  const separator = parentPath.includes('\\') ? '\\' : '/';
  const normalizedParent = parentPath.replace(/[/\\]+$/, '');
  const nextPath = normalizedParent
    ? `${normalizedParent}${separator}${name}`
    : name;
  unwrapTauriResult(await commands.fsWriteFile(nextPath, toWritablePayload(content)));
}

export async function transferExplorerItems(
  targetDir: string,
  sources: string[],
  operation: ExplorerFileTransferOperation,
  collisionPolicy: ExplorerFileTransferCollisionPolicy = 'keep_both',
): Promise<ExplorerFileTransferResult[]> {
  if (isCloudExplorerPath(targetDir) || sources.some(isCloudExplorerPath)) {
    if (collisionPolicy !== 'keep_both') {
      throw new Error('Replace and skip collision policies are only available for local filesystem transfers.');
    }
    return unwrapTauriResult(await commands.cloudTransferItems(targetDir, sources, operation));
  }
  return unwrapTauriResult(
    await commands.fsTransferItems(targetDir, sources, operation, collisionPolicy),
  );
}

export async function planExplorerItemTransfer(
  targetDir: string,
  sources: string[],
  operation: ExplorerFileTransferOperation,
): Promise<ExplorerFileTransferCollision[]> {
  if (isCloudExplorerPath(targetDir) || sources.some(isCloudExplorerPath)) {
    return [];
  }
  return unwrapTauriResult(await commands.fsPlanTransferItems(targetDir, sources, operation));
}

export async function listExplorerTasks(): Promise<ExplorerTaskSnapshot[]> {
  return unwrapTauriResult(await commands.fsListExplorerTasks());
}

export async function clearExplorerTaskHistory(scope: ExplorerTaskHistoryScope): Promise<void> {
  unwrapTauriResult(await commands.fsClearExplorerTaskHistory(scope));
}

export async function retryExplorerTask(taskId: string): Promise<ExplorerTaskSnapshot> {
  return unwrapTauriResult(await commands.fsRetryExplorerTask(taskId));
}

export async function cancelExplorerTask(taskId: string): Promise<ExplorerTaskSnapshot> {
  return unwrapTauriResult(await commands.fsCancelExplorerTask(taskId));
}

export async function writeExplorerFile(
  path: string,
  content: ExplorerWritableContent,
): Promise<void> {
  const payload = toWritablePayload(content);
  if (isCloudExplorerPath(path)) {
    unwrapTauriResult(await commands.cloudWriteFile(path, payload));
    return;
  }
  unwrapTauriResult(await commands.fsWriteFile(path, payload));
}

export async function readExplorerTextFile(path: string): Promise<string> {
  if (isCloudExplorerPath(path)) {
    return unwrapTauriResult(await commands.cloudReadTextFile(path));
  }
  return unwrapTauriResult(await commands.fsReadTextFile(path));
}

export async function readExplorerFileBase64(path: string): Promise<string> {
  if (isCloudExplorerPath(path)) {
    return unwrapTauriResult(await commands.cloudReadFileBase64(path));
  }
  return unwrapTauriResult(await commands.fsReadFileBase64(path));
}

export async function readExplorerImageThumbnail(
  path: string,
  maxWidth: number,
  maxHeight: number,
): Promise<string> {
  if (isCloudExplorerPath(path)) {
    return readExplorerFileBase64(path);
  }
  return unwrapTauriResult(await commands.fsReadImageThumbnail(path, maxWidth, maxHeight));
}

export async function readExplorerEntryThumbnail(
  request: ExplorerEntryThumbnailInput,
): Promise<ExplorerEntryThumbnailData> {
  if (isCloudExplorerPath(request.path)) {
    throw new Error('Generated thumbnails are not available for cloud filesystem items yet.');
  }
  return unwrapTauriResult(await commands.fsReadEntryThumbnail(request));
}

export async function renameExplorerPath(oldPath: string, newPath: string): Promise<void> {
  if (isCloudExplorerPath(oldPath) || isCloudExplorerPath(newPath)) {
    if (!isCloudExplorerPath(oldPath) || !isCloudExplorerPath(newPath)) {
      throw new Error('Renaming between local and cloud locations is not supported.');
    }
    unwrapTauriResult(await commands.cloudRenamePath(oldPath, getLeafName(newPath)));
    return;
  }
  unwrapTauriResult(await commands.fsRename(oldPath, newPath));
}

export async function deleteExplorerPath(path: string, recursive: boolean): Promise<void> {
  if (isCloudExplorerPath(path)) {
    unwrapTauriResult(await commands.cloudDeletePath(path));
    return;
  }
  unwrapTauriResult(await commands.fsDelete(path, recursive));
}

export async function trashExplorerPaths(paths: string[]): Promise<ExplorerTrashAction> {
  const localPaths = paths.filter((path) => !isCloudExplorerPath(path));
  if (localPaths.length !== paths.length) {
    throw new Error('Trash is only available for local filesystem items.');
  }
  return unwrapTauriResult(await commands.fsTrash(localPaths));
}

export async function restoreExplorerTrashAction(): Promise<ExplorerTrashRestore | null> {
  return unwrapTauriResult(await commands.fsRestoreRecentTrashAction());
}

export async function batchRenameExplorerPaths(
  items: ExplorerBatchRenameItem[],
): Promise<ExplorerBatchRenameResult[]> {
  return unwrapTauriResult(await commands.fsBatchRename(items));
}

export async function startExplorerDuplicateScan(rootPath: string): Promise<ExplorerDuplicateScanStart> {
  if (isCloudExplorerPath(rootPath)) {
    throw new Error('Duplicate scanning is only available for local filesystem roots.');
  }
  return unwrapTauriResult(await commands.fsFindDuplicatesStart(rootPath));
}

export async function pollExplorerDuplicateScan(scanId: string): Promise<ExplorerDuplicateScan> {
  return unwrapTauriResult(await commands.fsFindDuplicatesPoll(scanId));
}

export async function cancelExplorerDuplicateScan(scanId: string): Promise<void> {
  unwrapTauriResult(await commands.fsFindDuplicatesCancel(scanId));
}

export async function listExplorerTags(paths: string[] = []): Promise<ExplorerTagMetadataSnapshot> {
  return unwrapTauriResult(await commands.explorerTagsList(paths.length > 0 ? paths : null));
}

export async function setExplorerTagsForPaths(
  request: ExplorerTagMutation,
): Promise<ExplorerTagMetadataSnapshot> {
  return unwrapTauriResult(await commands.explorerTagsSetForPaths(request));
}

export async function listExplorerSavedSearches(): Promise<ExplorerSavedSearch[]> {
  return unwrapTauriResult(await commands.explorerSavedSearchesList());
}

export async function saveExplorerSavedSearch(
  request: ExplorerSavedSearchInput,
): Promise<ExplorerSavedSearch> {
  return unwrapTauriResult(await commands.explorerSavedSearchesSave(request));
}

export async function deleteExplorerSavedSearch(id: string): Promise<void> {
  unwrapTauriResult(await commands.explorerSavedSearchesDelete(id));
}

export function supportsExplorerSearch(path: string): boolean {
  return !isCloudExplorerPath(path);
}

export function supportsExplorerNativeIntegration(path: string): boolean {
  return !isCloudExplorerPath(path);
}

export function supportsExplorerNativeDragOut(paths: string[]): boolean {
  return paths.every((path) => !isCloudExplorerPath(path));
}

export async function listCloudAccounts(): Promise<ExplorerCloudAccountsSnapshot> {
  return unwrapTauriResult(await commands.cloudListAccounts());
}

export async function setCloudProviderConfiguration(
  provider: ExplorerCloudProviderId,
  clientId: string,
  clientSecret: string | null,
): Promise<ExplorerCloudProviderConfigurationStatus> {
  return unwrapTauriResult(await commands.cloudSetProviderConfiguration(provider, clientId, clientSecret));
}

export async function clearCloudProviderConfiguration(
  provider: ExplorerCloudProviderId,
): Promise<ExplorerCloudProviderConfigurationStatus> {
  return unwrapTauriResult(await commands.cloudClearProviderConfiguration(provider));
}

export async function beginCloudAuth(provider: ExplorerCloudProviderId): Promise<ExplorerCloudAuthSession> {
  return unwrapTauriResult(await commands.cloudBeginAuth(provider));
}

export async function pollCloudAuth(requestId: string): Promise<ExplorerCloudAuthStatus> {
  return unwrapTauriResult(await commands.cloudPollAuth(requestId));
}

export async function disconnectCloudAccount(accountId: string): Promise<void> {
  unwrapTauriResult(await commands.cloudDisconnectAccount(accountId));
}

export const explorerBackendContract: ExplorerBackendContract = {
  listDir: listExplorerDir,
  listDirUncached: listExplorerDirUncached,
  listLocation: listExplorerLocation,
  listLocationUncached: listExplorerLocationUncached,
  getDrives: getExplorerDrives,
  measureEntrySizes: measureExplorerEntrySizes,
  getRuntimeCachePolicy: getExplorerRuntimeCachePolicy,
  getHomeDir: getExplorerHomeDir,
  searchEntriesWithDiagnostics: searchExplorerEntriesWithDiagnostics,
  cancelSearchEntries: cancelExplorerSearchEntries,
  watchEntrySizeRoot: watchExplorerEntrySizeRoot,
  unwatchEntrySizeRoot: unwatchExplorerEntrySizeRoot,
  planItemTransfer: planExplorerItemTransfer,
  openPath: openExplorerPath,
  openArchive: openExplorerArchive,
  openWithDialog: openExplorerPathWithDialog,
  revealPath: revealExplorerPath,
  showPathProperties: showExplorerPathProperties,
  openPathAsAdmin: openExplorerPathAsAdmin,
  createDir: createExplorerDir,
  createFile: createExplorerFile,
  extractArchive: extractExplorerArchive,
  transferItems: transferExplorerItems,
  listTasks: listExplorerTasks,
  clearTaskHistory: clearExplorerTaskHistory,
  retryTask: retryExplorerTask,
  cancelTask: cancelExplorerTask,
  writeFile: writeExplorerFile,
  readTextFile: readExplorerTextFile,
  readFileBase64: readExplorerFileBase64,
  readImageThumbnail: readExplorerImageThumbnail,
  readEntryThumbnail: readExplorerEntryThumbnail,
  renamePath: renameExplorerPath,
  deletePath: deleteExplorerPath,
  trashPaths: trashExplorerPaths,
  restoreRecentTrashAction: restoreExplorerTrashAction,
  batchRename: batchRenameExplorerPaths,
  startDuplicateScan: startExplorerDuplicateScan,
  pollDuplicateScan: pollExplorerDuplicateScan,
  cancelDuplicateScan: cancelExplorerDuplicateScan,
  listTags: listExplorerTags,
  setTagsForPaths: setExplorerTagsForPaths,
  listSavedSearches: listExplorerSavedSearches,
  saveSavedSearch: saveExplorerSavedSearch,
  deleteSavedSearch: deleteExplorerSavedSearch,
  isCloudPath: isCloudExplorerPath,
  supportsSearch: supportsExplorerSearch,
  supportsNativeIntegration: supportsExplorerNativeIntegration,
  supportsNativeDragOut: supportsExplorerNativeDragOut,
};

export async function listenToExplorerTaskProgress(
  listener: (event: ExplorerTaskProgress) => void,
): Promise<() => void> {
  return events.explorerTaskProgressEvent.listen(
    (event: { payload: ExplorerTaskProgress }) => listener(event.payload),
  );
}

function getSchedulerTaskProgressPercent(task: ExplorerSchedulerTask): number | null {
  switch (task.prog.kind) {
    case 'fileCopy':
    case 'fileCut':
    case 'fileDelete':
    case 'fileDownload':
    case 'fileUpload':
      return task.prog.totalBytes > 0
        ? Math.min(100, Math.round((task.prog.processedBytes / task.prog.totalBytes) * 100))
        : task.prog.collected === true
          ? 100
          : task.prog.failedFiles > 0
            ? 0
            : null;
    case 'fileHardlink':
      return task.prog.total > 0
        ? Math.min(100, Math.round((task.prog.success / task.prog.total) * 100))
        : task.prog.collected === true
          ? 100
          : task.prog.failed > 0
            ? 0
            : null;
    case 'fileLink':
    case 'fileTrash':
      return null;
    default:
      return null;
  }
}

function didSchedulerTaskFail(task: ExplorerSchedulerTask): boolean {
  switch (task.prog.kind) {
    case 'fileCopy':
    case 'fileCut':
    case 'fileDelete':
    case 'fileDownload':
    case 'fileUpload':
      return task.prog.cleaned === false || task.prog.collected === false;
    case 'fileHardlink':
      return task.prog.collected === false;
    case 'fileLink':
      return task.prog.state === false;
    case 'fileTrash':
      return task.prog.cleaned === false || task.prog.state === false;
    default:
      return false;
  }
}

function isSchedulerTaskFinished(task: ExplorerSchedulerTask): boolean {
  switch (task.prog.kind) {
    case 'fileCopy':
    case 'fileCut':
    case 'fileDelete':
    case 'fileDownload':
    case 'fileUpload':
      return task.prog.cleaned !== null || task.prog.collected === false;
    case 'fileHardlink':
      return task.prog.collected !== null;
    case 'fileLink':
      return task.prog.state !== null;
    case 'fileTrash':
      return task.prog.cleaned !== null || task.prog.state === false;
    default:
      return false;
  }
}

export function getExplorerTaskProgressPercent(task: ExplorerTaskSnapshot | ExplorerSchedulerTask): number | null {
  if ('status' in task) {
    if (typeof task.progressCurrent === 'number' && typeof task.progressTotal === 'number' && task.progressTotal > 0) {
      return Math.min(100, Math.round((task.progressCurrent / task.progressTotal) * 100));
    }
    if (task.schedulerTask) {
      return getSchedulerTaskProgressPercent(task.schedulerTask);
    }
    return null;
  }

  return getSchedulerTaskProgressPercent(task);
}

export function didExplorerTaskFail(task: ExplorerTaskSnapshot | ExplorerSchedulerTask): boolean {
  if ('status' in task) {
    return task.status === 'failed';
  }

  return didSchedulerTaskFail(task);
}

export function isExplorerTaskFinished(task: ExplorerTaskSnapshot | ExplorerSchedulerTask): boolean {
  if ('status' in task) {
    return task.status !== 'running';
  }

  return isSchedulerTaskFinished(task);
}

export function getExplorerTaskStatusLabel(task: ExplorerTaskSnapshot | ExplorerSchedulerTask): string {
  if ('status' in task) {
    if (task.status === 'failed') {
      return 'Failed';
    }
    if (task.status === 'cancelled') {
      return 'Cancelled';
    }
    const percent = getExplorerTaskProgressPercent(task);
    if (percent != null && task.status === 'running') {
      return `${percent}%`;
    }
    return task.status === 'succeeded' ? 'Done' : 'Working…';
  }

  if (didSchedulerTaskFail(task)) {
    return 'Failed';
  }

  const percent = getSchedulerTaskProgressPercent(task);
  if (percent != null && !isSchedulerTaskFinished(task)) {
    return `${percent}%`;
  }

  return isSchedulerTaskFinished(task) ? 'Done' : 'Working…';
}
