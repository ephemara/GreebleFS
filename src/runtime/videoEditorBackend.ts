import { type VideoTrimExportRequest, type VideoTrimExportResult } from '../generated/tauri';
import { commands, unwrapTauriResult } from './tauriClient';

export type ExplorerVideoTrimExportInput = VideoTrimExportRequest;
export type ExplorerVideoTrimExportOutput = VideoTrimExportResult;

export async function exportExplorerVideoTrim(
  request: ExplorerVideoTrimExportInput,
): Promise<ExplorerVideoTrimExportOutput> {
  return unwrapTauriResult(await commands.videoExportTrim(request));
}
