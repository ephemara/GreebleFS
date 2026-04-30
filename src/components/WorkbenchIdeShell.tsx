import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type DragEvent,
  type ReactNode,
} from 'react';

import {
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Monitor,
  MoreHorizontal,
  SquareSplitHorizontal,
  X,
} from '@/components/AppIcons';
import type { ResolvedOverlayAppearance } from '../config/appearance';
import {
  IDE_WORKBENCH_STACK_IDS,
  floatDockSurface,
  focusDockSurface,
  hideDockSurface,
  moveSurfaceToDockPlacement,
  reorderDockSurfaceTabs,
  toggleDockMaximize,
  toggleDockStackCollapsed,
  updateDockSplitSizes,
  updateFloatingDockNodeBounds,
  updateIdeRailState,
  type DockNode,
  type DockPlacement,
  type DockSplitNode,
  type DockStackNode,
  type DockStackPlacement,
  type FloatingDockNode,
  type IdeWorkbenchLayoutState,
  type WorkbenchSurfaceLayoutSeed,
} from '../config/ideWorkbenchLayout';
import type { WorkbenchSurfaceDefinition } from '../panels/panelRegistry';

interface WorkbenchIdeShellProps {
  appearance: ResolvedOverlayAppearance;
  surfaces: WorkbenchSurfaceDefinition[];
  surfaceSeeds: WorkbenchSurfaceLayoutSeed[];
  layoutState: IdeWorkbenchLayoutState;
  onLayoutStateChange: (nextState: IdeWorkbenchLayoutState) => void;
  onRequestFocusSurface?: (surfaceId: string) => boolean | void;
  onRequestExternalizeSurface?: (
    surfaceId: string,
    placement: DockStackPlacement,
  ) => void;
  renderSurfaceBody: (surfaceId: string, isActive: boolean) => ReactNode;
}

const COLLAPSED_EDGE_SIZE = 40;
const COLLAPSED_BOTTOM_SIZE = 34;

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function dockPlacementLabel(placement: DockStackPlacement): string {
  switch (placement) {
    case 'left-sidebar':
      return 'Left';
    case 'center':
      return 'Center';
    case 'right-sidebar':
      return 'Right';
    case 'bottom-panel':
      return 'Bottom';
    default:
      return placement;
  }
}

function dockNodeContainsStackId(node: DockNode, stackId: string): boolean {
  if (node.type === 'stack') {
    return node.id === stackId;
  }

  return node.children.some(child => dockNodeContainsStackId(child, stackId));
}

function computeCollapsedSize(stack: DockStackNode): number {
  if (stack.tabs.length === 0) {
    return 0;
  }

  return stack.placement === 'bottom-panel' ? COLLAPSED_BOTTOM_SIZE : COLLAPSED_EDGE_SIZE;
}

function DockActionButton({
  title,
  active = false,
  onClick,
  children,
}: {
  title: string;
  active?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      style={{
        width: 22,
        height: 22,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 6,
        border: '1px solid var(--overlay-workbench-chrome-border)',
        background: active
          ? 'var(--overlay-workbench-chrome-button-active-bg)'
          : 'var(--overlay-workbench-chrome-button-bg)',
        color: active
          ? 'var(--overlay-text-primary)'
          : 'var(--overlay-text-muted)',
        cursor: 'pointer',
      }}
    >
      {children}
    </button>
  );
}

