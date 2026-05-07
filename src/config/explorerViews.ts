import { isTauri } from "@tauri-apps/api/core";
import React from "react";

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
  ExplorerWasmRuntimeSurface,
  normalizeExplorerViewCapabilities,
  normalizeExplorerViewDensityContract,
  normalizeExplorerViewDescriptor,
  normalizeExplorerViewSurfaceOwnership,
  type ExplorerViewCapabilityFlags,
  type ExplorerViewDensityContract,
  type ExplorerViewDescriptor,
  type ExplorerViewProps,
  type ExplorerViewSurfaceOwnership,
  type LoadExplorerViewFromSourceOptions,
  type LoadedExplorerViewModule,
  loadExplorerViewFromSource,
} from "../components/explorer/explorerViewRuntime";
import type {
  RuntimeFileEntry,
  RuntimeRelativeModuleSourceResolver,
} from "../runtime/moduleRuntime";

type LooseRecord = Record<string, unknown>;

const explorerViewRuntimeModuleExtensions = ["ts", "tsx", "js", "jsx"] as const;

export interface ExplorerViewPackManifest {
  version?: number;
  id?: string;
  name?: string;
  description?: string;
  author?: string;
  homepage?: string;
  tags?: string[];
  explorerView?: {
    id?: string;
    title?: string;
    shortLabel?: string;
    description?: string;
    rendererKind?: "react" | "wasm-panel";
    renderer?: string;
    rendererEntry?: string;
    runtimeId?: string;
    runtimeRef?: string;
    runtimeSurfaceId?: string;
    runtimeSurfaceRef?: string;
    buildTarget?: string;
    ownership?: "content" | "surface";
    priority?: number;
    available?: boolean;
    surfaceOwnership?: Partial<ExplorerViewSurfaceOwnership>;
    density?: Partial<ExplorerViewDensityContract>;
    capabilities?: Partial<ExplorerViewCapabilityFlags>;
  };
}

export interface LoadedExplorerViewDefinition extends ExplorerViewDescriptor {
  version: number;
  name: string;
  directoryPath: string;
  manifestPath: string;
  sourceKind: "explorer-view-directory" | "plugin" | "built-in";
  sourceLabel: string;
  author?: string;
  homepage?: string;
  warnings: string[];
  component: React.ComponentType<ExplorerViewProps> | null;
  error: string | null;
}

export const explorerViewSystemConfig = {
  get explorerViewsDirectory(): string {
    return getManagedContentDirectory("explorerViews");
  },
  manifestNames: [
    "explorer-view.json",
    "explorer-view.toml",
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
    for (const extension of explorerViewRuntimeModuleExtensions) {
      candidates.add(`${normalizedRelativePath}.${extension}`);
      candidates.add(`${normalizedRelativePath}/index.${extension}`);
    }
  }
  return [...candidates];
}

function createExplorerViewRelativeModuleSourceResolver(
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
      const metadata = await commands
        .fsStat(candidateAbsolutePath)
        .then(unwrapTauriResult);
      const extension = candidateRelativePath.split(".").pop() ?? "";
      return {
        name: candidateRelativePath.split("/").pop() ?? candidateRelativePath,
        path: candidateAbsolutePath,
        extension,
        modified:
          typeof metadata.modifiedMs === "number" && Number.isFinite(metadata.modifiedMs)
            ? metadata.modifiedMs
            : 0,
        is_dir: metadata.isDir === true,
      };
    } catch {
      continue;
    }
  }
  return null;
}

function deriveExplorerViewPackId(record: {
  packageId: string;
  manifest: ExplorerViewPackManifest;
}): string {
  return (
    asString(record.manifest.explorerView?.id) ||
    asString(record.manifest.id) ||
    record.packageId
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") ||
    "explorer-view"
  );
}

function deriveExplorerViewPackTitle(
  record: {
    packageId: string;
    manifest: ExplorerViewPackManifest;
  },
  packId: string,
): string {
  return (
    asString(record.manifest.explorerView?.title) ||
    asString(record.manifest.name) ||
    packId
      .replace(/-/g, " ")
      .replace(/\b\w/g, (character) => character.toUpperCase())
  );
}

