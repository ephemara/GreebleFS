import type { CSSProperties, ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import {
  ArrowLeft,
  ArrowUp,
  Check,
  Copy,
  ExternalLink,
  FolderPlus,
  IconThemeProvider,
  LoaderCircle,
  MoveRight,
  RefreshCw,
  X,
} from '@/components/AppIcons';
import { useShallow } from 'zustand/react/shallow';
import {
  ensureFontFamilyLoaded,
  resolveOverlayAppearance,
  setOverlayPluginFonts,
  type ResolvedOverlayAppearance,
} from '../config/appearance';
import { detectClientPlatform } from '../config/platform';
import {
  loadIconThemePackages,
  resolveLoadedIconThemePackage,
  type LoadedIconThemePackage,
} from '../config/iconThemePackages';
import {
  loadThemePackages,
  type LoadedOverlayThemePackage,
} from '../config/themePackages';
import {
  createExplorerDir,
  getExplorerDrives,
  getExplorerHomeDir,
  listExplorerLocation,
  listExplorerLocationUncached,
  openExplorerPath,
  transferExplorerItems,
  type ExplorerDriveInfo,
  type ExplorerLocationListing,
} from '../runtime/explorerBackend';
import {
  describeFileOperationsWindowRequest,
  listenToFileOperationsWindowRequests,
  openFileOperationsWindow,
  publishFileOperationsTransferCompleted,
  readFileOperationsWindowRequest,
  type FileOperationsWindowRequest,
} from '../runtime/fileOperationsWindow';
import { useFolderPluginRuntime } from '../runtime/useFolderPluginRuntime';
import {
  useExplorerTaskProgressFeed,
  useExplorerTaskSnapshots,
} from '../store/explorerTaskStore';
import { useSettingsStore } from '../store/settingsStore';
import { ExplorerTaskCenterContent } from '../components/explorer/ExplorerTaskCenterContent';
import { OverlayScrollArea } from '../components/OverlayScrollArea';

type FileOperationsView = 'tasks' | 'transfer';

function getPathLeaf(path: string): string {
  const trimmed = path.replace(/[/\\]+$/, '');
  const match = trimmed.match(/([^/\\]+)$/);
  return match?.[1] ?? path;
}

function joinDestinationPath(parentPath: string, childName: string): string {
  const normalizedParent = parentPath.replace(/[/\\]+$/, '');
  const normalizedChild = childName.trim().replace(/^[/\\]+/, '');
  if (!normalizedChild) {
    return normalizedParent;
  }

  const separator = normalizedParent.includes('\\') && !normalizedParent.startsWith('cloud://')
    ? '\\'
    : '/';
  return normalizedParent ? `${normalizedParent}${separator}${normalizedChild}` : normalizedChild;
}

function isTransferRequest(
  request: FileOperationsWindowRequest | null,
): request is Extract<FileOperationsWindowRequest, { view: 'transfer' }> {
  return Boolean(request && request.view === 'transfer');
}

function ActionButton({
  children,
  disabled = false,
  onClick,
  tone = 'default',
}: {
  children: ReactNode;
  disabled?: boolean;
  onClick: () => void;
  tone?: 'accent' | 'default';
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        borderRadius: 10,
        padding: '8px 12px',
        border: tone === 'accent'
          ? '1px solid color-mix(in srgb, var(--overlay-accent) 45%, transparent)'
          : '1px solid var(--overlay-border)',
        background: disabled
          ? 'rgba(255,255,255,0.04)'
          : tone === 'accent'
            ? 'color-mix(in srgb, var(--overlay-accent) 14%, rgba(255,255,255,0.02))'
            : 'rgba(255,255,255,0.04)',
        color: disabled
          ? 'var(--overlay-text-muted)'
          : tone === 'accent'
            ? 'var(--overlay-accent)'
            : 'var(--overlay-text-primary)',
        cursor: disabled ? 'default' : 'pointer',
        fontSize: 12,
        fontWeight: 700,
      }}
    >
      {children}
    </button>
  );
}

