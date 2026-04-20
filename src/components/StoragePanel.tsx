import {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type RefObject,
  type ReactNode,
} from 'react';
import { useShallow } from 'zustand/react/shallow';
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Eye,
  File,
  Folder,
  FolderOpen,
  HardDrive,
  LoaderCircle,
  RefreshCw,
  ScanLine,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react';
import {
  deleteStorageEntries,
  deleteStorageEntry,
  getStorageRoots,
  isStorageProcessElevated,
  listStorageDirectory,
  openStorageEntry,
  pollStorageScan,
  revealStorageEntry,
  startStorageScan,
  trashStorageEntries,
  trashStorageEntry,
  type StorageRootInfo,
  type StorageScanEntry,
  type StorageScanSnapshot,
  type StorageTypeBucketSnapshot,
} from '../runtime/storageBackend';
import { OverlayScrollArea } from './OverlayScrollArea';
import { ResizablePane, usePersistentPanelSize } from './ResizablePane';
import { layoutStorageTreemap } from './storage/storageTreemap';
import {
  buildStorageMatrixRows,
  createStorageRootSummary,
  getParentPath,
  isStorageSnapshotReadyForDirectoryLoads,
  normalizeStorageWorkbenchPath,
  resolveTreemapFocusNode,
  sortStorageTypeBuckets,
  summarizeQueueEntries,
  type StorageMatrixRow,
} from './storage/storageWorkbench';
import {
  useStorageWorkbenchStore,
  type StorageQueuedItem,
  type StorageWorkbenchMode,
} from '../store/storageStore';
import {
  getStorageBatchQueueDefinition,
  type StorageBatchQueueActionId,
} from '../config/storageBatchQueues';
import { ExplorerFolderPreview } from './ExplorerFolderPreview';
import { ExplorerTaskStatusBadge } from './explorer/ExplorerTaskStatusBadge';
import { useExplorerTaskProgressFeed } from '../store/explorerTaskStore';

const POLL_INTERVAL_MS = 450;
const TREEMAP_WIDTH = 960;
const TREEMAP_HEIGHT = 420;
const STORAGE_RAIL_WIDTH_KEY = 'greeblefs-storage-rail-width-v2';
const STORAGE_RAIL_WIDTH_DEFAULT = 268;
const STORAGE_RAIL_WIDTH_MIN = 220;
const STORAGE_RAIL_WIDTH_MAX = 360;

interface StorageContextMenuState {
  path: string;
  x: number;
  y: number;
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return '0 B';
  }
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / (1024 ** exponent);
  return `${value >= 100 || exponent === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[exponent]}`;
}

