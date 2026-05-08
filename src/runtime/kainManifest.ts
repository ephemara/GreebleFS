import { callKainTauronBridge } from "./kainTauronBridge";

export interface KainManifestBridge {
  runtimeId?: string;
  entry?: string;
  dispatchFunction?: string;
  transport?: string;
  supervisor?: string;
}

export interface KainManifestCapability {
  id: string;
  lane: string;
  label: string;
  summary: string;
  status: string;
  implemented: boolean;
}

export interface KainManifestDispatchEndpoint {
  namespace: string;
  method: string;
  summary: string;
  consumedBy: string;
}

export interface KainManifestGeneratedArtifact {
  id: string;
  kind: string;
  source: string;
  target: string;
  status: string;
}

export interface KainManifestSettingsSchema {
  id: string;
  label: string;
  source: string;
  consumer: string;
  status: string;
}

export interface KainManifestPipeline {
  id: string;
  label: string;
  summary: string;
  status: string;
}

export interface KainManifestFfiLane {
  id: string;
  label: string;
  summary: string;
  status: string;
}

export interface KainAppManifest {
  schemaVersion: number;
  kind: string;
  source: string;
  label: string;
  summary: string;
  bridge: KainManifestBridge;
  capabilities: KainManifestCapability[];
  dispatch: KainManifestDispatchEndpoint[];
  generatedArtifacts: KainManifestGeneratedArtifact[];
  settingsSchemas: KainManifestSettingsSchema[];
  pipelines: KainManifestPipeline[];
  ffiLanes: KainManifestFfiLane[];
  consumers: string[];
}

export interface KainManifestLoadResult {
  manifest: KainAppManifest | null;
  error: string | null;
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

function booleanValue(value: unknown): boolean {
  return typeof value === "boolean" ? value : false;
}

function stringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map(stringValue).filter((item): item is string => Boolean(item))
    : [];
}

function normalizeListItem<T>(
  value: unknown,
  normalize: (source: Record<string, unknown>) => T | null,
): T | null {
  const source = asObject(value);
  return source ? normalize(source) : null;
}

function normalizeList<T>(
  value: unknown,
  normalize: (source: Record<string, unknown>) => T | null,
): T[] {
  return Array.isArray(value)
    ? value
        .map((item) => normalizeListItem(item, normalize))
        .filter((item): item is T => Boolean(item))
    : [];
}

export function normalizeKainAppManifest(value: unknown): KainAppManifest | null {
  const source = asObject(value);
  if (!source) {
    return null;
  }

  const schemaVersion = numberValue(source.schemaVersion) ?? 0;
  const kind = stringValue(source.kind);
  if (schemaVersion < 1 || kind !== "greeblefs.kain.manifest") {
    return null;
  }

  const bridgeSource = asObject(source.bridge) ?? {};

  return {
    schemaVersion,
    kind,
    source: stringValue(source.source) ?? "src-kain/app/main.kn",
    label: stringValue(source.label) ?? "GreebleFS Kain Manifest",
    summary: stringValue(source.summary) ?? "",
    bridge: {
      runtimeId: stringValue(bridgeSource.runtimeId),
      entry: stringValue(bridgeSource.entry),
      dispatchFunction: stringValue(bridgeSource.dispatchFunction),
      transport: stringValue(bridgeSource.transport),
      supervisor: stringValue(bridgeSource.supervisor),
    },
    capabilities: normalizeList(source.capabilities, (item) => {
      const id = stringValue(item.id);
      const label = stringValue(item.label);
      if (!id || !label) {
        return null;
      }
      return {
        id,
        lane: stringValue(item.lane) ?? "general",
        label,
        summary: stringValue(item.summary) ?? "",
        status: stringValue(item.status) ?? "unknown",
        implemented: booleanValue(item.implemented),
      };
    }),
    dispatch: normalizeList(source.dispatch, (item) => {
      const namespace = stringValue(item.namespace);
      const method = stringValue(item.method);
      if (!namespace || !method) {
        return null;
      }
      return {
        namespace,
        method,
        summary: stringValue(item.summary) ?? "",
        consumedBy: stringValue(item.consumedBy) ?? "",
      };
    }),
    generatedArtifacts: normalizeList(source.generatedArtifacts, (item) => {
      const id = stringValue(item.id);
      const kind = stringValue(item.kind);
      if (!id || !kind) {
        return null;
      }
      return {
        id,
        kind,
        source: stringValue(item.source) ?? "",
        target: stringValue(item.target) ?? "",
        status: stringValue(item.status) ?? "unknown",
      };
    }),
    settingsSchemas: normalizeList(source.settingsSchemas, (item) => {
      const id = stringValue(item.id);
      const label = stringValue(item.label);
      if (!id || !label) {
        return null;
      }
      return {
        id,
        label,
        source: stringValue(item.source) ?? "",
        consumer: stringValue(item.consumer) ?? "",
        status: stringValue(item.status) ?? "unknown",
      };
    }),
    pipelines: normalizeList(source.pipelines, (item) => {
      const id = stringValue(item.id);
      const label = stringValue(item.label);
      if (!id || !label) {
        return null;
      }
      return {
        id,
        label,
        summary: stringValue(item.summary) ?? "",
        status: stringValue(item.status) ?? "unknown",
      };
    }),
    ffiLanes: normalizeList(source.ffiLanes, (item) => {
      const id = stringValue(item.id);
      const label = stringValue(item.label);
      if (!id || !label) {
        return null;
      }
      return {
        id,
        label,
        summary: stringValue(item.summary) ?? "",
        status: stringValue(item.status) ?? "unknown",
      };
    }),
    consumers: stringList(source.consumers),
  };
}

export async function loadKainManifest(args: Record<string, unknown> = {}): Promise<KainManifestLoadResult> {
  try {
    const rawManifest = await callKainTauronBridge<unknown, Record<string, unknown>>(
      "greeblefs.kain",
      "manifest",
      args,
    );
    const manifest = normalizeKainAppManifest(rawManifest);
    return manifest
      ? { manifest, error: null }
      : { manifest: null, error: "Kain manifest response was empty or invalid." };
  } catch (error) {
    return {
      manifest: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
