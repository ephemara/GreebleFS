import {
  useMemo,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";

import type { ResolvedOverlayAppearance } from "../../config/appearance";
import type {
  ExplorerCustomizeCatalogCategory,
  ExplorerCustomizeCatalogEntry,
} from "../../config/explorerCustomizeCatalog";
import type {
  ExplorerChromeControlId,
  ExplorerChromeOverrideEntry,
  ExplorerChromeSizeVariant,
} from "../../config/explorerChromeLayouts";
import { formatHotkeyLabel } from "../../config/hotkeys";
import { OverlayScrollArea } from "../OverlayScrollArea";

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

interface ExplorerActionsPaneProps {
  accent: string;
  appearance?: ResolvedOverlayAppearance;
  border: string;
  commandBinding: string;
  customizeMode: boolean;
  catalog: ExplorerCustomizeCatalogEntry[];
  muted: string;
  pendingHotkeyPrompt: string | null;
  selectedEntry: ExplorerCustomizeCatalogEntry | null;
  selectedPlacement: ExplorerChromeOverrideEntry | null;
  text: string;
  onBeginCatalogDrag: (
    controlId: ExplorerChromeControlId,
    event: ReactPointerEvent<HTMLElement>,
  ) => void;
  onClose: () => void;
  onInvokeCatalogEntry: (entry: ExplorerCustomizeCatalogEntry) => void;
  onRequestHotkeyCapture: (controlId: ExplorerChromeControlId) => void;
  onSelectControl: (controlId: ExplorerChromeControlId | null) => void;
  onSetSelectedShowIcon: (value: boolean) => void;
  onSetSelectedShowLabel: (value: boolean) => void;
  onSetSelectedSizeVariant: (variant: ExplorerChromeSizeVariant) => void;
  runtimeCanExecuteEntry: (entry: ExplorerCustomizeCatalogEntry) => boolean;
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

export function ExplorerActionsPane({
  accent,
  appearance,
  border,
  commandBinding,
  customizeMode,
  catalog,
  muted,
  pendingHotkeyPrompt,
  selectedEntry,
  selectedPlacement,
  text,
  onBeginCatalogDrag,
  onClose,
  onInvokeCatalogEntry,
  onRequestHotkeyCapture,
  onSelectControl,
  onSetSelectedShowIcon,
  onSetSelectedShowLabel,
  onSetSelectedSizeVariant,
  runtimeCanExecuteEntry,
}: ExplorerActionsPaneProps) {
  const [query, setQuery] = useState("");
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
  const actionPackGroups = useMemo(() => {
    const packGroups = new Map<string, ExplorerCustomizeCatalogEntry[]>();
    for (const entry of filteredCatalog) {
      if (entry.source === "built-in") {
        continue;
      }
      const groupLabel = entry.action?.packName?.trim() || "Authored Actions";
      const currentEntries = packGroups.get(groupLabel) ?? [];
      currentEntries.push(entry);
      packGroups.set(groupLabel, currentEntries);
    }
    return Array.from(packGroups.entries());
  }, [filteredCatalog]);
  const panelTextStyle = {
    color: text,
    fontFamily:
      appearance?.fonts.ui ??
      'var(--overlay-font-body, "Segoe UI", sans-serif)',
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
            {customizeMode ? "Explorer Customize" : "Actions"}
          </div>
          <div
            style={{
              marginTop: 4,
              fontSize: 12,
              fontWeight: 700,
              color: text,
            }}
          >
            {customizeMode ? "All In Actions" : "Authored Explorer Actions"}
          </div>
          <div
            style={{
              marginTop: 5,
              fontSize: 10,
              color: muted,
              lineHeight: 1.45,
              maxWidth: 260,
            }}
          >
            {customizeMode
              ? "Drag controls out of this pane and drop them into any explorer chrome band. Ctrl+Alt+click any supported control to bind a hotkey."
              : "Launch authored actions from the current explorer context. Ctrl+Alt+click an action to bind it instantly."}
          </div>
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
          ) : null}
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
        <input
          value={query}
          onChange={(event) => setQuery(event.currentTarget.value)}
          placeholder={
            customizeMode
              ? "Browse commands and controls..."
              : "Search actions..."
          }
          style={{
            width: "100%",
            borderRadius: 12,
            border: "1px solid var(--overlay-explorer-chip-border)",
            background: "var(--overlay-explorer-chip-bg)",
            color: text,
            padding: "10px 12px",
            fontSize: 11,
            outline: "none",
          }}
        />
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
          {customizeMode
            ? groupedCatalog.map(([category, entries]) => (
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
                            borderRadius: 14,
                            border: isSelected
                              ? `1px solid ${accent}88`
                              : "1px solid var(--overlay-explorer-chip-border)",
                            background: isSelected
                              ? `color-mix(in srgb, ${accent} 10%, transparent)`
                              : "var(--overlay-explorer-chip-bg)",
                            color: text,
                            padding: "10px 12px",
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
                                  marginTop: 4,
                                  fontSize: 10,
                                  color: muted,
                                  lineHeight: 1.4,
                                }}
                              >
                                {entry.description}
                              </div>
                            </div>
                            <span
                              style={{
                                flexShrink: 0,
                                borderRadius: 999,
                                border:
                                  "1px solid var(--overlay-explorer-chip-border)",
                                padding: "3px 7px",
                                fontSize: 9,
                                fontWeight: 700,
                                letterSpacing: "0.08em",
                                textTransform: "uppercase",
                                color: muted,
                              }}
                            >
                              {entry.source === "built-in"
                                ? "Built-In"
                                : entry.source === "action"
                                  ? "Action"
                                  : "Missing"}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </section>
              ))
            : actionPackGroups.map(([groupLabel, entries]) => (
                <section
                  key={groupLabel}
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
                    {groupLabel}
                  </div>
                  <div style={{ display: "grid", gap: 8 }}>
                    {entries.map((entry) => {
                      const canExecute = runtimeCanExecuteEntry(entry);
                      const bindingLabel = formatHotkeyLabel(
                        commandBinding &&
                          selectedEntry?.controlId === entry.controlId
                          ? commandBinding
                          : "",
                      );
                      return (
                        <button
                          key={entry.controlId}
                          type="button"
                          disabled={!canExecute || !entry.action}
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            if (event.ctrlKey && event.altKey) {
                              onRequestHotkeyCapture(entry.controlId);
                              onSelectControl(entry.controlId);
                              return;
                            }
                            onSelectControl(entry.controlId);
                            onInvokeCatalogEntry(entry);
                          }}
                          style={{
                            borderRadius: 14,
                            border:
                              "1px solid var(--overlay-explorer-chip-border)",
                            background: "var(--overlay-explorer-chip-bg)",
                            color: canExecute ? text : muted,
                            padding: "11px 12px",
                            cursor: canExecute ? "pointer" : "default",
                            opacity: canExecute ? 1 : 0.66,
                            textAlign: "left",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              alignItems: "flex-start",
                              justifyContent: "space-between",
                              gap: 10,
                            }}
                          >
                            <div style={{ minWidth: 0, flex: 1 }}>
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
                                  marginTop: 4,
                                  fontSize: 10,
                                  color: muted,
                                  lineHeight: 1.45,
                                }}
                              >
                                {entry.description}
                              </div>
                              {bindingLabel ? (
                                <div
                                  style={{
                                    marginTop: 7,
                                    fontSize: 9,
                                    fontWeight: 700,
                                    letterSpacing: "0.08em",
                                    textTransform: "uppercase",
                                    color: accent,
                                  }}
                                >
                                  {bindingLabel}
                                </div>
                              ) : null}
                            </div>
                            <span
                              style={{
                                flexShrink: 0,
                                borderRadius: 999,
                                border:
                                  "1px solid var(--overlay-explorer-chip-border)",
                                padding: "3px 7px",
                                fontSize: 9,
                                fontWeight: 700,
                                letterSpacing: "0.08em",
                                textTransform: "uppercase",
                                color: muted,
                              }}
                            >
                              Run
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </section>
              ))}

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
