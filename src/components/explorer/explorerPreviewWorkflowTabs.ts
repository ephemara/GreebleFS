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
  includeEditTab?: boolean;
  wildcardTabs?: readonly ExplorerPreviewWildcardWorkflowTab[];
}

function normalizeWildcardTabs(
  wildcardTabs: readonly ExplorerPreviewWildcardWorkflowTab[],
): ExplorerPreviewWorkflowTab[] {
  const seenIds = new Set<ExplorerPreviewWorkflowTabId>(["preview", "edit"]);
  const normalized: ExplorerPreviewWorkflowTab[] = [];

  for (const tab of wildcardTabs) {
    const nextId = tab.id.trim();
    const nextLabel = tab.label.trim();
    if (!nextId || !nextLabel || seenIds.has(nextId)) {
      continue;
    }
    seenIds.add(nextId);
    normalized.push({
      ...tab,
      id: nextId,
      label: nextLabel,
      kind: "wildcard",
    });
  }

  return normalized;
}

export function buildExplorerPreviewWorkflowTabs({
  previewLabel = "Preview",
  editLabel = "Edit",
  includeEditTab = true,
  wildcardTabs = [],
}: ExplorerPreviewWorkflowTabSetOptions = {}): ExplorerPreviewWorkflowTab[] {
  return [
    {
      id: "preview",
      label: previewLabel,
      baseMode: "preview",
      kind: "preview",
    },
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
    ...normalizeWildcardTabs(wildcardTabs),
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

  return tabs.find((tab) => tab.id === activeTabId) ?? fallbackTab;
}
