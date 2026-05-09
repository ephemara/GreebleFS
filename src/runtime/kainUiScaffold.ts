import { callKainTauronBridge } from "./kainTauronBridge";

export type KainUiNodeScalar = string | number | boolean;

export interface KainUiNode {
  id: string;
  kind: string;
  title?: string;
  description?: string;
  text?: string;
  role?: string;
  label?: string;
  tone?: string;
  active?: boolean;
  actionId?: string;
  layout: Record<string, KainUiNodeScalar>;
  props: Record<string, unknown>;
  children: KainUiNode[];
}

export interface KainUiSurface {
  id: string;
  kind: string;
  title: string;
  summary: string;
  root: KainUiNode | null;
}

export interface KainUiPrimitive {
  kind: string;
  mapsTo: string;
  status: string;
}

export interface KainUiToken {
  id: string;
  category: string;
  value: string;
  mapsTo: string;
}

export interface KainUiAction {
  id: string;
  label: string;
  command: string;
  status: string;
}

export interface KainUiScaffold {
  schemaVersion: number;
  kind: string;
  source: string;
  stdlib: string;
  renderer: string;
  summary: string;
  surfaces: KainUiSurface[];
  primitives: KainUiPrimitive[];
  tokens: KainUiToken[];
  actions: KainUiAction[];
  consumers: string[];
}

export interface KainUiScaffoldLoadResult {
  scaffold: KainUiScaffold | null;
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

function booleanValue(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function scalarMap(value: unknown): Record<string, KainUiNodeScalar> {
  const source = asObject(value) ?? {};
  return Object.fromEntries(
    Object.entries(source).filter((entry): entry is [string, KainUiNodeScalar] => {
      const item = entry[1];
      return typeof item === "string" || typeof item === "number" || typeof item === "boolean";
    }),
  );
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

function normalizeUiNode(value: unknown): KainUiNode | null {
  const source = asObject(value);
  if (!source) {
    return null;
  }

  const id = stringValue(source.id);
  const kind = stringValue(source.kind);
  if (!id || !kind) {
    return null;
  }

  return {
    id,
    kind,
    title: stringValue(source.title),
    description: stringValue(source.description),
    text: stringValue(source.text),
    role: stringValue(source.role),
    label: stringValue(source.label),
    tone: stringValue(source.tone),
    active: booleanValue(source.active),
    actionId: stringValue(source.actionId),
    layout: scalarMap(source.layout),
    props: asObject(source.props) ?? {},
    children: Array.isArray(source.children)
      ? source.children.map(normalizeUiNode).filter((child): child is KainUiNode => Boolean(child))
      : [],
  };
}

export function normalizeKainUiScaffold(value: unknown): KainUiScaffold | null {
  const source = asObject(value);
  if (!source) {
    return null;
  }

  const schemaVersion = numberValue(source.schemaVersion) ?? 0;
  const kind = stringValue(source.kind);
  if (schemaVersion < 1 || kind !== "greeblefs.ui.scaffold") {
    return null;
  }

  return {
    schemaVersion,
    kind,
    source: stringValue(source.source) ?? "src-kain/app/main.kn",
    stdlib: stringValue(source.stdlib) ?? "src-kain/stdlib/greeblefs/ui.kn",
    renderer: stringValue(source.renderer) ?? "src/components/kain/KainUiRenderer.tsx",
    summary: stringValue(source.summary) ?? "",
    surfaces: normalizeList(source.surfaces, (item) => {
      const id = stringValue(item.id);
      const surfaceKind = stringValue(item.kind);
      if (!id || !surfaceKind) {
        return null;
      }
      return {
        id,
        kind: surfaceKind,
        title: stringValue(item.title) ?? id,
        summary: stringValue(item.summary) ?? "",
        root: normalizeUiNode(item.root),
      };
    }),
    primitives: normalizeList(source.primitives, (item) => {
      const primitiveKind = stringValue(item.kind);
      if (!primitiveKind) {
        return null;
      }
      return {
        kind: primitiveKind,
        mapsTo: stringValue(item.mapsTo) ?? "",
        status: stringValue(item.status) ?? "unknown",
      };
    }),
    tokens: normalizeList(source.tokens, (item) => {
      const id = stringValue(item.id);
      const category = stringValue(item.category);
      if (!id || !category) {
        return null;
      }
      return {
        id,
        category,
        value: stringValue(item.value) ?? "",
        mapsTo: stringValue(item.mapsTo) ?? "",
      };
    }),
    actions: normalizeList(source.actions, (item) => {
      const id = stringValue(item.id);
      const label = stringValue(item.label);
      if (!id || !label) {
        return null;
      }
      return {
        id,
        label,
        command: stringValue(item.command) ?? "",
        status: stringValue(item.status) ?? "unknown",
      };
    }),
    consumers: stringList(source.consumers),
  };
}

export async function loadKainUiScaffold(args: Record<string, unknown> = {}): Promise<KainUiScaffoldLoadResult> {
  try {
    const rawScaffold = await callKainTauronBridge<unknown, Record<string, unknown>>(
      "greeblefs.ui",
      "scaffold",
      args,
    );
    const scaffold = normalizeKainUiScaffold(rawScaffold);
    return scaffold
      ? { scaffold, error: null }
      : { scaffold: null, error: "Kain UI scaffold response was empty or invalid." };
  } catch (error) {
    return {
      scaffold: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
