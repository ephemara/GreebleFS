export type ExplorerPreviewWorkflowBaseMode = "preview" | "edit";

export type ExplorerPreviewWorkflowTabId = string;

export interface ExplorerPreviewWildcardWorkflowTab {
  id: ExplorerPreviewWorkflowTabId;
  label: string;
  baseMode: ExplorerPreviewWorkflowBaseMode;
}

export interface ExplorerPreviewWorkflowTab
  extends ExplorerPreviewWildcardWorkflowTab {
  kind: "preview" | "edit" | "wildcard";
}

export interface ExplorerPreviewWorkflowTabSetOptions {
  previewLabel?: string;
  editLabel?: string;
  includePreviewTab?: boolean;
  includeEditTab?: boolean;
  wildcardTabs?: readonly Partial<ExplorerPreviewWildcardWorkflowTab>[];
}

export type ExplorerPreviewWorkbenchTopBarDensity = "regular" | "compact";

export interface ExplorerPreviewWorkbenchChromeMetadata {
  includePreviewTab: boolean;
  includeEditTab: boolean;
  wildcardTabs: ExplorerPreviewWildcardWorkflowTab[];
  topBarLayoutId: string | null;
  topBarDensity: ExplorerPreviewWorkbenchTopBarDensity;
}

export interface ExplorerPreviewWorkbenchChromeMetadataInput {
  includePreviewTab?: boolean | null;
  includeEditTab?: boolean | null;
  wildcardTabs?: readonly Partial<ExplorerPreviewWildcardWorkflowTab>[] | null;
  topBarLayoutId?: string | null;
  topBarDensity?: string | null;
}

export interface ExplorerPreviewWorkbenchChromeDefaults {
  includePreviewTab?: boolean;
  includeEditTab?: boolean;
  wildcardTabs?: readonly Partial<ExplorerPreviewWildcardWorkflowTab>[];
  topBarLayoutId?: string | null;
  topBarDensity?: ExplorerPreviewWorkbenchTopBarDensity;
}

export const DEFAULT_EXPLORER_PREVIEW_WORKBENCH_CHROME_METADATA =
  Object.freeze({
    includePreviewTab: true,
    includeEditTab: false,
    wildcardTabs: [] as ExplorerPreviewWildcardWorkflowTab[],
    topBarLayoutId: null,
    topBarDensity: "regular" as const,
  }) satisfies ExplorerPreviewWorkbenchChromeMetadata;

function normalizeWorkflowTabId(id: unknown): ExplorerPreviewWorkflowTabId {
  return typeof id === "string" ? id.trim().toLowerCase() : "";
}

function normalizeWorkflowTabLabel(label: unknown): string {
  return typeof label === "string" ? label.trim() : "";
}

function normalizeWorkflowBaseMode(
  baseMode: unknown,
): ExplorerPreviewWorkflowBaseMode {
  return baseMode === "preview" ? "preview" : "edit";
}

function normalizeTopBarDensity(
  value: unknown,
  fallback: ExplorerPreviewWorkbenchTopBarDensity,
): ExplorerPreviewWorkbenchTopBarDensity {
  return value === "compact" || value === "regular" ? value : fallback;
}

export function normalizeExplorerPreviewWildcardWorkflowTabs(
  wildcardTabs:
    | readonly Partial<ExplorerPreviewWildcardWorkflowTab>[]
    | null
    | undefined,
): ExplorerPreviewWildcardWorkflowTab[] {
  if (!Array.isArray(wildcardTabs)) {
    return [];
  }

  const seenIds = new Set<ExplorerPreviewWorkflowTabId>(["preview", "edit"]);
  const normalized: ExplorerPreviewWildcardWorkflowTab[] = [];

  for (const tab of wildcardTabs) {
    const nextId = normalizeWorkflowTabId(tab.id);
    const nextLabel = normalizeWorkflowTabLabel(tab.label);
    if (!nextId || !nextLabel || seenIds.has(nextId)) {
      continue;
    }
    seenIds.add(nextId);
    normalized.push({
      id: nextId,
      label: nextLabel,
      baseMode: normalizeWorkflowBaseMode(tab.baseMode),
    });
  }

  return normalized;
}

