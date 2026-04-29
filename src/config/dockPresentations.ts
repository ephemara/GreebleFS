import { isTauri } from '@tauri-apps/api/core';
import { parse as parseToml } from 'smol-toml';

import shippedBuiltInDockPresentationManifestJson from '../../usr/dock-presentations/greeblefs-core/dock-presentation.json';
import { getManagedContentDirectory } from './appContentDirectories';
import {
  overlayWindowGeometry,
  type OverlayWindowBounds,
} from './overlayWindow';
import { joinPlatformPath } from './platform';
import { resolveRuntimeAssetPollingEnabled } from './runtimeAssetPolling';
import { commands, unwrapTauriResult } from '../runtime/tauriClient';

interface FileEntry {
  name: string;
  path: string;
  is_dir: boolean;
  extension: string;
  modified: number;
}

type LooseRecord = Record<string, unknown>;

export type DockPresentationSource =
  | 'built-in'
  | 'theme-package'
  | 'dock-presentation-package';
export type DockPlacementMode = 'top-edge' | 'bottom-edge' | 'floating';
export type DockPreviewSplitMode = 'inline' | 'pane';

export interface DockPresentationSizeDefinition {
  width?: number;
  height?: number;
}

export interface DockPreviewPolicyDefinition {
  enabled?: boolean;
  splitMode?: DockPreviewSplitMode;
}

export interface DockPresentationDefinition {
  id?: string;
  name?: string;
  description?: string;
  defaultPlacement?: DockPlacementMode;
  allowedPlacements?: DockPlacementMode[];
  defaultSize?: DockPresentationSizeDefinition;
  minSize?: DockPresentationSizeDefinition;
  topBarId?: string | null;
  preview?: DockPreviewPolicyDefinition;
  tags?: string[];
}

export interface LoadedDockPresentationDefinition {
  id: string;
  localId: string;
  name: string;
  description: string;
  source: DockPresentationSource;
  sourceLabel: string;
  sourceThemeId?: string;
  sourcePackageId?: string;
  defaultPlacement: DockPlacementMode;
  allowedPlacements: DockPlacementMode[];
  defaultSize: Required<DockPresentationSizeDefinition>;
  minSize: Required<DockPresentationSizeDefinition>;
  topBarId: string | null;
  preview: Required<DockPreviewPolicyDefinition>;
  tags: string[];
}

export interface DockPresentationPackageSourceLike {
  dockPresentations?: LoadedDockPresentationDefinition[] | null;
}

export interface ResolvedDockPresentation {
  availableDockPresentations: LoadedDockPresentationDefinition[];
  presentation: LoadedDockPresentationDefinition;
  resolvedFrom: 'explicit' | 'fallback';
  requestedPresentationId: string | null;
  explicitSelectionMissing: boolean;
  placementMode: DockPlacementMode;
  edgeSize: number;
  edgeWidth: number;
  floatingBounds: OverlayWindowBounds | null;
  topBarId: string | null;
  previewPolicy: {
    enabled: boolean;
    splitMode: DockPreviewSplitMode;
  };
}

export interface DockPresentationPackageManifest {
  version?: number;
  id?: string;
  name?: string;
  description?: string;
  author?: string;
  homepage?: string;
  tags?: string[];
  dockPresentation?: DockPresentationDefinition;
  dockPresentations?: DockPresentationDefinition[];
}

interface DockPresentationPackageRecord {
  directoryName: string;
  directoryPath: string;
  manifestPath: string;
  manifest: DockPresentationPackageManifest;
}

export interface LoadedDockPresentationPackage {
  id: string;
  name: string;
  version: number;
  directoryPath: string;
  manifestPath: string;
  sourceKind: 'dock-presentation-directory';
  description?: string;
  author?: string;
  homepage?: string;
  tags: string[];
  warnings: string[];
  dockPresentations: LoadedDockPresentationDefinition[];
}

export interface DockPresentationPackageLoadResult {
  packages: LoadedDockPresentationPackage[];
  directory: string;
  warnings: string[];
  sourceError: string | null;
}

interface ShippedBuiltInDockPresentationManifest {
  dockPresentation?: DockPresentationDefinition;
  dockPresentations?: DockPresentationDefinition[];
}

