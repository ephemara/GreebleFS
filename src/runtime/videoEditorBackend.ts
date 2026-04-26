import {
  type ResolvedVideoPreviewSource,
  type VideoTrimExportRequest,
  type VideoTrimExportResult,
} from '../generated/tauri';
import { readExplorerPreviewBytes } from './explorerBackend';
import { commands, unwrapTauriResult } from './tauriClient';

export type ExplorerVideoPreviewSource = ResolvedVideoPreviewSource;
export type ExplorerVideoTrimExportInput = VideoTrimExportRequest;
export type ExplorerVideoTrimExportOutput = VideoTrimExportResult;
export const EXPLORER_VIDEO_PREVIEW_MAX_BYTES = 256 * 1024 * 1024;

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

export async function readExplorerVideoPreviewBytes(
  inputPath: string,
  maxBytes: number = EXPLORER_VIDEO_PREVIEW_MAX_BYTES,
): Promise<Uint8Array> {
  return readExplorerPreviewBytes(inputPath, maxBytes);
}

export async function exportExplorerVideoTrim(
  request: ExplorerVideoTrimExportInput,
): Promise<ExplorerVideoTrimExportOutput> {
  return unwrapTauriResult(await commands.videoExportTrim(request));
}
