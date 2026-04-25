import {
  Archive,
  ArrowDown,
  ArrowDownToLine,
  ArrowUp,
  ArrowUpDown,
  AudioLines,
  Bell,
  BellOff,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  CornerDownRight,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  FileText,
  Folder,
  FolderTree,
  Grid2x2,
  Grid3x3,
  House,
  Image,
  Images,
  LayoutGrid,
  List,
  RefreshCcw,
  ScanSearch,
  Search,
  Settings2,
  Upload,
  Video,
  X,
  ZoomIn,
  ZoomOut,
  type LucideIcon,
} from "lucide-react";
import interact from "interactjs";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type RefObject,
  type UIEvent,
} from "react";

import {
  MOBILE_PAGE_SIZE,
  MOBILE_SEARCH_DEBOUNCE_MS,
  buildMobileFileUrl,
  cancelMobileSearchScan,
  fetchMobileListing,
  fetchMobilePreview,
  fetchMobileSearchResults,
  fetchMobileSearchStatus,
  fetchMobileThemeSnapshot,
  startMobileSearchScan,
  startMobileUpload,
  type MobileBrowseRequestOptions,
} from "./mobileApi";
import {
  listenToMobilePushMessages,
  loadMobilePushRuntimeSnapshot,
  subscribeMobilePushNotifications,
  unsubscribeMobilePushNotifications,
  type MobilePushNotificationIntent,
  type MobilePushRuntimeSnapshot,
} from "./mobilePush";
import {
  defaultMobileLayoutSettings,
  isMobileGridViewMode,
  normalizeMobileGridZoom,
  normalizeMobileLayoutSettings,
  type MobileLayoutSettings,
  type MobileLayoutViewMode,
} from "../src/config/mobileLayout";
import {
  buildMobileIconUrl,
  formatBytes,
  formatModifiedLabel,
  formatRelativePath,
  isIosSafari,
  isStandaloneWebApp,
  resolveMobileEntryIconUrl,
  resolveMobileNavIcon,
  type MobileTabId,
} from "./mobileShared";
import { useMobileStore } from "./mobileStore";
import type {
  MobilePreviewResponse,
  MobileSearchResponse,
  MobileSearchStatusResponse,
  MobileShareEntry,
  MobileShareThemeSnapshot,
} from "./types";

interface MobileLocationState {
  tab: MobileTabId;
  path: string;
}

interface MobileViewportSnapshot {
  width: number;
  height: number;
}

interface MobileShellMetrics {
  interfaceScale: number;
  chromeScale: number;
  panelGap: number;
  touchTarget: number;
  bottomNavHeight: number;
  actionStripHeight: number;
  pagePadding: number;
}

const BOTTOM_DOCK_TABS = [
  {
    id: "explorer",
    label: "Explorer",
    slotId: "folder_tree",
    fallback: FolderTree,
  },
  {
    id: "search",
    label: "Search",
    slotId: "search",
    fallback: Search,
  },
  {
    id: "transfers",
    label: "Transfers",
    slotId: "download",
    fallback: ArrowDownToLine,
  },
  {
    id: "settings",
    label: "Settings",
    slotId: "settings",
    fallback: Settings2,
  },
] satisfies Array<{
  id: MobileTabId;
  label: string;
  slotId: string;
  fallback: LucideIcon;
}>;

const MOBILE_VIEW_MODE_BUTTONS = [
  {
    id: "icons-l",
    label: "Large",
    icon: LayoutGrid,
  },
  {
    id: "icons-m",
    label: "Medium",
    icon: Grid2x2,
  },
  {
    id: "icons-s",
    label: "Compact",
    icon: Grid3x3,
  },
  {
    id: "list",
    label: "List",
    icon: List,
  },
] satisfies Array<{
  id: MobileLayoutViewMode;
  label: string;
  icon: LucideIcon;
}>;

const MOBILE_LUCIDE_ICON_REGISTRY: Record<string, LucideIcon> = {
  Archive,
  ArrowDown,
  ArrowDownToLine,
  ArrowUp,
  ArrowUpDown,
  AudioLines,
  Bell,
  BellOff,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  CornerDownRight,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  FileText,
  Folder,
  FolderTree,
  Grid2x2,
  Grid3x3,
  House,
  Image,
  Images,
  LayoutGrid,
  List,
  RefreshCcw,
  ScanSearch,
  Search,
  Settings2,
  Upload,
  Video,
  X,
  ZoomIn,
  ZoomOut,
};

const SORT_CYCLE: MobileLayoutSettings["sortBy"][] = [
  "name",
  "date",
  "size",
  "type",
];

function buildMobileThemeCssVars(
  snapshot: MobileShareThemeSnapshot,
): Record<string, string> {
  return {
    "--mobile-font-ui": snapshot.uiFontFamily,
    "--mobile-font-mono": snapshot.monoFontFamily,
    "--mobile-bg": snapshot.palette.appBackground,
    "--mobile-bg-alt": snapshot.palette.appBackgroundAlt,
    "--mobile-surface": snapshot.palette.shellBackground,
    "--mobile-surface-strong": snapshot.palette.panelBackground,
    "--mobile-topbar-bg": snapshot.palette.topBarBackground,
    "--mobile-input-bg": snapshot.palette.inputBackground,
    "--mobile-border": snapshot.palette.border,
    "--mobile-border-strong": snapshot.palette.borderStrong,
    "--mobile-text": snapshot.palette.textPrimary,
    "--mobile-text-muted": snapshot.palette.textMuted,
    "--mobile-accent": snapshot.palette.accent,
    "--mobile-accent-strong": snapshot.palette.accentStrong,
    "--mobile-accent-soft": snapshot.palette.accentSoft,
    "--mobile-shadow": snapshot.shadow,
    "--mobile-control-radius": `${snapshot.metrics.controlRadius}px`,
    "--mobile-panel-radius": `${snapshot.metrics.panelRadius}px`,
    "--mobile-page-padding": `${snapshot.metrics.pagePadding}px`,
    "--mobile-panel-gap": `${snapshot.metrics.panelGap}px`,
  };
}

function applyMobileThemeSnapshot(snapshot: MobileShareThemeSnapshot): void {
  const root = document.documentElement;
  const themeVars = buildMobileThemeCssVars(snapshot);
  Object.entries(themeVars).forEach(([key, value]) => {
    root.style.setProperty(key, value);
  });

  const themeColorMeta =
    document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (themeColorMeta) {
    themeColorMeta.content = snapshot.palette.appBackground;
  }
}

function readMobileLocationState(): MobileLocationState {
  const params = new URLSearchParams(window.location.search);
  const tabParam = params.get("tab");
  const normalizedTab = BOTTOM_DOCK_TABS.some((tab) => tab.id === tabParam)
    ? (tabParam as MobileTabId)
    : "explorer";
  const path = params.get("path")?.trim() ?? "";
  return {
    tab: normalizedTab,
    path,
  };
}

function buildMobileLocationUrl(state: MobileLocationState): string {
  const params = new URLSearchParams();
  if (state.tab !== "explorer") {
    params.set("tab", state.tab);
  }
  if (state.path.length > 0) {
    params.set("path", state.path);
  }
  const search = params.toString();
  return search.length > 0
    ? `${window.location.pathname}?${search}`
    : window.location.pathname;
}

function buildLocationKey(state: MobileLocationState): string {
  return `${state.tab}::${state.path}`;
}

function buildBrowseRequestOptions(
  layout: MobileLayoutSettings,
): MobileBrowseRequestOptions {
  return {
    showHiddenFiles: layout.showHiddenFiles,
    sortBy: layout.sortBy,
    sortOrder: layout.sortOrder,
    directoriesFirst: layout.directoriesFirst,
  };
}

function buildListingKey(
  currentPath: string,
  options: MobileBrowseRequestOptions,
): string {
  return JSON.stringify({
    currentPath,
    ...options,
  });
}

function getGridMinWidth(layout: MobileLayoutSettings): number {
  const baseWidth =
    layout.viewMode === "icons-l"
      ? 172
      : layout.viewMode === "icons-s"
        ? 92
        : 128;
  return Math.round(baseWidth * layout.gridZoom);
}

function getGridIconSize(layout: MobileLayoutSettings): number {
  const baseSize =
    layout.viewMode === "icons-l"
      ? 76
      : layout.viewMode === "icons-s"
        ? 46
        : 60;
  return Math.round(baseSize * layout.gridZoom);
}

function readCurrentViewportSnapshot(): MobileViewportSnapshot {
  if (typeof window === "undefined") {
    return { width: 390, height: 844 };
  }

  const visualViewport = window.visualViewport;
  if (visualViewport) {
    return {
      width: Math.max(320, Math.round(visualViewport.width)),
      height: Math.max(560, Math.round(visualViewport.height)),
    };
  }

  return {
    width: Math.max(320, Math.round(window.innerWidth || 390)),
    height: Math.max(560, Math.round(window.innerHeight || 844)),
  };
}

function getHandsetScaleBoost(width: number): number {
  if (width <= 375) {
    return 1.16;
  }
  if (width <= 414) {
    return 1.1;
  }
  if (width <= 480) {
    return 1.04;
  }
  return 1;
}

function getResolvedInterfaceScale(
  layout: MobileLayoutSettings,
  viewportWidth: number,
): number {
  const rawScale = layout.interfaceScale * getHandsetScaleBoost(viewportWidth);
  return Math.round(rawScale * 100) / 100;
}

function getResolvedChromeScale(
  layout: MobileLayoutSettings,
  viewportWidth: number,
): number {
  const handsetBoost = getHandsetScaleBoost(viewportWidth);
  const rawScale = layout.chromeScale * Math.max(1, handsetBoost - 0.02);
  return Math.round(rawScale * 100) / 100;
}

function getTouchTargetSize(layout: MobileLayoutSettings): number {
  switch (layout.touchComfort) {
    case "compact":
      return 42;
    case "balanced":
      return 48;
    case "comfortable":
    default:
      return 56;
  }
}

function getLayoutPanelGap(layout: MobileLayoutSettings): number {
  switch (layout.touchComfort) {
    case "compact":
      return 10;
    case "balanced":
      return 14;
    case "comfortable":
    default:
      return 18;
  }
}

function resolveMobileShellMetrics(
  layout: MobileLayoutSettings,
  viewportWidth: number,
): MobileShellMetrics {
  const interfaceScale = getResolvedInterfaceScale(layout, viewportWidth);
  const chromeScale = getResolvedChromeScale(layout, viewportWidth);
  const panelGap = getLayoutPanelGap(layout);
  const touchTarget = getTouchTargetSize(layout);
  const bottomNavHeight = Math.round(touchTarget * 1.52);
  const actionStripHeight = Math.round(touchTarget * 1.2);
  const pagePadding = Math.round(layout.pagePadding * Math.max(1, interfaceScale - 0.03));

  return {
    interfaceScale,
    chromeScale,
    panelGap,
    touchTarget,
    bottomNavHeight,
    actionStripHeight,
    pagePadding,
  };
}

function getGridMinWidthForViewport(
  layout: MobileLayoutSettings,
  viewportWidth: number,
): number {
  return Math.round(
    getGridMinWidth(layout) * getResolvedInterfaceScale(layout, viewportWidth),
  );
}

function getGridIconSizeForViewport(
  layout: MobileLayoutSettings,
  viewportWidth: number,
): number {
  return Math.round(
    getGridIconSize(layout) * getResolvedInterfaceScale(layout, viewportWidth),
  );
}

