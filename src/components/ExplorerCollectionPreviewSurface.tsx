import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";

import {
  Blocks,
  FileText,
  Film,
  FolderArchive,
  FolderTree,
  LayoutGrid,
  Layers3,
  List,
  Loader,
  ScanLine,
  Sparkles,
} from "@/components/AppIcons";

import {
  getExplorerArchiveDescriptor,
  parseExplorerArchiveVirtualPath,
} from "../config/explorerArchives";
import {
  explorerCollectionPreviewModes,
  type ExplorerCollectionPreviewMode,
} from "../config/explorerCollectionPreviewModes";
import type { FolderIconRule, FolderIconValue } from "../config/folderIcons";
import {
  isAudioPreviewExtension,
  isEditableTextExtension,
  isImagePreviewExtension,
  isModelPreviewExtension,
  isPdfPreviewExtension,
  isShaderPreviewExtension,
  isSpreadsheetPreviewExtension,
  isVideoPreviewExtension,
} from "../config/filePreview";
import type { OverlayResolvedIconTheme } from "../config/iconTheme";
import {
  canRenderExplorerCollectionPreviewOverviewThumbnail,
  readExplorerCollectionPreviewOverviewThumbnail,
} from "../runtime/explorerCollectionPreviewThumbnails";
import type {
  ExplorerEntryThumbnailData,
  ExplorerFileEntry,
} from "../runtime/explorerBackend";
import { useSettingsStore } from "../store/settingsStore";
import {
  ExplorerPreviewEntryIconImage,
  resolveExplorerPreviewEntryIconSrc,
} from "./explorerPreviewEntryIcons";
import { OverlayScrollArea } from "./OverlayScrollArea";
import {
  type ExplorerPreviewEntryDragRequest,
  useExplorerPreviewEntryDirectDrag,
} from "./useExplorerPreviewEntryDirectDrag";

const COLLECTION_PREVIEW_ENTRY_LIMIT = 500;

const COLLECTION_PREVIEW_OVERVIEW_BATCH_SIZE = 12;
const COLLECTION_PREVIEW_OVERVIEW_THUMBNAIL_DIMENSION_PX = 240;

type ExplorerCollectionPreviewKind = "folder" | "archive";
type ExplorerCollectionEntryCategory =
  | "folders"
  | "media"
  | "documents"
  | "code"
  | "packages"
  | "other";

type ExplorerCollectionRecencyBucket =
  | "fresh"
  | "recent"
  | "older"
  | "undated";

interface ExplorerCollectionPreviewEmptyState {
  title: string;
  icon: ReactNode;
  subtitle?: string;
}

export interface ExplorerCollectionPreviewSurfaceProps {
  collectionKind: ExplorerCollectionPreviewKind;
  sectionLabel: string;
  entries: ExplorerFileEntry[] | null;
  loading: boolean;
  loadingLabel: string;
  error: string | null;
  errorTitle: string;
  emptyState: ExplorerCollectionPreviewEmptyState;
  onOpenEntry: (entry: ExplorerFileEntry) => void;
  onStartDragOutEntry?: (
    request: ExplorerPreviewEntryDragRequest<ExplorerFileEntry>,
  ) => void;
  iconTheme?: OverlayResolvedIconTheme;
  folderIconRules?: readonly FolderIconRule[];
  defaultFolderIcon?: FolderIconValue;
}

const categoryDefinitions: readonly {
  id: ExplorerCollectionEntryCategory;
  label: string;
  icon: typeof FolderTree;
}[] = [
  { id: "folders", label: "Folders", icon: FolderTree },
  { id: "media", label: "Media", icon: Film },
  { id: "documents", label: "Docs", icon: FileText },
  { id: "code", label: "Code", icon: Blocks },
  { id: "packages", label: "Packages", icon: FolderArchive },
  { id: "other", label: "Other", icon: Sparkles },
] as const;

const recencyBucketDefinitions: readonly {
  id: ExplorerCollectionRecencyBucket;
  label: string;
  accent: string;
}[] = [
  { id: "fresh", label: "Fresh", accent: "var(--overlay-accent)" },
  { id: "recent", label: "Recent", accent: "var(--overlay-warning)" },
  { id: "older", label: "Older", accent: "var(--overlay-text-dim)" },
  { id: "undated", label: "Undated", accent: "var(--overlay-text-muted)" },
] as const;

