import React, { useCallback, useEffect, useMemo, useState } from 'react';

import {
  ChevronDown,
  ChevronRight,
  FileText,
  GitBranch,
  LoaderCircle,
  RefreshCw,
} from '../AppIcons';
import type { OverlayPluginVsCodeExtensionRuntimeMetadata } from '../../config/pluginContributions';
import {
  executeVsCodeCommand,
  getVsCodeTreeView,
  refreshVsCodeTreeView,
  VSCODE_BRIDGE_RUNTIME_ID,
  type VsCodeBridgeTreeItem,
} from '../../runtime/vscodeBridgeBackend';
import {
  createExtensionHostClient,
  decodeExtensionHostEventPayload,
} from '../../runtime/extensionHostApi';
import type { ExecutionContextSnapshot } from '../../runtime/externalRuntimeBackend';

interface VsCodeActivityTreeViewProps {
  vscode: OverlayPluginVsCodeExtensionRuntimeMetadata & {
    viewId: string;
  };
  executionContext?: ExecutionContextSnapshot | null;
}

type TreeChildrenByHandle = Record<string, VsCodeBridgeTreeItem[]>;

const ROOT_HANDLE = '__root__';

function isExpandable(item: VsCodeBridgeTreeItem): boolean {
  return item.collapsibleState === 1 || item.collapsibleState === 2;
}

function itemIcon(item: VsCodeBridgeTreeItem) {
  const iconId = item.icon?.id?.toLowerCase() ?? '';
  if (iconId.includes('git') || iconId.includes('branch') || iconId.includes('source')) {
    return <GitBranch size={13} />;
  }
  return <FileText size={13} />;
}

