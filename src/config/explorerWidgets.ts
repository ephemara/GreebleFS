import React from "react";
import { isTauri } from "@tauri-apps/api/core";

import { getManagedContentDirectory } from "./appContentDirectories";
import {
  loadManagedContentManifestsFromDirectoryStack,
  type ManagedContentDirectoryLoadResult,
  type ManagedContentStackManifestRecord,
} from "./managedContentDirectoryStacks";
import { joinPlatformPath } from "./platform";
import { resolveRuntimeAssetPollingEnabled } from "./runtimeAssetPolling";
import { commands, unwrapTauriResult } from "../runtime/tauriClient";
import {
  ExplorerWasmWidgetSurface,
  normalizeExplorerWidgetCapabilities,
  normalizeExplorerWidgetDescriptor,
  normalizeExplorerWidgetSizing,
  normalizeExplorerWidgetSurfaces,
  toExplorerWidgetChromeControlId,
  type ExplorerWidgetCapabilityFlags,
  type ExplorerWidgetDescriptor,
  type ExplorerWidgetDescriptorInput,
  type ExplorerWidgetProps,
  type ExplorerWidgetSizingContract,
  type ExplorerWidgetSurfaceContract,
  type LoadExplorerWidgetFromSourceOptions,
  type LoadedExplorerWidgetModule,
  loadExplorerWidgetFromSource,
} from "../components/explorer/explorerWidgetRuntime";
import type {
  RuntimeFileEntry,
  RuntimeRelativeModuleSourceResolver,
} from "../runtime/moduleRuntime";

type LooseRecord = Record<string, unknown>;

const explorerWidgetRuntimeModuleExtensions = ["ts", "tsx", "js", "jsx"] as const;

export interface ExplorerWidgetPackManifest {
  [key: string]: unknown;
  version?: number;
  id?: string;
  name?: string;
  description?: string;
  author?: string;
  homepage?: string;
  tags?: string[];
  explorerWidget?: {
    id?: string;
    title?: string;
    shortLabel?: string;
    description?: string;
    category?: string;
    rendererKind?: "react" | "wasm-panel";
    renderer?: string;
    rendererEntry?: string;
    runtimeId?: string;
    runtimeRef?: string;
    runtimeSurfaceId?: string;
    runtimeSurfaceRef?: string;
    buildTarget?: string;
    priority?: number;
    available?: boolean;
    chromeControlId?: string;
    surfaces?: Partial<ExplorerWidgetSurfaceContract>;
    sizing?: Partial<ExplorerWidgetSizingContract>;
    capabilities?: Partial<ExplorerWidgetCapabilityFlags>;
  };
}

export interface LoadedExplorerWidgetDefinition extends ExplorerWidgetDescriptor {
  version: number;
  name: string;
  directoryPath: string;
  manifestPath: string;
  sourceKind: "explorer-widget-directory" | "plugin" | "built-in";
  sourceLabel: string;
  author?: string;
  homepage?: string;
  warnings: string[];
  component: React.ComponentType<ExplorerWidgetProps> | null;
  error: string | null;
}

export const explorerWidgetSystemConfig = {
  get explorerWidgetsDirectory(): string {
    return getManagedContentDirectory("explorerWidgets");
  },
  manifestNames: [
    "explorer-widget.json",
    "explorer-widget.toml",
    "widget.json",
    "widget.toml",
    "manifest.json",
    "manifest.toml",
  ] as const,
  runtimeAssetPollingEnabled: resolveRuntimeAssetPollingEnabled(),
  scanIntervalMs: 5000,
};

function asRecord(value: unknown): LooseRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as LooseRecord;
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : fallback;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function normalizeRelativeRuntimeModulePath(path: string): string | null {
  const normalizedPath = path.trim().replace(/\\/g, "/");
  if (
    !normalizedPath ||
    normalizedPath.startsWith("/") ||
    /^[A-Za-z]:\//.test(normalizedPath)
  ) {
    return null;
  }
  const segments: string[] = [];
  for (const segment of normalizedPath.split("/")) {
    if (!segment || segment === ".") {
      continue;
    }
    if (segment === "..") {
      if (segments.length === 0) {
        return null;
      }
      segments.pop();
      continue;
    }
    segments.push(segment);
  }
  return segments.join("/");
}

