import React, { useState } from "react";
import { useUiCustomizationStore } from "../store/uiCustomizationStore";
import {
  renderExplorerCommandLibraryIcon,
} from "../../components/explorer/explorerCommandLibrary";
import type {
  ExplorerChromeControlId,
  ExplorerChromeOverrideEntry,
  ExplorerChromeSizeVariant,
} from "../types";
import { X, Search } from "@/components/AppIcons";

const AVAILABLE_ICONS = [
  "RefreshCw",
  "FolderPlus",
  "FilePlus",
  "FolderTree",
  "Terminal",
  "Sliders",
  "Eye",
  "Info",
  "Pencil",
  "Trash2",
  "Copy",
  "Scissors",
  "Save",
  "Star",
  "Tags",
  "Shield",
  "ExternalLink",
  "Puzzle",
  "Sparkles",
  "Undo2",
  "Clipboard",
  "Edit3",
  "Eraser",
];

interface IconPickerPopoverProps {
  currentEntry?: ExplorerChromeOverrideEntry | null;
  onUpdateEntry: (
    controlId: ExplorerChromeControlId,
    patch: Partial<ExplorerChromeOverrideEntry>,
  ) => void;
}

export const IconPickerPopover: React.FC<IconPickerPopoverProps> = ({
  currentEntry,
  onUpdateEntry,
}) => {
  const iconPicker = useUiCustomizationStore((state) => state.iconPicker);
  const closeIconPicker = useUiCustomizationStore((state) => state.closeIconPicker);

  const [searchFilter, setSearchFilter] = useState("");

  if (!iconPicker || !iconPicker.active || !iconPicker.controlId) {
    return null;
  }

  const controlId = iconPicker.controlId;
  const showIcon = currentEntry?.showIcon ?? true;
  const showLabel = currentEntry?.showLabel ?? true;
  const sizeVariant = currentEntry?.sizeVariant ?? "regular";
  const customLabel = currentEntry?.customLabel ?? "";

  const filteredIcons = AVAILABLE_ICONS.filter((icon) =>
    icon.toLowerCase().includes(searchFilter.toLowerCase()),
  );

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100000,
        background: "rgba(0, 0, 0, 0.4)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backdropFilter: "blur(4px)",
        WebkitBackdropFilter: "blur(4px)",
      }}
      onClick={closeIconPicker}
    >
      <div
        style={{
          width: 380,
          maxHeight: "85vh",
          background: "color-mix(in srgb, var(--overlay-panel-bg, #1e1e1e) 96%, black 4%)",
          border: "1px solid color-mix(in srgb, var(--overlay-accent, #ff8c00) 50%, var(--overlay-border, #333) 50%)",
          borderRadius: 12,
          padding: 20,
          boxShadow: "0 16px 40px rgba(0, 0, 0, 0.7)",
          display: "flex",
          flexDirection: "column",
          gap: 14,
          color: "var(--overlay-text, #f0f0f0)",
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--overlay-accent, #ff8c00)" }}>
              Customize Button
            </div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{controlId}</div>
          </div>
          <button
            type="button"
            onClick={closeIconPicker}
            style={{
              background: "transparent",
              border: "none",
              color: "var(--overlay-muted, #888)",
              cursor: "pointer",
              padding: 4,
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Display Style Toggles */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: "var(--overlay-muted, #aaa)" }}>
            Display Format
          </label>
          <div style={{ display: "flex", gap: 6 }}>
            <button
              type="button"
              onClick={() => onUpdateEntry(controlId, { showIcon: true, showLabel: true })}
              style={{
                flex: 1,
                padding: "6px 10px",
                borderRadius: 6,
                fontSize: 11,
                fontWeight: 600,
                cursor: "pointer",
                border: showIcon && showLabel
                  ? "1px solid var(--overlay-accent, #ff8c00)"
                  : "1px solid var(--overlay-border, #444)",
                background: showIcon && showLabel
                  ? "color-mix(in srgb, var(--overlay-accent, #ff8c00) 20%, transparent)"
                  : "rgba(0,0,0,0.2)",
                color: showIcon && showLabel ? "var(--overlay-accent, #ff8c00)" : "inherit",
              }}
            >
              Icon + Label
            </button>
            <button
              type="button"
              onClick={() => onUpdateEntry(controlId, { showIcon: true, showLabel: false })}
              style={{
                flex: 1,
                padding: "6px 10px",
                borderRadius: 6,
                fontSize: 11,
                fontWeight: 600,
                cursor: "pointer",
                border: showIcon && !showLabel
                  ? "1px solid var(--overlay-accent, #ff8c00)"
                  : "1px solid var(--overlay-border, #444)",
                background: showIcon && !showLabel
                  ? "color-mix(in srgb, var(--overlay-accent, #ff8c00) 20%, transparent)"
                  : "rgba(0,0,0,0.2)",
                color: showIcon && !showLabel ? "var(--overlay-accent, #ff8c00)" : "inherit",
              }}
            >
              Icon Only
            </button>
            <button
              type="button"
              onClick={() => onUpdateEntry(controlId, { showIcon: false, showLabel: true })}
              style={{
                flex: 1,
                padding: "6px 10px",
                borderRadius: 6,
                fontSize: 11,
                fontWeight: 600,
                cursor: "pointer",
                border: !showIcon && showLabel
                  ? "1px solid var(--overlay-accent, #ff8c00)"
                  : "1px solid var(--overlay-border, #444)",
                background: !showIcon && showLabel
                  ? "color-mix(in srgb, var(--overlay-accent, #ff8c00) 20%, transparent)"
                  : "rgba(0,0,0,0.2)",
                color: !showIcon && showLabel ? "var(--overlay-accent, #ff8c00)" : "inherit",
              }}
            >
              Label Only
            </button>
          </div>
        </div>

        {/* Size Variant */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: "var(--overlay-muted, #aaa)" }}>
            Button Size
          </label>
          <div style={{ display: "flex", gap: 6 }}>
            {(["compact", "regular", "wide"] as ExplorerChromeSizeVariant[]).map((variant) => (
              <button
                key={variant}
                type="button"
                onClick={() => onUpdateEntry(controlId, { sizeVariant: variant })}
                style={{
                  flex: 1,
                  padding: "5px 8px",
                  borderRadius: 6,
                  fontSize: 11,
                  fontWeight: 600,
                  textTransform: "capitalize",
                  cursor: "pointer",
                  border: sizeVariant === variant
                    ? "1px solid var(--overlay-accent, #ff8c00)"
                    : "1px solid var(--overlay-border, #444)",
                  background: sizeVariant === variant
                    ? "color-mix(in srgb, var(--overlay-accent, #ff8c00) 20%, transparent)"
                    : "rgba(0,0,0,0.2)",
                  color: sizeVariant === variant ? "var(--overlay-accent, #ff8c00)" : "inherit",
                }}
              >
                {variant}
              </button>
            ))}
          </div>
        </div>

        {/* Custom Label Override */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: "var(--overlay-muted, #aaa)" }}>
            Custom Label
          </label>
          <input
            type="text"
            value={customLabel}
            placeholder="Default command label..."
            onChange={(e) => onUpdateEntry(controlId, { customLabel: e.target.value })}
            style={{
              padding: "6px 10px",
              borderRadius: 6,
              border: "1px solid var(--overlay-border, #444)",
              background: "rgba(0,0,0,0.25)",
              color: "inherit",
              fontSize: 12,
              outline: "none",
            }}
          />
        </div>

        {/* Icon Glyphs Selection */}
        {showIcon && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, minHeight: 0, flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: "var(--overlay-muted, #aaa)" }}>
                Select Icon Glyph
              </label>
              <div style={{ display: "flex", alignItems: "center", gap: 4, position: "relative" }}>
                <Search size={12} style={{ color: "var(--overlay-muted, #888)", position: "absolute", left: 6 }} />
                <input
                  type="text"
                  placeholder="Filter icons..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  style={{
                    padding: "3px 6px 3px 22px",
                    borderRadius: 4,
                    border: "1px solid var(--overlay-border, #444)",
                    background: "rgba(0,0,0,0.2)",
                    color: "inherit",
                    fontSize: 10,
                    outline: "none",
                    width: 110,
                  }}
                />
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(6, 1fr)",
                gap: 6,
                maxHeight: 140,
                overflowY: "auto",
                padding: "4px 2px",
              }}
            >
              {filteredIcons.map((iconName) => {
                const isSelected = currentEntry?.customIconName === iconName;
                return (
                  <button
                    key={iconName}
                    type="button"
                    title={iconName}
                    onClick={() => onUpdateEntry(controlId, { customIconName: iconName })}
                    style={{
                      height: 36,
                      borderRadius: 6,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                      border: isSelected
                        ? "1px solid var(--overlay-accent, #ff8c00)"
                        : "1px solid var(--overlay-border, #444)",
                      background: isSelected
                        ? "color-mix(in srgb, var(--overlay-accent, #ff8c00) 25%, transparent)"
                        : "rgba(0,0,0,0.2)",
                      color: isSelected ? "var(--overlay-accent, #ff8c00)" : "inherit",
                    }}
                  >
                    {renderExplorerCommandLibraryIcon(iconName, 16)}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
