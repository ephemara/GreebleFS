import {
  useEffect,
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
import {
  buildExplorerCommandSearchHaystack,
  renderExplorerCommandLibraryIcon,
  resolveExplorerCommandSourceLabel,
} from "./explorerCommandLibrary";
import { resolveExplorerPopupSurfaceStyle } from "./explorerPopupStyles";
import type {
  ExplorerRuntimeMenuCommandNode,
  ExplorerRuntimeMenuNode,
  ExplorerRuntimeMenuSubmenuNode,
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
  runtimeMenuDensity: "compact" | "balanced" | "touch";
  runtimeMenuNodes: ExplorerRuntimeMenuNode[];
  runtimeShowDescriptions: boolean;
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

interface ExplorerActionsPaneRuntimeCommandItem {
  kind: "command";
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

interface ExplorerActionsPaneRuntimeSubmenuItem {
  kind: "submenu";
  id: string;
  label: string;
  childCommandCount: number;
  node: ExplorerRuntimeMenuSubmenuNode;
}

type ExplorerActionsPaneRuntimeBrowseItem =
  | ExplorerActionsPaneRuntimeCommandItem
  | ExplorerActionsPaneRuntimeSubmenuItem;

interface ExplorerActionsPaneRuntimeLetterGroup<
  Item extends { label: string; kind: string },
> {
  letter: string;
  items: Item[];
}

interface ExplorerActionsPaneRuntimeBrowsePanel {
  key: string;
  title: string;
  path: string[];
  items: ExplorerActionsPaneRuntimeBrowseItem[];
  letterGroups: ExplorerActionsPaneRuntimeLetterGroup<ExplorerActionsPaneRuntimeBrowseItem>[];
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

function compareRuntimeBrowseLabels(left: string, right: string): number {
  return left.localeCompare(right, undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

function compareRuntimeLetterKeys(left: string, right: string): number {
  if (left === right) {
    return 0;
  }
  if (left === "#") {
    return 1;
  }
  if (right === "#") {
    return -1;
  }
  return compareRuntimeBrowseLabels(left, right);
}

function resolveRuntimeBrowseLetterKey(label: string): string {
  const candidate = Array.from(label.trim().toUpperCase()).find((character) =>
    /[A-Z0-9]/.test(character),
  );
  return candidate ?? "#";
}

function countRuntimeCommandLeaves(nodes: ExplorerRuntimeMenuNode[]): number {
  return nodes.reduce((count, node) => {
    if (node.kind === "command") {
      return count + 1;
    }
    if (node.kind === "submenu") {
      return count + countRuntimeCommandLeaves(node.children);
    }
    return count;
  }, 0);
}

function groupRuntimeBrowseItemsByLetter<
  Item extends { label: string; kind: string },
>(items: Item[]): ExplorerActionsPaneRuntimeLetterGroup<Item>[] {
  const groups = new Map<string, Item[]>();
  items.forEach((item) => {
    const letterKey = resolveRuntimeBrowseLetterKey(item.label);
    const currentItems = groups.get(letterKey) ?? [];
    currentItems.push(item);
    groups.set(letterKey, currentItems);
  });

  return Array.from(groups.entries())
    .sort(([left], [right]) => compareRuntimeLetterKeys(left, right))
    .map(([letter, groupedItems]) => ({
      letter,
      items: groupedItems,
    }));
}

function toRuntimeCommandItem(
  node: ExplorerRuntimeMenuCommandNode,
  menuPath: string[],
): ExplorerActionsPaneRuntimeCommandItem {
  const dragControlId =
    node.command.source === "action"
      ? toExplorerActionChromeControlId(node.command.execution.action.id)
      : null;

  return {
    kind: "command",
    id: node.id,
    label: node.label,
    description: node.description,
    command: node.command,
    disabled: node.disabled,
    dragControlId,
    menuPathLabel: menuPath.length > 0 ? menuPath.join(" / ") : null,
    node,
    shortcutId: node.shortcutId ?? undefined,
    sourceLabel: resolveExplorerCommandSourceLabel(node.command),
  };
}

function toRuntimeBrowseItem(
  node: ExplorerRuntimeMenuNode,
  menuPath: string[],
): ExplorerActionsPaneRuntimeBrowseItem | null {
  if (node.kind === "separator") {
    return null;
  }
  if (node.kind === "command") {
    return toRuntimeCommandItem(node, menuPath);
  }
  return {
    kind: "submenu",
    id: node.id,
    label: node.label,
    childCommandCount: countRuntimeCommandLeaves(node.children),
    node,
  };
}

function buildRuntimeBrowseItems(
  nodes: ExplorerRuntimeMenuNode[],
  menuPath: string[],
): ExplorerActionsPaneRuntimeBrowseItem[] {
  return nodes
    .map((node) => toRuntimeBrowseItem(node, menuPath))
    .filter(
      (item): item is ExplorerActionsPaneRuntimeBrowseItem => item !== null,
    )
    .sort((left, right) => compareRuntimeBrowseLabels(left.label, right.label));
}

function collectRuntimeSearchItems(
  nodes: ExplorerRuntimeMenuNode[],
  menuPath: string[],
): ExplorerActionsPaneRuntimeCommandItem[] {
  const items: ExplorerActionsPaneRuntimeCommandItem[] = [];
  for (const node of nodes) {
    if (node.kind === "command") {
      items.push(toRuntimeCommandItem(node, menuPath));
      continue;
    }
    if (node.kind === "submenu") {
      items.push(
        ...collectRuntimeSearchItems(node.children, [...menuPath, node.label]),
      );
    }
  }
  return items;
}

function resolveRuntimeBrowsePanels(
  nodes: ExplorerRuntimeMenuNode[],
  openSubmenuPath: string[],
): {
  panels: ExplorerActionsPaneRuntimeBrowsePanel[];
  resolvedPath: string[];
} {
  const panels: ExplorerActionsPaneRuntimeBrowsePanel[] = [];
  const resolvedPath: string[] = [];
  const resolvedLabelPath: string[] = [];
  let currentNodes = nodes;

  const rootItems = buildRuntimeBrowseItems(currentNodes, []);
  panels.push({
    key: "__root__",
    title: "All Actions",
    path: [],
    items: rootItems,
    letterGroups: groupRuntimeBrowseItemsByLetter(rootItems),
  });

  openSubmenuPath.forEach((submenuId) => {
    const submenuNode = currentNodes.find(
      (node): node is ExplorerRuntimeMenuSubmenuNode =>
        node.kind === "submenu" && node.id === submenuId,
    );
    if (!submenuNode) {
      return;
    }
    resolvedPath.push(submenuNode.id);
    resolvedLabelPath.push(submenuNode.label);
    currentNodes = submenuNode.children;
    const items = buildRuntimeBrowseItems(currentNodes, resolvedLabelPath);
    panels.push({
      key: submenuNode.id,
      title: submenuNode.label,
      path: [...resolvedPath],
      items,
      letterGroups: groupRuntimeBrowseItemsByLetter(items),
    });
  });

  return {
    panels,
    resolvedPath,
  };
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
  runtimeMenuDensity,
  runtimeMenuNodes,
  runtimeShowDescriptions,
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
  const [openRuntimeSubmenuPath, setOpenRuntimeSubmenuPath] = useState<
    string[]
  >([]);
  const actionPointerTapControlIdRef = useRef<ExplorerChromeControlId | null>(
    null,
  );
  const browseLetterSectionRefs = useRef<
    Record<string, Record<string, HTMLElement | null>>
  >({});
  const searchLetterSectionRefs = useRef<Record<string, HTMLElement | null>>(
    {},
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
  const runtimeSearchItems = useMemo(
    () =>
      collectRuntimeSearchItems(runtimeMenuNodes, []).sort((left, right) =>
        compareRuntimeBrowseLabels(left.label, right.label),
      ),
    [runtimeMenuNodes],
  );
  const runtimeBrowseState = useMemo(
    () => resolveRuntimeBrowsePanels(runtimeMenuNodes, openRuntimeSubmenuPath),
    [openRuntimeSubmenuPath, runtimeMenuNodes],
  );
  const filteredRuntimeSearchGroups = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      return [] as ExplorerActionsPaneRuntimeLetterGroup<ExplorerActionsPaneRuntimeCommandItem>[];
    }

    const filteredItems = runtimeSearchItems.filter((item) =>
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
    );
    return groupRuntimeBrowseItemsByLetter(filteredItems);
  }, [query, runtimeSearchItems]);
  const runtimeBrowsePanelWidth =
    runtimeMenuDensity === "touch"
      ? 296
      : runtimeMenuDensity === "compact"
        ? 236
        : 256;
  const runtimeBrowseSurfaceStyle = resolveExplorerPopupSurfaceStyle({
    tone: "preview",
    padding: 0,
    overflowY: "auto",
    maxHeight: "none",
  });
  const isRuntimeSearchActive = !customizeMode && query.trim().length > 0;
  const hasRuntimeCommands = runtimeSearchItems.length > 0;
  const showRuntimeDescriptions = runtimeShowDescriptions || isRuntimeSearchActive;
  const panelTextStyle = {
    color: text,
    fontFamily:
      appearance?.fonts.ui ??
      'var(--overlay-font-body, "Segoe UI", sans-serif)',
  };

  useEffect(() => {
    setOpenRuntimeSubmenuPath([]);
  }, [runtimeActiveScopeId, runtimeMenuNodes]);

  const resolveEntryTone = (entry: ExplorerCustomizeCatalogEntry) => {
    if (entry.source === "action") {
      return accent;
    }
    if (entry.source === "missing-action") {
      return "var(--overlay-danger)";
    }
    return "color-mix(in srgb, var(--overlay-explorer-text) 74%, transparent)";
  };

  const invokeRuntimeItem = (item: ExplorerActionsPaneRuntimeCommandItem) => {
    if (item.disabled) {
      return;
    }
    if (item.dragControlId) {
      onSelectControl(item.dragControlId);
    }
    void Promise.resolve(item.node.onSelect());
  };

  const jumpToBrowseLetter = (panelKey: string, letter: string) => {
    browseLetterSectionRefs.current[panelKey]?.[letter]?.scrollIntoView({
      block: "start",
      behavior: "smooth",
    });
  };

  const jumpToSearchLetter = (letter: string) => {
    searchLetterSectionRefs.current[letter]?.scrollIntoView({
      block: "start",
      behavior: "smooth",
    });
  };

  const renderLetterJumpStrip = (
    letters: string[],
    onJump: (letter: string) => void,
  ) => {
    if (letters.length <= 1) {
      return null;
    }
    return (
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 6,
          padding: "0 10px 10px",
          borderBottom: "1px solid var(--overlay-explorer-toolbar-border)",
        }}
      >
        {letters.map((letter) => (
          <button
            key={letter}
            type="button"
            onClick={() => onJump(letter)}
            style={{
              borderRadius: 999,
              border: "1px solid var(--overlay-explorer-chip-border)",
              background: "var(--overlay-explorer-chip-bg)",
              color: text,
              padding: "4px 7px",
              minWidth: 28,
              cursor: "pointer",
              fontSize: 9,
              fontWeight: 800,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          >
            {letter}
          </button>
        ))}
      </div>
    );
  };

  const renderRuntimeCommandButton = (
    item: ExplorerActionsPaneRuntimeCommandItem,
    options?: {
      compact?: boolean;
      showMenuPath?: boolean;
      groupBorder?: boolean;
    },
  ) => {
    const compact = options?.compact ?? false;
    return (
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
          actionPointerTapControlIdRef.current = item.dragControlId;
          onBeginCatalogDrag(item.dragControlId, event, {
            onTap: () => invokeRuntimeItem(item),
          });
        }}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          if (
            item.dragControlId &&
            actionPointerTapControlIdRef.current === item.dragControlId
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
          borderTop: options?.groupBorder
            ? "1px solid color-mix(in srgb, var(--overlay-explorer-chip-border) 90%, transparent)"
            : "none",
          background: "transparent",
          color: item.disabled ? muted : text,
          cursor: item.dragControlId
            ? "grab"
            : item.disabled
              ? "not-allowed"
              : "pointer",
          textAlign: "left",
          padding: compact ? "8px 10px" : "10px 12px",
          opacity: item.disabled ? 0.68 : 1,
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "16px minmax(0, 1fr) auto",
            alignItems: "start",
            gap: compact ? 8 : 10,
          }}
        >
          <span style={{ opacity: 0.78 }}>
            {renderExplorerCommandLibraryIcon(item.command.iconName)}
          </span>
          <span style={{ minWidth: 0 }}>
            <span
              style={{
                display: "block",
                fontSize: compact ? 10 : 11,
                fontWeight: 700,
                color: text,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {item.label}
            </span>
            {showRuntimeDescriptions && item.description ? (
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
              {options?.showMenuPath && item.menuPathLabel ? (
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
    );
  };

  const renderRuntimeSubmenuButton = (
    item: ExplorerActionsPaneRuntimeSubmenuItem,
    panelPath: string[],
    submenuOpen: boolean,
    options?: { groupBorder?: boolean },
  ) => (
    <button
      key={item.id}
      type="button"
      onMouseEnter={() => setOpenRuntimeSubmenuPath([...panelPath, item.id])}
      onFocus={() => setOpenRuntimeSubmenuPath([...panelPath, item.id])}
      onClick={() => setOpenRuntimeSubmenuPath([...panelPath, item.id])}
      style={{
        width: "100%",
        border: 0,
        borderTop: options?.groupBorder
          ? "1px solid color-mix(in srgb, var(--overlay-explorer-chip-border) 90%, transparent)"
          : "none",
        background: submenuOpen
          ? "var(--overlay-explorer-chip-active-bg)"
          : "transparent",
        color: text,
        cursor: "pointer",
        textAlign: "left",
        padding: "10px 12px",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "16px minmax(0, 1fr) auto",
          alignItems: "center",
          gap: 10,
        }}
      >
        <span style={{ opacity: 0.78 }}>
          {renderExplorerCommandLibraryIcon(item.node.iconName)}
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
          <span
            style={{
              display: "block",
              marginTop: 3,
              fontSize: 10,
              lineHeight: 1.35,
              color: muted,
            }}
          >
            {item.childCommandCount === 1
              ? "1 command"
              : `${item.childCommandCount} commands`}
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
            color: submenuOpen ? accent : muted,
          }}
        >
          <span>{item.childCommandCount}</span>
          <span style={{ fontSize: 12, lineHeight: 1 }}>›</span>
        </span>
      </div>
    </button>
  );

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
          ) : !hasRuntimeCommands ? (
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
          ) : isRuntimeSearchActive ? (
            <section
              data-overlay-explorer-actions-search-results="true"
              style={{ display: "flex", flexDirection: "column", gap: 12 }}
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
                Search Results
              </div>
              {filteredRuntimeSearchGroups.length === 0 ? (
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
                  No commands match the current filter.
                </div>
              ) : (
                <>
                  {renderLetterJumpStrip(
                    filteredRuntimeSearchGroups.map((group) => group.letter),
                    jumpToSearchLetter,
                  )}
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {filteredRuntimeSearchGroups.map((group) => (
                      <section
                        key={group.letter}
                        data-overlay-explorer-actions-letter-group={group.letter}
                        ref={(node) => {
                          searchLetterSectionRefs.current[group.letter] = node;
                        }}
                        style={{
                          borderRadius: 12,
                          border: "1px solid var(--overlay-explorer-chip-border)",
                          background: "var(--overlay-explorer-chip-bg)",
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            padding: "8px 12px",
                            borderBottom:
                              "1px solid color-mix(in srgb, var(--overlay-explorer-chip-border) 88%, transparent)",
                            fontSize: 10,
                            fontWeight: 800,
                            letterSpacing: "0.12em",
                            textTransform: "uppercase",
                            color: muted,
                          }}
                        >
                          {group.letter}
                        </div>
                        <div>
                          {group.items.map((item, index) =>
                            renderRuntimeCommandButton(item, {
                              showMenuPath: true,
                              groupBorder: index > 0,
                            }),
                          )}
                        </div>
                      </section>
                    ))}
                  </div>
                </>
              )}
            </section>
          ) : (
            <section style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  color: muted,
                }}
              >
                Browse Menu
              </div>
              <div
                style={{
                  fontSize: 11,
                  lineHeight: 1.5,
                  color: muted,
                }}
              >
                Skim the live menu tree A-Z. Submenus open in sidecar panels so
                you can stay in the same flow instead of reading one flattened
                list.
              </div>
              <div
                style={{
                  display: "flex",
                  gap: 12,
                  overflowX: "auto",
                  paddingBottom: 4,
                }}
              >
                {runtimeBrowseState.panels.map((panel) => (
                  <div
                    key={panel.key}
                    data-overlay-explorer-actions-browser-panel={panel.key}
                    style={{
                      ...runtimeBrowseSurfaceStyle,
                      width: runtimeBrowsePanelWidth,
                      minHeight: 280,
                      maxHeight: 560,
                      flexShrink: 0,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 10,
                        padding: "10px 10px 8px",
                        borderBottom:
                          "1px solid color-mix(in srgb, var(--overlay-explorer-toolbar-border) 92%, transparent)",
                      }}
                    >
                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color: text,
                        }}
                      >
                        {panel.title}
                      </div>
                      <div
                        style={{
                          fontSize: 9,
                          fontWeight: 800,
                          letterSpacing: "0.08em",
                          textTransform: "uppercase",
                          color: muted,
                        }}
                      >
                        {panel.items.length}
                      </div>
                    </div>
                    {renderLetterJumpStrip(
                      panel.letterGroups.map((group) => group.letter),
                      (letter) => jumpToBrowseLetter(panel.key, letter),
                    )}
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        paddingBottom: 8,
                      }}
                    >
                      {panel.letterGroups.map((group) => (
                        <section
                          key={`${panel.key}:${group.letter}`}
                          data-overlay-explorer-actions-letter-group={group.letter}
                          ref={(node) => {
                            const currentPanelRefs =
                              browseLetterSectionRefs.current[panel.key] ?? {};
                            currentPanelRefs[group.letter] = node;
                            browseLetterSectionRefs.current[panel.key] =
                              currentPanelRefs;
                          }}
                          style={{ display: "flex", flexDirection: "column" }}
                        >
                          <div
                            style={{
                              padding: "8px 12px 6px",
                              fontSize: 10,
                              fontWeight: 800,
                              letterSpacing: "0.12em",
                              textTransform: "uppercase",
                              color: muted,
                            }}
                          >
                            {group.letter}
                          </div>
                          <div>
                            {group.items.map((item, index) =>
                              item.kind === "command"
                                ? renderRuntimeCommandButton(item, {
                                    compact: runtimeMenuDensity === "compact",
                                    groupBorder: index > 0,
                                  })
                                : renderRuntimeSubmenuButton(
                                    item,
                                    panel.path,
                                    runtimeBrowseState.resolvedPath[
                                      panel.path.length
                                    ] === item.id,
                                    {
                                      groupBorder: index > 0,
                                    },
                                  ),
                            )}
                          </div>
                        </section>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
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
