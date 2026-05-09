import { callKainTauronBridge } from "./kainTauronBridge";

export interface KainLatticeAnalogy {
  reference: string;
  qmlLike: string;
  nativeModelLike: string;
  packageLike: string;
}

export interface KainLatticeImport {
  id: string;
  label: string;
  mapsTo: string;
  status: string;
}

export interface KainLatticePrimitive {
  id: string;
  qmlAnalogy: string;
  summary: string;
  status: string;
}

export interface KainLatticeHostObject {
  id: string;
  provider: string;
  summary: string;
  status: string;
}

export interface KainLatticePackage {
  id: string;
  kind: string;
  title: string;
  summary: string;
  packagePath: string;
  entry: string;
  metadata: string;
  imports: string[];
  surfaces: string[];
  hostModels: string[];
  actions: string[];
  permissions: string[];
  configSchema: Record<string, unknown>;
}

export interface KainLatticeMilestone {
  id: string;
  label: string;
  summary: string;
  status: string;
}

export interface KainLatticeCatalog {
  schemaVersion: number;
  kind: string;
  name: string;
  source: string;
  stdlib: string;
  packageRoot: string;
  summary: string;
  analogy: KainLatticeAnalogy;
  imports: KainLatticeImport[];
  primitives: KainLatticePrimitive[];
  hostObjects: KainLatticeHostObject[];
  packages: KainLatticePackage[];
  milestones: KainLatticeMilestone[];
  consumers: string[];
}

export interface KainLatticeCatalogLoadResult {
  catalog: KainLatticeCatalog | null;
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
        .map((item) => {
          const source = asObject(item);
          return source ? normalize(source) : null;
        })
        .filter((item): item is T => Boolean(item))
    : [];
}

export function normalizeKainLatticeCatalog(value: unknown): KainLatticeCatalog | null {
  const source = asObject(value);
  if (!source) {
    return null;
  }

  const schemaVersion = numberValue(source.schemaVersion) ?? 0;
  const kind = stringValue(source.kind);
  if (schemaVersion < 1 || kind !== "greeblefs.lattice.catalog") {
    return null;
  }

  const analogySource = asObject(source.analogy) ?? {};

  return {
    schemaVersion,
    kind,
    name: stringValue(source.name) ?? "Kain Lattice",
    source: stringValue(source.source) ?? "src-kain/app/main.kn",
    stdlib: stringValue(source.stdlib) ?? "src-kain/stdlib/greeblefs/lattice.kn",
    packageRoot: stringValue(source.packageRoot) ?? "src-kain/lattice",
    summary: stringValue(source.summary) ?? "",
    analogy: {
      reference: stringValue(analogySource.reference) ?? "reference/plasma-desktop-master",
      qmlLike: stringValue(analogySource.qmlLike) ?? "",
      nativeModelLike: stringValue(analogySource.nativeModelLike) ?? "",
      packageLike: stringValue(analogySource.packageLike) ?? "",
    },
    imports: normalizeList(source.imports, (item) => {
      const id = stringValue(item.id);
      if (!id) {
        return null;
      }
      return {
        id,
        label: stringValue(item.label) ?? id,
        mapsTo: stringValue(item.mapsTo) ?? "",
        status: stringValue(item.status) ?? "unknown",
      };
    }),
    primitives: normalizeList(source.primitives, (item) => {
      const id = stringValue(item.id);
      if (!id) {
        return null;
      }
      return {
        id,
        qmlAnalogy: stringValue(item.qmlAnalogy) ?? "",
        summary: stringValue(item.summary) ?? "",
        status: stringValue(item.status) ?? "unknown",
      };
    }),
    hostObjects: normalizeList(source.hostObjects, (item) => {
      const id = stringValue(item.id);
      if (!id) {
        return null;
      }
      return {
        id,
        provider: stringValue(item.provider) ?? "",
        summary: stringValue(item.summary) ?? "",
        status: stringValue(item.status) ?? "unknown",
      };
    }),
    packages: normalizeList(source.packages, (item) => {
      const id = stringValue(item.id);
      const packageKind = stringValue(item.kind);
      if (!id || !packageKind) {
        return null;
      }
      return {
        id,
        kind: packageKind,
        title: stringValue(item.title) ?? id,
        summary: stringValue(item.summary) ?? "",
        packagePath: stringValue(item.packagePath) ?? "",
        entry: stringValue(item.entry) ?? "",
        metadata: stringValue(item.metadata) ?? "",
        imports: stringList(item.imports),
        surfaces: stringList(item.surfaces),
        hostModels: stringList(item.hostModels),
        actions: stringList(item.actions),
        permissions: stringList(item.permissions),
        configSchema: asObject(item.configSchema) ?? {},
      };
    }),
    milestones: normalizeList(source.milestones, (item) => {
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

export async function loadKainLatticeCatalog(args: Record<string, unknown> = {}): Promise<KainLatticeCatalogLoadResult> {
  try {
    const rawCatalog = await callKainTauronBridge<unknown, Record<string, unknown>>(
      "greeblefs.lattice",
      "catalog",
      args,
    );
    const catalog = normalizeKainLatticeCatalog(rawCatalog);
    return catalog
      ? { catalog, error: null }
      : { catalog: null, error: "Kain Lattice catalog response was empty or invalid." };
  } catch (error) {
    return {
      catalog: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
