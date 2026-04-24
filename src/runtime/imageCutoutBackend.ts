import type {
  ImageCutoutApplyPromptsRequest,
  ImageCutoutCopyToClipboardRequest,
  ImageCutoutSessionOpenRequest,
  ImageCutoutSessionSnapshot,
  ImageCutoutStageExportRequest,
  ImageCutoutStagedExportArtifact,
} from '../generated/tauri';
import { commands, unwrapTauriResult } from './tauriClient';

export type ExplorerImageCutoutSessionOpenInput = ImageCutoutSessionOpenRequest;
export type ExplorerImageCutoutPromptApplyInput = ImageCutoutApplyPromptsRequest;
export type ExplorerImageCutoutStageExportInput = ImageCutoutStageExportRequest;
export type ExplorerImageCutoutCopyInput = ImageCutoutCopyToClipboardRequest;
export type ExplorerImageCutoutSessionSnapshot = ImageCutoutSessionSnapshot;
export type ExplorerImageCutoutStagedExportArtifact = ImageCutoutStagedExportArtifact;

export async function openExplorerImageCutoutSession(
  request: ExplorerImageCutoutSessionOpenInput,
): Promise<ExplorerImageCutoutSessionSnapshot> {
  return unwrapTauriResult(await commands.imageCutoutOpenSession(request));
}

export async function applyExplorerImageCutoutPrompts(
  request: ExplorerImageCutoutPromptApplyInput,
): Promise<ExplorerImageCutoutSessionSnapshot> {
  return unwrapTauriResult(await commands.imageCutoutApplyPrompts(request));
}

export async function resetExplorerImageCutoutSession(
  sessionId: string,
): Promise<ExplorerImageCutoutSessionSnapshot> {
  return unwrapTauriResult(
    await commands.imageCutoutResetSession({ sessionId }),
  );
}

export async function stageExplorerImageCutoutExport(
  request: ExplorerImageCutoutStageExportInput,
): Promise<ExplorerImageCutoutStagedExportArtifact> {
  return unwrapTauriResult(await commands.imageCutoutStageExport(request));
}

export async function copyExplorerImageCutoutToClipboard(
  request: ExplorerImageCutoutCopyInput,
): Promise<ExplorerImageCutoutStagedExportArtifact> {
  return unwrapTauriResult(await commands.imageCutoutCopyToClipboard(request));
}

export async function closeExplorerImageCutoutSession(sessionId: string): Promise<void> {
  await unwrapTauriResult(await commands.imageCutoutCloseSession(sessionId));
}

export async function startExplorerImageCutoutNativeDrag(path: string): Promise<void> {
  await unwrapTauriResult(await commands.fsStartNativeFileDrag([path]));
}