const shippedBuiltInDockPresentationManifest =
  shippedBuiltInDockPresentationManifestJson as ShippedBuiltInDockPresentationManifest;

export const DEFAULT_DOCK_PRESENTATION_ID = 'yakuake-workbench';
export const DEFAULT_DOCK_TOP_BAR_ID = 'dock-control-strip';

export const DOCK_PLACEMENT_MODES = [
  'top-edge',
  'bottom-edge',
  'floating',
] as const satisfies readonly DockPlacementMode[];

export const dockPresentationSystemConfig = {
  get dockPresentationsDirectory(): string {
    return getManagedContentDirectory('dockPresentations');
  },
  manifestNames: [
    'dock-presentation.json',
    'dock-presentation.toml',
    'manifest.json',
    'manifest.toml',
  ] as const,
  runtimeAssetPollingEnabled: resolveRuntimeAssetPollingEnabled(),
  scanIntervalMs: 5000,
};

function asRecord(value: unknown): LooseRecord | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as LooseRecord;
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : fallback;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter((entry): entry is string => typeof entry === 'string')
    .map(entry => entry.trim())
    .filter(Boolean);
}

function asFiniteNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.round(value)
    : fallback;
}

function normalizeDockPresentationIdFragment(
  value: string | undefined,
  fallback: string,
): string {
  const normalized = (value ?? fallback)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return normalized || fallback;
}

function normalizeLabel(value: unknown, fallback: string): string {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  return trimmed || fallback;
}

function normalizeTags(value: unknown): string[] {
  return Array.from(new Set(asStringArray(value)));
}

export function normalizeDockPlacementMode(
  value: unknown,
  fallback: DockPlacementMode = 'bottom-edge',
): DockPlacementMode {
  return DOCK_PLACEMENT_MODES.includes(value as DockPlacementMode)
    ? (value as DockPlacementMode)
    : fallback;
}

function normalizeAllowedDockPlacements(value: unknown): DockPlacementMode[] {
  if (!Array.isArray(value)) {
    return [...DOCK_PLACEMENT_MODES];
  }

  const allowed = Array.from(
    new Set(
      value
        .map(entry => normalizeDockPlacementMode(entry, 'bottom-edge'))
        .filter((entry): entry is DockPlacementMode =>
          DOCK_PLACEMENT_MODES.includes(entry),
        ),
    ),
  );

  return allowed.length > 0 ? allowed : [...DOCK_PLACEMENT_MODES];
}

export function normalizeDockPreviewSplitMode(
  value: unknown,
  fallback: DockPreviewSplitMode = 'pane',
): DockPreviewSplitMode {
  return value === 'inline' || value === 'pane' ? value : fallback;
}

export function normalizeDockPresentationSelectionId(
  value: unknown,
): string | null {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : null;
}

export function normalizeDockTopBarSelectionId(value: unknown): string | null {
  return normalizeDockPresentationSelectionId(value);
}

export function normalizeDockEdgeSize(value: unknown, fallback: number): number {
  return Math.max(
    overlayWindowGeometry.minHeight,
    asFiniteNumber(value, fallback),
  );
}

export function normalizeDockEdgeWidth(value: unknown, fallback: number): number {
  return Math.max(
    overlayWindowGeometry.minWidth,
    asFiniteNumber(value, fallback),
  );
}

export function createScopedDockPresentationId(
  scopeId: string,
  localId: string,
): string {
  const normalizedScope = normalizeDockPresentationIdFragment(
    scopeId,
    'dock-presentation-package',
  );
  const normalizedLocalId = normalizeDockPresentationIdFragment(
    localId,
    DEFAULT_DOCK_PRESENTATION_ID,
  );
  return `${normalizedScope}:${normalizedLocalId}`;
}

function parseDockSizeDefinition(
  value: unknown,
  fallback: Required<DockPresentationSizeDefinition>,
): Required<DockPresentationSizeDefinition> {
  const source = asRecord(value) ?? {};
  return {
    width: normalizeDockEdgeWidth(source.width, fallback.width),
    height: normalizeDockEdgeSize(source.height, fallback.height),
  };
}

