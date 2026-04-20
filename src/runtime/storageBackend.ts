import {
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
} from '../generated/tauri';
import { commands, unwrapTauriResult } from './tauriClient';

export type StorageScanStart = StorageScanStartResponse;
export type StorageScanSnapshot = StorageScanStatus;
export type StorageScanEntry = StoragePathSummary;
export type StorageTreeSnapshotNode = StorageTreeNode;
export type StorageTreeSnapshotNodeKind = StorageNodeKind;

export async function getStorageRoots(): Promise<ExplorerLocalDriveInfo[]> {
  const drives = await getExplorerDrives();
  return drives.filter((drive): drive is ExplorerLocalDriveInfo => drive.kind === 'local');
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

export async function deleteStorageEntry(path: string, isDirectory: boolean): Promise<void> {
  await deleteExplorerPath(path, isDirectory);
}

export type StorageRootInfo = ExplorerLocalDriveInfo;
export type StorageDriveInfo = ExplorerDriveInfo;