function normalizeComparisonPath(path: string): string {
  return path.replace(/\\/g, "/").replace(/\/+/g, "/").replace(/\/+$/g, "");
}

function getPackageRelativePath(
  directoryPath: string,
  filePath: string,
): string | null {
  const normalizedDirectoryPath = normalizeComparisonPath(directoryPath);
  const normalizedFilePath = normalizeComparisonPath(filePath);
  if (!normalizedDirectoryPath || !normalizedFilePath) {
    return null;
  }
  if (normalizedFilePath === normalizedDirectoryPath) {
    return "";
  }
  if (!normalizedFilePath.startsWith(`${normalizedDirectoryPath}/`)) {
    return null;
  }
  return normalizedFilePath.slice(normalizedDirectoryPath.length + 1);
}

function resolvePackageRuntimeModuleImportPath(
  fromModuleRelativePath: string,
  specifier: string,
): string | null {
  const importerSegments = fromModuleRelativePath
    .replace(/\\/g, "/")
    .split("/")
    .filter(Boolean);
  importerSegments.pop();
  const specifierSegments = specifier.replace(/\\/g, "/").split("/");
  return normalizeRelativeRuntimeModulePath(
    [...importerSegments, ...specifierSegments].join("/"),
  );
}

function buildRuntimeModuleCandidates(relativePath: string): string[] {
  const normalizedRelativePath = normalizeRelativeRuntimeModulePath(relativePath);
  if (!normalizedRelativePath) {
    return [];
  }
  const candidates = new Set<string>();
  if (/\.[^./]+$/.test(normalizedRelativePath)) {
    candidates.add(normalizedRelativePath);
  } else {
    for (const extension of explorerWidgetRuntimeModuleExtensions) {
      candidates.add(`${normalizedRelativePath}.${extension}`);
      candidates.add(`${normalizedRelativePath}/index.${extension}`);
    }
  }
  return [...candidates];
}

function createExplorerWidgetRelativeModuleSourceResolver(
  directoryPath: string,
): RuntimeRelativeModuleSourceResolver {
  return async ({ fromModulePath, specifier }) => {
    const fromModuleRelativePath = getPackageRelativePath(
      directoryPath,
      fromModulePath,
    );
    if (fromModuleRelativePath == null) {
      return null;
    }
    const resolvedImportPath = resolvePackageRuntimeModuleImportPath(
      fromModuleRelativePath,
      specifier,
    );
    if (!resolvedImportPath) {
      return null;
    }
    for (const candidateRelativePath of buildRuntimeModuleCandidates(
      resolvedImportPath,
    )) {
      const candidateAbsolutePath = joinPlatformPath(
        directoryPath,
        candidateRelativePath,
      );
      try {
        const source = await commands
          .fsReadTextFile(candidateAbsolutePath)
          .then(unwrapTauriResult);
        return {
          modulePath: candidateAbsolutePath,
          source,
        };
      } catch {
        continue;
      }
    }
    return null;
  };
}

async function resolveRelativeRuntimeFileEntry(
  directoryPath: string,
  relativePath: string,
): Promise<RuntimeFileEntry | null> {
  const normalizedRelativePath = normalizeRelativeRuntimeModulePath(relativePath);
  if (!normalizedRelativePath) {
    return null;
  }
  for (const candidateRelativePath of buildRuntimeModuleCandidates(
    normalizedRelativePath,
  )) {
    const candidateAbsolutePath = joinPlatformPath(
      directoryPath,
      candidateRelativePath,
    );
    try {
      await commands
        .fsReadTextFile(candidateAbsolutePath)
        .then(unwrapTauriResult);
      const extension = candidateRelativePath.split(".").pop() ?? "";
      return {
        name: candidateRelativePath.split("/").pop() ?? candidateRelativePath,
        path: candidateAbsolutePath,
        extension,
        modified: 0,
        is_dir: false,
      };
    } catch {
      continue;
    }
  }
  return null;
}

