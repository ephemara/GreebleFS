/**
 * greeblePluginShim — legacy definePlugin packs surfaced through the API.
 *
 * Single-file packs predate the harness: they export `definePlugin({...})`
 * and render through App's folder-plugin path with a rich legacy props
 * bundle (`plugin`, bound `api`, `appearance`, preview-lane / settings-slot
 * / workflow surfaces). This shim registers every successfully loaded
 * legacy plugin as `panel` + `previewLane` + `settingsSlot` + `workflow`
 * contributions in the shared harness book, so the API world sees, owns,
 * and can dispose them — with adapter components that render the legacy
 * components against a live host.
 *
 * The live host comes from App (which already builds per-plugin APIs via
 * `createPluginApi` and the resolved appearance) via
 * `setLegacyPluginHostProviders`. Without providers the adapters degrade
 * to a small fallback notice instead of crashing.
 */

import React from 'react';
import type {
  GreeblePanelContribution,
  GreeblePreviewLaneContribution,
  GreebleRenderProps,
  GreebleSettingsSlotContribution,
  GreebleWorkflowContribution,
} from '../api/greeble';
import type {
  LoadedOverlayPlugin,
  OverlayPluginApi,
  OverlayPluginContext,
  OverlayPluginProps,
} from '../components/pluginRuntime';
import { getGreebleDomainBook } from './greebleHost';

/** Minimal lane input — manifest contributions satisfy this structurally. */
export interface LegacyPluginLaneInput {
  readonly id?: string;
  readonly title?: string;
  readonly component?: React.ComponentType<any> | null;
  readonly priority?: number;
  readonly match?: any;
  readonly workbenchChrome?: any;
}

/** Minimal settings-slot input — manifest contributions satisfy this structurally. */
export interface LegacyPluginSlotInput {
  readonly id?: string;
  readonly title?: string;
  readonly component?: React.ComponentType<any> | null;
}

/** Minimal workflow input — manifest contributions satisfy this structurally. */
export interface LegacyPluginWorkflowInput {
  readonly id?: string;
  readonly title?: string;
  readonly component?: React.ComponentType<any> | null;
}

export type LegacyPluginLaneInputs =
  | readonly (LegacyPluginLaneInput | null | undefined)[]
  | null
  | undefined;
export type LegacyPluginSlotInputs =
  | readonly (LegacyPluginSlotInput | null | undefined)[]
  | null
  | undefined;
export type LegacyPluginWorkflowInputs =
  | readonly (LegacyPluginWorkflowInput | null | undefined)[]
  | null
  | undefined;

export interface LegacyLaneRenderRequest {
  readonly pluginId: string;
  readonly laneId: string;
  readonly title: string;
  readonly component: React.ComponentType<any>;
}

export interface LegacySlotRenderRequest {
  readonly pluginId: string;
  readonly slotId: string;
  readonly title: string;
  readonly component: React.ComponentType<any>;
}

export interface LegacyWorkflowRenderRequest {
  readonly pluginId: string;
  readonly workflowId: string;
  readonly title: string;
  readonly component: React.ComponentType<any>;
}

/**
 * Live providers the real plugin host surface sets. `createApi` and
 * `getAppearance` drive the panel adapter directly; the lane/slot/workflow
 * delegates hand the bound legacy component plus registry props to the
 * real preview / settings / workflow surfaces when they exist.
 */
export interface LegacyPluginHostProviders {
  readonly createApi?: (plugin: OverlayPluginContext) => OverlayPluginApi;
  readonly getAppearance?: () => OverlayPluginProps['appearance'];
  readonly renderPreviewLane?: (
    request: LegacyLaneRenderRequest,
    props: GreebleRenderProps,
  ) => React.ReactNode;
  readonly renderSettingsSlot?: (
    request: LegacySlotRenderRequest,
    props: GreebleRenderProps,
  ) => React.ReactNode;
  readonly renderWorkflow?: (
    request: LegacyWorkflowRenderRequest,
    props: GreebleRenderProps,
  ) => React.ReactNode;
}

let liveProviders: LegacyPluginHostProviders | null = null;

/** App sets this once from `createPluginApi` + the resolved appearance. */
export function setLegacyPluginHostProviders(
  providers: LegacyPluginHostProviders | null,
): void {
  liveProviders = providers;
}

function renderLegacyFallback(kind: string, title: string): React.ReactNode {
  return React.createElement(
    'div',
    { style: { padding: 12, fontSize: 12, opacity: 0.75 } },
    `Legacy ${kind} "${title}" needs the plugin host surface.`,
  );
}

