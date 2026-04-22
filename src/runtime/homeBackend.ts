import { commands, unwrapTauriResult } from './tauriClient';
import type {
  ExplorerHomeUsageRecord,
  ExplorerHomeUsageSnapshot,
} from '../generated/tauri';

export type ExplorerHomeUsageEntry = ExplorerHomeUsageRecord;
export type ExplorerHomeUsageSnapshotValue = ExplorerHomeUsageSnapshot;

export async function listExplorerHomeUsage(): Promise<ExplorerHomeUsageSnapshotValue> {
  return unwrapTauriResult(await commands.explorerHomeUsageList());
}

export async function recordExplorerHomeUsage(
  path: string,
): Promise<ExplorerHomeUsageSnapshotValue> {
  return unwrapTauriResult(await commands.explorerHomeUsageRecord(path));
}

export async function clearExplorerHomeUsage(): Promise<ExplorerHomeUsageSnapshotValue> {
  return unwrapTauriResult(await commands.explorerHomeUsageClear());
}