function parseLooseDockPresentationDefinition(
  source: LooseRecord,
): DockPresentationDefinition {
  const preview = asRecord(source.preview);
  return {
    id: asString(source.id) || undefined,
    name: asString(source.name) || undefined,
    description: asString(source.description) || undefined,
    defaultPlacement: normalizeDockPlacementMode(
      source.defaultPlacement,
      'bottom-edge',
    ),
    allowedPlacements: Array.isArray(source.allowedPlacements)
      ? source.allowedPlacements.map(entry =>
          normalizeDockPlacementMode(entry, 'bottom-edge'),
        )
      : undefined,
    defaultSize: asRecord(source.defaultSize) as DockPresentationSizeDefinition | undefined,
    minSize: asRecord(source.minSize) as DockPresentationSizeDefinition | undefined,
    topBarId:
      typeof source.topBarId === 'string' || source.topBarId === null
        ? source.topBarId
        : undefined,
    preview: preview
      ? {
          enabled:
            typeof preview.enabled === 'boolean' ? preview.enabled : undefined,
          splitMode: normalizeDockPreviewSplitMode(preview.splitMode, 'pane'),
        }
      : undefined,
    tags: asStringArray(source.tags),
  };
}

function hasDockPresentationDefinitionFields(source: LooseRecord): boolean {
  return [
    'id',
    'name',
    'description',
    'defaultPlacement',
    'allowedPlacements',
    'defaultSize',
    'minSize',
    'topBarId',
    'preview',
    'tags',
    'dockPresentation',
    'dockPresentations',
  ].some(key => key in source);
}

export function parseDockPresentationManifestText(
  text: string,
  filePath: string,
): DockPresentationPackageManifest {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error(`Dock presentation manifest is empty: ${filePath}`);
  }

  const parsed = filePath.toLowerCase().endsWith('.toml')
    ? parseToml(trimmed)
    : JSON.parse(trimmed);
  const source = asRecord(parsed);
  if (!source) {
    throw new Error(`Dock presentation manifest must be an object: ${filePath}`);
  }

  const nestedPresentation = asRecord(source.dockPresentation);
  const explicitPresentations = Array.isArray(source.dockPresentations)
    ? source.dockPresentations
        .map(entry => asRecord(entry))
        .filter((entry): entry is LooseRecord => Boolean(entry))
        .map(parseLooseDockPresentationDefinition)
    : [];
  const shorthandPresentations =
    explicitPresentations.length === 0 &&
    !nestedPresentation &&
    hasDockPresentationDefinitionFields(source)
      ? [parseLooseDockPresentationDefinition(source)]
      : [];
  const dockPresentations =
    explicitPresentations.length > 0
      ? explicitPresentations
      : nestedPresentation
        ? [parseLooseDockPresentationDefinition(nestedPresentation)]
        : shorthandPresentations;

  return {
    version: typeof source.version === 'number' ? source.version : 1,
    id: asString(source.id),
    name: asString(source.name),
    description: asString(source.description),
    author: asString(source.author),
    homepage: asString(source.homepage),
    tags: asStringArray(source.tags),
    dockPresentation: nestedPresentation
      ? parseLooseDockPresentationDefinition(nestedPresentation)
      : undefined,
    dockPresentations,
  };
}

function cloneDockPresentationDefinition(
  presentation: LoadedDockPresentationDefinition,
): LoadedDockPresentationDefinition {
  return {
    ...presentation,
    allowedPlacements: [...presentation.allowedPlacements],
    defaultSize: { ...presentation.defaultSize },
    minSize: { ...presentation.minSize },
    preview: { ...presentation.preview },
    tags: [...presentation.tags],
  };
}

