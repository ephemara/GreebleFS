/**
 * greebleLaneBridge — backs the `previewLane` and `viewMode` API domains with
 * real legacy descriptors.
 *
 * API-registered lanes/modes (`fs.registerPreviewLane` / `fs.registerViewMode`)
 * live in the shared harness book. This bridge converts them into the shapes
 * the EXISTING explorer pipeline already consumes, with zero special-casing:
 *
 * - preview lanes → `OverlayPluginPreviewLaneContribution` (the exact element
 *   type of `ExplorerPreviewResolverOptions.pluginPreviewLanes`, merged by
 *   `buildRegisteredExplorerPreviewLanes` ahead of the built-ins)
 * - view modes → `GreebleApiViewModeDefinition` (an
 *   `ExplorerViewModeDefinition`-compatible object whose id lives in the
 *   `api-<id>` custom space, OUTSIDE the closed `ExplorerViewMode` union)
 * - reactive via each registry's version (`useGreebleApiPreviewLanes`,
 *   `useGreebleApiViewModes`)
 *
 * Lane `component` adaptation is intentionally degraded: legacy lane slots
 * need full `BoundOverlayPluginPreviewLaneProps`; API components take
 * `GreebleRenderProps`. `adaptGreebleLaneComponent` synthesizes API props from
 * the file-ish fields the legacy shape guarantees (path/name/extension/size/
 * isDirectory/assetUrl) plus host geometry, and stubs the context. Full host
 * context synthesis is a later step — see the function docs.
 *
 * Disposing a harness withdraws its lanes/modes live. This module is NOT yet
 * wired into App or the registry — see the merge snippet in the summary docs.
 */

import { createElement, useSyncExternalStore, type ComponentType } from 'react';
import type {
  GreebleComponent,
  GreebleMatch,
  GreeblePreviewLaneContribution,
  GreebleRegistry,
  GreebleRenderProps,
  GreebleViewModeContribution,
} from '../api/greeble';
import type { OverlayPluginPreviewLaneContribution } from '../config/pluginContributions';
import {
  DEFAULT_OVERLAY_PLUGIN_PREVIEW_LANE_PRIORITY,
  normalizeOverlayPluginPreviewLaneCapabilities,
  normalizeOverlayPluginPreviewLaneMatchRule,
  normalizeOverlayPluginPreviewLaneWorkbenchChrome,
  type OverlayPluginPreviewLaneMatchRule,
} from '../config/pluginPreviewLanes';
import type {
  ExplorerViewModeDefinition,
  ExplorerViewPresentation,
} from '../config/explorerViewModes';
import type {
  BoundOverlayPluginPreviewLaneComponent,
  BoundOverlayPluginPreviewLaneProps,
} from '../components/pluginRuntime';
import { getGreebleDomainBook } from './greebleHost';
import { buildGreebleContext } from './greebleContext';
import {
  getGreebleEntryStore,
  getGreebleExtensionBus,
} from './greebleHost';

/** Owner attribution for converted lanes — the contribution carries no owner. */
export const GREEBLE_API_LANE_PLUGIN_ID = 'greeble-api' as const;
export const GREEBLE_API_LANE_PLUGIN_NAME = 'Greeble API' as const;

/**
 * An `ExplorerViewModeDefinition`-compatible object for API view modes. The id
 * lives in the `api-<id>` custom space so it can never collide with the closed
 * built-in `ExplorerViewMode` union (`icons-xl`, `columns`, …). Extra fields
 * (`sourceEntryId`, `component`, `appliesTo`, `zoom`) are additive — the object
 * stays assignable wherever the legacy definition is read.
 */
export interface GreebleApiViewModeDefinition
  extends Omit<ExplorerViewModeDefinition, 'id'> {
  readonly id: string;
  /** The authored API contribution id this definition was converted from. */
  readonly sourceEntryId: string;
  readonly component: GreebleComponent<unknown>;
  readonly appliesTo?: GreebleMatch;
  readonly zoom: { readonly min: number; readonly max: number; readonly step: number };
}

/** Zoom contract for API view modes that declare none. */
export const DEFAULT_GREEBLE_API_VIEW_MODE_ZOOM = {
  min: 1,
  max: 1,
  step: 0.08,
} as const;

/** Custom modes sort after the built-ins (whose `zoomOrder` is 0–6). */
export const DEFAULT_GREEBLE_API_VIEW_MODE_ZOOM_ORDER = 100;

function getPreviewLaneRegistry(): GreebleRegistry<GreeblePreviewLaneContribution> {
  return getGreebleDomainBook().define<GreeblePreviewLaneContribution>('previewLane');
}

