import { useEffect, useMemo, useRef, useState } from "react";

import type { FolderIconRule, FolderIconValue } from "../config/folderIcons";
import type { OverlayResolvedIconTheme } from "../config/iconTheme";
import {
  listExplorerLocation,
  type ExplorerFileEntry,
} from "../runtime/explorerBackend";
import {
  ExplorerPreviewEntryIconImage,
  resolveExplorerPreviewFolderIconSrc,
} from "./explorerPreviewEntryIcons";
import { loadCachedExplorerLocation } from "./explorer/explorerDirectoryCache";
import { ExplorerCollectionPreviewSurface } from "./ExplorerCollectionPreviewSurface";
import type { ExplorerPreviewEntryDragRequest } from "./useExplorerPreviewEntryDirectDrag";

export interface ExplorerFolderPreviewProps {
  folderPath: string;
  folderName: string;
  refreshRevision?: number;
  showHiddenFiles: boolean;
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

export function ExplorerFolderPreview({
  folderPath,
  folderName,
  refreshRevision = 0,
  showHiddenFiles,
  onOpenEntry,
  onStartDragOutEntry,
  jumpToFolderEnabled,
  onToggleJumpToFolder,
  iconTheme,
  folderIconRules,
  defaultFolderIcon,
}: ExplorerFolderPreviewProps) {
  const [entries, setEntries] = useState<ExplorerFileEntry[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const lastLoadedRefreshRevisionRef = useRef(refreshRevision);

  useEffect(() => {
    let active = true;
    const shouldForceRefresh =
      refreshRevision !== lastLoadedRefreshRevisionRef.current;
    lastLoadedRefreshRevisionRef.current = refreshRevision;
    setEntries(null);
    setError(null);
    setLoading(true);

    loadCachedExplorerLocation({
      path: folderPath,
      showHidden: showHiddenFiles,
      listLocation: listExplorerLocation,
      forceRefresh: shouldForceRefresh,
    })
      .then((listing) => {
        if (!active) {
          return;
        }
        setEntries(listing.entries);
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
  }, [folderPath, refreshRevision, showHiddenFiles]);

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
  const previewIconOptions = useMemo(
    () => ({
      iconTheme,
      folderIconRules,
      defaultFolderIcon,
    }),
    [defaultFolderIcon, folderIconRules, iconTheme],
  );
  const folderHeaderIconSrc = useMemo(
    () =>
      resolveExplorerPreviewFolderIconSrc(folderPath, true, previewIconOptions),
    [folderPath, previewIconOptions],
  );
  const emptyFolderIconSrc = useMemo(
    () =>
      resolveExplorerPreviewFolderIconSrc(folderPath, false, previewIconOptions),
    [folderPath, previewIconOptions],
  );

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
            "linear-gradient(180deg, color-mix(in srgb, var(--overlay-bg-card) 92%, var(--overlay-accent) 8%), var(--overlay-bg-card))",
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
          <ExplorerPreviewEntryIconImage src={folderHeaderIconSrc} size={28} />
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

      <ExplorerCollectionPreviewSurface
        collectionKind="folder"
        sectionLabel="Folder Contents"
        entries={entries}
        loading={loading}
        loadingLabel="Loading folder contents..."
        error={error}
        errorTitle="Failed to read folder"
        emptyState={{
          title: "Empty Folder",
          icon: (
            <ExplorerPreviewEntryIconImage
              src={emptyFolderIconSrc}
              size={32}
              style={{ opacity: 0.5 }}
            />
          ),
          subtitle: "Nothing is inside this folder yet.",
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
