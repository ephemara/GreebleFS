import type {
  ImageCutoutApplyPromptsRequest,
  ImageCutoutCopyToClipboardRequest,
  ImageCutoutExportFilterState,
  ImageCutoutExportMode,
  ImageCutoutSessionOpenRequest,
  ImageCutoutSessionSnapshot,
  ImageCutoutStageExportRequest,
  ImageCutoutStagedExportArtifact,
  ImageCutoutWorkflowMode,
  PythonRuntimeConfig,
} from "../generated/tauri";
import {
  releaseIpcArtifact,
  stageIpcArtifactBytes,
  toIpcArtifactRef,
} from "./ipc";
import { commands, unwrapTauriResult } from "./tauriClient";

const CUTOUT_INPUT_ARTIFACT_KIND = "image.cutout.input";
const CUTOUT_OVERRIDE_MASK_ARTIFACT_KIND = "image.cutout.override-mask";

export interface ExplorerImageCutoutSessionOpenInput {
  sourceImageUrl: string;
  imagePath: string;
  logicalOutputPath?: string | null;
  previewMaxDimension?: number | null;
  config?: PythonRuntimeConfig | null;
  modelId?: string | null;
  backendPreference?: string | null;
  workflowMode: ImageCutoutWorkflowMode;
}

export type ExplorerImageCutoutPromptApplyInput = ImageCutoutApplyPromptsRequest;

export interface ExplorerImageCutoutStageExportInput {
  sessionId: string;
  exportMode: ImageCutoutExportMode;
  logicalOutputPath?: string | null;
  filters?: ImageCutoutExportFilterState | null;
  overrideMaskPngBytes?: Uint8Array | null;
}

export interface ExplorerImageCutoutCopyInput {
  sessionId: string;
  logicalOutputPath?: string | null;
  filters?: ImageCutoutExportFilterState | null;
  overrideMaskPngBytes?: Uint8Array | null;
}

export type ExplorerImageCutoutSessionSnapshot = ImageCutoutSessionSnapshot;
export type ExplorerImageCutoutStagedExportArtifact = ImageCutoutStagedExportArtifact;

export async function openExplorerImageCutoutSession(
  request: ExplorerImageCutoutSessionOpenInput,
): Promise<ExplorerImageCutoutSessionSnapshot> {
  if (isLocalFilesystemPath(request.imagePath)) {
    return unwrapTauriResult(
      await commands.imageCutoutOpenSession({
        inputPath: request.imagePath.trim(),
        inputArtifact: null,
        inputDataUrl: null,
        logicalOutputPath: request.logicalOutputPath ?? request.imagePath,
        previewMaxDimension: request.previewMaxDimension ?? null,
        config: request.config ?? null,
        modelId: request.modelId ?? null,
        backendPreference: request.backendPreference ?? null,
        workflowMode: request.workflowMode,
      } satisfies ImageCutoutSessionOpenRequest),
    );
  }

  const stagedInputArtifact = await stageIpcArtifactBytes({
    kind: CUTOUT_INPUT_ARTIFACT_KIND,
    bytes: await readImageSourceBytes(request.sourceImageUrl),
    mediaType: inferImageMediaType(request.sourceImageUrl, request.imagePath),
    retention: "ephemeral",
    deleteOnRelease: true,
    suggestedFileName: `cutout-input${resolvePreferredImageExtension(
      request.sourceImageUrl,
      request.imagePath,
    )}`,
  });
  try {
    return unwrapTauriResult(
      await commands.imageCutoutOpenSession({
        inputPath: null,
        inputArtifact: toIpcArtifactRef(stagedInputArtifact),
        inputDataUrl: null,
        logicalOutputPath: request.logicalOutputPath ?? request.imagePath,
        previewMaxDimension: request.previewMaxDimension ?? null,
        config: request.config ?? null,
        modelId: request.modelId ?? null,
        backendPreference: request.backendPreference ?? null,
        workflowMode: request.workflowMode,
      } satisfies ImageCutoutSessionOpenRequest),
    );
  } finally {
    await releaseArtifactBestEffort(stagedInputArtifact);
  }
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
  const stagedMaskArtifact = request.overrideMaskPngBytes?.length
    ? await stageIpcArtifactBytes({
        kind: CUTOUT_OVERRIDE_MASK_ARTIFACT_KIND,
        bytes: request.overrideMaskPngBytes,
        mediaType: "image/png",
        retention: "ephemeral",
        deleteOnRelease: true,
        suggestedFileName: "cutout-mask.png",
      })
    : null;

  try {
    return unwrapTauriResult(
      await commands.imageCutoutStageExport({
        sessionId: request.sessionId,
        exportMode: request.exportMode,
        logicalOutputPath: request.logicalOutputPath ?? null,
        filters: request.filters ?? null,
        overrideMaskArtifact: stagedMaskArtifact
          ? toIpcArtifactRef(stagedMaskArtifact)
          : null,
        overrideMaskDataUrl: null,
      } satisfies ImageCutoutStageExportRequest),
    );
  } finally {
    if (stagedMaskArtifact) {
      await releaseArtifactBestEffort(stagedMaskArtifact);
    }
  }
}