export function VsCodeActivityTreeView({
  vscode,
  executionContext,
}: VsCodeActivityTreeViewProps) {
  const [rootItems, setRootItems] = useState<VsCodeBridgeTreeItem[]>([]);
  const [childrenByHandle, setChildrenByHandle] = useState<TreeChildrenByHandle>({});
  const [expandedHandles, setExpandedHandles] = useState<Set<string>>(() => new Set());
  const [loadingHandles, setLoadingHandles] = useState<Set<string>>(() => new Set());
  const [error, setError] = useState<string | null>(null);

  const treeRequest = useMemo(
    () => ({
      ...vscode,
      activationEvent: `onView:${vscode.viewId}`,
    }),
    [vscode],
  );

  const loadChildren = useCallback(
    async (parentHandle: string | null) => {
      const loadingKey = parentHandle ?? ROOT_HANDLE;
      setLoadingHandles((current) => new Set(current).add(loadingKey));
      setError(null);
      try {
        const result = await getVsCodeTreeView(
          {
            ...treeRequest,
            parentHandle,
          },
          executionContext ?? null,
        );
        if (parentHandle) {
          setChildrenByHandle((current) => ({
            ...current,
            [parentHandle]: result.items,
          }));
        } else {
          setRootItems(result.items);
          setChildrenByHandle({});
        }
      } catch (loadError) {
        setError(String(loadError));
      } finally {
        setLoadingHandles((current) => {
          const next = new Set(current);
          next.delete(loadingKey);
          return next;
        });
      }
    },
    [executionContext, treeRequest],
  );

  useEffect(() => {
    void loadChildren(null);
  }, [loadChildren]);

  useEffect(() => {
    const client = createExtensionHostClient({
      callerRuntimeId: VSCODE_BRIDGE_RUNTIME_ID,
    });
    let disposed = false;
    let unsubscribe: (() => Promise<void>) | null = null;
    void client.events
      .subscribe(
        {
          topics: ['ext.vscode-bridge-host.tree.changed'],
          includeSnapshot: false,
          filters: null,
          replayFrom: null,
          deliveryOverride: null,
        },
        (event) => {
          const payload = decodeExtensionHostEventPayload<{
            extensionId?: string;
            viewId?: string;
          }>(event);
          if (
            payload?.extensionId === vscode.extensionId &&
            payload?.viewId === vscode.viewId
          ) {
            void loadChildren(null);
          }
        },
      )
      .then((subscription) => {
        if (disposed) {
          void subscription.unsubscribe();
          return;
        }
        unsubscribe = subscription.unsubscribe;
      })
      .catch(() => undefined);
    return () => {
      disposed = true;
      if (unsubscribe) {
        void unsubscribe();
      }
    };
  }, [loadChildren, vscode.extensionId, vscode.viewId]);

  const executeItemCommand = useCallback(
    async (item: VsCodeBridgeTreeItem) => {
      if (!item.command?.command) {
        return;
      }
      try {
        await executeVsCodeCommand(
          {
            ...vscode,
            commandId: item.command.command,
          },
          item.command.arguments ?? [],
          executionContext ?? null,
        );
      } catch (commandError) {
        setError(String(commandError));
      }
    },
    [executionContext, vscode],
  );

  const toggleItem = useCallback(
    (item: VsCodeBridgeTreeItem) => {
      if (!isExpandable(item)) {
        void executeItemCommand(item);
        return;
      }
      setExpandedHandles((current) => {
        const next = new Set(current);
        if (next.has(item.handle)) {
          next.delete(item.handle);
        } else {
          next.add(item.handle);
          if (!childrenByHandle[item.handle]) {
            void loadChildren(item.handle);
          }
        }
        return next;
      });
    },
    [childrenByHandle, executeItemCommand, loadChildren],
  );

  const renderItem = useCallback(
    (item: VsCodeBridgeTreeItem, depth: number): React.ReactNode => {
      const expanded = expandedHandles.has(item.handle);
      const children = childrenByHandle[item.handle] ?? [];
      const loading = loadingHandles.has(item.handle);
      return (
        <React.Fragment key={item.handle}>
          <button
            type="button"
            onClick={() => toggleItem(item)}
            onDoubleClick={() => void executeItemCommand(item)}
            data-gfs-vscode-tree-item={item.id}
            style={{
              width: '100%',
              minHeight: 26,
              display: 'grid',
              gridTemplateColumns: '16px 16px minmax(0, 1fr)',
              alignItems: 'center',
              gap: 5,
              padding: `0 8px 0 ${8 + depth * 12}px`,
              border: 0,
              background: 'transparent',
              color: 'var(--overlay-text-primary)',
              font: 'inherit',
              fontSize: 11,
              textAlign: 'left',
              cursor: 'default',
            }}
          >
            <span style={{ display: 'grid', placeItems: 'center', color: 'var(--overlay-text-muted)' }}>
              {isExpandable(item)
                ? expanded
                  ? <ChevronDown size={12} />
                  : <ChevronRight size={12} />
                : null}
            </span>
            <span style={{ display: 'grid', placeItems: 'center', color: 'var(--overlay-text-muted)' }}>
              {loading ? <LoaderCircle size={12} /> : itemIcon(item)}
            </span>
            <span style={{ minWidth: 0, display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span
                style={{
                  minWidth: 0,
                  overflow: 'hidden',
                  whiteSpace: 'nowrap',
                  textOverflow: 'ellipsis',
                }}
              >
                {item.label}
              </span>
              {item.description ? (
                <span
                  style={{
                    minWidth: 0,
                    overflow: 'hidden',
                    whiteSpace: 'nowrap',
                    textOverflow: 'ellipsis',
                    color: 'var(--overlay-text-muted)',
                    fontSize: 10,
                  }}
                >
                  {item.description}
                </span>
              ) : null}
            </span>
          </button>
          {expanded ? children.map((child) => renderItem(child, depth + 1)) : null}
        </React.Fragment>
      );
    },
    [childrenByHandle, executeItemCommand, expandedHandles, loadingHandles, toggleItem],
  );

  const rootLoading = loadingHandles.has(ROOT_HANDLE);

  return (
    <div
      data-gfs-vscode-tree-view={vscode.viewId}
      style={{
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
      }}
    >
      <div
        style={{
          minHeight: 26,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          padding: '0 6px',
          borderBottom: '1px solid var(--overlay-explorer-panel-border)',
        }}
      >
        <button
          type="button"
          aria-label="Refresh"
          onClick={() => {
            void refreshVsCodeTreeView(treeRequest, executionContext ?? null);
            void loadChildren(null);
          }}
          style={{
            width: 22,
            height: 22,
            display: 'grid',
            placeItems: 'center',
            border: 0,
            background: 'transparent',
            color: 'var(--overlay-text-muted)',
          }}
        >
          {rootLoading ? <LoaderCircle size={12} /> : <RefreshCw size={12} />}
        </button>
      </div>
      <div style={{ overflow: 'auto', minHeight: 0, flex: 1, padding: '3px 0' }}>
        {rootItems.length > 0 ? rootItems.map((item) => renderItem(item, 0)) : null}
        {!rootLoading && rootItems.length === 0 && !error ? (
          <div style={{ padding: '8px 10px', color: 'var(--overlay-text-muted)', fontSize: 11 }}>
            Empty
          </div>
        ) : null}
        {error ? (
          <div style={{ padding: '8px 10px', color: 'var(--overlay-danger)', fontSize: 11 }}>
            {error}
          </div>
        ) : null}
      </div>
    </div>
  );
}
