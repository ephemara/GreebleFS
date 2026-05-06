import { isTauri } from "@tauri-apps/api/core";
import { mkdir, writeTextFile } from "@tauri-apps/plugin-fs";

import { getManagedContentDirectory } from "./appContentDirectories";
import {
  getManagedContentWritableDirectory,
  loadManagedContentManifestsFromDirectoryStack,
} from "./managedContentDirectoryStacks";
import { joinPlatformPath } from "./platform";
import { resolveRuntimeAssetPollingEnabled } from "./runtimeAssetPolling";
import type { DockPlacementMode, DockPreviewSplitMode } from "./dockPresentations";
import type { LayoutDynamicsAuthoringSnapshot } from "./layoutDynamics";
import type { PresentationWindowMode } from "../store/settingsStore";

type LooseRecord = Record<string, unknown>;

export type LookdevScope = "shared" | "windowed" | "dock";
export type LookdevApplyTarget = "preset" | "profile" | "theme-assets";

export interface LookdevPresetExports {
  themeBundleId?: string | null;
  topBarId?: string | null;
  dockPresentationId?: string | null;
  menuPackId?: string | null;
  explorerLayoutId?: string | null;
}

export interface LookdevAppearanceOverrides {
  activeThemeId?: string | null;
  activeAppearancePackId?: string | null;
  activeThemeRecipeId?: string | null;
  activeThemeEngineId?: string | null;
  activeShellRendererId?: string | null;
  activeTopBarId?: string | null;
  activeIconThemeId?: string | null;
  activeWallpaperId?: string | null;
  activeShaderId?: string | null;
  uiFontFamily?: string;
  accentColor?: string;
  compactMode?: boolean;
  useNativeOsIcons?: boolean;
  appOpacity?: number;
  panelTransparency?: number;
  appZoom?: number;
  appBlur?: boolean;
  appBlurStrength?: number;
  topBarLayoutSnapshotsById?: Record<string, LayoutDynamicsAuthoringSnapshot>;
}

export interface LookdevExplorerOverrides {
  activeMenuPackId?: string | null;
  followThemeExplorerLayout?: boolean;
  activeExplorerLayoutId?: string | null;
  layoutSelectionByPresentationMode?: Record<string, unknown>;
  modeProfileOverridesByThemeId?: Record<string, unknown>;
  chromeLayoutOverridesByThemeId?: Record<string, unknown>;
}

export interface LookdevDockOverrides {
  activePresentationId?: string | null;
  placementMode?: DockPlacementMode;
  edgeSize?: number;
  edgeWidth?: number;
  defaultTerminalRows?: number;
  defaultTerminalColumns?: number;
  floatingBounds?: Record<string, unknown> | null;
  topBarId?: string | null;
  previewEnabled?: boolean;
  previewSplitMode?: DockPreviewSplitMode;
}

export interface LookdevPresentationOverrides {
  windowMode?: PresentationWindowMode;
}

export interface LookdevPresetScopedOverrides {
  appearance?: LookdevAppearanceOverrides;
  explorer?: LookdevExplorerOverrides;
  dock?: LookdevDockOverrides;
  presentation?: LookdevPresentationOverrides;
}

export interface LookdevPresetManifest {
  version?: number;
  id?: string;
  name?: string;
  description?: string;
  tags?: string[];
  exports?: LookdevPresetExports;
  shared?: LookdevPresetScopedOverrides;
  windowed?: LookdevPresetScopedOverrides;
  dock?: LookdevPresetScopedOverrides;
}

export interface LoadedLookdevPreset {
  id: string;
  localId: string;
  name: string;
  description: string;
  directoryPath: string;
  manifestPath: string;
  tags: string[];
  warnings: string[];
  exports: LookdevPresetExports;
  manifest: LookdevPresetManifest;
}

export interface LookdevPresetLoadResult {
  presets: LoadedLookdevPreset[];
  directory: string;
  warnings: string[];
  sourceError: string | null;
}

export const lookdevPresetSystemConfig = {
  get presetsDirectory(): string {
    return getManagedContentDirectory("lookdevPresets");
  },
  manifestNames: [
    "lookdev-preset.json",
    "lookdev-preset.toml",
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

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function asBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .filter((entry): entry is string => typeof entry === "string")
        .map((entry) => entry.trim())
        .filter(Boolean),
    ),
  );
}

function normalizeLookdevPresetIdFragment(
  value: string | undefined,
  fallback: string,
): string {
  const normalized = (value ?? fallback)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || fallback;
}

function cloneJsonValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function normalizeLookdevPresetExports(
  value: unknown,
): LookdevPresetExports | undefined {
  const source = asRecord(value);
  if (!source) {
    return undefined;
  }

  return {
    themeBundleId: asString(source.themeBundleId) || undefined,
    topBarId: asString(source.topBarId) || undefined,
    dockPresentationId: asString(source.dockPresentationId) || undefined,
    menuPackId: asString(source.menuPackId) || undefined,
    explorerLayoutId: asString(source.explorerLayoutId) || undefined,
  };
}

function normalizeLookdevAppearanceOverrides(
  value: unknown,
): LookdevAppearanceOverrides | undefined {
  const source = asRecord(value);
  if (!source) {
    return undefined;
  }

  const normalized: LookdevAppearanceOverrides = {};

  if ("activeThemeId" in source) {
    normalized.activeThemeId = asString(source.activeThemeId) || null;
  }
  if ("activeAppearancePackId" in source) {
    normalized.activeAppearancePackId =
      asString(source.activeAppearancePackId) || null;
  }
  if ("activeThemeRecipeId" in source) {
    normalized.activeThemeRecipeId =
      asString(source.activeThemeRecipeId) || null;
  }
  if ("activeThemeEngineId" in source) {
    normalized.activeThemeEngineId =
      asString(source.activeThemeEngineId) || null;
  }
  if ("activeShellRendererId" in source) {
    normalized.activeShellRendererId =
      asString(source.activeShellRendererId) || null;
  }
  if ("activeTopBarId" in source) {
    normalized.activeTopBarId = asString(source.activeTopBarId) || null;
  }
  if ("activeIconThemeId" in source) {
    normalized.activeIconThemeId = asString(source.activeIconThemeId) || null;
  }
  if ("activeWallpaperId" in source) {
    normalized.activeWallpaperId = asString(source.activeWallpaperId) || null;
  }
  if ("activeShaderId" in source) {
    normalized.activeShaderId = asString(source.activeShaderId) || null;
  }
  if ("uiFontFamily" in source) {
    normalized.uiFontFamily = asString(source.uiFontFamily) || undefined;
  }
  if ("accentColor" in source) {
    normalized.accentColor = asString(source.accentColor) || undefined;
  }
  if ("compactMode" in source) {
    normalized.compactMode = asBoolean(source.compactMode);
  }
  if ("useNativeOsIcons" in source) {
    normalized.useNativeOsIcons = asBoolean(source.useNativeOsIcons);
  }
  if ("appOpacity" in source) {
    normalized.appOpacity = asNumber(source.appOpacity);
  }
  if ("panelTransparency" in source) {
    normalized.panelTransparency = asNumber(source.panelTransparency);
  }
  if ("appZoom" in source) {
    normalized.appZoom = asNumber(source.appZoom);
  }
  if ("appBlur" in source) {
    normalized.appBlur = asBoolean(source.appBlur);
  }
  if ("appBlurStrength" in source) {
    normalized.appBlurStrength = asNumber(source.appBlurStrength);
  }

  const topBarLayoutSnapshotsById = asRecord(source.topBarLayoutSnapshotsById);
  if (topBarLayoutSnapshotsById) {
    normalized.topBarLayoutSnapshotsById = cloneJsonValue(
      topBarLayoutSnapshotsById as Record<string, LayoutDynamicsAuthoringSnapshot>,
    );
  }

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

function normalizeLookdevExplorerOverrides(
  value: unknown,
): LookdevExplorerOverrides | undefined {
  const source = asRecord(value);
  if (!source) {
    return undefined;
  }

  const normalized: LookdevExplorerOverrides = {};

  if ("activeMenuPackId" in source) {
    normalized.activeMenuPackId = asString(source.activeMenuPackId) || null;
  }
  if ("followThemeExplorerLayout" in source) {
    normalized.followThemeExplorerLayout = asBoolean(
      source.followThemeExplorerLayout,
    );
  }
  if ("activeExplorerLayoutId" in source) {
    normalized.activeExplorerLayoutId =
      asString(source.activeExplorerLayoutId) || null;
  }

  const layoutSelectionByPresentationMode = asRecord(
    source.layoutSelectionByPresentationMode,
  );
  if (layoutSelectionByPresentationMode) {
    normalized.layoutSelectionByPresentationMode = cloneJsonValue(
      layoutSelectionByPresentationMode,
    );
  }

  const modeProfileOverridesByThemeId = asRecord(
    source.modeProfileOverridesByThemeId,
  );
  if (modeProfileOverridesByThemeId) {
    normalized.modeProfileOverridesByThemeId = cloneJsonValue(
      modeProfileOverridesByThemeId,
    );
  }

  const chromeLayoutOverridesByThemeId = asRecord(
    source.chromeLayoutOverridesByThemeId,
  );
  if (chromeLayoutOverridesByThemeId) {
    normalized.chromeLayoutOverridesByThemeId = cloneJsonValue(
      chromeLayoutOverridesByThemeId,
    );
  }

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

function normalizeLookdevDockOverrides(
  value: unknown,
): LookdevDockOverrides | undefined {
  const source = asRecord(value);
  if (!source) {
    return undefined;
  }

  const normalized: LookdevDockOverrides = {};

  if ("activePresentationId" in source) {
    normalized.activePresentationId =
      asString(source.activePresentationId) || null;
  }
  if (
    source.placementMode === "top-edge" ||
    source.placementMode === "bottom-edge" ||
    source.placementMode === "floating"
  ) {
    normalized.placementMode = source.placementMode;
  }
  if ("edgeSize" in source) {
    normalized.edgeSize = asNumber(source.edgeSize);
  }
  if ("edgeWidth" in source) {
    normalized.edgeWidth = asNumber(source.edgeWidth);
  }
  if ("defaultTerminalRows" in source) {
    normalized.defaultTerminalRows = asNumber(source.defaultTerminalRows);
  }
  if ("defaultTerminalColumns" in source) {
    normalized.defaultTerminalColumns = asNumber(source.defaultTerminalColumns);
  }
  if ("topBarId" in source) {
    normalized.topBarId = asString(source.topBarId) || null;
  }
  if ("previewEnabled" in source) {
    normalized.previewEnabled = asBoolean(source.previewEnabled);
  }
  if (source.previewSplitMode === "inline" || source.previewSplitMode === "pane") {
    normalized.previewSplitMode = source.previewSplitMode;
  }

  const floatingBounds = asRecord(source.floatingBounds);
  if (floatingBounds || source.floatingBounds === null) {
    normalized.floatingBounds = floatingBounds
      ? cloneJsonValue(floatingBounds)
      : null;
  }

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

function normalizeLookdevPresentationOverrides(
  value: unknown,
): LookdevPresentationOverrides | undefined {
  const source = asRecord(value);
  if (!source) {
    return undefined;
  }

  if (source.windowMode === "windowed" || source.windowMode === "dock") {
    return { windowMode: source.windowMode };
  }

  return undefined;
}

function normalizeLookdevScopedOverrides(
  value: unknown,
): LookdevPresetScopedOverrides | undefined {
  const source = asRecord(value);
  if (!source) {
    return undefined;
  }

  const normalized: LookdevPresetScopedOverrides = {
    appearance: normalizeLookdevAppearanceOverrides(source.appearance),
    explorer: normalizeLookdevExplorerOverrides(source.explorer),
    dock: normalizeLookdevDockOverrides(source.dock),
    presentation: normalizeLookdevPresentationOverrides(source.presentation),
  };

  return Object.values(normalized).some((entry) => entry != null)
    ? normalized
    : undefined;
}

export function normalizeLookdevPresetManifest(
  value: unknown,
): LookdevPresetManifest {
  const source = asRecord(value) ?? {};

  return {
    version: typeof source.version === "number" ? source.version : 1,
    id: asString(source.id) || undefined,
    name: asString(source.name) || undefined,
    description: asString(source.description) || undefined,
    tags: asStringArray(source.tags),
    exports: normalizeLookdevPresetExports(source.exports),
    shared: normalizeLookdevScopedOverrides(source.shared),
    windowed: normalizeLookdevScopedOverrides(source.windowed),
    dock: normalizeLookdevScopedOverrides(source.dock),
  };
}

export function createEmptyLookdevPresetManifest(
  options?: Partial<Pick<LookdevPresetManifest, "id" | "name" | "description">>,
): LookdevPresetManifest {
  return {
    version: 1,
    id: options?.id,
    name: options?.name,
    description: options?.description,
    tags: ["lookdev"],
    exports: {},
    shared: {},
    windowed: {},
    dock: {},
  };
}

export function serializeLookdevPreset(
  preset: LookdevPresetManifest,
): string {
  return JSON.stringify(preset, null, 2);
}

function mergeLookdevScopedOverrides(
  base: LookdevPresetScopedOverrides | undefined,
  next: LookdevPresetScopedOverrides | undefined,
): LookdevPresetScopedOverrides {
  return {
    appearance: {
      ...(base?.appearance ?? {}),
      ...(next?.appearance ?? {}),
    },
    explorer: {
      ...(base?.explorer ?? {}),
      ...(next?.explorer ?? {}),
    },
    dock: {
      ...(base?.dock ?? {}),
      ...(next?.dock ?? {}),
    },
    presentation: {
      ...(base?.presentation ?? {}),
      ...(next?.presentation ?? {}),
    },
  };
}

export function resolveLookdevPresetForWindowMode(
  preset: LookdevPresetManifest,
  windowMode: PresentationWindowMode,
): LookdevPresetScopedOverrides {
  return mergeLookdevScopedOverrides(
    preset.shared,
    windowMode === "dock" ? preset.dock : preset.windowed,
  );
}

export function createLookdevPresetManifestFromScopeSnapshot(input: {
  id: string;
  name: string;
  description?: string;
  tags?: string[];
  scope: LookdevScope;
  exports?: LookdevPresetExports;
  scopedOverrides: LookdevPresetScopedOverrides;
}): LookdevPresetManifest {
  const manifest = createEmptyLookdevPresetManifest({
    id: input.id,
    name: input.name,
    description: input.description,
  });
  manifest.tags = input.tags ?? ["lookdev"];
  manifest.exports = input.exports ?? {};
  manifest[input.scope] = cloneJsonValue(input.scopedOverrides);
  return manifest;
}

export async function loadLookdevPresets(): Promise<LookdevPresetLoadResult> {
  if (!isTauri()) {
    return {
      presets: [],
      directory: lookdevPresetSystemConfig.presetsDirectory,
      warnings: [],
      sourceError: null,
    };
  }

  const result = await loadManagedContentManifestsFromDirectoryStack<LooseRecord>({
    directoryId: "lookdevPresets",
    manifestNames: lookdevPresetSystemConfig.manifestNames,
  });

  const presets: LoadedLookdevPreset[] = [];
  const warnings = [...result.warnings];

  for (const record of result.packages) {
    const manifest = normalizeLookdevPresetManifest(record.manifest);
    const localId = normalizeLookdevPresetIdFragment(
      manifest.id ?? record.packageId,
      "lookdev-preset",
    );
    const id = asString(manifest.id) || localId;
    const name =
      asString(manifest.name) ||
      localId.replace(/-/g, " ").replace(/\b\w/g, (character) =>
        character.toUpperCase(),
      );
    const description =
      asString(manifest.description) || "Semantic lookdev preset.";
    const presetWarnings: string[] = [];

    if (!manifest.shared && !manifest.windowed && !manifest.dock) {
      presetWarnings.push(
        `Lookdev preset "${id}" has no scoped overrides; it only carries metadata.`,
      );
    }

    presets.push({
      id,
      localId,
      name,
      description,
      directoryPath: record.packageDirectory,
      manifestPath: record.manifestPath,
      tags: manifest.tags ?? [],
      warnings: presetWarnings,
      exports: manifest.exports ?? {},
      manifest,
    });
    warnings.push(...presetWarnings);
  }

  presets.sort((left, right) => left.name.localeCompare(right.name));

  return {
    presets,
    directory: result.directory,
    warnings,
    sourceError: result.sourceError,
  };
}

export async function saveLookdevPresetManifest(
  preset: LookdevPresetManifest,
): Promise<LoadedLookdevPreset> {
  const localId = normalizeLookdevPresetIdFragment(
    preset.id ?? preset.name,
    "lookdev-preset",
  );
  const normalizedManifest: LookdevPresetManifest = {
    ...preset,
    version: 1,
    id: asString(preset.id) || localId,
  };
  const targetDirectory = joinPlatformPath(
    getManagedContentWritableDirectory("lookdevPresets"),
    localId,
  );
  const targetManifestPath = joinPlatformPath(
    targetDirectory,
    "lookdev-preset.json",
  );

  await mkdir(targetDirectory, { recursive: true });
  await writeTextFile(targetManifestPath, serializeLookdevPreset(normalizedManifest));

  return {
    id: normalizedManifest.id ?? localId,
    localId,
    name:
      normalizedManifest.name?.trim() ||
      localId.replace(/-/g, " ").replace(/\b\w/g, (character) =>
        character.toUpperCase(),
      ),
    description:
      normalizedManifest.description?.trim() || "Semantic lookdev preset.",
    directoryPath: targetDirectory,
    manifestPath: targetManifestPath,
    tags: normalizedManifest.tags ?? [],
    warnings: [],
    exports: normalizedManifest.exports ?? {},
    manifest: normalizedManifest,
  };
}