export function mergeExplorerPreviewWildcardWorkflowTabs(
  ...tabSources: Array<
    readonly Partial<ExplorerPreviewWildcardWorkflowTab>[] | null | undefined
  >
): ExplorerPreviewWildcardWorkflowTab[] {
  const mergedTabs = new Map<
    ExplorerPreviewWorkflowTabId,
    ExplorerPreviewWildcardWorkflowTab
  >();

  for (const tabSource of tabSources) {
    for (const tab of normalizeExplorerPreviewWildcardWorkflowTabs(tabSource)) {
      mergedTabs.set(tab.id, tab);
    }
  }

  return [...mergedTabs.values()];
}

export function normalizeExplorerPreviewWorkbenchChromeMetadata(
  value: ExplorerPreviewWorkbenchChromeMetadataInput | null | undefined,
  defaults: ExplorerPreviewWorkbenchChromeDefaults = {},
): ExplorerPreviewWorkbenchChromeMetadata {
  const fallback = {
    ...DEFAULT_EXPLORER_PREVIEW_WORKBENCH_CHROME_METADATA,
    ...defaults,
  };
  const topBarLayoutId =
    typeof value?.topBarLayoutId === "string" && value.topBarLayoutId.trim()
      ? value.topBarLayoutId.trim()
      : fallback.topBarLayoutId ?? null;

  return {
    includePreviewTab:
      typeof value?.includePreviewTab === "boolean"
        ? value.includePreviewTab
        : fallback.includePreviewTab,
    includeEditTab:
      typeof value?.includeEditTab === "boolean"
        ? value.includeEditTab
        : fallback.includeEditTab,
    wildcardTabs: normalizeExplorerPreviewWildcardWorkflowTabs(
      value?.wildcardTabs ?? fallback.wildcardTabs,
    ),
    topBarLayoutId,
    topBarDensity: normalizeTopBarDensity(
      value?.topBarDensity,
      fallback.topBarDensity,
    ),
  };
}

function toWorkflowTab(
  tab: ExplorerPreviewWildcardWorkflowTab,
): ExplorerPreviewWorkflowTab {
  return {
    ...tab,
    kind: "wildcard",
  };
}

export function buildExplorerPreviewWorkflowTabs({
  previewLabel = "Preview",
  editLabel = "Edit",
  includePreviewTab = true,
  includeEditTab = true,
  wildcardTabs = [],
}: ExplorerPreviewWorkflowTabSetOptions = {}): ExplorerPreviewWorkflowTab[] {
  return [
    ...(includePreviewTab
      ? [
          {
            id: "preview",
            label: previewLabel,
            baseMode: "preview",
            kind: "preview",
          } satisfies ExplorerPreviewWorkflowTab,
        ]
      : []),
    ...(includeEditTab
      ? [
          {
            id: "edit",
            label: editLabel,
            baseMode: "edit",
            kind: "edit",
          } satisfies ExplorerPreviewWorkflowTab,
        ]
      : []),
    ...normalizeExplorerPreviewWildcardWorkflowTabs(wildcardTabs).map(
      toWorkflowTab,
    ),
  ];
}

export function resolveExplorerPreviewWorkflowActiveTab(
  tabs: readonly ExplorerPreviewWorkflowTab[],
  activeTabId: ExplorerPreviewWorkflowTabId | null | undefined,
): ExplorerPreviewWorkflowTab {
  const fallbackTab =
    tabs[0] ??
    ({
      id: "preview",
      label: "Preview",
      baseMode: "preview",
      kind: "preview",
    } satisfies ExplorerPreviewWorkflowTab);

  if (!activeTabId) {
    return fallbackTab;
  }

  const normalizedActiveTabId = normalizeWorkflowTabId(activeTabId);
  return (
    tabs.find((tab) => tab.id === normalizedActiveTabId) ?? fallbackTab
  );
}
