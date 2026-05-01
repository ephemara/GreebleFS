import {
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";

import { Search } from "@/components/AppIcons";

import type { ResolvedOverlayAppearance } from "../../config/appearance";
import type { ExplorerMenuContextKind } from "../../config/explorerContextMenu";
import type {
  ExplorerCustomizeCatalogCategory,
  ExplorerCustomizeCatalogEntry,
} from "../../config/explorerCustomizeCatalog";
import { toExplorerActionChromeControlId } from "../../config/explorerCustomizeCatalog";
import type {
  ExplorerChromeControlId,
  ExplorerChromeOverrideEntry,
  ExplorerChromeSizeVariant,
} from "../../config/explorerChromeLayouts";
import { formatHotkeyLabel } from "../../config/hotkeys";
import { OverlayScrollArea } from "../OverlayScrollArea";
import { WorkbenchDisclosureGroup } from "../WorkbenchDisclosureGroup";
import {
  buildExplorerCommandSearchHaystack,
  renderExplorerCommandLibraryIcon,
  resolveExplorerCommandSourceLabel,
} from "./explorerCommandLibrary";
import type {
  ExplorerRuntimeMenuCommandNode,
  ExplorerRuntimeMenuNode,
} from "./explorerMenuRuntime";

const categoryLabels: Record<ExplorerCustomizeCatalogCategory, string> = {
  navigation: "Navigation",
  search: "Search",
  selection: "Selection",
  creation: "Creation",
  layout: "Layout",
  actions: "Actions",
  preview: "Preview",
  workspace: "Workspace",
  rail: "Rail",
  status: "Status",
  tasks: "Tasks",
  "authored-actions": "Authored Actions",
  other: "Other",
};

export interface ExplorerActionsPaneRuntimeScopeOption {
  id: string;
  label: string;
  contextKind: ExplorerMenuContextKind;
  summary: string;
  commandCount: number;
}

interface ExplorerActionsPaneProps {
  accent: string;
  appearance?: ResolvedOverlayAppearance;
  border: string;
  commandBinding: string;
  customizeMode: boolean;
  catalog: ExplorerCustomizeCatalogEntry[];
  muted: string;
  pendingHotkeyPrompt: string | null;
  runtimeActiveContextKind: ExplorerMenuContextKind;
  runtimeActiveScopeId: string | null;
  runtimeContextLabel: string;
  runtimeContextSummary: string;
  runtimeMenuNodes: ExplorerRuntimeMenuNode[];
  runtimeScopeOptions: ExplorerActionsPaneRuntimeScopeOption[];
  selectedEntry: ExplorerCustomizeCatalogEntry | null;
  selectedPlacement: ExplorerChromeOverrideEntry | null;
  text: string;
  onBeginCatalogDrag: (
    controlId: ExplorerChromeControlId,
    event: ReactPointerEvent<HTMLElement>,
    options?: {
      onTap?: (controlId: ExplorerChromeControlId) => void;
    },
  ) => void;
  onClose: () => void;
  onOpenRuntimeMenuComposer: (contextKind: ExplorerMenuContextKind) => void;
  onRequestHotkeyCapture: (controlId: ExplorerChromeControlId) => void;
  onSelectControl: (controlId: ExplorerChromeControlId | null) => void;
  onSelectRuntimeScope: (scopeId: string) => void;
  onSetSelectedShowIcon: (value: boolean) => void;
  onSetSelectedShowLabel: (value: boolean) => void;
  onSetSelectedSizeVariant: (variant: ExplorerChromeSizeVariant) => void;
  onSetSelectedWidthPx: (widthPx: number) => void;
}

interface ExplorerActionsPaneRuntimeItem {
  id: string;
  label: string;
  description?: string;
  command: ExplorerRuntimeMenuCommandNode["command"];
  disabled: boolean;
  dragControlId: ExplorerChromeControlId | null;
  menuPathLabel: string | null;
  node: ExplorerRuntimeMenuCommandNode;
  shortcutId?: string;
  sourceLabel: string;
}

interface ExplorerActionsPaneRuntimeSection {
  key: string;
  label: string;
  items: ExplorerActionsPaneRuntimeItem[];
}

function groupCatalogEntriesByCategory(
  entries: ExplorerCustomizeCatalogEntry[],
): Array<[ExplorerCustomizeCatalogCategory, ExplorerCustomizeCatalogEntry[]]> {
  const groups = new Map<
    ExplorerCustomizeCatalogCategory,
    ExplorerCustomizeCatalogEntry[]
  >();
  for (const entry of entries) {
    const currentEntries = groups.get(entry.category) ?? [];
    currentEntries.push(entry);
    groups.set(entry.category, currentEntries);
  }
  return Array.from(groups.entries());
}

function toRuntimeSectionItem(
  node: ExplorerRuntimeMenuCommandNode,
  menuPath: string[],
): ExplorerActionsPaneRuntimeItem {
  const dragControlId =
    node.command.source === "action"
      ? toExplorerActionChromeControlId(node.command.execution.action.id)
      : null;

  return {
    id: node.id,
    label: node.label,
    description: node.description,
    command: node.command,
    disabled: node.disabled,
    dragControlId,
    menuPathLabel: menuPath.length > 1 ? menuPath.slice(1).join(" / ") : null,
    node,
    shortcutId: node.shortcutId ?? undefined,
    sourceLabel: resolveExplorerCommandSourceLabel(node.command),
  };
}

function collectRuntimeSectionItems(
  nodes: ExplorerRuntimeMenuNode[],
  menuPath: string[],
): ExplorerActionsPaneRuntimeItem[] {
  const items: ExplorerActionsPaneRuntimeItem[] = [];
  for (const node of nodes) {
    if (node.kind === "command") {
      items.push(toRuntimeSectionItem(node, menuPath));
      continue;
    }
    if (node.kind === "submenu") {
      items.push(
        ...collectRuntimeSectionItems(node.children, [...menuPath, node.label]),
      );
    }
  }
  return items;
}

function buildRuntimeSections(
  nodes: ExplorerRuntimeMenuNode[],
): ExplorerActionsPaneRuntimeSection[] {
  const sections: ExplorerActionsPaneRuntimeSection[] = [];
  const quickAccessItems = nodes
    .filter(
      (node): node is ExplorerRuntimeMenuCommandNode => node.kind === "command",
    )
    .map((node) => toRuntimeSectionItem(node, []));

  if (quickAccessItems.length > 0) {
    sections.push({
      key: "quick-access",
      label: "Quick Access",
      items: quickAccessItems,
    });
  }

  nodes.forEach((node) => {
    if (node.kind !== "submenu") {
      return;
    }
    const items = collectRuntimeSectionItems(node.children, [node.label]);
    if (items.length === 0) {
      return;
    }
    sections.push({
      key: node.id,
      label: node.label,
      items,
    });
  });

  return sections;
}

export function ExplorerActionsPane({
  accent,
  appearance,
  border,
  commandBinding,
  customizeMode,
  catalog,
  muted,
  pendingHotkeyPrompt,
  runtimeActiveContextKind,
  runtimeActiveScopeId,
  runtimeContextLabel,
  runtimeContextSummary,
  runtimeMenuNodes,
  runtimeScopeOptions,
  selectedEntry,
  selectedPlacement,
  text,
  onBeginCatalogDrag,
  onClose,
  onOpenRuntimeMenuComposer,
  onRequestHotkeyCapture,
  onSelectControl,
  onSelectRuntimeScope,
  onSetSelectedShowIcon,
  onSetSelectedShowLabel,
  onSetSelectedSizeVariant,
  onSetSelectedWidthPx,
}: ExplorerActionsPaneProps) {
  const [query, setQuery] = useState("");
  const [collapsedRuntimeSectionsByKey, setCollapsedRuntimeSectionsByKey] =
    useState<Record<string, boolean>>({});
  const actionPointerTapControlIdRef = useRef<ExplorerChromeControlId | null>(
    null,
  );
  const filteredCatalog = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const sourceEntries = customizeMode
      ? catalog
      : catalog.filter((entry) => entry.source !== "built-in");
    if (!normalizedQuery) {
      return sourceEntries;
    }

    return sourceEntries.filter((entry) => {
      const haystack = [
        entry.label,
        entry.description,
        entry.category,
        entry.controlId,
        entry.action?.packName,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [catalog, customizeMode, query]);
  const groupedCatalog = useMemo(
    () => groupCatalogEntriesByCategory(filteredCatalog),
    [filteredCatalog],
  );
  const runtimeSections = useMemo(
    () => buildRuntimeSections(runtimeMenuNodes),
    [runtimeMenuNodes],
  );
  const filteredRuntimeSections = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      return runtimeSections;
    }

    return runtimeSections
      .map((section) => ({
        ...section,
        items: section.items.filter((item) =>
          [
            item.label,
            item.description ?? "",
            item.sourceLabel,
            item.menuPathLabel ?? "",
            item.shortcutId ?? "",
            buildExplorerCommandSearchHaystack(item.command),
          ]
            .join(" ")
            .toLowerCase()
            .includes(normalizedQuery),
        ),
      }))
      .filter((section) => section.items.length > 0);
  }, [query, runtimeSections]);
  const forceExpandRuntimeSections = query.trim().length > 0;
  const panelTextStyle = {
    color: text,
    fontFamily:
      appearance?.fonts.ui ??
      'var(--overlay-font-body, "Segoe UI", sans-serif)',
  };

  const resolveEntryTone = (entry: ExplorerCustomizeCatalogEntry) => {
    if (entry.source === "action") {
      return accent;
    }
    if (entry.source === "missing-action") {
      return "var(--overlay-danger)";
    }
    return "color-mix(in srgb, var(--overlay-explorer-text) 74%, transparent)";
  };

  const invokeRuntimeItem = (item: ExplorerActionsPaneRuntimeItem) => {
    if (item.disabled) {
      return;
    }
    if (item.dragControlId) {
      onSelectControl(item.dragControlId);
    }
    void Promise.resolve(item.node.onSelect());
  };

  return (
    <div
      data-overlay-explorer-plane="actions"
      style={{
        ...panelTextStyle,
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
        height: "100%",
        border: "1px solid var(--overlay-explorer-toolbar-border)",
        borderRadius: "var(--overlay-explorer-panel-radius)",
        background:
          "color-mix(in srgb, var(--overlay-explorer-preview-bg) 94%, black 6%)",
        boxShadow: "var(--overlay-explorer-toolbar-shadow)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 12,
          padding: "12px 14px 10px",
          borderBottom: "1px solid var(--overlay-explorer-toolbar-border)",
          background:
            "color-mix(in srgb, var(--overlay-explorer-toolbar-bg) 86%, black 14%)",
          flexShrink: 0,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: muted,
            }}
          >
            {customizeMode ? "Explorer Customize" : "Action Library"}
          </div>
          <div
            style={{
              marginTop: 4,
              fontSize: 12,
              fontWeight: 700,
              color: text,
            }}
          >
            {customizeMode ? "All In Actions" : runtimeContextLabel}
          </div>
          <div
            title={customizeMode ? undefined : runtimeContextSummary}
            style={{
              marginTop: 5,
              fontSize: 10,
              color: muted,
              lineHeight: 1.45,
              maxWidth: 280,
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {customizeMode
              ? "Drag controls out of this pane and drop them into any explorer chrome band. Ctrl+Alt+click any supported control to bind a hotkey."
              : runtimeContextSummary}
          </div>
          {!customizeMode ? (
            <div
              style={{
                marginTop: 6,
                fontSize: 10,
                color: muted,
                lineHeight: 1.45,
                maxWidth: 280,
              }}
            >
              Run commands against the current explorer scope. Authored actions
              can still be dragged into chrome to pin them as buttons.
            </div>
          ) : null}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {customizeMode ? (
            <span
              style={{
                borderRadius: 999,
                border: `1px solid ${accent}55`,
                background: `color-mix(in srgb, ${accent} 14%, transparent)`,
                color: text,
                padding: "5px 8px",
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
              }}
            >
              Customize On
            </span>
          ) : (
            <button
              type="button"
              onClick={() => onOpenRuntimeMenuComposer(runtimeActiveContextKind)}
              style={{
                borderRadius: 10,
                border: `1px solid ${accent}55`,
                background: `color-mix(in srgb, ${accent} 10%, transparent)`,
                color: text,
                padding: "6px 9px",
                cursor: "pointer",
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
              }}
            >
              Edit Menu
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            style={{
              borderRadius: 10,
              border: `1px solid ${border}`,
              background: "var(--overlay-explorer-chip-bg)",
              color: text,
              padding: "6px 9px",
              cursor: "pointer",
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          >
            {customizeMode ? "Done" : "Close"}
          </button>
        </div>
      </div>

      <div
        style={{
          padding: "10px 12px 12px",
          borderBottom: "1px solid var(--overlay-explorer-toolbar-border)",
          flexShrink: 0,
        }}
      >
        <div style={{ position: "relative" }}>
          <Search
            size={13}
            style={{
              position: "absolute",
              top: "50%",
              left: 12,
              transform: "translateY(-50%)",
              color: muted,
              pointerEvents: "none",
            }}
          />
          <input
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
            placeholder={
              customizeMode
                ? "Browse commands and controls..."
                : "Search commands, actions, and menu paths..."
            }
            style={{
              width: "100%",
              borderRadius: 12,
              border: "1px solid var(--overlay-explorer-chip-border)",
              background: "var(--overlay-explorer-chip-bg)",
              color: text,
              padding: "10px 12px 10px 34px",
              fontSize: 11,
              outline: "none",
            }}
          />
        </div>
        {!customizeMode && runtimeScopeOptions.length > 0 ? (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 8,
              marginTop: 10,
            }}
          >
            {runtimeScopeOptions.map((scope) => {
              const isActive = runtimeActiveScopeId === scope.id;
              return (
                <button
                  key={scope.id}
                  type="button"
                  onClick={() => onSelectRuntimeScope(scope.id)}
                  aria-pressed={isActive}
                  title={scope.summary}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    borderRadius: 999,
                    border: isActive
                      ? `1px solid ${accent}88`
                      : "1px solid var(--overlay-explorer-chip-border)",
                    background: isActive
                      ? `color-mix(in srgb, ${accent} 12%, transparent)`
                      : "var(--overlay-explorer-chip-bg)",
                    color: text,
                    padding: "6px 9px",
                    cursor: "pointer",
                    fontSize: 10,
                    fontWeight: 700,
                  }}
                >
                  <span>{scope.label}</span>
                  <span
                    style={{
                      color: muted,
                      fontSize: 9,
                      fontWeight: 800,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                    }}
                  >
                    {scope.commandCount}
                  </span>
                </button>
              );
            })}
          </div>
        ) : null}
        {pendingHotkeyPrompt ? (
          <div
            style={{
              marginTop: 10,
              borderRadius: 12,
              border: `1px solid ${accent}66`,
              background: `color-mix(in srgb, ${accent} 12%, transparent)`,
              padding: "9px 11px",
              fontSize: 11,
              color: text,
            }}
          >
            {pendingHotkeyPrompt}
          </div>
        ) : null}
      </div>

      <OverlayScrollArea style={{ flex: 1, minHeight: 0 }}>
        <div
          style={{
            padding: 12,
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
        >
          {customizeMode ? (
            groupedCatalog.map(([category, entries]) => (
              <section
                key={category}
                style={{ display: "flex", flexDirection: "column", gap: 8 }}
              >
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 800,
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    color: muted,
                  }}
                >
                  {categoryLabels[category]}
                </div>
                <div style={{ display: "grid", gap: 8 }}>
                  {entries.map((entry) => {
                    const isSelected = entry.controlId === selectedEntry?.controlId;
                    const entryTone = resolveEntryTone(entry);
                    return (
                      <button
                        key={entry.controlId}
                        type="button"
                        onPointerDown={(event) => {
                          if (
                            !customizeMode ||
                            event.button !== 0 ||
                            event.ctrlKey ||
                            event.altKey
                          ) {
                            return;
                          }
                          onBeginCatalogDrag(entry.controlId, event);
                        }}
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          if (event.ctrlKey && event.altKey) {
                            onRequestHotkeyCapture(entry.controlId);
                            onSelectControl(entry.controlId);
                            return;
                          }
                          onSelectControl(entry.controlId);
                        }}
                        style={{
                          borderRadius: 12,
                          border: isSelected
                            ? `1px solid ${accent}88`
                            : "1px solid var(--overlay-explorer-chip-border)",
                          background: isSelected
                            ? `color-mix(in srgb, ${accent} 10%, transparent)`
                            : "var(--overlay-explorer-chip-bg)",
                          color: text,
                          padding: "8px 10px",
                          cursor: "grab",
                          textAlign: "left",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 8,
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 8,
                              minWidth: 0,
                            }}
                          >
                            <span
                              aria-hidden
                              style={{
                                width: 8,
                                height: 8,
                                borderRadius: 999,
                                flexShrink: 0,
                                background: entryTone,
                              }}
                            />
                            <div style={{ minWidth: 0 }}>
                              <div
                                style={{
                                  fontSize: 11,
                                  fontWeight: 700,
                                  color: text,
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {entry.label}
                              </div>
                              <div
                                style={{
                                  marginTop: 3,
                                  fontSize: 10,
                                  color: muted,
                                  lineHeight: 1.35,
                                }}
                              >
                                {entry.description}
                              </div>
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>
            ))
          ) : filteredRuntimeSections.length === 0 ? (
            <div
              style={{
                borderRadius: 12,
                border: "1px solid var(--overlay-explorer-chip-border)",
                background: "var(--overlay-explorer-chip-bg)",
                padding: "12px 14px",
                color: muted,
                fontSize: 11,
                lineHeight: 1.55,
              }}
            >
              {query.trim().length > 0
                ? "No commands match the current filter."
                : "This scope does not currently expose any menu commands. Edit the menu or switch to another explorer scope."}
            </div>
          ) : (
            filteredRuntimeSections.map((section) => (
              <WorkbenchDisclosureGroup
                key={section.key}
                label={section.label}
                count={section.items.length}
                ariaLabel={`${section.label} action library section`}
                collapsed={Boolean(collapsedRuntimeSectionsByKey[section.key])}
                onToggleCollapsed={() =>
                  setCollapsedRuntimeSectionsByKey((current) => ({
                    ...current,
                    [section.key]: !current[section.key],
                  }))
                }
                variant="panel"
                forceExpanded={forceExpandRuntimeSections}
                textColor={text}
                mutedColor={muted}
                borderColor={`${border}8a`}
                background="rgba(255,255,255,0.014)"
              >
                <div>
                  {section.items.map((item, index) => (
                    <button
                      key={item.id}
                      type="button"
                      aria-disabled={item.disabled}
                      onPointerDown={(event) => {
                        if (
                          event.button !== 0 ||
                          event.ctrlKey ||
                          event.altKey ||
                          !item.dragControlId
                        ) {
                          return;
                        }
                        actionPointerTapControlIdRef.current =
                          item.dragControlId;
                        onBeginCatalogDrag(item.dragControlId, event, {
                          onTap: () => invokeRuntimeItem(item),
                        });
                      }}
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        if (
                          item.dragControlId &&
                          actionPointerTapControlIdRef.current ===
                            item.dragControlId
                        ) {
                          actionPointerTapControlIdRef.current = null;
                          return;
                        }
                        if (event.ctrlKey && event.altKey && item.dragControlId) {
                          onRequestHotkeyCapture(item.dragControlId);
                          onSelectControl(item.dragControlId);
                          return;
                        }
                        invokeRuntimeItem(item);
                      }}
                      style={{
                        width: "100%",
                        border: 0,
                        borderTop:
                          index === 0
                            ? "none"
                            : "1px solid color-mix(in srgb, var(--overlay-explorer-chip-border) 92%, transparent)",
                        background: "transparent",
                        color: item.disabled ? muted : text,
                        cursor: item.dragControlId
                          ? "grab"
                          : item.disabled
                            ? "not-allowed"
                            : "pointer",
                        textAlign: "left",
                        padding: "10px 12px",
                        opacity: item.disabled ? 0.68 : 1,
                      }}
                    >
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "16px minmax(0, 1fr) auto",
                          alignItems: "start",
                          gap: 10,
                        }}
                      >
                        <span style={{ opacity: 0.78 }}>
                          {renderExplorerCommandLibraryIcon(
                            item.command.iconName,
                          )}
                        </span>
                        <span style={{ minWidth: 0 }}>
                          <span
                            style={{
                              display: "block",
                              fontSize: 11,
                              fontWeight: 700,
                              color: text,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {item.label}
                          </span>
                          {item.description ? (
                            <span
                              style={{
                                display: "block",
                                marginTop: 3,
                                fontSize: 10,
                                lineHeight: 1.35,
                                color: muted,
                              }}
                            >
                              {item.description}
                            </span>
                          ) : null}
                          <span
                            style={{
                              display: "flex",
                              flexWrap: "wrap",
                              gap: 8,
                              marginTop: 6,
                              fontSize: 9,
                              fontWeight: 700,
                              letterSpacing: "0.08em",
                              textTransform: "uppercase",
                              color: muted,
                            }}
                          >
                            <span>{item.sourceLabel}</span>
                            {item.menuPathLabel ? (
                              <span>{item.menuPathLabel}</span>
                            ) : null}
                            {item.dragControlId ? (
                              <span style={{ color: accent }}>Run or Drag</span>
                            ) : null}
                          </span>
                        </span>
                        <span
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "flex-end",
                            gap: 4,
                            fontSize: 9,
                            fontWeight: 700,
                            letterSpacing: "0.08em",
                            textTransform: "uppercase",
                            color: item.dragControlId ? accent : muted,
                          }}
                        >
                          {item.shortcutId ? <span>{item.shortcutId}</span> : null}
                          {item.dragControlId ? <span>Pin</span> : <span>Run</span>}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </WorkbenchDisclosureGroup>
            ))
          )}

          {customizeMode ? (
            <section
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 10,
                paddingTop: 4,
                borderTop: "1px solid var(--overlay-explorer-toolbar-border)",
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  color: muted,
                }}
              >
                Inspector
              </div>
              {selectedEntry ? (
                <>
                  <div>
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: text,
                      }}
                    >
                      {selectedEntry.label}
                    </div>
                    <div
                      style={{
                        marginTop: 4,
                        fontSize: 10,
                        color: muted,
                        lineHeight: 1.45,
                      }}
                    >
                      {selectedEntry.description}
                    </div>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 12,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                        color: muted,
                      }}
                    >
                      Hotkey
                    </span>
                    <span style={{ fontSize: 11, color: text }}>
                      {formatHotkeyLabel(commandBinding)}
                    </span>
                  </div>
                  {selectedEntry.supportsSizeVariant ? (
                    <label
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 6,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          letterSpacing: "0.08em",
                          textTransform: "uppercase",
                          color: muted,
                        }}
                      >
                        Size
                      </span>
                      <select
                        value={selectedPlacement?.sizeVariant ?? "regular"}
                        onChange={(event) =>
                          onSetSelectedSizeVariant(
                            event.currentTarget
                              .value as ExplorerChromeSizeVariant,
                          )
                        }
                        style={{
                          borderRadius: 10,
                          border:
                            "1px solid var(--overlay-explorer-chip-border)",
                          background: "var(--overlay-explorer-chip-bg)",
                          color: text,
                          padding: "8px 10px",
                          fontSize: 11,
                        }}
                      >
                        {selectedEntry.sizeVariants.map((variant) => (
                          <option key={variant} value={variant}>
                            {variant}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}
                  {selectedEntry.supportsWidthPx ? (
                    <label
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 6,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          letterSpacing: "0.08em",
                          textTransform: "uppercase",
                          color: muted,
                        }}
                      >
                        Width ·{" "}
                        {Math.round(
                          selectedPlacement?.widthPx ??
                            selectedEntry.defaultWidthPx ??
                            selectedEntry.minWidthPx ??
                            160,
                        )}
                        px
                      </span>
                      <input
                        type="range"
                        min={selectedEntry.minWidthPx ?? 96}
                        max={selectedEntry.maxWidthPx ?? 1600}
                        step={1}
                        value={
                          selectedPlacement?.widthPx ??
                          selectedEntry.defaultWidthPx ??
                          selectedEntry.minWidthPx ??
                          160
                        }
                        onChange={(event) =>
                          onSetSelectedWidthPx(
                            Number(event.currentTarget.value),
                          )
                        }
                        style={{ accentColor: accent }}
                      />
                    </label>
                  ) : null}
                  {selectedEntry.supportsLabelVisibility ? (
                    <label
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 12,
                        fontSize: 11,
                        color: text,
                      }}
                    >
                      <span>Show label</span>
                      <input
                        type="checkbox"
                        checked={selectedPlacement?.showLabel ?? true}
                        onChange={(event) =>
                          onSetSelectedShowLabel(event.currentTarget.checked)
                        }
                      />
                    </label>
                  ) : null}
                  {selectedEntry.supportsIconVisibility ? (
                    <label
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 12,
                        fontSize: 11,
                        color: text,
                      }}
                    >
                      <span>Show icon</span>
                      <input
                        type="checkbox"
                        checked={selectedPlacement?.showIcon ?? true}
                        onChange={(event) =>
                          onSetSelectedShowIcon(event.currentTarget.checked)
                        }
                      />
                    </label>
                  ) : null}
                </>
              ) : (
                <div
                  style={{
                    fontSize: 11,
                    color: muted,
                    lineHeight: 1.5,
                  }}
                >
                  Select a placed control or a browser item to inspect it.
                </div>
              )}
            </section>
          ) : null}
        </div>
      </OverlayScrollArea>
    </div>
  );
}
