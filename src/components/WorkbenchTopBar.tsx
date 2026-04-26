import { isTauri } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
  type ReactNode,
} from 'react';

import {
  Check,
  LayoutGrid,
  Loader2,
  Search,
  Settings2,
  Smartphone,
  Terminal as TerminalIcon,
  X,
} from '@/components/AppIcons';
import type { OverlayPanelDefinition } from '../panels/panelRegistry';
import type { ResolvedOverlayAppearance } from '../config/appearance';
import { resolveConditionalBlurFilter } from '../config/chromeEffects';
import type { LayoutProfile } from '../config/layoutProfiles';
import type { RuntimePlatform } from '../config/platform';
import type {
  LoadedOverlayTopBarDefinition,
  OverlayTopBarControlId,
} from '../config/topBars';
import { mobileShareMenuHoverDelayMs, type MobileRemoteAccessMode } from '../config/mobileAccess';
import type { ResolvedWorkbenchRenderRuntime } from '../config/workbenchRenderRuntime';
import type {
  OverlayWindowAnchor,
  TerminalWindowMode,
} from '../store/settingsStore';
import type { MobileSharePhase } from '../store/mobileShareStore';
import type { OverlayThemeRendererSurfaceOwnership } from './themeRendererShellModel';
import {
  useInteractionMotionController,
  type InteractionMotionBinding,
} from '../animation/interactionMotion';
import { useLayoutDynamicsController } from '../animation/layoutDynamics';
import { MobileShareQrDialog } from './MobileShareQrDialog';
import { MobileShareRouteMenu } from './MobileShareRouteMenu';
import { OverlayScrollArea } from './OverlayScrollArea';
import { WindowControls } from './WindowControls';
import type { MobileShareSession } from '../runtime/mobileShareRuntime';
import { playSoundEffect } from '../runtime/soundEffects';
import type { LayoutDynamicsAuthoringSnapshot } from '../config/layoutDynamics';
import {
  flattenTopBarDefinitionControls,
  getTopBarControlCatalog,
  getTopBarControlLabel,
} from '../config/topBars';
import { LayoutDynamicsCanvas } from './layoutDynamics/LayoutDynamicsCanvas';

interface WorkbenchTopBarProps {
  appearance: ResolvedOverlayAppearance;
  renderRuntime: ResolvedWorkbenchRenderRuntime;
  layoutProfile: LayoutProfile;
  layoutSourcePath: string | null;
  panels: OverlayPanelDefinition[];
  openPanelIds: string[];
  pinnedPanelIds: string[];
  activePanelId: string | null;
  onPanelSelect: (panelId: string | null) => void;
  onPanelToggle: (panelId: string) => void;
  onPanelClose: (panelId: string) => void;
  onPanelReorder: (draggedId: string, targetId: string) => void;
  onOpenSettings: () => void;
  onCycleLayout: () => void;
  onSetWindowMode: (mode: TerminalWindowMode) => void;
  onOpenCommandPalette: () => void;
  onToggleOverlayAnchor: () => void;
  onClose: () => void;
  accent: string;
  blur: boolean;
  blurStrength: number;
  blurPlatform: RuntimePlatform;
  windowMode: TerminalWindowMode;
  overlayAnchor: OverlayWindowAnchor;
  surfaceOwnership?: OverlayThemeRendererSurfaceOwnership | null;
  commandPaletteShortcutLabel: string;
  mobileShareShortcutLabel: string;
  toggleShortcutLabel: string;
  mobileShareRemoteAccessMode: MobileRemoteAccessMode;
  mobileSharePhase: MobileSharePhase;
  mobileShareSession: MobileShareSession | null;
  mobileShareError: string | null;
  mobileShareNotice: string | null;
  onToggleMobileShare: () => void;
  onStartMobileShare: () => void | Promise<void>;
  onStopMobileShare: () => void | Promise<void>;
  onSetMobileShareRemoteAccessMode: (mode: MobileRemoteAccessMode) => void | Promise<void>;
  onOpenMobileSettings: () => void;
  zenFocusMode: boolean;
  zenFocusShortcutLabel: string;
  onToggleZenFocusMode: () => void;
  topBarShaderLayer?: ReactNode;
  topBarDefinition: LoadedOverlayTopBarDefinition;
  topBarCustomizeActive: boolean;
  onToggleTopBarCustomize: () => void;
  topBarLayoutSnapshot?: LayoutDynamicsAuthoringSnapshot | null;
  onCommitTopBarLayoutSnapshot: (
    snapshot: LayoutDynamicsAuthoringSnapshot,
  ) => void;
}

function renderControlZone(
  children: ReactNode[],
  side: 'leading' | 'trailing',
): ReactNode {
  if (children.length === 0) {
    return null;
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '0 8px',
        background: 'var(--overlay-workbench-chrome-button-bg)',
        borderRight: side === 'leading' ? '1px solid var(--overlay-workbench-chrome-border)' : 'none',
        borderLeft: side === 'trailing' ? '1px solid var(--overlay-workbench-chrome-border)' : 'none',
        flexShrink: 0,
      }}
    >
      {children}
    </div>
  );
}

interface CompactChromeButtonProps {
  active?: boolean;
  title: string;
  motionBinding: InteractionMotionBinding;
  text: string;
  muted: string;
  accent: string;
  controlRadius: number;
  ariaLabel?: string;
  style?: CSSProperties;
  dataAttributes?: Record<string, string | undefined>;
  onClick?: (event: MouseEvent<HTMLButtonElement>) => void;
  onContextMenu?: (event: MouseEvent<HTMLButtonElement>) => void;
  children: ReactNode;
}

function CompactChromeButton({
  active = false,
  title,
  motionBinding,
  text,
  muted,
  accent,
  controlRadius,
  ariaLabel,
  style,
  dataAttributes,
  onClick,
  onContextMenu,
  children,
}: CompactChromeButtonProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isPressed, setIsPressed] = useState(false);
  const interactionState = isPressed
    ? 'pressed'
    : isHovered
      ? 'hovered'
      : active
        ? 'active'
        : 'idle';

  const background = active
    ? interactionState === 'pressed'
      ? 'var(--overlay-workbench-chrome-button-active-bg)'
      : 'var(--overlay-workbench-chrome-button-active-bg)'
    : interactionState === 'pressed'
      ? 'rgba(255,255,255,0.12)'
      : interactionState === 'hovered'
        ? 'rgba(255,255,255,0.08)'
        : 'var(--overlay-workbench-chrome-button-bg)';
  const borderColor = active
    ? 'var(--overlay-workbench-chrome-button-active-border)'
    : interactionState === 'idle'
      ? 'var(--overlay-workbench-chrome-border)'
      : `${accent}${interactionState === 'pressed' ? '88' : '66'}`;
  const boxShadow = active
    ? interactionState === 'hovered' || interactionState === 'pressed'
      ? `0 0 0 1px ${accent}2a inset, 0 0 0 4px ${accent}14`
      : `0 0 0 1px ${accent}22 inset`
    : interactionState === 'hovered'
      ? `0 0 0 1px ${accent}18 inset`
      : interactionState === 'pressed'
        ? `0 0 0 1px ${accent}22 inset`
        : 'none';

  return (
    <button
      aria-label={ariaLabel}
      {...dataAttributes}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) {
          void playSoundEffect('shell-button-press');
        }
      }}
      onContextMenu={onContextMenu}
      title={title}
      {...motionBinding.motionDataAttributes}
      onPointerEnter={(event) => {
        setIsHovered(true);
        motionBinding.onPointerEnter(event);
      }}
      onPointerLeave={(event) => {
        setIsHovered(false);
        setIsPressed(false);
        motionBinding.onPointerLeave(event);
      }}
      onPointerDown={(event) => {
        setIsHovered(true);
        setIsPressed(true);
        motionBinding.onPointerDown(event);
      }}
      onPointerUp={(event) => {
        setIsPressed(false);
        setIsHovered(true);
        motionBinding.onPointerUp(event);
      }}
      onPointerCancel={(event) => {
        setIsHovered(false);
        setIsPressed(false);
        motionBinding.onPointerCancel(event);
      }}
      onBlur={() => {
        setIsHovered(false);
        setIsPressed(false);
      }}
      style={{
        height: 22,
        minWidth: 22,
        padding: 0,
        background,
        border: `1px solid ${borderColor}`,
        color: active || interactionState !== 'idle' ? text : muted,
        borderRadius: controlRadius,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        boxShadow,
        ...style,
        ...motionBinding.motionStyle,
      }}
    >
      {children}
    </button>
  );
}