function deriveExplorerWidgetPackId(record: {
  packageId: string;
  manifest: ExplorerWidgetPackManifest;
}): string {
  return (
    asString(record.manifest.explorerWidget?.id) ||
    asString(record.manifest.id) ||
    record.packageId
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") ||
    "explorer-widget"
  );
}

function deriveExplorerWidgetPackTitle(
  record: {
    packageId: string;
    manifest: ExplorerWidgetPackManifest;
  },
  packId: string,
): string {
  return (
    asString(record.manifest.explorerWidget?.title) ||
    asString(record.manifest.name) ||
    packId
      .replace(/-/g, " ")
      .replace(/\b\w/g, (character) => character.toUpperCase())
  );
}

function normalizeExplorerWidgetManifestValue(
  value: unknown,
  filePath: string,
): ExplorerWidgetPackManifest {
  const source = asRecord(value);
  if (!source) {
    throw new Error(`Explorer-widget manifest must be an object: ${filePath}`);
  }
  const explorerWidgetSource = asRecord(source.explorerWidget);
  return {
    version: typeof source.version === "number" ? source.version : 1,
    id: asString(source.id),
    name: asString(source.name),
    description: asString(source.description),
    author: asString(source.author),
    homepage: asString(source.homepage),
    tags: asStringArray(source.tags),
    explorerWidget: explorerWidgetSource
      ? {
          id: asString(explorerWidgetSource.id),
          title: asString(explorerWidgetSource.title),
          shortLabel: asString(explorerWidgetSource.shortLabel),
          description: asString(explorerWidgetSource.description),
          category: asString(explorerWidgetSource.category),
          rendererKind:
            explorerWidgetSource.rendererKind === "wasm-panel"
              ? "wasm-panel"
              : "react",
          renderer: asString(explorerWidgetSource.renderer),
          rendererEntry: asString(explorerWidgetSource.rendererEntry),
          runtimeId: asString(explorerWidgetSource.runtimeId),
          runtimeRef: asString(explorerWidgetSource.runtimeRef),
          runtimeSurfaceId: asString(explorerWidgetSource.runtimeSurfaceId),
          runtimeSurfaceRef: asString(explorerWidgetSource.runtimeSurfaceRef),
          buildTarget: asString(explorerWidgetSource.buildTarget),
          priority:
            typeof explorerWidgetSource.priority === "number"
              ? explorerWidgetSource.priority
              : undefined,
          available: explorerWidgetSource.available !== false,
          chromeControlId: asString(explorerWidgetSource.chromeControlId),
          surfaces: normalizeExplorerWidgetSurfaces(
            explorerWidgetSource.surfaces as Partial<ExplorerWidgetSurfaceContract>,
          ),
          sizing: normalizeExplorerWidgetSizing(
            explorerWidgetSource.sizing as Partial<ExplorerWidgetSizingContract>,
          ),
          capabilities: normalizeExplorerWidgetCapabilities(
            explorerWidgetSource.capabilities as Partial<ExplorerWidgetCapabilityFlags>,
          ),
        }
      : undefined,
  };
}

