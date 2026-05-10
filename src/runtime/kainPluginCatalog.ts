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

export interface KainPluginToolFormat {
  id: string;
  label: string;
  extension: string;
  mimeType: string;
  encoder: string;
  status: string;
  read: boolean;
  write: boolean;
}

export interface KainPluginToolResizePreset {
  id: string;
  label: string;
  width: number;
  height: number;
  fitMode: string;
}

export interface KainPluginToolPipelineBackend {
  id: string;
  label: string;
  lane: string;
  role: string;
  status: string;
  required: boolean;
  packages: string[];
  sourcePath?: string;
}

export interface KainPluginTool {
  id: string;
  kind: string;
  label: string;
  summary: string;
  primaryActionId?: string;
  defaultOutputFormat?: string;
  supportedInputExtensions: string[];
  resizeModes: string[];
  formats: KainPluginToolFormat[];
  resizePresets: KainPluginToolResizePreset[];
  pipelineBackends: KainPluginToolPipelineBackend[];
  ui: Record<string, unknown>;
}

export interface KainPluginHostUiComponent {
  id: string;
  kind: string;
  label: string;
  role: string;
  surface: string;
  density: string;
  status: string;
  summary: string;
  primitives: string[];
  actions: string[];
  bindings: string[];
}

export interface KainPluginHostUiKit {
  id: string;
  label: string;
  version: string;
  status: string;
  summary: string;
  primitives: string[];
  tokens: string[];
  components: KainPluginHostUiComponent[];
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
  toolId?: string;
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
  toolId?: string;
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
  toolId?: string;
  runtimeActionId?: string;
  sidecarActionId?: string;
  effect?: string;
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

export interface KainPluginAuthoringFeature {
  id: string;
  label: string;
  status: string;
  sourcePath: string;
  summary: string;
}

export interface KainPluginAuthoringExample {
  id: string;
  label: string;
  path: string;
  kind: string;
  proof: string;
  features: string[];
}

export interface KainPluginAuthoringReference {
  id: string;
  summary: string;
  entry: string;
  languageFeatures: KainPluginAuthoringFeature[];
  examples: KainPluginAuthoringExample[];
  designRules: string[];
  smokeCommands: string[];
}

export interface KainPluginContract {
  id: string;
  kind: string;
  symbol: string;
  sourcePath: string;
  status: string;
  summary: string;
}

export interface KainPluginPipelineStage {
  id: string;
  label: string;
  runtime: string;
  entry: string;
  status: string;
  summary: string;
  outputs: string[];
}

export interface KainPluginFabricOutput {
  name: string;
  kind: string;
}

export interface KainPluginFabricStep {
  id: string;
  label: string;
  runtime: string;
  entry: string;
  module?: string;
  crateName?: string;
  manifestPath?: string;
  library?: string;
  shaderSource?: string;
  computeKey?: string;
  status: string;
  summary: string;
  dependsOn: string[];
  requires: string[];
  outputs: KainPluginFabricOutput[];
}

export interface KainPluginFabricPipeline {
  id: string;
  label: string;
  manifestPath: string;
  workspaceRoot: string;
  reportDirectory: string;
  status: string;
  summary: string;
  eventStream: boolean;
  runtimes: string[];
  ffiLanes: string[];
  requiredCapabilities: string[];
  outputContracts: string[];
  steps: KainPluginFabricStep[];
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
  tools: KainPluginTool[];
  hostUiKit: KainPluginHostUiKit | null;
  hostUiComponents: KainPluginHostUiComponent[];
  workbenches: KainPluginWorkbench[];
  previewWorkbenches: KainPluginPreviewWorkbench[];
  actions: KainPluginAction[];
  wasmTargets: KainPluginWasmTarget[];
  cargoFfiTargets: KainPluginCargoFfiTarget[];
  generatedArtifacts: KainPluginGeneratedArtifact[];
  authoring: KainPluginAuthoringReference | null;
  contracts: KainPluginContract[];
  pipelineStages: KainPluginPipelineStage[];
  fabricPipelines: KainPluginFabricPipeline[];
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

function normalizeAuthoringReference(value: unknown): KainPluginAuthoringReference | null {
  const source = asObject(value);
  const id = stringValue(source?.id);
  if (!source || !id) {
    return null;
  }

  return {
    id,
    summary: stringValue(source.summary) ?? "",
    entry: stringValue(source.entry) ?? "",
    languageFeatures: normalizeList(source.languageFeatures, (featureSource) => {
      const featureId = stringValue(featureSource.id);
      if (!featureId) {
        return null;
      }
      return {
        id: featureId,
        label: stringValue(featureSource.label) ?? featureId,
        status: stringValue(featureSource.status) ?? "declared",
        sourcePath: stringValue(featureSource.sourcePath) ?? "",
        summary: stringValue(featureSource.summary) ?? "",
      };
    }),
    examples: normalizeList(source.examples, (exampleSource) => {
      const exampleId = stringValue(exampleSource.id);
      if (!exampleId) {
        return null;
      }
      return {
        id: exampleId,
        label: stringValue(exampleSource.label) ?? exampleId,
        path: stringValue(exampleSource.path) ?? "",
        kind: stringValue(exampleSource.kind) ?? "run",
        proof: stringValue(exampleSource.proof) ?? "",
        features: stringList(exampleSource.features),
      };
    }),
    designRules: stringList(source.designRules),
    smokeCommands: stringList(source.smokeCommands),
  };
}

function normalizeHostUiComponent(value: unknown): KainPluginHostUiComponent | null {
  const source = asObject(value);
  const id = stringValue(source?.id);
  if (!source || !id) {
    return null;
  }

  return {
    id,
    kind: stringValue(source.kind) ?? "component",
    label: stringValue(source.label) ?? id,
    role: stringValue(source.role) ?? "display",
    surface: stringValue(source.surface) ?? "workbench",
    density: stringValue(source.density) ?? "compact",
    status: stringValue(source.status) ?? "declared",
    summary: stringValue(source.summary) ?? "",
    primitives: stringList(source.primitives),
    actions: stringList(source.actions),
    bindings: stringList(source.bindings),
  };
}

function normalizeHostUiKit(value: unknown): KainPluginHostUiKit | null {
  const source = asObject(value);
  const id = stringValue(source?.id);
  if (!source || !id) {
    return null;
  }

  return {
    id,
    label: stringValue(source.label) ?? id,
    version: stringValue(source.version) ?? "0.1.0",
    status: stringValue(source.status) ?? "declared",
    summary: stringValue(source.summary) ?? "",
    primitives: stringList(source.primitives),
    tokens: stringList(source.tokens),
    components: normalizeList(source.components, normalizeHostUiComponent),
  };
}

function normalizeFabricOutput(value: unknown): KainPluginFabricOutput | null {
  const source = asObject(value);
  const name = stringValue(source?.name);
  if (!source || !name) {
    return null;
  }

  return {
    name,
    kind: stringValue(source.kind) ?? "value",
  };
}

function normalizeFabricStep(value: unknown): KainPluginFabricStep | null {
  const source = asObject(value);
  const id = stringValue(source?.id);
  if (!source || !id) {
    return null;
  }

  return {
    id,
    label: stringValue(source.label) ?? id,
    runtime: stringValue(source.runtime) ?? "kain",
    entry: stringValue(source.entry) ?? "",
    module: stringValue(source.module),
    crateName: stringValue(source.crateName),
    manifestPath: stringValue(source.manifestPath),
    library: stringValue(source.library),
    shaderSource: stringValue(source.shaderSource),
    computeKey: stringValue(source.computeKey),
    status: stringValue(source.status) ?? "declared",
    summary: stringValue(source.summary) ?? "",
    dependsOn: stringList(source.dependsOn),
    requires: stringList(source.requires),
    outputs: normalizeList(source.outputs, normalizeFabricOutput),
  };
}

function normalizeFabricPipeline(value: unknown): KainPluginFabricPipeline | null {
  const source = asObject(value);
  const id = stringValue(source?.id);
  if (!source || !id) {
    return null;
  }

  return {
    id,
    label: stringValue(source.label) ?? id,
    manifestPath: stringValue(source.manifestPath) ?? "",
    workspaceRoot: stringValue(source.workspaceRoot) ?? ".",
    reportDirectory: stringValue(source.reportDirectory) ?? ".kain/fabric/reports",
    status: stringValue(source.status) ?? "declared",
    summary: stringValue(source.summary) ?? "",
    eventStream: booleanValue(source.eventStream),
    runtimes: stringList(source.runtimes),
    ffiLanes: stringList(source.ffiLanes),
    requiredCapabilities: stringList(source.requiredCapabilities),
    outputContracts: stringList(source.outputContracts),
    steps: normalizeList(source.steps, normalizeFabricStep),
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
          toolId: stringValue(actionSource.toolId),
          runtimeActionId: stringValue(actionSource.runtimeActionId),
          sidecarActionId: stringValue(actionSource.sidecarActionId),
          effect: stringValue(actionSource.effect),
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
        tools: normalizeList(pluginSource.tools, (toolSource) => {
          const toolId = stringValue(toolSource.id);
          if (!toolId) {
            return null;
          }

          return {
            id: toolId,
            kind: stringValue(toolSource.kind) ?? "tool",
            label: stringValue(toolSource.label) ?? toolId,
            summary: stringValue(toolSource.summary) ?? "",
            primaryActionId: stringValue(toolSource.primaryActionId),
            defaultOutputFormat: stringValue(toolSource.defaultOutputFormat),
            supportedInputExtensions: stringList(toolSource.supportedInputExtensions)
              .map((item) => item.toLowerCase()),
            resizeModes: stringList(toolSource.resizeModes),
            formats: normalizeList(toolSource.formats, (formatSource) => {
              const formatId = stringValue(formatSource.id);
              if (!formatId) {
                return null;
              }
              return {
                id: formatId,
                label: stringValue(formatSource.label) ?? formatId.toUpperCase(),
                extension: stringValue(formatSource.extension) ?? formatId,
                mimeType: stringValue(formatSource.mimeType) ?? "application/octet-stream",
                encoder: stringValue(formatSource.encoder) ?? formatId.toUpperCase(),
                status: stringValue(formatSource.status) ?? "declared",
                read: booleanValue(formatSource.read, true),
                write: booleanValue(formatSource.write, true),
              };
            }),
            resizePresets: normalizeList(toolSource.resizePresets, (presetSource) => {
              const presetId = stringValue(presetSource.id);
              if (!presetId) {
                return null;
              }
              return {
                id: presetId,
                label: stringValue(presetSource.label) ?? presetId,
                width: numberValue(presetSource.width) ?? 0,
                height: numberValue(presetSource.height) ?? 0,
                fitMode: stringValue(presetSource.fitMode) ?? "contain",
              };
            }),
            pipelineBackends: normalizeList(toolSource.pipelineBackends, (backendSource) => {
              const backendId = stringValue(backendSource.id);
              if (!backendId) {
                return null;
              }
              return {
                id: backendId,
                label: stringValue(backendSource.label) ?? backendId,
                lane: stringValue(backendSource.lane) ?? "kain",
                role: stringValue(backendSource.role) ?? "helper",
                status: stringValue(backendSource.status) ?? "declared",
                required: booleanValue(backendSource.required),
                packages: stringList(backendSource.packages),
                sourcePath: stringValue(backendSource.sourcePath),
              };
            }),
            ui: asObject(toolSource.ui) ?? {},
          };
        }),
        hostUiKit: normalizeHostUiKit(pluginSource.hostUiKit),
        hostUiComponents: normalizeList(pluginSource.hostUiComponents, normalizeHostUiComponent),
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
            toolId: stringValue(workbenchSource.toolId),
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
            toolId: stringValue(previewSource.toolId),
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
        authoring: normalizeAuthoringReference(pluginSource.authoring),
        contracts: normalizeList(pluginSource.contracts, (contractSource) => {
          const contractId = stringValue(contractSource.id);
          if (!contractId) {
            return null;
          }
          return {
            id: contractId,
            kind: stringValue(contractSource.kind) ?? "contract",
            symbol: stringValue(contractSource.symbol) ?? "",
            sourcePath: stringValue(contractSource.sourcePath) ?? "",
            status: stringValue(contractSource.status) ?? "declared",
            summary: stringValue(contractSource.summary) ?? "",
          };
        }),
        pipelineStages: normalizeList(pluginSource.pipelineStages, (stageSource) => {
          const stageId = stringValue(stageSource.id);
          if (!stageId) {
            return null;
          }
          return {
            id: stageId,
            label: stringValue(stageSource.label) ?? stageId,
            runtime: stringValue(stageSource.runtime) ?? "kain",
            entry: stringValue(stageSource.entry) ?? "",
            status: stringValue(stageSource.status) ?? "declared",
            summary: stringValue(stageSource.summary) ?? "",
            outputs: stringList(stageSource.outputs),
          };
        }),
        fabricPipelines: normalizeList(pluginSource.fabricPipelines, normalizeFabricPipeline),
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