function renderLegacyPanelAdapter(
  plugin: LoadedOverlayPlugin,
  // Registry-land carries no api/appearance — those come from the live
  // providers. OverlayPluginProps has no slot for registry data, so the
  // render props are intentionally unused beyond this signature.
  _props: GreebleRenderProps,
): React.ReactNode {
  const title = plugin.name?.trim() ? plugin.name : plugin.id;
  const Component = plugin.component;
  const createApi = liveProviders?.createApi;
  const getAppearance = liveProviders?.getAppearance;
  if (typeof Component !== 'function' || !createApi || !getAppearance) {
    return renderLegacyFallback('plugin panel', title);
  }
  try {
    const api = createApi(plugin);
    const appearance = getAppearance();
    return React.createElement(Component, { plugin, api, appearance });
  } catch {
    return renderLegacyFallback('plugin panel', title);
  }
}

function renderLegacyLaneAdapter(
  snapshot: LegacyLaneRenderRequest,
  props: GreebleRenderProps,
): React.ReactNode {
  let rendered: React.ReactNode;
  try {
    rendered = liveProviders?.renderPreviewLane?.(snapshot, props);
  } catch {
    return renderLegacyFallback('preview lane', snapshot.title);
  }
  if (rendered === undefined) {
    return renderLegacyFallback('preview lane', snapshot.title);
  }
  return rendered;
}

function renderLegacySlotAdapter(
  snapshot: LegacySlotRenderRequest,
  props: GreebleRenderProps,
): React.ReactNode {
  let rendered: React.ReactNode;
  try {
    rendered = liveProviders?.renderSettingsSlot?.(snapshot, props);
  } catch {
    return renderLegacyFallback('settings slot', snapshot.title);
  }
  if (rendered === undefined) {
    return renderLegacyFallback('settings slot', snapshot.title);
  }
  return rendered;
}

function renderLegacyWorkflowAdapter(
  snapshot: LegacyWorkflowRenderRequest,
  props: GreebleRenderProps,
): React.ReactNode {
  let rendered: React.ReactNode;
  try {
    rendered = liveProviders?.renderWorkflow?.(snapshot, props);
  } catch {
    return renderLegacyFallback('workflow', snapshot.title);
  }
  if (rendered === undefined) {
    return renderLegacyFallback('workflow', snapshot.title);
  }
  return rendered;
}

export interface AdoptLegacyPluginOptions {
  /** Owning plugin id — doubles as the dispose scope. */
  readonly pluginId: string;
  readonly plugin?: LoadedOverlayPlugin | null;
  readonly lanes?: LegacyPluginLaneInputs;
  readonly slots?: LegacyPluginSlotInputs;
  readonly workflows?: LegacyPluginWorkflowInputs;
}

/**
 * Register one loaded legacy plugin as API contributions: the plugin
 * component as a sidebar `panel`, plus each preview lane / settings slot /
 * workflow in its own domain — all owned by pluginId. Idempotent
 * (registry replaces on duplicate id). Null/undefined/failed inputs are
 * skipped. Returns the adopted contribution ids.
 */
