import React, { useEffect, useMemo, useState } from "react";
import ReactDOM from "react-dom/client";
import { invoke } from "@tauri-apps/api/core";

type FixtureFileEntry = {
  name: string;
  path: string;
  is_dir: boolean;
  size: number;
  extension: string;
};

type PickerMode = "openFolders" | "openFiles";

function leafName(path: string): string {
  return path.split(/[\\/]/).filter(Boolean).at(-1) ?? path;
}

function FixtureHostSmokePage() {
  const [homeDir, setHomeDir] = useState("C:\\workspace\\repo");
  const [entries, setEntries] = useState<FixtureFileEntry[]>([]);
  const [mode, setMode] = useState<PickerMode>("openFolders");
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [confirmedPath, setConfirmedPath] = useState("none");
  const selectedEntry = useMemo(
    () => entries.find((entry) => entry.path === selectedPath) ?? null,
    [entries, selectedPath],
  );

  useEffect(() => {
    let cancelled = false;
    async function loadFixtureDirectory() {
      const root = await invoke<string>("fs_get_home_dir");
      const loadedEntries = await invoke<FixtureFileEntry[]>("fs_list_dir", {
        path: root,
        showHidden: false,
      });
      if (cancelled) {
        return;
      }
      setHomeDir(root);
      setEntries(loadedEntries);
    }
    void loadFixtureDirectory();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectMode = (nextMode: PickerMode) => {
    setMode(nextMode);
    setSelectedPath(null);
    setConfirmedPath("none");
  };

  const confirmSelected = () => {
    if (mode === "openFolders") {
      setConfirmedPath(homeDir);
      return;
    }
    if (selectedEntry && !selectedEntry.is_dir) {
      setConfirmedPath(selectedEntry.path);
    }
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#090b10",
        color: "#e8edf5",
        fontFamily: "Inter, Segoe UI, sans-serif",
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          height: 42,
          padding: "0 10px",
          borderBottom: "1px solid rgba(255,255,255,0.12)",
          background: "#111722",
        }}
      >
        <strong data-testid="proof-title" style={{ fontSize: 13 }}>
          Tauron UI fixture proof
        </strong>
        <button data-testid="mode-folders" onClick={() => selectMode("openFolders")} type="button">
          Folders
        </button>
        <button data-testid="mode-files" onClick={() => selectMode("openFiles")} type="button">
          Files
        </button>
        <span data-testid="picker-mode" style={{ fontSize: 12, opacity: 0.76 }}>
          {mode}
        </span>
        <span data-testid="confirmed-paths" style={{ fontSize: 12, marginLeft: "auto" }}>
          {confirmedPath}
        </span>
      </header>
      <section
        data-testid="fixture-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(132px, 1fr))",
          gap: 8,
          padding: 10,
        }}
      >
        {entries.map((entry) => (
          <button
            key={entry.path}
            data-entry-path={entry.path}
            data-testid={`entry-${entry.name}`}
            onClick={() => setSelectedPath(entry.path)}
            type="button"
            style={{
              minHeight: 74,
              padding: 8,
              border: selectedPath === entry.path
                ? "1px solid #56a6ff"
                : "1px solid rgba(255,255,255,0.12)",
              background: selectedPath === entry.path ? "#17314c" : "#121923",
              color: "#e8edf5",
              textAlign: "left",
            }}
          >
            <span style={{ display: "block", fontSize: 12, fontWeight: 700 }}>
              {entry.is_dir ? "DIR" : entry.extension.toUpperCase() || "FILE"}
            </span>
            <span style={{ display: "block", marginTop: 8, fontSize: 13 }}>
              {leafName(entry.path)}
            </span>
          </button>
        ))}
      </section>
      <footer
        style={{
          position: "fixed",
          right: 10,
          bottom: 10,
          display: "flex",
          gap: 8,
        }}
      >
        <button data-testid="confirm-current-folder" onClick={confirmSelected} type="button">
          {mode === "openFolders" ? "Add Current Folder" : "Choose Files"}
        </button>
      </footer>
    </main>
  );
}

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Proof root element was not found.");
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <FixtureHostSmokePage />
  </React.StrictMode>,
);
