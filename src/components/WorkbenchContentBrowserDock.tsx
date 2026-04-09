import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react';

import type { ResolvedOverlayAppearance } from '../config/appearance';
import type { OverlayPluginExplorerActionContribution } from '../config/pluginContributions';
import type { LayoutContentBrowserDockConfig } from '../config/layoutProfiles';
import {
  CONTENT_BROWSER_DOCK_EXPLORER_INSTANCE_ID,
  CONTENT_BROWSER_DRAWER_EXPLORER_INSTANCE_ID,
  defaultExplorerSession,
  useExplorerStore,
} from '../store/explorerStore';
import type { LayoutContentBrowserDockState } from '../store/settingsStore';
import { FileExplorer } from './FileExplorer';

const CONTENT_BROWSER_DOCK_MIN_SIZE = 220;
const CONTENT_BROWSER_DOCK_MAX_SIZE = 720;

function clampContentBrowserDockSize(value: number): number {
  return Math.max(CONTENT_BROWSER_DOCK_MIN_SIZE, Math.min(CONTENT_BROWSER_DOCK_MAX_SIZE, Math.round(value)));
}

interface WorkbenchContentBrowserDockProps {
  appearance: ResolvedOverlayAppearance;
  dockConfig: LayoutContentBrowserDockConfig;
  dockState: LayoutContentBrowserDockState;
  onUpdateDockState: (updates: Partial<LayoutContentBrowserDockState>) => void;
  onOpenInTerminal: (path: string) => void;
  onAddBookmark: (name: string, path: string) => void;
  pluginActions?: OverlayPluginExplorerActionContribution[];
  repositoryPicker?: {
    active: boolean;
    allowMultiple: boolean;
    requestId: number;
    onConfirm: (paths: string[]) => void;
    onCancel: () => void;
  } | null;
}

