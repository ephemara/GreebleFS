import { callKainTauronBridge } from "./kainTauronBridge";

export type KainPluginRendererKind = "kain-host" | "react-compat" | "wasm-panel";

export interface KainPluginPermission {
  id: string;
  label: string;
  scope: string;
  status: string;
}

export interface KainPluginFfiCapability {
  id: string;
  label: string;
  lane: string;
  summary: string;
  status: string;
  required: boolean;
  sourcePath?: string;
  hostPath?: string;
}

export interface KainPluginRuntime {
  id: string;
  kind: string;
  language: string;
  entry: string;
  transport: string;
  status: string;
  ffiLanes: string[];
}

export interface KainPluginWorkbench {
  id: string;
  title: string;
  summary: string;
  kind: string;
  mountSlot: string;
  order: number;
  rendererKind: KainPluginRendererKind;
  componentId?: string;
  defaultOpen: boolean;
  hostModels: string[];
  actions: string[];
  ffiLanes: string[];
}

export interface KainPluginPreviewWorkbenchMatch {
  appliesTo: "any" | "file" | "directory";
  extensions: string[];
  fileNames: string[];
  previewKinds: string[];
}

export interface KainPluginPreviewWorkbenchCapabilities {
  editable: boolean;
  save: boolean;
  export: boolean;
  workflowTabs: boolean;
  contextMenu: boolean;
  prefetch: boolean;
  closeGuard: boolean;
}

export interface KainPluginPreviewWorkbenchChrome {
  includePreviewTab?: boolean;
  includeEditTab?: boolean;
  topBarDensity?: string;
}

export interface KainPluginPreviewWorkbench {
  id: string;
  title: string;
  summary: string;
  order: number;
  rendererKind: KainPluginRendererKind;
  runtimeId?: string;
  runtimeSurfaceId?: string;
  buildTarget?: string;
  match: KainPluginPreviewWorkbenchMatch;
  capabilities: KainPluginPreviewWorkbenchCapabilities;
  workbenchChrome: KainPluginPreviewWorkbenchChrome;
  actions: string[];
  ffiLanes: string[];
}

export interface KainPluginAction {
  id: string;
  label: string;
  summary: string;
  command: string;
  kind: string;
  status: string;
  requiresTrust: boolean;
  ffiLanes: string[];
}

export interface KainPluginWasmTarget {
  id: string;
  label: string;
  source: string;
  target: string;
  buildTarget: string;
  status: string;
}

export interface KainPluginCargoFfiTarget {
  id: string;
  label: string;
  crateName: string;
  cratePath: string;
  feature: string;
  status: string;
}

export interface KainPluginGeneratedArtifact {
  id: string;
  kind: string;
  source: string;
  target: string;
  status: string;
}

export interface KainPluginDefinition {
  id: string;
  name: string;
  version: string;
  description: string;
  category: string;
  source: string;
  directory: string;
  manifestPath: string;
  status: string;
  tags: string[];
  permissions: KainPluginPermission[];
  ffiCapabilities: KainPluginFfiCapability[];
  runtimes: KainPluginRuntime[];
  workbenches: KainPluginWorkbench[];
  previewWorkbenches: KainPluginPreviewWorkbench[];
  actions: KainPluginAction[];
  wasmTargets: KainPluginWasmTarget[];
  cargoFfiTargets: KainPluginCargoFfiTarget[];
  generatedArtifacts: KainPluginGeneratedArtifact[];
}

export interface KainPluginCatalog {
  schemaVersion: number;
  kind: string;
  source: string;
  root: string;
  stdlib: string;
  host: string;
  summary: string;
  plugins: KainPluginDefinition[];
  consumers: string[];
}

export interface KainPluginCatalogLoadResult {
  catalog: KainPluginCatalog | null;
  error: string | null;
}

