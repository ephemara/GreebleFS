import React, {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import type { ExplorerRuntimeMenuNode } from './explorerMenuRuntime';

interface ExplorerContextMenuProps {
  visible: boolean;
  x: number;
  y: number;
  nodes: ExplorerRuntimeMenuNode[];
  onClose: () => void;
  renderIcon: (iconName?: string) => React.ReactNode;
}

interface MenuPanelProps {
  nodes: ExplorerRuntimeMenuNode[];
  path: string[];
  desiredPosition: {
    left: number;
    top: number;
    anchorRect?: DOMRect | null;
  };
  openSubmenuPath: string[];
  activeIndexByPath: Record<string, number>;
  iconRenderer: ExplorerContextMenuProps['renderIcon'];
  onActivateIndex: (pathKey: string, nextIndex: number) => void;
  onSetOpenPath: (path: string[]) => void;
  onClose: () => void;
  anchorRectsByNodeId: Record<string, DOMRect>;
}

function getPathKey(path: string[]): string {
  return path.length > 0 ? path.join('/') : 'root';
}

function findFirstSelectableIndex(nodes: ExplorerRuntimeMenuNode[]): number {
  const index = nodes.findIndex((node) => node.kind !== 'separator');
  return index >= 0 ? index : 0;
}

function findNextSelectableIndex(
  nodes: ExplorerRuntimeMenuNode[],
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
  desiredPosition,
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
          (node): node is Extract<ExplorerRuntimeMenuNode, { kind: 'submenu' }> =>
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
        style={{
          position: 'fixed',
          left: position.left,
          top: position.top,
          zIndex: 10000 + path.length,
          minWidth: 228,
          maxWidth: 300,
          maxHeight: 'min(70vh, 640px)',
          overflowY: 'auto',
          background: 'var(--overlay-explorer-preview-bg)',
          border: '1px solid var(--overlay-explorer-preview-border)',
          borderRadius: 'var(--overlay-explorer-panel-radius)',
          boxShadow: 'var(--overlay-explorer-ctx-menu-shadow)',
          padding: '4px 0',
          backdropFilter: 'blur(14px)',
        }}
      >
        {nodes.map((node, index) => {
          if (node.kind === 'separator') {
            return (
              <div
                key={node.id}
                style={{
                  height: 1,
                  margin: '4px 0',
                  background: 'var(--overlay-explorer-preview-border)',
                }}
              />
            );
          }

          const active = activeIndex === index;
          const submenuOpen = openSubmenuId === node.id && node.kind === 'submenu';
          return (
            <button
              key={node.id}
              data-overlay-explorer-context-menu-node={node.id}
              type="button"
              onMouseEnter={(event) => {
                onActivateIndex(pathKey, index);
                if (node.kind === 'submenu') {
                  anchorRectsByNodeId[node.id] = event.currentTarget.getBoundingClientRect();
                  onSetOpenPath([...path, node.id]);
                  return;
                }
                onSetOpenPath(path);
              }}
              onClick={() => {
                if (node.kind === 'submenu') {
                  onSetOpenPath([...path, node.id]);
                  return;
                }
                void Promise.resolve(node.onSelect()).catch(() => undefined);
                onClose();
              }}
              style={{
                display: 'grid',
                gridTemplateColumns: '16px minmax(0, 1fr) auto',
                alignItems: 'center',
                gap: 10,
                width: '100%',
                padding: '7px 12px',
                border: 'none',
                background: active
                  ? node.tone === 'danger'
                    ? 'var(--overlay-explorer-danger-soft-bg)'
                    : 'var(--overlay-explorer-chip-active-bg)'
                  : 'transparent',
                color:
                  node.tone === 'danger'
                    ? 'var(--overlay-explorer-danger-text)'
                    : 'var(--overlay-text-primary)',
                cursor: 'pointer',
                fontSize: 12,
                textAlign: 'left',
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', opacity: 0.78 }}>
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
                <span>{node.label}</span>
                {node.kind === 'command' && node.description ? (
                  <span
                    style={{
                      color: 'var(--overlay-text-muted)',
                      fontSize: 10,
                      lineHeight: 1.2,
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
                  gap: 8,
                  color: 'var(--overlay-text-muted)',
                  fontSize: 10,
                }}
              >
                {node.kind === 'command' && node.shortcutId ? (
                  <span>{node.shortcutId}</span>
                ) : null}
                {node.kind === 'submenu' ? (
                  <span style={{ opacity: submenuOpen ? 1 : 0.7 }}>▶</span>
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
    let currentNodes: ExplorerRuntimeMenuNode[] = rootNodes;
    currentPath.forEach((submenuId) => {
      const submenuNode = currentNodes.find(
        (node): node is Extract<ExplorerRuntimeMenuNode, { kind: 'submenu' }> =>
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

  return (
    <div
      ref={rootRef}
      tabIndex={-1}
      onKeyDown={handleKeyDown}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        outline: 'none',
      }}
    >
      <MenuPanel
        nodes={rootNodes}
        path={[]}
        desiredPosition={{ left: x, top: y }}
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
    </div>
  );
}
