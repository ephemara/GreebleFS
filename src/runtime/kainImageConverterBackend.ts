import { createPythonSidecarActionRunner } from "./pythonRuntimeBackend";

export interface KainImageConverterInspectRequest {
  sourcePath: string;
}

export interface KainImageConverterPlanRequest extends KainImageConverterInspectRequest {
  outputPath?: string | null;
  outputFormat: string;
  width?: number | null;
  height?: number | null;
  fitMode?: string | null;
  quality?: number | null;
  background?: string | null;
}

export interface KainImageConverterConvertRequest extends KainImageConverterPlanRequest {
  overwrite?: boolean | null;
}

export interface KainImageConverterImageInfo {
  path: string;
  format: string | null;
  mode: string;
  width: number;
  height: number;
  hasAlpha: boolean;
}

export interface KainImageConverterResult {
  ok: boolean;
  action: string;
  backend: string;
  source: KainImageConverterImageInfo | null;
  output: KainImageConverterImageInfo | null;
  outputPath: string | null;
  outputFormat: string | null;
  supportedFormats: string[];
  warnings: string[];
}

export const inspectKainImageConverterSource =
  createPythonSidecarActionRunner<
    KainImageConverterInspectRequest,
    KainImageConverterResult
  >("kain.plugin.image_converter.inspect");

export const planKainImageConversion =
  createPythonSidecarActionRunner<
    KainImageConverterPlanRequest,
    KainImageConverterResult
  >("kain.plugin.image_converter.plan");

export const convertKainImage =
  createPythonSidecarActionRunner<
    KainImageConverterConvertRequest,
    KainImageConverterResult
  >("kain.plugin.image_converter.convert");
