import { describe, expect, it } from "vitest";
import {
  DEFAULT_EXPLORER_AUDIO_EXPORT_FORMAT_ID,
  EXPLORER_AUDIO_EXPORT_FORMATS,
  MODEL_THUMBNAIL_RENDER_CONFIG,
  getAudioPreviewMimeType,
  getExplorerAudioExportFormatDefinition,
  getExecutableScriptRunner,
  getModelPreviewFormat,
  getMonacoLanguage,
  getShaderPreviewFormat,
  getVideoPreviewMimeType,
  isDirectAudioPreviewExtension,
  isAudioPreviewExtension,
  isEditableTextExtension,
  isExecutableBinaryExtension,
  isExecutableExtension,
  isExecutableScriptExtension,
  isImagePreviewExtension,
  isModelPreviewExtension,
  isPdfPreviewExtension,
  isPythonPreviewExtension,
  isShaderPreviewExtension,
  isSpreadsheetPreviewExtension,
  isVideoPreviewExtension,
} from "../config/filePreview";

describe("filePreview config", () => {
  it("detects image preview extensions", () => {
    expect(isImagePreviewExtension("png")).toBe(true);
    expect(isImagePreviewExtension(".webp")).toBe(true);
    expect(isImagePreviewExtension("obj")).toBe(false);
  });

  it("detects executable extensions", () => {
    expect(isExecutableExtension("exe")).toBe(true);
    expect(isExecutableExtension("ps1")).toBe(true);
    expect(isExecutableExtension("glb")).toBe(false);
    expect(isExecutableBinaryExtension("exe")).toBe(true);
    expect(isExecutableBinaryExtension("ps1")).toBe(false);
    expect(isExecutableScriptExtension("ps1")).toBe(true);
    expect(isExecutableScriptExtension("command")).toBe(true);
    expect(getExecutableScriptRunner("bat")).toBe("batch");
    expect(getExecutableScriptRunner("ps1")).toBe("powershell");
    expect(getExecutableScriptRunner("zsh")).toBe("zsh");
    expect(getExecutableScriptRunner("exe")).toBeNull();
  });

  it("detects audio preview extensions and maps their mime types", () => {
    expect(isAudioPreviewExtension("mp3")).toBe(true);
    expect(isAudioPreviewExtension(".opus")).toBe(true);
    expect(isAudioPreviewExtension("txt")).toBe(false);
    expect(getAudioPreviewMimeType("m4a")).toBe("audio/mp4");
    expect(getAudioPreviewMimeType("weba")).toBe("audio/webm");
    expect(getAudioPreviewMimeType("txt")).toBeNull();
  });

  it("keeps audio export formats and direct-playback hints data-driven", () => {
    expect(EXPLORER_AUDIO_EXPORT_FORMATS.map((format) => format.id)).toEqual([
      "mp3",
      "wav",
      "flac",
      "ogg",
    ]);
    expect(DEFAULT_EXPLORER_AUDIO_EXPORT_FORMAT_ID).toBe("wav");
    expect(getExplorerAudioExportFormatDefinition("wav")?.mimeType).toBe(
      "audio/wav",
    );
    expect(getExplorerAudioExportFormatDefinition("txt")).toBeNull();
    expect(isDirectAudioPreviewExtension("mp3")).toBe(true);
    expect(isDirectAudioPreviewExtension("aif")).toBe(true);
    expect(isDirectAudioPreviewExtension("aifc")).toBe(true);
    expect(isDirectAudioPreviewExtension(".aiff")).toBe(true);
    expect(isDirectAudioPreviewExtension("wma")).toBe(false);
  });

  it("detects video preview extensions and maps their mime types", () => {
    expect(isVideoPreviewExtension("mp4")).toBe(true);
    expect(isVideoPreviewExtension(".mkv")).toBe(true);
    expect(isVideoPreviewExtension("txt")).toBe(false);
    expect(getVideoPreviewMimeType("mov")).toBe("video/quicktime");
    expect(getVideoPreviewMimeType("webm")).toBe("video/webm");
    expect(getVideoPreviewMimeType("txt")).toBeNull();
  });

  it("routes pdf files into pdf preview instead of editable text mode", () => {
    expect(isPdfPreviewExtension("pdf")).toBe(true);
    expect(isPdfPreviewExtension(".pdf")).toBe(true);
    expect(isPdfPreviewExtension("txt")).toBe(false);
    expect(isEditableTextExtension("pdf", 1024)).toBe(false);
  });

  it("routes spreadsheet files into the spreadsheet workbench instead of editable text mode", () => {
    expect(isSpreadsheetPreviewExtension("xlsx")).toBe(true);
    expect(isSpreadsheetPreviewExtension(".csv")).toBe(true);
    expect(isSpreadsheetPreviewExtension("txt")).toBe(false);
    expect(isEditableTextExtension("xlsx", 1024)).toBe(false);
    expect(isEditableTextExtension("csv", 1024)).toBe(false);
    expect(isEditableTextExtension("tsv", 1024)).toBe(false);
  });

  it("routes shader formats into the shader workbench instead of editable text mode", () => {
    expect(isShaderPreviewExtension("wgsl")).toBe(true);
    expect(isShaderPreviewExtension(".hlsl")).toBe(true);
    expect(isShaderPreviewExtension("spv")).toBe(true);
    expect(isShaderPreviewExtension("glsl")).toBe(false);
    expect(getShaderPreviewFormat("wgsl")).toBe("wgsl");
    expect(getShaderPreviewFormat(".hlsl")).toBe("hlsl");
    expect(getShaderPreviewFormat("spv")).toBe("spv");
    expect(getShaderPreviewFormat("glsl")).toBeNull();
    expect(isEditableTextExtension("wgsl", 1024)).toBe(false);
    expect(isEditableTextExtension("hlsl", 1024)).toBe(false);
    expect(isEditableTextExtension("spv", 1024)).toBe(false);
  });

  it("identifies Python files for the dedicated preview workbench lane", () => {
    expect(isPythonPreviewExtension("py")).toBe(true);
    expect(isPythonPreviewExtension(".pyw")).toBe(true);
    expect(isPythonPreviewExtension("txt")).toBe(false);
    expect(isEditableTextExtension("py", 1024)).toBe(true);
  });

  it("maps supported 3d extensions to model formats", () => {
    expect(getModelPreviewFormat("fbx")).toBe("fbx");
    expect(getModelPreviewFormat("glb")).toBe("glb");
    expect(getModelPreviewFormat(".gltf")).toBe("gltf");
    expect(getModelPreviewFormat("obj")).toBe("obj");
    expect(getModelPreviewFormat("stl")).toBe("stl");
    expect(getModelPreviewFormat("png")).toBeNull();
    expect(isModelPreviewExtension("glb")).toBe(true);
    expect(isModelPreviewExtension(".obj")).toBe(true);
    expect(isModelPreviewExtension("png")).toBe(false);
  });

  it("renders 3d model thumbnails as transparent cutouts", () => {
    expect(MODEL_THUMBNAIL_RENDER_CONFIG.cacheVariant).toBe("cutout-v1");
    expect(MODEL_THUMBNAIL_RENDER_CONFIG.backgroundAlpha).toBe(0);
  });

  it("keeps 3d assets out of editable text mode even when small", () => {
    expect(isEditableTextExtension("obj", 1024)).toBe(false);
    expect(isEditableTextExtension("fbx", 1024)).toBe(false);
    expect(isEditableTextExtension("glb", 1024)).toBe(false);
  });

  it("keeps audio assets out of editable text mode even when small", () => {
    expect(isEditableTextExtension("mp3", 1024)).toBe(false);
    expect(isEditableTextExtension("flac", 1024)).toBe(false);
    expect(isEditableTextExtension("opus", 1024)).toBe(false);
  });

  it("keeps video assets out of editable text mode even when small", () => {
    expect(isEditableTextExtension("mp4", 1024)).toBe(false);
    expect(isEditableTextExtension("mkv", 1024)).toBe(false);
    expect(isEditableTextExtension("mov", 1024)).toBe(false);
  });

  it("still allows normal source files to open in the editor", () => {
    expect(isEditableTextExtension("ts", 1024)).toBe(true);
    expect(isEditableTextExtension("txt", 1024)).toBe(true);
    expect(isEditableTextExtension("bat", 1024)).toBe(true);
    expect(isEditableTextExtension("ps1", 1024)).toBe(true);
    expect(isEditableTextExtension("", 1024)).toBe(true);
  });

  it("returns monaco language hints with sensible fallbacks", () => {
    expect(getMonacoLanguage("ts")).toBe("typescript");
    expect(getMonacoLanguage("wgsl")).toBe("wgsl");
    expect(getMonacoLanguage("obj")).toBe("plaintext");
    expect(getMonacoLanguage("")).toBe("plaintext");
  });
});
