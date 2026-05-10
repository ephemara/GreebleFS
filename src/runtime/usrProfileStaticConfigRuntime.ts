import { isTauri } from '@tauri-apps/api/core';

import {
  loadManagedContentManifestsFromDirectoryStack,
  type ManagedContentStackManifestRecord,
} from '../config/managedContentDirectoryStacks';
import { applyUsrExplorerChromeLayoutManifest } from '../config/explorerChromeLayouts';
import { applyUsrExplorerCustomizeControlManifest } from '../config/explorerCustomizeCatalog';
import { applyUsrExplorerDragEngineManifest } from '../config/explorerDragEngines';
import { applyUsrExplorerExperimentalModeManifest } from '../config/explorerExperimentalModes';
import { applyUsrExplorerModeProfileManifest } from '../config/explorerModeProfiles';
import { applyUsrExplorerPerformanceManifest } from '../config/explorerPerformance';
import { applyUsrExplorerRailTreeManifest } from '../config/explorerRailTree';
import { applyUsrExplorerShellLayoutManifest } from '../config/explorerShellLayouts';
import { applyUsrExplorerWorkspaceLayoutManifest } from '../config/explorerWorkspaceLayouts';
import { applyUsrExplorerZoomBehaviorManifest } from '../config/explorerZoomBehavior';
import { applyUsrHotkeyManifest } from '../config/hotkeys';
import type { ManagedContentDirectoryId } from '../config/appContentDirectories';

type JsonRecord = Record<string, unknown>;
type StaticManifestRecord = ManagedContentStackManifestRecord<JsonRecord>;
type ExplorerChromeLayoutManifest = Exclude<
  Parameters<typeof applyUsrExplorerChromeLayoutManifest>[0],
  null | undefined
>;
type ExplorerCustomizeControlManifest = Exclude<
  Parameters<typeof applyUsrExplorerCustomizeControlManifest>[0],
  null | undefined
>;
type ExplorerDragEngineManifest = Exclude<
  Parameters<typeof applyUsrExplorerDragEngineManifest>[0],
  null | undefined
>;
type ExplorerExperimentalModeManifest = Exclude<
  Parameters<typeof applyUsrExplorerExperimentalModeManifest>[0],
  null | undefined
>;
type ExplorerModeProfileManifest = Exclude<
  Parameters<typeof applyUsrExplorerModeProfileManifest>[0],
  null | undefined
>;
type ExplorerPerformanceManifest = Exclude<
  Parameters<typeof applyUsrExplorerPerformanceManifest>[0],
  null | undefined
>;
type ExplorerRailTreeManifest = Exclude<
  Parameters<typeof applyUsrExplorerRailTreeManifest>[0],
  null | undefined
>;
type ExplorerShellLayoutManifest = Exclude<
  Parameters<typeof applyUsrExplorerShellLayoutManifest>[0],
  null | undefined
>;
type ExplorerWorkspaceLayoutManifest = Exclude<
  Parameters<typeof applyUsrExplorerWorkspaceLayoutManifest>[0],
  null | undefined
>;
type ExplorerZoomBehaviorManifest = Exclude<
  Parameters<typeof applyUsrExplorerZoomBehaviorManifest>[0],
  null | undefined
>;
type HotkeyManifest = Exclude<Parameters<typeof applyUsrHotkeyManifest>[0], null | undefined>;
type StaticManifestRuntimeLane = {
  laneId: ManagedContentDirectoryId;
  manifestNames: readonly string[];
  buildManifest: (records: readonly StaticManifestRecord[]) => unknown;
  applyManifest: (manifest: unknown) => void;
};

function createStaticManifestRuntimeLane<Manifest>(config: {
  laneId: ManagedContentDirectoryId;
  manifestNames: readonly string[];
  buildManifest: (records: readonly StaticManifestRecord[]) => Manifest;
  applyManifest: (manifest: Manifest) => void;
}): StaticManifestRuntimeLane {
  return {
    laneId: config.laneId,
    manifestNames: config.manifestNames,
    buildManifest: config.buildManifest,
    applyManifest: (manifest) => config.applyManifest(manifest as Manifest),
  };
}

