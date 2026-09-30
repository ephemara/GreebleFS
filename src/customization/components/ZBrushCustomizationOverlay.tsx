import React from "react";
import { useUiCustomizationStore } from "../store/uiCustomizationStore";
import { Trash2, GripVertical } from "@/components/AppIcons";
import { renderExplorerCommandLibraryIcon } from "../../components/explorer/explorerCommandLibrary";

export const ZBrushCustomizationOverlay: React.FC = () => {
  const activeDrag = useUiCustomizationStore((state) => state.activeDrag);

  if (!activeDrag || !activeDrag.active) {
    return null;
  }

  const { pointerX, pointerY, label, iconName, isRemoveTarget } = activeDrag;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        pointerEvents: "none",
        zIndex: 99999,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          transform: `translate3d(${pointerX + 14}px, ${pointerY + 14}px, 0)`,
          willChange: "transform",
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "6px 12px",
          borderRadius: 8,
          border: isRemoveTarget
            ? "1px solid rgba(239, 68, 68, 0.8)"
            : "1px solid color-mix(in srgb, var(--overlay-accent, #ff8c00) 80%, white 20%)",
          background: isRemoveTarget
            ? "rgba(127, 29, 29, 0.92)"
            : "color-mix(in srgb, var(--overlay-panel-bg, #1a1a1a) 88%, black 12%)",
          boxShadow: isRemoveTarget
            ? "0 4px 20px rgba(239, 68, 68, 0.4), 0 0 1px rgba(255,255,255,0.5)"
            : "0 6px 24px rgba(0, 0, 0, 0.6), 0 0 10px color-mix(in srgb, var(--overlay-accent, #ff8c00) 30%, transparent)",
          color: isRemoveTarget ? "#fca5a5" : "var(--overlay-text, #f0f0f0)",
          fontSize: 12,
          fontWeight: 600,
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          transition: "border-color 100ms ease, background 100ms ease, color 100ms ease",
        }}
      >
        {isRemoveTarget ? (
          <>
            <Trash2 size={14} style={{ color: "#ef4444", flexShrink: 0 }} />
            <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
              <span style={{ color: "#f87171", fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                Remove From Shelf
              </span>
              <span style={{ opacity: 0.85, fontSize: 11 }}>
                Drop on canvas to delete
              </span>
            </div>
          </>
        ) : (
          <>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 20,
                height: 20,
                borderRadius: 4,
                background: "color-mix(in srgb, var(--overlay-accent, #ff8c00) 20%, transparent)",
                color: "var(--overlay-accent, #ff8c00)",
                flexShrink: 0,
              }}
            >
              {iconName ? (
                renderExplorerCommandLibraryIcon(iconName, 13)
              ) : (
                <GripVertical size={12} />
              )}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
              <span style={{ fontSize: 12, fontWeight: 600 }}>{label}</span>
              <span
                style={{
                  fontSize: 10,
                  opacity: 0.65,
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                  color: "var(--overlay-accent, #ff8c00)",
                }}
              >
                Drop into shelf slot
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