function normalizeExplorerViewManifestValue(
  value: unknown,
  filePath: string,
): ExplorerViewPackManifest {
  const source = asRecord(value);
  if (!source) {
    throw new Error(`Explorer-view manifest must be an object: ${filePath}`);
  }
  const explorerViewSource = asRecord(source.explorerView);
  return {
    version: typeof source.version === "number" ? source.version : 1,
    id: asString(source.id),
    name: asString(source.name),
    description: asString(source.description),
    author: asString(source.author),
    homepage: asString(source.homepage),
    tags: asStringArray(source.tags),
    explorerView: explorerViewSource
      ? {
          id: asString(explorerViewSource.id),
          title: asString(explorerViewSource.title),
          shortLabel: asString(explorerViewSource.shortLabel),
          description: asString(explorerViewSource.description),
          rendererKind:
            explorerViewSource.rendererKind === "wasm-panel"
              ? "wasm-panel"
              : "react",
          renderer: asString(explorerViewSource.renderer),
          rendererEntry: asString(explorerViewSource.rendererEntry),
          runtimeId: asString(explorerViewSource.runtimeId),
          runtimeRef: asString(explorerViewSource.runtimeRef),
          runtimeSurfaceId: asString(explorerViewSource.runtimeSurfaceId),
          runtimeSurfaceRef: asString(explorerViewSource.runtimeSurfaceRef),
          buildTarget: asString(explorerViewSource.buildTarget),
          ownership:
            explorerViewSource.ownership === "surface" ? "surface" : "content",
          priority:
            typeof explorerViewSource.priority === "number"
              ? explorerViewSource.priority
              : undefined,
          available: explorerViewSource.available !== false,
          surfaceOwnership: normalizeExplorerViewSurfaceOwnership(
            explorerViewSource.surfaceOwnership as Partial<ExplorerViewSurfaceOwnership>,
          ),
          density: normalizeExplorerViewDensityContract(
            explorerViewSource.density as Partial<ExplorerViewDensityContract>,
          ),
          capabilities: normalizeExplorerViewCapabilities(
            explorerViewSource.capabilities as Partial<ExplorerViewCapabilityFlags>,
          ),
        }
      : undefined,
  };
}

