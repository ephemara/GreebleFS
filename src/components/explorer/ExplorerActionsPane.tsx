import {
  Fragment,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";

import { Search } from "@/components/AppIcons";
import { AppSelect } from "../AppSelect";

import type { ResolvedOverlayAppearance } from "../../config/appearance";
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
  widgets: "Widgets",
  "authored-actions": "Authored Actions",
  other: "Other",
};

interface ExplorerActionsPaneProps {
  accent: string;
  appearance?: ResolvedOverlayAppearance;
  border: string;
  commandBinding: string;
  customizeMode: boolean;
  catalog: ExplorerCustomizeCatalogEntry[];
  muted: string;
  pendingHotkeyPrompt: string | null;
  runtimeMenuDensity: "compact" | "balanced" | "touch";
  runtimeMenuNodes: ExplorerRuntimeMenuNode[];
  runtimeShowDescriptions: boolean;
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
  onRequestHotkeyCapture: (controlId: ExplorerChromeControlId) => void;
  onSelectControl: (controlId: ExplorerChromeControlId | null) => void;
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
    id: menuPath.length > 0 ? `${menuPath.join("::")}::${node.id}` : node.id,
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

export function ExplorerActionsPane({
  accent,
  appearance,
  border,
  commandBinding,
  customizeMode,
  catalog,
  muted,
  pendingHotkeyPrompt,
  runtimeMenuDensity,
  runtimeMenuNodes,
  runtimeShowDescriptions,
  selectedEntry,
  selectedPlacement,
  text,
  onBeginCatalogDrag,
  onClose,
  onRequestHotkeyCapture,
  onSelectControl,
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
        entry.widget?.sourceLabel,
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
  const runtimeBrowseRootItems = useMemo(
    () => buildRuntimeBrowseItems(runtimeMenuNodes, []),
    [runtimeMenuNodes],
  );
  const runtimeBrowseRootLetterGroups = useMemo(
    () => groupRuntimeBrowseItemsByLetter(runtimeBrowseRootItems),
    [runtimeBrowseRootItems],
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
  const isRuntimeSearchActive = !customizeMode && query.trim().length > 0;
  const hasRuntimeCommands = runtimeSearchItems.length > 0;
  const showRuntimeDescriptions =
    isRuntimeSearchActive && runtimeShowDescriptions;
  const panelTextStyle = {
    color: text,
    fontFamily:
      appearance?.fonts.ui ??
      'var(--overlay-font-body, "Segoe UI", sans-serif)',
  };

  useEffect(() => {
    setOpenRuntimeSubmenuPath([]);
  }, [runtimeMenuNodes]);

  const resolveEntryTone = (entry: ExplorerCustomizeCatalogEntry) => {
    if (entry.source === "action") {
      return accent;
    }
    if (entry.source === "widget") {
      return "var(--overlay-explorer-accent)";
    }
    if (entry.source === "missing-action") {
      return "var(--overlay-danger)";
    }
    if (entry.source === "missing-widget") {
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

  const renderLetterJumpRail = (
    letters: string[],
    onJump: (letter: string) => void,
    railId: string,
  ) => {
    if (letters.length <= 1) {
      return null;
    }
    return (
      <div
        data-overlay-explorer-actions-letter-rail={railId}
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 4,
          padding: "8px 6px",
          borderLeft: "1px solid var(--overlay-explorer-toolbar-border)",
          background:
            "color-mix(in srgb, var(--overlay-explorer-toolbar-bg) 58%, transparent)",
          flexShrink: 0,
          position: "sticky",
          top: 0,
          alignSelf: "flex-start",
          maxHeight: "calc(100vh - 180px)",
          overflowY: "auto",
        }}
      >
        {letters.map((letter) => (
          <button
            key={letter}
            type="button"
            onClick={() => onJump(letter)}
            style={{
              borderRadius: 8,
              border: "1px solid var(--overlay-explorer-chip-border)",
              background: "var(--overlay-explorer-chip-bg)",
              color: text,
              width: 22,
              height: 20,
              padding: 0,
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
      depth?: number;
    },
  ) => {
    const compact = options?.compact ?? false;
    const depth = options?.depth ?? 0;
    const showRuntimeMetaRow = Boolean(
      options?.showMenuPath && item.menuPathLabel,
    );
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
          borderRight: 0,
          borderBottom: 0,
          borderLeft: 0,
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
          padding: compact ? "7px 9px" : "8px 10px",
          paddingLeft: 10 + depth * 18,
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
                  marginTop: 2,
                  fontSize: 10,
                  lineHeight: 1.35,
                  color: muted,
                }}
              >
                {item.description}
              </span>
            ) : null}
            {showRuntimeMetaRow ? (
              <span
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 8,
                  marginTop: 5,
                  fontSize: 9,
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: muted,
                }}
              >
                {options?.showMenuPath && item.menuPathLabel ? (
                  <span>{item.menuPathLabel}</span>
                ) : null}
              </span>
            ) : null}
          </span>
          {item.shortcutId ? (
            <span
              style={{
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: muted,
              }}
            >
              {item.shortcutId}
            </span>
          ) : null}
        </div>
      </button>
    );
  };

  const renderRuntimeSubmenuButton = (
    item: ExplorerActionsPaneRuntimeSubmenuItem,
    panelPath: string[],
    submenuOpen: boolean,
    options?: { groupBorder?: boolean; depth?: number },
  ) => (
    <button
      key={item.id}
      type="button"
      onMouseEnter={() => setOpenRuntimeSubmenuPath([...panelPath, item.id])}
      onFocus={() => setOpenRuntimeSubmenuPath([...panelPath, item.id])}
      onClick={() => setOpenRuntimeSubmenuPath([...panelPath, item.id])}
      style={{
        width: "100%",
        borderRight: 0,
        borderBottom: 0,
        borderLeft: 0,
        borderTop: options?.groupBorder
          ? "1px solid color-mix(in srgb, var(--overlay-explorer-chip-border) 90%, transparent)"
          : "none",
        background: submenuOpen
          ? "var(--overlay-explorer-chip-active-bg)"
          : "transparent",
        color: text,
        cursor: "pointer",
        textAlign: "left",
        padding: "8px 10px",
        paddingLeft: 10 + (options?.depth ?? 0) * 18,
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
        </span>
        <span
          style={{
            display: "inline-flex",
            alignItems: "flex-end",
            gap: 6,
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

  const isRuntimeSubmenuPathOpen = (path: string[]) =>
    path.every(
      (submenuId, index) => openRuntimeSubmenuPath[index] === submenuId,
    );

  const renderRuntimeBrowseRows = (
    items: ExplorerActionsPaneRuntimeBrowseItem[],
    panelPath: string[],
    labelPath: string[],
    depth = 0,
  ) =>
    items.map((item, index) => {
      const itemPath =
        item.kind === "submenu" ? [...panelPath, item.id] : panelPath;
      const rowKey =
        item.kind === "submenu"
          ? `${itemPath.join("::")}::submenu`
          : `${labelPath.join("::")}::${item.id}`;

      if (item.kind === "command") {
        return renderRuntimeCommandButton(item, {
          compact: runtimeMenuDensity === "compact",
          depth,
          groupBorder: index > 0,
        });
      }

      const submenuOpen = isRuntimeSubmenuPathOpen(itemPath);
      const childItems = submenuOpen
        ? buildRuntimeBrowseItems(item.node.children, [
            ...labelPath,
            item.label,
          ])
        : [];

      return (
        <Fragment key={rowKey}>
          {renderRuntimeSubmenuButton(item, panelPath, submenuOpen, {
            depth,
            groupBorder: index > 0,
          })}
          {submenuOpen ? (
            <div
              data-overlay-explorer-actions-inline-submenu={item.id}
              style={{
                borderTop:
                  "1px solid color-mix(in srgb, var(--overlay-explorer-chip-border) 72%, transparent)",
                borderBottom:
                  "1px solid color-mix(in srgb, var(--overlay-explorer-chip-border) 72%, transparent)",
                background:
                  "color-mix(in srgb, var(--overlay-explorer-chip-bg) 52%, transparent)",
              }}
            >
              {renderRuntimeBrowseRows(
                childItems,
                itemPath,
                [...labelPath, item.label],
                depth + 1,
              )}
            </div>
          ) : null}
        </Fragment>
      );
    });

  return (
    <div
      data-overlay-explorer-plane="actions"
      style={{
        ...panelTextStyle,
        flex: "1 1 auto",
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
        minWidth: 0,
        width: "100%",
        height: "100%",
        border: "1px solid var(--overlay-explorer-toolbar-border)",
        borderRadius: "var(--overlay-explorer-panel-radius)",
        background:
          "color-mix(in srgb, var(--overlay-explorer-preview-bg) 94%, black 6%)",
        boxShadow: "var(--overlay-explorer-toolbar-shadow)",
        overflow: "hidden",
      }}
    >
      {customizeMode ? (
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
              Explorer Customize
            </div>
            <div
              style={{
                marginTop: 4,
                fontSize: 12,
                fontWeight: 700,
                color: text,
              }}
            >
              All In Actions
            </div>
            <div
              style={{
                marginTop: 5,
                fontSize: 10,
                color: muted,
                lineHeight: 1.45,
                maxWidth: 280,
              }}
            >
              Drag controls out of this pane and drop them into any explorer
              chrome band. Ctrl+Alt+click any supported control to bind a
              hotkey.
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
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
              Done
            </button>
          </div>
        </div>
      ) : null}

      <div
        style={{
          padding: customizeMode ? "10px 12px 12px" : "8px 10px",
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
                : "Search actions"
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
            padding: customizeMode ? 12 : 0,
            display: "flex",
            flexDirection: "column",
            gap: customizeMode ? 14 : 0,
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
                    const isSelected =
                      entry.controlId === selectedEntry?.controlId;
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
                ? "No actions match."
                : "No actions in this menu."}
            </div>
          ) : isRuntimeSearchActive ? (
            <section
              data-overlay-explorer-actions-search-results="true"
              style={{
                display: "flex",
                alignItems: "stretch",
                gap: 0,
                minHeight: 0,
              }}
            >
              {filteredRuntimeSearchGroups.length === 0 ? (
                <div
                  style={{
                    flex: 1,
                    padding: "12px 14px",
                    color: muted,
                    fontSize: 11,
                    lineHeight: 1.55,
                  }}
                >
                  No actions match.
                </div>
              ) : (
                <>
                  <div
                    style={{
                      flex: 1,
                      minWidth: 0,
                      display: "flex",
                      flexDirection: "column",
                      gap: 8,
                    }}
                  >
                    {filteredRuntimeSearchGroups.map((group) => (
                      <section
                        key={group.letter}
                        data-overlay-explorer-actions-letter-group={
                          group.letter
                        }
                        ref={(node) => {
                          searchLetterSectionRefs.current[group.letter] = node;
                        }}
                        style={{
                          display: "flex",
                          flexDirection: "column",
                        }}
                      >
                        <div
                          style={{
                            padding: "7px 12px 5px",
                            borderTop:
                              "1px solid color-mix(in srgb, var(--overlay-explorer-chip-border) 72%, transparent)",
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
                  {renderLetterJumpRail(
                    filteredRuntimeSearchGroups.map((group) => group.letter),
                    jumpToSearchLetter,
                    "search-results",
                  )}
                </>
              )}
            </section>
          ) : (
            <section
              data-overlay-explorer-actions-browser="true"
              style={{
                display: "flex",
                alignItems: "stretch",
                minHeight: 0,
              }}
            >
              <div
                data-overlay-explorer-actions-browser-panel="__root__"
                style={{
                  flex: 1,
                  minWidth: 0,
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                {runtimeBrowseRootLetterGroups.map((group) => (
                  <section
                    key={`__root__:${group.letter}`}
                    data-overlay-explorer-actions-letter-group={group.letter}
                    ref={(node) => {
                      const currentPanelRefs =
                        browseLetterSectionRefs.current.__root__ ?? {};
                      currentPanelRefs[group.letter] = node;
                      browseLetterSectionRefs.current.__root__ =
                        currentPanelRefs;
                    }}
                    style={{ display: "flex", flexDirection: "column" }}
                  >
                    <div
                      style={{
                        padding: "7px 12px 5px",
                        borderTop:
                          "1px solid color-mix(in srgb, var(--overlay-explorer-chip-border) 72%, transparent)",
                        fontSize: 10,
                        fontWeight: 800,
                        letterSpacing: "0.12em",
                        textTransform: "uppercase",
                        color: muted,
                      }}
                    >
                      {group.letter}
                    </div>
                    <div>{renderRuntimeBrowseRows(group.items, [], [], 0)}</div>
                  </section>
                ))}
              </div>
              {renderLetterJumpRail(
                runtimeBrowseRootLetterGroups.map((group) => group.letter),
                (letter) => jumpToBrowseLetter("__root__", letter),
                "__root__",
              )}
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
                      <AppSelect
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
                      </AppSelect>
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