function getExplorerContainerInset(
  layout: MobileLayoutSettings,
  viewportWidth: number,
): number {
  return Math.round(14 * getResolvedInterfaceScale(layout, viewportWidth));
}

function getExplorerListGap(
  layout: MobileLayoutSettings,
  viewportWidth: number,
): number {
  return Math.round(10 * getResolvedInterfaceScale(layout, viewportWidth));
}

function getExplorerGridGap(
  layout: MobileLayoutSettings,
  viewportWidth: number,
): number {
  return Math.round(14 * getResolvedInterfaceScale(layout, viewportWidth));
}

function getExplorerListRowEstimateSize(
  layout: MobileLayoutSettings,
  viewportWidth: number,
): number {
  return Math.max(
    Math.round(getTouchTargetSize(layout) * 1.14),
    Math.round(78 * getResolvedInterfaceScale(layout, viewportWidth)),
  );
}

function getExplorerGridColumnCount(
  layout: MobileLayoutSettings,
  viewportWidth: number,
): number {
  const shellMetrics = resolveMobileShellMetrics(layout, viewportWidth);
  const containerInset = getExplorerContainerInset(layout, viewportWidth);
  const gap = getExplorerGridGap(layout, viewportWidth);
  const minWidth = getGridMinWidthForViewport(layout, viewportWidth);
  const availableWidth = Math.max(
    280,
    viewportWidth - shellMetrics.pagePadding * 2 - containerInset * 2,
  );

  return Math.max(1, Math.floor((availableWidth + gap) / (minWidth + gap)));
}

function getExplorerGridRowEstimateSize(
  layout: MobileLayoutSettings,
  viewportWidth: number,
): number {
  const interfaceScale = getResolvedInterfaceScale(layout, viewportWidth);
  const iconSize = getGridIconSizeForViewport(layout, viewportWidth);
  return Math.max(
    Math.round(176 * interfaceScale),
    Math.round(iconSize + 88 * interfaceScale),
  );
}

function buildMobileShellStyle(
  layout: MobileLayoutSettings,
  viewport: MobileViewportSnapshot,
): CSSProperties {
  const shellMetrics = resolveMobileShellMetrics(layout, viewport.width);

  return {
    "--mobile-interface-scale": shellMetrics.interfaceScale.toFixed(2),
    "--mobile-chrome-scale": shellMetrics.chromeScale.toFixed(2),
    "--mobile-page-padding": `${shellMetrics.pagePadding}px`,
    "--mobile-panel-gap": `${shellMetrics.panelGap}px`,
    "--mobile-touch-target": `${shellMetrics.touchTarget}px`,
    "--mobile-bottom-nav-height": `${shellMetrics.bottomNavHeight}px`,
    "--mobile-action-strip-height": `${shellMetrics.actionStripHeight}px`,
    "--mobile-viewport-height": `${viewport.height}px`,
  } as CSSProperties;
}

function formatSortLabel(sortBy: MobileLayoutSettings["sortBy"]): string {
  switch (sortBy) {
    case "date":
      return "Date";
    case "size":
      return "Size";
    case "type":
      return "Type";
    case "name":
    default:
      return "Name";
  }
}

function cycleSortBy(current: MobileLayoutSettings["sortBy"]): MobileLayoutSettings["sortBy"] {
  const currentIndex = SORT_CYCLE.indexOf(current);
  return SORT_CYCLE[(currentIndex + 1) % SORT_CYCLE.length];
}

