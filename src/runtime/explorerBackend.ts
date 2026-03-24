import { invoke } from '@tauri-apps/api/core';
import type { FileSearchResponse } from '../config/searchTelemetry';

export interface ExplorerFileEntry {
  name: string;
  path: string;
  is_dir: boolean;
  size: number;
  modified: number;
  extension: string;
  is_hidden: boolean;
  is_symlink: boolean;
}

export interface ExplorerFileSearchResult extends ExplorerFileEntry {
  relative_path: string;
  snippet: string;
  line_number: number | null;
  match_kind: 'name' | 'content' | 'name_and_content';
}

export interface ExplorerDriveInfo {
  letter: string;
  label: string;
  total_bytes: number;
  free_bytes: number;
  drive_type: string;
}

export interface ExplorerEntryStorageInfo {
  path: string;
  bytes: number;
  is_dir: boolean;
  is_complete: boolean;
}

export type ExplorerWritableContent = string | number[];

export async function listExplorerDir(path: string, showHidden: boolean): Promise<ExplorerFileEntry[]> {
  return invoke<ExplorerFileEntry[]>('fs_list_dir', { path, showHidden });
}

export async function listExplorerDirUncached(
  path: string,
  showHidden: boolean,
): Promise<ExplorerFileEntry[]> {
  return invoke<ExplorerFileEntry[]>('fs_list_dir_uncached', { path, showHidden });
}

export async function getExplorerDrives(): Promise<ExplorerDriveInfo[]> {
  return invoke<ExplorerDriveInfo[]>('fs_get_drives');
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
  return invoke<FileSearchResponse<ExplorerFileSearchResult>>(
    'fs_search_entries_with_diagnostics',
    args,
  );
}

export async function cancelExplorerSearchEntries(args: {
  path: string;
  requestId?: number;
  requestScope?: string;
}): Promise<void> {
  await invoke('fs_cancel_search_entries', args);
}

export async function watchExplorerEntrySizeRoot(path: string): Promise<void> {
  await invoke('fs_watch_entry_size_root', { path });
}

export async function unwatchExplorerEntrySizeRoot(path: string): Promise<void> {
  await invoke('fs_unwatch_entry_size_root', { path });
}

export async function openExplorerPath(path: string): Promise<void> {
  await invoke('fs_open_file', { path });
}

export async function revealExplorerPath(path: string): Promise<void> {
  await invoke('fs_reveal_in_explorer', { path });
}

export async function openExplorerPathAsAdmin(path: string): Promise<void> {
  await invoke('fs_open_as_admin', { path });
}

export async function createExplorerDir(path: string): Promise<void> {
  await invoke('fs_create_dir', { path });
}

export async function writeExplorerFile(
  path: string,
  content: ExplorerWritableContent,
): Promise<void> {
  await invoke('fs_write_file', { path, content });
}

export async function readExplorerTextFile(path: string): Promise<string> {
  return invoke<string>('fs_read_text_file', { path });
}

export async function renameExplorerPath(oldPath: string, newPath: string): Promise<void> {
  await invoke('fs_rename', { oldPath, newPath });
}

export async function deleteExplorerPath(path: string, recursive: boolean): Promise<void> {
  await invoke('fs_delete', { path, recursive });
}
