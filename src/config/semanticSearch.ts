import type { ExplorerSearchMode } from "../generated/tauri";
import semanticSearchFileTypesJson from "./semanticSearchFileTypes.json";
import semanticSearchRuntimeJson from "./semanticSearchRuntime.json";

export type ExplorerSearchModeValue = ExplorerSearchMode;

export const explorerSearchModeOrder: readonly ExplorerSearchModeValue[] = [
  "name",
  "content",
  "semantic",
];

export const explorerSearchModeLabels: Record<
  ExplorerSearchModeValue,
  string
> = {
  name: "Name",
  content: "Content",
  semantic: "Semantic",
};

export const explorerSearchModeDescriptions: Record<
  ExplorerSearchModeValue,
  string
> = {
  name: "Recursive path and filename matching.",
  content: "Recursive text search across file names and file contents.",
  semantic:
    "AI-powered similarity and meaning-based search over indexed local text/code files.",
};

export function normalizeExplorerSearchMode(
  value: unknown,
  legacyIncludeContent = true,
): ExplorerSearchModeValue {
  if (value === "name" || value === "content" || value === "semantic") {
    return value;
  }
  return legacyIncludeContent ? "content" : "name";
}

export function cycleExplorerSearchMode(
  currentMode: ExplorerSearchModeValue,
): ExplorerSearchModeValue {
  const currentIndex = explorerSearchModeOrder.indexOf(currentMode);
  const nextIndex =
    currentIndex >= 0
      ? (currentIndex + 1) % explorerSearchModeOrder.length
      : 0;
  return explorerSearchModeOrder[nextIndex] ?? "content";
}

export const semanticSearchRuntimeConfig = semanticSearchRuntimeJson as {
  schemaVersion: number;
  modelId: string;
  maxSequenceLength: number;
  chunkMaxLines: number;
  chunkOverlapLines: number;
  chunkMaxChars: number;
  snippetMaxChars: number;
  torchBatchSize: number;
  onnxBatchSize: number;
  preferredOnnxProviders: string[];
};

export const semanticSearchFileTypeRegistry = semanticSearchFileTypesJson as {
  schemaVersion: number;
  textLikeExtensions: string[];
};

export function isSemanticSearchTextLikeExtension(
  extension: string | null | undefined,
): boolean {
  if (!extension) {
    return false;
  }
  const normalizedExtension = extension.trim().toLowerCase().replace(/^\./, "");
  return semanticSearchFileTypeRegistry.textLikeExtensions.includes(
    normalizedExtension,
  );
}