export function ExplorerCollectionPreviewSurface({
  collectionKind,
  sectionLabel,
  entries,
  loading,
  loadingLabel,
  error,
  errorTitle,
  emptyState,
  onOpenEntry,
  onStartDragOutEntry,
  iconTheme,
  folderIconRules,
  defaultFolderIcon,
}: ExplorerCollectionPreviewSurfaceProps) {
  const collectionPreviewMode = useSettingsStore(
    (state) => state.settings.explorer.collectionPreviewMode,
  );
  const updateExplorerSettings = useSettingsStore((state) => state.updateExplorer);
  const [hoveredEntryPath, setHoveredEntryPath] = useState<string | null>(null);
  const [overviewThumbnailMap, setOverviewThumbnailMap] = useState<
    Record<string, ExplorerEntryThumbnailData | null>
  >({});
  const [overviewThumbnailLoadingPaths, setOverviewThumbnailLoadingPaths] =
    useState<Set<string>>(() => new Set());

  const previewIconOptions = useMemo(
    () => ({
      iconTheme,
      folderIconRules,
      defaultFolderIcon,
    }),
    [defaultFolderIcon, folderIconRules, iconTheme],
  );
  const renderEntries = entries?.slice(0, COLLECTION_PREVIEW_ENTRY_LIMIT) ?? [];
  const isTruncated =
    entries != null && entries.length > COLLECTION_PREVIEW_ENTRY_LIMIT;
  const { bindPreviewEntryDirectDrag, isPreviewEntrySelected } =
    useExplorerPreviewEntryDirectDrag<ExplorerFileEntry>({
      entries: renderEntries,
      getEntryKey: (entry) => entry.path,
      onOpenEntry,
      onStartDrag: (request) => {
        onStartDragOutEntry?.(request);
      },
    });

  useEffect(() => {
    const currentPathSet = new Set(renderEntries.map((entry) => entry.path));
    setOverviewThumbnailMap((currentMap) => {
      const nextEntries = Object.entries(currentMap).filter(([path]) =>
        currentPathSet.has(path),
      );
      if (nextEntries.length === Object.keys(currentMap).length) {
        return currentMap;
      }
      return Object.fromEntries(nextEntries);
    });
    setOverviewThumbnailLoadingPaths((currentSet) => {
      const nextSet = new Set(
        [...currentSet].filter((path) => currentPathSet.has(path)),
      );
      return nextSet.size === currentSet.size ? currentSet : nextSet;
    });
    setHoveredEntryPath((currentPath) =>
      currentPath && currentPathSet.has(currentPath) ? currentPath : null,
    );
  }, [renderEntries]);

  useEffect(() => {
    if (
      collectionPreviewMode !== "overview" ||
      loading ||
      renderEntries.length === 0
    ) {
      return;
    }

    const pendingEntries = renderEntries
      .filter(
        (entry) =>
          canRenderExplorerCollectionPreviewOverviewThumbnail(entry) &&
          overviewThumbnailMap[entry.path] === undefined &&
          !overviewThumbnailLoadingPaths.has(entry.path),
      )
      .slice(0, COLLECTION_PREVIEW_OVERVIEW_BATCH_SIZE);

    if (pendingEntries.length === 0) {
      return;
    }

    const pendingPaths = pendingEntries.map((entry) => entry.path);
    let cancelled = false;
    const batchTimer = window.setTimeout(() => {
      setOverviewThumbnailLoadingPaths((current) => {
        const next = new Set(current);
        for (const path of pendingPaths) {
          next.add(path);
        }
        return next;
      });

      void Promise.all(
        pendingEntries.map(async (entry) => ({
          path: entry.path,
          thumbnail: await readExplorerCollectionPreviewOverviewThumbnail({
            entry,
            maxWidth: COLLECTION_PREVIEW_OVERVIEW_THUMBNAIL_DIMENSION_PX,
            maxHeight: COLLECTION_PREVIEW_OVERVIEW_THUMBNAIL_DIMENSION_PX,
          }).catch(() => null),
        })),
      ).then((results) => {
        if (cancelled) {
          return;
        }
        setOverviewThumbnailMap((current) => {
          const next = { ...current };
          for (const result of results) {
            next[result.path] = result.thumbnail;
          }
          return next;
        });
        setOverviewThumbnailLoadingPaths((current) => {
          const next = new Set(current);
          for (const path of pendingPaths) {
            next.delete(path);
          }
          return next;
        });
      });
    }, 48);

    return () => {
      cancelled = true;
      window.clearTimeout(batchTimer);
    };
  }, [
    collectionPreviewMode,
    loading,
    overviewThumbnailLoadingPaths,
    overviewThumbnailMap,
    renderEntries,
  ]);

  const categorizedEntries = useMemo(
    () =>
      categoryDefinitions
        .map((definition) => ({
          ...definition,
          entries: renderEntries.filter(
            (entry) =>
              resolveCollectionEntryCategory(entry) === definition.id,
          ),
        }))
        .filter((definition) => definition.entries.length > 0),
    [renderEntries],
  );

  const recencyBuckets = useMemo(
    () =>
      recencyBucketDefinitions
        .map((definition) => ({
          ...definition,
          entries: renderEntries.filter(
            (entry) => resolveCollectionEntryRecencyBucket(entry) === definition.id,
          ),
        }))
        .filter((definition) => definition.entries.length > 0),
    [renderEntries],
  );

  const visibleCountLabel =
    entries == null
      ? "..."
      : isTruncated
        ? `${renderEntries.length}/${entries.length}`
        : `${renderEntries.length}`;

  return (
    <div
      data-overlay-collection-preview-mode={collectionPreviewMode}
      style={{
        flex: 1,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          padding: "10px 14px",
          borderBottom: "1px solid var(--overlay-explorer-preview-border)",
          fontSize: 11,
          fontWeight: 700,
          color: "var(--overlay-text-muted)",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          background:
            "linear-gradient(180deg, color-mix(in srgb, var(--overlay-bg-panel) 92%, var(--overlay-accent) 8%), var(--overlay-bg-panel))",
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) auto minmax(0, 1fr)",
          alignItems: "center",
          gap: 10,
        }}
      >
        <div style={{ minWidth: 0 }}>{sectionLabel}</div>
        <div
          role="toolbar"
          aria-label={`${sectionLabel} preview mode`}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: 4,
            borderRadius: 999,
            border: "1px solid var(--overlay-explorer-chip-border)",
            background: "var(--overlay-explorer-chip-bg)",
            justifySelf: "center",
          }}
        >
          {explorerCollectionPreviewModes.map((modeDefinition) => {
            const Icon = resolveModeIcon(modeDefinition.id);
            const isActive = collectionPreviewMode === modeDefinition.id;
            return (
              <button
                key={modeDefinition.id}
                type="button"
                aria-label={`Use ${modeDefinition.label} preview mode`}
                title={`${modeDefinition.label} — ${modeDefinition.description}`}
                aria-pressed={isActive}
                data-overlay-collection-preview-mode-button={modeDefinition.id}
                onClick={() =>
                  updateExplorerSettings({
                    collectionPreviewMode: modeDefinition.id,
                  })
                }
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 999,
                  border: isActive
                    ? "1px solid var(--overlay-explorer-chip-active-border)"
                    : "1px solid transparent",
                  background: isActive
                    ? "var(--overlay-explorer-chip-active-bg)"
                    : "transparent",
                  color: isActive
                    ? "var(--overlay-explorer-chip-active-text)"
                    : "var(--overlay-text-dim)",
                  display: "grid",
                  placeItems: "center",
                  cursor: "pointer",
                  transition:
                    "transform 140ms ease, background 140ms ease, border-color 140ms ease",
                }}
              >
                <Icon size={14} strokeWidth={1.8} />
              </button>
            );
          })}
        </div>
        <div
          style={{
            justifySelf: "end",
            padding: "3px 8px",
            borderRadius: 999,
            border: "1px solid var(--overlay-explorer-chip-border)",
            background: "var(--overlay-explorer-chip-bg)",
            color: "var(--overlay-text-muted)",
          }}
        >
          {visibleCountLabel}
        </div>
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
          <div style={{ fontSize: 12 }}>{loadingLabel}</div>
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
          <div style={{ fontSize: 13, fontWeight: 600 }}>{errorTitle}</div>
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
            {emptyState.icon}
            <div style={{ fontSize: 13 }}>{emptyState.title}</div>
            {emptyState.subtitle ? (
              <div
                style={{
                  fontSize: 11,
                  maxWidth: 280,
                  textAlign: "center",
                  color: "var(--overlay-text-muted)",
                  lineHeight: 1.5,
                }}
              >
                {emptyState.subtitle}
              </div>
            ) : null}
          </div>
        </div>
      ) : (
        <>
          {collectionPreviewMode === "list" ? (
            <OverlayScrollArea
              style={{ flex: 1, minHeight: 0 }}
              scrollbarStyle="explorer-file-list"
            >
              {renderEntries.map((entry) => {
                const previewEntryDragBindings = bindPreviewEntryDirectDrag(entry);
                const isSelected = isPreviewEntrySelected(entry.path);
                const isHovered = hoveredEntryPath === entry.path;
                const modifiedLabel = formatModifiedLabel(entry.modified);
                const parentLabel =
                  collectionKind === "folder"
                    ? getCollectionEntryParentLabel(entry.path)
                    : null;
                return (
                  <button
                    type="button"
                    key={entry.path}
                    data-overlay-preview-entry-path={entry.path}
                    data-overlay-preview-entry-kind={entry.is_dir ? "folder" : "file"}
                    data-overlay-preview-entry-selected={String(isSelected)}
                    aria-label={buildCollectionEntryActionLabel(collectionKind, entry)}
                    title={buildCollectionEntryActionLabel(collectionKind, entry)}
                    aria-pressed={isSelected}
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
                      background: resolveEntryBackground({
                        isSelected,
                        isHovered,
                        variant: "row",
                      }),
                      cursor: "pointer",
                      textAlign: "left",
                      boxShadow: isSelected
                        ? "inset 0 0 0 1px var(--overlay-explorer-chip-active-border)"
                        : "none",
                    }}
                    onMouseEnter={() => setHoveredEntryPath(entry.path)}
                    onMouseLeave={() => setHoveredEntryPath((current) =>
                      current === entry.path ? null : current,
                    )}
                    {...previewEntryDragBindings}
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
                        {parentLabel ? (
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
                        ) : null}
                        {parentLabel && modifiedLabel ? <span>·</span> : null}
                        {modifiedLabel ? <span>{modifiedLabel}</span> : null}
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
                      {!entry.is_dir && entry.extension ? (
                        <span style={entryPillStyle()}>
                          {entry.extension}
                        </span>
                      ) : null}
                      <span>{entry.is_dir ? "Folder" : formatSize(entry.size)}</span>
                    </div>
                  </button>
                );
              })}
            </OverlayScrollArea>
          ) : collectionPreviewMode === "overview" ? (
            <OverlayScrollArea
              style={{ flex: 1, minHeight: 0 }}
              scrollbarStyle="explorer-file-list"
              viewportStyle={{ padding: 14 }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(92px, 1fr))",
                  gap: 10,
                }}
              >
                {renderEntries.map((entry) =>
                  renderOverviewEntryCard({
                    entry,
                    collectionKind,
                    bindPreviewEntryDirectDrag,
                    isSelected: isPreviewEntrySelected(entry.path),
                    isHovered: hoveredEntryPath === entry.path,
                    iconSrc: resolveExplorerPreviewEntryIconSrc(
                      entry,
                      previewIconOptions,
                    ),
                    thumbnail: overviewThumbnailMap[entry.path] ?? null,
                    isThumbnailLoading:
                      overviewThumbnailLoadingPaths.has(entry.path),
                    onHoverStart: setHoveredEntryPath,
                  }),
                )}
              </div>
            </OverlayScrollArea>
          ) : collectionPreviewMode === "strata" ? (
            <OverlayScrollArea
              style={{ flex: 1, minHeight: 0 }}
              scrollbarStyle="explorer-file-list"
              viewportStyle={{ padding: 14 }}
            >
              <div style={{ display: "grid", gap: 12 }}>
                {categorizedEntries.map((group) => (
                  <section
                    key={group.id}
                    style={{
                      display: "grid",
                      gap: 10,
                      padding: 12,
                      borderRadius: 16,
                      border:
                        "1px solid color-mix(in srgb, var(--overlay-explorer-preview-border) 78%, transparent)",
                      background:
                        "linear-gradient(135deg, color-mix(in srgb, var(--overlay-bg-card) 88%, var(--overlay-accent) 12%), color-mix(in srgb, var(--overlay-bg-panel) 94%, transparent))",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 12,
                      }}
                    >
                      <div
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 8,
                          fontSize: 10,
                          fontWeight: 700,
                          textTransform: "uppercase",
                          letterSpacing: "0.08em",
                          color: "var(--overlay-text-muted)",
                        }}
                      >
                        <group.icon size={14} strokeWidth={1.7} />
                        {group.label}
                      </div>
                      <span style={entryPillStyle()}>{group.entries.length}</span>
                    </div>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns:
                          "repeat(auto-fill, minmax(48px, max-content))",
                        gap: 8,
                      }}
                    >
                      {group.entries.map((entry) =>
                        renderIconNode({
                          entry,
                          collectionKind,
                          variant: "strata",
                          bindPreviewEntryDirectDrag,
                          isSelected: isPreviewEntrySelected(entry.path),
                          isHovered: hoveredEntryPath === entry.path,
                          iconSrc: resolveExplorerPreviewEntryIconSrc(
                            entry,
                            previewIconOptions,
                          ),
                          onHoverStart: setHoveredEntryPath,
                        }),
                      )}
                    </div>
                  </section>
                ))}
              </div>
            </OverlayScrollArea>
          ) : collectionPreviewMode === "timeline" ? (
            <OverlayScrollArea
              style={{ flex: 1, minHeight: 0 }}
              scrollbarStyle="explorer-file-list"
              viewportStyle={{ padding: 14 }}
            >
              <div style={{ display: "grid", gap: 14 }}>
                {recencyBuckets.map((bucket) => (
                  <section
                    key={bucket.id}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "72px minmax(0, 1fr)",
                      gap: 12,
                      alignItems: "stretch",
                    }}
                  >
                    <div
                      style={{
                        display: "grid",
                        alignContent: "start",
                        gap: 6,
                        paddingTop: 6,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          textTransform: "uppercase",
                          letterSpacing: "0.08em",
                          color: bucket.accent,
                        }}
                      >
                        {bucket.label}
                      </div>
                      <div
                        style={{
                          fontSize: 10,
                          color: "var(--overlay-text-muted)",
                        }}
                      >
                        {bucket.entries.length}
                      </div>
                    </div>
                    <div
                      style={{
                        position: "relative",
                        display: "grid",
                        gap: 10,
                        padding: "12px 12px 12px 18px",
                        borderRadius: 16,
                        border:
                          "1px solid color-mix(in srgb, var(--overlay-explorer-preview-border) 78%, transparent)",
                        background:
                          "linear-gradient(180deg, color-mix(in srgb, var(--overlay-bg-card) 90%, transparent), color-mix(in srgb, var(--overlay-bg-panel) 94%, transparent))",
                      }}
                    >
                      <div
                        aria-hidden="true"
                        style={{
                          position: "absolute",
                          left: 9,
                          top: 12,
                          bottom: 12,
                          width: 2,
                          borderRadius: 999,
                          background: bucket.accent,
                          opacity: 0.55,
                        }}
                      />
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns:
                            "repeat(auto-fill, minmax(42px, max-content))",
                          gap: 8,
                        }}
                      >
                        {bucket.entries.map((entry) =>
                          renderIconNode({
                            entry,
                            collectionKind,
                            variant: "timeline",
                            bindPreviewEntryDirectDrag,
                            isSelected: isPreviewEntrySelected(entry.path),
                            isHovered: hoveredEntryPath === entry.path,
                            iconSrc: resolveExplorerPreviewEntryIconSrc(
                              entry,
                              previewIconOptions,
                            ),
                            onHoverStart: setHoveredEntryPath,
                          }),
                        )}
                      </div>
                    </div>
                  </section>
                ))}
              </div>
            </OverlayScrollArea>
          ) : (
            <OverlayScrollArea
              style={{ flex: 1, minHeight: 0 }}
              scrollbarStyle="explorer-file-list"
              viewportStyle={{ padding: 14 }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                  gap: 12,
                }}
              >
                {categorizedEntries.map((group) => {
                  const visibleOrbitEntries = group.entries.slice(0, 10);
                  const overflowCount = Math.max(0, group.entries.length - 10);
                  const CenterIcon = group.icon;
                  return (
                    <section
                      key={group.id}
                      style={{
                        position: "relative",
                        minHeight: 156,
                        borderRadius: 18,
                        border:
                          "1px solid color-mix(in srgb, var(--overlay-explorer-preview-border) 78%, transparent)",
                        background:
                          "radial-gradient(circle at 50% 42%, color-mix(in srgb, var(--overlay-accent) 18%, transparent) 0%, transparent 46%), linear-gradient(180deg, color-mix(in srgb, var(--overlay-bg-card) 92%, transparent), color-mix(in srgb, var(--overlay-bg-panel) 94%, transparent))",
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          position: "absolute",
                          inset: 0,
                          pointerEvents: "none",
                          background:
                            "radial-gradient(circle at center, transparent 34%, color-mix(in srgb, var(--overlay-border) 26%, transparent) 35%, transparent 36%)",
                          opacity: 0.7,
                        }}
                      />
                      <div
                        style={{
                          position: "absolute",
                          left: "50%",
                          top: "50%",
                          transform: "translate(-50%, -50%)",
                          width: 60,
                          height: 60,
                          borderRadius: 999,
                          border:
                            "1px solid color-mix(in srgb, var(--overlay-accent) 45%, var(--overlay-explorer-chip-border))",
                          background:
                            "color-mix(in srgb, var(--overlay-explorer-chip-active-bg) 74%, var(--overlay-bg-card))",
                          display: "grid",
                          placeItems: "center",
                          gap: 2,
                          color: "var(--overlay-text-primary)",
                          boxShadow:
                            "0 12px 28px color-mix(in srgb, black 34%, transparent)",
                        }}
                      >
                        <CenterIcon size={16} strokeWidth={1.8} />
                        <div
                          style={{
                            fontSize: 9,
                            fontWeight: 700,
                            textTransform: "uppercase",
                            letterSpacing: "0.06em",
                          }}
                        >
                          {group.entries.length}
                        </div>
                      </div>
                      <div
                        style={{
                          position: "absolute",
                          left: 12,
                          top: 12,
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          fontSize: 10,
                          fontWeight: 700,
                          textTransform: "uppercase",
                          letterSpacing: "0.08em",
                          color: "var(--overlay-text-muted)",
                        }}
                      >
                        <CenterIcon size={12} strokeWidth={1.8} />
                        {group.label}
                      </div>
                      {visibleOrbitEntries.map((entry, index) =>
                        renderOrbitEntry({
                          entry,
                          collectionKind,
                          index,
                          total: visibleOrbitEntries.length,
                          bindPreviewEntryDirectDrag,
                          isSelected: isPreviewEntrySelected(entry.path),
                          isHovered: hoveredEntryPath === entry.path,
                          iconSrc: resolveExplorerPreviewEntryIconSrc(
                            entry,
                            previewIconOptions,
                          ),
                          onHoverStart: setHoveredEntryPath,
                        }),
                      )}
                      {overflowCount > 0 ? (
                        <div
                          style={{
                            position: "absolute",
                            right: 12,
                            bottom: 12,
                            padding: "4px 8px",
                            borderRadius: 999,
                            border: "1px solid var(--overlay-explorer-chip-border)",
                            background: "var(--overlay-explorer-chip-bg)",
                            color: "var(--overlay-text-muted)",
                            fontSize: 10,
                            fontWeight: 700,
                          }}
                        >
                          +{overflowCount}
                        </div>
                      ) : null}
                    </section>
                  );
                })}
              </div>
            </OverlayScrollArea>
          )}
          {isTruncated ? (
            <div
              style={{
                padding: "12px 16px",
                textAlign: "center",
                color: "var(--overlay-text-dim)",
                fontSize: 11,
                fontStyle: "italic",
                borderTop: "1px solid var(--overlay-border)",
                background: "var(--overlay-bg-panel)",
              }}
            >
              ... and {entries!.length - COLLECTION_PREVIEW_ENTRY_LIMIT} more items
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

function renderOverviewEntryCard(args: {
  entry: ExplorerFileEntry;
  collectionKind: ExplorerCollectionPreviewKind;
  bindPreviewEntryDirectDrag: ReturnType<
    typeof useExplorerPreviewEntryDirectDrag<ExplorerFileEntry>
  >["bindPreviewEntryDirectDrag"];
  isSelected: boolean;
  isHovered: boolean;
  iconSrc: string | null;
  thumbnail: ExplorerEntryThumbnailData | null;
  isThumbnailLoading: boolean;
  onHoverStart: (path: string | null) => void;
}) {
  const {
    entry,
    collectionKind,
    bindPreviewEntryDirectDrag,
    isSelected,
    isHovered,
    iconSrc,
    thumbnail,
    isThumbnailLoading,
    onHoverStart,
  } = args;
  const previewEntryDragBindings = bindPreviewEntryDirectDrag(entry);
  return (
    <button
      type="button"
      key={entry.path}
      data-overlay-preview-entry-path={entry.path}
      data-overlay-preview-entry-kind={entry.is_dir ? "folder" : "file"}
      data-overlay-preview-entry-selected={String(isSelected)}
      aria-label={buildCollectionEntryActionLabel(collectionKind, entry)}
      title={buildCollectionEntryTitle(collectionKind, entry)}
      aria-pressed={isSelected}
      style={{
        display: "grid",
        gap: 8,
        padding: 8,
        borderRadius: 16,
        border: resolveCardBorder(isSelected),
        background: resolveEntryBackground({
          isSelected,
          isHovered,
          variant: "card",
        }),
        boxShadow: isSelected
          ? "0 10px 26px color-mix(in srgb, var(--overlay-accent) 22%, transparent)"
          : "none",
        cursor: "pointer",
      }}
      onMouseEnter={() => onHoverStart(entry.path)}
      onMouseLeave={() => onHoverStart(null)}
      {...previewEntryDragBindings}
    >
      <div
        style={{
          position: "relative",
          aspectRatio: "1 / 1",
          borderRadius: 14,
          overflow: "hidden",
          border:
            "1px solid color-mix(in srgb, var(--overlay-explorer-preview-border) 82%, transparent)",
          background:
            "linear-gradient(180deg, color-mix(in srgb, var(--overlay-bg-card) 85%, var(--overlay-accent) 15%), color-mix(in srgb, var(--overlay-bg-panel) 96%, transparent))",
          display: "grid",
          placeItems: "center",
        }}
      >
        {thumbnail?.posterDataUrl ? (
          <img
            src={thumbnail.posterDataUrl}
            alt=""
            aria-hidden="true"
            draggable={false}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              display: "block",
            }}
          />
        ) : isThumbnailLoading ? (
          <Loader className="animate-spin" size={18} />
        ) : iconSrc ? (
          <ExplorerPreviewEntryIconImage src={iconSrc} size={28} />
        ) : null}
        <div
          style={{
            position: "absolute",
            right: 8,
            bottom: 8,
            padding: "3px 6px",
            borderRadius: 999,
            background: "rgba(8, 10, 16, 0.72)",
            color: "white",
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            backdropFilter: "blur(8px)",
          }}
        >
          {getCollectionEntryBadgeLabel(entry)}
        </div>
      </div>
    </button>
  );
}

