import React from "react";
import { createPortal } from "react-dom";
import { useExplorerDragInteractionSelector } from "./explorerDragAndDrop";

function getPathLeaf(path: string | null): string {
  if (!path) {
    return "Current Folder";
  }
  const segments = path.split(/[\\/]/).filter(Boolean);
  return segments[segments.length - 1] ?? path;
}

function getInvalidReasonLabel(reason: string | null): string {
  switch (reason) {
    case "self":
      return "Can't drop onto itself";
    case "descendant":
      return "Can't move into its own child";
    case "no-op":
      return "Already in this folder";
    default:
      return "Drop unavailable";
  }
}

export function ExplorerDragOverlay(): React.ReactElement | null {
  const state = useExplorerDragInteractionSelector((currentState) => currentState);

  if (
    !state.active ||
    !state.overlayPointer ||
    typeof document === "undefined" ||
    !document.body
  ) {
    return null;
  }

  const primaryLabel =
    state.primaryLabel?.trim() ||
    (state.itemCount > 1 ? `${state.itemCount} items` : "Item");
  const targetLabel = state.valid
    ? state.targetKind === "scope-root"
      ? "Current Folder"
      : state.dwellLabel?.trim() || getPathLeaf(state.targetPath)
    : getInvalidReasonLabel(state.invalidReason);

  return createPortal(
    <div
      aria-hidden="true"
      style={{
        position: "fixed",
        left: state.overlayPointer.x,
        top: state.overlayPointer.y,
        zIndex: 10000,
        pointerEvents: "none",
        transform: "translate3d(0, 0, 0)",
      }}
    >
      <div
        style={{
          minWidth: 188,
          maxWidth: 280,
          padding: "10px 12px",
          borderRadius: 16,
          border: `1px solid ${
            state.valid
              ? "var(--overlay-accent)"
              : "var(--overlay-explorer-danger-soft-border)"
          }`,
          background: state.valid
            ? "color-mix(in srgb, var(--overlay-bg-panel) 88%, black 12%)"
            : "var(--overlay-explorer-danger-soft-bg)",
          boxShadow:
            "0 18px 40px rgba(0, 0, 0, 0.34), inset 0 0 0 1px rgba(255,255,255,0.04)",
          backdropFilter: "blur(18px)",
          WebkitBackdropFilter: "blur(18px)",
          color: "var(--overlay-text-primary)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            minWidth: 0,
          }}
        >
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 12,
              display: "grid",
              placeItems: "center",
              background: state.valid
                ? "color-mix(in srgb, var(--overlay-accent) 22%, transparent)"
                : "rgba(255, 82, 82, 0.14)",
              color: state.valid
                ? "var(--overlay-accent)"
                : "var(--overlay-explorer-danger)",
              fontSize: 12,
              fontWeight: 800,
              flexShrink: 0,
            }}
          >
            {state.itemCount > 99 ? "99+" : state.itemCount}
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div
              style={{
                fontSize: 11.5,
                fontWeight: 700,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {primaryLabel}
            </div>
            <div
              style={{
                marginTop: 3,
                fontSize: 10,
                color: "var(--overlay-text-muted)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {state.valid ? `Drop into ${targetLabel}` : targetLabel}
            </div>
          </div>
          <div
            style={{
              borderRadius: 999,
              padding: "4px 8px",
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              background: state.valid
                ? "var(--overlay-explorer-chip-active-bg)"
                : "rgba(255,255,255,0.06)",
              color: state.valid
                ? "var(--overlay-text-primary)"
                : "var(--overlay-text-muted)",
              flexShrink: 0,
            }}
          >
            {state.operation === "copy" ? "Copy" : "Move"}
          </div>
        </div>
        {state.dwellSurfaceId && state.dwellDelayMs && state.valid ? (
          <div style={{ marginTop: 9 }}>
            <div
              style={{
                height: 4,
                borderRadius: 999,
                overflow: "hidden",
                background: "rgba(255,255,255,0.08)",
              }}
            >
              <div
                style={{
                  width: `${Math.max(0, Math.min(100, state.dwellProgress * 100))}%`,
                  height: "100%",
                  borderRadius: 999,
                  background: "var(--overlay-accent)",
                  transition: "width 60ms linear",
                }}
              />
            </div>
            <div
              style={{
                marginTop: 5,
                fontSize: 9.5,
                color: "var(--overlay-text-muted)",
              }}
            >
              Opening {targetLabel}…
            </div>
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
