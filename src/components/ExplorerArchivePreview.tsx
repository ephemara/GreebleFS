import { useEffect, useMemo, useState } from "react";

import {
  ArrowDownToLine,
  FileSearch,
  FolderArchive,
  HardDriveDownload,
  Loader,
} from "@/components/AppIcons";

import type { ExplorerArchiveFormatDescriptor } from "../config/explorerArchives";
import type { FolderIconRule, FolderIconValue } from "../config/folderIcons";
import type { OverlayResolvedIconTheme } from "../config/iconTheme";
import {
  explorerBackendContract,
  type ExplorerArchiveExtractionMode,
  type ExplorerFileEntry,
} from "../runtime/explorerBackend";
import {
  ExplorerPreviewEntryIconImage,
  resolveExplorerPreviewEntryIconSrc,
} from "./explorerPreviewEntryIcons";
import { OverlayScrollArea } from "./OverlayScrollArea";
import { useExplorerPreviewEntryDirectDrag } from "./useExplorerPreviewEntryDirectDrag";

export interface ExplorerArchivePreviewProps {
  archivePath: string;
  archiveName: string;
  archiveSize: number;
  descriptor: ExplorerArchiveFormatDescriptor;
  onExtract: (mode: ExplorerArchiveExtractionMode) => void;
  onOpenEntry: (entry: ExplorerFileEntry) => void;
  onStartDragOutEntry?: (entry: ExplorerFileEntry) => void;
  iconTheme?: OverlayResolvedIconTheme;
  folderIconRules?: readonly FolderIconRule[];
  defaultFolderIcon?: FolderIconValue;
}

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

export function ExplorerArchivePreview({
  archivePath,
  archiveName,
  archiveSize,
  descriptor,
  onExtract,
  onOpenEntry,
  onStartDragOutEntry,
  iconTheme,
  folderIconRules,
  defaultFolderIcon,
}: ExplorerArchivePreviewProps) {
  const [entries, setEntries] = useState<ExplorerFileEntry[] | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    setEntries(null);

    explorerBackendContract
      .listArchiveDir(archivePath, "")
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
  }, [archivePath]);

  const folderCount = useMemo(
    () => entries?.filter((entry) => entry.is_dir).length ?? 0,
    [entries],
  );
  const fileCount = useMemo(
    () => entries?.filter((entry) => !entry.is_dir).length ?? 0,
    [entries],
  );
  const previewIconOptions = useMemo(
    () => ({
      iconTheme,
      folderIconRules,
      defaultFolderIcon,
    }),
    [defaultFolderIcon, folderIconRules, iconTheme],
  );
  const { bindPreviewEntryDirectDrag, shouldSuppressPreviewEntryClick } =
    useExplorerPreviewEntryDirectDrag<ExplorerFileEntry>({
      onStartDrag: (entry) => {
        onStartDragOutEntry?.(entry);
      },
    });

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
              flexWrap: "wrap",
            }}
          >
            <span>{descriptor.label}</span>
            <span>·</span>
            <span>{formatSize(archiveSize)}</span>
            <span>·</span>
            <span>{folderCount} folder{folderCount === 1 ? "" : "s"}</span>
            <span>·</span>
            <span>{fileCount} file{fileCount === 1 ? "" : "s"}</span>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <button
            type="button"
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
            type="button"
            onClick={() => onExtract("extractToDirectory")}
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
            <FileSearch size={14} />
            Extract To...
          </button>
          <button
            type="button"
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
            Extract to New Folder
          </button>
        </div>
      </div>

      <div
        style={{
          flex: 1,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
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
          Archive Root
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
            <div style={{ fontSize: 12 }}>Inspecting archive...</div>
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
              Failed to read archive
            </div>
            <div style={{ fontSize: 12, opacity: 0.8, maxWidth: 300 }}>
              {error}
            </div>
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
              <FileSearch size={32} opacity={0.5} />
              <div style={{ fontSize: 13 }}>Empty Archive</div>
            </div>
          </div>
        ) : (
          <OverlayScrollArea
            style={{ flex: 1, minHeight: 0 }}
            scrollbarStyle="explorer-file-list"
          >
            {(entries ?? []).map((entry) => {
              const modifiedLabel = formatModifiedLabel(entry.modified);
              const previewEntryDragBindings = bindPreviewEntryDirectDrag(
                entry,
                entry.path,
              );
              return (
                <button
                  type="button"
                  key={entry.path}
                  data-overlay-preview-entry-path={entry.path}
                  data-overlay-preview-entry-kind={entry.is_dir ? "folder" : "file"}
                  onClick={() => {
                    if (shouldSuppressPreviewEntryClick(entry.path)) {
                      return;
                    }
                    onOpenEntry(entry);
                  }}
                  aria-label={
                    entry.is_dir
                      ? `Open archive folder ${entry.name}`
                      : `Open archive file ${entry.name}`
                  }
                  title={
                    entry.is_dir
                      ? `Open archive folder ${entry.name}`
                      : `Open archive file ${entry.name}`
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
                  {...previewEntryDragBindings}
                  onMouseEnter={(event) => {
                    event.currentTarget.style.background =
                      "var(--overlay-explorer-item-hover-bg)";
                  }}
                  onMouseLeave={(event) => {
                    event.currentTarget.style.background = "transparent";
                  }}
                >
                  <ExplorerPreviewEntryIconImage
                    src={resolveExplorerPreviewEntryIconSrc(
                      entry,
                      previewIconOptions,
                    )}
                    size={18}
                  />
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
                    {modifiedLabel && (
                      <div
                        style={{
                          color: "var(--overlay-text-dim)",
                          fontSize: 10,
                        }}
                      >
                        {modifiedLabel}
                      </div>
                    )}
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
          </OverlayScrollArea>
        )}
      </div>
    </div>
  );
}
