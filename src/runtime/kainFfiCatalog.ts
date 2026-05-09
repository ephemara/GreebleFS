import { callKainTauronBridge } from "./kainTauronBridge";

export interface KainFfiLane {
  id: string;
  label: string;
  kind: string;
  sourcePath: string;
  hostPath: string;
  bridge: string;
  status: string;
  implemented: boolean;
  summary: string;
  nextAction: string;
}

export interface KainFfiCatalog {
  schemaVersion: number;
  kind: string;
  name: string;
  source: string;
  registry: string;
  root: string;
  summary: string;
  lanes: KainFfiLane[];
  analysisPipelines: string[];
  consumers: string[];
}

export interface KainFfiCatalogLoadResult {
  catalog: KainFfiCatalog | null;
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

function normalizeLanes(value: unknown): KainFfiLane[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item) => {
      const source = asObject(item);
      const id = source ? stringValue(source.id) : undefined;
      if (!source || !id) {
        return null;
      }
      return {
        id,
        label: stringValue(source.label) ?? id,
        kind: stringValue(source.kind) ?? "unknown",
        sourcePath: stringValue(source.sourcePath) ?? "",
        hostPath: stringValue(source.hostPath) ?? "",
        bridge: stringValue(source.bridge) ?? "",
        status: stringValue(source.status) ?? "unknown",
        implemented: booleanValue(source.implemented),
        summary: stringValue(source.summary) ?? "",
        nextAction: stringValue(source.nextAction) ?? "",
      };
    })
    .filter((item): item is KainFfiLane => Boolean(item));
}

export function normalizeKainFfiCatalog(value: unknown): KainFfiCatalog | null {
  const source = asObject(value);
  if (!source) {
    return null;
  }

  const schemaVersion = numberValue(source.schemaVersion) ?? 0;
  const kind = stringValue(source.kind);
  if (schemaVersion < 1 || kind !== "greeblefs.ffi.catalog") {
    return null;
  }

  return {
    schemaVersion,
    kind,
    name: stringValue(source.name) ?? "Kain FFI",
    source: stringValue(source.source) ?? "src-kain/app/main.kn",
    registry: stringValue(source.registry) ?? "src-kain/ffi/registry.kn",
    root: stringValue(source.root) ?? "src-kain/ffi",
    summary: stringValue(source.summary) ?? "",
    lanes: normalizeLanes(source.lanes),
    analysisPipelines: stringList(source.analysisPipelines),
    consumers: stringList(source.consumers),
  };
}

export async function loadKainFfiCatalog(args: Record<string, unknown> = {}): Promise<KainFfiCatalogLoadResult> {
  try {
    const rawCatalog = await callKainTauronBridge<unknown, Record<string, unknown>>(
      "greeblefs.ffi",
      "catalog",
      args,
    );
    const catalog = normalizeKainFfiCatalog(rawCatalog);
    return catalog
      ? { catalog, error: null }
      : { catalog: null, error: "Kain FFI catalog response was empty or invalid." };
  } catch (error) {
    return {
      catalog: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