export interface KainPluginActionResult {
  ok: boolean;
  pluginId: string;
  actionId: string;
  label: string;
  summary: string;
  ffiLanes: string[];
  result: Record<string, unknown>;
}

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function numberValue(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

function booleanValue(value: unknown, fallback = false): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function stringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map(stringValue).filter((item): item is string => Boolean(item))
    : [];
}

function normalizeList<T>(
  value: unknown,
  normalize: (source: Record<string, unknown>) => T | null,
): T[] {
  return Array.isArray(value)
    ? value
        .map((item) => asObject(item))
        .filter((item): item is Record<string, unknown> => Boolean(item))
        .map(normalize)
        .filter((item): item is T => Boolean(item))
    : [];
}

function normalizeRendererKind(value: unknown): KainPluginRendererKind {
  if (value === "react-compat" || value === "wasm-panel") {
    return value;
  }
  return "kain-host";
}

function normalizePreviewMatch(value: unknown): KainPluginPreviewWorkbenchMatch {
  const source = asObject(value) ?? {};
  const appliesTo = source.appliesTo === "any" || source.appliesTo === "directory"
    ? source.appliesTo
    : "file";
  return {
    appliesTo,
    extensions: stringList(source.extensions).map((item) => item.toLowerCase()),
    fileNames: stringList(source.fileNames),
    previewKinds: stringList(source.previewKinds).map((item) => item.toLowerCase()),
  };
}

function normalizePreviewCapabilities(value: unknown): KainPluginPreviewWorkbenchCapabilities {
  const source = asObject(value) ?? {};
  return {
    editable: booleanValue(source.editable),
    save: booleanValue(source.save),
    export: booleanValue(source.export),
    workflowTabs: booleanValue(source.workflowTabs),
    contextMenu: booleanValue(source.contextMenu),
    prefetch: booleanValue(source.prefetch),
    closeGuard: booleanValue(source.closeGuard),
  };
}

function normalizePreviewChrome(value: unknown): KainPluginPreviewWorkbenchChrome {
  const source = asObject(value) ?? {};
  return {
    includePreviewTab: typeof source.includePreviewTab === "boolean" ? source.includePreviewTab : undefined,
    includeEditTab: typeof source.includeEditTab === "boolean" ? source.includeEditTab : undefined,
    topBarDensity: stringValue(source.topBarDensity),
  };
}

