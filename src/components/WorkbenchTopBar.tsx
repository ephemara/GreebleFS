import { isTauri } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
  type ReactNode,
} from 'react';

import {
  Check,
  ChevronDown,
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
import {
  BOUNDED_CHROME_CONTAINMENT_STYLE,
  resolveInnerSurfaceBlurFilter,
} from '../config/chromeEffects';
import {
  getWorkbenchShellFamilyForLayoutProfile,
  type LayoutProfile,
} from '../config/layoutProfiles';
import type { RuntimePlatform } from '../config/platform';
import type {
  LoadedOverlayTopBarDefinition,
  OverlayTopBarControlId,
} from '../config/topBars';
import type {
  DockPlacementMode,
  DockPreviewSplitMode,
} from '../config/dockPresentations';
import { bindDeferredUnlisten } from '../runtime/deferredUnlisten';
import {
  dockTerminalGridGeometry,
  estimateDockSizeFromTerminalGrid,
  estimateDockTerminalGridFromSize,
  formatDockTerminalGrid,
  normalizeDockTerminalColumns,
  normalizeDockTerminalRows,
  type DockTerminalGrid,
} from '../config/dockTerminalGrid';
import {
  clampOverlayVisualControlValue,
  formatOverlayVisualControlValue,
  overlayWindowGeometry,
  overlayVisualControls,
} from '../config/overlayWindow';
import { mobileShareMenuHoverDelayMs, type MobileRemoteAccessMode } from '../config/mobileAccess';
import {
  groupPanelsForWorkbenchNavigation,
  type ResolvedWorkbenchRenderRuntime,
} from '../config/workbenchRenderRuntime';
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
  getTopBarControlLabel,
} from '../config/topBars';
import { LayoutDynamicsCanvas } from './layoutDynamics/LayoutDynamicsCanvas';
import { KainSemanticAppletStrip } from './kain/KainSemanticAppletStrip';
import type { KainLatticeCatalog } from '../runtime/kainLatticeCatalog';
import type { KainUiScaffold } from '../runtime/kainUiScaffold';

interface WorkbenchTopBarProps {
  appearance: ResolvedOverlayAppearance;
  renderRuntime: ResolvedWorkbenchRenderRuntime;
  layoutProfile: LayoutProfile;
  layoutSourcePath: string | null;
  availableLayoutProfiles: LayoutProfile[];
  panels: OverlayPanelDefinition[];
  openPanelIds: string[];
  pinnedPanelIds: string[];
  activePanelId: string | null;
  onPanelSelect: (panelId: string | null) => void;
  onPanelToggle: (panelId: string) => void;
  onPanelClose: (panelId: string) => void;
  onPanelReorder: (draggedId: string, targetId: string) => void;
  onOpenSettings: () => void;
  onToggleShellMode: () => void;
  onSelectLayoutProfile: (profileId: string) => void;
  onCycleLayout: () => void;
  onSetWindowMode: (mode: TerminalWindowMode) => void;
  onOpenCommandPalette: () => void;
  onToggleOverlayAnchor: () => void;
  dockPlacementMode?: DockPlacementMode;
  dockAllowedPlacements?: DockPlacementMode[];
  dockEdgeSize?: number;
  dockEdgeWidth?: number;
  dockDefaultTerminalRows?: number;
  dockDefaultTerminalColumns?: number;
  dockTerminalGrid?: DockTerminalGrid;
  dockTerminalFontSize?: number;
  dockTopBarHeight?: number;
  dockPreviewEnabled?: boolean;
  dockPreviewSplitMode?: DockPreviewSplitMode;
  onSetDockPlacementMode?: (placementMode: DockPlacementMode) => void;
  onUpdateDockSettings?: (updates: {
    edgeSize?: number;
    edgeWidth?: number;
    defaultTerminalRows?: number;
    defaultTerminalColumns?: number;
    previewEnabled?: boolean;
    previewSplitMode?: DockPreviewSplitMode;
  }) => void;
  onOpenDockSettings?: () => void;
  onClose: () => void;
  accent: string;
  blur: boolean;
  blurStrength: number;
  blurPlatform: RuntimePlatform;
  appOpacity: number;
  panelTransparency: number;
  appZoom: number;
  onUpdateAppearanceVisuals: (updates: {
    appOpacity?: number;
    panelTransparency?: number;
    appZoom?: number;
  }) => void;
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
  kainUiScaffold?: KainUiScaffold | null;
  kainLatticeCatalog?: KainLatticeCatalog | null;
  surfaceMode?: WorkbenchTopBarSurfaceMode;
}

type WorkbenchTopBarSurfaceMode =
  | 'full'
  | 'content-only'
  | 'window-controls-only';

const WINDOW_CHROME_INTERACTIVE_SELECTOR = [
  'a',
  'button',
  'input',
  'select',
  'textarea',
  '[contenteditable="true"]',
  '[draggable="true"]',
  '[role="button"]',
  '[role="menu"]',
  '[role="menuitem"]',
  '[role="slider"]',
  '[role="tab"]',
  '[data-gfs-window-drag-exclusion="true"]',
].join(',');

