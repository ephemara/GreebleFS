import { useEffect, useMemo, useState } from "react";

import {
  ArrowDownToLine,
  FileSearch,
  FolderArchive,
  HardDriveDownload,
} from "@/components/AppIcons";

import type { FolderIconRule, FolderIconValue } from "../config/folderIcons";
import type { OverlayResolvedIconTheme } from "../config/iconTheme";
import {
  getExplorerArchiveRecommendedWorkflowLabel,
  type ExplorerArchiveFormatDescriptor,
} from "../config/explorerArchives";
import {
  explorerBackendContract,
  type ExplorerArchiveExtractionMode,
  type ExplorerFileEntry,
} from "../runtime/explorerBackend";
import { ExplorerCollectionPreviewSurface } from "./ExplorerCollectionPreviewSurface";
import type { ExplorerPreviewEntryDragRequest } from "./useExplorerPreviewEntryDirectDrag";

export interface ExplorerArchivePreviewProps {
  archivePath: string;
  archiveName: string;
  archiveSize: number;
  descriptor: ExplorerArchiveFormatDescriptor;
  onExtract: (mode: ExplorerArchiveExtractionMode) => void;
  onOpenEntry: (entry: ExplorerFileEntry) => void;
  onStartDragOutEntry?: (
    request: ExplorerPreviewEntryDragRequest<ExplorerFileEntry>,
  ) => void;
  jumpToFolderEnabled?: boolean;
  onToggleJumpToFolder?: () => void;
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

function buildArchiveActionButtonStyle(isRecommended: boolean) {
  return {
    display: "flex",
    alignItems: "center",
    gap: 6,
    background: isRecommended
      ? "var(--overlay-explorer-chip-active-bg)"
      : "var(--overlay-explorer-chip-bg)",
    border: isRecommended
      ? "1px solid var(--overlay-explorer-chip-active-border)"
      : "1px solid var(--overlay-explorer-chip-border)",
    color: isRecommended
      ? "var(--overlay-explorer-chip-active-text)"
      : "var(--overlay-text-primary)",
    padding: "6px 12px",
    borderRadius: 6,
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
  } as const;
}

export function ExplorerArchivePreview({
  archivePath,
  archiveName,
  archiveSize,
  descriptor,
  onExtract,
  onOpenEntry,
  onStartDragOutEntry,
  jumpToFolderEnabled,
  onToggleJumpToFolder,
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
  const recommendedWorkflowLabel = getExplorerArchiveRecommendedWorkflowLabel(
    descriptor.recommendedWorkflow,
  );
  const recommendExtractFirst =
    descriptor.recommendedWorkflow === "extract-first";

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
          background:
            "linear-gradient(180deg, color-mix(in srgb, var(--overlay-bg-card) 90%, var(--overlay-accent) 10%), var(--overlay-bg-card))",
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
            boxShadow: "0 14px 30px color-mix(in srgb, black 24%, transparent)",
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

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          <span
            style={{
              padding: "4px 10px",
              borderRadius: 999,
              border: "1px solid var(--overlay-explorer-chip-border)",
              background: "var(--overlay-explorer-chip-bg)",
              color: "var(--overlay-text-muted)",
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.05em",
              textTransform: "uppercase",
            }}
          >
            {descriptor.accessSummary}
          </span>
          <span
            style={{
              padding: "4px 10px",
              borderRadius: 999,
              border: "1px solid var(--overlay-explorer-chip-active-border)",
              background: "var(--overlay-explorer-chip-active-bg)",
              color: "var(--overlay-explorer-chip-active-text)",
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.05em",
              textTransform: "uppercase",
            }}
          >
            Recommended: {recommendedWorkflowLabel}
          </span>
        </div>

        <div
          style={{
            fontSize: 11,
            color: "var(--overlay-text-dim)",
            lineHeight: 1.5,
            maxWidth: 420,
            textAlign: "center",
          }}
        >
          {descriptor.workflowHint}
        </div>

        <div
          style={{
            display: "flex",
            gap: 8,
            marginTop: 4,
            flexWrap: "wrap",
            justifyContent: "center",
          }}
        >
          {recommendExtractFirst ? (
            <>
              <button
                type="button"
                data-overlay-recommended-action="true"
                onClick={() => onExtract("extractToNewFolder")}
                style={buildArchiveActionButtonStyle(true)}
              >
                <HardDriveDownload size={14} />
                Extract to New Folder
              </button>
              <button
                type="button"
                onClick={() => onExtract("extractHere")}
                style={buildArchiveActionButtonStyle(false)}
              >
                <ArrowDownToLine size={14} />
                Extract Here
              </button>
              <button
                type="button"
                onClick={() => onExtract("extractToDirectory")}
                style={buildArchiveActionButtonStyle(false)}
              >
                <FileSearch size={14} />
                Extract To...
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                data-overlay-recommended-action="true"
                onClick={() => onExtract("extractHere")}
                style={buildArchiveActionButtonStyle(true)}
              >
                <ArrowDownToLine size={14} />
                Extract Here
              </button>
              <button
                type="button"
                onClick={() => onExtract("extractToDirectory")}
                style={buildArchiveActionButtonStyle(false)}
              >
                <FileSearch size={14} />
                Extract To...
              </button>
              <button
                type="button"
                onClick={() => onExtract("extractToNewFolder")}
                style={buildArchiveActionButtonStyle(false)}
              >
                <HardDriveDownload size={14} />
                Extract to New Folder
              </button>
            </>
          )}
        </div>
      </div>

      <ExplorerCollectionPreviewSurface
        collectionKind="archive"
        sectionLabel="Archive Root"
        entries={entries}
        loading={loading}
        loadingLabel="Inspecting archive..."
        error={error}
        errorTitle="Failed to read archive"
        emptyState={{
          title: "Empty Archive",
          icon: <FileSearch size={32} opacity={0.5} />,
          subtitle:
            "The archive root resolved cleanly, but it does not expose any entries.",
        }}
        onOpenEntry={onOpenEntry}
        onStartDragOutEntry={onStartDragOutEntry}
        jumpToFolderEnabled={jumpToFolderEnabled}
        onToggleJumpToFolder={onToggleJumpToFolder}
        iconTheme={iconTheme}
        folderIconRules={folderIconRules}
        defaultFolderIcon={defaultFolderIcon}
      />
    </div>
  );
}
