import React, { useMemo } from "react";
import ReactDOM from "react-dom/client";

import {
  getGreebleUsrShippedRelativeDirectory,
  greebleUsrManifest,
  greebleUsrManifestEntries,
} from "../../config/usrManifest";
import rawUsrManifestText from "../../../usr/manifest.json?raw";

type RawImportState = {
  status: "ok" | "error";
  entryCount: number;
  message: string;
};

function parseRawUsrManifest(): RawImportState {
  try {
    const manifest = JSON.parse(rawUsrManifestText) as typeof greebleUsrManifest;
    return {
      status: "ok",
      entryCount: Array.isArray(manifest.entries) ? manifest.entries.length : 0,
      message: `raw-version:${manifest.version ?? "unknown"}`,
    };
  } catch (error) {
    return {
      status: "error",
      entryCount: 0,
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

const rawImportState = parseRawUsrManifest();

function UsrManifestSmokePage() {
  const profileOverlayCount = useMemo(
    () => greebleUsrManifestEntries.filter((entry) => entry.profileMode === "profile-overlay").length,
    [],
  );
  const pluginsEntry = greebleUsrManifestEntries.find((entry) => entry.id === "plugins");
  const topBarsEntry = greebleUsrManifestEntries.find((entry) => entry.id === "topBars");
  const pluginsShippedPath = pluginsEntry ? getGreebleUsrShippedRelativeDirectory(pluginsEntry) : "missing";
  const topBarsShippedPath = topBarsEntry ? getGreebleUsrShippedRelativeDirectory(topBarsEntry) : "missing";

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#0a0c0f",
        color: "#e7eef8",
        fontFamily: "Inter, Segoe UI, sans-serif",
        padding: 12,
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          height: 36,
          borderBottom: "1px solid rgba(255,255,255,0.12)",
        }}
      >
        <strong data-testid="proof-title" style={{ fontSize: 13 }}>
          Tauron UI usr manifest proof
        </strong>
        <span data-testid="usr-static-status">ok</span>
        <span data-testid="usr-fetch-status">{rawImportState.status}</span>
      </header>
      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
          gap: 8,
          paddingTop: 12,
          fontSize: 12,
        }}
      >
        <span data-testid="usr-entry-count">{greebleUsrManifestEntries.length}</span>
        <span data-testid="usr-fetched-entry-count">{rawImportState.entryCount}</span>
        <span data-testid="usr-overlay-count">{profileOverlayCount}</span>
        <span data-testid="usr-plugins-path">{`usr/${pluginsShippedPath}`}</span>
        <span data-testid="usr-topbars-path">{`usr/${topBarsShippedPath}`}</span>
        <span data-testid="usr-plugins-shipped-path">{pluginsShippedPath}</span>
        <span data-testid="usr-topbars-shipped-path">{topBarsShippedPath}</span>
        <span data-testid="usr-fetch-message">{rawImportState.message}</span>
      </section>
    </main>
  );
}

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Proof root element was not found.");
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <UsrManifestSmokePage />
  </React.StrictMode>,
);
