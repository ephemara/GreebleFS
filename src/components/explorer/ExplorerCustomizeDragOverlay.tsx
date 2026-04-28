import React, { useMemo } from "react";
import { createPortal } from "react-dom";

import type { ExplorerCustomizeCatalogEntry } from "../../config/explorerCustomizeCatalog";
import type {
  ExplorerChromeControlId,
  ExplorerChromeSurfaceId,
} from "../../config/explorerChromeLayouts";
import { useExplorerCustomizePointerSnapshot } from "./explorerCustomizePointerRuntime";

const explorerCustomizeSurfaceLabels: Record<ExplorerChromeSurfaceId, string> = {
  explorerTopbar: "Top Bar",
  explorerToolbar: "Toolbar",
  workspaceHeader: "Workspace Header",
  railHeader: "Rail Header",
  previewHeader: "Preview Header",
  explorerStatusBar: "Status Bar",
};

function getCustomizeDragStatusLabel(snapshot: ReturnType<typeof useExplorerCustomizePointerSnapshot>): string {
  if (snapshot.removeTargetActive) {
    return "Remove from layout";
  }
  if (snapshot.dropTarget) {
    return `Drop on ${explorerCustomizeSurfaceLabels[snapshot.dropTarget.surfaceId] ?? "Explorer Chrome"}`;
  }
  if (snapshot.sourceKind === "placed") {
    return "Move to another chrome surface";
  }
  return "Choose a surface";
}

function getEntrySourceLabel(entry: ExplorerCustomizeCatalogEntry | null): string {
  if (!entry) {
    return "Chrome Control";
  }
  if (entry.source === "action") {
    return entry.action?.packName?.trim() || "Authored Action";
  }
  if (entry.source === "missing-action") {
    return "Missing Action";
  }
  return "Built-In Control";
}

export function ExplorerCustomizeDragOverlay({
  catalog,
}: {
  catalog: ExplorerCustomizeCatalogEntry[];
}): React.ReactElement | null {
  const snapshot = useExplorerCustomizePointerSnapshot();
  const catalogEntryByControlId = useMemo(
    () =>
      new Map<ExplorerChromeControlId, ExplorerCustomizeCatalogEntry>(
        catalog.map((entry) => [entry.controlId, entry]),
      ),
    [catalog],
  );

  if (
    !snapshot.draggingControlId ||
    !snapshot.pointerPoint ||
    typeof document === "undefined" ||
    !document.body
  ) {
    return null;
  }

  const entry = catalogEntryByControlId.get(snapshot.draggingControlId) ?? null;
  const sourceLabel = getEntrySourceLabel(entry);
  const statusLabel = getCustomizeDragStatusLabel(snapshot);
  const isDropReady = snapshot.dropTarget != null || snapshot.removeTargetActive;
  const label = entry?.label ?? snapshot.draggingControlId;
  const description =
    entry?.description ??
    (snapshot.sourceKind === "placed"
      ? "Move this control into another explorer chrome surface."
      : "Drag this item into explorer chrome to place it.");

  return createPortal(
    <div
      aria-hidden="true"
      data-explorer-customize-drag-overlay="true"
      data-testid="explorer-customize-drag-overlay"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        zIndex: 10040,
        transform: `translate3d(${snapshot.pointerPoint.x + 18}px, ${snapshot.pointerPoint.y + 18}px, 0)`,
        pointerEvents: "none",
        minWidth: 232,
        maxWidth: 304,
        color: "var(--overlay-text-primary)",
        opacity: snapshot.active ? 1 : 0.82,
      }}
    >
      <div
        style={{
          borderRadius: 22,
          border: isDropReady
            ? "1px solid color-mix(in srgb, var(--overlay-accent) 68%, rgba(255,255,255,0.18))"
            : "1px solid rgba(255,255,255,0.12)",
          background:
            "linear-gradient(180deg, color-mix(in srgb, var(--overlay-bg-panel) 92%, white 8%), color-mix(in srgb, var(--overlay-bg-panel) 82%, var(--overlay-accent) 18%))",
          boxShadow:
            "0 22px 48px rgba(0,0,0,0.36), inset 0 1px 0 rgba(255,255,255,0.08)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "36px minmax(0, 1fr)",
            gap: 12,
            alignItems: "start",
            padding: "13px 14px 12px",
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 14,
              display: "grid",
              placeItems: "center",
              background: isDropReady
                ? "color-mix(in srgb, var(--overlay-accent) 22%, transparent)"
                : "rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,255,255,0.1)",
              fontSize: 13,
              fontWeight: 900,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--overlay-accent)",
            }}
          >
            {label.slice(0, 2)}
          </div>
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                minWidth: 0,
              }}
            >
              <div
                style={{
                  minWidth: 0,
                  flex: 1,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  fontSize: 12,
                  fontWeight: 800,
                  lineHeight: 1.25,
                }}
              >
                {label}
              </div>
              <div
                style={{
                  borderRadius: 999,
                  padding: "4px 7px",
                  background: "rgba(255,255,255,0.08)",
                  color: "var(--overlay-text-muted)",
                  fontSize: 9,
                  fontWeight: 800,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  flexShrink: 0,
                }}
              >
                {snapshot.sourceKind === "placed" ? "Move" : "Place"}
              </div>
            </div>
            <div
              style={{
                marginTop: 4,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                color: "var(--overlay-text-muted)",
                fontSize: 10.5,
              }}
            >
              {description}
            </div>
            <div
              style={{
                marginTop: 8,
                display: "flex",
                alignItems: "center",
                gap: 6,
                flexWrap: "wrap",
              }}
            >
              <span
                style={{
                  borderRadius: 999,
                  padding: "5px 8px",
                  background: isDropReady
                    ? "color-mix(in srgb, var(--overlay-accent) 18%, rgba(255,255,255,0.05))"
                    : "rgba(255,255,255,0.06)",
                  color: isDropReady
                    ? "var(--overlay-text-primary)"
                    : "var(--overlay-text-muted)",
                  fontSize: 9.5,
                  fontWeight: 800,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                }}
              >
                {statusLabel}
              </span>
              <span
                style={{
                  color: "var(--overlay-text-muted)",
                  fontSize: 9.5,
                  fontWeight: 700,
                }}
              >
                {sourceLabel}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