async function loadExplorerWidgetFromManifestRecord(
  manifestRecord: ManagedContentStackManifestRecord<ExplorerWidgetPackManifest>,
): Promise<LoadedExplorerWidgetDefinition> {
  const warnings: string[] = [];
  const packId = deriveExplorerWidgetPackId(manifestRecord);
  const title = deriveExplorerWidgetPackTitle(manifestRecord, packId);
  const explorerWidgetManifest = manifestRecord.manifest.explorerWidget ?? {};
  const descriptorDefaults: ExplorerWidgetDescriptorInput = {
    id: packId,
    title,
    shortLabel: explorerWidgetManifest.shortLabel || title,
    description:
      explorerWidgetManifest.description || manifestRecord.manifest.description,
    category: explorerWidgetManifest.category || "widgets",
    tags: manifestRecord.manifest.tags ?? [],
    priority: explorerWidgetManifest.priority ?? 0,
    available: explorerWidgetManifest.available !== false,
    chromeControlId:
      (explorerWidgetManifest.chromeControlId as ExplorerWidgetDescriptor["chromeControlId"]) ||
      toExplorerWidgetChromeControlId(packId),
    rendererKind:
      explorerWidgetManifest.rendererKind === "wasm-panel" ? "wasm-panel" : "react",
    runtimeId:
      explorerWidgetManifest.runtimeId ||
      explorerWidgetManifest.runtimeRef ||
      explorerWidgetManifest.runtimeSurfaceId ||
      explorerWidgetManifest.runtimeSurfaceRef ||
      null,
    runtimeSurfaceId:
      explorerWidgetManifest.runtimeSurfaceId ||
      explorerWidgetManifest.runtimeSurfaceRef ||
      null,
    buildTarget: explorerWidgetManifest.buildTarget || null,
    surfaces: explorerWidgetManifest.surfaces,
    sizing: explorerWidgetManifest.sizing,
    capabilities: explorerWidgetManifest.capabilities,
  };

  if (descriptorDefaults.rendererKind === "wasm-panel") {
    const runtimeId =
      descriptorDefaults.runtimeSurfaceId || descriptorDefaults.runtimeId;
    if (!runtimeId) {
      warnings.push(
        `Explorer widget ${title}: wasm-panel widgets require runtimeSurfaceId, runtimeSurfaceRef, runtimeId, or runtimeRef`,
      );
      return {
        ...normalizeExplorerWidgetDescriptor(descriptorDefaults, {
          id: packId,
          title,
        }),
        version: manifestRecord.manifest.version ?? 1,
        name: title,
        directoryPath: manifestRecord.packageDirectory,
        manifestPath: manifestRecord.manifestPath,
        sourceKind: "explorer-widget-directory",
        sourceLabel: manifestRecord.manifestPath,
        author: manifestRecord.manifest.author || undefined,
        homepage: manifestRecord.manifest.homepage || undefined,
        warnings,
        component: null,
        error: "Missing wasm runtime id",
      };
    }
    const descriptor = normalizeExplorerWidgetDescriptor(
      {
        ...descriptorDefaults,
        runtimeId,
        runtimeSurfaceId: runtimeId,
      },
      { id: packId, title },
    );
    return {
      ...descriptor,
      version: manifestRecord.manifest.version ?? 1,
      name: title,
      directoryPath: manifestRecord.packageDirectory,
      manifestPath: manifestRecord.manifestPath,
      sourceKind: "explorer-widget-directory",
      sourceLabel: manifestRecord.manifestPath,
      author: manifestRecord.manifest.author || undefined,
      homepage: manifestRecord.manifest.homepage || undefined,
      warnings,
      component: (props) =>
        React.createElement(ExplorerWasmWidgetSurface, {
          ...props,
          runtimeId,
          buildTarget: descriptor.buildTarget,
        }),
      error: null,
    };
  }

  const rendererEntryPath =
    explorerWidgetManifest.rendererEntry || explorerWidgetManifest.renderer || "";
  if (!rendererEntryPath) {
    warnings.push(`Explorer widget ${title}: missing renderer entry path`);
    return {
      ...normalizeExplorerWidgetDescriptor(descriptorDefaults, {
        id: packId,
        title,
      }),
      version: manifestRecord.manifest.version ?? 1,
      name: title,
      directoryPath: manifestRecord.packageDirectory,
      manifestPath: manifestRecord.manifestPath,
      sourceKind: "explorer-widget-directory",
      sourceLabel: manifestRecord.manifestPath,
      author: manifestRecord.manifest.author || undefined,
      homepage: manifestRecord.manifest.homepage || undefined,
      warnings,
      component: null,
      error: "Missing renderer entry path",
    };
  }
  const rendererEntry = await resolveRelativeRuntimeFileEntry(
    manifestRecord.packageDirectory,
    rendererEntryPath,
  );
  if (!rendererEntry) {
    warnings.push(
      `Explorer widget ${title}: renderer ${rendererEntryPath} could not be resolved`,
    );
    return {
      ...normalizeExplorerWidgetDescriptor(descriptorDefaults, {
        id: packId,
        title,
      }),
      version: manifestRecord.manifest.version ?? 1,
      name: title,
      directoryPath: manifestRecord.packageDirectory,
      manifestPath: manifestRecord.manifestPath,
      sourceKind: "explorer-widget-directory",
      sourceLabel: manifestRecord.manifestPath,
      author: manifestRecord.manifest.author || undefined,
      homepage: manifestRecord.manifest.homepage || undefined,
      warnings,
      component: null,
      error: "Renderer entry could not be resolved",
    };
  }

  const source = await commands
    .fsReadTextFile(rendererEntry.path)
    .then(unwrapTauriResult);
  const loadOptions: LoadExplorerWidgetFromSourceOptions = {
    descriptorDefaults: {
      ...descriptorDefaults,
      rendererEntry: rendererEntryPath,
    },
    resolveRelativeModuleSource: createExplorerWidgetRelativeModuleSourceResolver(
      manifestRecord.packageDirectory,
    ),
  };
  const loadedModule: LoadedExplorerWidgetModule = await loadExplorerWidgetFromSource(
    source,
    rendererEntry,
    loadOptions,
  );
  return {
    ...loadedModule.descriptor,
    version: manifestRecord.manifest.version ?? 1,
    name: title,
    directoryPath: manifestRecord.packageDirectory,
    manifestPath: manifestRecord.manifestPath,
    sourceKind: "explorer-widget-directory",
    sourceLabel: manifestRecord.manifestPath,
    author: manifestRecord.manifest.author || undefined,
    homepage: manifestRecord.manifest.homepage || undefined,
    warnings,
    component: loadedModule.component,
    error: loadedModule.error,
  };
}