export function WorkbenchContentBrowserDock({
  appearance,
  dockConfig,
  dockState,
  onUpdateDockState,
  onOpenInTerminal,
  onAddBookmark,
  pluginActions = [],
  repositoryPicker = null,
}: WorkbenchContentBrowserDockProps) {
  const [focusAddressBarSignal, setFocusAddressBarSignal] = useState(0);
  const surfaceKind = dockState.drawerOpen ? 'drawer' : dockState.dockOpen ? 'dock' : null;
  const surfaceInstanceId = surfaceKind === 'drawer'
    ? CONTENT_BROWSER_DRAWER_EXPLORER_INSTANCE_ID
    : CONTENT_BROWSER_DOCK_EXPLORER_INSTANCE_ID;
  const sourcesVisible = useExplorerStore(state => (
    state.sessions[surfaceInstanceId]?.sourcesVisible ?? defaultExplorerSession.sourcesVisible
  ));
  const updateExplorerSessionForInstance = useExplorerStore(state => state.updateSessionForInstance);
  const accent = appearance.theme.palette.accent;
  const text = appearance.theme.palette.textPrimary;
  const muted = appearance.theme.palette.textMuted;
  const border = appearance.theme.palette.border;
  const workbench = appearance.workbenchTheme;
  const explorerTheme = useMemo(() => ({
    accent,
    bg: appearance.theme.palette.shellBackground,
    bgPanel: appearance.theme.palette.panelBackground,
    text,
    border,
    textMuted: muted,
  }), [accent, appearance.theme.palette.panelBackground, appearance.theme.palette.shellBackground, border, muted, text]);
  const resizeSessionRef = useRef<{ pointerId: number; startSize: number; startAxis: number } | null>(null);

  const placement = dockState.placement;
  const isBottomPlacement = placement === 'bottom';
  const activeSize = clampContentBrowserDockSize(
    (surfaceKind === 'drawer' ? dockState.drawerSize : dockState.dockSize)
    ?? (surfaceKind === 'drawer' ? dockConfig.drawerSize : dockConfig.dockSize),
  );

  const updateSize = useCallback((nextSize: number) => {
    const clampedSize = clampContentBrowserDockSize(nextSize);
    onUpdateDockState(
      surfaceKind === 'drawer'
        ? { drawerSize: clampedSize }
        : { dockSize: clampedSize },
    );
  }, [onUpdateDockState, surfaceKind]);

  const beginResize = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (surfaceKind == null) {
      return;
    }

    event.preventDefault();
    resizeSessionRef.current = {
      pointerId: event.pointerId,
      startSize: activeSize,
      startAxis: isBottomPlacement ? event.clientY : event.clientX,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }, [activeSize, isBottomPlacement, surfaceKind]);

  const handlePointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (!resizeSessionRef.current || resizeSessionRef.current.pointerId !== event.pointerId) {
      return;
    }

    const delta = isBottomPlacement
      ? resizeSessionRef.current.startAxis - event.clientY
      : placement === 'left'
        ? event.clientX - resizeSessionRef.current.startAxis
        : resizeSessionRef.current.startAxis - event.clientX;
    updateSize(resizeSessionRef.current.startSize + delta);
  }, [isBottomPlacement, placement, updateSize]);

  const endResize = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (!resizeSessionRef.current || resizeSessionRef.current.pointerId !== event.pointerId) {
      return;
    }

    resizeSessionRef.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
  }, []);

  const toggleSources = useCallback(() => {
    updateExplorerSessionForInstance(surfaceInstanceId, {
      sourcesVisible: !sourcesVisible,
    });
  }, [sourcesVisible, surfaceInstanceId, updateExplorerSessionForInstance]);

  const focusSearch = useCallback(() => {
    setFocusAddressBarSignal(signal => signal + 1);
  }, []);

  if (surfaceKind == null) {
    return null;
  }

  const isDrawer = surfaceKind === 'drawer';
  const placementLabel = placement === 'bottom'
    ? 'Bottom'
    : placement === 'left'
      ? 'Left'
      : 'Right';

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: isBottomPlacement ? 'column' : 'row',
        minWidth: 0,
        minHeight: 0,
        width: isBottomPlacement ? '100%' : activeSize,
        minWidth: isBottomPlacement ? 0 : activeSize,
        maxWidth: isBottomPlacement ? '100%' : activeSize,
        height: isBottomPlacement ? activeSize : '100%',
        minHeight: isBottomPlacement ? activeSize : 0,
        maxHeight: isBottomPlacement ? activeSize : '100%',
        borderTop: isBottomPlacement ? `1px solid ${border}` : 'none',
        borderLeft: !isBottomPlacement && placement === 'right' ? `1px solid ${border}` : 'none',
        borderRight: !isBottomPlacement && placement === 'left' ? `1px solid ${border}` : 'none',
        background: 'var(--overlay-bg-panel)',
        overflow: 'hidden',
      }}
    >
      <div
        onPointerDown={beginResize}
        onPointerMove={handlePointerMove}
        onPointerUp={endResize}
        onPointerCancel={endResize}
        style={{
          flexShrink: 0,
          cursor: isBottomPlacement ? 'ns-resize' : 'ew-resize',
          width: isBottomPlacement ? '100%' : 4,
          height: isBottomPlacement ? 4 : '100%',
          background: `linear-gradient(${isBottomPlacement ? '90deg' : '180deg'}, transparent 0%, ${accent}88 28%, ${accent} 50%, ${accent}88 72%, transparent 100%)`,
        }}
      />
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          minWidth: 0,
          minHeight: 0,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            minHeight: 36,
            padding: '0 10px',
            borderBottom: `1px solid ${border}`,
            background: 'var(--overlay-workbench-chrome-bg)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: muted }}>
              {isDrawer ? 'Content Drawer' : 'Content Browser'}
            </div>
            <div
              style={{
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: accent,
                padding: '2px 6px',
                borderRadius: 999,
                border: `1px solid ${accent}44`,
                background: `${accent}14`,
              }}
            >
              {placementLabel}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={toggleSources}
              style={dockActionButtonStyle(workbench.metrics.controlRadius)}
            >
              {sourcesVisible ? 'Hide Sources' : 'Show Sources'}
            </button>
            <button
              type="button"
              onClick={focusSearch}
              style={dockActionButtonStyle(workbench.metrics.controlRadius)}
            >
              Focus Search
            </button>
            {isDrawer ? (
              <button
                type="button"
                onClick={() => onUpdateDockState({
                  dockOpen: true,
                  dockCreated: true,
                  drawerOpen: false,
                })}
                style={dockActionButtonStyle(workbench.metrics.controlRadius, true)}
              >
                Dock In Layout
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onUpdateDockState({
                  dockOpen: false,
                  drawerOpen: true,
                })}
                style={dockActionButtonStyle(workbench.metrics.controlRadius)}
              >
                Undock To Drawer
              </button>
            )}
            <button
              type="button"
              onClick={() => onUpdateDockState(isDrawer ? { drawerOpen: false } : { dockOpen: false })}
              style={dockActionButtonStyle(workbench.metrics.controlRadius)}
            >
              Close
            </button>
          </div>
        </div>

        <div style={{ flex: 1, minWidth: 0, minHeight: 0 }}>
          <FileExplorer
            appearance={appearance}
            instanceId={surfaceInstanceId}
            surfaceKind={surfaceKind}
            focusAddressBarSignal={focusAddressBarSignal}
            repositoryPicker={repositoryPicker}
            theme={explorerTheme}
            onOpenInTerminal={onOpenInTerminal}
            onAddBookmark={onAddBookmark}
            pluginActions={pluginActions}
          />
        </div>
      </div>
    </div>
  );
}

function dockActionButtonStyle(radius: number, accent = false): CSSProperties {
  return {
    height: 24,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0 8px',
    borderRadius: radius,
    border: `1px solid ${accent ? 'var(--overlay-workbench-chrome-button-active-border)' : 'var(--overlay-workbench-chrome-border)'}`,
    background: accent ? 'var(--overlay-workbench-chrome-button-active-bg)' : 'var(--overlay-workbench-chrome-button-bg)',
    color: accent ? 'var(--overlay-text-primary)' : 'var(--overlay-text-muted)',
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  };
}
