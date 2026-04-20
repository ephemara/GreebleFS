import {
  getExplorerArchiveDescriptor,
  isExplorerArchiveEntry,
  type ExplorerArchiveFormatDescriptor,
} from "../../config/explorerArchives";
import {
  getExecutableScriptRunner,
  getAudioPreviewMimeType,
  getModelPreviewFormat,
  getMonacoLanguage,
  getShaderPreviewFormat,
  getSpreadsheetFileKind,
  getVideoPreviewMimeType,
  isAudioPreviewExtension,
  isDocxPreviewExtension,
  isEditableTextExtension,
  isExecutableScriptExtension,
  isFontPreviewExtension,
  isImagePreviewExtension,
  isPdfPreviewExtension,
  isShaderPreviewExtension,
  isSqlitePreviewExtension,
  isSpreadsheetPreviewExtension,
  isVideoPreviewExtension,
  type ExplorerExecutableScriptRunner,
  type ModelPreviewFormat,
  type ShaderPreviewFormat,
} from "../../config/filePreview";
import type { ExplorerFileEntry as FileEntry } from "../../runtime/explorerBackend";
import type { DocumentPreviewKind } from "../documentPreview";

export type ExplorerResolvedPreviewDescriptor =
  | { kind: "folder" }
  | { kind: "model3d"; format: ModelPreviewFormat }
  | { kind: "archive"; descriptor: ExplorerArchiveFormatDescriptor }
  | {
      kind: "audio";
      source: string;
      extension: string;
      mimeType: string | null;
    }
  | {
      kind: "video";
      source: string;
      extension: string;
      mimeType: string | null;
    }
  | {
      kind: "font";
      source: string;
      extension: string;
    }
  | { kind: "image"; extension: string }
  | { kind: "sqlite" }
  | { kind: "pdf" }
  | {
      kind: "spreadsheet";
      extension: string;
      fileKind: "workbook" | "tabular";
    }
  | {
      kind: "docx";
      extension: string;
    }
  | {
      kind: "shader";
      extension: string;
      format: ShaderPreviewFormat | null;
    }
  | {
      kind: "script";
      extension: string;
      language: string;
      runner: ExplorerExecutableScriptRunner;
    }
  | {
      kind: "text";
      extension: string;
      language: string;
      renderKind: DocumentPreviewKind;
    }
  | {
      kind: "unsupported";
      extension: string;
    };

export interface ExplorerPreviewResolverOptions {
  assetUrlResolver: (path: string) => string;
  documentPreviewKindResolver: (path: string) => DocumentPreviewKind;
}

export interface ExplorerPreviewFallbackState {
  label: string;
  detail?: string;
}

type ExplorerPreviewDefinition = {
  match: (
    entry: FileEntry,
    extension: string,
    options: ExplorerPreviewResolverOptions,
  ) => ExplorerResolvedPreviewDescriptor | null;
};

const ASYNC_PREVIEW_FALLBACKS = {
  image: {
    loadingLabel: "Loading preview…",
    loadingDetail: "Decoding image…",
    errorLabel: "Image preview unavailable",
  },
  pdf: {
    loadingLabel: "Loading PDF…",
    loadingDetail: "Opening PDF preview session…",
    errorLabel: "PDF preview unavailable",
  },
  shader: {
    loadingLabel: "Loading shader workbench…",
    loadingDetail: "Inspecting shader source and preview ABI support…",
    errorLabel: "Shader preview unavailable",
  },
  script: {
    loadingLabel: "Loading script editor…",
    loadingDetail: "Reading executable script…",
    errorLabel: "Script preview unavailable",
  },
  text: {
    loadingLabel: "Loading editor…",
    loadingDetail: "Reading text preview…",
    errorLabel: "Text preview unavailable",
  },
} as const satisfies Partial<
  Record<
    ExplorerResolvedPreviewDescriptor["kind"],
    {
      loadingLabel: string;
      loadingDetail: string;
      errorLabel: string;
    }
  >
>;

