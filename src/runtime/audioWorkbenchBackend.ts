import type {
  AudioBatchProcessRequest,
  AudioBatchProcessResult,
  AudioPreviewAnalysis,
  AudioTransformRequest,
  AudioTransformResult,
  ResolvedAudioPreviewSource,
} from '../generated/tauri';
import { commands, unwrapTauriResult } from './tauriClient';

export type ExplorerAudioPreviewAnalysis = AudioPreviewAnalysis;
export type ExplorerAudioPreviewSource = ResolvedAudioPreviewSource;
export type ExplorerAudioTransformInput = AudioTransformRequest;
export type ExplorerAudioTransformOutput = AudioTransformResult;
export type ExplorerAudioBatchInput = AudioBatchProcessRequest;
export type ExplorerAudioBatchOutput = AudioBatchProcessResult;

export async function analyzeExplorerAudioPreview(
  inputPath: string,
): Promise<ExplorerAudioPreviewAnalysis> {
  return unwrapTauriResult(await commands.audioAnalyzePreview(inputPath));
}

export async function createExplorerAudioPreviewProxy(
  inputPath: string,
): Promise<ExplorerAudioPreviewSource> {
  return unwrapTauriResult(await commands.audioCreatePreviewProxy(inputPath));
}

export async function resolveExplorerAudioPreviewSource(
  inputPath: string,
): Promise<ExplorerAudioPreviewSource> {
  return unwrapTauriResult(await commands.audioResolvePreviewSource(inputPath));
}

export async function exportExplorerAudioTransform(
  request: ExplorerAudioTransformInput,
): Promise<ExplorerAudioTransformOutput> {
  return unwrapTauriResult(await commands.audioExportTransform(request));
}

export async function runExplorerAudioBatchProcess(
  request: ExplorerAudioBatchInput,
): Promise<ExplorerAudioBatchOutput> {
  return unwrapTauriResult(await commands.audioBatchProcess(request));
}
