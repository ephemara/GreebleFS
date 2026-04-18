import { useEffect, useMemo, useState } from "react";
import { File, Folder, FolderOpen, Loader } from "lucide-react";
import {
  listExplorerDirUncached,
  type ExplorerFileEntry,
} from "../runtime/explorerBackend";

export interface ExplorerFolderPreviewProps {
  folderPath: string;
  folderName: string;
  showHiddenFiles: boolean;
  onOpenEntry: (entry: ExplorerFileEntry) => void;
}

const FOLDER_PREVIEW_ENTRY_LIMIT = 500;

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  if (bytes < 1024 ** 4) return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
  return `${(bytes / 1024 ** 4).toFixed(2)} TB`;
}

function formatModifiedLabel(timestampMs: number): string | null {
  if (!Number.isFinite(timestampMs) || timestampMs <= 0) {
    return null;
  }
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(timestampMs));
}

function getEntryParentLabel(path: string): string | null {
  const trimmed = path.replace(/[/\\]+$/, "");
  const segments = trimmed.split(/[/\\]/).filter(Boolean);
  if (segments.length <= 1) {
    return null;
  }
  segments.pop();
  return segments.join("/");
}

export function ExplorerFolderPreview({
  folderPath,
  folderName,
  showHiddenFiles,
  onOpenEntry,
}: ExplorerFolderPreviewProps) {
  const [entries, setEntries] = useState<ExplorerFileEntry[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setEntries(null);
    setError(null);
    setLoading(true);

    listExplorerDirUncached(folderPath, showHiddenFiles)
      .then((nextEntries) => {
        if (!active) {
          return;
        }
        setEntries(nextEntries);
        setLoading(false);
      })
      .catch((nextError) => {
        if (!active) {
          return;
        }
        setError(String(nextError));
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [folderPath, showHiddenFiles]);

  const folderCount = useMemo(
    () => entries?.filter((entry) => entry.is_dir).length ?? 0,
    [entries],
  );
  const fileCount = useMemo(
    () => entries?.filter((entry) => !entry.is_dir).length ?? 0,
    [entries],
  );
  const totalVisibleFileBytes = useMemo(
    () =>
      entries?.reduce(
        (sum, entry) => sum + (entry.is_dir ? 0 : Math.max(0, entry.size)),
        0,
      ) ?? 0,
    [entries],
  );
  const renderEntries = entries?.slice(0, FOLDER_PREVIEW_ENTRY_LIMIT) ?? [];
  const isTruncated =
    entries != null && entries.length > FOLDER_PREVIEW_ENTRY_LIMIT;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        background: "var(--overlay-explorer-preview-bg)",
        color: "var(--overlay-text-primary)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "24px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 12,
          borderBottom: "1px solid var(--overlay-explorer-preview-border)",
          background: "var(--overlay-bg-card)",
        }}
      >
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: 12,
            background: "var(--overlay-explorer-chip-bg)",
            display: "grid",
            placeItems: "center",
            color: "var(--overlay-accent)",
          }}
        >
          <FolderOpen size={28} strokeWidth={1.5} />
        </div>
        <div style={{ textAlign: "center", display: "grid", gap: 4 }}>
          <div
            style={{
              fontSize: 14,
              fontWeight: 600,
              maxWidth: 320,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
            title={folderName}
          >
            {folderName}
          </div>
          <div
            style={{
              fontSize: 11,
              color: "var(--overlay-text-dim)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            <span>{folderCount} folder{folderCount === 1 ? "" : "s"}</span>
            <span>·</span>
            <span>{fileCount} file{fileCount === 1 ? "" : "s"}</span>
            <span>·</span>
            <span>{formatSize(totalVisibleFileBytes)} visible</span>
            <span>·</span>
            <span>{showHiddenFiles ? "Hidden shown" : "Hidden filtered"}</span>
          </div>
          <div
            title={folderPath}
            style={{
              fontSize: 10,
              color: "var(--overlay-text-muted)",
              maxWidth: 360,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              fontFamily: "monospace",
            }}
          >
            {folderPath}
          </div>
        </div>
      </div>

      <div
        style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}
      >
        <div
          style={{
            padding: "12px 16px",
            borderBottom: "1px solid var(--overlay-explorer-preview-border)",
            fontSize: 11,
            fontWeight: 700,
            color: "var(--overlay-text-muted)",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            background: "var(--overlay-bg-panel)",
          }}
        >
          Folder Contents
        </div>

        {loading ? (
          <div
            style={{
              flex: 1,
              display: "grid",
              placeItems: "center",
              color: "var(--overlay-text-dim)",
              gap: 12,
            }}
          >
            <Loader className="animate-spin" size={24} />
            <div style={{ fontSize: 12 }}>Loading folder contents...</div>
          </div>
        ) : error ? (
          <div
            style={{
              flex: 1,
              display: "grid",
              placeItems: "center",
              padding: 24,
              textAlign: "center",
              color: "var(--overlay-danger)",
              gap: 8,
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 600 }}>
              Failed to read folder
            </div>
            <div style={{ fontSize: 12, opacity: 0.8, maxWidth: 300 }}>{error}</div>
          </div>
        ) : entries && entries.length === 0 ? (
          <div
            style={{
              flex: 1,
              display: "grid",
              placeItems: "center",
              color: "var(--overlay-text-dim)",
            }}
          >
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 12,
              }}
            >
              <Folder size={32} opacity={0.5} />
              <div style={{ fontSize: 13 }}>Empty Folder</div>
            </div>
          </div>
        ) : (
          <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden" }}>
            {renderEntries.map((entry) => {
              const modifiedLabel = formatModifiedLabel(entry.modified);
              const parentLabel = getEntryParentLabel(entry.path);
              return (
                <button
                  type="button"
                  key={entry.path}
                  onClick={() => onOpenEntry(entry)}
                  aria-label={
                    entry.is_dir
                      ? `Open folder ${entry.name}`
                      : `Open file ${entry.name}`
                  }
                  title={
                    entry.is_dir
                      ? `Open folder ${entry.name}`
                      : `Open file ${entry.name}`
                  }
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "8px 16px",
                    borderBottom: "1px solid var(--overlay-border)",
                    fontSize: 12,
                    width: "100%",
                    borderLeft: "none",
                    borderRight: "none",
                    borderTop: "none",
                    background: "transparent",
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                  onMouseEnter={(event) => {
                    event.currentTarget.style.background =
                      "var(--overlay-explorer-item-hover-bg)";
                  }}
                  onMouseLeave={(event) => {
                    event.currentTarget.style.background = "transparent";
                  }}
                >
                  <div
                    style={{
                      width: 20,
                      height: 20,
                      display: "grid",
                      placeItems: "center",
                      color: entry.is_dir
                        ? "var(--overlay-accent)"
                        : "var(--overlay-text-dim)",
                      flexShrink: 0,
                    }}
                  >
                    {entry.is_dir ? <Folder size={15} /> : <File size={15} />}
                  </div>
                  <div
                    style={{
                      minWidth: 0,
                      flex: 1,
                      display: "flex",
                      flexDirection: "column",
                      gap: 2,
                    }}
                  >
                    <div
                      style={{
                        fontWeight: 500,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                      title={entry.name}
                    >
                      {entry.name}
                    </div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        minWidth: 0,
                        flexWrap: "wrap",
                        color: "var(--overlay-text-dim)",
                        fontSize: 10,
                      }}
                    >
                      {parentLabel && (
                        <span
                          title={parentLabel}
                          style={{
                            maxWidth: 180,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {parentLabel}
                        </span>
                      )}
                      {parentLabel && modifiedLabel && <span>·</span>}
                      {modifiedLabel && <span>{modifiedLabel}</span>}
                    </div>
                  </div>
                  <div
                    style={{
                      flexShrink: 0,
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      color: "var(--overlay-text-dim)",
                      fontSize: 10,
                    }}
                  >
                    {!entry.is_dir && entry.extension && (
                      <span
                        style={{
                          padding: "2px 6px",
                          borderRadius: 999,
                          border: "1px solid var(--overlay-explorer-chip-border)",
                          background: "var(--overlay-explorer-chip-bg)",
                          color: "var(--overlay-text-muted)",
                          textTransform: "uppercase",
                          letterSpacing: "0.04em",
                        }}
                      >
                        {entry.extension}
                      </span>
                    )}
                    <span>{entry.is_dir ? "Folder" : formatSize(entry.size)}</span>
                  </div>
                </button>
              );
            })}
            {isTruncated && (
              <div
                style={{
                  padding: "16px",
                  textAlign: "center",
                  color: "var(--overlay-text-dim)",
                  fontSize: 11,
                  fontStyle: "italic",
                }}
              >
                ... and {entries!.length - FOLDER_PREVIEW_ENTRY_LIMIT} more items
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
