import * as LucideIcons from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  startTransition,
  useDeferredValue,
  useEffect,
  useRef,
  useState,
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
} from "./mobileApi";
import {
  buildParentPath,
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

const MOBILE_ROW_HEIGHT = 80;
const MOBILE_OVERSCAN_ROWS = 8;

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
    const maybeIcon = (
      LucideIcons as unknown as Record<string, LucideIcon | undefined>
    )[reference.value];
    const LucideComponent = maybeIcon ?? FallbackIcon;
    return <LucideComponent className={args.className} strokeWidth={1.7} />;
  }

  return <FallbackIcon className={args.className} strokeWidth={1.7} />;
}

function MobileEntryIcon({
  entry,
  themeSnapshot,
  openFolder = false,
}: {
  entry: MobileShareEntry;
  themeSnapshot: MobileShareThemeSnapshot | null;
  openFolder?: boolean;
}) {
  const iconUrl = resolveMobileEntryIconUrl(entry, themeSnapshot, openFolder);
  const FallbackIcon =
    entry.isDir
      ? LucideIcons.Folder
      : entry.entryKind === "image"
        ? LucideIcons.Image
        : entry.entryKind === "video"
          ? LucideIcons.Video
          : entry.entryKind === "audio"
            ? LucideIcons.AudioLines
            : entry.entryKind === "archive"
              ? LucideIcons.Archive
              : LucideIcons.FileText;

  return (
    <div className="mobile-entry-icon">
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
}: {
  transfer: ReturnType<typeof useMobileStore.getState>["transfers"][number];
  onRetry: () => void;
  onCancel: () => void;
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
      <div className="mobile-transfer-card__path" title={transfer.targetPath}>
        {formatRelativePath(transfer.targetPath)}
      </div>
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

export default function App() {
  const {
    activeTab,
    explorerPath,
    transfers,
    setActiveTab,
    setExplorerPath,
    createTransfer,
    patchTransfer,
    clearFinishedTransfers,
  } = useMobileStore();

  const [currentPath, setCurrentPath] = useState(explorerPath);
  const [shareName, setShareName] = useState("GreebleFS");
  const [canGoUp, setCanGoUp] = useState(false);
  const [hubMode, setHubMode] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [entries, setEntries] = useState<Array<MobileShareEntry | null>>([]);
  const [nextOffset, setNextOffset] = useState<number | null>(null);
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const [filterInput, setFilterInput] = useState("");
  const [installTipDismissed, setInstallTipDismissed] = useState(false);
  const [themeSnapshot, setThemeSnapshot] =
    useState<MobileShareThemeSnapshot | null>(null);
  const [viewportHeight, setViewportHeight] = useState(0);
  const [scrollTop, setScrollTop] = useState(0);
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

  const listRef = useRef<HTMLDivElement | null>(null);
  const generalUploadInputRef = useRef<HTMLInputElement | null>(null);
  const mediaUploadInputRef = useRef<HTMLInputElement | null>(null);
  const loadedPageKeysRef = useRef<Set<string>>(new Set());
  const pendingPathRef = useRef(currentPath);
  const uploadCancellationRef = useRef<Map<string, () => void>>(new Map());
  const deferredFilterInput = useDeferredValue(filterInput.trim().toLowerCase());
  const showInstallTip = !installTipDismissed && isIosSafari() && !isStandalone;

  const loadedEntries = entries.filter(
    (entry): entry is MobileShareEntry => entry !== null,
  );
  const filteredEntries = deferredFilterInput
    ? loadedEntries.filter((entry) =>
        matchesExplorerFilter(entry, deferredFilterInput),
      )
    : entries;

  const totalRows = filteredEntries.length;
  const visibleRowCount = Math.ceil(viewportHeight / MOBILE_ROW_HEIGHT);
  const startIndex = Math.max(
    0,
    Math.floor(scrollTop / MOBILE_ROW_HEIGHT) - MOBILE_OVERSCAN_ROWS,
  );
  const endIndex = Math.min(
    totalRows,
    startIndex + visibleRowCount + MOBILE_OVERSCAN_ROWS * 2,
  );
  const visibleRows = filteredEntries.slice(startIndex, endIndex);
  const topSpacerHeight = startIndex * MOBILE_ROW_HEIGHT;
  const bottomSpacerHeight = Math.max(
    0,
    (totalRows - endIndex) * MOBILE_ROW_HEIGHT,
  );

  function resetListingState(nextPath: string) {
    pendingPathRef.current = nextPath;
    loadedPageKeysRef.current = new Set();
    setEntries([]);
    setTotalCount(0);
    setCanGoUp(false);
    setHubMode(false);
    setNextOffset(null);
    setLoadingError(null);
    setPreviewState({
      entry: null,
      preview: null,
      loading: false,
      error: null,
    });
    setScrollTop(0);
    if (listRef.current) {
      listRef.current.scrollTop = 0;
    }
  }

  async function loadPage(path: string, offset: number) {
    const pageKey = `${path}::${offset}`;
    if (loadedPageKeysRef.current.has(pageKey)) {
      return;
    }
    loadedPageKeysRef.current.add(pageKey);

    try {
      const response = await fetchMobileListing(path, offset, MOBILE_PAGE_SIZE);
      if (pendingPathRef.current !== path) {
        return;
      }

      startTransition(() => {
        setShareName(response.shareName);
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
      });
    } catch (error) {
      loadedPageKeysRef.current.delete(pageKey);
      if (pendingPathRef.current === path) {
        setLoadingError(
          error instanceof Error
            ? error.message
            : "Failed to load the mobile share.",
        );
      }
    }
  }

  async function refreshCurrentDirectory(nextPath: string = currentPath) {
    resetListingState(nextPath);
    await loadPage(nextPath, 0);
  }

  async function openPreviewForPath(
    relativePath: string,
    fallbackEntry: MobileShareEntry | null,
  ) {
    setPreviewState({
      entry: fallbackEntry,
      preview: null,
      loading: true,
      error: null,
    });

    try {
      const preview = await fetchMobilePreview(relativePath);
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

  function startDownload(entry: MobileShareEntry) {
    const downloadUrl =
      entry.downloadUrl ?? entry.fileUrl ?? buildMobileFileUrl(entry.relativePath);
    const transferId = createTransfer({
      direction: "download",
      displayName: entry.name,
      targetPath: entry.relativePath,
      sourceLabel: "Browser handoff",
      phase: "handoff",
      bytesTransferred: entry.size,
      bytesTotal: entry.size > 0 ? entry.size : null,
      progress: entry.size > 0 ? 1 : null,
      message: "Sent to the browser download manager.",
      fileUrl: downloadUrl,
    });

    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = entry.name;
    link.rel = "noreferrer";
    link.click();

    patchTransfer(transferId, {
      phase: "completed",
    });
    setActiveTab("transfers");
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

    setActiveTab("transfers");
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

  useEffect(() => {
    resetListingState(currentPath);
    void loadPage(currentPath, 0);
  }, [currentPath]);

  useEffect(() => {
    setExplorerPath(currentPath);
  }, [currentPath, setExplorerPath]);

  useEffect(() => {
    const updateViewportHeight = () => {
      setViewportHeight(listRef.current?.clientHeight ?? 0);
    };

    updateViewportHeight();
    window.addEventListener("resize", updateViewportHeight);
    return () => {
      window.removeEventListener("resize", updateViewportHeight);
    };
  }, []);

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
    if (nextOffset == null || listRef.current == null || deferredFilterInput) {
      return;
    }

    const shouldLoadNextPage =
      scrollTop + viewportHeight >=
      Math.max(0, totalCount * MOBILE_ROW_HEIGHT - MOBILE_ROW_HEIGHT * 6);

    if (shouldLoadNextPage) {
      void loadPage(currentPath, nextOffset);
    }
  }, [
    currentPath,
    deferredFilterInput,
    nextOffset,
    scrollTop,
    totalCount,
    viewportHeight,
  ]);

  useEffect(() => {
    if (!deferredFilterInput || nextOffset == null) {
      return;
    }
    void loadPage(currentPath, nextOffset);
  }, [currentPath, deferredFilterInput, nextOffset]);

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

    void fetchMobileSearchResults(searchQuery)
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
  }, [searchQuery]);

  const breadcrumbSegments = currentPath.split("/").filter(Boolean);

  function renderExplorerList() {
    if (loadingError) {
      return <div className="mobile-empty-state">{loadingError}</div>;
    }

    if (entries.length === 0 && nextOffset === null && totalCount === 0) {
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
      <div
        className="mobile-list__virtual-space"
        style={{ height: totalRows * MOBILE_ROW_HEIGHT }}
      >
        <div style={{ height: topSpacerHeight }} />
        {visibleRows.map((entry, visibleIndex) => {
          if (!entry) {
            return (
              <div
                key={`placeholder-${startIndex + visibleIndex}`}
                className="mobile-row mobile-row--placeholder"
                style={{ height: MOBILE_ROW_HEIGHT }}
              >
                <div className="mobile-entry-icon mobile-entry-icon--placeholder">
                  …
                </div>
                <div className="mobile-row__content">
                  <div className="mobile-row__name">Loading entry…</div>
                </div>
              </div>
            );
          }

          const rowMeta = getRowMetaLabel(entry);

          return (
            <div
              key={entry.relativePath}
              className="mobile-row"
              style={{ height: MOBILE_ROW_HEIGHT }}
            >
              <button
                type="button"
                className="mobile-row__main"
                onClick={() => {
                  if (entry.isDir) {
                    setCurrentPath(entry.relativePath);
                    return;
                  }
                  void openPreviewForPath(entry.relativePath, entry);
                }}
              >
                <MobileEntryIcon entry={entry} themeSnapshot={themeSnapshot} />
                <div className="mobile-row__content">
                  <div className="mobile-row__name">{entry.name}</div>
                  <div className="mobile-row__meta">{rowMeta}</div>
                </div>
              </button>
              <div className="mobile-row__actions">
                {entry.canPreview ? (
                  <button
                    type="button"
                    className="mobile-icon-button"
                    onClick={() => {
                      void openPreviewForPath(entry.relativePath, entry);
                    }}
                    aria-label={`Preview ${entry.name}`}
                  >
                    <LucideIcons.Eye size={18} strokeWidth={1.7} />
                  </button>
                ) : null}
                {entry.canDownload ? (
                  <button
                    type="button"
                    className="mobile-icon-button"
                    onClick={() => {
                      startDownload(entry);
                    }}
                    aria-label={`Download ${entry.name}`}
                  >
                    <LucideIcons.Download size={18} strokeWidth={1.7} />
                  </button>
                ) : (
                  <span className="mobile-row__chevron">
                    <LucideIcons.ChevronRight size={18} strokeWidth={1.7} />
                  </span>
                )}
              </div>
            </div>
          );
        })}
        <div style={{ height: bottomSpacerHeight }} />
      </div>
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
              setCurrentPath(entry.relativePath);
              setActiveTab("explorer");
              return;
            }
            setCurrentPath(entry.parentRelativePath);
            void openPreviewForPath(entry.relativePath, entry);
          }}
        >
          <MobileEntryIcon entry={entry} themeSnapshot={themeSnapshot} />
          <div className="mobile-search-result__content">
            <div className="mobile-search-result__name">{entry.name}</div>
            <div className="mobile-search-result__meta">
              {formatRelativePath(entry.parentRelativePath)} ·{" "}
              {getRowMetaLabel(entry)}
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
              <LucideIcons.Download size={18} strokeWidth={1.7} />
            </button>
          ) : null}
          <button
            type="button"
            className="mobile-icon-button"
            onClick={() => {
              setCurrentPath(entry.parentRelativePath);
              setActiveTab("explorer");
            }}
            aria-label={`Jump to ${entry.name}`}
          >
            <LucideIcons.CornerDownRight size={18} strokeWidth={1.7} />
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
                      setCurrentPath(entry.relativePath);
                      setPreviewState({
                        entry: null,
                        preview: null,
                        loading: false,
                        error: null,
                      });
                      return;
                    }
                    void openPreviewForPath(entry.relativePath, entry);
                  }}
                >
                  <MobileEntryIcon entry={entry} themeSnapshot={themeSnapshot} />
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
                Folder preview is capped to keep the phone surface fast.
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
                  <MobileEntryIcon entry={entry} themeSnapshot={themeSnapshot} />
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
    <div className="mobile-shell">
      <div className="mobile-shell__backdrop" />
      <header className="mobile-topbar">
        <div>
          <div className="mobile-topbar__eyebrow">Sovereign Mobile Link</div>
          <h1 className="mobile-topbar__title">{shareName}</h1>
          <div className="mobile-topbar__meta">
            <span
              className={`mobile-status-chip${
                isStandalone ? " mobile-status-chip--accent" : ""
              }`}
            >
              {isStandalone ? "Standalone" : "Browser"}
            </span>
            {themeSnapshot ? (
              <span className="mobile-status-chip">{themeSnapshot.themeName}</span>
            ) : null}
            <span className="mobile-status-chip">
              {hubMode ? "Hub Share" : "Directory Share"}
            </span>
          </div>
        </div>
        <button
          type="button"
          className="mobile-pill-button"
          onClick={() => {
            void refreshCurrentDirectory();
          }}
        >
          <LucideIcons.RefreshCcw size={18} strokeWidth={1.7} />
          Refresh
        </button>
      </header>

      {showInstallTip ? (
        <section className="mobile-hero">
          <div className="mobile-hero__title">Install the paired shell</div>
          <div className="mobile-hero__body">
            In Safari, tap Share, then choose Add to Home Screen so GreebleFS opens
            as its own app card with the full standalone shell.
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
          <section className="mobile-tab">
            <div className="mobile-toolbar">
              <button
                type="button"
                className="mobile-pill-button"
                disabled={!canGoUp}
                onClick={() => {
                  setCurrentPath(buildParentPath(currentPath));
                }}
              >
                <LucideIcons.ChevronUp size={18} strokeWidth={1.7} />
                Up
              </button>
              <button
                type="button"
                className="mobile-pill-button"
                onClick={() => {
                  generalUploadInputRef.current?.click();
                }}
              >
                <LucideIcons.Upload size={18} strokeWidth={1.7} />
                Files
              </button>
              <button
                type="button"
                className="mobile-pill-button"
                onClick={() => {
                  mediaUploadInputRef.current?.click();
                }}
              >
                <LucideIcons.Images size={18} strokeWidth={1.7} />
                Photos
              </button>
            </div>

            <div className="mobile-toolbar__path" title={formatRelativePath(currentPath)}>
              {formatRelativePath(currentPath)}
            </div>

            <nav className="mobile-breadcrumbs" aria-label="Current path">
              <button
                type="button"
                className={`mobile-breadcrumbs__segment${
                  currentPath.length === 0
                    ? " mobile-breadcrumbs__segment--current"
                    : ""
                }`}
                onClick={() => {
                  setCurrentPath("");
                }}
              >
                Shared
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
                      setCurrentPath(segmentPath);
                    }}
                  >
                    {segment}
                  </button>
                );
              })}
            </nav>

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

            <section
              className="mobile-list"
              ref={listRef}
              onScroll={(event) => {
                setScrollTop(event.currentTarget.scrollTop);
              }}
            >
              <div className="mobile-list__metrics">
                <div>
                  {deferredFilterInput
                    ? `${filteredEntries.length} visible of ${totalCount}`
                    : `${totalCount} entries`}
                </div>
                <div>{hubMode ? "Hub mode" : formatRelativePath(currentPath)}</div>
              </div>
              {renderExplorerList()}
            </section>
          </section>
        ) : null}

        {activeTab === "search" ? (
          <section className="mobile-tab">
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
                  <LucideIcons.ScanSearch size={18} strokeWidth={1.7} />
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
                  <LucideIcons.X size={18} strokeWidth={1.7} />
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
          <section className="mobile-tab">
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
                  />
                ))
              )}
            </section>
          </section>
        ) : null}

        {activeTab === "settings" ? (
          <section className="mobile-tab">
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

      <nav className="mobile-bottom-nav" aria-label="Mobile sections">
        {(
          [
            {
              id: "explorer",
              label: "Explorer",
              slotId: "folder_tree",
              fallback: LucideIcons.FolderTree,
            },
            {
              id: "search",
              label: "Search",
              slotId: "search",
              fallback: LucideIcons.Search,
            },
            {
              id: "transfers",
              label: "Transfers",
              slotId: "download",
              fallback: LucideIcons.ArrowDownToLine,
            },
            {
              id: "settings",
              label: "Settings",
              slotId: "settings",
              fallback: LucideIcons.Settings2,
            },
          ] satisfies Array<{
            id: MobileTabId;
            label: string;
            slotId: string;
            fallback: LucideIcon;
          }>
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`mobile-bottom-nav__item${
              activeTab === tab.id ? " mobile-bottom-nav__item--active" : ""
            }`}
            onClick={() => {
              setActiveTab(tab.id);
            }}
          >
            <span className="mobile-bottom-nav__icon">
              {renderThemedIcon({
                slotId: tab.slotId,
                themeSnapshot,
                fallback: tab.fallback,
                className: "mobile-bottom-nav__icon-svg",
              })}
            </span>
            <span>{tab.label}</span>
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
        <div className="mobile-overlay" role="dialog" aria-modal="true">
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
                setPreviewState({
                  entry: null,
                  preview: null,
                  loading: false,
                  error: null,
                });
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
                <LucideIcons.Download size={18} strokeWidth={1.7} />
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
                <LucideIcons.ExternalLink size={18} strokeWidth={1.7} />
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
      ) : null}
    </div>
  );
}