export async function discoverManagedExplorerWidgets(): Promise<
  ManagedContentDirectoryLoadResult<LoadedExplorerWidgetDefinition>
> {
  if (!isTauri()) {
    return {
      packages: [],
      directory: explorerWidgetSystemConfig.explorerWidgetsDirectory,
      warnings: [],
      sourceError: null,
    };
  }
  const manifestResult =
    await loadManagedContentManifestsFromDirectoryStack<ExplorerWidgetPackManifest>({
      directoryId: "explorerWidgets",
      manifestNames: explorerWidgetSystemConfig.manifestNames,
    });
  const normalizedManifestRecords = manifestResult.packages.map(
    (manifestRecord) => ({
      ...manifestRecord,
      manifest: normalizeExplorerWidgetManifestValue(
        manifestRecord.manifest,
        manifestRecord.manifestPath,
      ),
    }),
  );
  const loadedWidgets = await Promise.all(
    normalizedManifestRecords.map(async (manifestRecord) => {
      try {
        return await loadExplorerWidgetFromManifestRecord(manifestRecord);
      } catch (error) {
        const packId = deriveExplorerWidgetPackId(manifestRecord);
        const title = deriveExplorerWidgetPackTitle(manifestRecord, packId);
        return {
          ...normalizeExplorerWidgetDescriptor(
            {
              id: packId,
              title,
              description: manifestRecord.manifest.description,
              tags: manifestRecord.manifest.tags ?? [],
            },
            { id: packId, title },
          ),
          version: manifestRecord.manifest.version ?? 1,
          name: title,
          directoryPath: manifestRecord.packageDirectory,
          manifestPath: manifestRecord.manifestPath,
          sourceKind: "explorer-widget-directory" as const,
          sourceLabel: manifestRecord.manifestPath,
          author: manifestRecord.manifest.author || undefined,
          homepage: manifestRecord.manifest.homepage || undefined,
          warnings: [],
          component: null,
          error: String(error),
        } satisfies LoadedExplorerWidgetDefinition;
      }
    }),
  );
  return {
    packages: loadedWidgets.sort(
      (left, right) =>
        right.priority - left.priority || left.title.localeCompare(right.title),
    ),
    directory: manifestResult.directory,
    warnings: manifestResult.warnings,
    sourceError: manifestResult.sourceError,
  };
}
