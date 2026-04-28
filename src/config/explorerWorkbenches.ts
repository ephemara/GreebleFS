export type ExplorerWorkbenchResolutionSource =
  | "user-default"
  | "priority"
  | "discovery-order";

export type ExplorerPreferredWorkbenchByExtension = Record<string, string>;

export function normalizeWorkbenchExtensionKey(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().replace(/^\./, "").toLowerCase();
  return normalized.length > 0 ? normalized : null;
}

export function normalizePreferredWorkbenchId(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

export function normalizePreferredWorkbenchByExtensionMap(
  value: unknown,
): ExplorerPreferredWorkbenchByExtension {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const entries = Object.entries(value as Record<string, unknown>)
    .map(([extension, workbenchId]) => {
      const normalizedExtension = normalizeWorkbenchExtensionKey(extension);
      const normalizedWorkbenchId =
        normalizePreferredWorkbenchId(workbenchId);
      if (!normalizedExtension || !normalizedWorkbenchId) {
        return null;
      }
      return [normalizedExtension, normalizedWorkbenchId] as const;
    })
    .filter(
      (
        entry,
      ): entry is readonly [string, string] => entry != null,
    );

  return Object.fromEntries(entries);
}

export function formatWorkbenchExtensionLabel(extension: string): string {
  const normalizedExtension = normalizeWorkbenchExtensionKey(extension);
  return normalizedExtension ? `.${normalizedExtension}` : "this file type";
}
