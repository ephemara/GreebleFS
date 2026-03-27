import type { FileSearchResponse } from '../config/searchTelemetry';
import type { FsRuntimeCachePolicy } from '../config/runtimeCachePolicy';
import { commands, events, unwrapTauriResult } from './tauriClient';
import {
  type DriveInfo,
  type EntryStorageInfo,
  type ExplorerTaskProgressEvent,
  type FileEntry,
  type FileSearchResult,
  type FileTransferOperation,
  type FileTransferResult,
  type FsWriteFileContent,
  type YaziSchedulerTaskSnap,
} from '../generated/tauri';

export type ExplorerFileEntry = FileEntry;
export type ExplorerFileSearchResult = FileSearchResult;
export type ExplorerDriveInfo = DriveInfo;
export type ExplorerEntryStorageInfo = EntryStorageInfo;
export type ExplorerFileTransferOperation = FileTransferOperation;
export type ExplorerFileTransferResult = FileTransferResult;
export type ExplorerTaskProgress = ExplorerTaskProgressEvent;
export type ExplorerSchedulerTask = YaziSchedulerTaskSnap;
export type ExplorerWritableContent = string | number[];

export type ExplorerBackendContract = {
  listDir: typeof listExplorerDir;
  listDirUncached: typeof listExplorerDirUncached;
  getDrives: typeof getExplorerDrives;
  measureEntrySizes: typeof measureExplorerEntrySizes;
  getRuntimeCachePolicy: typeof getExplorerRuntimeCachePolicy;
  getHomeDir: typeof getExplorerHomeDir;
  searchEntriesWithDiagnostics: typeof searchExplorerEntriesWithDiagnostics;
  cancelSearchEntries: typeof cancelExplorerSearchEntries;
  watchEntrySizeRoot: typeof watchExplorerEntrySizeRoot;
  unwatchEntrySizeRoot: typeof unwatchExplorerEntrySizeRoot;
  openPath: typeof openExplorerPath;
  revealPath: typeof revealExplorerPath;
  openPathAsAdmin: typeof openExplorerPathAsAdmin;
  createDir: typeof createExplorerDir;
  transferItems: typeof transferExplorerItems;
  writeFile: typeof writeExplorerFile;
  readTextFile: typeof readExplorerTextFile;
  readFileBase64: typeof readExplorerFileBase64;
  renamePath: typeof renameExplorerPath;
  deletePath: typeof deleteExplorerPath;
};

export async function listExplorerDir(path: string, showHidden: boolean): Promise<ExplorerFileEntry[]> {
  return unwrapTauriResult(await commands.fsListDir(path, showHidden));
}

export async function listExplorerDirUncached(
  path: string,
  showHidden: boolean,
): Promise<ExplorerFileEntry[]> {
  return unwrapTauriResult(await commands.fsListDirUncached(path, showHidden));
}

export async function getExplorerDrives(): Promise<ExplorerDriveInfo[]> {
  return unwrapTauriResult(await commands.fsGetDrives());
}

export async function measureExplorerEntrySizes(
  paths: string[],
  forceRefresh = false,
): Promise<ExplorerEntryStorageInfo[]> {
  return unwrapTauriResult(await commands.fsMeasureEntrySizes(paths, forceRefresh));
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
  unwrapTauriResult(await commands.fsCancelSearchEntries(
    args.path,
    args.requestId ?? null,
    args.requestScope ?? null,
  ));
}

export async function watchExplorerEntrySizeRoot(path: string): Promise<void> {
  unwrapTauriResult(await commands.fsWatchEntrySizeRoot(path));
}

export async function unwatchExplorerEntrySizeRoot(path: string): Promise<void> {
  unwrapTauriResult(await commands.fsUnwatchEntrySizeRoot(path));
}

export async function openExplorerPath(path: string): Promise<void> {
  unwrapTauriResult(await commands.fsOpenFile(path));
}

export async function revealExplorerPath(path: string): Promise<void> {
  unwrapTauriResult(await commands.fsRevealInExplorer(path));
}

