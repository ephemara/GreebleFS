import { commands, unwrapTauriResult } from './tauriClient';
import type { VstPluginEntry, VstScanPath } from '../generated/tauri';

export type ExplorerVstScanPath = VstScanPath;
export type ExplorerVstPluginEntry = VstPluginEntry;

export async function getExplorerVstDefaultScanPaths(): Promise<ExplorerVstScanPath[]> {
  return unwrapTauriResult(await commands.vstGetDefaultScanPaths());
}

export async function scanExplorerVstPlugins(paths: string[]): Promise<ExplorerVstPluginEntry[]> {
  return unwrapTauriResult(await commands.vstScanPlugins(paths));
}