function formatPercent(value: number): string {
  if (!Number.isFinite(value)) {
    return '0%';
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)}%`;
}

function formatCount(value: number): string {
  return new Intl.NumberFormat().format(Math.max(0, value));
}

function hashString(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash) + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
}

function resolveNodeIcon(entry: StorageScanEntry, expanded = false): ReactNode {
  if (entry.kind === 'directory') {
    return expanded ? <FolderOpen size={14} /> : <Folder size={14} />;
  }
  return <File size={14} />;
}

function StoragePercentBar({
  color,
  value,
}: {
  color?: string;
  value: number;
}) {
  const clampedValue = Math.max(0, Math.min(100, value));
  return (
    <div
      style={{
        width: '100%',
        height: 8,
        borderRadius: 999,
        overflow: 'hidden',
        background: 'rgba(255,255,255,0.08)',
      }}
    >
      <div
        style={{
          width: `${clampedValue}%`,
          minWidth: clampedValue > 0 ? 2 : 0,
          height: '100%',
          borderRadius: 999,
          background: color ?? 'linear-gradient(90deg, color-mix(in srgb, var(--overlay-accent) 78%, #fff), color-mix(in srgb, var(--overlay-accent) 38%, #0b0b0b))',
        }}
      />
    </div>
  );
}

function resolveNodeFill(entry: StorageScanEntry): string {
  if (entry.kind === 'other') {
    return 'rgba(255,255,255,0.12)';
  }

  const key = entry.kind === 'file'
    ? entry.extension ?? entry.name
    : entry.path;
  const hue = hashString(key) % 360;
  const saturation = entry.kind === 'directory' ? 54 : 72;
  const lightness = entry.kind === 'directory' ? 34 : 46;
  return `hsl(${hue} ${saturation}% ${lightness}%)`;
}

function ActionButton({
  children,
  disabled = false,
  onClick,
  tone = 'default',
  style,
}: {
  children: ReactNode;
  disabled?: boolean;
  onClick: () => void;
  tone?: 'default' | 'accent' | 'danger';
  style?: CSSProperties;
}) {
  const borderColor = tone === 'danger'
    ? 'rgba(255,114,114,0.32)'
    : tone === 'accent'
      ? 'color-mix(in srgb, var(--overlay-accent) 52%, transparent)'
      : 'var(--overlay-border)';
  const textColor = tone === 'danger'
    ? '#ff9b9b'
    : tone === 'accent'
      ? 'var(--overlay-accent)'
      : 'var(--overlay-text-primary)';

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        minHeight: 30,
        padding: '0 10px',
        borderRadius: 9,
        border: `1px solid ${borderColor}`,
        background: disabled
          ? 'rgba(255,255,255,0.03)'
          : tone === 'danger'
            ? 'rgba(120, 30, 30, 0.18)'
            : tone === 'accent'
              ? 'color-mix(in srgb, var(--overlay-accent) 12%, rgba(255,255,255,0.03))'
              : 'rgba(255,255,255,0.04)',
        color: disabled ? 'var(--overlay-text-muted)' : textColor,
        cursor: disabled ? 'default' : 'pointer',
        fontSize: 11.5,
        fontWeight: 700,
        ...style,
      }}
    >
      {children}
    </button>
  );
}

function SurfaceCard({
  children,
  style,
  title,
  subtitle,
  actions,
}: {
  children: ReactNode;
  style?: CSSProperties;
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <section
      style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        borderRadius: 14,
        border: '1px solid var(--overlay-border)',
        background: 'color-mix(in srgb, var(--overlay-panel-bg) 95%, rgba(255,255,255,0.02))',
        boxShadow: '0 12px 28px rgba(0,0,0,0.12)',
        overflow: 'hidden',
        ...style,
      }}
    >
      {title ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            padding: '10px 12px',
            borderBottom: '1px solid var(--overlay-border)',
            background: 'linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.01))',
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                color: 'var(--overlay-text-primary)',
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}
            >
              {title}
            </div>
            {subtitle ? (
              <div style={{ marginTop: 3, color: 'var(--overlay-text-secondary)', fontSize: 10.5 }}>
                {subtitle}
              </div>
            ) : null}
          </div>
          {actions}
        </div>
      ) : null}
      <div style={{ flex: 1, minHeight: 0 }}>{children}</div>
    </section>
  );
}

function ModeChip({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 28,
        padding: '0 10px',
        borderRadius: 999,
        border: active
          ? '1px solid color-mix(in srgb, var(--overlay-accent) 62%, var(--overlay-border))'
          : '1px solid var(--overlay-border)',
        background: active
          ? 'color-mix(in srgb, var(--overlay-accent) 12%, rgba(255,255,255,0.03))'
          : 'rgba(255,255,255,0.03)',
        color: active ? 'var(--overlay-accent)' : 'var(--overlay-text-secondary)',
        cursor: 'pointer',
        fontSize: 10.5,
        fontWeight: 700,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
      }}
    >
      {label}
    </button>
  );
}

function StorageMetric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div
      style={{
        display: 'grid',
        gap: 4,
        minWidth: 0,
        padding: '8px 10px',
        borderRadius: 10,
        border: '1px solid var(--overlay-border)',
        background: 'rgba(255,255,255,0.03)',
      }}
    >
      <div style={{ fontSize: 9.5, color: 'var(--overlay-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        {label}
      </div>
      <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--overlay-text-primary)' }}>
        {value}
      </div>
      {detail ? (
        <div style={{ fontSize: 10, color: 'var(--overlay-text-muted)', lineHeight: 1.35 }}>
          {detail}
        </div>
      ) : null}
    </div>
  );
}

function buildQueuedItem(entry: StorageScanEntry): StorageQueuedItem {
  return {
    path: entry.path,
    name: entry.name,
    kind: entry.kind,
    logicalBytes: entry.logicalBytes,
    allocatedBytes: entry.allocatedBytes,
    wasteBytes: entry.wasteBytes,
    extension: entry.extension ?? null,
  };
}

function matchesQueueFilter(item: StorageQueuedItem, query: string): boolean {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return true;
  }
  return item.name.toLowerCase().includes(normalizedQuery)
    || item.path.toLowerCase().includes(normalizedQuery)
    || (item.extension ?? '').toLowerCase().includes(normalizedQuery);
}

function StorageStatusBanner({
  error,
  isElevated,
  notice,
}: {
  error: string | null;
  isElevated: boolean | null;
  notice: string | null;
}) {
  if (error) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '12px 14px',
          borderRadius: 14,
          border: '1px solid rgba(255,114,114,0.28)',
          background: 'rgba(120,30,30,0.2)',
          color: '#ffb0b0',
        }}
      >
        <AlertTriangle size={16} />
        <span style={{ fontSize: 12.5 }}>{error}</span>
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '12px 14px',
        borderRadius: 14,
        border: `1px solid ${isElevated ? 'rgba(68,187,123,0.22)' : 'var(--overlay-border)'}`,
        background: isElevated
          ? 'rgba(28, 81, 53, 0.22)'
          : 'rgba(255,255,255,0.03)',
        color: 'var(--overlay-text-primary)',
      }}
    >
      {isElevated ? <ShieldCheck size={16} /> : <ShieldAlert size={16} />}
      <span style={{ fontSize: 12.5 }}>
        {notice ?? (isElevated
          ? 'GreebleFS is running elevated. Protected system paths can be deleted if the OS permits it.'
          : 'Storage cleanup is limited by current process permissions. Run elevated for protected-path parity.')}
      </span>
    </div>
  );
}

function StorageRail({
  activeRootPath,
  isElevated,
  onBeginScan,
  onClearQueue,
  onExecuteQueue,
  onRefreshRoots,
  onRemoveQueuePath,
  onSelectQueuePath,
  queueFilterQuery,
  queueItems,
  roots,
  rootsError,
  rootsLoading,
  scanStatus,
  selectedPathSet,
  setQueueFilterQuery,
}: {
  activeRootPath: string | null;
  isElevated: boolean | null;
  onBeginScan: (rootPath: string) => void;
  onClearQueue: () => void;
  onExecuteQueue: (actionId: StorageBatchQueueActionId) => void;
  onRefreshRoots: () => void;
  onRemoveQueuePath: (path: string) => void;
  onSelectQueuePath: (path: string) => void;
  queueFilterQuery: string;
  queueItems: StorageQueuedItem[];
  roots: StorageRootInfo[];
  rootsError: string | null;
  rootsLoading: boolean;
  scanStatus: StorageScanSnapshot | null;
  selectedPathSet: Set<string>;
  setQueueFilterQuery: (query: string) => void;
}) {
  const queueDefinition = getStorageBatchQueueDefinition('cleanup');
  const filteredQueueItems = queueItems.filter((item) => matchesQueueFilter(item, queueFilterQuery));
  const queueSummary = summarizeQueueEntries(queueItems);

  return (
    <OverlayScrollArea
      style={{ flex: 1, minHeight: 0 }}
      scrollbarStyle="explorer-file-list"
      viewportStyle={{ padding: 12 }}
    >
      <div style={{ display: 'grid', gap: 12 }}>
        <SurfaceCard
          title="Roots"
          subtitle={rootsLoading ? 'Loading local volumes.' : `${roots.length} local roots detected`}
          actions={(
            <ActionButton onClick={onRefreshRoots} disabled={rootsLoading}>
              <RefreshCw size={13} />
              Refresh
            </ActionButton>
          )}
        >
          {rootsLoading ? (
            <div style={{ display: 'grid', placeItems: 'center', minHeight: 120, color: 'var(--overlay-text-muted)' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                <LoaderCircle size={15} className="spin" />
                Loading drives...
              </span>
            </div>
          ) : rootsError ? (
            <div style={{ minHeight: 120, padding: 14, color: '#ffb0b0', fontSize: 12.5 }}>
              {rootsError}
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 8, padding: 10 }}>
              {roots.map((root) => {
                const usedBytes = Math.max(0, root.total_bytes - root.free_bytes);
                const usedPercent = root.total_bytes > 0 ? (usedBytes / root.total_bytes) * 100 : 0;
                const active = root.path === activeRootPath;
                return (
                  <button
                    key={root.id}
                    type="button"
                    onClick={() => onBeginScan(root.path)}
                    style={{
                      display: 'grid',
                      gap: 8,
                      padding: 10,
                      borderRadius: 12,
                      border: active
                        ? '1px solid color-mix(in srgb, var(--overlay-accent) 62%, var(--overlay-border))'
                        : '1px solid var(--overlay-border)',
                      background: active
                        ? 'color-mix(in srgb, var(--overlay-accent) 10%, rgba(255,255,255,0.03))'
                        : 'rgba(255,255,255,0.03)',
                      color: 'var(--overlay-text-primary)',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                      <div
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: 10,
                          display: 'grid',
                          placeItems: 'center',
                          background: 'rgba(255,255,255,0.06)',
                          color: 'var(--overlay-accent)',
                          flexShrink: 0,
                        }}
                      >
                        <HardDrive size={15} />
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {root.label || root.path}
                        </div>
                        <div style={{ marginTop: 2, fontSize: 10.5, color: 'var(--overlay-text-secondary)' }}>
                          {root.path} · {root.drive_type}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'grid', gap: 6 }}>
                      <div style={{ width: '100%', height: 6, borderRadius: 999, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                        <div style={{ width: `${Math.max(4, Math.min(100, usedPercent))}%`, height: '100%', background: 'linear-gradient(90deg, color-mix(in srgb, var(--overlay-accent) 82%, #fff), color-mix(in srgb, var(--overlay-accent) 38%, #0b0b0b))' }} />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 11, color: 'var(--overlay-text-secondary)' }}>
                        <span>{formatBytes(usedBytes)} used</span>
                        <span>{formatBytes(root.free_bytes)} free</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </SurfaceCard>

        <SurfaceCard
          title={queueDefinition.label}
          subtitle={`${formatCount(queueItems.length)} staged`}
        >
          <div style={{ display: 'grid', gap: 10, padding: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 6 }}>
              {queueDefinition.supportedActions.map((action) => (
                <ActionButton
                  key={action.id}
                  disabled={queueItems.length === 0}
                  onClick={() => onExecuteQueue(action.id)}
                  tone={action.tone}
                >
                  {action.label}
                </ActionButton>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
              <StorageMetric label="Queued" value={formatCount(queueItems.length)} />
              <StorageMetric label="Allocated" value={formatBytes(queueSummary.allocatedBytes)} />
            </div>
            <input
              value={queueFilterQuery}
              onChange={(event) => setQueueFilterQuery(event.target.value)}
              placeholder="Filter queued paths"
              style={{
                width: '100%',
                minHeight: 34,
                borderRadius: 10,
                border: '1px solid var(--overlay-border)',
                background: 'rgba(255,255,255,0.03)',
                color: 'var(--overlay-text-primary)',
                padding: '0 12px',
                outline: 'none',
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
              <div style={{ fontSize: 11, color: 'var(--overlay-text-secondary)' }}>
                {formatBytes(queueSummary.logicalBytes)} logical · {formatBytes(queueSummary.wasteBytes)} waste
              </div>
              <ActionButton disabled={queueItems.length === 0} onClick={onClearQueue}>
                Clear
              </ActionButton>
            </div>
            {filteredQueueItems.length === 0 ? (
              <div style={{ padding: '10px 0', fontSize: 11, color: 'var(--overlay-text-muted)', lineHeight: 1.5 }}>
                Stage files or folders here for batch trash or delete.
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 6 }}>
                {filteredQueueItems.map((item) => (
                  <button
                    key={item.path}
                    type="button"
                    onClick={() => onSelectQueuePath(item.path)}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'minmax(0, 1fr) auto',
                      gap: 8,
                      padding: '8px 10px',
                      borderRadius: 10,
                      border: selectedPathSet.has(item.path)
                        ? '1px solid color-mix(in srgb, var(--overlay-accent) 62%, var(--overlay-border))'
                        : '1px solid var(--overlay-border)',
                      background: selectedPathSet.has(item.path)
                        ? 'color-mix(in srgb, var(--overlay-accent) 10%, rgba(255,255,255,0.03))'
                        : 'rgba(255,255,255,0.03)',
                      color: 'var(--overlay-text-primary)',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <div style={{ minWidth: 0, display: 'grid', gap: 2 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--overlay-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.name}
                      </div>
                      <div style={{ fontSize: 10.5, color: 'var(--overlay-text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.path}
                      </div>
                      <div style={{ fontSize: 10.5, color: 'var(--overlay-text-muted)' }}>
                        {formatBytes(item.allocatedBytes)}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        onRemoveQueuePath(item.path);
                      }}
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: 8,
                        border: '1px solid var(--overlay-border)',
                        background: 'rgba(255,255,255,0.03)',
                        color: 'var(--overlay-text-secondary)',
                        display: 'grid',
                        placeItems: 'center',
                        cursor: 'pointer',
                        padding: 0,
                      }}
                    >
                      <X size={12} />
                    </button>
                  </button>
                ))}
              </div>
            )}
          </div>
        </SurfaceCard>

        <SurfaceCard title="Session" subtitle={scanStatus ? (scanStatus.completed ? 'Snapshot ready' : 'Native scan in progress') : 'Waiting for a scan'}>
          <div style={{ display: 'grid', gap: 10, padding: 12 }}>
            <StorageMetric
              label="Access"
              value={isElevated ? 'Elevated' : 'Limited'}
              detail={isElevated
                ? 'Protected paths can be removed if the OS allows it.'
                : 'Run elevated for destructive parity on protected paths.'}
            />
            {scanStatus ? (
              <div style={{ display: 'grid', gap: 6, fontSize: 11.5, color: 'var(--overlay-text-secondary)' }}>
                <div>{formatCount(scanStatus.scannedFileCount)} files · {formatCount(scanStatus.scannedDirectoryCount)} folders</div>
                <div>{formatBytes(scanStatus.totalAllocatedBytes)} allocated · {formatBytes(scanStatus.totalLogicalBytes)} logical</div>
                <div>Elapsed {Math.max(0, Math.round(scanStatus.elapsedMs / 1000))}s</div>
              </div>
            ) : (
              <div style={{ fontSize: 11.5, color: 'var(--overlay-text-muted)', lineHeight: 1.5 }}>
                Pick a drive to start a native storage scan. Matrix and treemap modes will hydrate once the snapshot lands.
              </div>
            )}
          </div>
        </SurfaceCard>
      </div>
    </OverlayScrollArea>
  );
}

function StorageMatrixTable({
  keyboardTargetRef,
  onKeyDown,
  onContextMenu,
  onDoubleClickRow,
  onRowClick,
  onToggleExpanded,
  rows,
  selectedPathSet,
  sortDirection,
  sortKey,
  toggleSortKey,
}: {
  keyboardTargetRef: RefObject<HTMLDivElement | null>;
  onKeyDown: (event: React.KeyboardEvent<HTMLDivElement>) => void;
  onContextMenu: (row: StorageMatrixRow, event: ReactMouseEvent<HTMLDivElement>) => void;
  onDoubleClickRow: (row: StorageMatrixRow) => void;
  onRowClick: (row: StorageMatrixRow, event: ReactMouseEvent<HTMLDivElement>) => void;
  onToggleExpanded: (path: string) => void;
  rows: StorageMatrixRow[];
  selectedPathSet: Set<string>;
  sortDirection: 'asc' | 'desc';
  sortKey: string;
  toggleSortKey: (key: string) => void;
}) {
  const headerCellStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '0 10px',
    minHeight: 30,
    fontSize: 10.5,
    fontWeight: 800,
    color: 'var(--overlay-text-secondary)',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    borderBottom: '1px solid var(--overlay-border)',
    background: 'rgba(255,255,255,0.02)',
  };

  return (
    <SurfaceCard title="Matrix" subtitle="Dense hierarchy with directories and files in one sorted field.">
      <div style={{ display: 'grid', gridTemplateRows: 'auto minmax(0, 1fr)', minHeight: 0 }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(320px, 1.8fr) 180px 88px 116px 116px 84px 84px',
            position: 'sticky',
            top: 0,
            zIndex: 2,
          }}
        >
          {[
            ['name', 'Name'],
            ['subtreeShare', 'Subtree %'],
            ['rootShare', 'Root %'],
            ['allocatedBytes', 'Physical'],
            ['logicalBytes', 'Logical'],
            ['fileCount', 'Files'],
            ['directoryCount', 'Folders'],
          ].map(([columnKey, label]) => (
            <button
              key={columnKey}
              type="button"
              onClick={() => toggleSortKey(columnKey)}
              style={{
                ...headerCellStyle,
                borderLeft: columnKey === 'name' ? undefined : '1px solid rgba(255,255,255,0.03)',
                justifyContent: columnKey === sortKey ? 'space-between' : 'flex-start',
              }}
            >
              <span>{label}</span>
              {columnKey === sortKey ? <span>{sortDirection === 'desc' ? '↓' : '↑'}</span> : null}
            </button>
          ))}
        </div>

        <OverlayScrollArea style={{ minHeight: 0 }} scrollbarStyle="explorer-file-list">
          <div
            ref={keyboardTargetRef}
            style={{ display: 'grid', outline: 'none' }}
            onKeyDown={onKeyDown}
            tabIndex={0}
          >
            {rows.map((row) => {
              const selected = selectedPathSet.has(row.path);
              const accent = row.summary.kind === 'directory'
                ? 'var(--overlay-accent)'
                : 'var(--overlay-text-primary)';
              return (
                <div
                  key={row.path}
                  onClick={(event) => onRowClick(row, event)}
                  onDoubleClick={() => onDoubleClickRow(row)}
                  onContextMenu={(event) => onContextMenu(row, event)}
                  role="button"
                  tabIndex={-1}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(320px, 1.8fr) 180px 88px 116px 116px 84px 84px',
                    alignItems: 'stretch',
                    minHeight: 32,
                    borderBottom: '1px solid rgba(255,255,255,0.03)',
                    background: selected
                      ? 'color-mix(in srgb, var(--overlay-accent) 12%, rgba(255,255,255,0.03))'
                      : 'transparent',
                    color: 'var(--overlay-text-primary)',
                    cursor: 'pointer',
                    textAlign: 'left',
                    outline: 'none',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, padding: '0 10px' }}>
                    <div style={{ width: row.depth * 14 }} />
                    {row.hasChildren ? (
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          onToggleExpanded(row.path);
                        }}
                        style={{
                          width: 16,
                          height: 16,
                          borderRadius: 5,
                          border: '1px solid var(--overlay-border)',
                          background: 'rgba(255,255,255,0.03)',
                          color: 'var(--overlay-text-secondary)',
                          display: 'grid',
                          placeItems: 'center',
                          cursor: 'pointer',
                          padding: 0,
                          flexShrink: 0,
                        }}
                      >
                        {row.isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                      </button>
                    ) : (
                      <div style={{ width: 16, flexShrink: 0 }} />
                    )}
                    <div style={{ display: 'grid', placeItems: 'center', color: accent, flexShrink: 0 }}>
                      {resolveNodeIcon(row.summary, row.isExpanded)}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 700, color: accent, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {row.summary.name}
                      </div>
                      <div style={{ fontSize: 10.5, color: 'var(--overlay-text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {row.summary.path}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'grid', alignContent: 'center', gap: 4, padding: '0 10px' }}>
                    <StoragePercentBar value={row.subtreeShare} color={resolveNodeFill(row.summary)} />
                    <div style={{ fontSize: 10.5, color: 'var(--overlay-text-secondary)' }}>{formatPercent(row.subtreeShare)}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', padding: '0 10px', fontSize: 11.5 }}>{formatPercent(row.rootShare)}</div>
                  <div style={{ display: 'flex', alignItems: 'center', padding: '0 10px', fontSize: 11.5 }}>{formatBytes(row.summary.allocatedBytes)}</div>
                  <div style={{ display: 'flex', alignItems: 'center', padding: '0 10px', fontSize: 11.5 }}>{formatBytes(row.summary.logicalBytes)}</div>
                  <div style={{ display: 'flex', alignItems: 'center', padding: '0 10px', fontSize: 11.5 }}>{formatCount(row.summary.fileCount)}</div>
                  <div style={{ display: 'flex', alignItems: 'center', padding: '0 10px', fontSize: 11.5 }}>{formatCount(row.summary.directoryCount)}</div>
                </div>
              );
            })}
          </div>
        </OverlayScrollArea>
      </div>
    </SurfaceCard>
  );
}

function StorageTreemapSurface({
  focusEntry,
  onSelectPath,
  rectEntries,
}: {
  focusEntry: StorageScanEntry | null;
  onSelectPath: (path: string) => void;
  rectEntries: Array<{ entry: StorageScanEntry; x: number; y: number; width: number; height: number }>;
}) {
  return (
    <SurfaceCard title="Treemap" subtitle={focusEntry ? focusEntry.path : 'Select a path to focus the map.'}>
      <div style={{ padding: 12 }}>
        <svg
          viewBox={`0 0 ${TREEMAP_WIDTH} ${TREEMAP_HEIGHT}`}
          style={{ display: 'block', width: '100%', height: 'auto', borderRadius: 14, background: 'rgba(5,10,18,0.96)' }}
        >
          {rectEntries.map((rect) => (
            <g
              key={`${rect.entry.path}-${rect.x}-${rect.y}`}
              onClick={() => onSelectPath(rect.entry.path)}
              style={{ cursor: 'pointer' }}
            >
              <rect
                x={rect.x}
                y={rect.y}
                width={rect.width}
                height={rect.height}
                rx={6}
                ry={6}
                fill={resolveNodeFill(rect.entry)}
                stroke="rgba(255,255,255,0.12)"
                strokeWidth={1}
              />
              {rect.width > 96 && rect.height > 26 ? (
                <text
                  x={rect.x + 10}
                  y={rect.y + 18}
                  fill="#ffffff"
                  fontSize="13"
                  fontWeight="700"
                >
                  {rect.entry.name}
                </text>
              ) : null}
              {rect.width > 96 && rect.height > 42 ? (
                <text
                  x={rect.x + 10}
                  y={rect.y + 34}
                  fill="rgba(255,255,255,0.85)"
                  fontSize="11"
                >
                  {formatBytes(rect.entry.allocatedBytes)}
                </text>
              ) : null}
            </g>
          ))}
        </svg>
      </div>
    </SurfaceCard>
  );
}

function StorageTypesSurface({
  buckets,
  onInspectEntry,
  onSelectBucket,
  selectedPathSet,
  selectedBucketId,
}: {
  buckets: StorageTypeBucketSnapshot[];
  onInspectEntry: (entry: StorageScanEntry) => void;
  onSelectBucket: (bucketId: string) => void;
  selectedPathSet: Set<string>;
  selectedBucketId: string | null;
}) {
  const selectedBucket = buckets.find((bucket) => bucket.id === selectedBucketId) ?? buckets[0] ?? null;
  const totalAllocatedBytes = buckets.reduce((sum, bucket) => sum + bucket.allocatedBytes, 0);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(240px, 300px) minmax(0, 1fr)', gap: 12, minHeight: 0 }}>
      <SurfaceCard title="Types" subtitle="File-type dominance across the scanned root.">
        <OverlayScrollArea style={{ minHeight: 0 }} scrollbarStyle="explorer-file-list" viewportStyle={{ padding: 10 }}>
          <div style={{ display: 'grid', gap: 8 }}>
            {buckets.map((bucket) => {
              const active = bucket.id === selectedBucket?.id;
              return (
                <button
                  key={bucket.id}
                  type="button"
                  onClick={() => onSelectBucket(bucket.id)}
                  style={{
                    display: 'grid',
                    gap: 4,
                    padding: 10,
                    borderRadius: 12,
                    border: active
                      ? '1px solid color-mix(in srgb, var(--overlay-accent) 62%, var(--overlay-border))'
                      : '1px solid var(--overlay-border)',
                    background: active
                      ? 'color-mix(in srgb, var(--overlay-accent) 10%, rgba(255,255,255,0.03))'
                      : 'rgba(255,255,255,0.03)',
                    color: 'var(--overlay-text-primary)',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline' }}>
                      <span style={{ fontSize: 13, fontWeight: 800 }}>{bucket.label}</span>
                      <span style={{ fontSize: 11, color: 'var(--overlay-text-secondary)' }}>{formatPercent(totalAllocatedBytes > 0 ? (bucket.allocatedBytes / totalAllocatedBytes) * 100 : 0)}</span>
                    </div>
                    <StoragePercentBar value={totalAllocatedBytes > 0 ? (bucket.allocatedBytes / totalAllocatedBytes) * 100 : 0} />
                    <div style={{ fontSize: 10.5, color: 'var(--overlay-text-muted)' }}>
                      {formatCount(bucket.fileCount)} files · {formatBytes(bucket.allocatedBytes)} allocated · {formatBytes(bucket.wasteBytes)} waste
                    </div>
                  </button>
                );
            })}
          </div>
        </OverlayScrollArea>
      </SurfaceCard>

      <SurfaceCard
        title={selectedBucket ? `${selectedBucket.label} Offenders` : 'Type Offenders'}
        subtitle={selectedBucket ? `${formatCount(selectedBucket.fileCount)} files in this bucket.` : 'Select a bucket to inspect dominant files.'}
      >
        <OverlayScrollArea style={{ minHeight: 0 }} scrollbarStyle="explorer-file-list" viewportStyle={{ padding: 10 }}>
          <div style={{ display: 'grid', gap: 8 }}>
            {selectedBucket?.largestEntries.map((entry) => {
              const selected = selectedPathSet.has(entry.path);
              return (
              <button
                key={entry.path}
                type="button"
                onClick={() => onInspectEntry(entry)}
                style={{
                  display: 'grid',
                  gap: 2,
                  padding: 10,
                  borderRadius: 12,
                  border: selected
                    ? '1px solid color-mix(in srgb, var(--overlay-accent) 62%, var(--overlay-border))'
                    : '1px solid var(--overlay-border)',
                  background: selected
                    ? 'color-mix(in srgb, var(--overlay-accent) 10%, rgba(255,255,255,0.03))'
                    : 'rgba(255,255,255,0.03)',
                  color: 'var(--overlay-text-primary)',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 700 }}>{entry.name}</div>
                <div style={{ fontSize: 10.5, color: 'var(--overlay-text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.path}</div>
                <div style={{ fontSize: 10.5, color: 'var(--overlay-text-muted)' }}>{formatBytes(entry.allocatedBytes)} allocated · {formatBytes(entry.logicalBytes)} logical</div>
              </button>
            );}) ?? null}
          </div>
        </OverlayScrollArea>
      </SurfaceCard>
    </div>
  );
}

function StorageInspectorPane({
  busyAction,
  onAddSelectionToQueue,
  onRemoveSelectionFromQueue,
  onDelete,
  onOpen,
  onReveal,
  onRescanHere,
  onTrash,
  selectionInQueue,
  selectedEntry,
  selectedEntries,
}: {
  busyAction: 'delete' | 'trash' | 'queue' | null;
  onAddSelectionToQueue: () => void;
  onRemoveSelectionFromQueue: () => void;
  onDelete: () => void;
  onOpen: () => void;
  onReveal: () => void;
  onRescanHere: () => void;
  onTrash: () => void;
  selectionInQueue: boolean;
  selectedEntry: StorageScanEntry | null;
  selectedEntries: StorageScanEntry[];
}) {
  const aggregateAllocated = selectedEntries.reduce((sum, entry) => sum + entry.allocatedBytes, 0);
  const aggregateLogical = selectedEntries.reduce((sum, entry) => sum + entry.logicalBytes, 0);

  return (
    <div style={{ display: 'grid', gridTemplateRows: 'auto minmax(0, 1fr)', gap: 12, minHeight: 0 }}>
      <SurfaceCard
        title="Inspector"
        subtitle={selectedEntry ? selectedEntry.path : 'Select a path to inspect.'}
      >
        <div style={{ display: 'grid', gap: 10, padding: 12 }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 900, color: 'var(--overlay-text-primary)' }}>
              {selectedEntries.length > 1 ? `${formatCount(selectedEntries.length)} items selected` : selectedEntry?.name ?? 'Nothing selected'}
            </div>
            <div style={{ marginTop: 4, fontSize: 11, color: 'var(--overlay-text-secondary)' }}>
              {selectedEntries.length > 1
                ? `${formatBytes(aggregateAllocated)} allocated · ${formatBytes(aggregateLogical)} logical`
                : selectedEntry
                  ? `${selectedEntry.kind} · ${formatBytes(selectedEntry.allocatedBytes)} allocated`
                  : 'Pick a file or folder from the matrix, map, or type views.'}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
            <StorageMetric label="Allocated" value={formatBytes((aggregateAllocated || selectedEntry?.allocatedBytes) ?? 0)} />
            <StorageMetric label="Logical" value={formatBytes((aggregateLogical || selectedEntry?.logicalBytes) ?? 0)} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
            <ActionButton onClick={onAddSelectionToQueue} disabled={selectedEntries.length === 0 || busyAction === 'queue'} tone="accent">
              <ScanLine size={14} />
              Add to Queue
            </ActionButton>
            <ActionButton onClick={onRemoveSelectionFromQueue} disabled={!selectionInQueue || busyAction !== null}>
              <X size={14} />
              Remove
            </ActionButton>
            <ActionButton onClick={onOpen} disabled={!selectedEntry}>
              <ExternalLink size={14} />
              Open
            </ActionButton>
            <ActionButton onClick={onReveal} disabled={!selectedEntry}>
              <Eye size={14} />
              Reveal
            </ActionButton>
            <ActionButton onClick={onRescanHere} disabled={!selectedEntry || selectedEntry.kind !== 'directory'}>
              <RefreshCw size={14} />
              Scan Here
            </ActionButton>
            <ActionButton onClick={onTrash} disabled={!selectedEntry || busyAction !== null}>
              <Trash2 size={14} />
              Trash
            </ActionButton>
            <ActionButton onClick={onDelete} disabled={!selectedEntry || busyAction !== null} tone="danger">
              <AlertTriangle size={14} />
              Delete
            </ActionButton>
          </div>
        </div>
      </SurfaceCard>
      <SurfaceCard title="Preview" subtitle={selectedEntry ? selectedEntry.path : 'No active selection.'}>
        {selectedEntry?.kind === 'directory' ? (
          <ExplorerFolderPreview
            folderPath={selectedEntry.path}
            folderName={selectedEntry.name}
            showHiddenFiles
            onOpenEntry={(entry) => {
              void openStorageEntry(entry.path);
            }}
          />
        ) : (
          <div style={{ padding: 18, display: 'grid', gap: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--overlay-text-primary)' }}>
              {selectedEntry?.name ?? 'Preview is standing by'}
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--overlay-text-secondary)', lineHeight: 1.6 }}>
              {selectedEntry
                ? `Inline file preview is not wired for this storage lane yet, but the item stays fully operable from here. Use Open or Reveal for direct file workflows.`
                : 'Select any file or folder to inspect it here.'}
            </div>
          </div>
        )}
      </SurfaceCard>
    </div>
  );
}

function StorageContextMenu({
  onAddToQueue,
  onClose,
  onDelete,
  onOpen,
  onReveal,
  onTrash,
  state,
}: {
  onAddToQueue: () => void;
  onClose: () => void;
  onDelete: () => void;
  onOpen: () => void;
  onReveal: () => void;
  onTrash: () => void;
  state: StorageContextMenuState | null;
}) {
  useEffect(() => {
    if (!state) {
      return undefined;
    }

    const handlePointerDown = () => onClose();
    window.addEventListener('mousedown', handlePointerDown);
    return () => window.removeEventListener('mousedown', handlePointerDown);
  }, [onClose, state]);

  if (!state) {
    return null;
  }

  return (
    <div
      style={{
        position: 'fixed',
        left: state.x,
        top: state.y,
        zIndex: 1000,
        minWidth: 180,
        padding: 8,
        borderRadius: 12,
        border: '1px solid var(--overlay-border)',
        background: 'color-mix(in srgb, var(--overlay-panel-bg) 98%, rgba(255,255,255,0.02))',
        boxShadow: '0 20px 48px rgba(0,0,0,0.28)',
      }}
    >
      {([
        ['Add to Queue', onAddToQueue],
        ['Open', onOpen],
        ['Reveal', onReveal],
        ['Trash', onTrash],
        ['Delete', onDelete],
      ] as Array<[string, () => void]>).map(([label, handler]) => (
        <button
          key={label}
          type="button"
          onClick={() => {
            handler();
            onClose();
          }}
          style={{
            display: 'flex',
            width: '100%',
            alignItems: 'center',
            minHeight: 32,
            padding: '0 10px',
            border: 'none',
            background: 'transparent',
            color: 'var(--overlay-text-primary)',
            cursor: 'pointer',
            textAlign: 'left',
            borderRadius: 8,
          }}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

export function StoragePanel() {
  useExplorerTaskProgressFeed();

  const {
    activeMode,
    addQueueItems,
    clearQueue,
    expandedPaths,
    focusPath,
    previewSplitMode,
    queue,
    removeQueuePaths,
    selectionAnchorPath,
    selectedPaths,
    selectedTypeBucketId,
    setActiveMode,
    setExpandedPaths,
    setFocusPath,
    setPreviewSplitMode,
    setQueueFilterQuery,
    setSelectedPaths,
    setSelectedRootPath,
    setSelectedTypeBucketId,
    setSortState,
    sortState,
    toggleExpandedPath,
  } = useStorageWorkbenchStore(useShallow((state) => ({
    activeMode: state.activeMode,
    addQueueItems: state.addQueueItems,
    clearQueue: state.clearQueue,
    expandedPaths: state.expandedPaths,
    focusPath: state.focusPath,
    previewSplitMode: state.previewSplitMode,
    queue: state.queue,
    removeQueuePaths: state.removeQueuePaths,
    selectionAnchorPath: state.selectionAnchorPath,
    selectedPaths: state.selectedPaths,
    selectedTypeBucketId: state.selectedTypeBucketId,
    setActiveMode: state.setActiveMode,
    setExpandedPaths: state.setExpandedPaths,
    setFocusPath: state.setFocusPath,
    setPreviewSplitMode: state.setPreviewSplitMode,
    setQueueFilterQuery: state.setQueueFilterQuery,
    setSelectedPaths: state.setSelectedPaths,
    setSelectedRootPath: state.setSelectedRootPath,
    setSelectedTypeBucketId: state.setSelectedTypeBucketId,
    setSortState: state.setSortState,
    sortState: state.sortState,
    toggleExpandedPath: state.toggleExpandedPath,
  })));

  const [roots, setRoots] = useState<StorageRootInfo[]>([]);
  const [rootsLoading, setRootsLoading] = useState(true);
  const [rootsError, setRootsError] = useState<string | null>(null);
  const [isElevated, setIsElevated] = useState<boolean | null>(null);
  const [scanId, setScanId] = useState<string | null>(null);
  const [scanStatus, setScanStatus] = useState<StorageScanSnapshot | null>(null);
  const [panelError, setPanelError] = useState<string | null>(null);
  const [panelNotice, setPanelNotice] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<'delete' | 'trash' | 'queue' | null>(null);
  const [directoryEntriesByPath, setDirectoryEntriesByPath] = useState<Record<string, StorageScanEntry[]>>({});
  const [directoryLoadState, setDirectoryLoadState] = useState<Record<string, 'loading' | 'ready' | 'error'>>({});
  const [contextMenu, setContextMenu] = useState<StorageContextMenuState | null>(null);
  const [storageRailWidth, setStorageRailWidth] = usePersistentPanelSize(
    STORAGE_RAIL_WIDTH_KEY,
    STORAGE_RAIL_WIDTH_DEFAULT,
    STORAGE_RAIL_WIDTH_MIN,
    STORAGE_RAIL_WIDTH_MAX,
  );
  const matrixContainerRef = useRef<HTMLDivElement | null>(null);

  const loadRoots = useCallback(async () => {
    setRootsLoading(true);
    setRootsError(null);
    try {
      const [nextRoots, nextElevation] = await Promise.all([
        getStorageRoots(),
        isStorageProcessElevated().catch(() => false),
      ]);
      setRoots(nextRoots);
      setIsElevated(nextElevation);
    } catch (error) {
      setRoots([]);
      setRootsError(String(error));
    } finally {
      setRootsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRoots();
  }, [loadRoots]);

  const beginScan = useCallback(async (rootPath: string) => {
    const normalizedRootPath = normalizeStorageWorkbenchPath(rootPath);
    setPanelError(null);
    setPanelNotice(null);
    setScanId(null);
    setScanStatus(null);
    setSelectedRootPath(normalizedRootPath);
    setDirectoryEntriesByPath({});
    setDirectoryLoadState({});
    setExpandedPaths([normalizedRootPath]);
    setSelectedPaths([normalizedRootPath], normalizedRootPath);
    setFocusPath(normalizedRootPath);
    const started = await startStorageScan(rootPath);
    setScanId(started.scanId);
  }, [setExpandedPaths, setFocusPath, setSelectedPaths, setSelectedRootPath]);

  useEffect(() => {
    if (!scanId) {
      return undefined;
    }

    let cancelled = false;
    let timeoutId: number | null = null;

    const poll = async () => {
      try {
        const nextStatus = await pollStorageScan(scanId);
        if (cancelled) {
          return;
        }

        startTransition(() => {
          setScanStatus(nextStatus);
        });

        if (!nextStatus.completed) {
          timeoutId = window.setTimeout(() => { void poll(); }, POLL_INTERVAL_MS);
        }
      } catch (error) {
        if (!cancelled) {
          setPanelError(String(error));
        }
      }
    };

    void poll();
    return () => {
      cancelled = true;
      if (timeoutId != null) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [scanId]);

  const directorySnapshotReady = useMemo(
    () => isStorageSnapshotReadyForDirectoryLoads(scanId, scanStatus),
    [scanId, scanStatus],
  );

  const loadDirectory = useCallback(async (directoryPath: string) => {
    const normalizedDirectoryPath = normalizeStorageWorkbenchPath(directoryPath);
    if (
      !scanId
      || !directorySnapshotReady
      || directoryLoadState[normalizedDirectoryPath] === 'loading'
      || directoryEntriesByPath[normalizedDirectoryPath]
    ) {
      return;
    }
    setDirectoryLoadState((current) => ({ ...current, [normalizedDirectoryPath]: 'loading' }));
    try {
      const entries = await listStorageDirectory(scanId, normalizedDirectoryPath);
      setDirectoryEntriesByPath((current) => ({ ...current, [normalizedDirectoryPath]: entries }));
      setDirectoryLoadState((current) => ({ ...current, [normalizedDirectoryPath]: 'ready' }));
    } catch (error) {
      setDirectoryLoadState((current) => ({ ...current, [normalizedDirectoryPath]: 'error' }));
      setPanelError(String(error));
    }
  }, [directoryEntriesByPath, directoryLoadState, directorySnapshotReady, scanId]);

  useEffect(() => {
    if (directorySnapshotReady && scanStatus?.rootPath) {
      void loadDirectory(scanStatus.rootPath);
    }
  }, [directorySnapshotReady, loadDirectory, scanStatus]);

  const rootEntry = useMemo(() => scanStatus ? createStorageRootSummary(scanStatus) : null, [scanStatus]);
  const expandedPathSet = useMemo(() => new Set(expandedPaths), [expandedPaths]);
  const matrixRows = useMemo(() => {
    if (!rootEntry) {
      return [];
    }
    return buildStorageMatrixRows({
      directoryEntriesByPath,
      expandedPaths: expandedPathSet,
      rootEntry,
      sortState,
    });
  }, [directoryEntriesByPath, expandedPathSet, rootEntry, sortState]);

  const summaryByPath = useMemo(() => {
    const index = new Map<string, StorageScanEntry>();
    if (rootEntry) {
      index.set(rootEntry.path, rootEntry);
    }
    for (const row of matrixRows) {
      index.set(row.path, row.summary);
    }
    for (const bucket of scanStatus?.typeBuckets ?? []) {
      for (const entry of bucket.largestEntries) {
        index.set(entry.path, entry);
      }
    }
    return index;
  }, [matrixRows, rootEntry, scanStatus]);

  const selectedEntries = useMemo(
    () => selectedPaths.map((path) => summaryByPath.get(path)).filter((entry): entry is StorageScanEntry => Boolean(entry)),
    [selectedPaths, summaryByPath],
  );
  const selectedEntry = selectedEntries[selectedEntries.length - 1] ?? (rootEntry && selectedPaths[0] === rootEntry.path ? rootEntry : null);
  const selectedPathSet = useMemo(() => new Set(selectedPaths), [selectedPaths]);
  const focusRootPath = useMemo(() => {
    if (!selectedEntry) {
      return rootEntry?.path ?? null;
    }
    if (selectedEntry.kind === 'directory') {
      return selectedEntry.path;
    }
    return getParentPath(selectedEntry.path) ?? rootEntry?.path ?? null;
  }, [rootEntry, selectedEntry]);
  const focusRootEntry = useMemo(() => {
    if (!focusRootPath) {
      return rootEntry;
    }
    return summaryByPath.get(focusRootPath) ?? rootEntry;
  }, [focusRootPath, rootEntry, summaryByPath]);
  const focusMatrixRows = useMemo(() => {
    if (!focusRootEntry) {
      return [];
    }
    return buildStorageMatrixRows({
      directoryEntriesByPath,
      expandedPaths: expandedPathSet,
      rootEntry: focusRootEntry,
      sortState,
    });
  }, [directoryEntriesByPath, expandedPathSet, focusRootEntry, sortState]);

  useEffect(() => {
    if (selectedEntry?.kind === 'directory') {
      void loadDirectory(selectedEntry.path);
    }
  }, [loadDirectory, selectedEntry]);

  const sortedTypeBuckets = useMemo(() => sortStorageTypeBuckets(scanStatus?.typeBuckets ?? []), [scanStatus]);
  const selectedBucketId = selectedTypeBucketId ?? sortedTypeBuckets[0]?.id ?? null;

  const treemapFocusNode = useMemo(
    () => resolveTreemapFocusNode(scanStatus?.tree ?? null, selectedEntry?.path ?? focusPath),
    [focusPath, scanStatus, selectedEntry],
  );
  const treemapRectEntries = useMemo(() => {
    const focusChildren = [...(treemapFocusNode?.children ?? [])].sort((left, right) => right.allocatedBytes - left.allocatedBytes);
    return layoutStorageTreemap(focusChildren, TREEMAP_WIDTH, TREEMAP_HEIGHT).map((rect) => ({
      entry: {
        path: rect.node.path,
        name: rect.node.name,
        kind: rect.node.kind,
        logicalBytes: rect.node.logicalBytes,
        allocatedBytes: rect.node.allocatedBytes,
        wasteBytes: rect.node.wasteBytes,
        fileCount: rect.node.fileCount,
        directoryCount: rect.node.directoryCount,
        depth: 0,
        extension: rect.node.extension ?? null,
      },
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
    }));
  }, [treemapFocusNode]);

  const activeRootPath = scanStatus?.rootPath ?? null;
  const queueItems = useMemo(
    () => queue.itemOrder.map((path) => queue.itemsByPath[path]).filter((item): item is StorageQueuedItem => Boolean(item)),
    [queue.itemOrder, queue.itemsByPath],
  );
  const queuePathSet = useMemo(() => new Set(queue.itemOrder), [queue.itemOrder]);
  const selectionInQueue = useMemo(
    () => selectedPaths.some((path) => queuePathSet.has(path)),
    [queuePathSet, selectedPaths],
  );

  const applyQueueSelection = useCallback(() => {
    if (selectedEntries.length === 0) {
      return;
    }
    setBusyAction('queue');
    addQueueItems(selectedEntries.map(buildQueuedItem));
    setBusyAction(null);
    setPanelNotice(`Queued ${selectedEntries.length} item${selectedEntries.length === 1 ? '' : 's'} for batch cleanup.`);
  }, [addQueueItems, selectedEntries]);
  const handleRemoveSelectionFromQueue = useCallback(() => {
    const removablePaths = selectedPaths.filter((path) => queuePathSet.has(path));
    if (removablePaths.length === 0) {
      return;
    }
    removeQueuePaths(removablePaths);
    setPanelNotice(`Removed ${removablePaths.length} item${removablePaths.length === 1 ? '' : 's'} from the cleanup queue.`);
  }, [queuePathSet, removeQueuePaths, selectedPaths]);

  const handleExecuteQueue = useCallback(async (actionId: StorageBatchQueueActionId) => {
    if (queueItems.length === 0) {
      return;
    }
    setBusyAction(actionId === 'delete' ? 'delete' : 'trash');
    try {
      const paths = queueItems.map((item) => item.path);
      if (actionId === 'trash') {
        await trashStorageEntries(paths);
      } else {
        await deleteStorageEntries(paths);
      }
      removeQueuePaths(paths);
      setPanelNotice(`${actionId === 'trash' ? 'Trashed' : 'Deleted'} ${paths.length} queued item${paths.length === 1 ? '' : 's'}.`);
      if (activeRootPath) {
        await beginScan(activeRootPath);
      }
    } catch (error) {
      setPanelError(String(error));
    } finally {
      setBusyAction(null);
    }
  }, [activeRootPath, beginScan, queueItems, removeQueuePaths]);

  const handleOpen = useCallback(async () => {
    if (!selectedEntry) {
      return;
    }
    await openStorageEntry(selectedEntry.path);
  }, [selectedEntry]);

  const handleReveal = useCallback(async () => {
    if (!selectedEntry) {
      return;
    }
    await revealStorageEntry(selectedEntry.path);
  }, [selectedEntry]);

  const handleTrash = useCallback(async () => {
    if (!selectedEntry) {
      return;
    }
    setBusyAction('trash');
    try {
      if (selectedEntries.length > 1) {
        await trashStorageEntries(selectedEntries.map((entry) => entry.path));
      } else {
        await trashStorageEntry(selectedEntry.path);
      }
      if (activeRootPath) {
        await beginScan(activeRootPath);
      }
    } catch (error) {
      setPanelError(String(error));
    } finally {
      setBusyAction(null);
    }
  }, [activeRootPath, beginScan, selectedEntries, selectedEntry]);

  const handleDelete = useCallback(async () => {
    if (!selectedEntry) {
      return;
    }
    setBusyAction('delete');
    try {
      if (selectedEntries.length > 1) {
        await deleteStorageEntries(selectedEntries.map((entry) => entry.path));
      } else {
        await deleteStorageEntry(selectedEntry.path, selectedEntry.kind === 'directory');
      }
      if (activeRootPath) {
        await beginScan(activeRootPath);
      }
    } catch (error) {
      setPanelError(String(error));
    } finally {
      setBusyAction(null);
    }
  }, [activeRootPath, beginScan, selectedEntries, selectedEntry]);

  const handleRowClick = useCallback((row: StorageMatrixRow, event: ReactMouseEvent<HTMLDivElement>) => {
    const orderedPaths = matrixRows.map((candidate) => candidate.path);
    if (event.shiftKey && selectedPaths.length > 0) {
      const anchor = selectionAnchorPath ?? selectedPaths[selectedPaths.length - 1];
      const start = orderedPaths.indexOf(anchor);
      const end = orderedPaths.indexOf(row.path);
      if (start >= 0 && end >= 0) {
        const [from, to] = start < end ? [start, end] : [end, start];
        setSelectedPaths(orderedPaths.slice(from, to + 1), anchor);
      }
    } else if (event.ctrlKey || event.metaKey) {
      const next = new Set(selectedPaths);
      if (next.has(row.path)) {
        next.delete(row.path);
      } else {
        next.add(row.path);
      }
      setSelectedPaths([...next], row.path);
    } else {
      setSelectedPaths([row.path], row.path);
    }
    setFocusPath(row.path);
    matrixContainerRef.current?.focus();
  }, [matrixRows, selectedPaths, selectionAnchorPath, setFocusPath, setSelectedPaths]);

  const handleToggleExpanded = useCallback((path: string) => {
    toggleExpandedPath(path);
    void loadDirectory(path);
  }, [loadDirectory, toggleExpandedPath]);

  const handleMatrixKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if (matrixRows.length === 0) {
      return;
    }

    const currentPath = selectedPaths[selectedPaths.length - 1] ?? matrixRows[0]?.path ?? null;
    if (!currentPath) {
      return;
    }

    const currentIndex = matrixRows.findIndex((row) => row.path === currentPath);
    const currentRow = currentIndex >= 0 ? matrixRows[currentIndex] : null;
    const selectRowAtIndex = (index: number) => {
      const nextRow = matrixRows[Math.max(0, Math.min(matrixRows.length - 1, index))];
      if (!nextRow) {
        return;
      }
      setSelectedPaths([nextRow.path], nextRow.path);
      setFocusPath(nextRow.path);
    };

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        selectRowAtIndex(currentIndex < 0 ? 0 : currentIndex + 1);
        return;
      case 'ArrowUp':
        event.preventDefault();
        selectRowAtIndex(currentIndex <= 0 ? 0 : currentIndex - 1);
        return;
      case 'ArrowRight':
        if (!currentRow || currentRow.summary.kind !== 'directory') {
          return;
        }
        event.preventDefault();
        if (!currentRow.isExpanded) {
          handleToggleExpanded(currentRow.path);
          return;
        }
        selectRowAtIndex(currentIndex + 1);
        return;
      case 'ArrowLeft':
        if (!currentRow) {
          return;
        }
        event.preventDefault();
        if (currentRow.isExpanded) {
          toggleExpandedPath(currentRow.path);
          return;
        }
        if (currentRow.parentPath) {
          setSelectedPaths([currentRow.parentPath], currentRow.parentPath);
          setFocusPath(currentRow.parentPath);
        }
        return;
      case 'Enter':
        if (!currentRow) {
          return;
        }
        event.preventDefault();
        if (currentRow.summary.kind === 'directory') {
          handleToggleExpanded(currentRow.path);
        } else {
          void openStorageEntry(currentRow.path);
        }
        return;
      case 'Delete':
        event.preventDefault();
        if (event.shiftKey) {
          void handleDelete();
        } else {
          void handleTrash();
        }
        return;
      default:
        return;
    }
  }, [handleDelete, handleToggleExpanded, handleTrash, matrixRows, selectedPaths, setFocusPath, setSelectedPaths, toggleExpandedPath]);

  const toggleSortKey = useCallback((key: string) => {
    setSortState({
      key: key as typeof sortState.key,
      direction: sortState.key === key && sortState.direction === 'desc' ? 'asc' : 'desc',
    });
  }, [setSortState, sortState.direction, sortState.key]);

  const renderModeWorkspace = useCallback((mode: StorageWorkbenchMode) => {
    if (!scanStatus || !rootEntry) {
      return (
        <SurfaceCard title="Storage" subtitle="Pick a drive to start the workbench.">
          <div style={{ padding: 18, color: 'var(--overlay-text-secondary)', fontSize: 12.5 }}>
            Storage forensics will hydrate here once a scan completes.
          </div>
        </SurfaceCard>
      );
    }

    if (mode === 'types') {
      return (
        <StorageTypesSurface
          buckets={sortedTypeBuckets}
          onInspectEntry={(entry) => {
            setSelectedPaths([entry.path], entry.path);
            setFocusPath(entry.path);
            matrixContainerRef.current?.focus();
          }}
          onSelectBucket={setSelectedTypeBucketId}
          selectedPathSet={selectedPathSet}
          selectedBucketId={selectedBucketId}
        />
      );
    }

    const matrixSurface = (
      <StorageMatrixTable
        keyboardTargetRef={matrixContainerRef}
        onKeyDown={handleMatrixKeyDown}
        rows={matrixRows}
        onContextMenu={(row, event) => {
          event.preventDefault();
          if (!selectedPathSet.has(row.path)) {
            setSelectedPaths([row.path], row.path);
          }
          matrixContainerRef.current?.focus();
          setContextMenu({ path: row.path, x: event.clientX, y: event.clientY });
        }}
        onDoubleClickRow={(row) => {
          if (row.summary.kind === 'directory') {
            handleToggleExpanded(row.path);
          } else {
            void openStorageEntry(row.path);
          }
        }}
        onRowClick={handleRowClick}
        onToggleExpanded={handleToggleExpanded}
        selectedPathSet={selectedPathSet}
        sortDirection={sortState.direction}
        sortKey={sortState.key}
        toggleSortKey={toggleSortKey}
      />
    );

    const treemapSurface = (
      <StorageTreemapSurface
        focusEntry={selectedEntry}
        onSelectPath={(path) => {
          setSelectedPaths([path], path);
          setFocusPath(path);
        }}
        rectEntries={treemapRectEntries}
      />
    );

    if (mode === 'split-map') {
      return (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.25fr) minmax(320px, 0.95fr)', gap: 12, minHeight: 0 }}>
          {matrixSurface}
          {treemapSurface}
        </div>
      );
    }

    if (mode === 'focus') {
      return (
        <div style={{ display: 'grid', gridTemplateRows: 'auto minmax(0, 1fr)', gap: 12, minHeight: 0 }}>
          <SurfaceCard
            title="Focus Lane"
            subtitle={focusRootEntry ? `${focusRootEntry.path} · ${formatBytes(focusRootEntry.allocatedBytes)} allocated` : 'Select a directory or file to focus a subtree.'}
          >
            <div style={{ padding: 12, display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 8 }}>
              <StorageMetric
                label="Root Share"
                value={focusRootEntry && rootEntry ? formatPercent(rootEntry.allocatedBytes > 0 ? (focusRootEntry.allocatedBytes / rootEntry.allocatedBytes) * 100 : 0) : '0%'}
                detail={focusRootEntry ? 'How much of the scanned root this subtree owns.' : undefined}
              />
              <StorageMetric label="Children" value={formatCount((directoryEntriesByPath[focusRootEntry?.path ?? ''] ?? []).length)} />
              <StorageMetric label="Files" value={formatCount(focusRootEntry?.fileCount ?? 0)} />
              <StorageMetric label="Folders" value={formatCount(focusRootEntry?.directoryCount ?? 0)} />
            </div>
          </SurfaceCard>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(360px, 0.95fr) minmax(0, 1.2fr)', gap: 12, minHeight: 0 }}>
            {treemapSurface}
            <StorageMatrixTable
              keyboardTargetRef={matrixContainerRef}
              onKeyDown={handleMatrixKeyDown}
              rows={focusMatrixRows}
              onContextMenu={(row, event) => {
                event.preventDefault();
                if (!selectedPathSet.has(row.path)) {
                  setSelectedPaths([row.path], row.path);
                }
                matrixContainerRef.current?.focus();
                setContextMenu({ path: row.path, x: event.clientX, y: event.clientY });
              }}
              onDoubleClickRow={(row) => {
                if (row.summary.kind === 'directory') {
                  handleToggleExpanded(row.path);
                } else {
                  void openStorageEntry(row.path);
                }
              }}
              onRowClick={handleRowClick}
              onToggleExpanded={handleToggleExpanded}
              selectedPathSet={selectedPathSet}
              sortDirection={sortState.direction}
              sortKey={sortState.key}
              toggleSortKey={toggleSortKey}
            />
          </div>
        </div>
      );
    }

    return matrixSurface;
  }, [directoryEntriesByPath, focusMatrixRows, focusRootEntry, handleMatrixKeyDown, handleRowClick, handleToggleExpanded, matrixRows, rootEntry, scanStatus, selectedBucketId, selectedEntry, selectedPathSet, setFocusPath, setSelectedPaths, setSelectedTypeBucketId, sortState.direction, sortState.key, sortedTypeBuckets, toggleSortKey, treemapRectEntries]);

  const selectionAllocatedBytes = selectedEntries.reduce((sum, entry) => sum + entry.allocatedBytes, 0);
  const mainWorkspace = (
    <div
      style={{
        display: 'grid',
        gridTemplateRows: 'auto minmax(0, 1fr)',
        gap: 10,
        minHeight: 0,
        minWidth: 0,
      }}
    >
      <SurfaceCard
        title="Workbench"
        subtitle={scanStatus
          ? `${scanStatus.rootPath} · ${formatCount(scanStatus.scannedFileCount)} files · ${formatCount(scanStatus.scannedDirectoryCount)} folders`
          : 'Storage analysis workbench'}
        actions={(
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {(['matrix', 'split-map', 'types', 'focus'] as StorageWorkbenchMode[]).map((mode) => (
              <ModeChip
                key={mode}
                active={activeMode === mode}
                label={mode === 'split-map' ? 'map' : mode}
                onClick={() => setActiveMode(mode)}
              />
            ))}
            <div style={{ width: 1, alignSelf: 'stretch', background: 'rgba(255,255,255,0.08)' }} />
            <ModeChip
              active={previewSplitMode === 'pane'}
              label="pane"
              onClick={() => setPreviewSplitMode('pane')}
            />
            <ModeChip
              active={previewSplitMode === 'inline'}
              label="inline"
              onClick={() => setPreviewSplitMode('inline')}
            />
            {activeRootPath ? (
              <ActionButton onClick={() => { void beginScan(activeRootPath); }}>
                <RefreshCw size={13} />
                Scan
              </ActionButton>
            ) : null}
            <ActionButton onClick={applyQueueSelection} disabled={selectedEntries.length === 0} tone="accent">
              <ScanLine size={13} />
              Queue
            </ActionButton>
            <ExplorerTaskStatusBadge
              accent="var(--overlay-accent)"
              border="var(--overlay-border)"
              danger="#ff8d8d"
              muted="var(--overlay-text-muted)"
              text="var(--overlay-text-primary)"
            />
          </div>
        )}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, padding: '8px 10px 10px', alignItems: 'center', fontSize: 11, color: 'var(--overlay-text-secondary)' }}>
          <span>{formatBytes(scanStatus?.totalAllocatedBytes ?? 0)} allocated</span>
          <span>{formatBytes(scanStatus?.totalLogicalBytes ?? 0)} logical</span>
          <span>{formatBytes(scanStatus?.totalWasteBytes ?? 0)} waste</span>
          <span>{formatCount(selectedEntries.length)} selected</span>
          <span>{formatBytes(selectionAllocatedBytes)} selection size</span>
          <span>{formatCount(queueItems.length)} queued</span>
          {!scanStatus?.completed && scanStatus ? (
            <span style={{ color: 'var(--overlay-accent)' }}>
              Scanning {scanStatus.currentPath ?? scanStatus.rootPath}...
            </span>
          ) : null}
        </div>
      </SurfaceCard>
      <div style={{ minHeight: 0 }}>{renderModeWorkspace(activeMode)}</div>
    </div>
  );
  const inspectorPane = (
    <StorageInspectorPane
      busyAction={busyAction}
      onAddSelectionToQueue={applyQueueSelection}
      onRemoveSelectionFromQueue={handleRemoveSelectionFromQueue}
      onDelete={() => { void handleDelete(); }}
      onOpen={() => { void handleOpen(); }}
      onReveal={() => { void handleReveal(); }}
      onRescanHere={() => { if (selectedEntry?.kind === 'directory') { void beginScan(selectedEntry.path); } }}
      onTrash={() => { void handleTrash(); }}
      selectionInQueue={selectionInQueue}
      selectedEntry={selectedEntry}
      selectedEntries={selectedEntries}
    />
  );

  return (
    <div style={{ display: 'grid', gap: 12, minHeight: 0, minWidth: 0, height: '100%' }}>
      <StorageStatusBanner error={panelError} isElevated={isElevated} notice={panelNotice} />
      <div style={{ display: 'flex', gap: 12, minHeight: 0, minWidth: 0 }}>
        <ResizablePane
          size={storageRailWidth}
          minSize={STORAGE_RAIL_WIDTH_MIN}
          maxSize={STORAGE_RAIL_WIDTH_MAX}
          onSizeChange={setStorageRailWidth}
          borderColor="color-mix(in srgb, var(--overlay-accent) 36%, var(--overlay-border))"
          style={{
            display: 'flex',
            minHeight: 0,
            flexDirection: 'column',
            borderRadius: 18,
            border: '1px solid var(--overlay-border)',
            background: 'color-mix(in srgb, var(--overlay-panel-bg) 96%, rgba(255,255,255,0.02))',
            overflow: 'hidden',
          }}
        >
          <StorageRail
            activeRootPath={activeRootPath}
            isElevated={isElevated}
            onBeginScan={(rootPath) => { void beginScan(rootPath); }}
            onClearQueue={clearQueue}
            onExecuteQueue={(actionId) => { void handleExecuteQueue(actionId); }}
            onRefreshRoots={() => { void loadRoots(); }}
            onRemoveQueuePath={(path) => removeQueuePaths([path])}
            onSelectQueuePath={(path) => {
              setSelectedPaths([path], path);
              setFocusPath(path);
            }}
            queueFilterQuery={queue.filterQuery}
            queueItems={queueItems}
            roots={roots}
            rootsError={rootsError}
            rootsLoading={rootsLoading}
            scanStatus={scanStatus}
            selectedPathSet={selectedPathSet}
            setQueueFilterQuery={setQueueFilterQuery}
          />
        </ResizablePane>

        <div
          style={previewSplitMode === 'pane'
            ? { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(300px, 340px)', gap: 10, minHeight: 0, minWidth: 0, flex: 1, overflow: 'hidden' }
            : { display: 'grid', gridTemplateRows: 'minmax(0, 1fr) minmax(260px, 34vh)', gap: 10, minHeight: 0, minWidth: 0, flex: 1, overflow: 'hidden' }}
        >
          {mainWorkspace}
          <div style={{ minHeight: 0 }}>
            {inspectorPane}
          </div>
        </div>
      </div>
      <StorageContextMenu
        onAddToQueue={applyQueueSelection}
        onClose={() => setContextMenu(null)}
        onDelete={() => { void handleDelete(); }}
        onOpen={() => { void handleOpen(); }}
        onReveal={() => { void handleReveal(); }}
        onTrash={() => { void handleTrash(); }}
        state={contextMenu}
      />
    </div>
  );
}

export default StoragePanel;