export async function openExplorerPathAsAdmin(path: string): Promise<void> {
  unwrapTauriResult(await commands.fsOpenAsAdmin(path));
}

export async function createExplorerDir(path: string): Promise<void> {
  unwrapTauriResult(await commands.fsCreateDir(path));
}

export async function transferExplorerItems(
  targetDir: string,
  sources: string[],
  operation: ExplorerFileTransferOperation,
): Promise<ExplorerFileTransferResult[]> {
  return unwrapTauriResult(await commands.fsTransferItems(targetDir, sources, operation));
}

export async function writeExplorerFile(
  path: string,
  content: ExplorerWritableContent,
): Promise<void> {
  const payload: FsWriteFileContent =
    typeof content === 'string'
      ? { kind: 'text', value: content }
      : { kind: 'bytes', value: content };
  unwrapTauriResult(await commands.fsWriteFile(path, payload));
}

export async function readExplorerTextFile(path: string): Promise<string> {
  return unwrapTauriResult(await commands.fsReadTextFile(path));
}

export async function readExplorerFileBase64(path: string): Promise<string> {
  return unwrapTauriResult(await commands.fsReadFileBase64(path));
}

export async function renameExplorerPath(oldPath: string, newPath: string): Promise<void> {
  unwrapTauriResult(await commands.fsRename(oldPath, newPath));
}

export async function deleteExplorerPath(path: string, recursive: boolean): Promise<void> {
  unwrapTauriResult(await commands.fsDelete(path, recursive));
}

export const explorerBackendContract: ExplorerBackendContract = {
  listDir: listExplorerDir,
  listDirUncached: listExplorerDirUncached,
  getDrives: getExplorerDrives,
  measureEntrySizes: measureExplorerEntrySizes,
  getRuntimeCachePolicy: getExplorerRuntimeCachePolicy,
  getHomeDir: getExplorerHomeDir,
  searchEntriesWithDiagnostics: searchExplorerEntriesWithDiagnostics,
  cancelSearchEntries: cancelExplorerSearchEntries,
  watchEntrySizeRoot: watchExplorerEntrySizeRoot,
  unwatchEntrySizeRoot: unwatchExplorerEntrySizeRoot,
  openPath: openExplorerPath,
  revealPath: revealExplorerPath,
  openPathAsAdmin: openExplorerPathAsAdmin,
  createDir: createExplorerDir,
  transferItems: transferExplorerItems,
  writeFile: writeExplorerFile,
  readTextFile: readExplorerTextFile,
  readFileBase64: readExplorerFileBase64,
  renamePath: renameExplorerPath,
  deletePath: deleteExplorerPath,
};

export async function listenToExplorerTaskProgress(
  listener: (event: ExplorerTaskProgress) => void,
): Promise<() => void> {
  return events.explorerTaskProgressEvent.listen(
    (event: { payload: ExplorerTaskProgress }) => listener(event.payload),
  );
}

export function getExplorerTaskProgressPercent(task: ExplorerSchedulerTask): number | null {
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
    default:
      return null;
  }
}

export function didExplorerTaskFail(task: ExplorerSchedulerTask): boolean {
  switch (task.prog.kind) {
    case 'fileCopy':
    case 'fileCut':
    case 'fileDelete':
    case 'fileDownload':
    case 'fileUpload':
      return task.prog.cleaned === false || task.prog.collected === false;
    default:
      return false;
  }
}

export function isExplorerTaskFinished(task: ExplorerSchedulerTask): boolean {
  switch (task.prog.kind) {
    case 'fileCopy':
    case 'fileCut':
    case 'fileDelete':
    case 'fileDownload':
    case 'fileUpload':
      return task.prog.cleaned !== null || task.prog.collected === false;
    default:
      return false;
  }
}

export function getExplorerTaskStatusLabel(task: ExplorerSchedulerTask): string {
  if (didExplorerTaskFail(task)) {
    return 'Failed';
  }

  const percent = getExplorerTaskProgressPercent(task);
  if (percent != null && !isExplorerTaskFinished(task)) {
    return `${percent}%`;
  }

  return isExplorerTaskFinished(task) ? 'Done' : 'Working…';
}
