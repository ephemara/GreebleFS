import {
  startTransition,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  buildMobileFileUrl,
  fetchMobileListing,
  fetchMobileThemeSnapshot,
  guessMediaKind,
  MOBILE_PAGE_SIZE,
} from "./mobileApi";
import type { MobileShareEntry, MobileShareThemeSnapshot } from "./types";

const MOBILE_ROW_HEIGHT = 72;
const MOBILE_OVERSCAN_ROWS = 8;

function formatBytes(bytes: number): string {
  if (bytes <= 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB", "TB"];
  const unitIndex = Math.min(
    units.length - 1,
    Math.floor(Math.log(bytes) / Math.log(1024)),
  );
  const value = bytes / 1024 ** unitIndex;
  return `${value.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function formatPathLabel(path: string): string {
  return path.length > 0 ? path : "Shared";
}

function buildParentPath(path: string): string {
  const segments = path.split("/").filter(Boolean);
  if (segments.length <= 1) {
    return "";
  }
  return segments.slice(0, -1).join("/");
}

function isStandaloneWebApp(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIosSafari(): boolean {
  const userAgent = window.navigator.userAgent;
  const isAppleMobile = /iPhone|iPad|iPod/i.test(userAgent);
  const isSafariEngine = /Safari/i.test(userAgent) && !/CriOS|FxiOS|EdgiOS/i.test(userAgent);
  return isAppleMobile && isSafariEngine;
}

function buildMobileThemeCssVars(snapshot: MobileShareThemeSnapshot): Record<string, string> {
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

  const themeColorMeta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (themeColorMeta) {
    themeColorMeta.content = snapshot.palette.appBackground;
  }
}

function entryGlyph(entry: MobileShareEntry): string {
  if (entry.isDir) {
    return "▣";
  }

  switch (guessMediaKind(entry)) {
    case "image":
      return "◫";
    case "video":
      return "▶";
    case "audio":
      return "♫";
    default:
      return "•";
  }
}

export default function App() {
  const [currentPath, setCurrentPath] = useState("");
  const [shareName, setShareName] = useState("GreebleFS");
  const [canGoUp, setCanGoUp] = useState(false);
  const [hubMode, setHubMode] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [entries, setEntries] = useState<Array<MobileShareEntry | null>>([]);
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const [overlayEntry, setOverlayEntry] = useState<MobileShareEntry | null>(null);
  const [filterInput, setFilterInput] = useState("");
  const [isStandalone, setIsStandalone] = useState(isStandaloneWebApp());
  const [installTipDismissed, setInstallTipDismissed] = useState(false);
  const [themeSnapshot, setThemeSnapshot] = useState<MobileShareThemeSnapshot | null>(null);
  const [viewportHeight, setViewportHeight] = useState(0);
  const [scrollTop, setScrollTop] = useState(0);
  const loadedPageKeysRef = useRef<Set<string>>(new Set());
  const pendingPathRef = useRef(currentPath);
  const listRef = useRef<HTMLDivElement | null>(null);

  const deferredFilterInput = useDeferredValue(filterInput.trim().toLowerCase());
  const showInstallTip = !installTipDismissed && isIosSafari() && !isStandalone;

  const resetListingState = (nextPath: string) => {
    pendingPathRef.current = nextPath;
    loadedPageKeysRef.current = new Set();
    setEntries([]);
    setTotalCount(0);
    setCanGoUp(false);
    setHubMode(false);
    setLoadingError(null);
    setOverlayEntry(null);
    setScrollTop(0);
    if (listRef.current) {
      listRef.current.scrollTop = 0;
    }
  };

  const loadPage = async (path: string, offset: number) => {
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
          error instanceof Error ? error.message : "Failed to load the mobile share.",
        );
      }
    }
  };

  useEffect(() => {
    resetListingState(currentPath);
    void loadPage(currentPath, 0);
  }, [currentPath]);

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

  const virtualWindow = useMemo(() => {
    const totalHeight = totalCount * MOBILE_ROW_HEIGHT;
    const visibleRowCount = Math.max(
      1,
      Math.ceil((viewportHeight || MOBILE_ROW_HEIGHT) / MOBILE_ROW_HEIGHT),
    );
    const startIndex = Math.max(
      0,
      Math.floor(scrollTop / MOBILE_ROW_HEIGHT) - MOBILE_OVERSCAN_ROWS,
    );
    const endIndex = Math.min(
      totalCount,
      startIndex + visibleRowCount + MOBILE_OVERSCAN_ROWS * 2,
    );

    return {
      startIndex,
      endIndex,
      totalHeight,
    };
  }, [scrollTop, totalCount, viewportHeight]);

  useEffect(() => {
    if (totalCount === 0) {
      return;
    }

    const startPageOffset =
      Math.floor(virtualWindow.startIndex / MOBILE_PAGE_SIZE) * MOBILE_PAGE_SIZE;
    const endPageOffset =
      Math.floor(Math.max(0, virtualWindow.endIndex - 1) / MOBILE_PAGE_SIZE) *
      MOBILE_PAGE_SIZE;

    for (
      let offset = startPageOffset;
      offset <= endPageOffset;
      offset += MOBILE_PAGE_SIZE
    ) {
      void loadPage(currentPath, offset);
    }
  }, [currentPath, totalCount, virtualWindow.endIndex, virtualWindow.startIndex]);

  const filteredLoadedEntries = useMemo(() => {
    if (deferredFilterInput.length === 0) {
      return null;
    }

    const matches: Array<{ entry: MobileShareEntry; absoluteIndex: number }> = [];
    entries.forEach((entry, index) => {
      if (!entry) {
        return;
      }
      const haystack = `${entry.name} ${entry.extension} ${entry.relativePath}`.toLowerCase();
      if (haystack.includes(deferredFilterInput)) {
        matches.push({ entry, absoluteIndex: index });
      }
    });
    return matches;
  }, [deferredFilterInput, entries]);

  const visibleRows = useMemo(() => {
    if (filteredLoadedEntries) {
      return filteredLoadedEntries.map(({ entry }, index) => ({
        key: `${entry.relativePath}:${index}`,
        entry,
        top: index * MOBILE_ROW_HEIGHT,
      }));
    }

    const rows = [];
    for (let index = virtualWindow.startIndex; index < virtualWindow.endIndex; index += 1) {
      rows.push({
        key: `row-${index}`,
        entry: entries[index] ?? null,
        top: index * MOBILE_ROW_HEIGHT,
      });
    }
    return rows;
  }, [entries, filteredLoadedEntries, virtualWindow.endIndex, virtualWindow.startIndex]);

  const contentHeight = filteredLoadedEntries
    ? filteredLoadedEntries.length * MOBILE_ROW_HEIGHT
    : virtualWindow.totalHeight;

  const breadcrumbSegments = useMemo(() => {
    const segments = currentPath.split("/").filter(Boolean);
    return segments.map((segment, index) => ({
      label: segment,
      path: segments.slice(0, index + 1).join("/"),
    }));
  }, [currentPath]);

  const overlayMediaKind = overlayEntry ? guessMediaKind(overlayEntry) : null;

  return (
    <div className="mobile-shell">
      <div className="mobile-shell__backdrop" />
      <header className="mobile-topbar">
        <div>
          <div className="mobile-topbar__eyebrow">Sovereign Mobile Link</div>
          <h1 className="mobile-topbar__title">{shareName}</h1>
          <div className="mobile-topbar__meta">
            <span className={`mobile-status-chip${isStandalone ? " mobile-status-chip--accent" : ""}`}>
              {isStandalone ? "Home Screen App" : "Safari Preview"}
            </span>
            {themeSnapshot ? (
              <span className="mobile-status-chip">{themeSnapshot.themeName}</span>
            ) : null}
          </div>
        </div>
        <button
          type="button"
          className="mobile-pill-button"
          onClick={() => window.location.reload()}
        >
          Refresh
        </button>
      </header>

      {showInstallTip ? (
        <section className="install-tip">
          <div className="install-tip__title">Install as an app</div>
          <div className="install-tip__body">
            In Safari, tap Share, then choose Add to Home Screen so GreebleFS opens in standalone app mode with its own task switcher card and persistent mobile shell.
          </div>
          <button
            type="button"
            className="install-tip__dismiss"
            onClick={() => setInstallTipDismissed(true)}
          >
            Dismiss
          </button>
        </section>
      ) : null}

      <section className="mobile-toolbar">
        <button
          type="button"
          className="mobile-pill-button"
          onClick={() => setCurrentPath("")}
        >
          Root
        </button>
        <button
          type="button"
          className="mobile-pill-button"
          disabled={!canGoUp}
          onClick={() => setCurrentPath(buildParentPath(currentPath))}
        >
          Up
        </button>
        <div className="mobile-toolbar__path" title={formatPathLabel(currentPath)}>
          {formatPathLabel(currentPath)}
        </div>
      </section>

      <nav className="mobile-breadcrumbs" aria-label="Current path">
        <button
          type="button"
          className={`mobile-breadcrumbs__segment${currentPath.length === 0 ? " mobile-breadcrumbs__segment--current" : ""}`}
          onClick={() => setCurrentPath("")}
        >
          {shareName}
        </button>
        {breadcrumbSegments.map((segment, index) => (
          <button
            key={segment.path}
            type="button"
            className={`mobile-breadcrumbs__segment${index === breadcrumbSegments.length - 1 ? " mobile-breadcrumbs__segment--current" : ""}`}
            onClick={() => setCurrentPath(segment.path)}
          >
            {segment.label}
          </button>
        ))}
      </nav>

      <div className="mobile-search">
        <input
          type="search"
          value={filterInput}
          onChange={(event) => setFilterInput(event.target.value)}
          placeholder={
            hubMode
              ? "Filter the current hub files"
              : "Filter currently loaded files and folders"
          }
          className="mobile-search__input"
        />
      </div>

      <main
        ref={listRef}
        className="mobile-list"
        onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
      >
        <div className="mobile-list__metrics">
          <span>{totalCount.toLocaleString()} items</span>
          <span>{hubMode ? "Hub mode" : "Directory mode"}</span>
        </div>

        {loadingError ? (
          <div className="mobile-empty-state">{loadingError}</div>
        ) : null}

        {!loadingError && contentHeight === 0 ? (
          <div className="mobile-empty-state">Loading mobile share…</div>
        ) : null}

        <div
          className="mobile-list__virtual-space"
          style={{ height: `${contentHeight}px` }}
        >
          {visibleRows.map((row) => {
            const entry = row.entry;
            if (!entry) {
              return (
                <div
                  key={row.key}
                  className="mobile-row mobile-row--placeholder"
                  style={{ transform: `translateY(${row.top}px)` }}
                >
                  <div className="mobile-row__glyph">…</div>
                  <div className="mobile-row__content">
                    <div className="mobile-row__name">Loading entry…</div>
                  </div>
                </div>
              );
            }

            const mediaKind = guessMediaKind(entry);
            const metaLabel = entry.isDir
              ? "Folder"
              : mediaKind
                ? `${mediaKind} • ${formatBytes(entry.size)}`
                : formatBytes(entry.size);

            return (
              <button
                key={row.key}
                type="button"
                className="mobile-row"
                style={{ transform: `translateY(${row.top}px)` }}
                onClick={() => {
                  if (entry.isDir) {
                    setCurrentPath(entry.relativePath);
                    return;
                  }

                  if (mediaKind) {
                    setOverlayEntry(entry);
                    return;
                  }

                  window.open(buildMobileFileUrl(entry.relativePath), "_blank", "noopener");
                }}
              >
                <div className="mobile-row__glyph">{entryGlyph(entry)}</div>
                <div className="mobile-row__content">
                  <div className="mobile-row__name">{entry.name}</div>
                  <div className="mobile-row__meta">{metaLabel}</div>
                </div>
                <div className="mobile-row__chevron">
                  {entry.isDir ? "›" : mediaKind ? "View" : "Open"}
                </div>
              </button>
            );
          })}
        </div>
      </main>

      {overlayEntry && overlayMediaKind ? (
        <div className="mobile-overlay" role="dialog" aria-modal="true">
          <div className="mobile-overlay__header">
            <div className="mobile-overlay__title">{overlayEntry.name}</div>
            <button
              type="button"
              className="mobile-pill-button"
              onClick={() => setOverlayEntry(null)}
            >
              Close
            </button>
          </div>
          <div className="mobile-overlay__body">
            {overlayMediaKind === "image" ? (
              <img
                src={buildMobileFileUrl(overlayEntry.relativePath)}
                alt={overlayEntry.name}
                className="mobile-overlay__image"
              />
            ) : null}
            {overlayMediaKind === "video" ? (
              <video
                src={buildMobileFileUrl(overlayEntry.relativePath)}
                controls
                playsInline
                className="mobile-overlay__video"
              />
            ) : null}
            {overlayMediaKind === "audio" ? (
              <audio
                src={buildMobileFileUrl(overlayEntry.relativePath)}
                controls
                className="mobile-overlay__audio"
              />
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
