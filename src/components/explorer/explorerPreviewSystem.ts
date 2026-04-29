import type { ExplorerResolvedPreviewDescriptor } from "./explorerPreviewRegistry";

export {
  buildRegisteredExplorerPreviewLanes,
  getExplorerPreviewEntryExtension,
  isInlineExplorerPreviewDescriptor,
  resolveExplorerPreviewDescriptor,
  resolveExplorerPreviewWorkbenchSelection,
  type ExplorerPreviewLaneDefinition,
  type ExplorerPreviewMatchContext,
  type ExplorerPreviewResolverOptions,
  type ExplorerResolvedBuiltInPreviewDescriptor,
  type ExplorerResolvedPreviewDescriptor,
  type ExplorerResolvedPreviewWorkbenchCandidate,
  type ExplorerResolvedPreviewWorkbenchSelection,
} from "./explorerPreviewRegistry";

export interface ExplorerPreviewFallbackState {
  label: string;
  detail?: string;
}

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

export function buildExplorerPreviewLoadingFallback(
  descriptor: ExplorerResolvedPreviewDescriptor,
): ExplorerPreviewFallbackState | null {
  if (descriptor.kind === "plugin") {
    return {
      label: `Loading ${descriptor.lane.title}…`,
      detail: descriptor.lane.runtimeId
        ? `Preparing ${descriptor.lane.pluginName} runtime preview lane…`
        : `Opening ${descriptor.lane.pluginName} preview lane…`,
    };
  }

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
  if (descriptor.kind === "plugin") {
    return {
      label: `${descriptor.lane.title} preview unavailable`,
      detail: normalizeExplorerPreviewError(error),
    };
  }

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
