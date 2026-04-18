import type {
  ImageAdjustmentState,
  ImageEditorExportRequest,
  ImageEditorExportResult,
  ImageEditorPreviewRequest,
  ImageEditorPreviewResult,
  ImageEditorSessionBootstrap,
  ImageEditorSessionCreateRequest,
  ImageFilterPresetDefinition,
  ImageFilterPresetId,
} from '../generated/tauri';
import { commands, unwrapTauriResult } from './tauriClient';

export type ExplorerImageAdjustmentState = ImageAdjustmentState;
export type ExplorerImageFilterPresetId = ImageFilterPresetId;
export type ExplorerImageFilterPresetDefinition = ImageFilterPresetDefinition;
export type ExplorerImageEditorSessionCreateInput = ImageEditorSessionCreateRequest;
export type ExplorerImageEditorSessionBootstrap = ImageEditorSessionBootstrap;
export type ExplorerImageEditorPreviewInput = ImageEditorPreviewRequest;
export type ExplorerImageEditorPreviewOutput = ImageEditorPreviewResult;
export type ExplorerImageEditorExportInput = ImageEditorExportRequest;
export type ExplorerImageEditorExportOutput = ImageEditorExportResult;

export async function createExplorerImageEditorSession(
  request: ExplorerImageEditorSessionCreateInput,
): Promise<ExplorerImageEditorSessionBootstrap> {
  return unwrapTauriResult(await commands.imageEditorCreateSession(request));
}

export async function renderExplorerImageEditorPreview(
  request: ExplorerImageEditorPreviewInput,
): Promise<ExplorerImageEditorPreviewOutput> {
  return unwrapTauriResult(await commands.imageEditorRenderPreview(request));
}

export async function exportExplorerImageEditorResult(
  request: ExplorerImageEditorExportInput,
): Promise<ExplorerImageEditorExportOutput> {
  return unwrapTauriResult(await commands.imageEditorExport(request));
}

export async function closeExplorerImageEditorSession(sessionId: string): Promise<void> {
  await unwrapTauriResult(await commands.imageEditorCloseSession(sessionId));
}