function SectionCard({
  children,
  title,
  subtitle,
  actions,
}: {
  actions?: ReactNode;
  children: ReactNode;
  subtitle?: string;
  title: string;
}) {
  return (
    <section
      style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        borderRadius: 18,
        border: '1px solid var(--overlay-border)',
        background: 'color-mix(in srgb, var(--overlay-panel-bg) 94%, rgba(255,255,255,0.03))',
        boxShadow: '0 24px 64px rgba(0,0,0,0.28)',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 12,
          padding: '16px 18px 14px',
          borderBottom: '1px solid var(--overlay-border)',
          background: 'linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))',
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              color: 'var(--overlay-text-primary)',
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
            }}
          >
            {title}
          </div>
          {subtitle ? (
            <div style={{ marginTop: 4, color: 'var(--overlay-text-secondary)', fontSize: 11 }}>
              {subtitle}
            </div>
          ) : null}
        </div>
        {actions}
      </div>
      <div style={{ padding: 16, minHeight: 0, flex: 1 }}>{children}</div>
    </section>
  );
}

export default function FileOperationsWindowApp() {
  useExplorerTaskProgressFeed();

  const runtimePlatform = useMemo(() => detectClientPlatform(), []);
  const [viewportWidth, setViewportWidth] = useState(() => (
    typeof window === 'undefined' ? 980 : window.innerWidth
  ));
  const [themePackages, setThemePackages] = useState<LoadedOverlayThemePackage[]>([]);
  const [iconThemePackages, setIconThemePackages] = useState<LoadedIconThemePackage[]>([]);
  const [themePackagesError, setThemePackagesError] = useState<string | null>(null);
  const [request, setRequest] = useState<FileOperationsWindowRequest | null>(() => readFileOperationsWindowRequest());
  const [activeView, setActiveView] = useState<FileOperationsView>(() => (
    readFileOperationsWindowRequest()?.view ?? 'tasks'
  ));
  const [homeDir, setHomeDir] = useState('');
  const [drives, setDrives] = useState<ExplorerDriveInfo[]>([]);
  const [currentPath, setCurrentPath] = useState('');
  const [pathInput, setPathInput] = useState('');
  const [listing, setListing] = useState<ExplorerLocationListing | null>(null);
  const [listingLoading, setListingLoading] = useState(false);
  const [listingError, setListingError] = useState<string | null>(null);
  const [forceListingReload, setForceListingReload] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const lastRequestNonceRef = useRef<string | null>(request?.nonce ?? null);
  const tasks = useExplorerTaskSnapshots();

  const {
    appearanceSettings,
    explorerSettings,
    systemSettings,
    terminalSettings,
  } = useSettingsStore(useShallow((state) => ({
    appearanceSettings: state.settings.appearance,
    explorerSettings: state.settings.explorer,
    systemSettings: state.settings.system,
    terminalSettings: state.settings.terminal,
  })));

  const {
    pluginFonts,
    pluginThemePackages,
  } = useFolderPluginRuntime(runtimePlatform, {
    liveReloadEnabled: systemSettings.developerMode,
  });

  useEffect(() => {
    const handleResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    let cancelled = false;

    loadThemePackages()
      .then((result) => {
        if (cancelled) {
          return;
        }
        setThemePackages(result.packages);
        setThemePackagesError(result.sourceError);
      })
      .catch((error) => {
        if (!cancelled) {
          setThemePackages([]);
          setThemePackagesError(String(error));
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    loadIconThemePackages()
      .then((result) => {
        if (cancelled) {
          return;
        }
        setIconThemePackages(result.packages);
      })
      .catch(() => {
        if (!cancelled) {
          setIconThemePackages([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      getExplorerHomeDir().catch(() => ''),
      getExplorerDrives().catch((): ExplorerDriveInfo[] => []),
    ]).then(([resolvedHomeDir, resolvedDrives]) => {
      if (cancelled) {
        return;
      }
      setHomeDir(resolvedHomeDir);
      setDrives(resolvedDrives);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!currentPath && homeDir) {
      setCurrentPath(homeDir);
    }
  }, [currentPath, homeDir]);

  const combinedThemePackages = useMemo(
    () => [...themePackages, ...pluginThemePackages],
    [pluginThemePackages, themePackages],
  );
  const selectedIconTheme = useMemo(
    () => appearanceSettings.activeIconThemeId
      ? (resolveLoadedIconThemePackage(iconThemePackages, appearanceSettings.activeIconThemeId)?.iconTheme ?? null)
      : null,
    [appearanceSettings.activeIconThemeId, iconThemePackages],
  );
  const resolvedAppearance = useMemo<ResolvedOverlayAppearance>(() => resolveOverlayAppearance({
    activeThemeId: appearanceSettings.activeThemeId,
    activeDockThemeId: appearanceSettings.activeDockThemeId,
    dockThemeMode: appearanceSettings.dockThemeMode,
    customThemes: appearanceSettings.customThemes,
    packageThemes: combinedThemePackages.map((pkg) => pkg.theme),
    selectedIconTheme,
    uiFontFamily: appearanceSettings.uiFontFamily,
    monoFontFamily: terminalSettings.fontFamily,
    panelTransparency: appearanceSettings.panelTransparency,
    windowMode: 'windowed',
  }), [
    appearanceSettings.activeDockThemeId,
    appearanceSettings.activeIconThemeId,
    appearanceSettings.activeThemeId,
    appearanceSettings.customThemes,
    appearanceSettings.dockThemeMode,
    appearanceSettings.panelTransparency,
    appearanceSettings.uiFontFamily,
    combinedThemePackages,
    selectedIconTheme,
    terminalSettings.fontFamily,
  ]);

  useEffect(() => {
    setOverlayPluginFonts(pluginFonts);
  }, [pluginFonts]);

  useEffect(() => {
    ensureFontFamilyLoaded(resolvedAppearance.fonts.ui);
    ensureFontFamilyLoaded(resolvedAppearance.fonts.mono);
  }, [resolvedAppearance.fonts.mono, resolvedAppearance.fonts.ui]);

  const applyRequest = useCallback((nextRequest: FileOperationsWindowRequest) => {
    if (lastRequestNonceRef.current === nextRequest.nonce) {
      return;
    }

    lastRequestNonceRef.current = nextRequest.nonce;
    setRequest(nextRequest);
    setActiveView(nextRequest.view);
    setSubmitError(null);

    if (nextRequest.view === 'transfer' && nextRequest.suggestedTargetDir) {
      setCurrentPath(nextRequest.suggestedTargetDir);
    }
  }, []);

  useEffect(() => {
    const latestRequest = readFileOperationsWindowRequest();
    if (latestRequest) {
      applyRequest(latestRequest);
    }

    return listenToFileOperationsWindowRequests(applyRequest);
  }, [applyRequest]);

  useEffect(() => {
    if (!currentPath) {
      return;
    }

    let cancelled = false;
    setListingLoading(true);
    setListingError(null);

    const loader = forceListingReload ? listExplorerLocationUncached : listExplorerLocation;
    loader(currentPath, explorerSettings.showHiddenFiles)
      .then((nextListing) => {
        if (cancelled) {
          return;
        }
        setListing(nextListing);
        setPathInput(nextListing.path);
      })
      .catch((error) => {
        if (!cancelled) {
          setListingError(String(error));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setListingLoading(false);
          setForceListingReload(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [currentPath, explorerSettings.showHiddenFiles, forceListingReload]);

  useEffect(() => {
    const title = activeView === 'transfer'
      ? describeFileOperationsWindowRequest(request)
      : 'File Operations';
    void getCurrentWindow().setTitle(title).catch(() => undefined);
  }, [activeView, request]);

  const transferRequest = activeView === 'transfer' && isTransferRequest(request) ? request : null;
  const sourceItems = transferRequest?.sourcePaths ?? [];
  const sourceItemSummary = useMemo(() => {
    if (sourceItems.length === 0) {
      return 'No source items';
    }

    const firstName = getPathLeaf(sourceItems[0] ?? '');
    return sourceItems.length === 1
      ? firstName
      : `${firstName} +${sourceItems.length - 1} more`;
  }, [sourceItems]);

  const directoryEntries = useMemo(
    () => (listing?.entries ?? []).filter((entry) => entry.is_dir),
    [listing?.entries],
  );

  const quickAccessItems = useMemo(() => {
    const items: Array<{ id: string; label: string; path: string }> = [];
    if (homeDir) {
      items.push({ id: 'home', label: 'Home', path: homeDir });
    }

    for (const drive of drives) {
      const label = drive.label || drive.path;
      items.push({ id: drive.id, label, path: drive.path });
    }

    return items;
  }, [drives, homeDir]);

  const refreshListing = useCallback(() => {
    setForceListingReload(true);
  }, []);

  const navigateToPath = useCallback((nextPath: string) => {
    const trimmedPath = nextPath.trim();
    if (!trimmedPath) {
      return;
    }
    setCurrentPath(trimmedPath);
  }, []);

  const navigateUp = useCallback(() => {
    if (listing?.parentPath) {
      setCurrentPath(listing.parentPath);
    }
  }, [listing?.parentPath]);

  const createFolder = useCallback(async () => {
    const trimmedName = newFolderName.trim();
    if (!trimmedName || !currentPath) {
      return;
    }

    setCreatingFolder(true);
    setSubmitError(null);
    try {
      await createExplorerDir(joinDestinationPath(currentPath, trimmedName));
      setNewFolderName('');
      refreshListing();
    } catch (error) {
      setSubmitError(String(error));
    } finally {
      setCreatingFolder(false);
    }
  }, [currentPath, newFolderName, refreshListing]);

  const submitTransfer = useCallback(async () => {
    if (!transferRequest || !currentPath || submitting) {
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    try {
      const results = await transferExplorerItems(
        currentPath,
        transferRequest.sourcePaths,
        transferRequest.operation,
      );
      await publishFileOperationsTransferCompleted({
        operation: transferRequest.operation,
        results,
        sourcePaths: transferRequest.sourcePaths,
        targetDir: currentPath,
      });
      setActiveView('tasks');
      refreshListing();
    } catch (error) {
      setSubmitError(String(error));
    } finally {
      setSubmitting(false);
    }
  }, [currentPath, refreshListing, submitting, transferRequest]);

  const closeWindow = useCallback(() => {
    void getCurrentWindow().close().catch(() => undefined);
  }, []);

  const palette = resolvedAppearance.theme.palette;
  const splitLayout = activeView === 'transfer' && transferRequest && viewportWidth > 920;

  return (
    <IconThemeProvider iconTheme={resolvedAppearance.theme.assets?.iconTheme}>
      <div
        className="overlay-window-host w-full h-full overflow-hidden"
        style={{
          ...(resolvedAppearance.cssVars as CSSProperties),
          minHeight: '100vh',
          background: `radial-gradient(circle at top right, ${palette.accentSoft}22, transparent 34%), linear-gradient(180deg, ${palette.appBackgroundAlt}, ${palette.appBackground})`,
          color: palette.textPrimary,
          fontFamily: resolvedAppearance.fonts.ui,
        }}
      >
        <div
          style={{
            minHeight: '100vh',
            display: 'grid',
            gridTemplateRows: 'auto minmax(0, 1fr)',
          }}
        >
        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
            padding: '18px 20px',
            borderBottom: '1px solid var(--overlay-border)',
            background: 'linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.03))',
            backdropFilter: 'blur(18px)',
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                color: palette.textPrimary,
                fontSize: 13,
                fontWeight: 900,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
              }}
            >
              {activeView === 'transfer' && transferRequest
                ? `${transferRequest.operation === 'move' ? 'Move' : 'Copy'} To…`
                : 'File Operations'}
            </div>
            <div style={{ marginTop: 4, color: palette.textSecondary, fontSize: 12 }}>
              {activeView === 'transfer' && transferRequest
                ? `${transferRequest.sourcePaths.length} item${transferRequest.sourcePaths.length === 1 ? '' : 's'} queued · ${sourceItemSummary}`
                : 'Live explorer transfers, trash actions, duplicate scans, and batch operations.'}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <ActionButton
              onClick={() => setActiveView('tasks')}
              tone={activeView === 'tasks' ? 'accent' : 'default'}
            >
              <ExternalLink size={13} />
              Tasks
            </ActionButton>
            {isTransferRequest(request) ? (
              <ActionButton
                onClick={() => setActiveView('transfer')}
                tone={activeView === 'transfer' ? 'accent' : 'default'}
              >
                {request.operation === 'move' ? <MoveRight size={14} /> : <Copy size={14} />}
                Destination
              </ActionButton>
            ) : null}
            <ActionButton onClick={closeWindow}>
              <X size={13} />
              Close
            </ActionButton>
          </div>
        </header>

        <main
          style={{
            minHeight: 0,
            padding: 18,
            display: 'grid',
            gridTemplateColumns: splitLayout ? 'minmax(0, 1.12fr) minmax(320px, 0.88fr)' : 'minmax(0, 1fr)',
            gap: 16,
          }}
        >
          {activeView === 'transfer' && transferRequest ? (
            <SectionCard
              title={transferRequest.operation === 'move' ? 'Destination Picker' : 'Copy Destination'}
              subtitle={currentPath ? `Current folder: ${currentPath}` : 'Choose a destination folder'}
              actions={(
                <div style={{ display: 'flex', gap: 8 }}>
                  <ActionButton onClick={navigateUp} disabled={!listing?.parentPath}>
                    <ArrowUp size={13} />
                    Up
                  </ActionButton>
                  <ActionButton onClick={refreshListing}>
                    <RefreshCw size={13} />
                    Refresh
                  </ActionButton>
                </div>
              )}
            >
              <div style={{ display: 'grid', gap: 14, minHeight: 0, height: '100%' }}>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: viewportWidth > 760 ? '220px minmax(0, 1fr)' : 'minmax(0, 1fr)',
                    gap: 14,
                    minHeight: 0,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                      borderRadius: 14,
                      border: '1px solid var(--overlay-border)',
                      background: 'rgba(255,255,255,0.03)',
                      padding: 10,
                    }}
                  >
                    <div style={{ color: palette.textMuted, fontSize: 10, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                      Quick Access
                    </div>
                    {quickAccessItems.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => navigateToPath(item.path)}
                        style={{
                          border: '1px solid transparent',
                          background: currentPath === item.path ? 'color-mix(in srgb, var(--overlay-accent) 16%, transparent)' : 'transparent',
                          color: currentPath === item.path ? 'var(--overlay-accent)' : palette.textPrimary,
                          borderRadius: 10,
                          padding: '8px 10px',
                          textAlign: 'left',
                          cursor: 'pointer',
                          fontSize: 12,
                          fontWeight: 600,
                        }}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateRows: 'auto auto minmax(0, 1fr)',
                      gap: 12,
                      minHeight: 0,
                    }}
                  >
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {listing?.breadcrumbs.map((crumb, index) => (
                        <button
                          key={`${crumb.path}-${index}`}
                          type="button"
                          onClick={() => navigateToPath(crumb.path)}
                          style={{
                            border: '1px solid var(--overlay-border)',
                            background: crumb.path === currentPath
                              ? 'color-mix(in srgb, var(--overlay-accent) 14%, rgba(255,255,255,0.02))'
                              : 'rgba(255,255,255,0.03)',
                            color: crumb.path === currentPath ? 'var(--overlay-accent)' : palette.textPrimary,
                            borderRadius: 999,
                            padding: '6px 10px',
                            cursor: 'pointer',
                            fontSize: 11,
                            fontWeight: 700,
                          }}
                        >
                          {crumb.label}
                        </button>
                      ))}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 8 }}>
                      <form
                        onSubmit={(event) => {
                          event.preventDefault();
                          navigateToPath(pathInput);
                        }}
                        style={{ display: 'contents' }}
                      >
                        <input
                          value={pathInput}
                          onChange={(event) => setPathInput(event.target.value)}
                          placeholder="Enter a destination path"
                          style={{
                            width: '100%',
                            borderRadius: 12,
                            border: '1px solid var(--overlay-border)',
                            background: 'rgba(0,0,0,0.18)',
                            color: palette.textPrimary,
                            padding: '10px 12px',
                            fontSize: 12,
                          }}
                        />
                        <ActionButton onClick={() => navigateToPath(pathInput)}>
                          <ArrowLeft size={13} style={{ transform: 'rotate(180deg)' }} />
                          Go
                        </ActionButton>
                      </form>
                    </div>

                    <div
                      style={{
                        display: 'grid',
                        gridTemplateRows: 'auto auto minmax(0, 1fr)',
                        gap: 10,
                        minHeight: 0,
                      }}
                    >
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <input
                          value={newFolderName}
                          onChange={(event) => setNewFolderName(event.target.value)}
                          placeholder="New folder name"
                          style={{
                            flex: '1 1 220px',
                            minWidth: 0,
                            borderRadius: 10,
                            border: '1px solid var(--overlay-border)',
                            background: 'rgba(255,255,255,0.03)',
                            color: palette.textPrimary,
                            padding: '9px 11px',
                            fontSize: 12,
                          }}
                        />
                        <ActionButton onClick={() => { void createFolder(); }} disabled={creatingFolder || !newFolderName.trim()}>
                          {creatingFolder ? <LoaderCircle size={13} className="animate-spin" /> : <FolderPlus size={13} />}
                          New Folder
                        </ActionButton>
                      </div>

                      {listingError ? (
                        <div style={{ color: palette.danger, fontSize: 12 }}>{listingError}</div>
                      ) : null}

                      <OverlayScrollArea
                        style={{
                          minHeight: 0,
                          borderRadius: 14,
                          border: '1px solid var(--overlay-border)',
                          background: 'rgba(0,0,0,0.14)',
                        }}
                        scrollbarStyle="themed"
                      >
                        {listingLoading ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 14, color: palette.textSecondary, fontSize: 12 }}>
                            <LoaderCircle size={14} className="animate-spin" />
                            Loading destination folders…
                          </div>
                        ) : directoryEntries.length === 0 ? (
                          <div style={{ padding: 14, color: palette.textSecondary, fontSize: 12 }}>
                            No child folders in this location.
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            {directoryEntries.map((entry) => (
                              <button
                                key={entry.path}
                                type="button"
                                onClick={() => navigateToPath(entry.path)}
                                style={{
                                  display: 'grid',
                                  gridTemplateColumns: 'minmax(0, 1fr) auto',
                                  gap: 10,
                                  alignItems: 'center',
                                  padding: '11px 14px',
                                  border: 'none',
                                  borderBottom: '1px solid rgba(255,255,255,0.05)',
                                  background: 'transparent',
                                  color: palette.textPrimary,
                                  cursor: 'pointer',
                                  textAlign: 'left',
                                }}
                              >
                                <div style={{ minWidth: 0 }}>
                                  <div style={{ fontSize: 12, fontWeight: 700 }}>{entry.name}</div>
                                  <div
                                    style={{
                                      marginTop: 3,
                                      color: palette.textMuted,
                                      fontSize: 10,
                                      whiteSpace: 'nowrap',
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                    }}
                                  >
                                    {entry.path}
                                  </div>
                                </div>
                                <span style={{ color: palette.textMuted, fontSize: 11, fontWeight: 700 }}>
                                  Open
                                </span>
                              </button>
                            ))}
                          </div>
                        )}
                      </OverlayScrollArea>
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                    padding: 14,
                    borderRadius: 14,
                    border: '1px solid var(--overlay-border)',
                    background: 'linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02))',
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ color: palette.textPrimary, fontSize: 12, fontWeight: 700 }}>
                      {transferRequest.operation === 'move' ? 'Move destination' : 'Copy destination'}
                    </div>
                    <div
                      style={{
                        marginTop: 3,
                        color: palette.textSecondary,
                        fontSize: 11,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {currentPath || 'Choose a folder'}
                    </div>
                    <div style={{ marginTop: 6, color: palette.textMuted, fontSize: 10 }}>
                      Source: {sourceItemSummary}
                    </div>
                    {submitError ? (
                      <div style={{ marginTop: 6, color: palette.danger, fontSize: 11 }}>
                        {submitError}
                      </div>
                    ) : null}
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <ActionButton onClick={() => setActiveView('tasks')}>
                      <ExternalLink size={13} />
                      Task Center
                    </ActionButton>
                    <ActionButton
                      onClick={() => { void submitTransfer(); }}
                      disabled={!currentPath || submitting}
                      tone="accent"
                    >
                      {submitting ? <LoaderCircle size={13} className="animate-spin" /> : <Check size={13} />}
                      {transferRequest.operation === 'move' ? 'Move Here' : 'Copy Here'}
                    </ActionButton>
                  </div>
                </div>
              </div>
            </SectionCard>
          ) : null}

          <SectionCard
            title="Task Center"
            subtitle={themePackagesError
              ? `Theme package load warning: ${themePackagesError}`
              : 'Live progress from explorer transfers and other durable file operations.'}
            actions={transferRequest && activeView === 'tasks' ? (
              <ActionButton onClick={() => setActiveView('transfer')}>
                {transferRequest.operation === 'move' ? <MoveRight size={13} /> : <Copy size={13} />}
                Back To Destination
              </ActionButton>
            ) : undefined}
          >
            <OverlayScrollArea
              style={{ minHeight: 0, height: '100%' }}
              viewportStyle={{ paddingRight: 2 }}
              scrollbarStyle="themed"
            >
              <ExplorerTaskCenterContent
                accent={palette.accent}
                border={palette.border}
                danger={palette.danger}
                muted={palette.textSecondary}
                tasks={tasks}
                text={palette.textPrimary}
                headerActions={(
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <ActionButton onClick={() => { void openExplorerPath(currentPath || homeDir).catch(() => undefined); }} disabled={!currentPath && !homeDir}>
                      <ExternalLink size={13} />
                      Open Folder
                    </ActionButton>
                    <ActionButton onClick={() => void openFileOperationsWindow({ view: 'tasks' })}>
                      <RefreshCw size={13} />
                      Focus Window
                    </ActionButton>
                  </div>
                )}
              />
            </OverlayScrollArea>
          </SectionCard>
        </main>
      </div>
      </div>
    </IconThemeProvider>
  );
}
