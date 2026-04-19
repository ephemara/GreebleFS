import { commands } from './tauriClient';
import type { VstPluginEntry, VstScanPath } from '../generated/tauri';

export type ExplorerVstScanPath = VstScanPath;
export type ExplorerVstPluginEntry = VstPluginEntry;

export async function getExplorerVstDefaultScanPaths(): Promise<ExplorerVstScanPath[]> {
  return await commands.vstGetDefaultScanPaths();
}

export async function scanExplorerVstPlugins(paths: string[]): Promise<ExplorerVstPluginEntry[]> {
  return await commands.vstScanPlugins(paths);
}