export function normalizeKainPluginCatalog(value: unknown): KainPluginCatalog | null {
  const source = asObject(value);
  if (!source) {
    return null;
  }

  const schemaVersion = numberValue(source.schemaVersion) ?? 0;
  const kind = stringValue(source.kind);
  if (schemaVersion < 1 || kind !== "greeblefs.kain.plugin.catalog") {
    return null;
  }

  const root = stringValue(source.root) ?? "usr/plugins-kain";

  return {
    schemaVersion,
    kind,
    source: stringValue(source.source) ?? "src-kain/plugins/registry.kn",
    root,
    stdlib: stringValue(source.stdlib) ?? "src-kain/plugins/stdlib/greeblefs/plugin.kn",
    host: stringValue(source.host) ?? "src/runtime/kainPluginCatalog.ts",
    summary: stringValue(source.summary) ?? "",
    plugins: normalizeList(source.plugins, (pluginSource) => {
      const id = stringValue(pluginSource.id);
      const name = stringValue(pluginSource.name);
      if (!id || !name) {
        return null;
      }

      const directory = stringValue(pluginSource.directory) ?? `${root}/${id}`;
      const manifestPath = stringValue(pluginSource.manifestPath) ?? `${directory}/plugin.kn`;
      const actions = normalizeList(pluginSource.actions, (actionSource) => {
        const actionId = stringValue(actionSource.id);
        const label = stringValue(actionSource.label);
        if (!actionId || !label) {
          return null;
        }
        return {
          id: actionId,
          label,
          summary: stringValue(actionSource.summary) ?? "",
          command: stringValue(actionSource.command) ?? `kain:${id}:${actionId}`,
          kind: stringValue(actionSource.kind) ?? "kain-action",
          status: stringValue(actionSource.status) ?? "declared",
          requiresTrust: booleanValue(actionSource.requiresTrust, true),
          ffiLanes: stringList(actionSource.ffiLanes),
        };
      });

      return {
        id,
        name,
        version: stringValue(pluginSource.version) ?? "0.1.0",
        description: stringValue(pluginSource.description) ?? "",
        category: stringValue(pluginSource.category) ?? "Kain Plugins",
        source: stringValue(pluginSource.source) ?? manifestPath,
        directory,
        manifestPath,
        status: stringValue(pluginSource.status) ?? "declared",
        tags: stringList(pluginSource.tags),
        permissions: normalizeList(pluginSource.permissions, (permissionSource) => {
          const permissionId = stringValue(permissionSource.id);
          if (!permissionId) {
            return null;
          }
          return {
            id: permissionId,
            label: stringValue(permissionSource.label) ?? permissionId,
            scope: stringValue(permissionSource.scope) ?? "plugin",
            status: stringValue(permissionSource.status) ?? "declared",
          };
        }),
        ffiCapabilities: normalizeList(pluginSource.ffiCapabilities, (capabilitySource) => {
          const capabilityId = stringValue(capabilitySource.id);
          const label = stringValue(capabilitySource.label);
          if (!capabilityId || !label) {
            return null;
          }
          return {
            id: capabilityId,
            label,
            lane: stringValue(capabilitySource.lane) ?? "unknown",
            summary: stringValue(capabilitySource.summary) ?? "",
            status: stringValue(capabilitySource.status) ?? "declared",
            required: booleanValue(capabilitySource.required),
            sourcePath: stringValue(capabilitySource.sourcePath),
            hostPath: stringValue(capabilitySource.hostPath),
          };
        }),
        runtimes: normalizeList(pluginSource.runtimes, (runtimeSource) => {
          const runtimeId = stringValue(runtimeSource.id);
          if (!runtimeId) {
            return null;
          }
          return {
            id: runtimeId,
            kind: stringValue(runtimeSource.kind) ?? "kain-runtime",
            language: stringValue(runtimeSource.language) ?? "kain",
            entry: stringValue(runtimeSource.entry) ?? "",
            transport: stringValue(runtimeSource.transport) ?? "tauron.kain.bridge",
            status: stringValue(runtimeSource.status) ?? "declared",
            ffiLanes: stringList(runtimeSource.ffiLanes),
          };
        }),
        workbenches: normalizeList(pluginSource.workbenches, (workbenchSource) => {
          const workbenchId = stringValue(workbenchSource.id);
          const title = stringValue(workbenchSource.title);
          if (!workbenchId || !title) {
            return null;
          }
          return {
            id: workbenchId,
            title,
            summary: stringValue(workbenchSource.summary) ?? "",
            kind: stringValue(workbenchSource.kind) ?? "workbench",
            mountSlot: stringValue(workbenchSource.mountSlot) ?? "workbench.panels",
            order: numberValue(workbenchSource.order) ?? 0,
            rendererKind: normalizeRendererKind(workbenchSource.rendererKind),
            componentId: stringValue(workbenchSource.componentId),
            defaultOpen: booleanValue(workbenchSource.defaultOpen),
            hostModels: stringList(workbenchSource.hostModels),
            actions: stringList(workbenchSource.actions),
            ffiLanes: stringList(workbenchSource.ffiLanes),
          };
        }),
        previewWorkbenches: normalizeList(pluginSource.previewWorkbenches, (previewSource) => {
          const previewId = stringValue(previewSource.id);
          const title = stringValue(previewSource.title);
          if (!previewId || !title) {
            return null;
          }
          return {
            id: previewId,
            title,
            summary: stringValue(previewSource.summary) ?? "",
            order: numberValue(previewSource.order) ?? 0,
            rendererKind: normalizeRendererKind(previewSource.rendererKind),
            runtimeId: stringValue(previewSource.runtimeId),
            runtimeSurfaceId: stringValue(previewSource.runtimeSurfaceId),
            buildTarget: stringValue(previewSource.buildTarget),
            match: normalizePreviewMatch(previewSource.match),
            capabilities: normalizePreviewCapabilities(previewSource.capabilities),
            workbenchChrome: normalizePreviewChrome(previewSource.workbenchChrome),
            actions: stringList(previewSource.actions),
            ffiLanes: stringList(previewSource.ffiLanes),
          };
        }),
        actions,
        wasmTargets: normalizeList(pluginSource.wasmTargets, (targetSource) => {
          const targetId = stringValue(targetSource.id);
          if (!targetId) {
            return null;
          }
          return {
            id: targetId,
            label: stringValue(targetSource.label) ?? targetId,
            source: stringValue(targetSource.source) ?? "",
            target: stringValue(targetSource.target) ?? "",
            buildTarget: stringValue(targetSource.buildTarget) ?? "wasm32-unknown-unknown",
            status: stringValue(targetSource.status) ?? "declared",
          };
        }),
        cargoFfiTargets: normalizeList(pluginSource.cargoFfiTargets, (targetSource) => {
          const targetId = stringValue(targetSource.id);
          if (!targetId) {
            return null;
          }
          return {
            id: targetId,
            label: stringValue(targetSource.label) ?? targetId,
            crateName: stringValue(targetSource.crateName) ?? "",
            cratePath: stringValue(targetSource.cratePath) ?? "",
            feature: stringValue(targetSource.feature) ?? "",
            status: stringValue(targetSource.status) ?? "declared",
          };
        }),
        generatedArtifacts: normalizeList(pluginSource.generatedArtifacts, (artifactSource) => {
          const artifactId = stringValue(artifactSource.id);
          if (!artifactId) {
            return null;
          }
          return {
            id: artifactId,
            kind: stringValue(artifactSource.kind) ?? "artifact",
            source: stringValue(artifactSource.source) ?? "",
            target: stringValue(artifactSource.target) ?? "",
            status: stringValue(artifactSource.status) ?? "declared",
          };
        }),
      };
    }),
    consumers: stringList(source.consumers),
  };
}