export function WorkbenchTopBar({
  appearance,
  renderRuntime,
  layoutProfile,
  layoutSourcePath,
  panels,
  openPanelIds,
  pinnedPanelIds,
  activePanelId,
  onPanelSelect,
  onPanelToggle,
  onPanelClose,
  onPanelReorder,
  onOpenSettings,
  onCycleLayout,
  onSetWindowMode,
  onOpenCommandPalette,
  onToggleOverlayAnchor,
  onClose,
  accent,
  blur,
  blurStrength,
  blurPlatform,
  windowMode,
  overlayAnchor,
  surfaceOwnership,
  commandPaletteShortcutLabel,
  mobileShareShortcutLabel,
  toggleShortcutLabel,
  mobileShareRemoteAccessMode,
  mobileSharePhase,
  mobileShareSession,
  mobileShareError,
  mobileShareNotice,
  onToggleMobileShare,
  onStartMobileShare,
  onStopMobileShare,
  onSetMobileShareRemoteAccessMode,
  onOpenMobileSettings,
  zenFocusMode,
  zenFocusShortcutLabel,
  onToggleZenFocusMode,
  topBarShaderLayer,
  topBarDefinition,
  topBarCustomizeActive,
  onToggleTopBarCustomize,
  topBarLayoutSnapshot,
  onCommitTopBarLayoutSnapshot,
}: WorkbenchTopBarProps) {
  const borderColor = appearance.theme.palette.border;
  const muted = appearance.theme.palette.textMuted;
  const text = appearance.theme.palette.textPrimary;
  const workbench = appearance.workbenchTheme;
  const effectiveTopBarStyle = topBarDefinition.topBarStyle ?? workbench.topBarStyle;
  const effectiveTabStyle = topBarDefinition.tabStyle ?? workbench.tabStyle;
  const uiFont = appearance.fonts.ui;
  const monoFont = appearance.fonts.mono;
  const chromeHeight = workbench.metrics.chromeHeight;
  const usesFloatingTopBar = effectiveTopBarStyle === 'floating' || effectiveTopBarStyle === 'glass';
  const usesInsetTopBar = usesFloatingTopBar || effectiveTopBarStyle === 'minimal';
  const menuRef = useRef<HTMLDivElement | null>(null);
  const mobileMenuRef = useRef<HTMLDivElement | null>(null);
  const mobileMenuOpenTimerRef = useRef<number | null>(null);
  const mobileMenuCloseTimerRef = useRef<number | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobileQrDialogOpen, setIsMobileQrDialogOpen] = useState(false);
  const [isWindowMaximized, setIsWindowMaximized] = useState(false);
  const [draggedPanelId, setDraggedPanelId] = useState<string | null>(null);
  const [viewportSize, setViewportSize] = useState(() => ({
    width: window.innerWidth,
    height: window.innerHeight,
  }));
  const activePanelDefinition = activePanelId ? panels.find(panel => panel.id === activePanelId) ?? null : null;
  const isExplorerActive = activePanelId === 'explorer';
  const isSettingsActive = activePanelId === 'settings';
  const rendererOwnsLauncher = Boolean(surfaceOwnership?.launcher);
  const runtimeUsesTabbedNavigation = !rendererOwnsLauncher && renderRuntime.showTabStrip;
  const showPrimaryLauncherChrome = !rendererOwnsLauncher;
  const isBottomBar = layoutProfile.chrome.barPosition === 'bottom';
  const isWindowedMode = windowMode === 'windowed';
  const windowedChromeTopInset = isWindowedMode && blurPlatform === 'windows' && !isWindowMaximized ? 10 : 0;
  const topBarBackdropFilter = resolveConditionalBlurFilter({
    enabled: blur && effectiveTopBarStyle === 'glass',
    blurPx: Math.min(blurStrength, 18),
  });
  const interactionMotion = useInteractionMotionController(appearance);
  const layoutDynamics = useLayoutDynamicsController(appearance);
  const [selectedTopBarControlId, setSelectedTopBarControlId] = useState<string | null>(null);
  const topBarButtonTransition = 'background 0.15s, border-color 0.15s, color 0.15s, box-shadow 0.15s, opacity 0.15s';
  const panelTabTransition = 'background 0.15s, color 0.15s, border-color 0.15s, opacity 0.15s, box-shadow 0.15s';
  const openPanels = useMemo(
    () => getTabbedOpenPanelIds(layoutProfile, openPanelIds)
      .map(id => panels.find(panel => panel.id === id))
      .filter((panel): panel is OverlayPanelDefinition => Boolean(panel)),
    [layoutProfile, openPanelIds, panels],
  );
  const tabPanels = useMemo(
    () => openPanels.filter(panel => panel.id !== 'explorer' && panel.id !== 'settings'),
    [openPanels],
  );
  const panelGroups = useMemo(() => {
    const builtInPanels = panels.filter(panel => panel.kind === 'built-in-panel');
    const pluginPanels = panels.filter(panel => panel.kind === 'folder-plugin');

    return [
      builtInPanels.length > 0 ? { id: 'core', label: 'Core Panels', panels: builtInPanels } : null,
      pluginPanels.length > 0 ? { id: 'plugins', label: 'Plugin Panels', panels: pluginPanels } : null,
    ].filter((group): group is { id: string; label: string; panels: OverlayPanelDefinition[] } => Boolean(group));
  }, [panels]);
  const panelMenuWidth = Math.max(236, Math.min(292, viewportSize.width - 24));
  const panelMenuMaxHeight = Math.max(190, Math.min(440, viewportSize.height - 92));
  const compactPanelMenu = panelMenuWidth < 264 || viewportSize.height < 640;
  const panelMenuRowHeight = compactPanelMenu ? 42 : 52;
  const panelMenuHeight = Math.max(
    190,
    Math.min(
      panelMenuMaxHeight,
      52 + panelGroups.length * 26 + panels.length * panelMenuRowHeight,
    ),
  );
  const showPanelDescriptions = !compactPanelMenu && panelMenuHeight > 290;
  const nextOverlayAnchor = overlayAnchor === 'top' ? 'bottom' : 'top';
  const layoutButtonTitle = isWindowedMode
    ? (layoutSourcePath
      ? `Cycle Layout (${layoutProfile.label})\n${layoutSourcePath}`
      : `Cycle Layout (${layoutProfile.label})`)
    : (layoutSourcePath
      ? `Cycle Layout (${layoutProfile.label})\n${layoutSourcePath}\nRight-click: dock overlay to the ${nextOverlayAnchor} edge`
      : `Cycle Layout (${layoutProfile.label})\nRight-click: dock overlay to the ${nextOverlayAnchor} edge`);
  const shouldShowLeadingWindowControls = isWindowedMode && blurPlatform === 'macos';
  const shouldShowTrailingWindowControls = isWindowedMode && blurPlatform !== 'macos';
  const showsTabStrip = runtimeUsesTabbedNavigation && topBarDefinition.navigationMode !== 'summary';
  const isMobileShareBusy = mobileSharePhase === 'starting' || mobileSharePhase === 'stopping';
  const isMobileShareActive = mobileSharePhase === 'running' && mobileShareSession != null;

  const handleStartWindowDrag = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!isWindowedMode || event.button !== 0 || !isTauri()) {
      return;
    }

    event.preventDefault();
    getCurrentWindow().startDragging().catch(() => {});
  }, [isWindowedMode]);

  const handleMinimizeWindow = useCallback(() => {
    if (!isWindowedMode || !isTauri()) {
      return;
    }

    getCurrentWindow().minimize().catch(() => {});
  }, [isWindowedMode]);

  const handleToggleMaximize = useCallback(async () => {
    if (!isWindowedMode || !isTauri()) {
      return;
    }

    const currentWindow = getCurrentWindow();
    const maximized = await currentWindow.isMaximized().catch(() => false);
    if (maximized) {
      await currentWindow.unmaximize().catch(() => {});
      setIsWindowMaximized(false);
      return;
    }

    await currentWindow.maximize().catch(() => {});
    setIsWindowMaximized(true);
  }, [isWindowedMode]);

  useEffect(() => {
    if (!isMenuOpen && !isMobileMenuOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!menuRef.current?.contains(target)) {
        setIsMenuOpen(false);
      }
      if (!mobileMenuRef.current?.contains(target)) {
        setIsMobileMenuOpen(false);
      }
    };

    window.addEventListener('pointerdown', handlePointerDown);
    return () => window.removeEventListener('pointerdown', handlePointerDown);
  }, [isMenuOpen, isMobileMenuOpen]);

  useEffect(() => {
    const handleResize = () => {
      setViewportSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const clearMobileMenuTimers = useCallback(() => {
    if (mobileMenuOpenTimerRef.current != null) {
      window.clearTimeout(mobileMenuOpenTimerRef.current);
      mobileMenuOpenTimerRef.current = null;
    }
    if (mobileMenuCloseTimerRef.current != null) {
      window.clearTimeout(mobileMenuCloseTimerRef.current);
      mobileMenuCloseTimerRef.current = null;
    }
  }, []);

  const scheduleMobileMenuOpen = useCallback(() => {
    if (mobileMenuCloseTimerRef.current != null) {
      window.clearTimeout(mobileMenuCloseTimerRef.current);
      mobileMenuCloseTimerRef.current = null;
    }
    if (mobileMenuOpenTimerRef.current != null) {
      window.clearTimeout(mobileMenuOpenTimerRef.current);
    }

    mobileMenuOpenTimerRef.current = window.setTimeout(() => {
      setIsMobileMenuOpen(true);
      mobileMenuOpenTimerRef.current = null;
    }, mobileShareMenuHoverDelayMs);
  }, []);

  const keepMobileMenuOpen = useCallback(() => {
    if (mobileMenuCloseTimerRef.current != null) {
      window.clearTimeout(mobileMenuCloseTimerRef.current);
      mobileMenuCloseTimerRef.current = null;
    }
  }, []);

  const scheduleMobileMenuClose = useCallback(() => {
    if (mobileMenuOpenTimerRef.current != null) {
      window.clearTimeout(mobileMenuOpenTimerRef.current);
      mobileMenuOpenTimerRef.current = null;
    }
    if (mobileMenuCloseTimerRef.current != null) {
      window.clearTimeout(mobileMenuCloseTimerRef.current);
    }

    mobileMenuCloseTimerRef.current = window.setTimeout(() => {
      setIsMobileMenuOpen(false);
      mobileMenuCloseTimerRef.current = null;
    }, 140);
  }, []);

  useEffect(() => () => {
    clearMobileMenuTimers();
  }, [clearMobileMenuTimers]);

  useEffect(() => {
    if (!topBarCustomizeActive) {
      setSelectedTopBarControlId(null);
    }
  }, [topBarCustomizeActive]);

  const handleShowMobileQrDialog = useCallback(async () => {
    clearMobileMenuTimers();
    setIsMobileMenuOpen(false);
    setIsMobileQrDialogOpen(true);
    if (!mobileShareSession || mobileShareSession.remoteAccessMode !== mobileShareRemoteAccessMode) {
      try {
        await onStartMobileShare();
      } catch {}
    }
  }, [
    clearMobileMenuTimers,
    mobileShareRemoteAccessMode,
    mobileShareSession,
    onStartMobileShare,
  ]);

  const handleStartMobileShareFromMenu = useCallback(async () => {
    clearMobileMenuTimers();
    setIsMobileMenuOpen(false);
    await onStartMobileShare();
  }, [clearMobileMenuTimers, onStartMobileShare]);

  const handleStopMobileShareFromMenu = useCallback(async () => {
    clearMobileMenuTimers();
    setIsMobileMenuOpen(false);
    await onStopMobileShare();
  }, [clearMobileMenuTimers, onStopMobileShare]);

  const handleOpenMobileSettingsFromChrome = useCallback(() => {
    clearMobileMenuTimers();
    setIsMobileMenuOpen(false);
    setIsMobileQrDialogOpen(false);
    onOpenMobileSettings();
  }, [clearMobileMenuTimers, onOpenMobileSettings]);

  useEffect(() => {
    if (!isWindowedMode || !isTauri()) {
      setIsWindowMaximized(false);
      return;
    }

    let cancelled = false;
    const currentWindow = getCurrentWindow();
    const sync = async () => {
      const nextValue = await currentWindow.isMaximized().catch(() => false);
      if (!cancelled) {
        setIsWindowMaximized(nextValue);
      }
    };

    void sync();
    const unlistenResize = currentWindow.onResized(() => {
      void sync();
    });

    return () => {
      cancelled = true;
      void unlistenResize.then(unlisten => unlisten());
    };
  }, [isWindowedMode]);

  const panelMenu = (
    <div
      style={{
        position: 'absolute',
        top: isBottomBar ? 'auto' : 'calc(100% + 8px)',
        bottom: isBottomBar ? 'calc(100% + 8px)' : 'auto',
        right: 0,
        width: panelMenuWidth,
        maxWidth: 'calc(100vw - 16px)',
        height: panelMenuHeight,
        maxHeight: panelMenuMaxHeight,
        background: 'var(--overlay-workbench-chrome-menu-bg)',
        border: '1px solid var(--overlay-workbench-chrome-border)',
        borderRadius: workbench.metrics.panelRadius,
        boxShadow: 'var(--overlay-workbench-shell-shadow)',
        padding: 6,
        zIndex: 50,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        backdropFilter: topBarBackdropFilter,
        WebkitBackdropFilter: topBarBackdropFilter,
      }}
    >
      <div
        style={{
          padding: '8px 10px 10px',
          fontSize: 10,
          color: muted,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          fontWeight: 700,
          borderBottom: '1px solid var(--overlay-workbench-chrome-border)',
        }}
      >
        <div>Panels</div>
        <div
          style={{
            marginTop: 4,
            fontSize: 9,
            letterSpacing: '0.04em',
            textTransform: 'none',
            fontWeight: 500,
          }}
        >
          {openPanels.length} open
          {panelGroups.some(group => group.id === 'plugins')
            ? ` • ${panelGroups.find(group => group.id === 'plugins')?.panels.length ?? 0} plugins`
            : ''}
        </div>
      </div>

      <OverlayScrollArea
        style={{ flex: 1, minHeight: 0 }}
        viewportStyle={{ paddingRight: 2, paddingTop: 6 }}
        contentStyle={{ display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 4 }}
      >
        {panelGroups.map(group => (
          <div key={group.id} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div
              style={{
                padding: '0 6px',
                fontSize: 9,
                color: muted,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                fontWeight: 700,
              }}
            >
              {group.label}
            </div>

            {group.panels.map(panel => {
              const isOpen = openPanelIds.includes(panel.id);
              const isActive = panel.id === activePanelId;
              const isPinned = pinnedPanelIds.includes(panel.id);
              const helperLabel = isPinned ? `Docked by ${layoutProfile.label}` : panel.description;
              const statusLabel = isPinned ? 'Docked' : isOpen ? 'Open' : panel.kind === 'folder-plugin' ? 'Plugin' : 'Closed';

              return (
                <button
                  key={panel.id}
                  onClick={() => {
                    if (!isPinned) {
                      if (isOpen) {
                        onPanelSelect(panel.id);
                      } else {
                        onPanelToggle(panel.id);
                      }
                    }
                    setIsMenuOpen(false);
                  }}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: compactPanelMenu ? 8 : 10,
                    padding: compactPanelMenu ? '8px 10px' : '9px 10px',
                    border: `1px solid ${isActive ? 'var(--overlay-workbench-chrome-button-active-border)' : 'transparent'}`,
                    borderRadius: 9,
                    background: isActive
                      ? 'var(--overlay-workbench-chrome-tab-active-bg)'
                      : isOpen
                        ? 'var(--overlay-workbench-chrome-tab-bg)'
                        : 'var(--overlay-workbench-chrome-button-bg)',
                    color: text,
                    cursor: isPinned ? 'default' : 'pointer',
                    textAlign: 'left',
                    minHeight: compactPanelMenu ? 40 : 48,
                  }}
                >
                  <span
                    style={{
                      width: 14,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: isOpen || isPinned ? accent : 'transparent',
                      flexShrink: 0,
                    }}
                  >
                    <Check size={12} />
                  </span>
                  <span style={{ display: 'flex', color: isActive ? accent : muted, flexShrink: 0 }}>{panel.icon}</span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: compactPanelMenu ? 11 : 12, fontWeight: 700, color: text }}>{panel.label}</span>
                      {isActive ? <span style={{ width: 5, height: 5, borderRadius: '50%', background: accent, flexShrink: 0 }} /> : null}
                    </span>
                    {showPanelDescriptions ? (
                      <span
                        style={{
                          display: 'block',
                          marginTop: 2,
                          fontSize: 10,
                          color: muted,
                          lineHeight: 1.35,
                        }}
                      >
                        {helperLabel}
                      </span>
                    ) : null}
                  </span>
                  <span
                    style={{
                      fontSize: 9,
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                      color: isPinned || isOpen ? accent : muted,
                      padding: '3px 6px',
                      borderRadius: workbench.metrics.controlRadius,
                      border: `1px solid ${isPinned || isOpen ? 'var(--overlay-workbench-chrome-button-active-border)' : 'var(--overlay-workbench-chrome-border)'}`,
                      background: isPinned || isOpen ? 'var(--overlay-workbench-chrome-button-active-bg)' : 'var(--overlay-workbench-chrome-button-bg)',
                      flexShrink: 0,
                    }}
                  >
                    {statusLabel}
                  </span>
                </button>
              );
            })}
          </div>
        ))}
      </OverlayScrollArea>
    </div>
  );

  const bindTopBarButtonMotion = useCallback((active = false, motionStepIndex = 0) => (
    interactionMotion.bindSurface({
      surfaceId: 'topBarButton',
      triggerState: active ? { activate: true } : undefined,
      motionStepIndex,
      baseTransition: topBarButtonTransition,
    })
  ), [interactionMotion, topBarButtonTransition]);

  const bindPanelTabMotion = useCallback((active = false, motionStepIndex = 0) => (
    interactionMotion.bindSurface({
      surfaceId: 'panelTab',
      triggerState: active ? { activate: true } : undefined,
      motionStepIndex,
      baseTransition: panelTabTransition,
    })
  ), [interactionMotion, panelTabTransition]);

  const renderCompactButton = (
    content: ReactNode,
    options: {
      key: string;
      active?: boolean;
      title: string;
      motionStepIndex?: number;
      onClick?: (event: MouseEvent<HTMLButtonElement>) => void;
      onContextMenu?: (event: MouseEvent<HTMLButtonElement>) => void;
      ariaLabel?: string;
      style?: CSSProperties;
      dataAttributes?: Record<string, string | undefined>;
    },
  ): ReactNode => {
    const motionBinding = bindTopBarButtonMotion(
      options.active,
      options.motionStepIndex,
    );

    return (
      <CompactChromeButton
        key={options.key}
        active={options.active}
        title={options.title}
        motionBinding={motionBinding}
        text={text}
        muted={muted}
        accent={accent}
        controlRadius={workbench.metrics.controlRadius}
        aria-label={options.ariaLabel}
        dataAttributes={options.dataAttributes}
        onClick={options.onClick}
        onContextMenu={options.onContextMenu}
      >
        {content}
      </CompactChromeButton>
    );
  };

  const renderCompactControl = useCallback((
    controlId: OverlayTopBarControlId,
    motionStepIndex = 0,
  ): ReactNode | null => {
    switch (controlId) {
      case 'layout-cycle':
        return renderCompactButton(
          <div
            style={{
              width: 18,
              height: 18,
              borderRadius: workbench.metrics.controlRadius,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: `${accent}1e`,
              border: `1px solid ${accent}40`,
            }}
          >
            <TerminalIcon size={10} style={{ color: accent }} />
          </div>,
          {
            key: controlId,
            title: layoutButtonTitle,
            motionStepIndex,
            onClick: onCycleLayout,
            onContextMenu: event => {
              event.preventDefault();
              if (!isWindowedMode) {
                onToggleOverlayAnchor();
              }
            },
            style: {
              minWidth: 24,
              width: 24,
              background: 'var(--overlay-workbench-chrome-button-bg)',
            },
          },
        );
      case 'window-mode':
        const windowModeMotion = bindTopBarButtonMotion(
          windowMode === 'overlay',
          motionStepIndex,
        );
        return (
          <button
            key={controlId}
            onClick={() => {
              setIsMenuOpen(false);
              onSetWindowMode(windowMode === 'windowed' ? 'overlay' : 'windowed');
            }}
            title={windowMode === 'windowed' ? 'Switch to Dock Mode' : 'Switch to Application Mode'}
            {...windowModeMotion.motionDataAttributes}
            onPointerEnter={windowModeMotion.onPointerEnter}
            onPointerLeave={windowModeMotion.onPointerLeave}
            onPointerDown={windowModeMotion.onPointerDown}
            onPointerUp={windowModeMotion.onPointerUp}
            onPointerCancel={windowModeMotion.onPointerCancel}
            style={{
              height: 22,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '0 7px',
              borderRadius: workbench.metrics.controlRadius,
              border: `1px solid ${windowMode === 'overlay' ? 'var(--overlay-workbench-chrome-button-active-border)' : 'var(--overlay-workbench-chrome-border)'}`,
              background: windowMode === 'overlay'
                ? 'var(--overlay-workbench-chrome-button-active-bg)'
                : 'var(--overlay-workbench-chrome-button-bg)',
              color: windowMode === 'overlay' ? text : muted,
              fontSize: 'var(--overlay-workbench-chrome-meta-size)',
              fontWeight: 700,
              letterSpacing: 'var(--overlay-workbench-label-spacing)',
              textTransform: 'uppercase',
              cursor: 'pointer',
              boxShadow: windowMode === 'overlay' ? `0 0 0 1px ${accent}18 inset` : 'none',
              ...windowModeMotion.motionStyle,
            }}
          >
            <span>{windowMode === 'windowed' ? 'Dock' : 'App'}</span>
          </button>
        );
      case 'overlay-anchor':
        if (windowMode !== 'overlay') {
          return null;
        }

        const overlayAnchorMotion = bindTopBarButtonMotion(false, motionStepIndex);
        return (
          <button
            key={controlId}
            onClick={onToggleOverlayAnchor}
            title={`Docked to ${overlayAnchor === 'top' ? 'top' : 'bottom'} edge`}
            {...overlayAnchorMotion.motionDataAttributes}
            onPointerEnter={overlayAnchorMotion.onPointerEnter}
            onPointerLeave={overlayAnchorMotion.onPointerLeave}
            onPointerDown={overlayAnchorMotion.onPointerDown}
            onPointerUp={overlayAnchorMotion.onPointerUp}
            onPointerCancel={overlayAnchorMotion.onPointerCancel}
            style={{
              height: 22,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '0 7px',
              borderRadius: workbench.metrics.controlRadius,
              border: '1px solid var(--overlay-workbench-chrome-border)',
              background: 'var(--overlay-workbench-chrome-button-bg)',
              color: muted,
              fontSize: 'var(--overlay-workbench-chrome-meta-size)',
              fontWeight: 700,
              letterSpacing: 'var(--overlay-workbench-label-spacing)',
              textTransform: 'uppercase',
              cursor: 'pointer',
              ...overlayAnchorMotion.motionStyle,
            }}
          >
            <span>{overlayAnchor === 'top' ? 'Top Edge' : 'Bottom Edge'}</span>
          </button>
        );
      case 'mobile-share':
      case 'blur-toggle':
        return (
          <div
            key={controlId}
            ref={mobileMenuRef}
            style={{ position: 'relative', flexShrink: 0 }}
            onPointerEnter={scheduleMobileMenuOpen}
            onPointerLeave={scheduleMobileMenuClose}
          >
            {renderCompactButton(
              <div
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: '999px',
                  display: 'grid',
                  placeItems: 'center',
                  border: `1px solid ${isMobileShareActive || isMobileShareBusy ? accent : borderColor}`,
                  background: isMobileShareActive || isMobileShareBusy ? `${accent}18` : 'rgba(255,255,255,0.025)',
                  color: isMobileShareActive || isMobileShareBusy ? accent : muted,
                }}
              >
                {isMobileShareBusy
                  ? <Loader2 size={10} className="animate-spin" />
                  : <Smartphone size={10} />}
              </div>,
              {
                key: `${controlId}-button`,
                active: isMobileShareActive || isMobileShareBusy,
                motionStepIndex,
                title: isMobileShareActive
                  ? `Stop Mobile Share (${mobileShareShortcutLabel})`
                  : `Start Mobile Share (${mobileShareShortcutLabel})`,
                onClick: () => {
                  setIsMobileMenuOpen(false);
                  clearMobileMenuTimers();
                  onToggleMobileShare();
                },
                style: {
                  color: isMobileShareActive || isMobileShareBusy ? accent : muted,
                  borderColor: isMobileShareActive || isMobileShareBusy ? accent : borderColor,
                  background: isMobileShareActive || isMobileShareBusy
                    ? `${accent}14`
                    : 'rgba(255,255,255,0.025)',
                  boxShadow: isMobileShareActive
                    ? `0 0 0 1px ${accent}1f inset, 0 0 0 4px ${accent}14`
                    : undefined,
                },
              },
            )}
            {isMobileMenuOpen ? (
              <MobileShareRouteMenu
                appearance={appearance}
                phase={mobileSharePhase}
                session={mobileShareSession}
                remoteAccessMode={mobileShareRemoteAccessMode}
                error={mobileShareError}
                notice={mobileShareNotice}
                triggerRef={mobileMenuRef}
                onSelectRemoteAccessMode={onSetMobileShareRemoteAccessMode}
                onShowQrCodes={handleShowMobileQrDialog}
                onStartOrRestartShare={handleStartMobileShareFromMenu}
                onStopShare={handleStopMobileShareFromMenu}
                onOpenMobileSettings={handleOpenMobileSettingsFromChrome}
                onPointerEnter={keepMobileMenuOpen}
                onPointerLeave={scheduleMobileMenuClose}
              />
            ) : null}
          </div>
        );
      case 'zen-mode':
        const zenModeMotion = bindTopBarButtonMotion(zenFocusMode, motionStepIndex);
        return (
          <button
            key={controlId}
            onClick={onToggleZenFocusMode}
            title={`${zenFocusMode ? 'Exit' : 'Enter'} Zen Focus Mode (${zenFocusShortcutLabel})`}
            {...zenModeMotion.motionDataAttributes}
            onPointerEnter={zenModeMotion.onPointerEnter}
            onPointerLeave={zenModeMotion.onPointerLeave}
            onPointerDown={zenModeMotion.onPointerDown}
            onPointerUp={zenModeMotion.onPointerUp}
            onPointerCancel={zenModeMotion.onPointerCancel}
            style={{
              height: 22,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '0 7px',
              borderRadius: workbench.metrics.controlRadius,
              border: `1px solid ${zenFocusMode ? 'var(--overlay-workbench-chrome-button-active-border)' : 'var(--overlay-workbench-chrome-border)'}`,
              background: zenFocusMode
                ? 'var(--overlay-workbench-chrome-button-active-bg)'
                : 'var(--overlay-workbench-chrome-button-bg)',
              color: zenFocusMode ? text : muted,
              fontSize: 'var(--overlay-workbench-chrome-meta-size)',
              fontWeight: 700,
              letterSpacing: 'var(--overlay-workbench-label-spacing)',
              textTransform: 'uppercase',
              cursor: 'pointer',
              boxShadow: zenFocusMode ? `0 0 0 1px ${accent}18 inset` : 'none',
              ...zenModeMotion.motionStyle,
            }}
          >
            <span>Zen</span>
          </button>
        );
      case 'panel-menu':
        if (!showPrimaryLauncherChrome || !layoutProfile.chrome.showPanelMenu) {
          return null;
        }

        return (
          <div key={controlId} ref={menuRef} style={{ position: 'relative', flexShrink: 0 }}>
            {renderCompactButton(
              <LayoutGrid size={11} style={{ color: isMenuOpen ? accent : muted }} />,
              {
                key: `${controlId}-button`,
                active: isMenuOpen,
                motionStepIndex,
                title: 'Toggle Panels',
                onClick: () => setIsMenuOpen(open => !open),
              },
            )}
            {isMenuOpen ? panelMenu : null}
          </div>
        );
      case 'command-palette':
        return renderCompactButton(
          <Search size={11} />,
          {
            key: controlId,
            title: `Open Command Palette (${commandPaletteShortcutLabel})`,
            motionStepIndex,
            onClick: onOpenCommandPalette,
          },
        );
      case 'customize-top-bar':
        return renderCompactButton(
          <LayoutGrid size={11} />,
          {
            key: controlId,
            active: topBarCustomizeActive,
            title: topBarCustomizeActive
              ? 'Save and leave top-bar customize mode'
              : 'Enable top-bar customize mode',
            motionStepIndex,
            onClick: onToggleTopBarCustomize,
            style: {
              color: topBarCustomizeActive ? accent : muted,
              borderColor: topBarCustomizeActive ? accent : borderColor,
              background: topBarCustomizeActive
                ? `${accent}14`
                : 'var(--overlay-workbench-chrome-button-bg)',
            },
            dataAttributes: {
              'data-layout-dynamics-live-control': 'true',
            },
            ariaLabel: topBarCustomizeActive
              ? 'Save and leave top-bar customize mode'
              : 'Enable top-bar customize mode',
          },
        );
      case 'shortcut-badge':
        if (!layoutProfile.chrome.showShortcutBadge || isWindowedMode) {
          return null;
        }

        return (
          <kbd
            key={controlId}
            style={{
              fontSize: 'var(--overlay-workbench-chrome-meta-size)',
              fontFamily: monoFont,
              background: 'var(--overlay-workbench-chrome-button-bg)',
              padding: '1px 4px',
              borderRadius: workbench.metrics.controlRadius,
              border: '1px solid var(--overlay-workbench-chrome-border)',
              color: muted,
              userSelect: 'none',
            }}
          >
            {toggleShortcutLabel}
          </kbd>
        );
      case 'close-overlay':
        if (isWindowedMode) {
          return null;
        }

        const closeOverlayMotion = bindTopBarButtonMotion(false, motionStepIndex);
        return (
          <button
            key={controlId}
            onClick={onClose}
            title="Close (Esc)"
            {...closeOverlayMotion.motionDataAttributes}
            onPointerEnter={event => {
              closeOverlayMotion.onPointerEnter(event);
              event.currentTarget.style.background = 'rgba(248,113,113,0.12)';
              event.currentTarget.style.color = appearance.theme.palette.danger;
            }}
            onPointerLeave={event => {
              closeOverlayMotion.onPointerLeave(event);
              event.currentTarget.style.background = 'transparent';
              event.currentTarget.style.color = muted;
            }}
            onPointerDown={closeOverlayMotion.onPointerDown}
            onPointerUp={closeOverlayMotion.onPointerUp}
            onPointerCancel={event => {
              closeOverlayMotion.onPointerCancel(event);
              event.currentTarget.style.background = 'transparent';
              event.currentTarget.style.color = muted;
            }}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: muted,
              padding: 4,
              borderRadius: workbench.metrics.controlRadius,
              display: 'flex',
              alignItems: 'center',
              ...closeOverlayMotion.motionStyle,
            }}
          >
            <X size={12} />
          </button>
        );
      default:
        return null;
    }
  }, [
    accent,
    appearance.theme.palette.danger,
    borderColor,
    clearMobileMenuTimers,
    commandPaletteShortcutLabel,
    handleShowMobileQrDialog,
    handleStartMobileShareFromMenu,
    handleStopMobileShareFromMenu,
    handleOpenMobileSettingsFromChrome,
    isMobileMenuOpen,
    isMobileShareActive,
    isMobileShareBusy,
    isMenuOpen,
    isWindowedMode,
    keepMobileMenuOpen,
    layoutButtonTitle,
    layoutProfile.chrome.showPanelMenu,
    layoutProfile.chrome.showShortcutBadge,
    mobileShareError,
    mobileShareNotice,
    mobileSharePhase,
    mobileShareRemoteAccessMode,
    mobileShareSession,
    mobileShareShortcutLabel,
    monoFont,
    muted,
    onClose,
    onCycleLayout,
    onOpenCommandPalette,
    onSetMobileShareRemoteAccessMode,
    onSetWindowMode,
    onToggleMobileShare,
    onToggleOverlayAnchor,
    onToggleZenFocusMode,
    overlayAnchor,
    panelMenu,
    scheduleMobileMenuClose,
    scheduleMobileMenuOpen,
    showPrimaryLauncherChrome,
    text,
    toggleShortcutLabel,
    windowMode,
    workbench.metrics.controlRadius,
    zenFocusMode,
    zenFocusShortcutLabel,
  ]);

  const renderNavigationShortcutControl = useCallback((
    controlId: OverlayTopBarControlId,
    motionStepIndex = 0,
  ): ReactNode | null => {
    switch (controlId) {
      case 'settings-shortcut':
        if (!showPrimaryLauncherChrome || !layoutProfile.chrome.showSettingsShortcut || !renderRuntime.showSettingsShortcut) {
          return null;
        }

        const settingsShortcutMotion = bindPanelTabMotion(isSettingsActive, motionStepIndex);
        return (
          <button
            key={controlId}
            onClick={onOpenSettings}
            title="Open Settings"
            {...settingsShortcutMotion.motionDataAttributes}
            onPointerEnter={settingsShortcutMotion.onPointerEnter}
            onPointerLeave={settingsShortcutMotion.onPointerLeave}
            onPointerDown={settingsShortcutMotion.onPointerDown}
            onPointerUp={settingsShortcutMotion.onPointerUp}
            onPointerCancel={settingsShortcutMotion.onPointerCancel}
            style={{
              height: '100%',
              width: 34,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: isSettingsActive
                ? 'var(--overlay-workbench-chrome-tab-active-bg)'
                : 'var(--overlay-workbench-chrome-tab-bg)',
              border: 'none',
              borderRight: `1px solid ${borderColor}`,
              borderLeft: `1px solid ${isSettingsActive ? 'var(--overlay-workbench-chrome-button-active-border)' : borderColor}`,
              color: isSettingsActive ? text : muted,
              cursor: 'pointer',
              flexShrink: 0,
              boxShadow: isSettingsActive
                ? `inset 0 ${isBottomBar ? 2 : -2}px 0 ${accent}, inset 0 0 0 1px ${accent}18`
                : `inset 0 ${isBottomBar ? 2 : -2}px 0 transparent`,
              padding: 0,
              ...settingsShortcutMotion.motionStyle,
            }}
          >
            <Settings2 size={12} style={{ color: isSettingsActive ? accent : muted }} />
          </button>
        );
      case 'explorer-shortcut':
        if (!showPrimaryLauncherChrome || !renderRuntime.showExplorerShortcut) {
          return null;
        }

        const explorerShortcutMotion = bindPanelTabMotion(isExplorerActive, motionStepIndex);
        return (
          <button
            key={controlId}
            onClick={() => onPanelSelect('explorer')}
            title="Open Explorer"
            {...explorerShortcutMotion.motionDataAttributes}
            onPointerEnter={explorerShortcutMotion.onPointerEnter}
            onPointerLeave={explorerShortcutMotion.onPointerLeave}
            onPointerDown={explorerShortcutMotion.onPointerDown}
            onPointerUp={explorerShortcutMotion.onPointerUp}
            onPointerCancel={explorerShortcutMotion.onPointerCancel}
            style={{
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '0 14px',
              background: isExplorerActive
                ? 'var(--overlay-workbench-chrome-tab-active-bg)'
                : 'var(--overlay-workbench-chrome-tab-bg)',
              border: 'none',
              borderRight: `1px solid ${borderColor}`,
              color: isExplorerActive ? text : muted,
              cursor: 'pointer',
              flexShrink: 0,
              boxShadow: isExplorerActive
                ? `inset 0 ${isBottomBar ? 2 : -2}px 0 ${accent}, inset 0 0 0 1px ${accent}18`
                : `inset 0 ${isBottomBar ? 2 : -2}px 0 transparent`,
              ...explorerShortcutMotion.motionStyle,
            }}
          >
            <span style={{ display: 'flex', color: isExplorerActive ? accent : muted }}>
              {panels.find(panel => panel.id === 'explorer')?.icon ?? <TerminalIcon size={12} />}
            </span>
            <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.08em' }}>Explorer</span>
            {isExplorerActive ? <span style={{ width: 4, height: 4, borderRadius: '50%', background: accent }} /> : null}
          </button>
        );
      default:
        return renderCompactControl(controlId, motionStepIndex);
    }
  }, [
    accent,
    borderColor,
    isBottomBar,
    isExplorerActive,
    isSettingsActive,
    muted,
    onOpenSettings,
    onPanelSelect,
    panels,
    renderCompactControl,
    renderRuntime.showExplorerShortcut,
    renderRuntime.showSettingsShortcut,
    showPrimaryLauncherChrome,
    text,
    layoutProfile.chrome.showSettingsShortcut,
  ]);

  const topBarSurfaceSettings = layoutDynamics.resolveSurfaceSettings('workbenchTopBar');
  const seededTopBarControls = useMemo(() => {
    const flattened = flattenTopBarDefinitionControls(topBarDefinition);
    if (!flattened.some(entry => entry.controlId === 'customize-top-bar')) {
      flattened.push({
        controlId: 'customize-top-bar',
        bandId: 'trailing',
        order: flattened.length,
      });
    }
    return flattened;
  }, [topBarDefinition]);
  const topBarRenderedControlPlacements = useMemo(
    () =>
      seededTopBarControls
        .map((placement, index) => ({
          ...placement,
          node: renderNavigationShortcutControl(placement.controlId, index),
        }))
        .filter(
          (
            placement,
          ): placement is typeof placement & { node: ReactNode } =>
            placement.node != null,
        ),
    [renderNavigationShortcutControl, seededTopBarControls],
  );
  const topBarLayoutEntries = topBarLayoutSnapshot?.entries ?? [];
  const topBarVisibleEntryById = useMemo(
    () =>
      new Map(
        topBarLayoutEntries
          .filter(entry => entry.hidden !== true)
          .map(entry => [entry.nodeId, entry] as const),
      ),
    [topBarLayoutEntries],
  );
  const topBarHiddenEntryById = useMemo(
    () =>
      new Map(
        topBarLayoutEntries
          .filter(entry => entry.hidden === true)
          .map(entry => [entry.nodeId, entry] as const),
      ),
    [topBarLayoutEntries],
  );
  const topBarUsesLayoutDynamics =
    topBarSurfaceSettings.enabled &&
    (topBarCustomizeActive || topBarLayoutEntries.length > 0);
  const topBarDynamicItems = useMemo(
    () =>
      topBarRenderedControlPlacements
        .filter(placement => !topBarHiddenEntryById.has(placement.controlId))
        .map((placement, index) => {
          const authoredEntry = topBarVisibleEntryById.get(placement.controlId);
          return {
            id: placement.controlId,
            label: getTopBarControlLabel(placement.controlId),
            bandId: authoredEntry?.bandId ?? 'topbar',
            order: index,
            anchorX: authoredEntry?.x,
            anchorY: authoredEntry?.y,
            selected: selectedTopBarControlId === placement.controlId,
            removable: placement.controlId !== 'customize-top-bar',
            content: placement.node,
          };
        }),
    [
      selectedTopBarControlId,
      topBarHiddenEntryById,
      topBarRenderedControlPlacements,
      topBarVisibleEntryById,
    ],
  );
  const topBarHiddenControls = useMemo(
    () =>
      seededTopBarControls
        .filter(placement => topBarHiddenEntryById.has(placement.controlId))
        .map(placement => placement.controlId),
    [seededTopBarControls, topBarHiddenEntryById],
  );
  const commitTopBarLayoutSnapshot = useCallback(
    (snapshot: LayoutDynamicsAuthoringSnapshot) => {
      const preservedHiddenEntries = topBarLayoutEntries.filter(
        entry => entry.hidden === true,
      );
      onCommitTopBarLayoutSnapshot({
        entries: [...snapshot.entries, ...preservedHiddenEntries],
      });
    },
    [onCommitTopBarLayoutSnapshot, topBarLayoutEntries],
  );
  const removeTopBarControl = useCallback(
    (controlId: string) => {
      const visibleEntries = topBarDynamicItems
        .filter(item => item.id !== controlId)
        .map((item, index) => ({
          nodeId: item.id,
          bandId: item.bandId,
          x: item.anchorX ?? index * 112,
          y: item.anchorY ?? 0,
        }));
      const existingHiddenEntries = topBarLayoutEntries.filter(
        entry => entry.hidden === true && entry.nodeId !== controlId,
      );
      const hiddenEntry = topBarVisibleEntryById.get(controlId)
        ?? topBarHiddenEntryById.get(controlId)
        ?? {
          nodeId: controlId,
          bandId: 'topbar',
          x: 0,
          y: 0,
        };
      onCommitTopBarLayoutSnapshot({
        entries: [
          ...visibleEntries,
          { ...hiddenEntry, hidden: true },
          ...existingHiddenEntries,
        ],
      });
      setSelectedTopBarControlId(current =>
        current === controlId ? null : current,
      );
    },
    [
      onCommitTopBarLayoutSnapshot,
      topBarDynamicItems,
      topBarHiddenEntryById,
      topBarLayoutEntries,
      topBarVisibleEntryById,
    ],
  );
  const restoreTopBarControl = useCallback(
    (controlId: OverlayTopBarControlId) => {
      const nextVisibleEntries = topBarDynamicItems.map((item, index) => ({
        nodeId: item.id,
        bandId: item.bandId,
        x: item.anchorX ?? index * 112,
        y: item.anchorY ?? 0,
      }));
      nextVisibleEntries.push({
        nodeId: controlId,
        bandId: 'topbar',
        x: nextVisibleEntries.length * 120,
        y: 0,
      });
      const remainingHiddenEntries = topBarLayoutEntries.filter(
        entry => entry.hidden === true && entry.nodeId !== controlId,
      );
      onCommitTopBarLayoutSnapshot({
        entries: [...nextVisibleEntries, ...remainingHiddenEntries],
      });
      setSelectedTopBarControlId(controlId);
    },
    [onCommitTopBarLayoutSnapshot, topBarDynamicItems, topBarLayoutEntries],
  );

  const leadingControls = topBarDefinition.leadingControls
    .map((controlId, index) => renderCompactControl(controlId, index))
    .filter((entry): entry is ReactNode => entry != null);
  const navigationShortcuts = topBarDefinition.navigationShortcuts
    .map((controlId, index) => renderNavigationShortcutControl(controlId, index))
    .filter((entry): entry is ReactNode => entry != null);
  const trailingControls = topBarDefinition.trailingControls
    .map((controlId, index) => renderCompactControl(controlId, index))
    .filter((entry): entry is ReactNode => entry != null);

  const centerContent = showsTabStrip ? (
    <OverlayScrollArea
      direction="horizontal"
      style={{
        display: 'flex',
        alignItems: 'stretch',
        flex: 1,
        minWidth: 0,
        background: 'rgba(0,0,0,0.08)',
      }}
      contentStyle={{ display: 'flex', alignItems: 'stretch', minWidth: 'max-content' }}
    >
      {tabPanels.map((panel, index) => {
        const isActive = panel.id === activePanelId;
        const isDragged = draggedPanelId === panel.id;
        const isPersistentTab = layoutProfile.behavior.enforcedOpenPanelIds.includes(panel.id);
        const panelTabMotion = bindPanelTabMotion(isActive, index);
        return (
          <button
            key={panel.id}
            draggable
            onClick={() => onPanelSelect(panel.id)}
            onDragStart={() => setDraggedPanelId(panel.id)}
            onDragEnd={() => setDraggedPanelId(null)}
            onDragOver={event => {
              event.preventDefault();
            }}
            onDrop={event => {
              event.preventDefault();
              if (draggedPanelId && draggedPanelId !== panel.id) {
                onPanelReorder(draggedPanelId, panel.id);
              }
              setDraggedPanelId(null);
            }}
            {...panelTabMotion.motionDataAttributes}
            onPointerEnter={panelTabMotion.onPointerEnter}
            onPointerLeave={panelTabMotion.onPointerLeave}
            onPointerDown={panelTabMotion.onPointerDown}
            onPointerUp={panelTabMotion.onPointerUp}
            onPointerCancel={panelTabMotion.onPointerCancel}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '0 9px',
              cursor: 'pointer',
              background: isActive
                ? 'var(--overlay-workbench-chrome-tab-active-bg)'
                : (effectiveTabStyle === 'segment' ? 'var(--overlay-workbench-chrome-tab-bg)' : 'transparent'),
              border: 'none',
              borderBottom: isBottomBar ? 'none' : `2px solid ${isActive ? accent : 'transparent'}`,
              borderTop: isBottomBar ? `2px solid ${isActive ? accent : 'transparent'}` : 'none',
              borderRight: `1px solid ${borderColor}`,
              color: isActive ? text : muted,
              fontSize: 'var(--overlay-workbench-tab-label-size)',
              fontWeight: isActive ? 700 : 500,
              fontFamily: uiFont,
              transition: 'background 0.15s, color 0.15s, border-color 0.15s, opacity 0.15s',
              flexShrink: 0,
              userSelect: 'none',
              opacity: isDragged ? 0.45 : 1,
              height: '100%',
              borderRadius: effectiveTabStyle === 'capsule' ? workbench.metrics.controlRadius : 0,
              margin: effectiveTabStyle === 'capsule' ? '4px 4px' : 0,
              ...panelTabMotion.motionStyle,
            }}
          >
            <span style={{ display: 'flex', color: isActive ? accent : muted }}>{panel.icon}</span>
            <span>{panel.label}</span>
            {isActive ? <span style={{ width: 4, height: 4, borderRadius: '50%', background: accent }} /> : null}
            {isActive && !isPersistentTab ? (
              <span
                onClick={event => {
                  event.stopPropagation();
                  onPanelClose(panel.id);
                }}
                title={`Close ${panel.label}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 14,
                  height: 14,
                  borderRadius: 4,
                  color: muted,
                }}
              >
                <X size={10} />
              </span>
            ) : null}
          </button>
        );
      })}
    </OverlayScrollArea>
  ) : (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        flex: 1,
        minWidth: 0,
        padding: '0 14px',
        background: 'rgba(0,0,0,0.08)',
        borderLeft: navigationShortcuts.length > 0 ? 'none' : `1px solid ${borderColor}`,
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
        <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: muted }}>
          {renderRuntime.label}
        </span>
        <span
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: text,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {activePanelDefinition?.label ?? 'Launcher Ready'}
        </span>
      </div>
      <span
        style={{
          fontSize: 'var(--overlay-workbench-chrome-meta-size)',
          color: muted,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {renderRuntime.description}
      </span>
    </div>
  );

  return (
    <div
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'stretch',
        height: chromeHeight + windowedChromeTopInset,
        flexShrink: 0,
        paddingTop: windowedChromeTopInset,
        boxSizing: 'border-box',
        margin: usesInsetTopBar ? 'var(--overlay-workbench-shell-inset)' : 0,
        background: effectiveTopBarStyle === 'minimal'
          ? 'transparent'
          : `linear-gradient(180deg, var(--overlay-workbench-chrome-bg), ${appearance.theme.palette.appBackgroundAlt})`,
        borderBottom: usesFloatingTopBar || effectiveTopBarStyle === 'minimal'
          ? 'none'
          : (isBottomBar ? 'none' : '1px solid var(--overlay-workbench-chrome-border)'),
        borderTop: usesFloatingTopBar || effectiveTopBarStyle === 'minimal'
          ? 'none'
          : (isBottomBar ? '1px solid var(--overlay-workbench-chrome-border)' : 'none'),
        border: usesFloatingTopBar ? '1px solid var(--overlay-workbench-chrome-border)' : 'none',
        borderRadius: usesInsetTopBar ? workbench.metrics.panelRadius : 0,
        boxShadow: usesFloatingTopBar
          ? 'var(--overlay-workbench-shell-shadow)'
          : (isBottomBar
              ? 'inset 0 -1px 0 rgba(255,255,255,0.04), 0 -8px 18px rgba(0,0,0,0.2)'
              : 'inset 0 1px 0 rgba(255,255,255,0.04), 0 8px 18px rgba(0,0,0,0.2)'),
        overflow: isMobileMenuOpen ? 'visible' : 'hidden',
        backdropFilter: topBarBackdropFilter,
        WebkitBackdropFilter: topBarBackdropFilter,
      }}
    >
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        {topBarShaderLayer}
      </div>
      {shouldShowLeadingWindowControls ? (
        <div style={{ borderRight: `1px solid ${borderColor}`, flexShrink: 0 }}>
          <WindowControls
            platform={blurPlatform}
            isMaximized={isWindowMaximized}
            onMinimize={handleMinimizeWindow}
            onMaximize={() => { void handleToggleMaximize(); }}
            onClose={onClose}
            textMuted={muted}
          />
        </div>
      ) : null}
      {renderControlZone(leadingControls, 'leading')}
      <div style={{ display: 'flex', alignItems: 'stretch', flex: 1, minWidth: 0 }}>
        {navigationShortcuts}
        {centerContent}
      </div>

      {isWindowedMode ? (
        <div
          data-tauri-drag-region
          onPointerDown={handleStartWindowDrag}
          onDoubleClick={() => { void handleToggleMaximize(); }}
          title="Drag Window"
          style={{
            width: 72,
            minWidth: 72,
            flexShrink: 0,
            borderLeft: `1px solid ${borderColor}`,
            background: 'var(--overlay-workbench-chrome-button-bg)',
            cursor: 'grab',
            userSelect: 'none',
          }}
        />
      ) : null}
      {renderControlZone(trailingControls, 'trailing')}
      {shouldShowTrailingWindowControls ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '0 8px',
            borderLeft: `1px solid ${borderColor}`,
            background: 'var(--overlay-workbench-chrome-button-bg)',
            flexShrink: 0,
          }}
        >
          <WindowControls
            platform={blurPlatform}
            isMaximized={isWindowMaximized}
            onMinimize={handleMinimizeWindow}
            onMaximize={() => { void handleToggleMaximize(); }}
            onClose={onClose}
            textMuted={muted}
          />
        </div>
      ) : null}
      <MobileShareQrDialog
        open={isMobileQrDialogOpen}
        appearance={appearance}
        phase={mobileSharePhase}
        session={mobileShareSession}
        remoteAccessMode={mobileShareRemoteAccessMode}
        notice={mobileShareNotice}
        error={mobileShareError}
        onClose={() => setIsMobileQrDialogOpen(false)}
        onOpenMobileSettings={handleOpenMobileSettingsFromChrome}
        onStartOrRestartShare={onStartMobileShare}
        onStopShare={onStopMobileShare}
      />
    </div>
  );
}

function getTabbedOpenPanelIds(
  layoutProfile: LayoutProfile,
  openPanelIds: string[],
): string[] {
  const seen = new Set<string>();
  const ordered = [
    ...layoutProfile.behavior.enforcedOpenPanelIds,
    ...openPanelIds,
  ];

  return ordered.filter(panelId => {
    if (seen.has(panelId)) {
      return false;
    }

    seen.add(panelId);
    return true;
  });
}
