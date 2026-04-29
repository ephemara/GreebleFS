import React from "react";
import ReactDOM from "react-dom/client";

import { FileExplorer } from "../../components/FileExplorer";
import { createDefaultExplorerRailSnapshot } from "../../components/explorer/explorerRailState";
import { resolveOverlayAppearance } from "../../config/appearance";
import { EXPLORER_PERFORMANCE_HISTORY_KEY } from "../../config/performanceTelemetry";
import {
  EXPLORER_LEGACY_BOOKMARKS_KEY,
  EXPLORER_STATE_BACKUP_KEY,
  EXPLORER_STATE_STORAGE_KEY,
  useExplorerStore,
} from "../../store/explorerStore";
import { useSettingsStore } from "../../store/settingsStore";

function resetProofState() {
  window.localStorage.removeItem("ultacode-settings");
  window.localStorage.removeItem(EXPLORER_STATE_STORAGE_KEY);
  window.localStorage.removeItem(EXPLORER_STATE_BACKUP_KEY);
  window.localStorage.removeItem(EXPLORER_LEGACY_BOOKMARKS_KEY);
  window.localStorage.removeItem(EXPLORER_PERFORMANCE_HISTORY_KEY);
  useSettingsStore.getState().resetToDefaults();
  useSettingsStore.getState().updateExplorer({
    viewMode: "icons-l",
    gridZoom: 0.67,
  });
  useExplorerStore.getState().resetSession();
  useExplorerStore.getState().replaceRail(createDefaultExplorerRailSnapshot());
  useExplorerStore.getState().clearPersistenceNotice();
}

function LayoutZoomProofPage() {
  const appearance = resolveOverlayAppearance({ activeThemeId: "operator" });

  return (
    <div style={{ minHeight: "100vh", background: "#0b0f19", color: "#f4f7fb" }}>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 12,
          padding: "14px 18px",
          borderBottom: "1px solid rgba(255,255,255,0.12)",
          background: "rgba(12,17,28,0.94)",
        }}
      >
        <strong data-testid="proof-title">Explorer layout zoom browser proof</strong>
        <span data-testid="proof-instructions">
          Use Ctrl/Cmd + wheel inside Explorer and verify that tiles, thumbnails,
          and fallback icons scale live while the saved mode settles after idle.
        </span>
      </div>
      <div style={{ height: "calc(100vh - 58px)" }}>
        <FileExplorer
          theme={{
            accent: appearance.theme.palette.accent,
            bg: appearance.theme.palette.appBackground,
            bgPanel: appearance.theme.palette.panelBackground,
            text: appearance.theme.palette.textPrimary,
            border: appearance.theme.palette.border,
            textMuted: appearance.theme.palette.textMuted,
          }}
          appearance={appearance}
          onOpenInTerminal={() => {}}
          onAddBookmark={async () => {}}
        />
      </div>
    </div>
  );
}

resetProofState();

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Proof root element was not found.");
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <LayoutZoomProofPage />
  </React.StrictMode>,
);