async function loadExplorerViewFromManifestRecord(
  manifestRecord: ManagedContentStackManifestRecord<ExplorerViewPackManifest>,
): Promise<LoadedExplorerViewDefinition> {
  const warnings: string[] = [];
  const packId = deriveExplorerViewPackId(manifestRecord);
  const title = deriveExplorerViewPackTitle(manifestRecord, packId);
  const explorerViewManifest = manifestRecord.manifest.explorerView ?? {};
  const descriptorDefaults: Partial<ExplorerViewDescriptor> = {
    id: packId,
    title,
    shortLabel: explorerViewManifest.shortLabel || title,
    description:
      explorerViewManifest.description || manifestRecord.manifest.description,
    tags: manifestRecord.manifest.tags ?? [],
    priority: explorerViewManifest.priority ?? 0,
    available: explorerViewManifest.available !== false,
    rendererKind:
      explorerViewManifest.rendererKind === "wasm-panel" ? "wasm-panel" : "react",
    runtimeId:
      explorerViewManifest.runtimeId ||
      explorerViewManifest.runtimeRef ||
      explorerViewManifest.runtimeSurfaceId ||
      explorerViewManifest.runtimeSurfaceRef ||
      null,
    runtimeSurfaceId:
      explorerViewManifest.runtimeSurfaceId ||
      explorerViewManifest.runtimeSurfaceRef ||
      null,
    buildTarget: explorerViewManifest.buildTarget || null,
    ownership: explorerViewManifest.ownership === "surface" ? "surface" : "content",
    surfaceOwnership: explorerViewManifest.surfaceOwnership,
    density: explorerViewManifest.density ?? null,
    capabilities: explorerViewManifest.capabilities,
  };

  if (descriptorDefaults.rendererKind === "wasm-panel") {
    const runtimeId =
      descriptorDefaults.runtimeSurfaceId || descriptorDefaults.runtimeId;
    if (!runtimeId) {
      warnings.push(
        `Explorer view ${title}: wasm-panel views require runtimeSurfaceId, runtimeSurfaceRef, runtimeId, or runtimeRef`,
      );
      return {
        ...normalizeExplorerViewDescriptor(descriptorDefaults, {
          id: packId,
          title,
        }),
        version: manifestRecord.manifest.version ?? 1,
        name: title,
        directoryPath: manifestRecord.packageDirectory,
        manifestPath: manifestRecord.manifestPath,
        sourceKind: "explorer-view-directory",
        sourceLabel: manifestRecord.manifestPath,
        author: manifestRecord.manifest.author || undefined,
        homepage: manifestRecord.manifest.homepage || undefined,
        warnings,
        component: null,
        error: "Missing wasm runtime id",
      };
    }
    const descriptor = normalizeExplorerViewDescriptor(
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
      sourceKind: "explorer-view-directory",
      sourceLabel: manifestRecord.manifestPath,
      author: manifestRecord.manifest.author || undefined,
      homepage: manifestRecord.manifest.homepage || undefined,
      warnings,
      component: (props) =>
        React.createElement(ExplorerWasmRuntimeSurface, {
          ...props,
          runtimeId,
          buildTarget: descriptor.buildTarget,
        }),
      error: null,
    };
  }

  const rendererEntryPath =
    explorerViewManifest.rendererEntry || explorerViewManifest.renderer || "";
  if (!rendererEntryPath) {
    warnings.push(`Explorer view ${title}: missing renderer entry path`);
    return {
      ...normalizeExplorerViewDescriptor(descriptorDefaults, {
        id: packId,
        title,
      }),
      version: manifestRecord.manifest.version ?? 1,
      name: title,
      directoryPath: manifestRecord.packageDirectory,
      manifestPath: manifestRecord.manifestPath,
      sourceKind: "explorer-view-directory",
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
      `Explorer view ${title}: renderer ${rendererEntryPath} could not be resolved`,
    );
    return {
      ...normalizeExplorerViewDescriptor(descriptorDefaults, {
        id: packId,
        title,
      }),
      version: manifestRecord.manifest.version ?? 1,
      name: title,
      directoryPath: manifestRecord.packageDirectory,
      manifestPath: manifestRecord.manifestPath,
      sourceKind: "explorer-view-directory",
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
  const loadOptions: LoadExplorerViewFromSourceOptions = {
    descriptorDefaults: {
      ...descriptorDefaults,
      rendererEntry: rendererEntryPath,
    },
    resolveRelativeModuleSource: createExplorerViewRelativeModuleSourceResolver(
      manifestRecord.packageDirectory,
    ),
  };
  const loadedModule: LoadedExplorerViewModule = await loadExplorerViewFromSource(
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
    sourceKind: "explorer-view-directory",
    sourceLabel: manifestRecord.manifestPath,
    author: manifestRecord.manifest.author || undefined,
    homepage: manifestRecord.manifest.homepage || undefined,
    warnings,
    component: loadedModule.component,
    error: loadedModule.error,
  };
}

export async function discoverManagedExplorerViews(): Promise<
  ManagedContentDirectoryLoadResult<LoadedExplorerViewDefinition>
> {
  if (!isTauri()) {
    return {
      packages: [],
      directory: explorerViewSystemConfig.explorerViewsDirectory,
      warnings: [],
      sourceError: null,
    };
  }
  const manifestResult =
    await loadManagedContentManifestsFromDirectoryStack<ExplorerViewPackManifest>({
      directoryId: "explorerViews",
      manifestNames: explorerViewSystemConfig.manifestNames,
    });
  const normalizedManifestRecords = manifestResult.packages.map(
    (manifestRecord) => ({
      ...manifestRecord,
      manifest: normalizeExplorerViewManifestValue(
        manifestRecord.manifest,
        manifestRecord.manifestPath,
      ),
    }),
  );
  const loadedViews = await Promise.all(
    normalizedManifestRecords.map(async (manifestRecord) => {
      try {
        return await loadExplorerViewFromManifestRecord(manifestRecord);
      } catch (error) {
        const packId = deriveExplorerViewPackId(manifestRecord);
        const title = deriveExplorerViewPackTitle(manifestRecord, packId);
        return {
          ...normalizeExplorerViewDescriptor(
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
          sourceKind: "explorer-view-directory" as const,
          sourceLabel: manifestRecord.manifestPath,
          author: manifestRecord.manifest.author || undefined,
          homepage: manifestRecord.manifest.homepage || undefined,
          warnings: [],
          component: null,
          error: String(error),
        } satisfies LoadedExplorerViewDefinition;
      }
    }),
  );
  return {
    packages: loadedViews.sort(
      (left, right) =>
        right.priority - left.priority || left.title.localeCompare(right.title),
    ),
    directory: manifestResult.directory,
    warnings: manifestResult.warnings,
    sourceError: manifestResult.sourceError,
  };
}