export async function copyExplorerImageCutoutToClipboard(
  request: ExplorerImageCutoutCopyInput,
): Promise<ExplorerImageCutoutStagedExportArtifact> {
  const stagedMaskArtifact = request.overrideMaskPngBytes?.length
    ? await stageIpcArtifactBytes({
        kind: CUTOUT_OVERRIDE_MASK_ARTIFACT_KIND,
        bytes: request.overrideMaskPngBytes,
        mediaType: "image/png",
        retention: "ephemeral",
        deleteOnRelease: true,
        suggestedFileName: "cutout-mask.png",
      })
    : null;

  try {
    return unwrapTauriResult(
      await commands.imageCutoutCopyToClipboard({
        sessionId: request.sessionId,
        logicalOutputPath: request.logicalOutputPath ?? null,
        filters: request.filters ?? null,
        overrideMaskArtifact: stagedMaskArtifact
          ? toIpcArtifactRef(stagedMaskArtifact)
          : null,
        overrideMaskDataUrl: null,
      } satisfies ImageCutoutCopyToClipboardRequest),
    );
  } finally {
    if (stagedMaskArtifact) {
      await releaseArtifactBestEffort(stagedMaskArtifact);
    }
  }
}

export async function closeExplorerImageCutoutSession(sessionId: string): Promise<void> {
  await unwrapTauriResult(await commands.imageCutoutCloseSession(sessionId));
}

export async function startExplorerImageCutoutNativeDrag(path: string): Promise<void> {
  await unwrapTauriResult(await commands.fsStartNativeFileDrag([path]));
}

async function releaseArtifactBestEffort(
  artifact: ReturnType<typeof toIpcArtifactRef> | { id: string },
): Promise<void> {
  try {
    await releaseIpcArtifact(artifact.id);
  } catch {
    // Best-effort cleanup for ephemeral staged input artifacts.
  }
}

function isLocalFilesystemPath(path: string | null | undefined): boolean {
  const trimmed = path?.trim();
  if (!trimmed) {
    return false;
  }
  if (trimmed.includes("://")) {
    return false;
  }
  return trimmed.startsWith("/") || /^[a-zA-Z]:[\\/]/.test(trimmed);
}

async function readImageSourceBytes(sourceImageUrl: string): Promise<Uint8Array> {
  const trimmedSource = sourceImageUrl.trim();
  if (!trimmedSource) {
    throw new Error("Image cutout staging requires a non-empty sourceImageUrl.");
  }
  if (trimmedSource.startsWith("data:")) {
    return decodeDataUrlBytes(trimmedSource);
  }

  const response = await fetch(trimmedSource);
  if (!response.ok) {
    throw new Error(
      `Failed to read staged image source (${response.status} ${response.statusText}).`,
    );
  }
  return new Uint8Array(await response.arrayBuffer());
}

function decodeDataUrlBytes(dataUrl: string): Uint8Array {
  const [, encodedPayload = ""] = dataUrl.split(",", 2);
  const binary = atob(encodedPayload);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function inferImageMediaType(
  sourceImageUrl: string,
  imagePath: string,
): string | null {
  const dataUrlMatch = sourceImageUrl.trim().match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,/);
  if (dataUrlMatch?.[1]) {
    return dataUrlMatch[1];
  }
  const extension = imagePath.trim().split(".").pop()?.toLowerCase();
  switch (extension) {
    case "png":
      return "image/png";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "webp":
      return "image/webp";
    case "gif":
      return "image/gif";
    default:
      return "image/png";
  }
}

function resolvePreferredImageExtension(
  sourceImageUrl: string,
  imagePath: string,
): string {
  const mediaType = inferImageMediaType(sourceImageUrl, imagePath);
  switch (mediaType) {
    case "image/jpeg":
      return ".jpg";
    case "image/webp":
      return ".webp";
    case "image/gif":
      return ".gif";
    default:
      return ".png";
  }
}