function getViewModeRegistry(): GreebleRegistry<GreebleViewModeContribution> {
  return getGreebleDomainBook().define<GreebleViewModeContribution>('viewMode');
}

/** Authored id when free, `api-<id>-<n>` on collision within the API batch. */
export function resolveApiPreviewLaneId(
  contributionId: string,
  takenIds: ReadonlySet<string>,
): string {
  const wanted = contributionId.trim() || 'api-lane';
  if (!takenIds.has(wanted)) return wanted;
  let suffix = 2;
  while (takenIds.has(`api-${wanted}-${suffix}`)) suffix += 1;
  return `api-${wanted}-${suffix}`;
}

/**
 * ALWAYS `api-` prefixed, so API modes can never collide with the closed
 * built-in union even when an author registers e.g. id `columns`.
 */
export function resolveApiViewModeId(
  contributionId: string,
  takenIds: ReadonlySet<string>,
): string {
  const wanted = `api-${contributionId.trim() || 'view-mode'}`;
  if (!takenIds.has(wanted)) return wanted;
  let suffix = 2;
  while (takenIds.has(`${wanted}-${suffix}`)) suffix += 1;
  return `${wanted}-${suffix}`;
}

function asStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(entry => String(entry));
}

/**
 * Best-effort `GreebleMatch` → legacy lane match rule. `extensions` (leading
 * dots stripped to match the legacy convention) and `fileNames` pass through
 * where the fields align; `kinds` feeds `previewKinds` with unknown kinds
 * dropped by the normalizer. `glob` has NO legacy equivalent — a glob-only
 * matcher degrades to an appliesTo-scoped permissive rule (documented
 * over-match; narrowing needs registry-side glob support).
 */
function convertGreebleMatchToLaneRule(
  match: GreebleMatch | undefined,
): OverlayPluginPreviewLaneMatchRule {
  if (!match || typeof match !== 'object' || Array.isArray(match)) {
    return normalizeOverlayPluginPreviewLaneMatchRule({ appliesTo: 'any' });
  }
  return normalizeOverlayPluginPreviewLaneMatchRule({
    appliesTo:
      match.isDirectory === true
        ? 'directory'
        : match.isDirectory === false
          ? 'file'
          : 'any',
    extensions: asStringList(match.extensions).map(entry =>
      entry.replace(/^\./, ''),
    ),
    fileNames: asStringList(match.fileNames),
    previewKinds: asStringList(match.kinds),
  });
}

