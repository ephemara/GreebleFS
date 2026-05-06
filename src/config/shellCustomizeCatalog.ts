import shippedShellCustomizeControlManifestJson from "../../usr/profiles/default/shell-customize-controls/greeblefs-core/shell-customize-control.json";

export type ShellCustomizeCatalogCategory =
  | "layout"
  | "window"
  | "dock"
  | "navigation"
  | "launcher"
  | "mode"
  | "other";

export type ShellCustomizeBandId = "leading" | "navigation" | "trailing";

export interface ShellCustomizeCatalogEntry {
  controlId: string;
  commandId: string;
  label: string;
  description: string;
  category: ShellCustomizeCatalogCategory;
  bands: ShellCustomizeBandId[];
  supportsRemoval: boolean;
  tags: string[];
}

interface ShippedShellCustomizeControlManifest {
  controls?: ShellCustomizeCatalogEntry[];
}

function normalizeShellCustomizeBands(
  value: unknown,
): ShellCustomizeBandId[] {
  if (!Array.isArray(value)) {
    return ["trailing"];
  }

  const normalized = value.filter(
    (entry): entry is ShellCustomizeBandId =>
      entry === "leading" || entry === "navigation" || entry === "trailing",
  );

  return normalized.length > 0 ? normalized : ["trailing"];
}

function normalizeShellCustomizeTags(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .filter((entry): entry is string => typeof entry === "string")
        .map((entry) => entry.trim())
        .filter(Boolean),
    ),
  );
}

function cloneShellCustomizeCatalogEntry(
  entry: ShellCustomizeCatalogEntry,
): ShellCustomizeCatalogEntry {
  return {
    ...entry,
    bands: [...entry.bands],
    tags: [...entry.tags],
  };
}

function normalizeShellCustomizeCatalogEntry(
  value: unknown,
): ShellCustomizeCatalogEntry | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const source = value as Record<string, unknown>;
  const controlId =
    typeof source.controlId === "string" ? source.controlId.trim() : "";
  const commandId =
    typeof source.commandId === "string" ? source.commandId.trim() : "";
  const label = typeof source.label === "string" ? source.label.trim() : "";

  if (!controlId || !commandId || !label) {
    return null;
  }

  return {
    controlId,
    commandId,
    label,
    description:
      typeof source.description === "string" && source.description.trim().length > 0
        ? source.description.trim()
        : `${label} shell control`,
    category:
      source.category === "layout" ||
      source.category === "window" ||
      source.category === "dock" ||
      source.category === "navigation" ||
      source.category === "launcher" ||
      source.category === "mode" ||
      source.category === "other"
        ? source.category
        : "other",
    bands: normalizeShellCustomizeBands(source.bands),
    supportsRemoval: source.supportsRemoval !== false,
    tags: normalizeShellCustomizeTags(source.tags),
  };
}

let builtInShellCustomizeCatalogEntries: ShellCustomizeCatalogEntry[] = [];

export function applyUsrShellCustomizeControlManifest(
  manifest: ShippedShellCustomizeControlManifest | null | undefined,
): void {
  builtInShellCustomizeCatalogEntries = Array.isArray(manifest?.controls)
    ? manifest.controls
        .map(normalizeShellCustomizeCatalogEntry)
        .filter((entry): entry is ShellCustomizeCatalogEntry => entry != null)
    : [];
}

applyUsrShellCustomizeControlManifest(
  shippedShellCustomizeControlManifestJson as ShippedShellCustomizeControlManifest,
);

export function getBuiltInShellCustomizeCatalog(): ShellCustomizeCatalogEntry[] {
  return builtInShellCustomizeCatalogEntries.map(
    cloneShellCustomizeCatalogEntry,
  );
}

export function getShellCustomizeControlIds(): string[] {
  return getBuiltInShellCustomizeCatalog().map((entry) => entry.controlId);
}

export function resolveShellCustomizeCatalogEntry(
  controlId: string | null | undefined,
): ShellCustomizeCatalogEntry | null {
  if (!controlId) {
    return null;
  }

  return (
    builtInShellCustomizeCatalogEntries.find(
      (entry) => entry.controlId === controlId,
    ) ?? null
  );
}

export function getShellCustomizeControlLabel(
  controlId: string | null | undefined,
): string | null {
  return resolveShellCustomizeCatalogEntry(controlId)?.label ?? null;
}
