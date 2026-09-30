import React, { useEffect, useState, useCallback } from "react";
import { useUiCustomizationStore } from "../store/uiCustomizationStore";
import { useSettingsStore } from "../../store/settingsStore";
import { Sliders, Check, X } from "@/components/AppIcons";

function parseKeyboardEventToCombo(event: KeyboardEvent): string | null {
  // Ignore lone modifier presses
  if (["Control", "Alt", "Shift", "Meta"].includes(event.key)) {
    return null;
  }

  const parts: string[] = [];
  if (event.ctrlKey) parts.push("Ctrl");
  if (event.altKey) parts.push("Alt");
  if (event.shiftKey) parts.push("Shift");
  if (event.metaKey) parts.push("Meta");

  let keyName = event.key;
  if (keyName === " ") keyName = "Space";
  else if (keyName.length === 1) keyName = keyName.toUpperCase();

  parts.push(keyName);
  return parts.join("+");
}

export const HotkeyCaptureModal: React.FC = () => {
  const hotkeyModal = useUiCustomizationStore((state) => state.hotkeyModal);
  const closeHotkeyModal = useUiCustomizationStore((state) => state.closeHotkeyModal);
  const setCommandKeybinding = useSettingsStore((state) => state.setCommandKeybinding);

  const [assignedCombo, setAssignedCombo] = useState<string | null>(null);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!hotkeyModal) return;

      event.preventDefault();
      event.stopPropagation();

      if (event.key === "Escape") {
        closeHotkeyModal();
        return;
      }

      if (event.key === "Delete" || event.key === "Backspace") {
        if (hotkeyModal.commandId) {
          setCommandKeybinding(hotkeyModal.commandId, "");
          setAssignedCombo("(Cleared)");
          setTimeout(() => {
            closeHotkeyModal();
          }, 450);
        }
        return;
      }

      const combo = parseKeyboardEventToCombo(event);
      if (combo && hotkeyModal.commandId) {
        setCommandKeybinding(hotkeyModal.commandId, combo);
        setAssignedCombo(combo);
        setTimeout(() => {
          closeHotkeyModal();
        }, 450);
      }
    },
    [closeHotkeyModal, hotkeyModal, setCommandKeybinding],
  );

  useEffect(() => {
    if (!hotkeyModal) {
      setAssignedCombo(null);
      return;
    }

    window.addEventListener("keydown", handleKeyDown, { capture: true });
    return () => {
      window.removeEventListener("keydown", handleKeyDown, { capture: true });
    };
  }, [handleKeyDown, hotkeyModal]);

  if (!hotkeyModal || !hotkeyModal.active) {
    return null;
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100000,
        background: "rgba(0, 0, 0, 0.45)",
        backdropFilter: "blur(4px)",
        WebkitBackdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      onClick={closeHotkeyModal}
    >
      <div
        style={{
          width: 360,
          background: "color-mix(in srgb, var(--overlay-panel-bg, #1e1e1e) 94%, black 6%)",
          border: "1px solid color-mix(in srgb, var(--overlay-accent, #ff8c00) 60%, var(--overlay-border, #333) 40%)",
          borderRadius: 12,
          padding: "20px 24px",
          boxShadow: "0 16px 40px rgba(0, 0, 0, 0.7), 0 0 16px color-mix(in srgb, var(--overlay-accent, #ff8c00) 25%, transparent)",
          display: "flex",
          flexDirection: "column",
          gap: 14,
          color: "var(--overlay-text, #f0f0f0)",
          pointerEvents: "auto",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 6,
                background: "color-mix(in srgb, var(--overlay-accent, #ff8c00) 20%, transparent)",
                color: "var(--overlay-accent, #ff8c00)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Sliders size={16} />
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--overlay-accent, #ff8c00)" }}>
                ZBrush Hotkey Assignment
              </span>
              <span style={{ fontSize: 13, fontWeight: 600 }}>{hotkeyModal.label}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={closeHotkeyModal}
            style={{
              background: "transparent",
              border: "none",
              color: "var(--overlay-muted, #888)",
              cursor: "pointer",
              padding: 4,
              borderRadius: 4,
            }}
          >
            <X size={16} />
          </button>
        </div>

        <div
          style={{
            padding: "16px",
            borderRadius: 8,
            background: "rgba(0, 0, 0, 0.35)",
            border: "1px dashed color-mix(in srgb, var(--overlay-border, #444) 80%, transparent)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            minHeight: 70,
          }}
        >
          {assignedCombo ? (
            <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#4ade80" }}>
              <Check size={18} />
              <span style={{ fontSize: 15, fontWeight: 700 }}>{assignedCombo}</span>
            </div>
          ) : (
            <>
              <span style={{ fontSize: 14, fontWeight: 700, color: "var(--overlay-accent, #ff8c00)" }}>
                Press any key combination...
              </span>
              <span style={{ fontSize: 11, color: "var(--overlay-muted, #888)" }}>
                Current: {hotkeyModal.currentBinding || "None"}
              </span>
            </>
          )}
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11, color: "var(--overlay-muted, #888)" }}>
          <span>Press <strong>ESC</strong> to cancel</span>
          <span>Press <strong>DEL</strong> to clear</span>
        </div>
      </div>
    </div>
  );
};