function DockSplitResizeHandle({
  appearance,
  orientation,
  split,
  onCommitSizes,
}: {
  appearance: ResolvedOverlayAppearance;
  orientation: 'horizontal' | 'vertical';
  split: DockSplitNode;
  onCommitSizes: (sizes: number[]) => void;
}) {
  const handleRef = useRef<HTMLDivElement | null>(null);

  return (
    <div
      ref={handleRef}
      onPointerDown={(event) => {
        if (event.button !== 0) {
          return;
        }
        const rootElement = handleRef.current?.parentElement;
        if (!rootElement) {
          return;
        }

        const bounds = rootElement.getBoundingClientRect();
        const startAxis = orientation === 'horizontal' ? event.clientX : event.clientY;
        const startSizes = [...split.sizes];
        const containerSpan = orientation === 'horizontal' ? bounds.width : bounds.height;
        if (!Number.isFinite(containerSpan) || containerSpan <= 0) {
          return;
        }

        event.preventDefault();
        document.body.style.userSelect = 'none';
        const onPointerMove = (moveEvent: PointerEvent) => {
          const deltaPx = (orientation === 'horizontal' ? moveEvent.clientX : moveEvent.clientY) - startAxis;
          const deltaRatio = deltaPx / containerSpan;
          const nextSizes = [...startSizes];
          nextSizes[0] = clampNumber(startSizes[0] + deltaRatio, 0.12, 8);
          nextSizes[1] = clampNumber(startSizes[1] - deltaRatio, 0.12, 8);
          onCommitSizes(nextSizes);
        };

        const cleanup = () => {
          document.body.style.userSelect = '';
          window.removeEventListener('pointermove', onPointerMove);
          window.removeEventListener('pointerup', cleanup);
          window.removeEventListener('pointercancel', cleanup);
        };

        window.addEventListener('pointermove', onPointerMove);
        window.addEventListener('pointerup', cleanup);
        window.addEventListener('pointercancel', cleanup);
      }}
      style={{
        flexShrink: 0,
        width: orientation === 'horizontal' ? 6 : '100%',
        height: orientation === 'vertical' ? 6 : '100%',
        cursor: orientation === 'horizontal' ? 'col-resize' : 'row-resize',
        background: 'transparent',
        position: 'relative',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: orientation === 'horizontal'
            ? '0 2px'
            : '2px 0',
          borderRadius: 999,
          background: appearance.theme.palette.border,
          opacity: 0.48,
        }}
      />
    </div>
  );
}

