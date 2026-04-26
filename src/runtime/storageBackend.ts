import {
  deleteExplorerPaths,
  deleteExplorerPath,
  getExplorerDrives,
  openExplorerPath,
  revealExplorerPath,
  trashExplorerPaths,
  type ExplorerDriveInfo,
  type ExplorerLocalDriveInfo,
} from './explorerBackend';
import {
  type StorageNodeKind,
  type StoragePathSummary,
  type StorageScanStartResponse,
  type StorageScanStatus,
  type StorageTreeNode,
  type StorageTypeBucketSummary,
} from '../generated/tauri';
import { commands, unwrapTauriResult } from './tauriClient';

export type StorageScanStart = StorageScanStartResponse;
export type StorageScanSnapshot = StorageScanStatus;
export type StorageScanEntry = StoragePathSummary;
export type StorageTreeSnapshotNode = StorageTreeNode;
export type StorageTreeSnapshotNodeKind = StorageNodeKind;
export type StorageTypeBucketSnapshot = StorageTypeBucketSummary;

export async function getStorageRoots(): Promise<ExplorerLocalDriveInfo[]> {
  const drives = await getExplorerDrives();
  return drives.filter(
    (drive): drive is ExplorerLocalDriveInfo =>
      drive.kind === 'local' && drive.capabilities.supportsScan,
  );
}

export async function startStorageScan(rootPath: string): Promise<StorageScanStart> {
  return unwrapTauriResult(await commands.storageScanStart(rootPath));
}

export async function pollStorageScan(scanId: string): Promise<StorageScanSnapshot> {
  return unwrapTauriResult(await commands.storageScanPoll(scanId));
}

export async function cancelStorageScan(scanId: string): Promise<void> {
  unwrapTauriResult(await commands.storageScanCancel(scanId));
}

export async function listStorageDirectory(
  scanId: string,
  directoryPath: string,
): Promise<StorageScanEntry[]> {
  return unwrapTauriResult(await commands.storageScanListDirectory(scanId, directoryPath));
}

export async function isStorageProcessElevated(): Promise<boolean> {
  return unwrapTauriResult(await commands.fsIsProcessElevated());
}

export async function openStorageEntry(path: string): Promise<void> {
  await openExplorerPath(path);
}

export async function revealStorageEntry(path: string): Promise<void> {
  await revealExplorerPath(path);
}

export async function trashStorageEntry(path: string): Promise<void> {
  await trashExplorerPaths([path]);
}

export async function trashStorageEntries(paths: string[]): Promise<void> {
  await trashExplorerPaths(paths);
}

export async function deleteStorageEntry(path: string, isDirectory: boolean): Promise<void> {
  await deleteExplorerPath(path, isDirectory);
}

export async function deleteStorageEntries(paths: string[]): Promise<void> {
  await deleteExplorerPaths(paths);
}

export type StorageRootInfo = ExplorerLocalDriveInfo;
export type StorageDriveInfo = ExplorerDriveInfo;