function renderIconNode(args: {
  entry: ExplorerFileEntry;
  collectionKind: ExplorerCollectionPreviewKind;
  variant: "strata" | "timeline";
  bindPreviewEntryDirectDrag: ReturnType<
    typeof useExplorerPreviewEntryDirectDrag<ExplorerFileEntry>
  >["bindPreviewEntryDirectDrag"];
  isSelected: boolean;
  isHovered: boolean;
  iconSrc: string | null;
  onHoverStart: (path: string | null) => void;
}) {
  const {
    entry,
    collectionKind,
    variant,
    bindPreviewEntryDirectDrag,
    isSelected,
    isHovered,
    iconSrc,
    onHoverStart,
  } = args;
  const previewEntryDragBindings = bindPreviewEntryDirectDrag(entry);
  const dimension = variant === "timeline" ? 42 : 48;
  return (
    <button
      type="button"
      key={entry.path}
      data-overlay-preview-entry-path={entry.path}
      data-overlay-preview-entry-kind={entry.is_dir ? "folder" : "file"}
      data-overlay-preview-entry-selected={String(isSelected)}
      aria-label={buildCollectionEntryActionLabel(collectionKind, entry)}
      title={buildCollectionEntryTitle(collectionKind, entry)}
      aria-pressed={isSelected}
      style={{
        width: dimension,
        height: dimension,
        position: "relative",
        borderRadius: variant === "timeline" ? 999 : 14,
        border: resolveCardBorder(isSelected),
        background: resolveEntryBackground({
          isSelected,
          isHovered,
          variant: variant === "timeline" ? "orb" : "card",
        }),
        display: "grid",
        placeItems: "center",
        cursor: "pointer",
        boxShadow: isSelected
          ? "0 10px 22px color-mix(in srgb, var(--overlay-accent) 22%, transparent)"
          : "none",
      }}
      onMouseEnter={() => onHoverStart(entry.path)}
      onMouseLeave={() => onHoverStart(null)}
      {...previewEntryDragBindings}
    >
      {iconSrc ? <ExplorerPreviewEntryIconImage src={iconSrc} size={20} /> : null}
      <div
        style={{
          position: "absolute",
          right: 4,
          bottom: 4,
          minWidth: 8,
          height: 8,
          borderRadius: 999,
          background: entry.is_dir
            ? "var(--overlay-accent)"
            : "var(--overlay-warning)",
          boxShadow: "0 0 0 2px color-mix(in srgb, black 40%, transparent)",
        }}
      />
    </button>
  );
}

