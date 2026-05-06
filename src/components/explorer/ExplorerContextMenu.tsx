import React, {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';

import type {
  OverlayContextMenuNode,
  OverlayContextMenuPresentationOptions,
} from './overlayContextMenuModel';
import { resolveExplorerPopupSurfaceStyle } from './explorerPopupStyles';

interface ExplorerContextMenuProps {
  visible: boolean;
  x: number;
  y: number;
  nodes: OverlayContextMenuNode[];
  portalRoot?: HTMLElement | null;
  themeStyle?: React.CSSProperties;
  presentation?: OverlayContextMenuPresentationOptions | null;
  density?: 'compact' | 'balanced' | 'touch';
  showDescriptions?: boolean;
  onClose: () => void;
  renderIcon: (iconName?: string) => React.ReactNode;
}

interface MenuPanelProps {
  nodes: OverlayContextMenuNode[];
  path: string[];
  density: 'compact' | 'balanced' | 'touch';
  showDescriptions: boolean;
  desiredPosition: {
    left: number;
    top: number;
    anchorRect?: DOMRect | null;
  };
  presentation: OverlayContextMenuPresentationOptions;
  openSubmenuPath: string[];
  activeIndexByPath: Record<string, number>;
  iconRenderer: ExplorerContextMenuProps['renderIcon'];
  onActivateIndex: (pathKey: string, nextIndex: number) => void;
  onSetOpenPath: (path: string[]) => void;
  onClose: () => void;
  anchorRectsByNodeId: Record<string, DOMRect>;
}

const contextMenuPanelMetricVariablesByDensity = {
  compact: {
    minWidth: 'var(--overlay-explorer-context-menu-compact-min-width, 13rem)',
    maxWidth: 'var(--overlay-explorer-context-menu-compact-max-width, 17rem)',
    padding: 'var(--overlay-explorer-context-menu-compact-padding, 0.125rem 0)',
  },
  balanced: {
    minWidth: 'var(--overlay-explorer-context-menu-balanced-min-width, 14.25rem)',
    maxWidth: 'var(--overlay-explorer-context-menu-balanced-max-width, 18.75rem)',
    padding: 'var(--overlay-explorer-context-menu-balanced-padding, 0.25rem 0)',
  },
  touch: {
    minWidth: 'var(--overlay-explorer-context-menu-touch-min-width, 15.5rem)',
    maxWidth: 'var(--overlay-explorer-context-menu-touch-max-width, 21rem)',
    padding: 'var(--overlay-explorer-context-menu-touch-padding, 0.375rem 0)',
  },
} as const;

const contextMenuItemMetricVariablesByDensity = {
  compact: {
    gap: 'var(--overlay-explorer-context-menu-compact-item-gap, 0.5rem)',
    padding: 'var(--overlay-explorer-context-menu-compact-item-padding, 0.375rem 0.625rem)',
    fontSize: 'var(--overlay-explorer-context-menu-compact-font-size, 0.6875rem)',
  },
  balanced: {
    gap: 'var(--overlay-explorer-context-menu-balanced-item-gap, 0.625rem)',
    padding: 'var(--overlay-explorer-context-menu-balanced-item-padding, 0.4375rem 0.75rem)',
    fontSize: 'var(--overlay-explorer-context-menu-balanced-font-size, 0.75rem)',
  },
  touch: {
    gap: 'var(--overlay-explorer-context-menu-touch-item-gap, 0.75rem)',
    padding: 'var(--overlay-explorer-context-menu-touch-item-padding, 0.625rem 0.875rem)',
    fontSize: 'var(--overlay-explorer-context-menu-touch-font-size, 0.75rem)',
  },
} as const;

const contextMenuGridTemplateColumns =
  'var(--overlay-explorer-context-menu-grid-template-columns, 16px minmax(0, 1fr) fit-content(8.5rem))';
const contextMenuShortcutMaxWidth =
  'var(--overlay-explorer-context-menu-shortcut-max-width, 8.5rem)';
const contextMenuShortcutGap =
  'var(--overlay-explorer-context-menu-shortcut-gap, 0.5rem)';
const contextMenuMaxHeight =
  'var(--overlay-explorer-context-menu-max-height, min(70vh, 40rem))';
const contextMenuShadow =
  'var(--overlay-explorer-context-menu-shadow, var(--overlay-explorer-popup-shadow-lg, none))';
const contextMenuSeparatorMargin =
  'var(--overlay-explorer-context-menu-separator-margin, 0.25rem 0)';
const contextMenuSeparatorColor =
  'var(--overlay-explorer-context-menu-separator, var(--overlay-border, rgba(255, 255, 255, 0.1)))';
const contextMenuItemTextColor =
  'var(--overlay-explorer-context-menu-item-text, var(--overlay-text-primary, inherit))';
const contextMenuMutedTextColor =
  'var(--overlay-explorer-context-menu-item-muted, var(--overlay-text-muted, currentColor))';
const contextMenuActiveBackground =
  'var(--overlay-explorer-context-menu-item-active-bg, var(--overlay-bg-card-hover, rgba(255, 255, 255, 0.08)))';
const contextMenuDangerBackground =
  'var(--overlay-explorer-context-menu-item-danger-bg, rgba(232, 170, 170, 0.14))';
const contextMenuDangerText =
  'var(--overlay-explorer-context-menu-danger-text, var(--overlay-danger, currentColor))';
const contextMenuIconOpacity =
  'var(--overlay-explorer-context-menu-icon-opacity, 0.78)';
const contextMenuDisabledOpacity =
  'var(--overlay-explorer-context-menu-disabled-opacity, 0.55)';
const contextMenuDescriptionFontSize =
  'var(--overlay-explorer-context-menu-description-font-size, 0.625rem)';
const contextMenuDescriptionLineHeight =
  'var(--overlay-explorer-context-menu-description-line-height, 1.2)';
const contextMenuShortcutFontSize =
  'var(--overlay-explorer-context-menu-shortcut-font-size, 0.625rem)';
const contextMenuSubmenuInactiveOpacity =
  'var(--overlay-explorer-context-menu-submenu-indicator-opacity, 0.7)';

function getPathKey(path: string[]): string {
  return path.length > 0 ? path.join('/') : 'root';
}

function findFirstSelectableIndex(nodes: OverlayContextMenuNode[]): number {
  const index = nodes.findIndex((node) => node.kind !== 'separator');
  return index >= 0 ? index : 0;
}

function findNextSelectableIndex(
  nodes: OverlayContextMenuNode[],
  startIndex: number,
  direction: 'up' | 'down',
): number {
  if (nodes.length === 0) {
    return 0;
  }

  let currentIndex = startIndex;
  for (let attempts = 0; attempts < nodes.length; attempts += 1) {
    currentIndex =
      direction === 'down'
        ? (currentIndex + 1) % nodes.length
        : (currentIndex - 1 + nodes.length) % nodes.length;
    if (nodes[currentIndex]?.kind !== 'separator') {
      return currentIndex;
    }
  }
  return startIndex;
}

function clampPanelPosition(
  width: number,
  height: number,
  desiredPosition: MenuPanelProps['desiredPosition'],
): { left: number; top: number } {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  let left = desiredPosition.left;
  let top = desiredPosition.top;
  if (desiredPosition.anchorRect) {
    if (left + width > viewportWidth - 8) {
      left = desiredPosition.anchorRect.left - width + 4;
    }
    if (left < 8) {
      left = Math.max(8, viewportWidth - width - 8);
    }
  } else if (left + width > viewportWidth - 8) {
    left = viewportWidth - width - 8;
  }

  if (top + height > viewportHeight - 8) {
    top = viewportHeight - height - 8;
  }

  return {
    left: Math.max(8, left),
    top: Math.max(8, top),
  };
}

function MenuPanel({
  nodes,
  path,
  density,
  showDescriptions,
  desiredPosition,
  presentation,
  openSubmenuPath,
  activeIndexByPath,
  iconRenderer,
  onActivateIndex,
  onSetOpenPath,
  onClose,
  anchorRectsByNodeId,
}: MenuPanelProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const pathKey = getPathKey(path);
  const activeIndex = activeIndexByPath[pathKey] ?? findFirstSelectableIndex(nodes);
  const panelMetrics = contextMenuPanelMetricVariablesByDensity[density];
  const itemMetrics = contextMenuItemMetricVariablesByDensity[density];
  const [position, setPosition] = useState(() => ({
    left: desiredPosition.left,
    top: desiredPosition.top,
  }));

  useLayoutEffect(() => {
    if (!panelRef.current) {
      return;
    }

    const rect = panelRef.current.getBoundingClientRect();
    setPosition(clampPanelPosition(rect.width, rect.height, desiredPosition));
  }, [desiredPosition, nodes.length]);

  const openSubmenuId = openSubmenuPath[path.length];
  const openSubmenuNode =
    openSubmenuId != null
      ? nodes.find(
          (node): node is Extract<OverlayContextMenuNode, { kind: 'submenu' }> =>
            node.kind === 'submenu' && node.id === openSubmenuId,
        ) ?? null
      : null;
  const openSubmenuAnchor = openSubmenuNode
    ? anchorRectsByNodeId[openSubmenuNode.id] ?? null
    : null;

  return (
    <>
      <div
        ref={panelRef}
        data-overlay-explorer-context-menu-panel={pathKey}
        data-overlay-explorer-context-menu-density={density}
        data-overlay-explorer-context-menu-material={presentation.materialStyle ?? 'default'}
        data-overlay-explorer-context-menu-focus-style={presentation.focusStyle ?? 'line'}
        style={{
          ...resolveExplorerPopupSurfaceStyle({
            materialStyle: presentation.materialStyle,
            minWidth: panelMetrics.minWidth,
            maxWidth: panelMetrics.maxWidth,
            maxHeight: contextMenuMaxHeight,
            padding: panelMetrics.padding,
          }),
          position: 'fixed',
          left: position.left,
          top: position.top,
          zIndex: 10000 + path.length,
          boxShadow: contextMenuShadow,
        }}
      >
        {nodes.map((node, index) => {
          if (node.kind === 'separator') {
            return (
              <div
                key={node.id}
                style={{
                  height: 1,
                  margin: contextMenuSeparatorMargin,
                  background: contextMenuSeparatorColor,
                }}
              />
            );
          }

          const active = activeIndex === index;
          const submenuOpen = openSubmenuId === node.id && node.kind === 'submenu';
          const disabled = node.kind === 'command' && node.disabled === true;
          return (
            <button
              key={node.id}
              data-overlay-explorer-context-menu-node={node.id}
              type="button"
              disabled={disabled}
              onMouseEnter={(event) => {
                if (disabled) {
                  return;
                }
                onActivateIndex(pathKey, index);
                if (node.kind === 'submenu') {
                  anchorRectsByNodeId[node.id] = event.currentTarget.getBoundingClientRect();
                  onSetOpenPath([...path, node.id]);
                  return;
                }
                onSetOpenPath(path);
              }}
              onClick={() => {
                if (disabled) {
                  return;
                }
                if (node.kind === 'submenu') {
                  onSetOpenPath([...path, node.id]);
                  return;
                }
                void Promise.resolve(node.onSelect()).catch(() => undefined);
                onClose();
              }}
              style={{
                display: 'grid',
                gridTemplateColumns: contextMenuGridTemplateColumns,
                alignItems: 'center',
                gap: itemMetrics.gap,
                width: '100%',
                minWidth: 0,
                padding: itemMetrics.padding,
                border: 'none',
                background: active
                  ? node.tone === 'danger'
                    ? contextMenuDangerBackground
                    : contextMenuActiveBackground
                  : 'transparent',
                color:
                  node.tone === 'danger'
                    ? contextMenuDangerText
                    : contextMenuItemTextColor,
                cursor: disabled ? 'default' : 'pointer',
                fontSize: itemMetrics.fontSize,
                textAlign: 'left',
                opacity: disabled ? contextMenuDisabledOpacity : 1,
              }}
            >
              <span
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  opacity: contextMenuIconOpacity,
                }}
              >
                {iconRenderer(node.iconName)}
              </span>
              <span
                style={{
                  minWidth: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 2,
                }}
              >
                <span
                  style={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {node.label}
                </span>
                {showDescriptions && node.kind === 'command' && node.description ? (
                  <span
                    style={{
                      color: contextMenuMutedTextColor,
                      display: 'block',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      fontSize: contextMenuDescriptionFontSize,
                      lineHeight: contextMenuDescriptionLineHeight,
                    }}
                  >
                    {node.description}
                  </span>
                ) : null}
              </span>
              <span
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  gap: contextMenuShortcutGap,
                  minWidth: 0,
                  maxWidth: contextMenuShortcutMaxWidth,
                  overflow: 'hidden',
                  color: contextMenuMutedTextColor,
                  fontSize: contextMenuShortcutFontSize,
                  whiteSpace: 'nowrap',
                }}
              >
                {node.kind === 'command' && node.shortcutId ? (
                  <span
                    style={{
                      minWidth: 0,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {node.shortcutId}
                  </span>
                ) : null}
                {node.kind === 'submenu' ? (
                  <span
                    style={{
                      opacity: submenuOpen
                        ? 1
                        : contextMenuSubmenuInactiveOpacity,
                    }}
                  >
                    ▶
                  </span>
                ) : null}
              </span>
            </button>
          );
        })}
      </div>

      {openSubmenuNode && openSubmenuAnchor ? (
        <MenuPanel
          nodes={openSubmenuNode.children}
          path={[...path, openSubmenuNode.id]}
          desiredPosition={{
            left: openSubmenuAnchor.right - 4,
            top: openSubmenuAnchor.top - 4,
            anchorRect: openSubmenuAnchor,
          }}
          density={density}
          showDescriptions={showDescriptions}
          presentation={presentation}
          openSubmenuPath={openSubmenuPath}
          activeIndexByPath={activeIndexByPath}
          iconRenderer={iconRenderer}
          onActivateIndex={onActivateIndex}
          onSetOpenPath={onSetOpenPath}
          onClose={onClose}
          anchorRectsByNodeId={anchorRectsByNodeId}
        />
      ) : null}
    </>
  );
}