function isWindowChromeInteractiveTarget(target: EventTarget | null): boolean {
  const element = target instanceof Element
    ? target
    : target instanceof Node
      ? target.parentElement
      : null;

  return Boolean(element?.closest(WINDOW_CHROME_INTERACTIVE_SELECTOR));
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
  availableLayoutProfiles,
  panels,
  openPanelIds,
  pinnedPanelIds,
  activePanelId,
  onPanelSelect,
  onPanelToggle,
  onPanelClose,
  onPanelReorder,
  onOpenSettings,
  onToggleShellMode,
  onSelectLayoutProfile,
  onCycleLayout,
  onSetWindowMode,
  onOpenCommandPalette,
  onToggleOverlayAnchor,
  dockPlacementMode = 'bottom-edge',
  dockAllowedPlacements = ['top-edge', 'bottom-edge', 'floating'],
  dockEdgeSize = 520,
  dockEdgeWidth = 1280,
  dockDefaultTerminalRows = dockTerminalGridGeometry.defaultRows,
  dockDefaultTerminalColumns = dockTerminalGridGeometry.defaultColumns,
  dockTerminalGrid = {
    rows: dockTerminalGridGeometry.defaultRows,
    columns: dockTerminalGridGeometry.defaultColumns,
  },
  dockTerminalFontSize = dockTerminalGridGeometry.defaultTerminalFontSize,
  dockTopBarHeight = dockTerminalGridGeometry.dockTopBarHeight,
  dockPreviewEnabled = true,
  dockPreviewSplitMode = 'pane',
  onSetDockPlacementMode = () => {},
  onUpdateDockSettings = () => {},
  onOpenDockSettings = () => {},
  onClose,
  accent,
  blur,
  blurStrength,
  blurPlatform,
  appOpacity,
  panelTransparency,
  appZoom,
  onUpdateAppearanceVisuals,
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
  kainUiScaffold = null,
  kainLatticeCatalog = null,
  surfaceMode = 'full',
}: WorkbenchTopBarProps) {
  const borderColor = appearance.theme.palette.border;
  const muted = appearance.theme.palette.textMuted;
  const text = appearance.theme.palette.textPrimary;
  const workbench = appearance.workbenchTheme;
  const chromeTabsTheme = workbench.chromeTabs;
  const effectiveTopBarStyle = topBarDefinition.topBarStyle ?? workbench.topBarStyle;
  const effectiveTabStyle = topBarDefinition.tabStyle ?? chromeTabsTheme.style ?? workbench.tabStyle;
  const effectiveTabShowIcons = chromeTabsTheme.showIcons;
  const effectiveTabShowActiveIndicator = chromeTabsTheme.showActiveIndicator;
  const effectiveTabCloseButtonMode = chromeTabsTheme.closeButtonMode;
  const uiFont = appearance.fonts.ui;
  const monoFont = appearance.fonts.mono;
  const usesDockControlStrip = windowMode === 'overlay' && topBarDefinition.id === 'dock-control-strip';
  const chromeHeight = usesDockControlStrip
    ? Math.max(30, workbench.metrics.chromeHeight - 8)
    : workbench.metrics.chromeHeight;
  const usesFloatingTopBar = effectiveTopBarStyle === 'floating' || effectiveTopBarStyle === 'glass';
  const usesInsetTopBar = usesFloatingTopBar || effectiveTopBarStyle === 'minimal';
  const menuRef = useRef<HTMLDivElement | null>(null);
  const surfaceControlsPanelRef = useRef<HTMLDivElement | null>(null);
  const mobileMenuRef = useRef<HTMLDivElement | null>(null);
  const shellModeMenuRef = useRef<HTMLDivElement | null>(null);
  const mobileMenuOpenTimerRef = useRef<number | null>(null);
  const mobileMenuCloseTimerRef = useRef<number | null>(null);
  const [isSurfaceControlsOpen, setIsSurfaceControlsOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isShellModeMenuOpen, setIsShellModeMenuOpen] = useState(false);
  const [isMobileQrDialogOpen, setIsMobileQrDialogOpen] = useState(false);
  const [isWindowMaximized, setIsWindowMaximized] = useState(false);
  const [draggedPanelId, setDraggedPanelId] = useState<string | null>(null);
  const [surfaceControlsMenuPlacement, setSurfaceControlsMenuPlacement] = useState({
    left: 8,
    top: 8,
    maxHeight: Math.max(220, window.innerHeight - 16),
  });
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
  const isFloatingDockWindow = windowMode === 'overlay' && dockPlacementMode === 'floating';
  const canDragWindow = isWindowedMode || isFloatingDockWindow;
  const windowedChromeTopInset = isWindowedMode && blurPlatform === 'windows' && !isWindowMaximized ? 10 : 0;
  const resolvedWindowedChromeTopInset =
    surfaceMode === 'content-only' ? 0 : windowedChromeTopInset;
  const showsWindowControls = surfaceMode !== 'content-only';
  const topBarBackdropFilter = resolveInnerSurfaceBlurFilter({
    enabled: blur && effectiveTopBarStyle === 'glass',
    blurPx: Math.min(blurStrength, 18),
    platform: blurPlatform,
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
  const spawnablePanelGroups = useMemo(
    () => groupPanelsForWorkbenchNavigation(
      panels.filter(panel => !pinnedPanelIds.includes(panel.id)),
    ),
    [panels, pinnedPanelIds],
  );
  const openPanelIdSet = useMemo(() => new Set(openPanelIds), [openPanelIds]);
  const enforcedOpenPanelIdSet = useMemo(
    () => new Set(layoutProfile.behavior.enforcedOpenPanelIds),
    [layoutProfile.behavior.enforcedOpenPanelIds],
  );
  const surfaceControlsMenuWidth = Math.max(320, Math.min(420, viewportSize.width - 24));
  const updateSurfaceControlsMenuPlacement = useCallback(() => {
    const anchor = menuRef.current?.getBoundingClientRect();
    if (!anchor) {
      return;
    }

    const viewportMargin = 8;
    const maxHeight = Math.max(220, viewportSize.height - viewportMargin * 2);
    const measuredHeight = Math.min(
      surfaceControlsPanelRef.current?.offsetHeight ?? maxHeight,
      maxHeight,
    );
    const maxLeft = Math.max(
      viewportMargin,
      viewportSize.width - surfaceControlsMenuWidth - viewportMargin,
    );
    const clamp = (value: number, min: number, max: number) => Math.min(
      Math.max(value, min),
      Math.max(min, max),
    );
    const preferredLeft = anchor.right - surfaceControlsMenuWidth;
    const preferredTop = isBottomBar
      ? anchor.top - measuredHeight - viewportMargin
      : anchor.bottom + viewportMargin;
    const nextPlacement = {
      left: clamp(preferredLeft, viewportMargin, maxLeft),
      top: clamp(
        preferredTop,
        viewportMargin,
        viewportSize.height - measuredHeight - viewportMargin,
      ),
      maxHeight,
    };

    setSurfaceControlsMenuPlacement(previous => (
      previous.left === nextPlacement.left &&
      previous.top === nextPlacement.top &&
      previous.maxHeight === nextPlacement.maxHeight
        ? previous
        : nextPlacement
    ));
  }, [
    isBottomBar,
    surfaceControlsMenuWidth,
    viewportSize.height,
    viewportSize.width,
  ]);
  const nextOverlayAnchor = overlayAnchor === 'top' ? 'bottom' : 'top';
  const allowedDockPlacements = dockAllowedPlacements.length > 0
    ? dockAllowedPlacements
    : (['top-edge', 'bottom-edge', 'floating'] as DockPlacementMode[]);
  const dockPlacementLabel = dockPlacementMode === 'floating'
    ? 'Floating'
    : dockPlacementMode === 'top-edge'
      ? 'Top Edge'
      : 'Bottom Edge';
  const layoutButtonTitle = isWindowedMode
    ? (layoutSourcePath
      ? `Cycle Layout (${layoutProfile.label})\n${layoutSourcePath}`
      : `Cycle Layout (${layoutProfile.label})`)
    : (layoutSourcePath
      ? `Cycle Layout (${layoutProfile.label})\n${layoutSourcePath}\nRight-click: dock overlay to the ${nextOverlayAnchor} edge`
      : `Cycle Layout (${layoutProfile.label})\nRight-click: dock overlay to the ${nextOverlayAnchor} edge`);
  const shouldShowLeadingWindowControls =
    showsWindowControls && isWindowedMode && blurPlatform === 'macos';
  const shouldShowTrailingWindowControls =
    showsWindowControls && isWindowedMode && blurPlatform !== 'macos';
  const showsTabStrip = runtimeUsesTabbedNavigation && topBarDefinition.navigationMode !== 'summary';
  const isMobileShareBusy = mobileSharePhase === 'starting' || mobileSharePhase === 'stopping';
  const isMobileShareActive = mobileSharePhase === 'running' && mobileShareSession != null;
  const activeShellFamily = getWorkbenchShellFamilyForLayoutProfile(layoutProfile);
  const activeShellFamilyLabel = activeShellFamily === 'ide' ? 'IDE' : 'Classic';
  const alternateShellFamilyLabel = activeShellFamily === 'ide' ? 'Classic' : 'IDE';
  const availableClassicLayoutProfiles = useMemo(
    () => availableLayoutProfiles.filter(profile => getWorkbenchShellFamilyForLayoutProfile(profile) === 'classic'),
    [availableLayoutProfiles],
  );
  const availableIdeLayoutProfiles = useMemo(
    () => availableLayoutProfiles.filter(profile => getWorkbenchShellFamilyForLayoutProfile(profile) === 'ide'),
    [availableLayoutProfiles],
  );

  const handleStartWindowDrag = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (
      !canDragWindow
      || topBarCustomizeActive
      || event.defaultPrevented
      || event.button !== 0
      || event.detail > 1
      || !isTauri()
      || isWindowChromeInteractiveTarget(event.target)
    ) {
      return;
    }

    event.preventDefault();
    getCurrentWindow().startDragging().catch(() => {});
  }, [canDragWindow, topBarCustomizeActive]);

  const handleCycleDockPlacement = useCallback(() => {
    if (windowMode !== 'overlay') {
      return;
    }
    const currentIndex = allowedDockPlacements.indexOf(dockPlacementMode);
    const nextPlacement = allowedDockPlacements[
      (currentIndex >= 0 ? currentIndex + 1 : 0) % allowedDockPlacements.length
    ] ?? 'bottom-edge';
    onSetDockPlacementMode(nextPlacement);
  }, [
    allowedDockPlacements,
    dockPlacementMode,
    onSetDockPlacementMode,
    windowMode,
  ]);

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

  const handleTopBarDoubleClick = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (
      !isWindowedMode
      || topBarCustomizeActive
      || event.defaultPrevented
      || isWindowChromeInteractiveTarget(event.target)
    ) {
      return;
    }

    event.preventDefault();
    void handleToggleMaximize();
  }, [handleToggleMaximize, isWindowedMode, topBarCustomizeActive]);

  useEffect(() => {
    if (!isSurfaceControlsOpen && !isMobileMenuOpen && !isShellModeMenuOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!menuRef.current?.contains(target)) {
        setIsSurfaceControlsOpen(false);
      }
      if (!mobileMenuRef.current?.contains(target)) {
        setIsMobileMenuOpen(false);
      }
      if (!shellModeMenuRef.current?.contains(target)) {
        setIsShellModeMenuOpen(false);
      }
    };

    window.addEventListener('pointerdown', handlePointerDown);
    return () => window.removeEventListener('pointerdown', handlePointerDown);
  }, [isSurfaceControlsOpen, isMobileMenuOpen, isShellModeMenuOpen]);

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

  useLayoutEffect(() => {
    if (!isSurfaceControlsOpen) {
      return;
    }

    updateSurfaceControlsMenuPlacement();
    const frame = window.requestAnimationFrame(updateSurfaceControlsMenuPlacement);
    const handleViewportChange = () => updateSurfaceControlsMenuPlacement();
    window.addEventListener('resize', handleViewportChange);
    window.addEventListener('scroll', handleViewportChange, true);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', handleViewportChange);
      window.removeEventListener('scroll', handleViewportChange, true);
    };
  }, [isSurfaceControlsOpen, updateSurfaceControlsMenuPlacement]);

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
    const stopResizeListener = bindDeferredUnlisten(currentWindow.onResized(() => {
      void sync();
    }));

    return () => {
      cancelled = true;
      stopResizeListener();
    };
  }, [isWindowedMode]);

  const surfaceControlRows = [
    {
      id: 'appZoom',
      label: 'Window Zoom',
      value: clampOverlayVisualControlValue('zoom', appZoom),
      valueLabel: formatOverlayVisualControlValue('zoom', appZoom),
      min: overlayVisualControls.zoom.min,
      max: overlayVisualControls.zoom.max,
      step: overlayVisualControls.zoom.step,
      onChange: (value: number) => onUpdateAppearanceVisuals({
        appZoom: clampOverlayVisualControlValue('zoom', value),
      }),
    },
    {
      id: 'panelTransparency',
      label: 'Panel Transparency',
      value: clampOverlayVisualControlValue('panelTransparency', panelTransparency),
      valueLabel: formatOverlayVisualControlValue('panelTransparency', panelTransparency),
      min: overlayVisualControls.panelTransparency.min,
      max: overlayVisualControls.panelTransparency.max,
      step: overlayVisualControls.panelTransparency.step,
      onChange: (value: number) => onUpdateAppearanceVisuals({
        panelTransparency: clampOverlayVisualControlValue('panelTransparency', value),
      }),
    },
    {
      id: 'appOpacity',
      label: 'Window Opacity',
      value: clampOverlayVisualControlValue('opacity', appOpacity),
      valueLabel: formatOverlayVisualControlValue('opacity', appOpacity),
      min: overlayVisualControls.opacity.min,
      max: overlayVisualControls.opacity.max,
      step: overlayVisualControls.opacity.step,
      onChange: (value: number) => onUpdateAppearanceVisuals({
        appOpacity: clampOverlayVisualControlValue('opacity', value),
      }),
    },
  ] as const;

  const dockSizePresets = [
    { id: 'compact', label: 'Compact', edgeSize: 360, edgeWidth: 960 },
    { id: 'wide', label: 'Wide', edgeSize: 500, edgeWidth: 1280 },
    { id: 'deep', label: 'Deep', edgeSize: 680, edgeWidth: 1440 },
  ] as const;
  const dockTargetTerminalGrid = {
    rows: normalizeDockTerminalRows(dockDefaultTerminalRows, dockTerminalGrid.rows),
    columns: normalizeDockTerminalColumns(dockDefaultTerminalColumns, dockTerminalGrid.columns),
  };
  const updateDockTerminalGridTarget = (updates: Partial<DockTerminalGrid>) => {
    const nextGrid = {
      rows: normalizeDockTerminalRows(updates.rows, dockTargetTerminalGrid.rows),
      columns: normalizeDockTerminalColumns(updates.columns, dockTargetTerminalGrid.columns),
    };
    const nextSize = estimateDockSizeFromTerminalGrid({
      ...nextGrid,
      terminalFontSize: dockTerminalFontSize,
      dockTopBarHeight,
    });

    onUpdateDockSettings({
      ...nextSize,
      defaultTerminalRows: nextGrid.rows,
      defaultTerminalColumns: nextGrid.columns,
    });
  };
  const spawnablePanelCount = spawnablePanelGroups.reduce(
    (total, group) => total + group.panels.length,
    0,
  );
  const panelSpawnMenu = spawnablePanelGroups.length > 0 ? (
    <div
      data-workbench-panel-spawner
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        border: '1px solid var(--overlay-workbench-chrome-border)',
        borderRadius: workbench.metrics.controlRadius,
        background: 'rgba(255,255,255,0.025)',
        padding: 8,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <span style={{ color: text, fontSize: 11, fontWeight: 800 }}>Spawn Panels</span>
        <span
          style={{
            color: muted,
            fontSize: 9,
            fontWeight: 800,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
          }}
        >
          {spawnablePanelCount} Ready
        </span>
      </div>
      <div style={{ color: muted, fontSize: 10, lineHeight: 1.35 }}>
        Open built-in tools and enabled plugin panels without leaving the top bar.
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {spawnablePanelGroups.map(group => (
          <div key={`panel-spawn-group:${group.id}`} style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <div
              style={{
                color: muted,
                fontSize: 9,
                fontWeight: 800,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                padding: '0 2px',
              }}
            >
              {group.label}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {group.panels.map(panel => {
                const isOpen = openPanelIdSet.has(panel.id);
                const isActive = activePanelId === panel.id;
                const isCloseable = isOpen
                  && panel.id !== 'explorer'
                  && !pinnedPanelIds.includes(panel.id)
                  && !enforcedOpenPanelIdSet.has(panel.id);
                const statusLabel = isActive ? 'Active' : isOpen ? 'Open' : 'Spawn';
                const panelKindLabel = panel.kind === 'folder-plugin' ? 'Plugin' : 'Built-in';
                return (
                  <div
                    key={`panel-spawn:${panel.id}`}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: isCloseable ? 'minmax(0, 1fr) auto' : 'minmax(0, 1fr)',
                      gap: 5,
                    }}
                  >
                    <button
                      type="button"
                      aria-label={`${isOpen ? 'Focus' : 'Open'} ${panel.label} panel`}
                      onClick={() => {
                        if (isOpen) {
                          onPanelSelect(panel.id);
                          return;
                        }

                        onPanelToggle(panel.id);
                      }}
                      style={{
                        minWidth: 0,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '7px 8px',
                        borderRadius: workbench.metrics.controlRadius,
                        border: `1px solid ${isActive ? 'var(--overlay-workbench-chrome-button-active-border)' : 'var(--overlay-workbench-chrome-border)'}`,
                        background: isActive
                          ? 'var(--overlay-workbench-chrome-tab-active-bg)'
                          : isOpen
                            ? 'var(--overlay-workbench-chrome-tab-bg)'
                            : 'var(--overlay-workbench-chrome-button-bg)',
                        color: isActive ? text : muted,
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                    >
                      <span style={{ display: 'flex', color: isActive ? accent : muted, flexShrink: 0 }}>
                        {panel.icon}
                      </span>
                      <span style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
                        <span
                          style={{
                            color: isActive ? text : 'var(--overlay-text-primary)',
                            fontSize: 11,
                            fontWeight: 800,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {panel.label}
                        </span>
                        <span
                          style={{
                            color: muted,
                            fontSize: 9,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {panel.description}
                        </span>
                      </span>
                      <span
                        style={{
                          flexShrink: 0,
                          color: isActive ? accent : muted,
                          fontSize: 8,
                          fontWeight: 900,
                          letterSpacing: '0.08em',
                          textTransform: 'uppercase',
                          padding: '3px 5px',
                          borderRadius: 999,
                          border: `1px solid ${isActive ? 'var(--overlay-workbench-chrome-button-active-border)' : 'var(--overlay-workbench-chrome-border)'}`,
                          background: isActive
                            ? 'var(--overlay-workbench-chrome-button-active-bg)'
                            : 'rgba(255,255,255,0.035)',
                        }}
                      >
                        {statusLabel}
                      </span>
                      <span
                        style={{
                          flexShrink: 0,
                          color: panel.kind === 'folder-plugin' ? accent : muted,
                          fontSize: 8,
                          fontWeight: 800,
                          letterSpacing: '0.08em',
                          textTransform: 'uppercase',
                        }}
                      >
                        {panelKindLabel}
                      </span>
                    </button>
                    {isCloseable ? (
                      <button
                        type="button"
                        aria-label={`Close ${panel.label} panel`}
                        title={`Close ${panel.label}`}
                        onClick={() => onPanelClose(panel.id)}
                        style={{
                          width: 30,
                          borderRadius: workbench.metrics.controlRadius,
                          border: '1px solid var(--overlay-workbench-chrome-border)',
                          background: 'var(--overlay-workbench-chrome-button-bg)',
                          color: muted,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <X size={11} />
                      </button>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  ) : null;

  const surfaceControlsMenu = (
    <div
      ref={surfaceControlsPanelRef}
      className="overlay-native-scrollbar"
      style={{
        position: 'fixed',
        top: surfaceControlsMenuPlacement.top,
        left: surfaceControlsMenuPlacement.left,
        width: surfaceControlsMenuWidth,
        maxWidth: 'calc(100vw - 16px)',
        maxHeight: surfaceControlsMenuPlacement.maxHeight,
        background: 'var(--overlay-workbench-chrome-menu-bg)',
        border: '1px solid var(--overlay-workbench-chrome-border)',
        borderRadius: workbench.metrics.panelRadius,
        boxShadow: 'var(--overlay-workbench-shell-shadow)',
        padding: 8,
        zIndex: 50,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        overflowX: 'hidden',
        overflowY: 'auto',
        backdropFilter: topBarBackdropFilter,
        WebkitBackdropFilter: topBarBackdropFilter,
      }}
      data-overlay-surface-controls-menu
    >
      <div
        style={{
          padding: '4px 4px 8px',
          fontSize: 10,
          color: muted,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          fontWeight: 700,
          borderBottom: '1px solid var(--overlay-workbench-chrome-border)',
        }}
      >
        <div>Surface Controls</div>
        <div
          style={{
            marginTop: 4,
            fontSize: 9,
            letterSpacing: '0.04em',
            textTransform: 'none',
            fontWeight: 500,
          }}
        >
          Zoom and transparency without native blur.
        </div>
      </div>

      {panelSpawnMenu}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {surfaceControlRows.map(control => (
          <label key={control.id} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <span style={{ color: text, fontSize: 11, fontWeight: 700 }}>{control.label}</span>
              <span style={{ color: muted, fontSize: 10, fontFamily: monoFont }}>{control.valueLabel}</span>
            </span>
            <input
              aria-label={control.label}
              type="range"
              min={control.min}
              max={control.max}
              step={control.step}
              value={control.value}
              onChange={event => control.onChange(Number(event.currentTarget.value))}
              style={{
                width: '100%',
                accentColor: accent,
              }}
            />
          </label>
        ))}
      </div>

      {windowMode === 'overlay' ? (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            borderTop: '1px solid var(--overlay-workbench-chrome-border)',
            paddingTop: 10,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <span style={{ color: text, fontSize: 11, fontWeight: 700 }}>Dock Placement</span>
            <span style={{ color: muted, fontSize: 10, fontFamily: monoFont }}>{dockPlacementLabel}</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${allowedDockPlacements.length}, minmax(0, 1fr))`, gap: 6 }}>
            {allowedDockPlacements.map(placement => {
              const active = placement === dockPlacementMode;
              const label = placement === 'floating'
                ? 'Float'
                : placement === 'top-edge'
                  ? 'Top'
                  : 'Bottom';
              return (
                <button
                  key={placement}
                  type="button"
                  onClick={() => onSetDockPlacementMode(placement)}
                  style={{
                    height: 26,
                    borderRadius: workbench.metrics.controlRadius,
                    border: `1px solid ${active ? 'var(--overlay-workbench-chrome-button-active-border)' : 'var(--overlay-workbench-chrome-border)'}`,
                    background: active
                      ? 'var(--overlay-workbench-chrome-button-active-bg)'
                      : 'var(--overlay-workbench-chrome-button-bg)',
                    color: active ? text : muted,
                    fontSize: 10,
                    fontWeight: 800,
                    letterSpacing: 'var(--overlay-workbench-label-spacing)',
                    textTransform: 'uppercase',
                    cursor: 'pointer',
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 6 }}>
            {dockSizePresets.map(preset => {
              const presetGrid = estimateDockTerminalGridFromSize({
                edgeSize: preset.edgeSize,
                edgeWidth: preset.edgeWidth,
                terminalFontSize: dockTerminalFontSize,
                dockTopBarHeight,
              });
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => onUpdateDockSettings({
                    edgeSize: preset.edgeSize,
                    edgeWidth: preset.edgeWidth,
                    defaultTerminalRows: presetGrid.rows,
                    defaultTerminalColumns: presetGrid.columns,
                  })}
                  style={{
                    height: 24,
                    borderRadius: workbench.metrics.controlRadius,
                    border: '1px solid var(--overlay-workbench-chrome-border)',
                    background: 'var(--overlay-workbench-chrome-button-bg)',
                    color: muted,
                    fontSize: 9,
                    fontWeight: 800,
                    letterSpacing: 'var(--overlay-workbench-label-spacing)',
                    textTransform: 'uppercase',
                    cursor: 'pointer',
                  }}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              border: '1px solid var(--overlay-workbench-chrome-border)',
              borderRadius: workbench.metrics.controlRadius,
              background: 'rgba(255,255,255,0.03)',
              padding: 8,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <span style={{ color: text, fontSize: 11, fontWeight: 700 }}>Terminal Grid</span>
              <span style={{ color: muted, fontSize: 10, fontFamily: monoFont }}>
                {formatDockTerminalGrid(dockTerminalGrid)} live
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <span style={{ color: muted, fontSize: 9, fontWeight: 800, textTransform: 'uppercase' }}>Rows</span>
                <input
                  aria-label="Dock Terminal Rows"
                  type="number"
                  min={dockTerminalGridGeometry.minRows}
                  max={dockTerminalGridGeometry.maxRows}
                  step={1}
                  value={dockTargetTerminalGrid.rows}
                  onChange={event => updateDockTerminalGridTarget({ rows: Number(event.currentTarget.value) })}
                  style={{
                    minWidth: 0,
                    width: '100%',
                    height: 26,
                    borderRadius: workbench.metrics.controlRadius,
                    border: '1px solid var(--overlay-workbench-chrome-border)',
                    background: 'var(--overlay-workbench-chrome-button-bg)',
                    color: text,
                    padding: '0 8px',
                    fontFamily: monoFont,
                    fontSize: 11,
                    outline: 'none',
                  }}
                />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <span style={{ color: muted, fontSize: 9, fontWeight: 800, textTransform: 'uppercase' }}>Columns</span>
                <input
                  aria-label="Dock Terminal Columns"
                  type="number"
                  min={dockTerminalGridGeometry.minColumns}
                  max={dockTerminalGridGeometry.maxColumns}
                  step={1}
                  value={dockTargetTerminalGrid.columns}
                  onChange={event => updateDockTerminalGridTarget({ columns: Number(event.currentTarget.value) })}
                  style={{
                    minWidth: 0,
                    width: '100%',
                    height: 26,
                    borderRadius: workbench.metrics.controlRadius,
                    border: '1px solid var(--overlay-workbench-chrome-border)',
                    background: 'var(--overlay-workbench-chrome-button-bg)',
                    color: text,
                    padding: '0 8px',
                    fontFamily: monoFont,
                    fontSize: 11,
                    outline: 'none',
                  }}
                />
              </label>
            </div>
          </div>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <span style={{ color: text, fontSize: 11, fontWeight: 700 }}>Dock Height</span>
              <span style={{ color: muted, fontSize: 10, fontFamily: monoFont }}>{Math.round(dockEdgeSize)}px</span>
            </span>
            <input
              aria-label="Dock Height"
              type="range"
              min={overlayWindowGeometry.minHeight}
              max={900}
              step={10}
              value={dockEdgeSize}
              onChange={event => {
                const nextEdgeSize = Number(event.currentTarget.value);
                const nextGrid = estimateDockTerminalGridFromSize({
                  edgeSize: nextEdgeSize,
                  edgeWidth: dockEdgeWidth,
                  terminalFontSize: dockTerminalFontSize,
                  dockTopBarHeight,
                });
                onUpdateDockSettings({
                  edgeSize: nextEdgeSize,
                  defaultTerminalRows: nextGrid.rows,
                  defaultTerminalColumns: nextGrid.columns,
                });
              }}
              style={{ width: '100%', accentColor: accent }}
            />
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <span style={{ color: text, fontSize: 11, fontWeight: 700 }}>Dock Width</span>
              <span style={{ color: muted, fontSize: 10, fontFamily: monoFont }}>{Math.round(dockEdgeWidth)}px</span>
            </span>
            <input
              aria-label="Dock Width"
              type="range"
              min={overlayWindowGeometry.minWidth}
              max={1800}
              step={10}
              value={dockEdgeWidth}
              onChange={event => {
                const nextEdgeWidth = Number(event.currentTarget.value);
                const nextGrid = estimateDockTerminalGridFromSize({
                  edgeSize: dockEdgeSize,
                  edgeWidth: nextEdgeWidth,
                  terminalFontSize: dockTerminalFontSize,
                  dockTopBarHeight,
                });
                onUpdateDockSettings({
                  edgeWidth: nextEdgeWidth,
                  defaultTerminalRows: nextGrid.rows,
                  defaultTerminalColumns: nextGrid.columns,
                });
              }}
              style={{ width: '100%', accentColor: accent }}
            />
          </label>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            <button
              type="button"
              onClick={() => onUpdateDockSettings({ previewEnabled: !dockPreviewEnabled })}
              style={{
                height: 26,
                borderRadius: workbench.metrics.controlRadius,
                border: `1px solid ${dockPreviewEnabled ? 'var(--overlay-workbench-chrome-button-active-border)' : 'var(--overlay-workbench-chrome-border)'}`,
                background: dockPreviewEnabled
                  ? 'var(--overlay-workbench-chrome-button-active-bg)'
                  : 'var(--overlay-workbench-chrome-button-bg)',
                color: dockPreviewEnabled ? text : muted,
                fontSize: 10,
                fontWeight: 800,
                letterSpacing: 'var(--overlay-workbench-label-spacing)',
                textTransform: 'uppercase',
                cursor: 'pointer',
              }}
            >
              Preview {dockPreviewEnabled ? 'On' : 'Off'}
            </button>
            <button
              type="button"
              onClick={() => onUpdateDockSettings({
                previewSplitMode: dockPreviewSplitMode === 'pane' ? 'inline' : 'pane',
              })}
              style={{
                height: 26,
                borderRadius: workbench.metrics.controlRadius,
                border: '1px solid var(--overlay-workbench-chrome-border)',
                background: 'var(--overlay-workbench-chrome-button-bg)',
                color: muted,
                fontSize: 10,
                fontWeight: 800,
                letterSpacing: 'var(--overlay-workbench-label-spacing)',
                textTransform: 'uppercase',
                cursor: 'pointer',
              }}
            >
              {dockPreviewSplitMode === 'pane' ? 'Pane' : 'Inline'}
            </button>
          </div>
        </div>
      ) : null}

      <div style={{ display: 'flex', gap: 8 }}>
        <button
          type="button"
          onClick={() => onUpdateAppearanceVisuals({
            appOpacity: overlayVisualControls.opacity.defaultValue,
            panelTransparency: overlayVisualControls.panelTransparency.defaultValue,
            appZoom: overlayVisualControls.zoom.defaultValue,
          })}
          style={{
            height: 24,
            padding: '0 9px',
            borderRadius: workbench.metrics.controlRadius,
            border: '1px solid var(--overlay-workbench-chrome-border)',
            background: 'var(--overlay-workbench-chrome-button-bg)',
            color: muted,
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: 'var(--overlay-workbench-label-spacing)',
            textTransform: 'uppercase',
            cursor: 'pointer',
          }}
        >
          Reset
        </button>
        <button
          type="button"
          onClick={onOpenDockSettings}
          style={{
            height: 24,
            padding: '0 9px',
            borderRadius: workbench.metrics.controlRadius,
            border: '1px solid var(--overlay-workbench-chrome-border)',
            background: 'var(--overlay-workbench-chrome-button-bg)',
            color: muted,
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: 'var(--overlay-workbench-label-spacing)',
            textTransform: 'uppercase',
            cursor: 'pointer',
          }}
        >
          Dock Settings
        </button>
        <button
          type="button"
          onClick={() => setIsSurfaceControlsOpen(false)}
          style={{
            height: 24,
            padding: '0 9px',
            borderRadius: workbench.metrics.controlRadius,
            border: '1px solid var(--overlay-workbench-chrome-button-active-border)',
            background: 'var(--overlay-workbench-chrome-button-active-bg)',
            color: text,
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: 'var(--overlay-workbench-label-spacing)',
            textTransform: 'uppercase',
            cursor: 'pointer',
            marginLeft: 'auto',
          }}
        >
          Done
        </button>
      </div>
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
        ariaLabel={options.ariaLabel}
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
      case 'shell-mode':
        return (
          <div
            key={controlId}
            ref={shellModeMenuRef}
            style={{ position: 'relative', display: 'flex', alignItems: 'center', flexShrink: 0 }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              {renderCompactButton(
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    whiteSpace: 'nowrap',
                    fontSize: 'var(--overlay-workbench-chrome-meta-size)',
                    fontWeight: 800,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                  }}
                >
                  <span
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: '999px',
                      background: accent,
                      boxShadow: `0 0 0 3px ${accent}1c`,
                      flexShrink: 0,
                    }}
                  />
                  <span>{activeShellFamilyLabel}</span>
                </span>,
                {
                  key: `${controlId}-toggle`,
                  active: activeShellFamily === 'ide',
                  title: `Switch to ${alternateShellFamilyLabel} shell`,
                  motionStepIndex,
                  onClick: () => {
                    setIsShellModeMenuOpen(false);
                    onToggleShellMode();
                  },
                  style: {
                    minWidth: 0,
                    width: 'auto',
                    padding: '0 10px',
                    borderTopRightRadius: 7,
                    borderBottomRightRadius: 7,
                  },
                },
              )}
              {renderCompactButton(
                <ChevronDown size={10} />,
                {
                  key: `${controlId}-menu`,
                  active: isShellModeMenuOpen,
                  title: 'Choose shell mode and layout profile',
                  motionStepIndex: motionStepIndex + 1,
                  onClick: (event) => {
                    event.stopPropagation();
                    setIsShellModeMenuOpen(open => !open);
                  },
                  style: {
                    minWidth: 22,
                    width: 22,
                    padding: 0,
                    borderTopLeftRadius: 7,
                    borderBottomLeftRadius: 7,
                  },
                },
              )}
            </div>
            {isShellModeMenuOpen ? (
              <div
                style={{
                  position: 'absolute',
                  top: isBottomBar ? 'auto' : 'calc(100% + 8px)',
                  bottom: isBottomBar ? 'calc(100% + 8px)' : 'auto',
                  right: 0,
                  width: Math.min(360, Math.max(280, viewportSize.width - 24)),
                  maxWidth: 'calc(100vw - 16px)',
                  maxHeight: Math.max(220, Math.min(440, viewportSize.height - 92)),
                  background: 'var(--overlay-workbench-chrome-menu-bg)',
                  border: '1px solid var(--overlay-workbench-chrome-border)',
                  borderRadius: workbench.metrics.panelRadius,
                  boxShadow: 'var(--overlay-workbench-shell-shadow)',
                  padding: 8,
                  zIndex: 55,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  overflow: 'hidden',
                  backdropFilter: topBarBackdropFilter,
                  WebkitBackdropFilter: topBarBackdropFilter,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 10,
                    padding: '4px 4px 8px',
                    borderBottom: '1px solid var(--overlay-workbench-chrome-border)',
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 800,
                        letterSpacing: '0.11em',
                        textTransform: 'uppercase',
                        color: muted,
                      }}
                    >
                      Shell Mode
                    </span>
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: 700,
                        color: text,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {layoutProfile.label}
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      setIsShellModeMenuOpen(false);
                      onToggleShellMode();
                    }}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '6px 10px',
                      borderRadius: workbench.metrics.controlRadius,
                      border: `1px solid ${accent}55`,
                      background: `${accent}12`,
                      color: text,
                      cursor: 'pointer',
                      fontSize: 10,
                      fontWeight: 800,
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    <span>Switch To {alternateShellFamilyLabel}</span>
                  </button>
                </div>
                <OverlayScrollArea
                  style={{ flex: 1, minHeight: 0 }}
                  viewportStyle={{ paddingRight: 2 }}
                  contentStyle={{ display: 'flex', flexDirection: 'column', gap: 10, paddingBottom: 4 }}
                >
                  {[
                    {
                      id: 'classic',
                      label: 'Classic Shell',
                      helper: 'Current dock-and-panel workflow.',
                      profiles: availableClassicLayoutProfiles,
                    },
                    {
                      id: 'ide',
                      label: 'IDE Shell',
                      helper: 'Dock graph with rail, stacks, and floating panes.',
                      profiles: availableIdeLayoutProfiles,
                    },
                  ].map(group => (
                    <div key={group.id} style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                      <div
                        style={{
                          padding: '0 4px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 2,
                        }}
                      >
                        <span
                          style={{
                            fontSize: 9,
                            color: muted,
                            textTransform: 'uppercase',
                            letterSpacing: '0.1em',
                            fontWeight: 800,
                          }}
                        >
                          {group.label}
                        </span>
                        <span style={{ fontSize: 10, color: muted, lineHeight: 1.35 }}>
                          {group.helper}
                        </span>
                      </div>
                      {group.profiles.map(profile => {
                        const isActiveProfile = profile.id === layoutProfile.id;
                        const isActiveFamilyProfile =
                          getWorkbenchShellFamilyForLayoutProfile(profile) === activeShellFamily;
                        return (
                          <button
                            key={profile.id}
                            onClick={() => {
                              setIsShellModeMenuOpen(false);
                              onSelectLayoutProfile(profile.id);
                            }}
                            style={{
                              width: '100%',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 10,
                              padding: '9px 10px',
                              borderRadius: 10,
                              border: `1px solid ${isActiveProfile ? 'var(--overlay-workbench-chrome-button-active-border)' : 'var(--overlay-workbench-chrome-border)'}`,
                              background: isActiveProfile
                                ? 'var(--overlay-workbench-chrome-tab-active-bg)'
                                : isActiveFamilyProfile
                                  ? 'var(--overlay-workbench-chrome-tab-bg)'
                                  : 'var(--overlay-workbench-chrome-button-bg)',
                              color: text,
                              cursor: 'pointer',
                              textAlign: 'left',
                            }}
                          >
                            <span
                              style={{
                                width: 14,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: isActiveProfile ? accent : 'transparent',
                                flexShrink: 0,
                              }}
                            >
                              <Check size={12} />
                            </span>
                            <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                              <span
                                style={{
                                  fontSize: 12,
                                  fontWeight: 700,
                                  color: isActiveProfile ? accent : text,
                                }}
                              >
                                {profile.label}
                              </span>
                              <span
                                style={{
                                  fontSize: 10,
                                  color: muted,
                                  lineHeight: 1.35,
                                }}
                              >
                                {profile.description}
                              </span>
                            </span>
                            <span
                              style={{
                                fontSize: 9,
                                letterSpacing: '0.07em',
                                textTransform: 'uppercase',
                                color: isActiveProfile ? accent : muted,
                                padding: '3px 6px',
                                borderRadius: workbench.metrics.controlRadius,
                                border: `1px solid ${isActiveProfile ? 'var(--overlay-workbench-chrome-button-active-border)' : 'var(--overlay-workbench-chrome-border)'}`,
                                background: isActiveProfile
                                  ? 'var(--overlay-workbench-chrome-button-active-bg)'
                                  : 'var(--overlay-workbench-chrome-button-bg)',
                                flexShrink: 0,
                              }}
                            >
                              {isActiveProfile ? 'Active' : 'Open'}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </OverlayScrollArea>
              </div>
            ) : null}
          </div>
        );
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
              setIsSurfaceControlsOpen(false);
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
      case 'dock-placement':
        if (windowMode !== 'overlay') {
          return null;
        }

        const dockPlacementMotion = bindTopBarButtonMotion(
          dockPlacementMode === 'floating',
          motionStepIndex,
        );
        return (
          <button
            key={controlId}
            onClick={handleCycleDockPlacement}
            title={`Dock placement: ${dockPlacementLabel}`}
            {...dockPlacementMotion.motionDataAttributes}
            onPointerEnter={dockPlacementMotion.onPointerEnter}
            onPointerLeave={dockPlacementMotion.onPointerLeave}
            onPointerDown={dockPlacementMotion.onPointerDown}
            onPointerUp={dockPlacementMotion.onPointerUp}
            onPointerCancel={dockPlacementMotion.onPointerCancel}
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
              ...dockPlacementMotion.motionStyle,
            }}
          >
            <span>{dockPlacementLabel}</span>
          </button>
        );
      case 'overlay-anchor':
        if (windowMode !== 'overlay') {
          return null;
        }

        return renderCompactControl('dock-placement', motionStepIndex);
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
      case 'surface-controls':
      case 'panel-menu':
        if (!showPrimaryLauncherChrome || !layoutProfile.chrome.showPanelMenu) {
          return null;
        }

        return (
          <div key={controlId} ref={menuRef} style={{ position: 'relative', flexShrink: 0 }}>
            {renderCompactButton(
              <Settings2 size={11} style={{ color: isSurfaceControlsOpen ? accent : muted }} />,
              {
                key: `${controlId}-button`,
                active: isSurfaceControlsOpen,
                motionStepIndex,
                title: 'Surface Controls',
                ariaLabel: 'Surface Controls',
                onClick: () => setIsSurfaceControlsOpen(open => !open),
              },
            )}
            {isSurfaceControlsOpen ? surfaceControlsMenu : null}
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
    availableClassicLayoutProfiles,
    availableIdeLayoutProfiles,
    availableLayoutProfiles,
    activeShellFamily,
    activeShellFamilyLabel,
    alternateShellFamilyLabel,
    dockPlacementLabel,
    dockPlacementMode,
    borderColor,
    clearMobileMenuTimers,
    commandPaletteShortcutLabel,
    handleShowMobileQrDialog,
    handleStartMobileShareFromMenu,
    handleStopMobileShareFromMenu,
    handleOpenMobileSettingsFromChrome,
    handleCycleDockPlacement,
    isMobileMenuOpen,
    isMobileShareActive,
    isMobileShareBusy,
    isSurfaceControlsOpen,
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
    onSelectLayoutProfile,
    onSetMobileShareRemoteAccessMode,
    onSetWindowMode,
    onToggleShellMode,
    onToggleMobileShare,
    onToggleOverlayAnchor,
    onToggleZenFocusMode,
    overlayAnchor,
    scheduleMobileMenuClose,
    scheduleMobileMenuOpen,
    showPrimaryLauncherChrome,
    text,
    shellModeMenuRef,
    toggleShortcutLabel,
    surfaceControlsMenu,
    topBarBackdropFilter,
    windowMode,
    workbench.metrics.controlRadius,
    workbench.metrics.panelRadius,
    zenFocusMode,
    zenFocusShortcutLabel,
    viewportSize.height,
    viewportSize.width,
    isShellModeMenuOpen,
    layoutProfile.description,
    layoutProfile.id,
    layoutProfile.label,
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
              borderTop: 'none',
              borderRight: `1px solid ${borderColor}`,
              borderBottom: 'none',
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
              borderTop: 'none',
              borderRight: `1px solid ${borderColor}`,
              borderBottom: 'none',
              borderLeft: 'none',
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
  const topBarRestoreShelf = topBarCustomizeActive && topBarHiddenControls.length > 0 ? (
    <div
      style={{
        position: 'absolute',
        left: 12,
        right: 12,
        ...(isBottomBar ? { top: 6 } : { bottom: 6 }),
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 8px',
        borderRadius: workbench.metrics.panelRadius,
        border: '1px solid var(--overlay-workbench-chrome-border)',
        background: 'color-mix(in srgb, var(--overlay-workbench-chrome-bg) 86%, black 14%)',
        boxShadow: 'var(--overlay-workbench-shell-shadow)',
        zIndex: 6,
        pointerEvents: 'auto',
        maxWidth: 'calc(100% - 24px)',
        overflow: 'hidden',
        backdropFilter: topBarBackdropFilter,
        WebkitBackdropFilter: topBarBackdropFilter,
      }}
    >
      <span
        style={{
          fontSize: 9,
          fontWeight: 800,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: muted,
          flexShrink: 0,
        }}
      >
        Restore
      </span>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          flexWrap: 'wrap',
          minWidth: 0,
        }}
      >
        {topBarHiddenControls.map((controlId, index) => (
          <CompactChromeButton
            key={`restore-top-bar-control:${controlId}`}
            title={`Restore ${getTopBarControlLabel(controlId)}`}
            motionBinding={bindTopBarButtonMotion(false, 200 + index)}
            text={text}
            muted={muted}
            accent={accent}
            controlRadius={workbench.metrics.controlRadius}
            onClick={() => restoreTopBarControl(controlId)}
            style={{
              height: 20,
              minWidth: 0,
              width: 'auto',
              padding: '0 8px',
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
            }}
          >
            <span style={{ whiteSpace: 'nowrap' }}>
              {getTopBarControlLabel(controlId)}
            </span>
          </CompactChromeButton>
        ))}
      </div>
    </div>
  ) : null;

  const leadingControls = topBarDefinition.leadingControls
    .map((controlId, index) => renderCompactControl(controlId, index))
    .filter((entry): entry is ReactNode => entry != null);
  const navigationShortcuts = topBarDefinition.navigationShortcuts
    .map((controlId, index) => renderNavigationShortcutControl(controlId, index))
    .filter((entry): entry is ReactNode => entry != null);
  const shellModeControls = topBarDefinition.trailingControls
    .filter(controlId => controlId === 'shell-mode')
    .map((controlId, index) => renderCompactControl(controlId, 300 + index))
    .filter((entry): entry is ReactNode => entry != null);
  const trailingControls = topBarDefinition.trailingControls
    .filter(controlId => controlId !== 'shell-mode')
    .map((controlId, index) => renderCompactControl(controlId, 320 + index))
    .filter((entry): entry is ReactNode => entry != null);
  const kainTopBarAppletStrip = (
    <KainSemanticAppletStrip
      scaffold={kainUiScaffold}
      latticeCatalog={kainLatticeCatalog}
    />
  );

  const centerContent = showsTabStrip ? (
    <OverlayScrollArea
      direction="horizontal"
      style={{
        display: 'flex',
        alignItems: 'stretch',
        flex: 1,
        minWidth: 0,
        background: effectiveTabStyle === 'windows' ? 'transparent' : 'rgba(0,0,0,0.08)',
      }}
      contentStyle={{ display: 'flex', alignItems: 'stretch', minWidth: 'max-content' }}
    >
      {tabPanels.map((panel, index) => {
        const isActive = panel.id === activePanelId;
        const isDragged = draggedPanelId === panel.id;
        const isPersistentTab = layoutProfile.behavior.enforcedOpenPanelIds.includes(panel.id);
        const panelTabMotion = bindPanelTabMotion(isActive, index);
        const usesWindowsTabChrome = effectiveTabStyle === 'windows';
        return (
          <button
            key={panel.id}
            draggable
            onClick={() => onPanelSelect(panel.id)}
            onDragStart={event => {
              setDraggedPanelId(panel.id);
              event.dataTransfer.effectAllowed = 'move';
              event.dataTransfer.setData('text/plain', panel.id);
            }}
            onDragEnd={() => setDraggedPanelId(null)}
            onDragOver={event => {
              event.preventDefault();
              event.dataTransfer.dropEffect = 'move';
            }}
            onDrop={event => {
              event.preventDefault();
              const droppedPanelId = event.dataTransfer.getData('text/plain') || draggedPanelId;
              if (droppedPanelId && droppedPanelId !== panel.id) {
                onPanelReorder(droppedPanelId, panel.id);
              }
              setDraggedPanelId(null);
            }}
            data-workbench-top-bar-tab={panel.id}
            {...panelTabMotion.motionDataAttributes}
            onPointerEnter={panelTabMotion.onPointerEnter}
            onPointerLeave={panelTabMotion.onPointerLeave}
            onPointerDown={panelTabMotion.onPointerDown}
            onPointerUp={panelTabMotion.onPointerUp}
            onPointerCancel={panelTabMotion.onPointerCancel}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: effectiveTabShowIcons ? 6 : 0,
              padding: '0 9px',
              cursor: 'pointer',
              background: isActive
                ? usesWindowsTabChrome
                  ? 'var(--overlay-workbench-chrome-tab-active-bg)'
                  : 'var(--overlay-workbench-chrome-tab-active-bg)'
                : effectiveTabStyle === 'segment'
                  ? 'var(--overlay-workbench-chrome-tab-bg)'
                  : usesWindowsTabChrome
                    ? 'var(--overlay-workbench-chrome-tab-bg)'
                    : 'transparent',
              borderBottom: usesWindowsTabChrome
                ? `1px solid ${isActive ? 'var(--overlay-workbench-chrome-bg)' : borderColor}`
                : isBottomBar ? 'none' : `2px solid ${isActive ? accent : 'transparent'}`,
              borderTop: usesWindowsTabChrome
                ? `1px solid ${borderColor}`
                : isBottomBar ? `2px solid ${isActive ? accent : 'transparent'}` : 'none',
              borderRight: `1px solid ${borderColor}`,
              borderLeft: usesWindowsTabChrome
                ? `1px solid ${borderColor}`
                : 'none',
              color: isActive ? text : muted,
              fontSize: 'var(--overlay-workbench-tab-label-size)',
              fontWeight: isActive ? 700 : 500,
              fontFamily: uiFont,
              transition: 'background 0.15s, color 0.15s, border-color 0.15s, opacity 0.15s',
              flexShrink: 0,
              userSelect: 'none',
              opacity: isDragged ? 0.45 : 1,
              height: '100%',
              borderRadius: effectiveTabStyle === 'capsule'
                ? workbench.metrics.controlRadius
                : usesWindowsTabChrome
                  ? isBottomBar
                    ? '0 0 10px 10px'
                    : '10px 10px 0 0'
                  : 0,
              margin: effectiveTabStyle === 'capsule'
                ? '4px 4px'
                : usesWindowsTabChrome
                  ? isBottomBar
                    ? '0 2px 6px 0'
                    : '6px 2px -1px 0'
                  : 0,
              ...panelTabMotion.motionStyle,
            }}
          >
            {effectiveTabShowIcons ? (
              <span style={{ display: 'flex', color: isActive ? accent : muted }}>{panel.icon}</span>
            ) : null}
            <span>{panel.label}</span>
            {effectiveTabShowActiveIndicator && isActive ? (
              <span style={{ width: 4, height: 4, borderRadius: '50%', background: accent }} />
            ) : null}
            {!isPersistentTab
            && effectiveTabCloseButtonMode !== 'never'
            && (effectiveTabCloseButtonMode === 'always' || isActive) ? (
              <button
                type="button"
                onClick={event => {
                  event.stopPropagation();
                  onPanelClose(panel.id);
                }}
                aria-label="Close panel tab"
                title={`Close ${panel.label}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 16,
                  height: 16,
                  borderRadius: usesWindowsTabChrome ? 5 : 4,
                  border: 'none',
                  background: usesWindowsTabChrome && isActive
                    ? 'rgba(255,255,255,0.06)'
                    : 'transparent',
                  color: muted,
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                <X size={10} />
              </button>
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
  const topBarMainSurface = topBarUsesLayoutDynamics ? (
    <div
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'stretch',
        flex: 1,
        minWidth: 0,
        background: 'rgba(0,0,0,0.08)',
        ...BOUNDED_CHROME_CONTAINMENT_STYLE,
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          opacity: topBarCustomizeActive ? 0.26 : 1,
          pointerEvents: topBarCustomizeActive ? 'none' : 'auto',
          ...BOUNDED_CHROME_CONTAINMENT_STYLE,
        }}
      >
        {centerContent}
      </div>
      <LayoutDynamicsCanvas
        surfaceId={topBarSurfaceSettings.surface.id}
        axisMode={topBarSurfaceSettings.surface.axisMode}
        solver={topBarSurfaceSettings.preset}
        intensity={topBarSurfaceSettings.intensity}
        authoringActive={topBarCustomizeActive}
        bands={[
          {
            id: 'topbar',
            minHeightPx: chromeHeight,
            style: {
              height: '100%',
            },
          },
        ]}
        items={topBarDynamicItems}
        style={{
          height: '100%',
          minHeight: chromeHeight,
          zIndex: 2,
        }}
        onSelectItem={setSelectedTopBarControlId}
        onRemoveItem={removeTopBarControl}
        onCommitSnapshot={commitTopBarLayoutSnapshot}
      />
      {topBarRestoreShelf}
    </div>
  ) : (
    <div style={{ display: 'flex', alignItems: 'stretch', flex: 1, minWidth: 0 }}>
      {navigationShortcuts}
      {centerContent}
    </div>
  );

  const standaloneWindowControlsSurface = isWindowedMode ? (
    <div
      data-gfs-window-drag-exclusion="true"
      style={{
        display: 'flex',
        alignItems: 'stretch',
        borderRadius: 999,
        overflow: 'hidden',
        border: `1px solid ${borderColor}`,
        background: 'var(--overlay-workbench-chrome-button-bg)',
        boxShadow: '0 10px 24px rgba(0,0,0,0.14)',
        backdropFilter: topBarBackdropFilter,
        WebkitBackdropFilter: topBarBackdropFilter,
      }}
    >
      {blurPlatform === 'macos' ? (
        <WindowControls
          platform={blurPlatform}
          isMaximized={isWindowMaximized}
          onMinimize={handleMinimizeWindow}
          onMaximize={() => {
            void handleToggleMaximize();
          }}
          onClose={onClose}
          textMuted={muted}
        />
      ) : (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '0 8px',
            background: 'var(--overlay-workbench-chrome-button-bg)',
          }}
        >
          <WindowControls
            platform={blurPlatform}
            isMaximized={isWindowMaximized}
            onMinimize={handleMinimizeWindow}
            onMaximize={() => {
              void handleToggleMaximize();
            }}
            onClose={onClose}
            textMuted={muted}
          />
        </div>
      )}
    </div>
  ) : null;

  if (surfaceMode === 'window-controls-only') {
    return standaloneWindowControlsSurface;
  }

  return (
    <div
      data-gfs-window-drag-region="topbar"
      onMouseDown={handleStartWindowDrag}
      onDoubleClick={handleTopBarDoubleClick}
      title={
        isWindowedMode
          ? 'Drag Window'
          : isFloatingDockWindow
            ? 'Drag Floating Dock'
            : undefined
      }
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'stretch',
        height: chromeHeight + resolvedWindowedChromeTopInset,
        flexShrink: 0,
        paddingTop: resolvedWindowedChromeTopInset,
        boxSizing: 'border-box',
        margin: usesInsetTopBar ? 'var(--overlay-workbench-shell-inset)' : 0,
        background: effectiveTopBarStyle === 'minimal'
          ? 'transparent'
          : `linear-gradient(180deg, var(--overlay-workbench-chrome-bg), ${appearance.theme.palette.appBackgroundAlt})`,
        borderBottom: usesFloatingTopBar
          ? '1px solid var(--overlay-workbench-chrome-border)'
          : effectiveTopBarStyle === 'minimal'
          ? 'none'
          : (isBottomBar ? 'none' : '1px solid var(--overlay-workbench-chrome-border)'),
        borderTop: usesFloatingTopBar
          ? '1px solid var(--overlay-workbench-chrome-border)'
          : effectiveTopBarStyle === 'minimal'
          ? 'none'
          : (isBottomBar ? '1px solid var(--overlay-workbench-chrome-border)' : 'none'),
        borderRight: usesFloatingTopBar ? '1px solid var(--overlay-workbench-chrome-border)' : 'none',
        borderLeft: usesFloatingTopBar ? '1px solid var(--overlay-workbench-chrome-border)' : 'none',
        borderRadius: usesInsetTopBar ? workbench.metrics.panelRadius : 0,
        boxShadow: usesFloatingTopBar
          ? 'var(--overlay-workbench-shell-shadow)'
          : (isBottomBar
              ? 'inset 0 -1px 0 rgba(255,255,255,0.04), 0 -8px 18px rgba(0,0,0,0.2)'
              : 'inset 0 1px 0 rgba(255,255,255,0.04), 0 8px 18px rgba(0,0,0,0.2)'),
        cursor: canDragWindow && !topBarCustomizeActive ? 'grab' : undefined,
        overflow: isMobileMenuOpen || isSurfaceControlsOpen ? 'visible' : 'hidden',
        backdropFilter: topBarBackdropFilter,
        WebkitBackdropFilter: topBarBackdropFilter,
      }}
    >
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        {topBarShaderLayer}
      </div>
      {shouldShowLeadingWindowControls ? (
        <div
          data-gfs-window-drag-exclusion="true"
          style={{ borderRight: `1px solid ${borderColor}`, flexShrink: 0 }}
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
      {topBarUsesLayoutDynamics ? null : renderControlZone(leadingControls, 'leading')}
      {topBarMainSurface}
      {topBarUsesLayoutDynamics ? null : renderControlZone(shellModeControls, 'trailing')}
      {kainTopBarAppletStrip}
      {topBarUsesLayoutDynamics ? null : renderControlZone(trailingControls, 'trailing')}
      {shouldShowTrailingWindowControls ? (
        <div
          data-gfs-window-drag-exclusion="true"
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