export function WorkbenchIdeShell({
  appearance,
  surfaces,
  surfaceSeeds,
  layoutState,
  onLayoutStateChange,
  onRequestFocusSurface,
  onRequestExternalizeSurface,
  renderSurfaceBody,
}: WorkbenchIdeShellProps) {
  const theme = appearance.theme;
  const workbench = appearance.workbenchTheme;
  const surfaceById = useMemo(
    () => new Map(surfaces.map(surface => [surface.id, surface] as const)),
    [surfaces],
  );
  const explorerSurface = useMemo(
    () => surfaces.find(surface => surface.ideRole === 'explorer-core') ?? null,
    [surfaces],
  );
  const primaryRailSurfaces = useMemo(
    () => surfaces.filter(surface => surface.railShortcut && surface.ideNavigationTier === 'primary'),
    [surfaces],
  );
  const secondaryRailSurfaces = useMemo(
    () => surfaces.filter(surface => surface.railShortcut && surface.ideNavigationTier === 'secondary'),
    [surfaces],
  );
  const [draggedSurfaceTabId, setDraggedSurfaceTabId] = useState<string | null>(null);

  const commitLayoutState = useCallback((nextState: IdeWorkbenchLayoutState) => {
    onLayoutStateChange(nextState);
  }, [onLayoutStateChange]);

  const handleFocusSurface = useCallback((surfaceId: string) => {
    if (onRequestFocusSurface?.(surfaceId) === true) {
      return;
    }

    commitLayoutState(focusDockSurface(layoutState, surfaceId, surfaceSeeds));
  }, [commitLayoutState, layoutState, onRequestFocusSurface, surfaceSeeds]);

  const handleMoveSurface = useCallback((surfaceId: string, placement: DockPlacement) => {
    if (placement === 'floating') {
      commitLayoutState(floatDockSurface(layoutState, surfaceId));
      return;
    }

    commitLayoutState(moveSurfaceToDockPlacement(layoutState, surfaceId, placement));
  }, [commitLayoutState, layoutState]);

  const handleHideSurface = useCallback((surfaceId: string) => {
    commitLayoutState(hideDockSurface(layoutState, surfaceId));
  }, [commitLayoutState, layoutState]);

  const handleToggleStackCollapsed = useCallback((stackId: string) => {
    commitLayoutState(toggleDockStackCollapsed(layoutState, stackId));
  }, [commitLayoutState, layoutState]);

  const handleToggleStackMaximized = useCallback((stackId: string) => {
    commitLayoutState(toggleDockMaximize(layoutState, stackId));
  }, [commitLayoutState, layoutState]);

  const handleSurfaceTabDragStart = useCallback((
    event: DragEvent<HTMLButtonElement>,
    surfaceId: string,
  ) => {
    setDraggedSurfaceTabId(surfaceId);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', surfaceId);
  }, []);

  const handleSurfaceTabDrop = useCallback((
    event: DragEvent<HTMLButtonElement>,
    targetSurfaceId: string,
  ) => {
    event.preventDefault();
    const draggedSurfaceId = event.dataTransfer.getData('text/plain') || draggedSurfaceTabId;
    if (draggedSurfaceId && draggedSurfaceId !== targetSurfaceId) {
      commitLayoutState(reorderDockSurfaceTabs(layoutState, draggedSurfaceId, targetSurfaceId));
    }
    setDraggedSurfaceTabId(null);
  }, [commitLayoutState, draggedSurfaceTabId, layoutState]);

  const renderStackSurfaceActions = useCallback((
    stack: DockStackNode,
    activeSurfaceId: string,
  ) => {
    const activeSurface = surfaceById.get(activeSurfaceId) ?? null;
    const actions: Array<{ key: string; title: string; placement: DockPlacement }> = [
      { key: 'right', title: 'Dock right sidebar', placement: 'right-sidebar' },
      { key: 'bottom', title: 'Dock bottom panel', placement: 'bottom-panel' },
      { key: 'float', title: 'Float panel', placement: 'floating' },
    ];
    const canExternalizeSurface = Boolean(
      activeSurface
      && activeSurface.id !== explorerSurface?.id
      && activeSurface.allowedPresentations.includes('native-window'),
    );

    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        {actions.map((action) => (
          <button
            key={`${stack.id}:${action.key}`}
            type="button"
            title={action.title}
            onClick={() => handleMoveSurface(activeSurfaceId, action.placement)}
            style={{
              padding: '0 6px',
              height: 22,
              borderRadius: 6,
              border: '1px solid var(--overlay-workbench-chrome-border)',
              background: action.placement === stack.placement
                ? 'var(--overlay-workbench-chrome-button-active-bg)'
                : 'var(--overlay-workbench-chrome-button-bg)',
              color: action.placement === stack.placement
                ? theme.palette.textPrimary
                : theme.palette.textMuted,
              cursor: action.placement === stack.placement ? 'default' : 'pointer',
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
            }}
            disabled={action.placement === stack.placement}
          >
            {action.placement === 'floating' ? 'Float' : dockPlacementLabel(action.placement)}
          </button>
        ))}
        {canExternalizeSurface ? (
          <DockActionButton
            title="Open in native window"
            onClick={() => onRequestExternalizeSurface?.(activeSurfaceId, stack.placement)}
          >
            <Monitor size={12} />
          </DockActionButton>
        ) : null}
        <DockActionButton
          title="Hide panel"
          onClick={() => handleHideSurface(activeSurfaceId)}
        >
          <X size={12} />
        </DockActionButton>
      </div>
    );
  }, [
    explorerSurface,
    handleHideSurface,
    handleMoveSurface,
    onRequestExternalizeSurface,
    surfaceById,
    theme.palette.textMuted,
    theme.palette.textPrimary,
  ]);

  const renderCollapsedStack = useCallback((stack: DockStackNode) => {
    const direction = stack.placement === 'bottom-panel' ? 'row' : 'column';
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: direction,
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          width: '100%',
          height: '100%',
          padding: 4,
          background: theme.palette.panelBackground,
          border: `1px solid ${theme.palette.border}`,
          borderRadius: workbench.metrics.panelRadius,
        }}
      >
        <DockActionButton
          title={`Expand ${dockPlacementLabel(stack.placement)}`}
          onClick={() => handleToggleStackCollapsed(stack.id)}
        >
          {stack.placement === 'bottom-panel' ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
        </DockActionButton>
        {stack.tabs.map((surfaceId) => {
          const surface = surfaceById.get(surfaceId);
          if (!surface) {
            return null;
          }

          return (
            <button
              key={`${stack.id}:collapsed:${surface.id}`}
              type="button"
              onClick={() => {
                const expandedLayoutState = toggleDockStackCollapsed(layoutState, stack.id);
                if (onRequestFocusSurface?.(surface.id) === true) {
                  commitLayoutState(expandedLayoutState);
                  return;
                }

                commitLayoutState(focusDockSurface(
                  expandedLayoutState,
                  surface.id,
                  surfaceSeeds,
                ));
              }}
              title={surface.label}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 28,
                height: 28,
                borderRadius: 8,
                border: '1px solid var(--overlay-workbench-chrome-border)',
                background: 'var(--overlay-workbench-chrome-button-bg)',
                color: theme.palette.textMuted,
                cursor: 'pointer',
              }}
            >
              {surface.icon}
            </button>
          );
        })}
      </div>
    );
  }, [
    commitLayoutState,
    handleToggleStackCollapsed,
    layoutState,
    onRequestFocusSurface,
    surfaceById,
    surfaceSeeds,
    theme.palette.border,
    theme.palette.panelBackground,
    theme.palette.textMuted,
    workbench.metrics.panelRadius,
  ]);

  const renderDockStack = useCallback((stack: DockStackNode) => {
    const surfacesInStack = stack.tabs
      .map(surfaceId => surfaceById.get(surfaceId))
      .filter((surface): surface is WorkbenchSurfaceDefinition => Boolean(surface));
    const activeSurfaceId = stack.activeSurfaceId && stack.tabs.includes(stack.activeSurfaceId)
      ? stack.activeSurfaceId
      : stack.tabs[0] ?? null;
    const activeSurface = activeSurfaceId ? surfaceById.get(activeSurfaceId) ?? null : null;
    const centerExplorerSurfaceId = explorerSurface?.id ?? 'explorer';
    const rendersExplorerCenter = stack.id === IDE_WORKBENCH_STACK_IDS.center && explorerSurface != null;

    if (stack.collapsed) {
      return renderCollapsedStack(stack);
    }

    if (rendersExplorerCenter) {
      const explorerIsActive = (layoutState.focusedSurfaceId ?? centerExplorerSurfaceId) === centerExplorerSurfaceId;
      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            width: '100%',
            height: '100%',
            minWidth: 0,
            minHeight: 0,
            background: theme.palette.panelBackground,
            border: `1px solid ${theme.palette.border}`,
            borderRadius: workbench.metrics.panelRadius,
            overflow: 'hidden',
          }}
        >
          <div style={{ position: 'relative', flex: 1, minWidth: 0, minHeight: 0 }}>
            {renderSurfaceBody(centerExplorerSurfaceId, explorerIsActive)}
          </div>
        </div>
      );
    }

    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
          height: '100%',
          minWidth: 0,
          minHeight: 0,
          background: theme.palette.panelBackground,
          border: `1px solid ${theme.palette.border}`,
          borderRadius: workbench.metrics.panelRadius,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            minHeight: 34,
            padding: '0 8px',
            borderBottom: `1px solid ${theme.palette.border}`,
            background: theme.palette.appBackgroundAlt,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0, flex: 1 }}>
            {surfacesInStack.map((surface) => {
              const isActive = surface.id === activeSurfaceId;
              return (
                <button
                  key={`${stack.id}:${surface.id}`}
                  type="button"
                  draggable={surfacesInStack.length > 1}
                  onClick={() => handleFocusSurface(surface.id)}
                  onDragStart={event => handleSurfaceTabDragStart(event, surface.id)}
                  onDragEnd={() => setDraggedSurfaceTabId(null)}
                  onDragOver={event => {
                    if (surfacesInStack.length > 1 && draggedSurfaceTabId !== surface.id) {
                      event.preventDefault();
                      event.dataTransfer.dropEffect = 'move';
                    }
                  }}
                  onDrop={event => handleSurfaceTabDrop(event, surface.id)}
                  data-ide-workbench-stack-tab={surface.id}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    minWidth: 0,
                    padding: '0 10px',
                    height: 26,
                    borderRadius: 8,
                    border: `1px solid ${isActive ? theme.palette.accent : theme.palette.border}`,
                    background: isActive
                      ? `${theme.palette.accent}22`
                      : 'var(--overlay-workbench-chrome-button-bg)',
                    color: isActive ? theme.palette.textPrimary : theme.palette.textMuted,
                    cursor: 'pointer',
                    opacity: draggedSurfaceTabId === surface.id ? 0.5 : 1,
                  }}
                  title={surface.description}
                >
                  <span style={{ display: 'flex' }}>{surface.icon}</span>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {surface.label}
                  </span>
                </button>
              );
            })}
          </div>
          {activeSurface ? renderStackSurfaceActions(stack, activeSurface.id) : null}
          {stack.id !== IDE_WORKBENCH_STACK_IDS.center ? (
            <DockActionButton
              title={`Collapse ${dockPlacementLabel(stack.placement)}`}
              onClick={() => handleToggleStackCollapsed(stack.id)}
            >
              <MoreHorizontal size={12} />
            </DockActionButton>
          ) : null}
          <DockActionButton
            title={layoutState.maximizedNodeId === stack.id ? 'Restore region' : 'Maximize region'}
            active={layoutState.maximizedNodeId === stack.id}
            onClick={() => handleToggleStackMaximized(stack.id)}
          >
            <Maximize2 size={12} />
          </DockActionButton>
        </div>
        <div style={{ position: 'relative', flex: 1, minWidth: 0, minHeight: 0 }}>
          {surfacesInStack.map((surface) => {
            const isActive = surface.id === activeSurfaceId;
            const shouldMount = surface.keepMounted || isActive;
            if (!shouldMount) {
              return null;
            }

            return (
              <div
                key={`${stack.id}:surface:${surface.id}`}
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: isActive ? 'flex' : 'none',
                  minWidth: 0,
                  minHeight: 0,
                  overflow: 'hidden',
                }}
              >
                {renderSurfaceBody(surface.id, isActive)}
              </div>
            );
          })}
          {surfacesInStack.length === 0 ? (
            <div
              style={{
                display: 'grid',
                placeItems: 'center',
                width: '100%',
                height: '100%',
                color: theme.palette.textMuted,
                fontSize: 12,
                padding: 24,
                textAlign: 'center',
              }}
            >
              Use the rail to open a surface into this region.
            </div>
          ) : null}
        </div>
      </div>
    );
  }, [
    explorerSurface,
    draggedSurfaceTabId,
    handleFocusSurface,
    handleSurfaceTabDragStart,
    handleSurfaceTabDrop,
    handleToggleStackCollapsed,
    handleToggleStackMaximized,
    layoutState.focusedSurfaceId,
    layoutState.maximizedNodeId,
    renderCollapsedStack,
    renderStackSurfaceActions,
    renderSurfaceBody,
    surfaceById,
    theme.palette.accent,
    theme.palette.appBackgroundAlt,
    theme.palette.border,
    theme.palette.panelBackground,
    theme.palette.textMuted,
    theme.palette.textPrimary,
    workbench.metrics.panelRadius,
  ]);

  const renderDockNode = useCallback((node: DockNode): ReactNode => {
    const maximizedNodeId = layoutState.maximizedNodeId;
    if (maximizedNodeId) {
      if (node.type === 'stack') {
        if (node.id !== maximizedNodeId) {
          return null;
        }
      } else if (!dockNodeContainsStackId(node, maximizedNodeId)) {
        return null;
      }
    }

    if (node.type === 'stack') {
      return renderDockStack(node);
    }

    const visibleChildren = maximizedNodeId
      ? node.children.filter((child) => (
        child.type === 'stack'
          ? child.id === maximizedNodeId
          : dockNodeContainsStackId(child, maximizedNodeId)
      ))
      : node.children;

    const isHorizontal = node.orientation === 'horizontal';
    const renderedChildren = visibleChildren
      .map((child, index) => ({
        child,
        size: node.sizes[index] ?? 1,
      }))
      .filter(({ child }) => child != null);

    return (
      <div
        style={{
          display: 'flex',
          flexDirection: isHorizontal ? 'row' : 'column',
          flex: 1,
          minWidth: 0,
          minHeight: 0,
          gap: 0,
          overflow: 'hidden',
        }}
      >
        {renderedChildren.map(({ child, size }, index) => {
          const isCollapsedStack = child.type === 'stack' && child.collapsed;
          const collapsedSize = isCollapsedStack ? computeCollapsedSize(child) : 0;
          const style: CSSProperties = isCollapsedStack
            ? isHorizontal
              ? { width: collapsedSize, minWidth: collapsedSize, maxWidth: collapsedSize, flexShrink: 0 }
              : { height: collapsedSize, minHeight: collapsedSize, maxHeight: collapsedSize, flexShrink: 0 }
            : {
              flex: `${size} 1 0`,
              minWidth: isHorizontal ? 0 : undefined,
              minHeight: isHorizontal ? undefined : 0,
            };

          return (
            <div
              key={`${node.id}:${index}`}
              style={{
                ...style,
                display: 'flex',
                minWidth: isHorizontal && !isCollapsedStack ? 0 : style.minWidth,
                minHeight: !isHorizontal && !isCollapsedStack ? 0 : style.minHeight,
                overflow: 'hidden',
              }}
            >
              {renderDockNode(child)}
              {index < renderedChildren.length - 1 && renderedChildren.length === 2 ? (
                <DockSplitResizeHandle
                  appearance={appearance}
                  orientation={node.orientation}
                  split={node}
                  onCommitSizes={(sizes) => {
                    commitLayoutState(updateDockSplitSizes(layoutState, node.id, sizes));
                  }}
                />
              ) : null}
            </div>
          );
        })}
      </div>
    );
  }, [appearance, commitLayoutState, layoutState, renderDockStack]);

  const renderFloatingWindow = useCallback((floatingNode: FloatingDockNode) => {
    const activeSurfaceId = floatingNode.activeSurfaceId && floatingNode.tabs.includes(floatingNode.activeSurfaceId)
      ? floatingNode.activeSurfaceId
      : floatingNode.tabs[0] ?? null;
    const activeSurface = activeSurfaceId ? surfaceById.get(activeSurfaceId) ?? null : null;

    return (
      <div
        key={floatingNode.id}
        style={{
          position: 'absolute',
          left: floatingNode.x,
          top: floatingNode.y,
          width: floatingNode.width,
          height: floatingNode.height,
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
          minHeight: 0,
          borderRadius: workbench.metrics.panelRadius,
          border: `1px solid ${theme.palette.border}`,
          background: theme.palette.panelBackground,
          boxShadow: workbench.surfaces.shellShadow,
          overflow: 'hidden',
          zIndex: 12,
        }}
      >
        <div
          onPointerDown={(event) => {
            if (event.button !== 0) {
              return;
            }

            event.preventDefault();
            const startX = event.clientX;
            const startY = event.clientY;
            const startLeft = floatingNode.x;
            const startTop = floatingNode.y;
            document.body.style.userSelect = 'none';
            const onPointerMove = (moveEvent: PointerEvent) => {
              commitLayoutState(updateFloatingDockNodeBounds(layoutState, floatingNode.id, {
                x: startLeft + (moveEvent.clientX - startX),
                y: startTop + (moveEvent.clientY - startY),
              }));
            };
            const cleanup = () => {
              document.body.style.userSelect = '';
              window.removeEventListener('pointermove', onPointerMove);
              window.removeEventListener('pointerup', cleanup);
              window.removeEventListener('pointercancel', cleanup);
            };
            window.addEventListener('pointermove', onPointerMove);
            window.addEventListener('pointerup', cleanup);
            window.addEventListener('pointercancel', cleanup);
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            minHeight: 34,
            padding: '0 8px',
            borderBottom: `1px solid ${theme.palette.border}`,
            background: theme.palette.appBackgroundAlt,
            cursor: 'move',
          }}
        >
          <Monitor size={12} style={{ color: theme.palette.textMuted }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0, flex: 1 }}>
            {floatingNode.tabs.map((surfaceId) => {
              const surface = surfaceById.get(surfaceId);
              if (!surface) {
                return null;
              }

              const isActive = surfaceId === activeSurfaceId;
              return (
                <button
                  key={`${floatingNode.id}:${surfaceId}`}
                  type="button"
                  draggable={floatingNode.tabs.length > 1}
                  onClick={() => handleFocusSurface(surfaceId)}
                  onDragStart={event => handleSurfaceTabDragStart(event, surfaceId)}
                  onDragEnd={() => setDraggedSurfaceTabId(null)}
                  onDragOver={event => {
                    if (floatingNode.tabs.length > 1 && draggedSurfaceTabId !== surfaceId) {
                      event.preventDefault();
                      event.dataTransfer.dropEffect = 'move';
                    }
                  }}
                  onDrop={event => handleSurfaceTabDrop(event, surfaceId)}
                  data-ide-workbench-floating-tab={surfaceId}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    minWidth: 0,
                    padding: '0 8px',
                    height: 24,
                    borderRadius: 7,
                    border: `1px solid ${isActive ? theme.palette.accent : theme.palette.border}`,
                    background: isActive
                      ? `${theme.palette.accent}22`
                      : 'var(--overlay-workbench-chrome-button-bg)',
                    color: isActive ? theme.palette.textPrimary : theme.palette.textMuted,
                    cursor: 'pointer',
                    opacity: draggedSurfaceTabId === surfaceId ? 0.5 : 1,
                  }}
                >
                  {surface.icon}
                  <span style={{ fontSize: 11, fontWeight: 700 }}>{surface.label}</span>
                </button>
              );
            })}
          </div>
          {activeSurface ? (
            <>
              <DockActionButton
                title={`Dock ${dockPlacementLabel(activeSurface.defaultDockPlacement)}`}
                onClick={() => handleMoveSurface(activeSurface.id, activeSurface.defaultDockPlacement)}
              >
                <SquareSplitHorizontal size={12} />
              </DockActionButton>
              <DockActionButton
                title="Hide panel"
                onClick={() => handleHideSurface(activeSurface.id)}
              >
                <X size={12} />
              </DockActionButton>
            </>
          ) : null}
        </div>
        <div style={{ position: 'relative', flex: 1, minWidth: 0, minHeight: 0 }}>
          {activeSurface ? renderSurfaceBody(activeSurface.id, true) : null}
        </div>
        <div
          onPointerDown={(event) => {
            if (event.button !== 0) {
              return;
            }
            event.preventDefault();
            const startX = event.clientX;
            const startY = event.clientY;
            const startWidth = floatingNode.width;
            const startHeight = floatingNode.height;
            document.body.style.userSelect = 'none';
            const onPointerMove = (moveEvent: PointerEvent) => {
              commitLayoutState(updateFloatingDockNodeBounds(layoutState, floatingNode.id, {
                width: startWidth + (moveEvent.clientX - startX),
                height: startHeight + (moveEvent.clientY - startY),
              }));
            };
            const cleanup = () => {
              document.body.style.userSelect = '';
              window.removeEventListener('pointermove', onPointerMove);
              window.removeEventListener('pointerup', cleanup);
              window.removeEventListener('pointercancel', cleanup);
            };
            window.addEventListener('pointermove', onPointerMove);
            window.addEventListener('pointerup', cleanup);
            window.addEventListener('pointercancel', cleanup);
          }}
          style={{
            position: 'absolute',
            right: 0,
            bottom: 0,
            width: 14,
            height: 14,
            cursor: 'nwse-resize',
            background: 'linear-gradient(135deg, transparent 0%, transparent 40%, var(--overlay-workbench-chrome-border) 40%, var(--overlay-workbench-chrome-border) 100%)',
          }}
        />
      </div>
    );
  }, [
    commitLayoutState,
    draggedSurfaceTabId,
    handleFocusSurface,
    handleHideSurface,
    handleMoveSurface,
    handleSurfaceTabDragStart,
    handleSurfaceTabDrop,
    layoutState,
    renderSurfaceBody,
    surfaceById,
    theme.palette.accent,
    theme.palette.appBackgroundAlt,
    theme.palette.border,
    theme.palette.panelBackground,
    theme.palette.textMuted,
    theme.palette.textPrimary,
    workbench.metrics.panelRadius,
    workbench.surfaces.shellShadow,
  ]);

  const railPlacementStyle = layoutState.activityRailState.placement === 'right'
    ? { order: 2, borderLeft: `1px solid ${theme.palette.border}` }
    : { order: 0, borderRight: `1px solid ${theme.palette.border}` };
  const dockPlacementStyle = layoutState.activityRailState.placement === 'right'
    ? { order: 0 }
    : { order: 2 };
  const railActiveSurfaceId = layoutState.focusedSurfaceId ?? explorerSurface?.id ?? null;

  return (
    <div style={{ position: 'relative', display: 'flex', flex: 1, minWidth: 0, minHeight: 0, overflow: 'hidden' }}>
      <div
        style={{
          ...railPlacementStyle,
          display: 'flex',
          flexDirection: 'column',
          width: layoutState.activityRailState.width,
          minWidth: layoutState.activityRailState.width,
          maxWidth: layoutState.activityRailState.width,
          flexShrink: 0,
          background: theme.palette.shellBackground,
          padding: '8px 6px',
          gap: 8,
          zIndex: 2,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center' }}>
          <DockActionButton
            title={layoutState.activityRailState.placement === 'left' ? 'Move rail right' : 'Move rail left'}
            onClick={() => {
              commitLayoutState(updateIdeRailState(layoutState, {
                placement: layoutState.activityRailState.placement === 'left' ? 'right' : 'left',
              }));
            }}
          >
            {layoutState.activityRailState.placement === 'left' ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
          </DockActionButton>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, overflowY: 'auto', paddingRight: 2 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {primaryRailSurfaces.map((surface) => {
              const isActive = railActiveSurfaceId === surface.id;
              return (
                <button
                  key={`rail:primary:${surface.id}`}
                  type="button"
                  onClick={() => handleFocusSurface(surface.id)}
                  title={surface.label}
                  style={{
                    width: '100%',
                    minHeight: 38,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: 10,
                    border: `1px solid ${isActive ? theme.palette.accent : theme.palette.border}`,
                    background: isActive ? `${theme.palette.accent}22` : 'transparent',
                    color: isActive ? theme.palette.textPrimary : theme.palette.textMuted,
                    cursor: 'pointer',
                  }}
                >
                  {surface.icon}
                </button>
              );
            })}
          </div>
          {secondaryRailSurfaces.length > 0 ? (
            <div
              style={{
                height: 1,
                margin: '0 6px',
                background: theme.palette.border,
                opacity: 0.7,
              }}
            />
          ) : null}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {secondaryRailSurfaces.map((surface) => {
              const isActive = railActiveSurfaceId === surface.id;
              return (
                <button
                  key={`rail:secondary:${surface.id}`}
                  type="button"
                  onClick={() => handleFocusSurface(surface.id)}
                  title={surface.label}
                  style={{
                    width: '100%',
                    minHeight: 34,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: 10,
                    border: `1px solid ${isActive ? theme.palette.accent : theme.palette.border}`,
                    background: isActive ? `${theme.palette.accent}16` : 'transparent',
                    color: isActive ? theme.palette.textPrimary : theme.palette.textMuted,
                    cursor: 'pointer',
                    opacity: 0.82,
                  }}
                >
                  {surface.icon}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div
        style={{
          ...dockPlacementStyle,
          position: 'relative',
          display: 'flex',
          flex: 1,
          minWidth: 0,
          minHeight: 0,
          padding: workbench.metrics.pagePadding,
          gap: workbench.metrics.panelGap,
          overflow: 'hidden',
          background: theme.palette.shellBackground,
        }}
      >
        {renderDockNode(layoutState.rootDockNode)}
        {layoutState.floatingNodes.map(renderFloatingWindow)}
      </div>
    </div>
  );
}