const EXPLORER_PREVIEW_DEFINITIONS: readonly ExplorerPreviewDefinition[] = [
  {
    match: (entry) => (entry.is_dir ? { kind: "folder" } : null),
  },
  {
    match: (_entry, extension) => {
      const format = getModelPreviewFormat(extension);
      return format ? { kind: "model3d", format } : null;
    },
  },
  {
    match: (entry) => {
      if (!isExplorerArchiveEntry(entry)) {
        return null;
      }

      const descriptor = getExplorerArchiveDescriptor(entry);
      return descriptor ? { kind: "archive", descriptor } : null;
    },
  },
  {
    match: (entry, extension, options) =>
      isAudioPreviewExtension(extension)
        ? {
            kind: "audio",
            source: options.assetUrlResolver(entry.path),
            extension,
            mimeType: getAudioPreviewMimeType(extension),
          }
        : null,
  },
  {
    match: (entry, extension, options) =>
      isVideoPreviewExtension(extension)
        ? {
            kind: "video",
            source: options.assetUrlResolver(entry.path),
            extension,
            mimeType: getVideoPreviewMimeType(extension),
          }
        : null,
  },
  {
    match: (_entry, extension) =>
      isImagePreviewExtension(extension) ? { kind: "image", extension } : null,
  },
  {
    match: (entry, extension, options) =>
      isFontPreviewExtension(extension)
        ? {
            kind: "font",
            source: options.assetUrlResolver(entry.path),
            extension,
          }
        : null,
  },
  {
    match: (_entry, extension) =>
      isSqlitePreviewExtension(extension) ? { kind: "sqlite" } : null,
  },
  {
    match: (_entry, extension) =>
      isPdfPreviewExtension(extension) ? { kind: "pdf" } : null,
  },
  {
    match: (_entry, extension) =>
      isSpreadsheetPreviewExtension(extension)
        ? {
            kind: "spreadsheet",
            extension,
            fileKind: getSpreadsheetFileKind(extension) ?? "workbook",
          }
        : null,
  },
  {
    match: (_entry, extension) =>
      isDocxPreviewExtension(extension)
        ? {
            kind: "docx",
            extension,
          }
        : null,
  },
  {
    match: (_entry, extension) =>
      isShaderPreviewExtension(extension)
        ? {
            kind: "shader",
            extension,
            format: getShaderPreviewFormat(extension),
          }
        : null,
  },
  {
    match: (_entry, extension) => {
      if (!isExecutableScriptExtension(extension)) {
        return null;
      }

      const runner = getExecutableScriptRunner(extension);
      if (!runner) {
        return null;
      }

      return {
        kind: "script",
        extension,
        language: getMonacoLanguage(extension),
        runner,
      };
    },
  },
  {
    match: (entry, extension, options) =>
      isEditableTextExtension(extension, entry.size)
        ? {
            kind: "text",
            extension,
            language: getMonacoLanguage(extension),
            renderKind: options.documentPreviewKindResolver(entry.path),
          }
        : null,
  },
] as const;

export function resolveExplorerPreviewDescriptor(
  entry: FileEntry,
  options: ExplorerPreviewResolverOptions,
): ExplorerResolvedPreviewDescriptor {
  const extension = getExplorerPreviewEntryExtension(entry);
  for (const definition of EXPLORER_PREVIEW_DEFINITIONS) {
    const match = definition.match(entry, extension, options);
    if (match) {
      return match;
    }
  }

  return {
    kind: "unsupported",
    extension,
  };
}

export function getExplorerPreviewEntryExtension(
  entry: Pick<FileEntry, "is_dir" | "name" | "extension">,
): string {
  if (entry.is_dir) {
    return "";
  }

  const extension = entry.extension?.trim().replace(/^\./, "").toLowerCase();
  if (extension) {
    return extension;
  }

  const lastDotIndex = entry.name.lastIndexOf(".");
  if (lastDotIndex <= 0 || lastDotIndex === entry.name.length - 1) {
    return "";
  }

  return entry.name.slice(lastDotIndex + 1).toLowerCase();
}

export function isInlineExplorerPreviewDescriptor(
  descriptor: ExplorerResolvedPreviewDescriptor,
): boolean {
  return descriptor.kind !== "unsupported";
}

export function buildExplorerPreviewLoadingFallback(
  descriptor: ExplorerResolvedPreviewDescriptor,
): ExplorerPreviewFallbackState | null {
  const definition =
    ASYNC_PREVIEW_FALLBACKS[
      descriptor.kind as keyof typeof ASYNC_PREVIEW_FALLBACKS
    ];
  if (!definition) {
    return null;
  }

  return {
    label: definition.loadingLabel,
    detail: definition.loadingDetail,
  };
}

export function buildExplorerPreviewErrorFallback(
  descriptor: ExplorerResolvedPreviewDescriptor,
  error: unknown,
): ExplorerPreviewFallbackState {
  const definition =
    ASYNC_PREVIEW_FALLBACKS[
      descriptor.kind as keyof typeof ASYNC_PREVIEW_FALLBACKS
    ];
  return {
    label: definition?.errorLabel ?? "Preview unavailable",
    detail: normalizeExplorerPreviewError(error),
  };
}

export function buildExplorerUnsupportedPreviewFallback(): ExplorerPreviewFallbackState {
  return {
    label: "Preview unavailable",
    detail: "No inline preview is available for this file type.",
  };
}

function normalizeExplorerPreviewError(error: unknown): string {
  if (error instanceof Error) {
    return error.message || String(error);
  }
  return String(error);
}