export function createLoadedDockPresentationDefinition(
  definition: DockPresentationDefinition,
  options: {
    source: DockPresentationSource;
    sourceLabel: string;
    scopeId?: string;
    sourceThemeId?: string;
    sourcePackageId?: string;
  },
): LoadedDockPresentationDefinition {
  const localId = normalizeDockPresentationIdFragment(
    definition.id ?? definition.name,
    DEFAULT_DOCK_PRESENTATION_ID,
  );
  const normalizedScopeId = normalizeDockPresentationSelectionId(options.scopeId);
  const id = normalizedScopeId
    ? createScopedDockPresentationId(normalizedScopeId, localId)
    : localId;
  const fallbackName =
    definition.name?.trim() ||
    localId
      .replace(/-/g, ' ')
      .replace(/\b\w/g, character => character.toUpperCase());
  const allowedPlacements = normalizeAllowedDockPlacements(
    definition.allowedPlacements,
  );
  const defaultPlacement = allowedPlacements.includes(
    normalizeDockPlacementMode(definition.defaultPlacement, 'bottom-edge'),
  )
    ? normalizeDockPlacementMode(definition.defaultPlacement, 'bottom-edge')
    : allowedPlacements[0] ?? 'bottom-edge';
  const minSize = parseDockSizeDefinition(definition.minSize, {
    width: overlayWindowGeometry.minWidth,
    height: overlayWindowGeometry.minHeight,
  });
  const defaultSize = parseDockSizeDefinition(definition.defaultSize, {
    width: overlayWindowGeometry.defaultWidth,
    height: overlayWindowGeometry.defaultHeight,
  });

  return {
    id,
    localId,
    name: normalizeLabel(definition.name, fallbackName),
    description: normalizeLabel(
      definition.description,
      options.source === 'theme-package'
        ? `Dock presentation contributed by ${options.sourceLabel}.`
        : 'Built-in dock presentation profile.',
    ),
    source: options.source,
    sourceLabel: options.sourceLabel,
    sourceThemeId: options.sourceThemeId,
    sourcePackageId: options.sourcePackageId,
    defaultPlacement,
    allowedPlacements,
    defaultSize: {
      width: Math.max(defaultSize.width, minSize.width),
      height: Math.max(defaultSize.height, minSize.height),
    },
    minSize,
    topBarId: normalizeDockTopBarSelectionId(
      definition.topBarId ?? DEFAULT_DOCK_TOP_BAR_ID,
    ),
    preview: {
      enabled: definition.preview?.enabled !== false,
      splitMode: normalizeDockPreviewSplitMode(
        definition.preview?.splitMode,
        'pane',
      ),
    },
    tags: normalizeTags(definition.tags),
  };
}

const builtInDockPresentationDefinitions = (
  Array.isArray(shippedBuiltInDockPresentationManifest.dockPresentations)
    ? shippedBuiltInDockPresentationManifest.dockPresentations
    : shippedBuiltInDockPresentationManifest.dockPresentation
      ? [shippedBuiltInDockPresentationManifest.dockPresentation]
      : []
).map(definition =>
  createLoadedDockPresentationDefinition(definition, {
    source: 'built-in',
    sourceLabel: 'Shipped usr',
  }),
) as readonly LoadedDockPresentationDefinition[];

export function getBuiltInDockPresentations(): LoadedDockPresentationDefinition[] {
  return builtInDockPresentationDefinitions.map(cloneDockPresentationDefinition);
}

export function resolveAvailableDockPresentations(
  packageSources: DockPresentationPackageSourceLike[] = [],
): LoadedDockPresentationDefinition[] {
  const loaded = new Map<string, LoadedDockPresentationDefinition>();

  for (const presentation of getBuiltInDockPresentations()) {
    loaded.set(presentation.id, presentation);
  }

  for (const packageSource of packageSources) {
    for (const presentation of packageSource.dockPresentations ?? []) {
      loaded.set(presentation.id, cloneDockPresentationDefinition(presentation));
    }
  }

  return Array.from(loaded.values());
}

function normalizeFloatingBounds(value: unknown): OverlayWindowBounds | null {
  const source = asRecord(value);
  if (!source) {
    return null;
  }

  const width = asFiniteNumber(source.width, 0);
  const height = asFiniteNumber(source.height, 0);
  const x = asFiniteNumber(source.x, Number.NaN);
  const y = asFiniteNumber(source.y, Number.NaN);
  if (
    width < overlayWindowGeometry.minWidth ||
    height < overlayWindowGeometry.minHeight ||
    !Number.isFinite(x) ||
    !Number.isFinite(y)
  ) {
    return null;
  }

  return { width, height, x, y };
}