export function adoptLegacyPlugin(options: AdoptLegacyPluginOptions): string[] {
  const pluginId = options.pluginId?.trim() ? options.pluginId.trim() : '';
  if (!pluginId) return [];
  const adopted: string[] = [];
  const book = getGreebleDomainBook();

  const plugin = options.plugin;
  if (plugin && !plugin.error && typeof plugin.component === 'function') {
    const snapshot = plugin;
    const title = snapshot.name?.trim() ? snapshot.name : pluginId;
    const entry: GreeblePanelContribution = {
      id: pluginId,
      title,
      description:
        snapshot.description ?? `Legacy plugin "${title}".`,
      placement: 'sidebar',
      defaultOpen: snapshot.defaultOpen,
      keepMounted: snapshot.keepMounted,
      component: (props) => renderLegacyPanelAdapter(snapshot, props),
    };
    book.define('panel').register(entry, pluginId);
    adopted.push(pluginId);
  }

  const lanes = options.lanes ?? [];
  for (let index = 0; index < lanes.length; index += 1) {
    const lane = lanes[index];
    if (!lane || typeof lane.component !== 'function') continue;
    const component = lane.component;
    const title = lane.title?.trim() ? lane.title.trim() : `${pluginId} preview lane`;
    const laneId = lane.id?.trim() ? lane.id.trim() : `${pluginId}.preview-lane.${index}`;
    const snapshot: LegacyLaneRenderRequest = { pluginId, laneId, title, component };
    const laneMatch = (lane as { match?: any }).match;
    const laneChrome = (lane as { workbenchChrome?: any }).workbenchChrome;
    const lanePriority = typeof (lane as { priority?: number }).priority === 'number'
      ? (lane as { priority?: number }).priority
      : undefined;
    const entry: GreeblePreviewLaneContribution = {
      id: laneId,
      title,
      description: `Legacy preview lane "${title}".`,
      priority: lanePriority,
      appliesTo: laneMatch
        ? {
            isDirectory:
              laneMatch.appliesTo === 'directory'
                ? true
                : laneMatch.appliesTo === 'file'
                  ? false
                  : undefined,
            extensions: laneMatch.extensions,
            fileNames: laneMatch.fileNames,
            kinds: laneMatch.previewKinds,
          }
        : undefined,
      chrome: laneChrome
        ? {
            includePreviewTab: laneChrome.includePreviewTab,
            includeEditTab: laneChrome.includeEditTab,
            topBarDensity: laneChrome.topBarDensity,
          }
        : undefined,
      component: (props) => renderLegacyLaneAdapter(snapshot, props),
    };
    (entry as { pluginId?: string }).pluginId = pluginId;
    book.define('previewLane').register(entry, pluginId);
    adopted.push(laneId);
  }

  const slots = options.slots ?? [];
  for (let index = 0; index < slots.length; index += 1) {
    const slot = slots[index];
    if (!slot || typeof slot.component !== 'function') continue;
    const component = slot.component;
    const title = slot.title?.trim() ? slot.title.trim() : `${pluginId} settings slot`;
    const slotId = slot.id?.trim() ? slot.id.trim() : `${pluginId}.settings-slot.${index}`;
    const snapshot: LegacySlotRenderRequest = { pluginId, slotId, title, component };
    const entry: GreebleSettingsSlotContribution = {
      id: slotId,
      title,
      description: `Legacy settings slot "${title}".`,
      component: (props) => renderLegacySlotAdapter(snapshot, props),
    };
    book.define('settingsSlot').register(entry, pluginId);
    adopted.push(slotId);
  }

  const workflows = options.workflows ?? [];
  for (let index = 0; index < workflows.length; index += 1) {
    const workflow = workflows[index];
    if (!workflow || typeof workflow.component !== 'function') continue;
    const component = workflow.component;
    const title = workflow.title?.trim()
      ? workflow.title.trim()
      : `${pluginId} workflow`;
    const workflowId = workflow.id?.trim()
      ? workflow.id.trim()
      : `${pluginId}.workflow.${index}`;
    const snapshot: LegacyWorkflowRenderRequest = {
      pluginId,
      workflowId,
      title,
      component,
    };
    const entry: GreebleWorkflowContribution = {
      id: workflowId,
      title,
      description: `Legacy workflow "${title}".`,
      component: (props) => renderLegacyWorkflowAdapter(snapshot, props),
    };
    book.define('workflow').register(entry, pluginId);
    adopted.push(workflowId);
  }

  return adopted;
}

/** Withdraw every contribution owned by a plugin (hot-reload / unload path). */
export function withdrawLegacyPlugin(pluginId: string): number {
  if (!pluginId) return 0;
  return getGreebleDomainBook().unregisterOwner(pluginId);
}

export interface AdoptableLegacyPluginPack {
  readonly pluginId?: string | null;
  readonly plugin?: LoadedOverlayPlugin | null;
  readonly lanes?: LegacyPluginLaneInputs;
  readonly slots?: LegacyPluginSlotInputs;
  readonly workflows?: LegacyPluginWorkflowInputs;
}

/** Batch helper for App: adopt all loaded plugin packs, skipping empties. */
export function adoptLoadedPluginPacks(
  packs: readonly (AdoptableLegacyPluginPack | null | undefined)[] | null | undefined,
): string[] {
  if (!packs) return [];
  const adopted: string[] = [];
  for (const pack of packs) {
    if (!pack) continue;
    const pluginId = pack.pluginId?.trim()
      ? pack.pluginId.trim()
      : pack.plugin?.id?.trim()
        ? pack.plugin.id.trim()
        : '';
    if (!pluginId) continue;
    adopted.push(
      ...adoptLegacyPlugin({
        pluginId,
        plugin: pack.plugin,
        lanes: pack.lanes,
        slots: pack.slots,
        workflows: pack.workflows,
      }),
    );
  }
  return adopted;
}