function castStaticManifest<Manifest>(value: unknown): Manifest {
  return value as Manifest;
}

function normalizeObjectRecord(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? { ...(value as JsonRecord) }
    : {};
}

function cloneJsonValue<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((entry) => cloneJsonValue(entry)) as T;
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as JsonRecord).map(([key, entryValue]) => [
        key,
        cloneJsonValue(entryValue),
      ]),
    ) as T;
  }
  return value;
}

function mergePreferPrimary(primary: unknown, fallback: unknown): unknown {
  if (primary === undefined) {
    return cloneJsonValue(fallback);
  }
  if (primary === null) {
    return null;
  }
  if (Array.isArray(primary)) {
    return primary.length > 0 ? cloneJsonValue(primary) : cloneJsonValue(fallback);
  }
  if (primary && typeof primary === 'object') {
    const primaryRecord = normalizeObjectRecord(primary);
    const fallbackRecord = normalizeObjectRecord(fallback);
    const merged = { ...cloneJsonValue(fallbackRecord) };
    for (const [key, value] of Object.entries(primaryRecord)) {
      merged[key] = mergePreferPrimary(value, fallbackRecord[key]);
    }
    return merged;
  }
  return primary;
}

function mergeStaticManifestRecordsLeftBiased(
  records: readonly StaticManifestRecord[],
): JsonRecord {
  return records
    .map((record) => normalizeObjectRecord(record.manifest))
    .reduceRight<JsonRecord>(
      (merged, manifest) => mergePreferPrimary(manifest, merged) as JsonRecord,
      {},
    );
}

function mergeManifestArrayByKey<T extends JsonRecord>(
  records: readonly StaticManifestRecord[],
  arrayKey: string,
  keySelector: (entry: T) => string,
): T[] {
  const merged = new Map<string, T>();
  for (const record of records) {
    const entries = record.manifest[arrayKey];
    if (!Array.isArray(entries)) {
      continue;
    }
    for (const entry of entries) {
      const normalizedEntry = normalizeObjectRecord(entry) as T;
      const entryKey = keySelector(normalizedEntry).trim();
      if (!entryKey || merged.has(entryKey)) {
        continue;
      }
      merged.set(entryKey, cloneJsonValue(normalizedEntry));
    }
  }
  return [...merged.values()];
}

function pickFirstNonEmptyArray<T>(
  records: readonly StaticManifestRecord[],
  selector: (manifest: JsonRecord) => readonly T[] | undefined,
): T[] | undefined {
  for (const record of records) {
    const value = selector(record.manifest);
    if (Array.isArray(value) && value.length > 0) {
      return cloneJsonValue([...value]);
    }
  }
  return undefined;
}

function pickFirstNumber(
  records: readonly StaticManifestRecord[],
  selector: (manifest: JsonRecord) => unknown,
): number | undefined {
  for (const record of records) {
    const value = selector(record.manifest);
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
  }
  return undefined;
}