function renderOrbitEntry(args: {
  entry: ExplorerFileEntry;
  collectionKind: ExplorerCollectionPreviewKind;
  index: number;
  total: number;
  bindPreviewEntryDirectDrag: ReturnType<
    typeof useExplorerPreviewEntryDirectDrag<ExplorerFileEntry>
  >["bindPreviewEntryDirectDrag"];
  isSelected: boolean;
  isHovered: boolean;
  iconSrc: string | null;
  onHoverStart: (path: string | null) => void;
}) {
  const {
    entry,
    collectionKind,
    index,
    total,
    bindPreviewEntryDirectDrag,
    isSelected,
    isHovered,
    iconSrc,
    onHoverStart,
  } = args;
  const previewEntryDragBindings = bindPreviewEntryDirectDrag(entry);
  const angle = ((Math.PI * 2) / Math.max(total, 1)) * index - Math.PI / 2;
  const radius = total <= 4 ? 42 : total <= 7 ? 48 : 54;
  const x = Math.cos(angle) * radius;
  const y = Math.sin(angle) * radius;
  return (
    <button
      type="button"
      key={entry.path}
      data-overlay-preview-entry-path={entry.path}
      data-overlay-preview-entry-kind={entry.is_dir ? "folder" : "file"}
      data-overlay-preview-entry-selected={String(isSelected)}
      aria-label={buildCollectionEntryActionLabel(collectionKind, entry)}
      title={buildCollectionEntryTitle(collectionKind, entry)}
      aria-pressed={isSelected}
      style={{
        position: "absolute",
        left: `calc(50% + ${x}px - 18px)`,
        top: `calc(50% + ${y}px - 18px)`,
        width: 36,
        height: 36,
        borderRadius: 999,
        border: resolveCardBorder(isSelected),
        background: resolveEntryBackground({
          isSelected,
          isHovered,
          variant: "orb",
        }),
        display: "grid",
        placeItems: "center",
        cursor: "pointer",
        boxShadow: isSelected
          ? "0 10px 22px color-mix(in srgb, var(--overlay-accent) 24%, transparent)"
          : "none",
      }}
      onMouseEnter={() => onHoverStart(entry.path)}
      onMouseLeave={() => onHoverStart(null)}
      {...previewEntryDragBindings}
    >
      {iconSrc ? <ExplorerPreviewEntryIconImage src={iconSrc} size={18} /> : null}
    </button>
  );
}