export function selectKainPluginById(
  catalog: KainPluginCatalog | null,
  pluginId: string,
): KainPluginDefinition | null {
  return catalog?.plugins.find((plugin) => plugin.id === pluginId) ?? null;
}

export function selectKainPluginPreviewWorkbenches(
  catalog: KainPluginCatalog | null,
): KainPluginPreviewWorkbench[] {
  return catalog?.plugins.flatMap((plugin) => plugin.previewWorkbenches) ?? [];
}

export async function loadKainPluginCatalog(
  args: Record<string, unknown> = {},
): Promise<KainPluginCatalogLoadResult> {
  try {
    const rawCatalog = await callKainTauronBridge<unknown, Record<string, unknown>>(
      "greeblefs.plugins",
      "catalog",
      args,
    );
    const catalog = normalizeKainPluginCatalog(rawCatalog);
    return catalog
      ? { catalog, error: null }
      : { catalog: null, error: "Kain plugin catalog response was empty or invalid." };
  } catch (error) {
    return {
      catalog: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function runKainPluginAction({
  pluginId,
  actionId,
  context = {},
}: {
  pluginId: string;
  actionId: string;
  context?: Record<string, unknown>;
}): Promise<KainPluginActionResult> {
  const rawResult = await callKainTauronBridge<unknown, Record<string, unknown>>(
    "greeblefs.plugins",
    "action",
    {
      pluginId,
      actionId,
      context,
    },
  );
  const source = asObject(rawResult) ?? {};
  return {
    ok: booleanValue(source.ok),
    pluginId: stringValue(source.pluginId) ?? pluginId,
    actionId: stringValue(source.actionId) ?? actionId,
    label: stringValue(source.label) ?? actionId,
    summary: stringValue(source.summary) ?? "",
    ffiLanes: stringList(source.ffiLanes),
    result: asObject(source.result) ?? {},
  };
}
