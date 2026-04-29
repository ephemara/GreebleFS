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
  isSpreadsheetPreviewExtension,
  isVideoPreviewExtension,
  type ExplorerExecutableScriptRunner,
  type ModelPreviewFormat,
  type ShaderPreviewFormat,
} from "../../config/filePreview";
import type { ExplorerWorkbenchResolutionSource } from "../../config/explorerWorkbenches";
import type { OverlayPluginPreviewLaneContribution } from "../../config/pluginContributions";
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
      kind: "plugin";
      extension: string;
      assetUrl: string;
      lane: OverlayPluginPreviewLaneContribution;
    }
  | {
      kind: "unsupported";
      extension: string;
    };

export interface ExplorerPreviewResolverOptions {
  assetUrlResolver: (path: string) => string;
  documentPreviewKindResolver: (path: string) => DocumentPreviewKind;
  pluginPreviewLanes?: readonly OverlayPluginPreviewLaneContribution[];
  preferredWorkbenchId?: string | null;
}

export interface ExplorerPreviewMatchContext {
  entry: FileEntry;
  extension: string;
  options: ExplorerPreviewResolverOptions;
}

export type ExplorerPreviewLaneDefinition = {
  id: string;
  title: string;
  priority: number;
  match: (
    context: ExplorerPreviewMatchContext,
  ) => ExplorerResolvedPreviewDescriptor | null;
};

export interface ExplorerResolvedPreviewWorkbenchCandidate {
  id: string;
  title: string;
  priority: number;
  descriptor: ExplorerResolvedPreviewDescriptor;
}

export interface ExplorerResolvedPreviewWorkbenchSelection {
  extension: string;
  candidates: ExplorerResolvedPreviewWorkbenchCandidate[];
  activeWorkbench: ExplorerResolvedPreviewWorkbenchCandidate | null;
  resolutionSource: ExplorerWorkbenchResolutionSource | null;
}

export const BUILT_IN_EXPLORER_PREVIEW_LANE_PRIORITY = 100;