export function resolveActiveDockPresentation(args: {
  requestedPresentationId?: string | null;
  placementMode?: unknown;
  edgeSize?: unknown;
  edgeWidth?: unknown;
  floatingBounds?: unknown;
  topBarId?: unknown;
  previewEnabled?: unknown;
  previewSplitMode?: unknown;
  packageSources?: DockPresentationPackageSourceLike[];
}): ResolvedDockPresentation {
  const availableDockPresentations = resolveAvailableDockPresentations(
    args.packageSources,
  );
  const presentationById = new Map(
    availableDockPresentations.map(presentation => [presentation.id, presentation] as const),
  );
  const requestedPresentationId = normalizeDockPresentationSelectionId(
    args.requestedPresentationId,
  );
  const requestedPresentation = requestedPresentationId
    ? presentationById.get(requestedPresentationId)
    : null;
  const fallbackPresentation =
    presentationById.get(DEFAULT_DOCK_PRESENTATION_ID) ??
    availableDockPresentations[0];

  if (!fallbackPresentation) {
    throw new Error(
      'Dock presentation catalog resolved empty. Built-in dock presentations are required.',
    );
  }

  const presentation = requestedPresentation ?? fallbackPresentation;
  const rawPlacement = normalizeDockPlacementMode(
    args.placementMode,
    presentation.defaultPlacement,
  );
  const placementMode = presentation.allowedPlacements.includes(rawPlacement)
    ? rawPlacement
    : presentation.defaultPlacement;
  const topBarId =
    normalizeDockTopBarSelectionId(args.topBarId) ??
    presentation.topBarId ??
    DEFAULT_DOCK_TOP_BAR_ID;

  return {
    availableDockPresentations,
    presentation: cloneDockPresentationDefinition(presentation),
    resolvedFrom: requestedPresentation ? 'explicit' : 'fallback',
    requestedPresentationId,
    explicitSelectionMissing: requestedPresentationId != null && !requestedPresentation,
    placementMode,
    edgeSize: normalizeDockEdgeSize(
      args.edgeSize,
      presentation.defaultSize.height,
    ),
    edgeWidth: normalizeDockEdgeWidth(
      args.edgeWidth,
      presentation.defaultSize.width,
    ),
    floatingBounds: normalizeFloatingBounds(args.floatingBounds),
    topBarId,
    previewPolicy: {
      enabled:
        typeof args.previewEnabled === 'boolean'
          ? args.previewEnabled
          : presentation.preview.enabled,
      splitMode: normalizeDockPreviewSplitMode(
        args.previewSplitMode,
        presentation.preview.splitMode,
      ),
    },
  };
}

function getParentDirectoryPath(path: string): string {
  const normalized = path.replace(/\\/g, '/');
  const lastSlash = normalized.lastIndexOf('/');
  if (lastSlash <= 0) {
    return normalized.startsWith('/') ? '/' : '.';
  }
  return normalized.slice(0, lastSlash);
}

function deriveDockPresentationPackageId(
  record: DockPresentationPackageRecord,
): string {
  const explicitId = asString(record.manifest.id);
  if (explicitId) {
    return explicitId;
  }
  return (
    record.directoryName
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'dock-presentation-package'
  );
}

function deriveDockPresentationPackageName(
  record: DockPresentationPackageRecord,
  packageId: string,
): string {
  return (
    asString(record.manifest.name) ||
    packageId.replace(/-/g, ' ').replace(/\b\w/g, character => character.toUpperCase())
  );
}

async function readDockPresentationPackageRecord(
  entry: FileEntry,
): Promise<DockPresentationPackageRecord | null> {
  if (!entry.is_dir) {
    const lowerName = entry.name.toLowerCase();
    const isManifestFile = lowerName.endsWith('.json') || lowerName.endsWith('.toml');
    if (!isManifestFile) {
      return null;
    }

    const manifestText = await commands.fsReadTextFile(entry.path).then(unwrapTauriResult);
    return {
      directoryName: entry.name.replace(/\.[^.]+$/, ''),
      directoryPath: getParentDirectoryPath(entry.path),
      manifestPath: entry.path,
      manifest: parseDockPresentationManifestText(manifestText, entry.path),
    };
  }

  for (const manifestName of dockPresentationSystemConfig.manifestNames) {
    const manifestPath = joinPlatformPath(entry.path, manifestName);
    try {
      const manifestText = await commands.fsReadTextFile(manifestPath).then(unwrapTauriResult);
      return {
        directoryName: entry.name,
        directoryPath: entry.path,
        manifestPath,
        manifest: parseDockPresentationManifestText(manifestText, manifestPath),
      };
    } catch {
      continue;
    }
  }

  return null;
}