const usrStaticManifestRuntimeCatalog: readonly StaticManifestRuntimeLane[] = [
  createStaticManifestRuntimeLane<ExplorerChromeLayoutManifest>({
    laneId: 'explorerChromeLayouts' as ManagedContentDirectoryId,
    manifestNames: [
      'explorer-chrome-layout.json',
      'explorer-chrome-layout.toml',
      'manifest.json',
      'manifest.toml',
    ] as const,
    buildManifest: (records: readonly StaticManifestRecord[]) =>
      castStaticManifest<ExplorerChromeLayoutManifest>({
        chromeLayouts: mergeManifestArrayByKey(records, 'chromeLayouts', (entry) =>
          String(entry.id ?? ''),
        ),
      }),
    applyManifest: applyUsrExplorerChromeLayoutManifest,
  }),
  createStaticManifestRuntimeLane<ExplorerCustomizeControlManifest>({
    laneId: 'explorerCustomizeControls' as ManagedContentDirectoryId,
    manifestNames: [
      'explorer-customize-control.json',
      'explorer-customize-control.toml',
      'manifest.json',
      'manifest.toml',
    ] as const,
    buildManifest: (records: readonly StaticManifestRecord[]) =>
      castStaticManifest<ExplorerCustomizeControlManifest>({
        controls: mergeManifestArrayByKey(records, 'controls', (entry) =>
          String(entry.controlId ?? ''),
        ),
      }),
    applyManifest: applyUsrExplorerCustomizeControlManifest,
  }),
  createStaticManifestRuntimeLane<ExplorerModeProfileManifest>({
    laneId: 'explorerModeProfiles' as ManagedContentDirectoryId,
    manifestNames: [
      'explorer-mode-profile.json',
      'explorer-mode-profile.toml',
      'manifest.json',
      'manifest.toml',
    ] as const,
    buildManifest: (records: readonly StaticManifestRecord[]) =>
      castStaticManifest<ExplorerModeProfileManifest>({
        modeProfiles: mergeManifestArrayByKey(records, 'modeProfiles', (entry) =>
          String(entry.id ?? ''),
        ),
      }),
    applyManifest: applyUsrExplorerModeProfileManifest,
  }),
  createStaticManifestRuntimeLane<ExplorerShellLayoutManifest>({
    laneId: 'explorerShellLayouts' as ManagedContentDirectoryId,
    manifestNames: [
      'explorer-shell-layout.json',
      'explorer-shell-layout.toml',
      'manifest.json',
      'manifest.toml',
    ] as const,
    buildManifest: (records: readonly StaticManifestRecord[]) =>
      castStaticManifest<ExplorerShellLayoutManifest>({
        shellLayouts: mergeManifestArrayByKey(records, 'shellLayouts', (entry) =>
          String(entry.id ?? ''),
        ),
      }),
    applyManifest: applyUsrExplorerShellLayoutManifest,
  }),
  createStaticManifestRuntimeLane<ExplorerRailTreeManifest>({
    laneId: 'explorerRailTrees' as ManagedContentDirectoryId,
    manifestNames: [
      'explorer-rail-tree.json',
      'explorer-rail-tree.toml',
      'manifest.json',
      'manifest.toml',
    ] as const,
    buildManifest: (records: readonly StaticManifestRecord[]) =>
      castStaticManifest<ExplorerRailTreeManifest>(
        mergeStaticManifestRecordsLeftBiased(records),
      ),
    applyManifest: applyUsrExplorerRailTreeManifest,
  }),
  createStaticManifestRuntimeLane<ExplorerWorkspaceLayoutManifest>({
    laneId: 'explorerWorkspaceLayouts' as ManagedContentDirectoryId,
    manifestNames: [
      'explorer-workspace-layout.json',
      'explorer-workspace-layout.toml',
      'manifest.json',
      'manifest.toml',
    ] as const,
    buildManifest: (records: readonly StaticManifestRecord[]) =>
      castStaticManifest<ExplorerWorkspaceLayoutManifest>({
        workspaceLayouts: mergeManifestArrayByKey(records, 'workspaceLayouts', (entry) =>
          String(entry.id ?? ''),
        ),
      }),
    applyManifest: applyUsrExplorerWorkspaceLayoutManifest,
  }),
  createStaticManifestRuntimeLane<ExplorerExperimentalModeManifest>({
    laneId: 'explorerExperimentalModes' as ManagedContentDirectoryId,
    manifestNames: [
      'explorer-experimental-mode.json',
      'explorer-experimental-mode.toml',
      'manifest.json',
      'manifest.toml',
    ] as const,
    buildManifest: (records: readonly StaticManifestRecord[]) =>
      castStaticManifest<ExplorerExperimentalModeManifest>({
        adaptiveSemanticDensityStep: pickFirstNumber(
          records,
          (manifest) => manifest.adaptiveSemanticDensityStep,
        ),
        defaultAdaptiveSemanticDensity: pickFirstNumber(
          records,
          (manifest) => manifest.defaultAdaptiveSemanticDensity,
        ),
        adaptiveSemanticDensityStops: mergeManifestArrayByKey(
          records,
          'adaptiveSemanticDensityStops',
          (entry) => String(entry.id ?? ''),
        ),
        modes: mergeManifestArrayByKey(records, 'modes', (entry) =>
          String(entry.id ?? ''),
        ),
        densityDescriptors: {
          constellation: pickFirstNonEmptyArray(
            records,
            (manifest) =>
              normalizeObjectRecord(manifest.densityDescriptors).constellation as
                | readonly JsonRecord[]
                | undefined,
          ),
          timeline: pickFirstNonEmptyArray(
            records,
            (manifest) =>
              normalizeObjectRecord(manifest.densityDescriptors).timeline as
                | readonly JsonRecord[]
                | undefined,
          ),
        },
      }),
    applyManifest: applyUsrExplorerExperimentalModeManifest,
  }),
  createStaticManifestRuntimeLane<ExplorerZoomBehaviorManifest>({
    laneId: 'explorerZoomBehaviors' as ManagedContentDirectoryId,
    manifestNames: [
      'explorer-zoom-behavior.json',
      'explorer-zoom-behavior.toml',
      'manifest.json',
      'manifest.toml',
    ] as const,
    buildManifest: (records: readonly StaticManifestRecord[]) =>
      castStaticManifest<ExplorerZoomBehaviorManifest>(
        mergeStaticManifestRecordsLeftBiased(records),
    ),
    applyManifest: applyUsrExplorerZoomBehaviorManifest,
  }),
  createStaticManifestRuntimeLane<ExplorerDragEngineManifest>({
    laneId: 'explorerDragEngines' as ManagedContentDirectoryId,
    manifestNames: [
      'explorer-drag-engine.json',
      'explorer-drag-engine.toml',
      'manifest.json',
      'manifest.toml',
    ] as const,
    buildManifest: (records: readonly StaticManifestRecord[]) =>
      castStaticManifest<ExplorerDragEngineManifest>(
        mergeStaticManifestRecordsLeftBiased(records),
      ),
    applyManifest: applyUsrExplorerDragEngineManifest,
  }),
  createStaticManifestRuntimeLane<ExplorerPerformanceManifest>({
    laneId: 'explorerPerformance' as ManagedContentDirectoryId,
    manifestNames: [
      'explorer-performance.json',
      'explorer-performance.toml',
      'manifest.json',
      'manifest.toml',
    ] as const,
    buildManifest: (records: readonly StaticManifestRecord[]) =>
      castStaticManifest<ExplorerPerformanceManifest>(
        mergeStaticManifestRecordsLeftBiased(records),
      ),
    applyManifest: applyUsrExplorerPerformanceManifest,
  }),
  createStaticManifestRuntimeLane<HotkeyManifest>({
    laneId: 'hotkeys' as ManagedContentDirectoryId,
    manifestNames: [
      'hotkeys.json',
      'hotkeys.toml',
      'manifest.json',
      'manifest.toml',
    ] as const,
    buildManifest: (records: readonly StaticManifestRecord[]) =>
      castStaticManifest<HotkeyManifest>({
        bindings: mergeManifestArrayByKey(records, 'bindings', (entry) =>
          String(entry.key ?? ''),
        ),
      }),
    applyManifest: applyUsrHotkeyManifest,
  }),
] as const;

export async function refreshUsrProfileStaticConfigRuntime(): Promise<void> {
  if (!isTauri()) {
    return;
  }

  const loadResults = await Promise.all(
    usrStaticManifestRuntimeCatalog.map(async (lane) => ({
      lane,
      result: await loadManagedContentManifestsFromDirectoryStack({
        directoryId: lane.laneId,
        manifestNames: lane.manifestNames,
      }),
    })),
  );

  for (const { lane, result } of loadResults) {
    if (result.warnings.length > 0) {
      console.warn(
        `GreebleFS: usr profile manifest warnings for ${lane.laneId}`,
        result.warnings,
      );
    }
    if (result.sourceError) {
      console.warn(
        `GreebleFS: usr profile manifest load issue for ${lane.laneId}`,
        result.sourceError,
      );
    }
    lane.applyManifest(lane.buildManifest(result.packages));
  }
}
