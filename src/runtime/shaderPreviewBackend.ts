import type {
  ExplorerShaderCompileRequest,
  ExplorerShaderCompileResult,
  ExplorerShaderDiagnostic,
  ExplorerShaderEntryPoint,
  ExplorerShaderFormat,
  ExplorerShaderPreviewDocument,
  ExplorerShaderStage,
} from "../generated/tauri";
import { commands, unwrapTauriResult } from "./tauriClient";

export type ExplorerShaderPreviewFormat = ExplorerShaderFormat;
export type ExplorerShaderPreviewStage = ExplorerShaderStage;
export type ExplorerShaderPreviewEntryPoint = ExplorerShaderEntryPoint;
export type ExplorerShaderPreviewDiagnostic = ExplorerShaderDiagnostic;
export type ExplorerShaderPreviewCompileInput = ExplorerShaderCompileRequest;
export type ExplorerShaderPreviewCompileOutput = ExplorerShaderCompileResult;
export type ExplorerShaderPreviewInspection = ExplorerShaderPreviewDocument;

export async function inspectExplorerShaderPreviewDocument(
  inputPath: string,
): Promise<ExplorerShaderPreviewInspection> {
  return unwrapTauriResult(await commands.shaderPreviewInspect(inputPath));
}

export async function compileExplorerShaderPreviewDocument(
  request: ExplorerShaderPreviewCompileInput,
): Promise<ExplorerShaderPreviewCompileOutput> {
  return unwrapTauriResult(await commands.shaderPreviewCompile(request));
}