function readFinite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function readNonEmptyText(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

/**
 * Adapt an API lane component (`GreebleRenderProps`) for legacy lane slots
 * (`BoundOverlayPluginPreviewLaneProps`).
 *
 * DOCUMENTED-DEGRADED prop synthesis: `data` passes through the file-ish
 * fields the legacy shape guarantees (path/name/extension/size/isDirectory/
 * assetUrl) plus lane identity and the active preview/edit tab; `render`
 * carries host geometry, density, empty CSS vars, and system font stacks;
 * `ctx` is a minimal stub — extension code MUST NOT rely on it. Full host
 * capability-bag synthesis is a later step. Non-function components degrade to
 * a fallback notice instead of throwing.
 */
export function adaptGreebleLaneComponent(
  apiComponent: GreebleComponent<unknown>,
  ownerId = 'greeble-lane',
): BoundOverlayPluginPreviewLaneComponent {
  if (typeof apiComponent !== 'function') {
    const FallbackNotice = () =>
      createElement(
        'div',
        { role: 'note', style: { padding: 12, fontSize: 12, opacity: 0.7 } },
        'Preview lane unavailable: the API contribution did not provide a component.',
      );
    FallbackNotice.displayName = 'GreebleApiLaneFallback';
    return FallbackNotice;
  }
  const AdaptedGreebleLane = (props: BoundOverlayPluginPreviewLaneProps) => {
    const render: GreebleRenderProps<unknown>['render'] = {
      containerWidth: props.host.width,
      containerHeight: props.host.height,
      zoom: props.host.zoom,
      density: props.host.density,
      cssVars: {},
      fonts: { ui: 'system-ui, sans-serif', mono: 'ui-monospace, monospace' },
    };
    // Real storage/log/paths/events; host-bound lanes throw honest
    // not-yet-wired errors only if called (see greebleContext).
    const ctx = buildGreebleContext(
      {
        id: `lane:${ownerId}`,
        name: `lane:${ownerId}`,
        version: '1.0.0',
        entryPath: ownerId,
        rootDir: ownerId,
        capabilities: new Set(['storage:read', 'storage:write']),
        tags: [],
        meta: {},
      },
      { bus: getGreebleExtensionBus(), entries: getGreebleEntryStore() },
    );
    const data = {
      path: props.file.path,
      name: props.file.name,
      extension: props.file.extension,
      size: props.file.size,
      isDirectory: props.file.isDirectory,
      assetUrl: props.file.assetUrl,
      laneId: props.lane.id,
      laneTitle: props.lane.title,
      viewMode: props.viewMode,
    };
    return createElement(
      apiComponent as ComponentType<GreebleRenderProps<unknown>>,
      { data, ctx, render },
    );
  };
  const source = apiComponent as { displayName?: unknown; name?: unknown };
  const sourceName =
    typeof source.displayName === 'string' && source.displayName
      ? source.displayName
      : typeof source.name === 'string' && source.name
        ? source.name
        : 'anonymous';
  AdaptedGreebleLane.displayName = `GreebleApiLane(${sourceName})`;
  return AdaptedGreebleLane;
}

export function convertGreeblePreviewLaneToDescriptor(
  entry: GreeblePreviewLaneContribution,
  takenIds: Set<string>,
): OverlayPluginPreviewLaneContribution | null {
  try {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      console.warn('GreebleFS API previewLane skipped: entry is not an object', entry);
      return null;
    }
    const rawId = typeof entry.id === 'string' ? entry.id.trim() : '';
    if (!rawId) {
      console.warn('GreebleFS API previewLane skipped: missing id', entry);
      return null;
    }
    if (typeof entry.component !== 'function') {
      console.warn(`GreebleFS API previewLane "${rawId}" skipped: missing component`, entry);
      return null;
    }
    const laneId = resolveApiPreviewLaneId(rawId, takenIds);
    takenIds.add(laneId);
    const chrome = entry.chrome ?? {};
    const ownerPluginId =
      (entry as { pluginId?: string }).pluginId?.trim() ||
      (entry as { owner?: string }).owner?.trim() ||
      GREEBLE_API_LANE_PLUGIN_ID;
    return {
      id: laneId,
      pluginId: ownerPluginId,
      pluginName: readNonEmptyText(
        (entry as { pluginName?: string }).pluginName,
        ownerPluginId === GREEBLE_API_LANE_PLUGIN_ID
          ? GREEBLE_API_LANE_PLUGIN_NAME
          : ownerPluginId,
      ),
      title: readNonEmptyText(entry.title, rawId),
      priority: readFinite(entry.priority, DEFAULT_OVERLAY_PLUGIN_PREVIEW_LANE_PRIORITY),
      rendererKind: 'react',
      rendererEntry: null,
      runtimeId: null,
      runtimeSurfaceId: null,
      buildTarget: null,
      match: convertGreebleMatchToLaneRule(entry.appliesTo),
      capabilities: normalizeOverlayPluginPreviewLaneCapabilities(null),
      workbenchChrome: normalizeOverlayPluginPreviewLaneWorkbenchChrome(
        {
          includePreviewTab: chrome.includePreviewTab,
          includeEditTab: chrome.includeEditTab,
        },
        { topBarDensity: chrome.topBarDensity === 'compact' ? 'compact' : 'regular' },
      ),
      component: adaptGreebleLaneComponent(entry.component, laneId),
    };
  } catch (error) {
    console.warn(
      `GreebleFS API previewLane "${(entry as { id?: unknown })?.id}" failed to convert`,
      error,
    );
    return null;
  }
}

function readApiViewModePresentation(
  entry: GreebleViewModeContribution,
): ExplorerViewPresentation {
  const candidate = (entry as { presentation?: unknown }).presentation;
  return candidate === 'grid' || candidate === 'table' || candidate === 'list'
    ? candidate
    : 'grid';
}

function readApiViewModeZoom(
  entry: GreebleViewModeContribution,
): GreebleApiViewModeDefinition['zoom'] {
  const zoom = entry.zoom;
  if (!zoom || typeof zoom !== 'object') {
    return { ...DEFAULT_GREEBLE_API_VIEW_MODE_ZOOM };
  }
  return {
    min: readFinite(zoom.min, DEFAULT_GREEBLE_API_VIEW_MODE_ZOOM.min),
    max: readFinite(zoom.max, DEFAULT_GREEBLE_API_VIEW_MODE_ZOOM.max),
    step: readFinite(zoom.step, DEFAULT_GREEBLE_API_VIEW_MODE_ZOOM.step),
  };
}

