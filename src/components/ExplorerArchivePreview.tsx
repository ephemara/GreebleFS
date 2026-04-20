import { useEffect, useState } from "react";
import { FolderArchive, FileSearch, ArrowDownToLine, Loader, HardDriveDownload } from "lucide-react";
import type { ExplorerArchiveFormatDescriptor } from "../config/explorerArchives";
import { explorerBackendContract, type ExplorerArchiveExtractionMode } from "../runtime/explorerBackend";
import { OverlayScrollArea } from "./OverlayScrollArea";

export interface ExplorerArchivePreviewProps {
  archivePath: string;
  archiveName: string;
  archiveSize: number;
  descriptor: ExplorerArchiveFormatDescriptor;
  onExtract: (mode: ExplorerArchiveExtractionMode) => void;
}

export function ExplorerArchivePreview({
  archivePath,
  archiveName,
  archiveSize,
  descriptor,
  onExtract,
}: ExplorerArchivePreviewProps) {
  const [contents, setContents] = useState<string[] | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    setContents(null);

    explorerBackendContract
      .inspectArchive(archivePath)
      .then((items) => {
        if (!active) return;
        setContents(items);
        setLoading(false);
      })
      .catch((err) => {
        if (!active) return;
        setError(String(err));
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [archivePath]);

  function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
    if (bytes < 1024 ** 4) return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
    return `${(bytes / 1024 ** 4).toFixed(2)} TB`;
  }

  const sortedContents = contents ? [...contents].sort() : [];
  const displayCount = 500;
  const isTruncated = sortedContents.length > displayCount;
  const renderContents = sortedContents.slice(0, displayCount);

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
      {/* Header Info */}
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
          <FolderArchive size={28} strokeWidth={1.5} />
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
            title={archiveName}
          >
            {archiveName}
          </div>
          <div
            style={{
              fontSize: 11,
              color: "var(--overlay-text-dim)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
          >
            <span>{descriptor.label}</span>
            <span>·</span>
            <span>{formatSize(archiveSize)}</span>
            {contents && (
              <>
                <span>·</span>
                <span>
                  {contents.length} item{contents.length === 1 ? "" : "s"}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <button
            onClick={() => onExtract("extractHere")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              background: "var(--overlay-explorer-chip-active-bg)",
              border: "1px solid var(--overlay-explorer-chip-active-border)",
              color: "var(--overlay-explorer-chip-active-text)",
              padding: "6px 12px",
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            <ArrowDownToLine size={14} />
            Extract Here
          </button>
          <button
            onClick={() => onExtract("extractToNewFolder")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              background: "var(--overlay-explorer-chip-bg)",
              border: "1px solid var(--overlay-explorer-chip-border)",
              color: "var(--overlay-text-primary)",
              padding: "6px 12px",
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            <HardDriveDownload size={14} />
            Extract to Folder
          </button>
        </div>
      </div>

      {/* Loading / Error / Contents */}
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--overlay-explorer-preview-border)", fontSize: 11, fontWeight: 700, color: "var(--overlay-text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", background: "var(--overlay-bg-panel)" }}>
          Archive Contents
        </div>

        {loading ? (
          <div style={{ flex: 1, display: "grid", placeItems: "center", color: "var(--overlay-text-dim)", gap: 12 }}>
            <Loader className="animate-spin" size={24} />
            <div style={{ fontSize: 12 }}>Inspecting archive...</div>
          </div>
        ) : error ? (
          <div style={{ flex: 1, display: "grid", placeItems: "center", padding: 24, textAlign: "center", color: "var(--overlay-danger)", gap: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>Failed to read archive</div>
            <div style={{ fontSize: 12, opacity: 0.8, maxWidth: 300 }}>{error}</div>
          </div>
        ) : contents && contents.length === 0 ? (
          <div style={{ flex: 1, display: "grid", placeItems: "center", color: "var(--overlay-text-dim)" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
              <FileSearch size={32} opacity={0.5} />
              <div style={{ fontSize: 13 }}>Empty Archive</div>
            </div>
          </div>
        ) : (
          <OverlayScrollArea
            style={{ flex: 1, minHeight: 0 }}
            scrollbarStyle="explorer-file-list"
          >
            {renderContents.map((path, index) => {
              const segments = path.split(/[/\\]/);
              const name = segments.pop() || path;
              const dir = segments.join("/");
              
              return (
                <div
                  key={index}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "8px 16px",
                    borderBottom: "1px solid var(--overlay-border)",
                    fontSize: 12,
                  }}
                >
                  <FileSearch size={14} color="var(--overlay-text-dim)" />
                  <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                    <div style={{ fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={name}>
                      {name}
                    </div>
                    {dir && (
                      <div style={{ fontSize: 10, color: "var(--overlay-text-dim)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={dir}>
                        {dir}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            {isTruncated && (
              <div style={{ padding: "16px", textAlign: "center", color: "var(--overlay-text-dim)", fontSize: 11, fontStyle: "italic" }}>
                ... and {contents!.length - displayCount} more items
              </div>
            )}
          </OverlayScrollArea>
        )}
      </div>
    </div>
  );
}