const BUILT_IN_EXPLORER_PREVIEW_LANES: readonly ExplorerPreviewLaneDefinition[] =
  [
    {
      id: "builtin-folder",
      title: "Folder Preview",
      priority: BUILT_IN_EXPLORER_PREVIEW_LANE_PRIORITY,
      match: ({ entry }) => (entry.is_dir ? { kind: "folder" } : null),
    },
    {
      id: "builtin-model3d",
      title: "3D Model Preview",
      priority: BUILT_IN_EXPLORER_PREVIEW_LANE_PRIORITY,
      match: ({ extension }) => {
        const format = getModelPreviewFormat(extension);
        return format ? { kind: "model3d", format } : null;
      },
    },
    {
      id: "builtin-archive",
      title: "Archive Preview",
      priority: BUILT_IN_EXPLORER_PREVIEW_LANE_PRIORITY,
      match: ({ entry }) => {
        if (!isExplorerArchiveEntry(entry)) {
          return null;
        }

        const descriptor = getExplorerArchiveDescriptor(entry);
        return descriptor ? { kind: "archive", descriptor } : null;
      },
    },
    {
      id: "builtin-audio",
      title: "Audio Workbench",
      priority: BUILT_IN_EXPLORER_PREVIEW_LANE_PRIORITY,
      match: ({ entry, extension, options }) =>
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
      id: "builtin-video",
      title: "Video Workbench",
      priority: BUILT_IN_EXPLORER_PREVIEW_LANE_PRIORITY,
      match: ({ entry, extension, options }) =>
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
      id: "builtin-image",
      title: "Image Workbench",
      priority: BUILT_IN_EXPLORER_PREVIEW_LANE_PRIORITY,
      match: ({ extension }) =>
        isImagePreviewExtension(extension) ? { kind: "image", extension } : null,
    },
    {
      id: "builtin-font",
      title: "Font Preview",
      priority: BUILT_IN_EXPLORER_PREVIEW_LANE_PRIORITY,
      match: ({ entry, extension, options }) =>
        isFontPreviewExtension(extension)
          ? {
              kind: "font",
              source: options.assetUrlResolver(entry.path),
              extension,
            }
          : null,
    },
    {
      id: "builtin-pdf",
      title: "PDF Workbench",
      priority: BUILT_IN_EXPLORER_PREVIEW_LANE_PRIORITY,
      match: ({ extension }) =>
        isPdfPreviewExtension(extension) ? { kind: "pdf" } : null,
    },
    {
      id: "builtin-spreadsheet",
      title: "Spreadsheet Workbench",
      priority: BUILT_IN_EXPLORER_PREVIEW_LANE_PRIORITY,
      match: ({ extension }) =>
        isSpreadsheetPreviewExtension(extension)
          ? {
              kind: "spreadsheet",
              extension,
              fileKind: getSpreadsheetFileKind(extension) ?? "workbook",
            }
          : null,
    },
    {
      id: "builtin-docx",
      title: "Document Workbench",
      priority: BUILT_IN_EXPLORER_PREVIEW_LANE_PRIORITY,
      match: ({ extension }) =>
        isDocxPreviewExtension(extension)
          ? {
              kind: "docx",
              extension,
            }
          : null,
    },
    {
      id: "builtin-shader",
      title: "Shader Workbench",
      priority: BUILT_IN_EXPLORER_PREVIEW_LANE_PRIORITY,
      match: ({ extension }) =>
        isShaderPreviewExtension(extension)
          ? {
              kind: "shader",
              extension,
              format: getShaderPreviewFormat(extension),
            }
          : null,
    },
    {
      id: "builtin-script",
      title: "Script Workbench",
      priority: BUILT_IN_EXPLORER_PREVIEW_LANE_PRIORITY,
      match: ({ extension }) => {
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
      id: "builtin-text",
      title: "Text Workbench",
      priority: BUILT_IN_EXPLORER_PREVIEW_LANE_PRIORITY,
      match: ({ entry, extension, options }) =>
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
  return (
    resolveExplorerPreviewWorkbenchSelection(entry, options).activeWorkbench
      ?.descriptor ?? {
      kind: "unsupported",
      extension: getExplorerPreviewEntryExtension(entry),
    }
  );
}

export function resolveExplorerPreviewWorkbenchSelection(
  entry: FileEntry,
  options: ExplorerPreviewResolverOptions,
): ExplorerResolvedPreviewWorkbenchSelection {
  const extension = getExplorerPreviewEntryExtension(entry);
  const matchContext: ExplorerPreviewMatchContext = {
    entry,
    extension,
    options,
  };
  const candidates = buildRegisteredExplorerPreviewLanes(options)
    .map((definition) => {
      const descriptor = definition.match(matchContext);
      if (!descriptor) {
        return null;
      }
      return {
        id: definition.id,
        title: definition.title,
        priority: definition.priority,
        descriptor,
      } satisfies ExplorerResolvedPreviewWorkbenchCandidate;
    })
    .filter(
      (
        candidate,
      ): candidate is ExplorerResolvedPreviewWorkbenchCandidate =>
        candidate != null,
    );

  if (candidates.length === 0) {
    return {
      extension,
      candidates: [],
      activeWorkbench: null,
      resolutionSource: null,
    };
  }

  const preferredWorkbenchId = options.preferredWorkbenchId?.trim() ?? "";
  if (preferredWorkbenchId) {
    const preferredCandidate = candidates.find(
      (candidate) => candidate.id === preferredWorkbenchId,
    );
    if (preferredCandidate) {
      return {
        extension,
        candidates,
        activeWorkbench: preferredCandidate,
        resolutionSource: "user-default",
      };
    }
  }

  const activeWorkbench = candidates[0];
  const nextCandidate = candidates[1] ?? null;
  return {
    extension,
    candidates,
    activeWorkbench,
    resolutionSource:
      nextCandidate && nextCandidate.priority === activeWorkbench.priority
        ? "discovery-order"
        : "priority",
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

export function buildRegisteredExplorerPreviewLanes(
  options: ExplorerPreviewResolverOptions,
): ExplorerPreviewLaneDefinition[] {
  const pluginPreviewLanes = (options.pluginPreviewLanes ?? []).map(
    createPluginExplorerPreviewLaneDefinition,
  );
  return [...pluginPreviewLanes, ...BUILT_IN_EXPLORER_PREVIEW_LANES]
    .map((definition, index) => ({
      definition,
      index,
    }))
    .sort((left, right) => {
      if (left.definition.priority !== right.definition.priority) {
        return right.definition.priority - left.definition.priority;
      }
      return left.index - right.index;
    })
    .map(({ definition }) => definition);
}

function createPluginExplorerPreviewLaneDefinition(
  lane: OverlayPluginPreviewLaneContribution,
): ExplorerPreviewLaneDefinition {
  return {
    id: lane.id,
    title: `${lane.pluginName}: ${lane.title}`,
    priority: lane.priority,
    match: ({ entry, extension, options }) => {
      if (!matchesOverlayPluginPreviewLane(entry, extension, lane)) {
        return null;
      }

      return {
        kind: "plugin",
        extension,
        assetUrl: entry.is_dir ? "" : options.assetUrlResolver(entry.path),
        lane,
      };
    },
  };
}

function matchesOverlayPluginPreviewLane(
  entry: FileEntry,
  extension: string,
  lane: OverlayPluginPreviewLaneContribution,
): boolean {
  if (!matchesOverlayPluginPreviewLaneAppliesTo(entry, lane)) {
    return false;
  }

  const hasExtensionRules = lane.match.extensions.length > 0;
  const hasFileNameRules = lane.match.fileNames.length > 0;
  if (!hasExtensionRules && !hasFileNameRules) {
    return true;
  }

  if (
    hasExtensionRules &&
    !lane.match.extensions.includes(extension.toLowerCase())
  ) {
    return false;
  }

  if (
    hasFileNameRules &&
    !lane.match.fileNames.includes(entry.name.trim().toLowerCase())
  ) {
    return false;
  }

  return true;
}

function matchesOverlayPluginPreviewLaneAppliesTo(
  entry: FileEntry,
  lane: OverlayPluginPreviewLaneContribution,
): boolean {
  switch (lane.match.appliesTo) {
    case "any":
      return true;
    case "directory":
      return entry.is_dir;
    case "file":
      return !entry.is_dir;
  }
}
