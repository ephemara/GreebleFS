import {
  type ResolvedVideoPreviewSource,
  type VideoTrimExportRequest,
  type VideoTrimExportResult,
} from '../generated/tauri';
import { commands, unwrapTauriResult } from './tauriClient';

export type ExplorerVideoPreviewSource = ResolvedVideoPreviewSource;
export type ExplorerVideoTrimExportInput = VideoTrimExportRequest;
export type ExplorerVideoTrimExportOutput = VideoTrimExportResult;

export async function createExplorerVideoPreviewProxy(
  inputPath: string,
): Promise<ExplorerVideoPreviewSource> {
  return unwrapTauriResult(await commands.videoCreatePreviewProxy(inputPath));
}

export async function resolveExplorerVideoPreviewSource(
  inputPath: string,
): Promise<ExplorerVideoPreviewSource> {
  return unwrapTauriResult(await commands.videoResolvePreviewSource(inputPath));
}

export async function exportExplorerVideoTrim(
  request: ExplorerVideoTrimExportInput,
): Promise<ExplorerVideoTrimExportOutput> {
  return unwrapTauriResult(await commands.videoExportTrim(request));
}