function buildPackageDockPresentations(
  record: DockPresentationPackageRecord,
  packageId: string,
  packageName: string,
): { dockPresentations: LoadedDockPresentationDefinition[]; warnings: string[] } {
  const deduped = new Map<string, LoadedDockPresentationDefinition>();
  const warnings: string[] = [];

  for (const definition of record.manifest.dockPresentations ?? []) {
    const loadedPresentation = createLoadedDockPresentationDefinition(definition, {
      source: 'dock-presentation-package',
      sourceLabel: packageName,
      sourcePackageId: packageId,
      scopeId: packageId,
    });

    if (deduped.has(loadedPresentation.id)) {
      warnings.push(
        `Duplicate dock presentation id "${loadedPresentation.localId}" in ${record.manifestPath}; keeping the first definition.`,
      );
      continue;
    }

    deduped.set(loadedPresentation.id, loadedPresentation);
  }

  return {
    dockPresentations: Array.from(deduped.values()),
    warnings,
  };
}

export async function loadDockPresentationPackagesFromDirectoryEntries(
  directoryEntries: FileEntry[],
  directoryLabel = dockPresentationSystemConfig.dockPresentationsDirectory,
): Promise<DockPresentationPackageLoadResult> {
  try {
    const packages: LoadedDockPresentationPackage[] = [];
    const warnings: string[] = [];

    for (const entry of [...directoryEntries].sort((left, right) => left.name.localeCompare(right.name))) {
      try {
        const record = await readDockPresentationPackageRecord(entry);
        if (!record) {
          continue;
        }

        const packageId = deriveDockPresentationPackageId(record);
        const packageName = deriveDockPresentationPackageName(record, packageId);
        const { dockPresentations, warnings: packageWarnings } =
          buildPackageDockPresentations(record, packageId, packageName);

        if (dockPresentations.length === 0) {
          warnings.push(`${packageName}: manifest does not define any dock presentations.`);
          continue;
        }

        packages.push({
          id: packageId,
          name: packageName,
          version: typeof record.manifest.version === 'number'
            ? record.manifest.version
            : 1,
          directoryPath: record.directoryPath,
          manifestPath: record.manifestPath,
          sourceKind: 'dock-presentation-directory',
          description: asString(record.manifest.description) || undefined,
          author: asString(record.manifest.author) || undefined,
          homepage: asString(record.manifest.homepage) || undefined,
          tags: record.manifest.tags ?? [],
          warnings: packageWarnings,
          dockPresentations,
        });
        warnings.push(...packageWarnings.map(warning => `${packageName}: ${warning}`));
      } catch (error) {
        warnings.push(`${entry.name}: ${String(error)}`);
      }
    }

    packages.sort((left, right) => left.name.localeCompare(right.name));

    return {
      packages,
      directory: directoryLabel,
      warnings,
      sourceError: null,
    };
  } catch (error) {
    return {
      packages: [],
      directory: directoryLabel,
      warnings: [],
      sourceError: String(error),
    };
  }
}

export async function loadDockPresentationPackages(): Promise<DockPresentationPackageLoadResult> {
  const directory = dockPresentationSystemConfig.dockPresentationsDirectory;
  if (!isTauri()) {
    return {
      packages: [],
      directory,
      warnings: [],
      sourceError: null,
    };
  }

  try {
    const entries = await commands.fsListDir(directory, false).then(unwrapTauriResult);
    return loadDockPresentationPackagesFromDirectoryEntries(entries, directory);
  } catch (error) {
    return {
      packages: [],
      directory,
      warnings: [],
      sourceError: String(error),
    };
  }
}