export function convertGreebleViewModeToDefinition(
  entry: GreebleViewModeContribution,
  takenIds: Set<string>,
): GreebleApiViewModeDefinition | null {
  try {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      console.warn('GreebleFS API viewMode skipped: entry is not an object', entry);
      return null;
    }
    const rawId = typeof entry.id === 'string' ? entry.id.trim() : '';
    if (!rawId) {
      console.warn('GreebleFS API viewMode skipped: missing id', entry);
      return null;
    }
    if (typeof entry.component !== 'function') {
      console.warn(`GreebleFS API viewMode "${rawId}" skipped: missing component`, entry);
      return null;
    }
    const definitionId = resolveApiViewModeId(rawId, takenIds);
    takenIds.add(definitionId);
    const label = readNonEmptyText(entry.title, rawId);
    return {
      id: definitionId,
      label,
      shortLabel: readNonEmptyText(entry.shortLabel, label),
      description:
        typeof entry.description === 'string' && entry.description
          ? entry.description
          : `API view mode "${rawId}" via the greeblefs harness.`,
      presentation: readApiViewModePresentation(entry),
      zoomOrder: readFinite(entry.priority, DEFAULT_GREEBLE_API_VIEW_MODE_ZOOM_ORDER),
      zoom: readApiViewModeZoom(entry),
      appliesTo: entry.appliesTo,
      sourceEntryId: rawId,
      component: entry.component,
    };
  } catch (error) {
    console.warn(
      `GreebleFS API viewMode "${(entry as { id?: unknown })?.id}" failed to convert`,
      error,
    );
    return null;
  }
}

interface ApiPreviewLaneSnapshot {
  registry: GreebleRegistry<GreeblePreviewLaneContribution>;
  version: number;
  lanes: OverlayPluginPreviewLaneContribution[];
}

interface ApiViewModeSnapshot {
  registry: GreebleRegistry<GreebleViewModeContribution>;
  version: number;
  modes: GreebleApiViewModeDefinition[];
}

let laneSnapshotCache: ApiPreviewLaneSnapshot | null = null;
let viewModeSnapshotCache: ApiViewModeSnapshot | null = null;

function readApiPreviewLaneSnapshot(): ApiPreviewLaneSnapshot {
  const registry = getPreviewLaneRegistry();
  const version = registry.version();
  if (
    laneSnapshotCache &&
    laneSnapshotCache.registry === registry &&
    laneSnapshotCache.version === version
  ) {
    return laneSnapshotCache;
  }
  // No built-in lane id list is exported, so the seed only tracks collisions
  // within the API batch; `api-` namespacing on collision keeps converted ids
  // off the `builtin-*` namespace in practice.
  const takenIds = new Set<string>();
  const lanes: OverlayPluginPreviewLaneContribution[] = [];
  for (const entry of registry.list()) {
    const lane = convertGreeblePreviewLaneToDescriptor(entry, takenIds);
    if (lane) lanes.push(lane);
  }
  laneSnapshotCache = { registry, version, lanes };
  return laneSnapshotCache;
}

function readApiViewModeSnapshot(): ApiViewModeSnapshot {
  const registry = getViewModeRegistry();
  const version = registry.version();
  if (
    viewModeSnapshotCache &&
    viewModeSnapshotCache.registry === registry &&
    viewModeSnapshotCache.version === version
  ) {
    return viewModeSnapshotCache;
  }
  // Seed with the built-in union so `api-columns` can never shadow `columns`
  // even if a future built-in ever adopts an `api-` id.
  const takenIds = new Set<string>();
  const modes: GreebleApiViewModeDefinition[] = [];
  for (const entry of registry.list()) {
    const mode = convertGreebleViewModeToDefinition(entry, takenIds);
    if (mode) modes.push(mode);
  }
  viewModeSnapshotCache = { registry, version, modes };
  return viewModeSnapshotCache;
}

/** All currently registered API preview lanes as legacy lane contributions. */
export function getGreebleApiPreviewLanes(): OverlayPluginPreviewLaneContribution[] {
  return readApiPreviewLaneSnapshot().lanes;
}

/** All currently registered API view modes as legacy-compatible definitions. */
export function getGreebleApiViewModes(): GreebleApiViewModeDefinition[] {
  return readApiViewModeSnapshot().modes;
}

/** Reactive hook for App/registry — re-renders when API lanes (un)register. */
export function useGreebleApiPreviewLanes(): OverlayPluginPreviewLaneContribution[] {
  return useSyncExternalStore(
    (notify: () => void) => {
      const handle = getPreviewLaneRegistry().subscribe(() => notify());
      return () => handle.dispose();
    },
    () => getGreebleApiPreviewLanes(),
    () => getGreebleApiPreviewLanes(),
  );
}

/** Reactive hook for App/registry — re-renders when API view modes (un)register. */
export function useGreebleApiViewModes(): GreebleApiViewModeDefinition[] {
  return useSyncExternalStore(
    (notify: () => void) => {
      const handle = getViewModeRegistry().subscribe(() => notify());
      return () => handle.dispose();
    },
    () => getGreebleApiViewModes(),
    () => getGreebleApiViewModes(),
  );
}