export function ExplorerContextMenu({
  visible,
  x,
  y,
  nodes,
  portalRoot,
  themeStyle,
  presentation,
  density = 'balanced',
  showDescriptions = true,
  onClose,
  renderIcon,
}: ExplorerContextMenuProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const anchorRectsByNodeIdRef = useRef<Record<string, DOMRect>>({});
  const [openSubmenuPath, setOpenSubmenuPath] = useState<string[]>([]);
  const [activeIndexByPath, setActiveIndexByPath] = useState<Record<string, number>>({
    root: findFirstSelectableIndex(nodes),
  });

  const rootNodes = useMemo(() => nodes, [nodes]);
  const resolvedDensity = presentation?.density ?? density;
  const resolvedShowDescriptions =
    presentation?.showDescriptions ?? showDescriptions;
  const resolvedPresentation = useMemo<OverlayContextMenuPresentationOptions>(
    () => ({
      ...(presentation ?? {}),
      density: resolvedDensity,
      showDescriptions: resolvedShowDescriptions,
    }),
    [presentation, resolvedDensity, resolvedShowDescriptions],
  );

  useEffect(() => {
    if (!visible) {
      return;
    }

    const closeOnMouseDown = (event: MouseEvent) => {
      if (rootRef.current && rootRef.current.contains(event.target as Node)) {
        return;
      }
      onClose();
    };

    window.addEventListener('mousedown', closeOnMouseDown, true);
    return () => window.removeEventListener('mousedown', closeOnMouseDown, true);
  }, [visible, onClose]);

  useEffect(() => {
    if (!visible) {
      return;
    }
    setOpenSubmenuPath([]);
    setActiveIndexByPath({ root: findFirstSelectableIndex(rootNodes) });
    window.requestAnimationFrame(() => rootRef.current?.focus());
  }, [rootNodes, visible]);

  if (!visible || rootNodes.length === 0) {
    return null;
  }

  const rememberNodeAnchorRect = (nodeId: string) => {
    const nodeElement = Array.from(
      rootRef.current?.querySelectorAll<HTMLElement>('[data-overlay-explorer-context-menu-node]')
      ?? [],
    ).find((element) => element.dataset.overlayExplorerContextMenuNode === nodeId);
    if (nodeElement) {
      anchorRectsByNodeIdRef.current[nodeId] = nodeElement.getBoundingClientRect();
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const currentPath = openSubmenuPath;
    const currentPathKey = getPathKey(currentPath);
    let currentNodes: OverlayContextMenuNode[] = rootNodes;
    currentPath.forEach((submenuId) => {
      const submenuNode = currentNodes.find(
        (node): node is Extract<OverlayContextMenuNode, { kind: 'submenu' }> =>
          node.kind === 'submenu' && node.id === submenuId,
      );
      if (submenuNode) {
        currentNodes = submenuNode.children;
      }
    });
    const activeIndex =
      activeIndexByPath[currentPathKey] ?? findFirstSelectableIndex(currentNodes);
    const activeNode = currentNodes[activeIndex];

    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
      return;
    }

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const nextIndex = findNextSelectableIndex(
        currentNodes,
        activeIndex,
        event.key === 'ArrowDown' ? 'down' : 'up',
      );
      setActiveIndexByPath((current) => ({
        ...current,
        [currentPathKey]: nextIndex,
      }));
      return;
    }

    if (event.key === 'ArrowRight') {
      if (activeNode?.kind === 'submenu') {
        event.preventDefault();
        rememberNodeAnchorRect(activeNode.id);
        setOpenSubmenuPath([...currentPath, activeNode.id]);
        setActiveIndexByPath((current) => ({
          ...current,
          [getPathKey([...currentPath, activeNode.id])]: findFirstSelectableIndex(
            activeNode.children,
          ),
        }));
      }
      return;
    }

    if (event.key === 'ArrowLeft') {
      if (currentPath.length > 0) {
        event.preventDefault();
        setOpenSubmenuPath(currentPath.slice(0, -1));
      }
      return;
    }

    if (event.key === 'Enter' || event.key === ' ') {
      if (!activeNode || activeNode.kind === 'separator') {
        return;
      }
      event.preventDefault();
      if (activeNode.kind === 'submenu') {
        rememberNodeAnchorRect(activeNode.id);
        setOpenSubmenuPath([...currentPath, activeNode.id]);
        setActiveIndexByPath((current) => ({
          ...current,
          [getPathKey([...currentPath, activeNode.id])]: findFirstSelectableIndex(
            activeNode.children,
          ),
        }));
        return;
      }
      void Promise.resolve(activeNode.onSelect()).catch(() => undefined);
      onClose();
    }
  };

  const resolvedPortalRoot =
    portalRoot ?? (typeof document !== 'undefined' ? document.body : null);
  if (!resolvedPortalRoot) {
    return null;
  }

  return createPortal(
    <div
      ref={rootRef}
      tabIndex={-1}
      data-overlay-explorer-floating-surface="true"
      data-overlay-explorer-floating-surface-group="explorer-context-menu"
      data-overlay-explorer-context-menu-renderer={
        resolvedPresentation.renderer ?? 'classic'
      }
      data-overlay-explorer-context-menu-density={resolvedDensity}
      data-overlay-explorer-context-menu-shape={
        resolvedPresentation.shapeLanguage ?? 'classic'
      }
      data-overlay-explorer-context-menu-material={
        resolvedPresentation.materialStyle ?? 'default'
      }
      data-overlay-explorer-context-menu-backdrop={
        resolvedPresentation.backdropStyle ?? 'none'
      }
      onKeyDown={handleKeyDown}
      style={{
        ...themeStyle,
        position: 'fixed',
        inset: 0,
        zIndex: 'var(--overlay-explorer-floating-context-layer, 9998)',
        outline: 'none',
      }}
    >
      <MenuPanel
        nodes={rootNodes}
        path={[]}
        density={resolvedDensity}
        showDescriptions={resolvedShowDescriptions}
        desiredPosition={{ left: x, top: y }}
        presentation={resolvedPresentation}
        openSubmenuPath={openSubmenuPath}
        activeIndexByPath={activeIndexByPath}
        iconRenderer={renderIcon}
        onActivateIndex={(pathKey, nextIndex) => {
          setActiveIndexByPath((current) => ({
            ...current,
            [pathKey]: nextIndex,
          }));
        }}
        onSetOpenPath={setOpenSubmenuPath}
        onClose={onClose}
        anchorRectsByNodeId={anchorRectsByNodeIdRef.current}
      />
    </div>,
    resolvedPortalRoot,
  );
}