function matchesExplorerFilter(
  entry: MobileShareEntry,
  filterValue: string,
): boolean {
  if (!filterValue) {
    return true;
  }

  const haystack = [
    entry.name,
    entry.extension,
    entry.entryKind,
    entry.relativePath,
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(filterValue);
}

function getRowMetaLabel(entry: MobileShareEntry): string {
  const parts: string[] = [entry.entryKind];
  if (entry.modifiedMs) {
    parts.push(formatModifiedLabel(entry.modifiedMs));
  }
  if (!entry.isDir && entry.size > 0) {
    parts.push(formatBytes(entry.size));
  }
  return parts.join(" · ");
}

function renderThemedIcon(args: {
  slotId?: string;
  iconId?: string;
  themeSnapshot: MobileShareThemeSnapshot | null;
  fallback: LucideIcon;
  className?: string;
}) {
  const { fallback: FallbackIcon, themeSnapshot } = args;
  if (args.iconId) {
    return (
      <img
        className={args.className}
        src={buildMobileIconUrl(args.iconId)}
        alt=""
        aria-hidden="true"
      />
    );
  }

  const reference =
    args.slotId && themeSnapshot
      ? resolveMobileNavIcon(args.slotId, themeSnapshot)
      : null;
  if (reference?.kind === "icon") {
    return (
      <img
        className={args.className}
        src={buildMobileIconUrl(reference.value)}
        alt=""
        aria-hidden="true"
      />
    );
  }

  if (reference?.kind === "lucide") {
    const maybeIcon = MOBILE_LUCIDE_ICON_REGISTRY[reference.value];
    const LucideComponent = maybeIcon ?? FallbackIcon;
    return <LucideComponent className={args.className} strokeWidth={1.7} />;
  }

  return <FallbackIcon className={args.className} strokeWidth={1.7} />;
}

function MobileEntryIcon({
  entry,
  themeSnapshot,
  openFolder = false,
  size = 56,
}: {
  entry: MobileShareEntry;
  themeSnapshot: MobileShareThemeSnapshot | null;
  openFolder?: boolean;
  size?: number;
}) {
  const iconUrl = resolveMobileEntryIconUrl(entry, themeSnapshot, openFolder);
  const FallbackIcon =
    entry.isDir
      ? Folder
      : entry.entryKind === "image"
        ? Image
        : entry.entryKind === "video"
          ? Video
          : entry.entryKind === "audio"
            ? AudioLines
            : entry.entryKind === "archive"
              ? Archive
              : FileText;

  return (
    <div
      className="mobile-entry-icon"
      style={
        {
          "--mobile-entry-icon-size": `${size}px`,
        } as CSSProperties
      }
    >
      {entry.thumbnailUrl ? (
        <img
          className="mobile-entry-icon__thumbnail"
          src={entry.thumbnailUrl}
          alt=""
          loading="lazy"
        />
      ) : iconUrl ? (
        <img className="mobile-entry-icon__image" src={iconUrl} alt="" />
      ) : (
        <FallbackIcon className="mobile-entry-icon__fallback" strokeWidth={1.7} />
      )}
    </div>
  );
}

function MobileTransferRow({
  transfer,
  onRetry,
  onCancel,
  onReveal,
}: {
  transfer: ReturnType<typeof useMobileStore.getState>["transfers"][number];
  onRetry: () => void;
  onCancel: () => void;
  onReveal: () => void;
}) {
  const phaseLabel =
    transfer.phase === "handoff"
      ? "Browser handoff"
      : transfer.phase.charAt(0).toUpperCase() + transfer.phase.slice(1);

  return (
    <article className="mobile-transfer-card">
      <div className="mobile-transfer-card__header">
        <div>
          <div className="mobile-transfer-card__title">{transfer.displayName}</div>
          <div className="mobile-transfer-card__meta">
            {transfer.direction === "upload" ? "Upload" : "Download"} ·{" "}
            {phaseLabel}
          </div>
        </div>
        <div className={`mobile-phase mobile-phase--${transfer.phase}`}>
          {phaseLabel}
        </div>
      </div>
      <button
        type="button"
        className="mobile-transfer-card__path"
        title={transfer.targetPath}
        onClick={onReveal}
      >
        {formatRelativePath(transfer.targetPath)}
      </button>
      {transfer.bytesTotal != null ? (
        <div className="mobile-transfer-card__progress">
          <div className="mobile-transfer-card__progress-track">
            <div
              className="mobile-transfer-card__progress-fill"
              style={{
                width: `${Math.max(0, Math.min(100, (transfer.progress ?? 0) * 100))}%`,
              }}
            />
          </div>
          <div className="mobile-transfer-card__meta">
            {formatBytes(transfer.bytesTransferred)} /{" "}
            {formatBytes(transfer.bytesTotal)}
          </div>
        </div>
      ) : null}
      {transfer.message ? (
        <div className="mobile-transfer-card__note">{transfer.message}</div>
      ) : null}
      <div className="mobile-transfer-card__actions">
        <button className="mobile-action-button" type="button" onClick={onReveal}>
          Show Folder
        </button>
        {transfer.phase === "error" || transfer.phase === "canceled" ? (
          <button className="mobile-action-button" type="button" onClick={onRetry}>
            Retry
          </button>
        ) : null}
        {transfer.phase === "queued" || transfer.phase === "running" ? (
          <button className="mobile-action-button" type="button" onClick={onCancel}>
            Cancel
          </button>
        ) : null}
      </div>
    </article>
  );
}

function MobileExplorerVirtualSurface({
  entries,
  layout,
  viewportWidth,
  gridCardSize,
  themeSnapshot,
  scrollElementRef,
  onOpenEntry,
  onPreviewEntry,
  onDownloadEntry,
}: {
  entries: MobileShareEntry[];
  layout: MobileLayoutSettings;
  viewportWidth: number;
  gridCardSize: number;
  themeSnapshot: MobileShareThemeSnapshot | null;
  scrollElementRef: RefObject<HTMLDivElement | null>;
  onOpenEntry: (entry: MobileShareEntry) => void;
  onPreviewEntry: (entry: MobileShareEntry) => void;
  onDownloadEntry: (entry: MobileShareEntry) => void;
}) {
  const gridView = isMobileGridViewMode(layout.viewMode);
  const shouldVirtualize = entries.length > 60;
  const listGap = getExplorerListGap(layout, viewportWidth);
  const gridGap = getExplorerGridGap(layout, viewportWidth);
  const gridColumnCount = gridView
    ? getExplorerGridColumnCount(layout, viewportWidth)
    : 1;
  const rowCount = gridView
    ? Math.ceil(entries.length / gridColumnCount)
    : entries.length;

  if (!shouldVirtualize) {
    if (!gridView) {
      return (
        <div className="mobile-list-surface">
          {entries.map((entry) => (
            <article className="mobile-row" key={entry.relativePath}>
              <button
                type="button"
                className="mobile-row__main"
                onClick={() => {
                  onOpenEntry(entry);
                }}
              >
                <MobileEntryIcon entry={entry} themeSnapshot={themeSnapshot} size={52} />
                <div className="mobile-row__content">
                  <div className="mobile-row__name">{entry.name}</div>
                  <div className="mobile-row__meta">{getRowMetaLabel(entry)}</div>
                </div>
              </button>
              <div className="mobile-row__actions">
                {entry.canPreview ? (
                  <button
                    type="button"
                    className="mobile-icon-button"
                    onClick={() => {
                      onPreviewEntry(entry);
                    }}
                    aria-label={`Preview ${entry.name}`}
                  >
                    <Eye size={18} strokeWidth={1.7} />
                  </button>
                ) : null}
                {entry.canDownload ? (
                  <button
                    type="button"
                    className="mobile-icon-button"
                    onClick={() => {
                      onDownloadEntry(entry);
                    }}
                    aria-label={`Download ${entry.name}`}
                  >
                    <Download size={18} strokeWidth={1.7} />
                  </button>
                ) : (
                  <span className="mobile-row__chevron">
                    <ChevronRight size={18} strokeWidth={1.7} />
                  </span>
                )}
              </div>
            </article>
          ))}
        </div>
      );
    }

    return (
      <div
        className={`mobile-grid mobile-grid--${layout.viewMode}`}
        style={
          {
            "--mobile-grid-min-width": `${getGridMinWidthForViewport(
              layout,
              viewportWidth,
            )}px`,
          } as CSSProperties
        }
      >
        {entries.map((entry) => (
          <button
            key={entry.relativePath}
            type="button"
            className={`mobile-grid-card${
              entry.isDir ? " mobile-grid-card--directory" : ""
            }`}
            onClick={() => {
              onOpenEntry(entry);
            }}
          >
            <div className="mobile-grid-card__icon-wrap">
              <MobileEntryIcon
                entry={entry}
                themeSnapshot={themeSnapshot}
                openFolder={entry.isDir}
                size={gridCardSize}
              />
            </div>
            <div className="mobile-grid-card__content">
              <div className="mobile-grid-card__name">{entry.name}</div>
              <div className="mobile-grid-card__meta">
                {entry.isDir
                  ? entry.isHidden
                    ? "Hidden folder"
                    : "Folder"
                  : entry.size > 0
                    ? formatBytes(entry.size)
                    : getRowMetaLabel(entry)}
              </div>
            </div>
          </button>
        ))}
      </div>
    );
  }

  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => scrollElementRef.current,
    initialRect: {
      width: Math.max(viewportWidth, 320),
      height: 720,
    },
    estimateSize: () =>
      gridView
        ? getExplorerGridRowEstimateSize(layout, viewportWidth)
        : getExplorerListRowEstimateSize(layout, viewportWidth),
    overscan: gridView ? 4 : 8,
    getItemKey: (index) =>
      gridView
        ? `grid-row:${index}`
        : entries[index]?.relativePath ?? `list-row:${index}`,
  });

  if (!gridView) {
    return (
      <div
        className="mobile-virtual-surface mobile-virtual-surface--list"
        style={{ height: `${virtualizer.getTotalSize()}px` }}
      >
        {virtualizer.getVirtualItems().map((virtualItem) => {
          const entry = entries[virtualItem.index];
          if (!entry) {
            return null;
          }

          return (
            <div
              key={entry.relativePath}
              ref={virtualizer.measureElement}
              className="mobile-virtual-row"
              style={{
                transform: `translateY(${virtualItem.start}px)`,
                paddingBottom: `${listGap}px`,
              }}
            >
              <article className="mobile-row">
                <button
                  type="button"
                  className="mobile-row__main"
                  onClick={() => {
                    onOpenEntry(entry);
                  }}
                >
                  <MobileEntryIcon entry={entry} themeSnapshot={themeSnapshot} size={52} />
                  <div className="mobile-row__content">
                    <div className="mobile-row__name">{entry.name}</div>
                    <div className="mobile-row__meta">{getRowMetaLabel(entry)}</div>
                  </div>
                </button>
                <div className="mobile-row__actions">
                  {entry.canPreview ? (
                    <button
                      type="button"
                      className="mobile-icon-button"
                      onClick={() => {
                        onPreviewEntry(entry);
                      }}
                      aria-label={`Preview ${entry.name}`}
                    >
                      <Eye size={18} strokeWidth={1.7} />
                    </button>
                  ) : null}
                  {entry.canDownload ? (
                    <button
                      type="button"
                      className="mobile-icon-button"
                      onClick={() => {
                        onDownloadEntry(entry);
                      }}
                      aria-label={`Download ${entry.name}`}
                    >
                      <Download size={18} strokeWidth={1.7} />
                    </button>
                  ) : (
                    <span className="mobile-row__chevron">
                      <ChevronRight size={18} strokeWidth={1.7} />
                    </span>
                  )}
                </div>
              </article>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div
      className="mobile-virtual-surface mobile-virtual-surface--grid"
      style={{ height: `${virtualizer.getTotalSize()}px` }}
    >
      {virtualizer.getVirtualItems().map((virtualItem) => {
        const rowEntries = entries.slice(
          virtualItem.index * gridColumnCount,
          virtualItem.index * gridColumnCount + gridColumnCount,
        );

        return (
          <div
            key={`grid-row:${virtualItem.index}`}
            ref={virtualizer.measureElement}
            className={`mobile-virtual-grid-row mobile-virtual-grid-row--${layout.viewMode}`}
            style={{
              transform: `translateY(${virtualItem.start}px)`,
              gap: `${gridGap}px`,
              paddingBottom: `${gridGap}px`,
              gridTemplateColumns: `repeat(${gridColumnCount}, minmax(0, 1fr))`,
            }}
          >
            {rowEntries.map((entry) => (
              <button
                key={entry.relativePath}
                type="button"
                className={`mobile-grid-card${
                  entry.isDir ? " mobile-grid-card--directory" : ""
                }`}
                onClick={() => {
                  onOpenEntry(entry);
                }}
              >
                <div className="mobile-grid-card__icon-wrap">
                  <MobileEntryIcon
                    entry={entry}
                    themeSnapshot={themeSnapshot}
                    openFolder={entry.isDir}
                    size={gridCardSize}
                  />
                </div>
                <div className="mobile-grid-card__content">
                  <div className="mobile-grid-card__name">{entry.name}</div>
                  <div className="mobile-grid-card__meta">
                    {entry.isDir
                      ? entry.isHidden
                        ? "Hidden folder"
                        : "Folder"
                      : entry.size > 0
                        ? formatBytes(entry.size)
                        : getRowMetaLabel(entry)}
                  </div>
                </div>
              </button>
            ))}
          </div>
        );
      })}
      <div className="mobile-virtual-grid-spacer" style={{ height: `${gridGap}px` }} />
    </div>
  );
}

export default function App() {
  const {
    activeTab,
    explorerPath,
    transfers,
    layoutOverrides,
    setActiveTab,
    setExplorerPath,
    patchLayoutOverrides,
    createTransfer,
    patchTransfer,
    clearFinishedTransfers,
  } = useMobileStore();

  const initialLocationStateRef = useRef<MobileLocationState>(readMobileLocationState());
  const [currentPath, setCurrentPath] = useState(
    initialLocationStateRef.current.path || explorerPath,
  );
  const [parentPath, setParentPath] = useState("");
  const [shareName, setShareName] = useState("GreebleFS");
  const [canGoUp, setCanGoUp] = useState(false);
  const [hubMode, setHubMode] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [entries, setEntries] = useState<Array<MobileShareEntry | null>>([]);
  const [nextOffset, setNextOffset] = useState<number | null>(null);
  const [isListingLoading, setIsListingLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const [filterInput, setFilterInput] = useState("");
  const [installTipDismissed, setInstallTipDismissed] = useState(false);
  const [themeSnapshot, setThemeSnapshot] =
    useState<MobileShareThemeSnapshot | null>(null);
  const [previewState, setPreviewState] = useState<{
    entry: MobileShareEntry | null;
    preview: MobilePreviewResponse | null;
    loading: boolean;
    error: string | null;
  }>({
    entry: null,
    preview: null,
    loading: false,
    error: null,
  });
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchState, setSearchState] = useState<{
    response: MobileSearchResponse | null;
    status: MobileSearchStatusResponse | null;
    loading: boolean;
    error: string | null;
  }>({
    response: null,
    status: null,
    loading: false,
    error: null,
  });
  const [isStandalone, setIsStandalone] = useState(isStandaloneWebApp());
  const [viewportSnapshot, setViewportSnapshot] = useState<MobileViewportSnapshot>(
    () => readCurrentViewportSnapshot(),
  );
  const [pushRuntime, setPushRuntime] = useState<MobilePushRuntimeSnapshot>({
    supported: false,
    permission: "unsupported",
    config: null,
    subscription: null,
  });
  const [pushRuntimeBusy, setPushRuntimeBusy] = useState(false);
  const [pushRuntimeError, setPushRuntimeError] = useState<string | null>(null);
  const [previewSheetOffset, setPreviewSheetOffset] = useState(0);
  const [previewSheetDragging, setPreviewSheetDragging] = useState(false);

  const explorerListRef = useRef<HTMLDivElement | null>(null);
  const previewSheetRef = useRef<HTMLDivElement | null>(null);
  const generalUploadInputRef = useRef<HTMLInputElement | null>(null);
  const mediaUploadInputRef = useRef<HTMLInputElement | null>(null);
  const loadedPageKeysRef = useRef<Set<string>>(new Set());
  const activeListingKeyRef = useRef("");
  const pendingScrollRestorePathRef = useRef<string | null>(currentPath);
  const scrollPositionsRef = useRef<Map<string, number>>(new Map());
  const uploadCancellationRef = useRef<Map<string, () => void>>(new Map());
  const historyWriteModeRef = useRef<"push" | "replace">("replace");
  const lastLocationKeyRef = useRef("");
  const recoveredExplorerPathsRef = useRef<Set<string>>(new Set());
  const isApplyingPopStateRef = useRef(false);
  const consumedDownloadIntentKeyRef = useRef<string>("");
  const previewSheetOffsetRef = useRef(0);

  const deferredFilterInput = useDeferredValue(filterInput.trim().toLowerCase());
  const showInstallTip = !installTipDismissed && isIosSafari() && !isStandalone;

  const resolvedLayout = useMemo(
    () =>
      normalizeMobileLayoutSettings(
        themeSnapshot?.layout ?? defaultMobileLayoutSettings,
        layoutOverrides,
      ),
    [layoutOverrides, themeSnapshot?.layout],
  );
  const browseRequestOptions = useMemo(
    () => buildBrowseRequestOptions(resolvedLayout),
    [resolvedLayout],
  );
  const browsePolicyKey = useMemo(
    () => buildListingKey(currentPath, browseRequestOptions),
    [browseRequestOptions, currentPath],
  );
  const loadedEntries = useMemo(
    () => entries.filter((entry): entry is MobileShareEntry => entry !== null),
    [entries],
  );
  const filteredEntries = useMemo(() => {
    if (!deferredFilterInput) {
      return loadedEntries;
    }
    return loadedEntries.filter((entry) =>
      matchesExplorerFilter(entry, deferredFilterInput),
    );
  }, [deferredFilterInput, loadedEntries]);
  const breadcrumbSegments = useMemo(
    () => currentPath.split("/").filter(Boolean),
    [currentPath],
  );
  const quickPlaceEntries = useMemo(() => {
    if (currentPath.length > 0) {
      return [];
    }

    const preferredNames = [
      "Desktop",
      "Downloads",
      "Documents",
      "Pictures",
      "Music",
      "Movies",
      "Videos",
      "Projects",
      "Dev",
    ];
    const directoryEntries = loadedEntries.filter((entry) => entry.isDir);
    const matchedEntries = preferredNames
      .map((preferredName) =>
        directoryEntries.find(
          (entry) => entry.name.toLowerCase() === preferredName.toLowerCase(),
        ),
      )
      .filter((entry): entry is MobileShareEntry => entry != null);
    const seenPaths = new Set(matchedEntries.map((entry) => entry.relativePath));
    const fallbackEntries = directoryEntries.filter(
      (entry) => !seenPaths.has(entry.relativePath),
    );

    return [...matchedEntries, ...fallbackEntries].slice(0, 6);
  }, [currentPath, loadedEntries]);
  const gridCardSize = getGridIconSizeForViewport(
    resolvedLayout,
    viewportSnapshot.width,
  );
  const mobileShellStyle = useMemo(
    () => buildMobileShellStyle(resolvedLayout, viewportSnapshot),
    [resolvedLayout, viewportSnapshot],
  );
  const previewDismissThreshold = useMemo(
    () => Math.max(136, Math.round(viewportSnapshot.height * 0.18)),
    [viewportSnapshot.height],
  );

  function commitLocationState(
    nextState: MobileLocationState,
    mode: "push" | "replace",
  ): void {
    const nextKey = buildLocationKey(nextState);
    const nextUrl = buildMobileLocationUrl(nextState);

    if (mode === "push" && nextKey !== lastLocationKeyRef.current) {
      window.history.pushState(nextState, "", nextUrl);
    } else {
      window.history.replaceState(nextState, "", nextUrl);
    }

    lastLocationKeyRef.current = nextKey;
  }

  function writeLocationState(mode: "push" | "replace"): void {
    commitLocationState(
      {
        tab: activeTab,
        path: currentPath,
      },
      mode,
    );
  }

  function saveExplorerScrollPosition(path: string = currentPath): void {
    if (!path && !hubMode) {
      scrollPositionsRef.current.set("", explorerListRef.current?.scrollTop ?? 0);
      return;
    }
    scrollPositionsRef.current.set(path, explorerListRef.current?.scrollTop ?? 0);
  }

  const clearPreview = useCallback((): void => {
    previewSheetOffsetRef.current = 0;
    setPreviewSheetOffset(0);
    setPreviewSheetDragging(false);
    setPreviewState({
      entry: null,
      preview: null,
      loading: false,
      error: null,
    });
  }, []);

  function consumeDownloadIntent(
    relativePath: string,
    displayName?: string,
    sourceLabel: string = "Desktop ping",
  ): void {
    const normalizedRelativePath = relativePath.trim().replace(/^\/+/, "");
    if (!normalizedRelativePath) {
      return;
    }

    const fileName =
      displayName?.trim() ||
      normalizedRelativePath.split("/").filter(Boolean).slice(-1)[0] ||
      "download";
    const syntheticEntry: MobileShareEntry = {
      name: fileName,
      relativePath: normalizedRelativePath,
      isDir: false,
      isHidden: false,
      size: 0,
      extension: fileName.includes(".")
        ? fileName.split(".").slice(1).join(".")
        : "",
      mimeType: null,
      modifiedMs: null,
      entryKind: "file",
      iconId: themeSnapshot?.iconTheme.file ?? "file",
      thumbnailUrl: null,
      previewKind: null,
      canPreview: false,
      canDownload: true,
      fileUrl: buildMobileFileUrl(normalizedRelativePath),
      downloadUrl: buildMobileFileUrl(normalizedRelativePath),
    };

    startDownload(syntheticEntry, {
      message: `Queued from ${sourceLabel}.`,
      sourceLabel,
      navigationMode: "replace",
    });
  }

  function readPendingDownloadIntentFromLocation(): {
    key: string;
    relativePath: string;
    displayName: string | undefined;
    parentPath: string;
  } | null {
    const params = new URLSearchParams(window.location.search);
    const intent = params.get("intent");
    const relativePath = params.get("download")?.trim();
    if (intent !== "push-download" || !relativePath) {
      return null;
    }

    const displayName = params.get("downloadName")?.trim() || undefined;
    const parentPath =
      params.get("path")?.trim() ||
      relativePath.split("/").slice(0, -1).join("/");

    return {
      key: `${intent}:${relativePath}`,
      relativePath,
      displayName,
      parentPath,
    };
  }

  function resetListingState(nextPath: string): void {
    loadedPageKeysRef.current = new Set();
    activeListingKeyRef.current = buildListingKey(nextPath, browseRequestOptions);
    pendingScrollRestorePathRef.current = nextPath;
    setEntries([]);
    setParentPath("");
    setTotalCount(0);
    setCanGoUp(false);
    setHubMode(false);
    setNextOffset(null);
    setLoadingError(null);
    clearPreview();
  }

  async function loadDirectoryPage(path: string, offset: number): Promise<void> {
    const listingKey = buildListingKey(path, browseRequestOptions);
    const pageKey = `${listingKey}::${offset}`;
    if (loadedPageKeysRef.current.has(pageKey)) {
      return;
    }

    loadedPageKeysRef.current.add(pageKey);
    if (offset === 0) {
      setIsListingLoading(true);
    } else {
      setIsLoadingMore(true);
    }

    try {
      const response = await fetchMobileListing(
        path,
        offset,
        browseRequestOptions,
        MOBILE_PAGE_SIZE,
      );
      if (activeListingKeyRef.current !== listingKey) {
        return;
      }

      setShareName(response.shareName);
      setParentPath(response.parentPath);
      setCanGoUp(response.canGoUp);
      setHubMode(response.hubMode);
      setTotalCount(response.totalCount);
      setNextOffset(response.nextOffset);
      setEntries((current) => {
        const nextEntries: Array<MobileShareEntry | null> =
          current.length === response.totalCount
            ? [...current]
            : Array.from({ length: response.totalCount }, (_, index) => {
                return current[index] ?? null;
              });
        response.entries.forEach((entry, index) => {
          nextEntries[response.offset + index] = entry;
        });
        return nextEntries;
      });
      setLoadingError(null);
    } catch (error) {
      loadedPageKeysRef.current.delete(pageKey);
      if (activeListingKeyRef.current === listingKey) {
        setLoadingError(
          error instanceof Error
            ? error.message
            : "Failed to load the paired explorer.",
        );
      }
    } finally {
      if (activeListingKeyRef.current === listingKey) {
        setIsListingLoading(false);
        setIsLoadingMore(false);
      }
    }
  }

  function navigateTo(nextState: MobileLocationState, mode: "push" | "replace" = "push"): void {
    historyWriteModeRef.current = mode;
    commitLocationState(nextState, mode);
    if (activeTab !== nextState.tab) {
      setActiveTab(nextState.tab);
    }
    if (currentPath !== nextState.path) {
      saveExplorerScrollPosition();
      setCurrentPath(nextState.path);
    }
    if (activeTab === nextState.tab && currentPath === nextState.path) {
      writeLocationState(mode);
    }
  }

  function navigateToExplorerPath(nextPath: string, mode: "push" | "replace" = "push"): void {
    navigateTo(
      {
        tab: "explorer",
        path: nextPath,
      },
      mode,
    );
  }

  async function refreshCurrentDirectory(nextPath: string = currentPath): Promise<void> {
    resetListingState(nextPath);
    await loadDirectoryPage(nextPath, 0);
  }

  async function openPreviewForPath(
    relativePath: string,
    fallbackEntry: MobileShareEntry | null,
  ): Promise<void> {
    setPreviewState({
      entry: fallbackEntry,
      preview: null,
      loading: true,
      error: null,
    });

    try {
      const preview = await fetchMobilePreview(relativePath, {
        showHiddenFiles: resolvedLayout.showHiddenFiles,
      });
      setPreviewState({
        entry: preview.entry,
        preview,
        loading: false,
        error: null,
      });
    } catch (error) {
      setPreviewState({
        entry: fallbackEntry,
        preview: null,
        loading: false,
        error:
          error instanceof Error ? error.message : "Failed to load preview.",
      });
    }
  }

  function startDownload(
    entry: MobileShareEntry,
    options?: {
      message?: string;
      sourceLabel?: string;
      navigationMode?: "push" | "replace";
    },
  ) {
    const downloadUrl =
      entry.downloadUrl ?? entry.fileUrl ?? buildMobileFileUrl(entry.relativePath);
    const transferId = createTransfer({
      direction: "download",
      displayName: entry.name,
      targetPath: entry.relativePath,
      sourceLabel: options?.sourceLabel ?? "Browser handoff",
      phase: "handoff",
      bytesTransferred: entry.size,
      bytesTotal: entry.size > 0 ? entry.size : null,
      progress: entry.size > 0 ? 1 : null,
      message: options?.message ?? "Sent to the browser download manager.",
      fileUrl: downloadUrl,
    });

    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = entry.name;
    link.rel = "noreferrer";
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    link.remove();

    patchTransfer(transferId, {
      phase: "completed",
    });
    navigateTo(
      {
        tab: "transfers",
        path: currentPath,
      },
      options?.navigationMode ?? "push",
    );
  }

  function beginUploadTransfer(
    files: File[],
    sourceLabel: string,
    existingTransferId?: string,
  ) {
    if (files.length === 0) {
      return;
    }

    for (const file of files) {
      const transferId =
        existingTransferId ??
        createTransfer({
          direction: "upload",
          displayName: file.name,
          targetPath: currentPath,
          sourceLabel,
          phase: "queued",
          bytesTransferred: 0,
          bytesTotal: file.size,
          progress: 0,
          message: null,
          fileUrl: null,
          files: [file],
        });

      patchTransfer(transferId, {
        phase: "running",
        bytesTransferred: 0,
        bytesTotal: file.size,
        progress: 0,
        message: `Uploading into ${formatRelativePath(currentPath)}`,
        files: [file],
      });

      const uploadTask = startMobileUpload({
        path: currentPath,
        files: [file],
        onProgress: ({ loaded, total, fraction }) => {
          patchTransfer(transferId, {
            phase: "running",
            bytesTransferred: loaded,
            bytesTotal: total,
            progress: fraction,
          });
        },
      });

      uploadCancellationRef.current.set(transferId, uploadTask.cancel);
      uploadTask.promise
        .then((response) => {
          uploadCancellationRef.current.delete(transferId);
          patchTransfer(transferId, {
            phase: "completed",
            bytesTransferred: file.size,
            bytesTotal: file.size,
            progress: 1,
            message:
              response.uploaded > 0
                ? `Uploaded into ${formatRelativePath(currentPath)}`
                : "No files were written by the mobile share.",
          });
          void refreshCurrentDirectory();
        })
        .catch((error) => {
          uploadCancellationRef.current.delete(transferId);
          const message =
            error instanceof Error ? error.message : "Upload failed.";
          patchTransfer(transferId, {
            phase: message.includes("canceled") ? "canceled" : "error",
            message,
          });
        });
    }

    navigateTo(
      {
        tab: "transfers",
        path: currentPath,
      },
      "push",
    );
  }

  function handleUploadSelection(
    fileList: FileList | null,
    sourceLabel: string,
  ) {
    if (!fileList || fileList.length === 0) {
      return;
    }
    beginUploadTransfer(Array.from(fileList), sourceLabel);
  }

  async function enablePushNotifications(): Promise<void> {
    setPushRuntimeBusy(true);
    setPushRuntimeError(null);
    try {
      const snapshot = await subscribeMobilePushNotifications();
      setPushRuntime(snapshot);
    } catch (error) {
      setPushRuntimeError(
        error instanceof Error
          ? error.message
          : "Failed to enable mobile notifications.",
      );
    } finally {
      setPushRuntimeBusy(false);
    }
  }

  async function disablePushNotifications(): Promise<void> {
    setPushRuntimeBusy(true);
    setPushRuntimeError(null);
    try {
      const snapshot = await unsubscribeMobilePushNotifications();
      setPushRuntime(snapshot);
    } catch (error) {
      setPushRuntimeError(
        error instanceof Error
          ? error.message
          : "Failed to disable mobile notifications.",
      );
    } finally {
      setPushRuntimeBusy(false);
    }
  }

  function retryTransfer(transferId: string) {
    const transfer = useMobileStore
      .getState()
      .transfers.find((candidate) => candidate.id === transferId);
    if (!transfer || transfer.direction !== "upload" || !transfer.files?.length) {
      return;
    }
    beginUploadTransfer([...transfer.files], transfer.sourceLabel, transferId);
  }

  function cancelTransfer(transferId: string) {
    const cancelUpload = uploadCancellationRef.current.get(transferId);
    if (cancelUpload) {
      cancelUpload();
      uploadCancellationRef.current.delete(transferId);
    } else {
      patchTransfer(transferId, {
        phase: "canceled",
        message: "Transfer canceled.",
      });
    }
  }

  function revealTransferPath(targetPath: string): void {
    const parentTargetPath =
      targetPath.split("/").filter(Boolean).length > 1 && !targetPath.endsWith("/")
        ? targetPath.split("/").slice(0, -1).join("/")
        : targetPath;
    navigateToExplorerPath(parentTargetPath, "push");
  }

  function handleExplorerScroll(event: UIEvent<HTMLDivElement>): void {
    const container = event.currentTarget;
    scrollPositionsRef.current.set(currentPath, container.scrollTop);

    if (
      nextOffset != null
      && !isLoadingMore
      && container.scrollTop + container.clientHeight >= container.scrollHeight - 240
    ) {
      void loadDirectoryPage(currentPath, nextOffset);
    }
  }

  useEffect(() => {
    if (lastLocationKeyRef.current.length > 0) {
      return;
    }

    const initialState = initialLocationStateRef.current;
    if (activeTab !== initialState.tab) {
      setActiveTab(initialState.tab);
    }
    if (explorerPath !== initialState.path) {
      setExplorerPath(initialState.path);
    }
    lastLocationKeyRef.current = buildLocationKey(initialState);
    window.history.replaceState(initialState, "", buildMobileLocationUrl(initialState));
  }, []);

  useEffect(() => {
    resetListingState(currentPath);
    void loadDirectoryPage(currentPath, 0);
  }, [browsePolicyKey]);

  useEffect(() => {
    setExplorerPath(currentPath);
  }, [currentPath, setExplorerPath]);

  useEffect(() => {
    const nextState = {
      tab: activeTab,
      path: currentPath,
    } satisfies MobileLocationState;

    if (isApplyingPopStateRef.current) {
      isApplyingPopStateRef.current = false;
      lastLocationKeyRef.current = buildLocationKey(nextState);
      return;
    }

    writeLocationState(historyWriteModeRef.current);
    historyWriteModeRef.current = "replace";
  }, [activeTab, currentPath]);

  useEffect(() => {
    const handlePopState = () => {
      const nextState = readMobileLocationState();
      isApplyingPopStateRef.current = true;
      setActiveTab(nextState.tab);
      setCurrentPath(nextState.path);
    };

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [setActiveTab]);

  useEffect(() => {
    if (!previewState.entry) {
      previewSheetOffsetRef.current = 0;
      setPreviewSheetOffset(0);
      setPreviewSheetDragging(false);
      return;
    }

    const previewSheet = previewSheetRef.current;
    if (!previewSheet) {
      return;
    }

    let currentOffset = 0;
    const draggablePreviewSheet = interact(previewSheet).draggable({
      startAxis: "y",
      lockAxis: "y",
      inertia: true,
      allowFrom: ".mobile-overlay__grabber, .mobile-overlay__header",
      ignoreFrom:
        ".mobile-overlay__actions, .mobile-overlay__body, button, a, input, textarea, video, audio, iframe",
      listeners: {
        start() {
          currentOffset = previewSheetOffsetRef.current;
          setPreviewSheetDragging(true);
        },
        move(event) {
          currentOffset = Math.max(0, currentOffset + event.dy);
          previewSheetOffsetRef.current = currentOffset;
          setPreviewSheetOffset(currentOffset);
        },
        end() {
          setPreviewSheetDragging(false);
          if (currentOffset >= previewDismissThreshold) {
            clearPreview();
            return;
          }

          currentOffset = 0;
          previewSheetOffsetRef.current = 0;
          setPreviewSheetOffset(0);
        },
      },
    });

    return () => {
      draggablePreviewSheet.unset();
      previewSheetOffsetRef.current = 0;
      setPreviewSheetOffset(0);
      setPreviewSheetDragging(false);
    };
  }, [clearPreview, previewDismissThreshold, previewState.entry]);

  useEffect(() => {
    if (!previewState.entry) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        clearPreview();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [clearPreview, previewState.entry]);

  useEffect(() => {
    if (
      !loadingError
      || currentPath.length === 0
      || entries.length > 0
      || recoveredExplorerPathsRef.current.has(currentPath)
      || (!loadingError.startsWith("404") && !loadingError.startsWith("403"))
    ) {
      return;
    }

    recoveredExplorerPathsRef.current.add(currentPath);
    historyWriteModeRef.current = "replace";
    setCurrentPath("");
    setLoadingError(null);
  }, [currentPath, entries.length, loadingError]);

  useEffect(() => {
    if (
      pendingScrollRestorePathRef.current !== currentPath
      || isListingLoading
      || explorerListRef.current == null
    ) {
      return;
    }

    const targetScrollTop = scrollPositionsRef.current.get(currentPath) ?? 0;
    window.requestAnimationFrame(() => {
      if (explorerListRef.current) {
        explorerListRef.current.scrollTop = targetScrollTop;
      }
    });
    pendingScrollRestorePathRef.current = null;
  }, [currentPath, entries.length, isListingLoading]);

  useEffect(() => {
    const syncStandaloneMode = () => {
      setIsStandalone(isStandaloneWebApp());
    };

    const displayModeQuery = window.matchMedia("(display-mode: standalone)");
    syncStandaloneMode();
    if (typeof displayModeQuery.addEventListener === "function") {
      displayModeQuery.addEventListener("change", syncStandaloneMode);
    } else {
      displayModeQuery.addListener(syncStandaloneMode);
    }
    window.addEventListener("pageshow", syncStandaloneMode);
    document.addEventListener("visibilitychange", syncStandaloneMode);

    return () => {
      if (typeof displayModeQuery.removeEventListener === "function") {
        displayModeQuery.removeEventListener("change", syncStandaloneMode);
      } else {
        displayModeQuery.removeListener(syncStandaloneMode);
      }
      window.removeEventListener("pageshow", syncStandaloneMode);
      document.removeEventListener("visibilitychange", syncStandaloneMode);
    };
  }, []);

  useEffect(() => {
    const syncViewportSnapshot = () => {
      setViewportSnapshot(readCurrentViewportSnapshot());
    };

    syncViewportSnapshot();
    window.addEventListener("resize", syncViewportSnapshot);
    window.addEventListener("orientationchange", syncViewportSnapshot);
    window.visualViewport?.addEventListener("resize", syncViewportSnapshot);
    window.visualViewport?.addEventListener("scroll", syncViewportSnapshot);

    return () => {
      window.removeEventListener("resize", syncViewportSnapshot);
      window.removeEventListener("orientationchange", syncViewportSnapshot);
      window.visualViewport?.removeEventListener("resize", syncViewportSnapshot);
      window.visualViewport?.removeEventListener("scroll", syncViewportSnapshot);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadPushRuntime = async () => {
      try {
        const snapshot = await loadMobilePushRuntimeSnapshot();
        if (!cancelled) {
          setPushRuntime(snapshot);
          setPushRuntimeError(null);
        }
      } catch (error) {
        if (!cancelled) {
          setPushRuntimeError(
            error instanceof Error
              ? error.message
              : "Failed to load the push pairing state.",
          );
        }
      }
    };

    void loadPushRuntime();
    const unsubscribe = listenToMobilePushMessages(
      (intent: MobilePushNotificationIntent) => {
        const normalizedParentPath = intent.parentPath.trim();
        if (normalizedParentPath !== currentPath) {
          navigateTo(
            {
              tab: "transfers",
              path: normalizedParentPath,
            },
            "replace",
          );
        } else {
          setActiveTab("transfers");
        }
        consumeDownloadIntent(intent.relativePath, intent.displayName, "desktop ping");
      },
    );

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [currentPath, setActiveTab]);

  useEffect(() => {
    const pendingIntent = readPendingDownloadIntentFromLocation();
    if (!pendingIntent) {
      consumedDownloadIntentKeyRef.current = "";
      return;
    }

    if (pendingIntent.key === consumedDownloadIntentKeyRef.current) {
      return;
    }

    consumedDownloadIntentKeyRef.current = pendingIntent.key;
    navigateTo(
      {
        tab: "transfers",
        path: pendingIntent.parentPath,
      },
      "replace",
    );
    consumeDownloadIntent(
      pendingIntent.relativePath,
      pendingIntent.displayName,
      "desktop ping",
    );
  }, [activeTab, currentPath]);

  useEffect(() => {
    let cancelled = false;

    const loadTheme = async () => {
      try {
        const snapshot = await fetchMobileThemeSnapshot();
        if (!cancelled) {
          setThemeSnapshot(snapshot);
          applyMobileThemeSnapshot(snapshot);
        }
      } catch (error) {
        if (!cancelled) {
          console.warn("GreebleFS Mobile: failed to load paired theme snapshot", error);
        }
      }
    };

    void loadTheme();
    const intervalId = window.setInterval(() => {
      void loadTheme();
    }, 15000);
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void loadTheme();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setSearchQuery(searchInput.trim());
    }, MOBILE_SEARCH_DEBOUNCE_MS);
    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [searchInput]);

  useEffect(() => {
    let cancelled = false;

    const loadSearchStatus = async () => {
      try {
        const response = await fetchMobileSearchStatus();
        if (!cancelled) {
          setSearchState((current) => ({
            ...current,
            status: response,
          }));
        }
      } catch (error) {
        if (!cancelled) {
          setSearchState((current) => ({
            ...current,
            error:
              error instanceof Error
                ? error.message
                : "Failed to load search status.",
          }));
        }
      }
    };

    void loadSearchStatus();
    const intervalMs =
      searchState.status?.status?.isScanInProgress ||
      searchState.status?.status?.isCommitting
        ? 1200
        : 6000;
    const intervalId = window.setInterval(() => {
      void loadSearchStatus();
    }, intervalMs);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [
    searchState.status?.status?.isCommitting,
    searchState.status?.status?.isScanInProgress,
  ]);

  useEffect(() => {
    let cancelled = false;

    if (searchQuery.length < 2) {
      setSearchState((current) => ({
        ...current,
        response: null,
        loading: false,
        error: null,
      }));
      return;
    }

    setSearchState((current) => ({
      ...current,
      loading: true,
      error: null,
    }));

    void fetchMobileSearchResults(searchQuery, {
      showHiddenFiles: resolvedLayout.showHiddenFiles,
      limit: 48,
    })
      .then((response) => {
        if (cancelled) {
          return;
        }
        setSearchState((current) => ({
          ...current,
          response,
          loading: false,
          error: null,
        }));
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }
        setSearchState((current) => ({
          ...current,
          loading: false,
          error:
            error instanceof Error ? error.message : "Search request failed.",
        }));
      });

    return () => {
      cancelled = true;
    };
  }, [resolvedLayout.showHiddenFiles, searchQuery]);

  function renderExplorerEntries() {
    if (loadingError) {
      return <div className="mobile-empty-state">{loadingError}</div>;
    }

    if (isListingLoading && entries.length === 0) {
      return <div className="mobile-empty-state">Loading explorer…</div>;
    }

    if (filteredEntries.length === 0) {
      return (
        <div className="mobile-empty-state">
          {deferredFilterInput
            ? "Nothing in the current folder matches that quick filter."
            : "This share is empty."}
        </div>
      );
    }

    return (
      <MobileExplorerVirtualSurface
        entries={filteredEntries}
        layout={resolvedLayout}
        viewportWidth={viewportSnapshot.width}
        gridCardSize={gridCardSize}
        themeSnapshot={themeSnapshot}
        scrollElementRef={explorerListRef}
        onOpenEntry={(entry) => {
          if (entry.isDir) {
            navigateToExplorerPath(entry.relativePath, "push");
            return;
          }
          void openPreviewForPath(entry.relativePath, entry);
        }}
        onPreviewEntry={(entry) => {
          void openPreviewForPath(entry.relativePath, entry);
        }}
        onDownloadEntry={(entry) => {
          startDownload(entry);
        }}
      />
    );
  }

  function renderSearchResults() {
    if (searchState.error) {
      return <div className="mobile-empty-state">{searchState.error}</div>;
    }

    if (searchQuery.length < 2) {
      return (
        <div className="mobile-empty-state">
          Type at least two characters to search the active share.
        </div>
      );
    }

    if (searchState.loading && !searchState.response) {
      return <div className="mobile-empty-state">Searching indexed files…</div>;
    }

    if (!searchState.response || searchState.response.entries.length === 0) {
      return (
        <div className="mobile-empty-state">
          No indexed results matched that search.
        </div>
      );
    }

    return searchState.response.entries.map((entry) => (
      <article className="mobile-search-result" key={`${entry.relativePath}:${entry.score}`}>
        <button
          type="button"
          className="mobile-search-result__main"
          onClick={() => {
            if (entry.isDir) {
              navigateToExplorerPath(entry.relativePath, "push");
              return;
            }
            navigateToExplorerPath(entry.parentRelativePath, "push");
            void openPreviewForPath(entry.relativePath, entry);
          }}
        >
          <MobileEntryIcon entry={entry} themeSnapshot={themeSnapshot} size={52} />
          <div className="mobile-search-result__content">
            <div className="mobile-search-result__name">{entry.name}</div>
            <div className="mobile-search-result__meta">
              {formatRelativePath(entry.parentRelativePath)} · {getRowMetaLabel(entry)}
            </div>
          </div>
        </button>
        <div className="mobile-search-result__actions">
          {entry.canDownload ? (
            <button
              type="button"
              className="mobile-icon-button"
              onClick={() => {
                startDownload(entry);
              }}
              aria-label={`Download ${entry.name}`}
            >
              <Download size={18} strokeWidth={1.7} />
            </button>
          ) : null}
          <button
            type="button"
            className="mobile-icon-button"
            onClick={() => {
              navigateToExplorerPath(
                entry.isDir ? entry.relativePath : entry.parentRelativePath,
                "push",
              );
            }}
            aria-label={`Jump to ${entry.name}`}
          >
            <CornerDownRight size={18} strokeWidth={1.7} />
          </button>
        </div>
      </article>
    ));
  }

  function renderPreviewBody(preview: MobilePreviewResponse) {
    switch (preview.previewKind) {
      case "image":
        return (
          <img
            className="mobile-preview-surface mobile-preview-surface--image"
            src={preview.mediaUrl ?? preview.entry.fileUrl ?? undefined}
            alt={preview.entry.name}
          />
        );
      case "video":
        return (
          <video
            className="mobile-preview-surface mobile-preview-surface--video"
            src={preview.mediaUrl ?? preview.entry.fileUrl ?? undefined}
            poster={preview.posterUrl ?? undefined}
            controls
            playsInline
          />
        );
      case "audio":
        return (
          <div className="mobile-preview-audio">
            <div className="mobile-preview-audio__poster">
              <MobileEntryIcon entry={preview.entry} themeSnapshot={themeSnapshot} />
            </div>
            <audio
              className="mobile-preview-surface mobile-preview-surface--audio"
              src={preview.mediaUrl ?? preview.entry.fileUrl ?? undefined}
              controls
            />
          </div>
        );
      case "pdf":
        return (
          <div className="mobile-preview-pdf">
            <div className="mobile-preview-pdf__meta">
              {preview.pageCount != null
                ? `${preview.pageCount} page${preview.pageCount === 1 ? "" : "s"}`
                : "Browser PDF preview"}
            </div>
            <iframe
              className="mobile-preview-surface mobile-preview-surface--pdf"
              src={preview.openUrl ?? preview.entry.fileUrl ?? undefined}
              title={`${preview.entry.name} PDF preview`}
            />
          </div>
        );
      case "text":
        return (
          <div className="mobile-preview-text">
            <pre>{preview.textExcerpt ?? "No preview text is available."}</pre>
            {preview.textTruncated ? (
              <div className="mobile-preview-text__note">
                The preview is truncated so the phone does not pull the full file.
              </div>
            ) : null}
          </div>
        );
      case "folder":
        return (
          <div className="mobile-preview-summary">
            <div className="mobile-preview-summary__hero">
              <div>{preview.folderSummary?.folderCount ?? 0} folders</div>
              <div>{preview.folderSummary?.fileCount ?? 0} files</div>
              <div>
                {formatBytes(preview.folderSummary?.totalVisibleFileBytes ?? 0)} visible
              </div>
            </div>
            <div className="mobile-preview-summary__rows">
              {preview.folderSummary?.entries.map((entry) => (
                <button
                  key={entry.relativePath}
                  type="button"
                  className="mobile-preview-summary__row"
                  onClick={() => {
                    if (entry.isDir) {
                      clearPreview();
                      navigateToExplorerPath(entry.relativePath, "push");
                      return;
                    }
                    void openPreviewForPath(entry.relativePath, entry);
                  }}
                >
                  <MobileEntryIcon entry={entry} themeSnapshot={themeSnapshot} size={46} />
                  <div className="mobile-preview-summary__row-content">
                    <div>{entry.name}</div>
                    <div className="mobile-preview-summary__row-meta">
                      {getRowMetaLabel(entry)}
                    </div>
                  </div>
                </button>
              ))}
            </div>
            {preview.folderSummary?.truncated ? (
              <div className="mobile-preview-summary__footnote">
                Folder preview is capped so the phone stays fast.
              </div>
            ) : null}
          </div>
        );
      case "archive":
        return (
          <div className="mobile-preview-summary">
            <div className="mobile-preview-summary__hero">
              <div>{preview.archiveSummary?.formatLabel ?? "Archive"}</div>
              <div>{preview.archiveSummary?.folderCount ?? 0} folders</div>
              <div>{preview.archiveSummary?.fileCount ?? 0} files</div>
            </div>
            <div className="mobile-preview-summary__rows">
              {preview.archiveSummary?.entries.map((entry) => (
                <div
                  key={entry.relativePath}
                  className="mobile-preview-summary__row mobile-preview-summary__row--static"
                >
                  <MobileEntryIcon entry={entry} themeSnapshot={themeSnapshot} size={46} />
                  <div className="mobile-preview-summary__row-content">
                    <div>{entry.name}</div>
                    <div className="mobile-preview-summary__row-meta">
                      {getRowMetaLabel(entry)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {preview.archiveSummary?.truncated ? (
              <div className="mobile-preview-summary__footnote">
                Archive preview shows the first slice of the top-level contents.
              </div>
            ) : null}
          </div>
        );
      default:
        return (
          <div className="mobile-empty-state">
            This file type does not have a mobile-native preview yet. Use Open or
            Download instead.
          </div>
        );
    }
  }

  return (
    <div
      className={`mobile-shell mobile-shell--${resolvedLayout.touchComfort}`}
      style={mobileShellStyle}
    >
      <div className="mobile-shell__backdrop" />

      <header className="mobile-topbar">
        <div className="mobile-topbar__identity">
          <div className="mobile-topbar__eyebrow">Sovereign Mobile Link</div>
          <div className="mobile-topbar__headline">
            <h1 className="mobile-topbar__title">{shareName}</h1>
            <button
              type="button"
              className="mobile-icon-button mobile-topbar__refresh"
              onClick={() => {
                void refreshCurrentDirectory();
              }}
              aria-label="Refresh share"
            >
              <RefreshCcw size={18} strokeWidth={1.7} />
            </button>
          </div>
          <div className="mobile-topbar__meta">
            <span
              className={`mobile-status-chip${
                isStandalone ? " mobile-status-chip--accent" : ""
              }`}
            >
              {isStandalone ? "Standalone" : "Browser"}
            </span>
            <span className="mobile-status-chip">
              {hubMode ? "Hub Share" : "Directory Share"}
            </span>
          </div>
        </div>
      </header>

      {showInstallTip ? (
        <section className="mobile-hero">
          <div className="mobile-hero__title">Install the paired shell</div>
          <div className="mobile-hero__body">
            In Safari, tap Share, then choose Add to Home Screen so GreebleFS opens
            as its own task-switcher card with standalone chrome.
          </div>
          <button
            type="button"
            className="mobile-action-button"
            onClick={() => {
              setInstallTipDismissed(true);
            }}
          >
            Dismiss
          </button>
        </section>
      ) : null}

      <main className="mobile-main">
        {activeTab === "explorer" ? (
          <section className="mobile-tab mobile-tab--explorer">
            <div className="mobile-explorer-header">
              <div className="mobile-explorer-header__top">
                <div>
                  <div className="mobile-explorer-header__title">Browse</div>
                  <div className="mobile-explorer-header__meta">
                    {deferredFilterInput
                      ? `${filteredEntries.length} visible of ${totalCount}`
                      : `${loadedEntries.length} loaded of ${totalCount}`}
                    {" · "}
                    {formatSortLabel(resolvedLayout.sortBy)}
                    {" · "}
                    {resolvedLayout.sortOrder === "asc" ? "Asc" : "Desc"}
                  </div>
                </div>
                <div className="mobile-explorer-header__controls">
                  <button
                    type="button"
                    className="mobile-icon-button"
                    onClick={() => {
                      window.history.back();
                    }}
                    aria-label="Go back"
                  >
                    <ChevronLeft size={18} strokeWidth={1.7} />
                  </button>
                  <button
                    type="button"
                    className="mobile-icon-button"
                    disabled={!canGoUp}
                    onClick={() => {
                      navigateToExplorerPath(parentPath, "push");
                    }}
                    aria-label="Go up"
                  >
                    <ChevronUp size={18} strokeWidth={1.7} />
                  </button>
                  <button
                    type="button"
                    className="mobile-icon-button"
                    onClick={() => {
                      navigateToExplorerPath("", "push");
                    }}
                    aria-label="Go to root"
                  >
                    <House size={18} strokeWidth={1.7} />
                  </button>
                </div>
              </div>

              <div className="mobile-breadcrumbs mobile-breadcrumbs--scroll">
                <button
                  type="button"
                  className={`mobile-breadcrumbs__segment${
                    currentPath.length === 0 ? " mobile-breadcrumbs__segment--current" : ""
                  }`}
                  onClick={() => {
                    navigateToExplorerPath("", "push");
                  }}
                >
                  {shareName}
                </button>
                {breadcrumbSegments.map((segment, index) => {
                  const segmentPath = breadcrumbSegments.slice(0, index + 1).join("/");
                  return (
                    <button
                      key={segmentPath}
                      type="button"
                      className={`mobile-breadcrumbs__segment${
                        index === breadcrumbSegments.length - 1
                          ? " mobile-breadcrumbs__segment--current"
                          : ""
                      }`}
                      onClick={() => {
                        navigateToExplorerPath(segmentPath, "push");
                      }}
                    >
                      {segment}
                    </button>
                  );
                })}
              </div>

              {quickPlaceEntries.length > 0 ? (
                <div className="mobile-quick-places">
                  <div className="mobile-quick-places__label">Places</div>
                  <div className="mobile-breadcrumbs mobile-breadcrumbs--scroll">
                    {quickPlaceEntries.map((entry) => (
                      <button
                        key={entry.relativePath}
                        type="button"
                        className="mobile-breadcrumbs__segment mobile-quick-places__pill"
                        onClick={() => {
                          navigateToExplorerPath(entry.relativePath, "push");
                        }}
                      >
                        {entry.name}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="mobile-search">
                <input
                  value={filterInput}
                  onChange={(event) => {
                    setFilterInput(event.target.value);
                  }}
                  className="mobile-search__input"
                  placeholder="Quick filter this folder"
                  type="search"
                />
              </div>
            </div>

            <section
              className="mobile-explorer-list"
              ref={explorerListRef}
              onScroll={handleExplorerScroll}
            >
              {renderExplorerEntries()}
              {isLoadingMore ? (
                <div className="mobile-list-loading">Loading more entries…</div>
              ) : null}
            </section>
          </section>
        ) : null}

        {activeTab === "search" ? (
          <section className="mobile-tab mobile-tab--scroll">
            <div className="mobile-hero mobile-hero--compact">
              <div className="mobile-hero__title">Indexed Search</div>
              <div className="mobile-hero__body">
                {searchState.status?.searchAvailable === false
                  ? searchState.status.message
                  : searchState.status?.status?.isScanInProgress
                    ? `Indexing ${searchState.status.status.scannedDrivesCount}/${searchState.status.status.totalDrivesCount} roots · ${searchState.status.status.indexedItemCount} items`
                    : searchState.status?.status?.isIndexValid
                      ? `Indexed ${searchState.status.status.indexedItemCount} items`
                      : "Start a scan to build the mobile search index for this share."}
              </div>
              <div className="mobile-hero__actions">
                <button
                  type="button"
                  className="mobile-action-button"
                  onClick={() => {
                    void startMobileSearchScan()
                      .then(() => fetchMobileSearchStatus())
                      .then((status) => {
                        setSearchState((current) => ({
                          ...current,
                          status,
                        }));
                      })
                      .catch((error) => {
                        setSearchState((current) => ({
                          ...current,
                          error:
                            error instanceof Error
                              ? error.message
                              : "Failed to start search scan.",
                        }));
                      });
                  }}
                >
                  <ScanSearch size={18} strokeWidth={1.7} />
                  Scan
                </button>
                <button
                  type="button"
                  className="mobile-action-button"
                  onClick={() => {
                    void cancelMobileSearchScan()
                      .then(() => fetchMobileSearchStatus())
                      .then((status) => {
                        setSearchState((current) => ({
                          ...current,
                          status,
                        }));
                      })
                      .catch((error) => {
                        setSearchState((current) => ({
                          ...current,
                          error:
                            error instanceof Error
                              ? error.message
                              : "Failed to cancel search scan.",
                        }));
                      });
                  }}
                >
                  <X size={18} strokeWidth={1.7} />
                  Cancel
                </button>
              </div>
            </div>

            <div className="mobile-search">
              <input
                value={searchInput}
                onChange={(event) => {
                  setSearchInput(event.target.value);
                }}
                className="mobile-search__input"
                placeholder="Search the indexed share"
                type="search"
              />
            </div>

            <section className="mobile-stack">{renderSearchResults()}</section>
          </section>
        ) : null}

        {activeTab === "transfers" ? (
          <section className="mobile-tab mobile-tab--scroll">
            <div className="mobile-hero mobile-hero--compact">
              <div className="mobile-hero__title">Transfers</div>
              <div className="mobile-hero__body">
                Uploads run through the desktop host. Downloads are handed to the
                browser so iOS can keep control of the final save location.
              </div>
              <div className="mobile-hero__actions">
                <button
                  type="button"
                  className="mobile-action-button"
                  onClick={() => {
                    clearFinishedTransfers();
                  }}
                >
                  Clear finished
                </button>
              </div>
            </div>
            <section className="mobile-stack">
              {transfers.length === 0 ? (
                <div className="mobile-empty-state">
                  No transfers yet. Upload from Explorer or download from a preview.
                </div>
              ) : (
                transfers.map((transfer) => (
                  <MobileTransferRow
                    key={transfer.id}
                    transfer={transfer}
                    onRetry={() => {
                      retryTransfer(transfer.id);
                    }}
                    onCancel={() => {
                      cancelTransfer(transfer.id);
                    }}
                    onReveal={() => {
                      revealTransferPath(transfer.targetPath);
                    }}
                  />
                ))
              )}
            </section>
          </section>
        ) : null}

        {activeTab === "settings" ? (
          <section className="mobile-tab mobile-tab--scroll">
            <div className="mobile-stack">
              <article className="mobile-settings-card">
                <div className="mobile-settings-card__title">Pair State</div>
                <div className="mobile-settings-card__row">
                  <span>Mode</span>
                  <span>{isStandalone ? "Installed web app" : "Browser session"}</span>
                </div>
                <div className="mobile-settings-card__row">
                  <span>Theme</span>
                  <span>{themeSnapshot?.themeName ?? "Loading…"}</span>
                </div>
                <div className="mobile-settings-card__row">
                  <span>Icon theme</span>
                  <span>{themeSnapshot?.iconTheme.name ?? "Loading…"}</span>
                </div>
                <div className="mobile-settings-card__row">
                  <span>URL</span>
                  <span>{window.location.origin}</span>
                </div>
              </article>

              <article className="mobile-settings-card">
                <div className="mobile-settings-card__title">Notifications</div>
                <div className="mobile-settings-card__body">
                  Enable web push so the desktop explorer can ping this phone to open the paired shell and start file downloads immediately.
                </div>
                <div className="mobile-settings-card__row">
                  <span>Support</span>
                  <span>{pushRuntime.supported ? "Ready" : "Unavailable"}</span>
                </div>
                <div className="mobile-settings-card__row">
                  <span>Permission</span>
                  <span>{pushRuntime.permission}</span>
                </div>
                <div className="mobile-settings-card__row">
                  <span>Paired devices</span>
                  <span>{pushRuntime.config?.subscriptionCount ?? 0}</span>
                </div>
                {pushRuntimeError ? (
                  <div className="mobile-settings-card__note mobile-settings-card__note--error">
                    {pushRuntimeError}
                  </div>
                ) : null}
                {!isStandalone ? (
                  <div className="mobile-settings-card__note">
                    Add GreebleFS to Home Screen on iPhone before asking for notification permission.
                  </div>
                ) : null}
                <div className="mobile-settings-card__actions">
                  <button
                    type="button"
                    className="mobile-action-button"
                    disabled={pushRuntimeBusy || !pushRuntime.supported || !isStandalone}
                    onClick={() => {
                      void enablePushNotifications();
                    }}
                  >
                    <Bell size={18} strokeWidth={1.7} />
                    {pushRuntime.subscription ? "Refresh Pairing" : "Enable Push"}
                  </button>
                  {pushRuntime.subscription ? (
                    <button
                      type="button"
                      className="mobile-action-button"
                      disabled={pushRuntimeBusy}
                      onClick={() => {
                        void disablePushNotifications();
                      }}
                    >
                      <BellOff size={18} strokeWidth={1.7} />
                      Disable
                    </button>
                  ) : null}
                </div>
              </article>

              <article className="mobile-settings-card">
                <div className="mobile-settings-card__title">Session Layout Tuning</div>
                <div className="mobile-settings-card__body">
                  These controls sit on top of the desktop Mobile Theme settings so you can tune the current phone session without breaking the paired shell contract.
                </div>
                <div className="mobile-settings-card__slider-block">
                  <div className="mobile-settings-card__row">
                    <span>Interface scale</span>
                    <span>{resolvedLayout.interfaceScale.toFixed(2)}x</span>
                  </div>
                  <input
                    className="mobile-slider"
                    type="range"
                    min="0.85"
                    max="1.6"
                    step="0.05"
                    value={resolvedLayout.interfaceScale}
                    onChange={(event) => {
                      patchLayoutOverrides({
                        interfaceScale: Number(event.currentTarget.value),
                      });
                    }}
                  />
                </div>
                <div className="mobile-settings-card__slider-block">
                  <div className="mobile-settings-card__row">
                    <span>Chrome scale</span>
                    <span>{resolvedLayout.chromeScale.toFixed(2)}x</span>
                  </div>
                  <input
                    className="mobile-slider"
                    type="range"
                    min="0.85"
                    max="1.6"
                    step="0.05"
                    value={resolvedLayout.chromeScale}
                    onChange={(event) => {
                      patchLayoutOverrides({
                        chromeScale: Number(event.currentTarget.value),
                      });
                    }}
                  />
                </div>
                <div className="mobile-settings-card__slider-block">
                  <div className="mobile-settings-card__row">
                    <span>Grid zoom</span>
                    <span>{resolvedLayout.gridZoom.toFixed(2)}x</span>
                  </div>
                  <input
                    className="mobile-slider"
                    type="range"
                    min="0.7"
                    max="2.6"
                    step="0.05"
                    value={resolvedLayout.gridZoom}
                    onChange={(event) => {
                      patchLayoutOverrides({
                        gridZoom: Number(event.currentTarget.value),
                      });
                    }}
                  />
                </div>
                <div className="mobile-settings-card__slider-block">
                  <div className="mobile-settings-card__row">
                    <span>Page gutter</span>
                    <span>{resolvedLayout.pagePadding}px</span>
                  </div>
                  <input
                    className="mobile-slider"
                    type="range"
                    min="10"
                    max="32"
                    step="1"
                    value={resolvedLayout.pagePadding}
                    onChange={(event) => {
                      patchLayoutOverrides({
                        pagePadding: Number(event.currentTarget.value),
                      });
                    }}
                  />
                </div>
                <div className="mobile-settings-card__section">
                  <div className="mobile-settings-card__section-label">Touch comfort</div>
                  <div className="mobile-layout-toggle-grid">
                    {["compact", "balanced", "comfortable"].map((option) => (
                      <button
                        key={option}
                        type="button"
                        className={`mobile-layout-pill${
                          resolvedLayout.touchComfort === option
                            ? " mobile-layout-pill--active"
                            : ""
                        }`}
                        onClick={() => {
                          patchLayoutOverrides({
                            touchComfort:
                              option as MobileLayoutSettings["touchComfort"],
                          });
                        }}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="mobile-settings-card__section">
                  <div className="mobile-settings-card__section-label">Quick toggles</div>
                  <div className="mobile-layout-toggle-grid">
                    <button
                      type="button"
                      className={`mobile-layout-pill${
                        resolvedLayout.showTabLabels
                          ? " mobile-layout-pill--active"
                          : ""
                      }`}
                      onClick={() => {
                        patchLayoutOverrides({
                          showTabLabels: !resolvedLayout.showTabLabels,
                        });
                      }}
                    >
                      Dock labels
                    </button>
                    <button
                      type="button"
                      className={`mobile-layout-pill${
                        resolvedLayout.showHiddenFiles
                          ? " mobile-layout-pill--active"
                          : ""
                      }`}
                      onClick={() => {
                        patchLayoutOverrides({
                          showHiddenFiles: !resolvedLayout.showHiddenFiles,
                        });
                      }}
                    >
                      Hidden files
                    </button>
                    <button
                      type="button"
                      className={`mobile-layout-pill${
                        resolvedLayout.directoriesFirst
                          ? " mobile-layout-pill--active"
                          : ""
                      }`}
                      onClick={() => {
                        patchLayoutOverrides({
                          directoriesFirst: !resolvedLayout.directoriesFirst,
                        });
                      }}
                    >
                      Folders first
                    </button>
                  </div>
                </div>
              </article>

              <article className="mobile-settings-card">
                <div className="mobile-settings-card__title">Layout</div>
                <div className="mobile-settings-card__row">
                  <span>View mode</span>
                  <span>{resolvedLayout.viewMode}</span>
                </div>
                <div className="mobile-settings-card__row">
                  <span>Grid zoom</span>
                  <span>{resolvedLayout.gridZoom.toFixed(2)}x</span>
                </div>
                <div className="mobile-settings-card__row">
                  <span>Interface scale</span>
                  <span>{resolvedLayout.interfaceScale.toFixed(2)}x</span>
                </div>
                <div className="mobile-settings-card__row">
                  <span>Chrome scale</span>
                  <span>{resolvedLayout.chromeScale.toFixed(2)}x</span>
                </div>
                <div className="mobile-settings-card__row">
                  <span>Touch comfort</span>
                  <span>{resolvedLayout.touchComfort}</span>
                </div>
                <div className="mobile-settings-card__row">
                  <span>Sort</span>
                  <span>
                    {resolvedLayout.sortBy} · {resolvedLayout.sortOrder}
                  </span>
                </div>
                <div className="mobile-settings-card__row">
                  <span>Page gutter</span>
                  <span>{resolvedLayout.pagePadding}px</span>
                </div>
                <div className="mobile-settings-card__row">
                  <span>Hidden files</span>
                  <span>{resolvedLayout.showHiddenFiles ? "Visible" : "Hidden"}</span>
                </div>
                <div className="mobile-settings-card__row">
                  <span>Dock labels</span>
                  <span>{resolvedLayout.showTabLabels ? "Shown" : "Icons only"}</span>
                </div>
              </article>

              <article className="mobile-settings-card">
                <div className="mobile-settings-card__title">Connection</div>
                <div className="mobile-settings-card__row">
                  <span>Secure context</span>
                  <span>{window.isSecureContext ? "Yes" : "No"}</span>
                </div>
                <div className="mobile-settings-card__row">
                  <span>Share type</span>
                  <span>{hubMode ? "Multi-file hub" : "Directory traversal"}</span>
                </div>
                <div className="mobile-settings-card__row">
                  <span>Explorer path</span>
                  <span>{formatRelativePath(currentPath)}</span>
                </div>
                <div className="mobile-settings-card__row">
                  <span>Indexed search</span>
                  <span>
                    {searchState.status?.searchAvailable === false
                      ? "Unavailable"
                      : searchState.status?.status?.isIndexValid
                        ? "Ready"
                        : "Needs scan"}
                  </span>
                </div>
              </article>

              <article className="mobile-settings-card">
                <div className="mobile-settings-card__title">PWA Notes</div>
                <div className="mobile-settings-card__body">
                  Add this shell to Home Screen to give GreebleFS its own task
                  switcher card, standalone chrome, and a more persistent service
                  worker slot on iPhone.
                </div>
              </article>
            </div>
          </section>
        ) : null}
      </main>

      {activeTab === "explorer" ? (
        <div className="mobile-explorer-actions" aria-label="Explorer actions">
          <div className="mobile-explorer-actions__scroller">
            <div className="mobile-segment-group">
              {MOBILE_VIEW_MODE_BUTTONS.map((option) => {
                const Icon = option.icon;
                const active = resolvedLayout.viewMode === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    className={`mobile-segment-button${
                      active ? " mobile-segment-button--active" : ""
                    }`}
                    onClick={() => {
                      patchLayoutOverrides({
                        viewMode: option.id,
                      });
                    }}
                    aria-label={`Switch to ${option.label} view`}
                  >
                    <Icon size={15} strokeWidth={1.7} />
                    <span>{option.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="mobile-segment-group">
              <button
                type="button"
                className="mobile-segment-button"
                onClick={() => {
                  patchLayoutOverrides({
                    gridZoom: normalizeMobileGridZoom(resolvedLayout.gridZoom - 0.1),
                  });
                }}
                disabled={!isMobileGridViewMode(resolvedLayout.viewMode)}
                aria-label="Zoom grid out"
              >
                <ZoomOut size={15} strokeWidth={1.7} />
              </button>
              <span className="mobile-segment-badge">
                {resolvedLayout.gridZoom.toFixed(1)}x
              </span>
              <button
                type="button"
                className="mobile-segment-button"
                onClick={() => {
                  patchLayoutOverrides({
                    gridZoom: normalizeMobileGridZoom(resolvedLayout.gridZoom + 0.1),
                  });
                }}
                disabled={!isMobileGridViewMode(resolvedLayout.viewMode)}
                aria-label="Zoom grid in"
              >
                <ZoomIn size={15} strokeWidth={1.7} />
              </button>
            </div>

            <button
              type="button"
              className="mobile-toolbar-chip"
              onClick={() => {
                patchLayoutOverrides({
                  sortBy: cycleSortBy(resolvedLayout.sortBy),
                });
              }}
            >
              <ArrowUpDown size={15} strokeWidth={1.7} />
              Sort {formatSortLabel(resolvedLayout.sortBy)}
            </button>

            <button
              type="button"
              className="mobile-toolbar-chip"
              onClick={() => {
                patchLayoutOverrides({
                  sortOrder: resolvedLayout.sortOrder === "asc" ? "desc" : "asc",
                });
              }}
            >
              {resolvedLayout.sortOrder === "asc" ? (
                <ArrowUp size={15} strokeWidth={1.7} />
              ) : (
                <ArrowDown size={15} strokeWidth={1.7} />
              )}
              {resolvedLayout.sortOrder === "asc" ? "Ascending" : "Descending"}
            </button>

            <button
              type="button"
              className={`mobile-toolbar-chip${
                resolvedLayout.showHiddenFiles ? " mobile-toolbar-chip--active" : ""
              }`}
              onClick={() => {
                patchLayoutOverrides({
                  showHiddenFiles: !resolvedLayout.showHiddenFiles,
                });
              }}
            >
              {resolvedLayout.showHiddenFiles ? (
                <Eye size={15} strokeWidth={1.7} />
              ) : (
                <EyeOff size={15} strokeWidth={1.7} />
              )}
              Hidden {resolvedLayout.showHiddenFiles ? "On" : "Off"}
            </button>

            <button
              type="button"
              className="mobile-toolbar-chip mobile-toolbar-chip--accent"
              onClick={() => {
                generalUploadInputRef.current?.click();
              }}
            >
              <Upload size={15} strokeWidth={1.7} />
              Upload
            </button>

            <button
              type="button"
              className="mobile-toolbar-chip"
              onClick={() => {
                mediaUploadInputRef.current?.click();
              }}
            >
              <Images size={15} strokeWidth={1.7} />
              Photos
            </button>
          </div>
        </div>
      ) : null}

      <nav className="mobile-bottom-nav" aria-label="Mobile sections">
        {BOTTOM_DOCK_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`mobile-bottom-nav__item${
              activeTab === tab.id ? " mobile-bottom-nav__item--active" : ""
            }`}
            onClick={() => {
              navigateTo(
                {
                  tab: tab.id,
                  path: currentPath,
                },
                "push",
              );
            }}
            aria-label={tab.label}
          >
            <span className="mobile-bottom-nav__icon">
              {renderThemedIcon({
                slotId: tab.slotId,
                themeSnapshot,
                fallback: tab.fallback,
                className: "mobile-bottom-nav__icon-svg",
              })}
            </span>
            {resolvedLayout.showTabLabels ? (
              <span className="mobile-bottom-nav__label">{tab.label}</span>
            ) : null}
          </button>
        ))}
      </nav>

      <input
        ref={generalUploadInputRef}
        type="file"
        multiple
        hidden
        onChange={(event) => {
          handleUploadSelection(event.target.files, "Files picker");
          event.currentTarget.value = "";
        }}
      />
      <input
        ref={mediaUploadInputRef}
        type="file"
        multiple
        hidden
        accept="image/*,video/*"
        onChange={(event) => {
          handleUploadSelection(event.target.files, "Photos picker");
          event.currentTarget.value = "";
        }}
      />

      {previewState.entry ? (
        <div
          className="mobile-overlay"
          role="dialog"
          aria-modal="true"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              clearPreview();
            }
          }}
        >
          <div
            ref={previewSheetRef}
            className={`mobile-overlay__sheet${
              previewSheetDragging ? " mobile-overlay__sheet--dragging" : ""
            }`}
            style={{
              transform: `translateY(${previewSheetOffset}px)`,
            }}
            onClick={(event) => {
              event.stopPropagation();
            }}
          >
            <div className="mobile-overlay__grabber" aria-hidden="true">
              <span className="mobile-overlay__grabber-handle" />
            </div>
            <div className="mobile-overlay__header">
              <div>
                <div className="mobile-overlay__title">{previewState.entry.name}</div>
                <div className="mobile-overlay__subtitle">
                  {getRowMetaLabel(previewState.entry)}
                </div>
              </div>
              <button
                type="button"
                className="mobile-pill-button"
                onClick={() => {
                  clearPreview();
                }}
              >
                Close
              </button>
            </div>
            <div className="mobile-overlay__actions">
              {previewState.entry.canDownload ? (
                <button
                  type="button"
                  className="mobile-action-button"
                  onClick={() => {
                    if (previewState.entry) {
                      startDownload(previewState.entry);
                    }
                  }}
                >
                  <Download size={18} strokeWidth={1.7} />
                  Download
                </button>
              ) : null}
              {(previewState.preview?.openUrl ?? previewState.entry?.fileUrl) ? (
                <button
                  type="button"
                  className="mobile-action-button"
                  onClick={() => {
                    const targetUrl =
                      previewState.preview?.openUrl ?? previewState.entry?.fileUrl;
                    if (targetUrl) {
                      window.open(targetUrl, "_blank", "noopener,noreferrer");
                    }
                  }}
                >
                  <ExternalLink size={18} strokeWidth={1.7} />
                  Open
                </button>
              ) : null}
            </div>
            <div className="mobile-overlay__body">
              {previewState.loading ? (
                <div className="mobile-empty-state">Loading preview…</div>
              ) : previewState.error ? (
                <div className="mobile-empty-state">{previewState.error}</div>
              ) : previewState.preview ? (
                renderPreviewBody(previewState.preview)
              ) : (
                <div className="mobile-empty-state">Preview is standing by.</div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