function resolveModeIcon(mode: ExplorerCollectionPreviewMode) {
  switch (mode) {
    case "overview":
      return LayoutGrid;
    case "strata":
      return Layers3;
    case "timeline":
      return ScanLine;
    case "orbit":
      return Sparkles;
    case "list":
    default:
      return List;
  }
}

function resolveCollectionEntryCategory(
  entry: ExplorerFileEntry,
): ExplorerCollectionEntryCategory {
  if (entry.is_dir) {
    return "folders";
  }
  if (getExplorerArchiveDescriptor(entry)) {
    return "packages";
  }
  if (
    isImagePreviewExtension(entry.extension) ||
    isVideoPreviewExtension(entry.extension) ||
    isAudioPreviewExtension(entry.extension) ||
    isModelPreviewExtension(entry.extension)
  ) {
    return "media";
  }
  if (
    isPdfPreviewExtension(entry.extension) ||
    isSpreadsheetPreviewExtension(entry.extension) ||
    documentPreviewExtensionSet.has(normalizeEntryExtension(entry))
  ) {
    return "documents";
  }
  if (
    isShaderPreviewExtension(entry.extension) ||
    isEditableTextExtension(entry.extension, entry.size)
  ) {
    return "code";
  }
  return "other";
}

function resolveCollectionEntryRecencyBucket(
  entry: ExplorerFileEntry,
): ExplorerCollectionRecencyBucket {
  if (!Number.isFinite(entry.modified) || entry.modified <= 0) {
    return "undated";
  }
  const ageMs = Date.now() - entry.modified;
  if (ageMs <= 24 * 60 * 60 * 1000) {
    return "fresh";
  }
  if (ageMs <= 7 * 24 * 60 * 60 * 1000) {
    return "recent";
  }
  return "older";
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

function normalizeEntryExtension(entry: ExplorerFileEntry): string {
  return entry.extension.trim().toLowerCase().replace(/^\./, "");
}

function getCollectionEntryBadgeLabel(entry: ExplorerFileEntry): string {
  if (entry.is_dir) {
    return "DIR";
  }
  const extension = normalizeEntryExtension(entry);
  if (!extension) {
    return "FILE";
  }
  return extension.slice(0, 4).toUpperCase();
}

function getCollectionEntryParentLabel(path: string): string | null {
  const archiveLocation = parseExplorerArchiveVirtualPath(path);
  if (archiveLocation) {
    const segments = archiveLocation.entryPath.split("/").filter(Boolean);
    if (segments.length <= 1) {
      return null;
    }
    segments.pop();
    return segments.join("/");
  }

  const trimmedPath = path.replace(/[/\\]+$/, "");
  const segments = trimmedPath.split(/[/\\]/).filter(Boolean);
  if (segments.length <= 1) {
    return null;
  }
  segments.pop();
  return segments.join("/");
}

function buildCollectionEntryActionLabel(
  collectionKind: ExplorerCollectionPreviewKind,
  entry: ExplorerFileEntry,
): string {
  if (collectionKind === "archive") {
    return entry.is_dir
      ? `Open archive folder ${entry.name}`
      : `Open archive file ${entry.name}`;
  }
  return entry.is_dir ? `Open folder ${entry.name}` : `Open file ${entry.name}`;
}

function buildCollectionEntryTitle(
  collectionKind: ExplorerCollectionPreviewKind,
  entry: ExplorerFileEntry,
): string {
  return `${buildCollectionEntryActionLabel(collectionKind, entry)}${
    entry.is_dir ? "" : ` • ${formatSize(entry.size)}`
  }`;
}

function resolveEntryBackground(args: {
  isSelected: boolean;
  isHovered: boolean;
  variant: "row" | "card" | "orb";
}): string {
  if (args.isSelected) {
    return args.variant === "row"
      ? "var(--overlay-explorer-chip-bg)"
      : "color-mix(in srgb, var(--overlay-explorer-chip-active-bg) 78%, var(--overlay-bg-card))";
  }
  if (args.isHovered) {
    return args.variant === "row"
      ? "var(--overlay-explorer-item-hover-bg)"
      : "color-mix(in srgb, var(--overlay-explorer-item-hover-bg) 72%, var(--overlay-bg-card))";
  }
  if (args.variant === "orb") {
    return "color-mix(in srgb, var(--overlay-bg-card) 88%, transparent)";
  }
  if (args.variant === "card") {
    return "linear-gradient(180deg, color-mix(in srgb, var(--overlay-bg-card) 88%, var(--overlay-accent) 12%), color-mix(in srgb, var(--overlay-bg-panel) 96%, transparent))";
  }
  return "transparent";
}

function resolveCardBorder(isSelected: boolean): string {
  return isSelected
    ? "1px solid var(--overlay-explorer-chip-active-border)"
    : "1px solid var(--overlay-explorer-chip-border)";
}

function entryPillStyle(): CSSProperties {
  return {
    padding: "2px 6px",
    borderRadius: 999,
    border: "1px solid var(--overlay-explorer-chip-border)",
    background: "var(--overlay-explorer-chip-bg)",
    color: "var(--overlay-text-muted)",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  };
}

const documentPreviewExtensionSet = new Set([
  "doc",
  "docx",
  "md",
  "markdown",
  "odt",
  "pdf",
  "rtf",
  "txt",
  "csv",
]);
