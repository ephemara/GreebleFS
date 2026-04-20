import { startTransition, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  AlertTriangle,
  ExternalLink,
  FolderSearch,
  HardDrive,
  LoaderCircle,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  XCircle,
} from 'lucide-react';
import {
  cancelStorageScan,
  deleteStorageEntry,
  getStorageRoots,
  isStorageProcessElevated,
  openStorageEntry,
  pollStorageScan,
  revealStorageEntry,
  startStorageScan,
  trashStorageEntry,
  type StorageRootInfo,
  type StorageScanEntry,
  type StorageScanSnapshot,
  type StorageTreeSnapshotNode,
} from '../runtime/storageBackend';
import { layoutStorageTreemap } from './storage/storageTreemap';

const TREEMAP_WIDTH = 1000;
const TREEMAP_HEIGHT = 520;
const POLL_INTERVAL_MS = 450;

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
  return new Intl.NumberFormat().format(value);
}

function getParentPath(path: string): string | null {
  const trimmed = path.replace(/[/\\]+$/, '');
  if (!trimmed) {
    return null;
  }
  if (/^[A-Za-z]:$/.test(trimmed)) {
    return `${trimmed}\\`;
  }
  const parent = trimmed.replace(/[/\\][^/\\]+$/, '');
  if (parent === trimmed) {
    return null;
  }
  if (/^[A-Za-z]:$/.test(parent)) {
    return `${parent}\\`;
  }
  return parent || '/';
}

function collectNodeIndex(root: StorageTreeSnapshotNode | null): Map<string, StorageTreeSnapshotNode> {
  const index = new Map<string, StorageTreeSnapshotNode>();
  if (!root) {
    return index;
  }

  const visit = (node: StorageTreeSnapshotNode) => {
    index.set(node.path, node);
    for (const child of node.children) {
      visit(child);
    }
  };

  visit(root);
  return index;
}

function findNodeTrail(root: StorageTreeSnapshotNode | null, targetPath: string | null): StorageTreeSnapshotNode[] {
  if (!root || !targetPath) {
    return root ? [root] : [];
  }

  const trail: StorageTreeSnapshotNode[] = [];
  const walk = (node: StorageTreeSnapshotNode): boolean => {
    trail.push(node);
    if (node.path === targetPath) {
      return true;
    }
    for (const child of node.children) {
      if (walk(child)) {
        return true;
      }
    }
    trail.pop();
    return false;
  };

  if (walk(root)) {
    return trail;
  }
  return [root];
}

function hashString(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash) + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
}

function resolveNodeFill(node: StorageTreeSnapshotNode): string {
  if (node.kind === 'other') {
    return 'rgba(255,255,255,0.12)';
  }

  const extension = node.kind === 'file'
    ? node.name.split('.').pop() ?? node.name
    : node.path;
  const hue = hashString(extension) % 360;
  const saturation = node.kind === 'directory' ? 58 : 74;
  const lightness = node.kind === 'directory' ? 36 : 44;
  return `hsl(${hue} ${saturation}% ${lightness}%)`;
}

function SectionCard({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section
      style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        borderRadius: 18,
        border: '1px solid var(--overlay-border)',
        background: 'color-mix(in srgb, var(--overlay-panel-bg) 95%, rgba(255,255,255,0.03))',
        boxShadow: '0 28px 72px rgba(0,0,0,0.28)',
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
      <div style={{ flex: 1, minHeight: 0, padding: 16 }}>{children}</div>
    </section>
  );
}

function ActionButton({
  children,
  onClick,
  disabled = false,
  tone = 'default',
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  tone?: 'default' | 'accent' | 'danger';
}) {
  const border = tone === 'danger'
    ? 'rgba(255,114,114,0.36)'
    : tone === 'accent'
      ? 'color-mix(in srgb, var(--overlay-accent) 46%, transparent)'
      : 'var(--overlay-border)';
  const text = tone === 'danger'
    ? '#ff9b9b'
    : tone === 'accent'
      ? 'var(--overlay-accent)'
      : 'var(--overlay-text-primary)';
  const background = tone === 'danger'
    ? 'rgba(120,30,30,0.18)'
    : tone === 'accent'
      ? 'color-mix(in srgb, var(--overlay-accent) 14%, rgba(255,255,255,0.02))'
      : 'rgba(255,255,255,0.04)';
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
        border: `1px solid ${border}`,
        background: disabled ? 'rgba(255,255,255,0.03)' : background,
        color: disabled ? 'var(--overlay-text-muted)' : text,
        cursor: disabled ? 'default' : 'pointer',
        fontSize: 12,
        fontWeight: 700,
      }}
    >
      {children}
    </button>
  );
}

export function StoragePanel() {
  const [roots, setRoots] = useState<StorageRootInfo[]>([]);
  const [rootsLoading, setRootsLoading] = useState(true);
  const [rootsError, setRootsError] = useState<string | null>(null);
  const [isElevated, setIsElevated] = useState<boolean | null>(null);
  const [scanId, setScanId] = useState<string | null>(null);
  const [scanStatus, setScanStatus] = useState<StorageScanSnapshot | null>(null);
  const [activeRootPath, setActiveRootPath] = useState<string | null>(null);
  const [focusPath, setFocusPath] = useState<string | null>(null);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [panelError, setPanelError] = useState<string | null>(null);
  const [panelNotice, setPanelNotice] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState<'trash' | 'delete' | null>(null);

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
    if (scanId && scanStatus && !scanStatus.completed) {
      await cancelStorageScan(scanId).catch(() => undefined);
    }

    setPanelError(null);
    setPanelNotice(null);
    setActiveRootPath(rootPath);
    setScanStatus(null);
    setFocusPath(null);
    setSelectedPath(null);
    const started = await startStorageScan(rootPath);
    setScanId(started.scanId);
  }, [scanId, scanStatus]);

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
          if (nextStatus.completed && nextStatus.tree) {
            setFocusPath((current) => current ?? nextStatus.tree?.path ?? null);
            setSelectedPath((current) => current ?? nextStatus.largestEntries[0]?.path ?? nextStatus.tree?.path ?? null);
          }
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

  const rootNode = scanStatus?.tree ?? null;
  const nodesByPath = useMemo(() => collectNodeIndex(rootNode), [rootNode]);
  const focusTrail = useMemo(() => findNodeTrail(rootNode, focusPath), [focusPath, rootNode]);
  const focusNode = focusTrail[focusTrail.length - 1] ?? rootNode;
  const selectedNode = selectedPath ? nodesByPath.get(selectedPath) ?? focusNode : focusNode;
  const focusChildren = useMemo(
    () => [...(focusNode?.children ?? [])].sort((left, right) => right.bytes - left.bytes),
    [focusNode],
  );
  const treemapRects = useMemo(
    () => layoutStorageTreemap(focusChildren, TREEMAP_WIDTH, TREEMAP_HEIGHT),
    [focusChildren],
  );
  const selectedShare = useMemo(() => {
    if (!selectedNode || !rootNode || rootNode.bytes <= 0) {
      return 0;
    }
    return (selectedNode.bytes / rootNode.bytes) * 100;
  }, [rootNode, selectedNode]);

  const handleRevealSelected = useCallback(async () => {
    if (!selectedNode || selectedNode.kind === 'other') {
      return;
    }
    try {
      await revealStorageEntry(selectedNode.path);
    } catch (error) {
      setPanelError(String(error));
    }
  }, [selectedNode]);

  const handleOpenSelected = useCallback(async () => {
    if (!selectedNode || selectedNode.kind === 'other') {
      return;
    }
    try {
      await openStorageEntry(selectedNode.path);
    } catch (error) {
      setPanelError(String(error));
    }
  }, [selectedNode]);

  const handleScanSelected = useCallback(async () => {
    if (!selectedNode || selectedNode.kind === 'other') {
      return;
    }
    const nextRoot = selectedNode.kind === 'directory'
      ? selectedNode.path
      : getParentPath(selectedNode.path);
    if (!nextRoot) {
      return;
    }
    try {
      await beginScan(nextRoot);
    } catch (error) {
      setPanelError(String(error));
    }
  }, [beginScan, selectedNode]);

  const handleTrashSelected = useCallback(async () => {
    if (!selectedNode || selectedNode.kind === 'other') {
      return;
    }
    if (!window.confirm(`Move "${selectedNode.name}" to trash?`)) {
      return;
    }
    setActionBusy('trash');
    setPanelError(null);
    try {
      await trashStorageEntry(selectedNode.path);
      setPanelNotice(`Moved ${selectedNode.name} to trash.`);
      if (activeRootPath) {
        await beginScan(activeRootPath);
      }
    } catch (error) {
      setPanelError(String(error));
    } finally {
      setActionBusy(null);
    }
  }, [activeRootPath, beginScan, selectedNode]);

  const handleDeleteSelected = useCallback(async () => {
    if (!selectedNode || selectedNode.kind === 'other') {
      return;
    }
    if (!window.confirm(`Permanently delete "${selectedNode.name}"? This bypasses the recycle bin.`)) {
      return;
    }
    setActionBusy('delete');
    setPanelError(null);
    try {
      await deleteStorageEntry(selectedNode.path, selectedNode.kind === 'directory');
      setPanelNotice(`Deleted ${selectedNode.name}.`);
      if (activeRootPath) {
        await beginScan(activeRootPath);
      }
    } catch (error) {
      setPanelError(String(error));
    } finally {
      setActionBusy(null);
    }
  }, [activeRootPath, beginScan, selectedNode]);

  const statusMessage = isElevated == null
    ? null
    : isElevated
      ? {
          icon: ShieldCheck,
          text: 'GreebleFS is running elevated. Protected system paths can be deleted if the OS permits it.',
          color: 'rgba(101, 221, 162, 0.24)',
        }
      : {
          icon: ShieldAlert,
          text: 'Protected system paths still require Administrator rights. Run GreebleFS elevated for destructive parity with WinDirStat.',
          color: 'rgba(255, 193, 94, 0.22)',
        };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minHeight: 0, height: '100%', padding: 16, background: 'var(--overlay-bg-panel)' }}>
      {statusMessage ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderRadius: 14, border: '1px solid var(--overlay-border)', background: statusMessage.color, color: 'var(--overlay-text-primary)', fontSize: 12 }}>
          <statusMessage.icon size={16} />
          <span>{statusMessage.text}</span>
        </div>
      ) : null}
      {panelError ? <div style={{ padding: '12px 14px', borderRadius: 14, border: '1px solid rgba(255,120,120,0.35)', background: 'rgba(120,30,30,0.18)', color: '#ffb3b3', fontSize: 12 }}>{panelError}</div> : null}
      {panelNotice ? <div style={{ padding: '12px 14px', borderRadius: 14, border: '1px solid rgba(111,221,163,0.3)', background: 'rgba(33,86,58,0.2)', color: '#c8f7db', fontSize: 12 }}>{panelNotice}</div> : null}
      {!scanId ? (
        <SectionCard
          title="Choose Root"
          subtitle="Pick the drive or mount point you want the storage tab to scan."
          actions={<ActionButton onClick={() => { void loadRoots(); }} disabled={rootsLoading}><RefreshCw size={14} />Refresh</ActionButton>}
        >
          {rootsLoading ? (
            <div style={{ display: 'grid', placeItems: 'center', minHeight: 220, color: 'var(--overlay-text-muted)', fontSize: 13 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><LoaderCircle size={16} className="spin" />Loading roots...</span>
            </div>
          ) : rootsError ? (
            <div style={{ display: 'grid', placeItems: 'center', minHeight: 220, color: '#ffb3b3', fontSize: 13 }}><span>{rootsError}</span></div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
              {roots.map((root) => {
                const usedBytes = Math.max(0, root.total_bytes - root.free_bytes);
                const usedPercent = root.total_bytes > 0 ? (usedBytes / root.total_bytes) * 100 : 0;
                return (
                  <button
                    key={root.id}
                    type="button"
                    onClick={() => { void beginScan(root.path).catch((error) => setPanelError(String(error))); }}
                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 14, padding: 18, borderRadius: 16, border: '1px solid var(--overlay-border)', background: 'linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))', color: 'var(--overlay-text-primary)', cursor: 'pointer', textAlign: 'left' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 38, height: 38, borderRadius: 12, display: 'grid', placeItems: 'center', background: 'color-mix(in srgb, var(--overlay-accent) 16%, rgba(255,255,255,0.04))', color: 'var(--overlay-accent)' }}><HardDrive size={18} /></div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 800 }}>{root.label || root.path}</div>
                        <div style={{ fontSize: 11, color: 'var(--overlay-text-secondary)' }}>{root.path} · {root.drive_type}</div>
                      </div>
                    </div>
                    <div style={{ display: 'grid', gap: 8 }}>
                      <div style={{ width: '100%', height: 10, borderRadius: 999, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                        <div style={{ width: `${Math.max(4, Math.min(100, usedPercent))}%`, height: '100%', background: 'linear-gradient(90deg, color-mix(in srgb, var(--overlay-accent) 76%, #ffffff), color-mix(in srgb, var(--overlay-accent) 42%, #0b0b0b))' }} />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 12, color: 'var(--overlay-text-secondary)' }}>
                        <span>{formatBytes(usedBytes)} used</span>
                        <span>{formatBytes(root.free_bytes)} free</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </SectionCard>
      ) : (
        <>
          <SectionCard
            title="Scan Session"
            subtitle={activeRootPath ?? scanStatus?.rootPath ?? 'Scanning'}
            actions={<div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {!scanStatus?.completed ? <ActionButton onClick={() => { if (scanId) { void cancelStorageScan(scanId); } }}><XCircle size={14} />Cancel</ActionButton> : null}
              <ActionButton onClick={() => { if (activeRootPath) { void beginScan(activeRootPath).catch((error) => setPanelError(String(error))); } }}><RefreshCw size={14} />Rescan</ActionButton>
              <ActionButton onClick={() => { setScanId(null); setScanStatus(null); setSelectedPath(null); setFocusPath(null); setActiveRootPath(null); }}><FolderSearch size={14} />Choose root</ActionButton>
            </div>}
          >
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
              {[
                ['Bytes', formatBytes(scanStatus?.totalBytes ?? 0)],
                ['Files', formatCount(scanStatus?.scannedFileCount ?? 0)],
                ['Folders', formatCount(scanStatus?.scannedDirectoryCount ?? 0)],
                ['Errors', formatCount(scanStatus?.errorCount ?? 0)],
              ].map(([label, value]) => (
                <div key={label} style={{ padding: 14, borderRadius: 14, border: '1px solid var(--overlay-border)', background: 'rgba(255,255,255,0.03)' }}>
                  <div style={{ fontSize: 11, color: 'var(--overlay-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</div>
                  <div style={{ marginTop: 6, fontSize: 18, fontWeight: 800, color: 'var(--overlay-text-primary)' }}>{value}</div>
                </div>
              ))}
            </div>
            {!scanStatus?.completed ? (
              <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 10, color: 'var(--overlay-text-secondary)', fontSize: 12 }}>
                <LoaderCircle size={16} className="spin" />
                <span>Scanning natively through the filesystem.</span>
                {scanStatus?.currentPath ? <span style={{ color: 'var(--overlay-text-muted)' }}>{scanStatus.currentPath}</span> : null}
              </div>
            ) : null}
          </SectionCard>
          {scanStatus?.completed && scanStatus.tree ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.35fr) minmax(320px, 0.85fr)', gap: 16, minHeight: 0, flex: 1 }}>
              <SectionCard title="Treemap" subtitle={focusNode?.path ?? scanStatus.rootPath}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                  {focusTrail.map((node, index) => (
                    <button key={node.path} type="button" onClick={() => { setFocusPath(node.path); setSelectedPath(node.path); }} style={{ border: 'none', background: 'transparent', color: node.path === focusNode?.path ? 'var(--overlay-text-primary)' : 'var(--overlay-text-secondary)', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
                      {index > 0 ? ' / ' : ''}{node.name}
                    </button>
                  ))}
                </div>
                <div style={{ borderRadius: 16, border: '1px solid var(--overlay-border)', overflow: 'hidden', background: 'linear-gradient(180deg, rgba(7,10,15,0.92), rgba(11,14,20,0.98))' }}>
                  <svg viewBox={`0 0 ${TREEMAP_WIDTH} ${TREEMAP_HEIGHT}`} style={{ width: '100%', height: 380, display: 'block' }}>
                    {treemapRects.map((rect) => {
                      const isActive = rect.node.path === selectedNode?.path;
                      const canLabel = rect.width > 95 && rect.height > 36;
                      return (
                        <g key={rect.node.path} onClick={() => setSelectedPath(rect.node.path)} onDoubleClick={() => { if (rect.node.kind === 'directory') { setFocusPath(rect.node.path); setSelectedPath(rect.node.path); } }} style={{ cursor: 'pointer' }}>
                          <rect x={rect.x} y={rect.y} width={Math.max(0, rect.width)} height={Math.max(0, rect.height)} rx={10} ry={10} fill={resolveNodeFill(rect.node)} stroke={isActive ? 'var(--overlay-accent)' : 'rgba(255,255,255,0.18)'} strokeWidth={isActive ? 4 : 1.5} />
                          {canLabel ? (
                            <>
                              <text x={rect.x + 12} y={rect.y + 20} fill="rgba(255,255,255,0.96)" fontSize="14" fontWeight="700">{rect.node.name}</text>
                              <text x={rect.x + 12} y={rect.y + 38} fill="rgba(255,255,255,0.76)" fontSize="12">{formatBytes(rect.node.bytes)}</text>
                            </>
                          ) : null}
                        </g>
                      );
                    })}
                  </svg>
                </div>
                <div style={{ marginTop: 14, display: 'grid', gap: 8, maxHeight: 240, overflow: 'auto' }}>
                  {focusChildren.map((entry) => (
                    <button key={entry.path} type="button" onClick={() => setSelectedPath(entry.path)} onDoubleClick={() => { if (entry.kind === 'directory') { setFocusPath(entry.path); } }} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto auto', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 12, border: entry.path === selectedNode?.path ? '1px solid color-mix(in srgb, var(--overlay-accent) 56%, transparent)' : '1px solid var(--overlay-border)', background: entry.path === selectedNode?.path ? 'color-mix(in srgb, var(--overlay-accent) 10%, rgba(255,255,255,0.03))' : 'rgba(255,255,255,0.03)', color: 'var(--overlay-text-primary)', cursor: 'pointer', textAlign: 'left' }}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 700 }}>{entry.name}</span>
                      <span style={{ color: 'var(--overlay-text-secondary)', fontSize: 12 }}>{formatBytes(entry.bytes)}</span>
                      <span style={{ color: 'var(--overlay-text-muted)', fontSize: 11 }}>{rootNode?.bytes ? formatPercent((entry.bytes / rootNode.bytes) * 100) : '0%'}</span>
                    </button>
                  ))}
                </div>
              </SectionCard>
              <div style={{ display: 'grid', gap: 16, minHeight: 0, gridTemplateRows: 'minmax(0, auto) minmax(0, 1fr)' }}>
                <SectionCard title="Inspector" subtitle={selectedNode?.path ?? 'No selection'}>
                  {selectedNode ? (
                    <div style={{ display: 'grid', gap: 14 }}>
                      <div>
                        <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--overlay-text-primary)' }}>{selectedNode.name}</div>
                        <div style={{ marginTop: 4, color: 'var(--overlay-text-secondary)', fontSize: 12 }}>{selectedNode.kind}</div>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
                        <div style={{ padding: 12, borderRadius: 12, border: '1px solid var(--overlay-border)', background: 'rgba(255,255,255,0.03)' }}><div style={{ fontSize: 11, color: 'var(--overlay-text-secondary)', textTransform: 'uppercase' }}>Size</div><div style={{ marginTop: 6, fontSize: 16, fontWeight: 800 }}>{formatBytes(selectedNode.bytes)}</div></div>
                        <div style={{ padding: 12, borderRadius: 12, border: '1px solid var(--overlay-border)', background: 'rgba(255,255,255,0.03)' }}><div style={{ fontSize: 11, color: 'var(--overlay-text-secondary)', textTransform: 'uppercase' }}>Root Share</div><div style={{ marginTop: 6, fontSize: 16, fontWeight: 800 }}>{formatPercent(selectedShare)}</div></div>
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        <ActionButton onClick={() => { void handleOpenSelected(); }} disabled={selectedNode.kind === 'other'}><ExternalLink size={14} />Open</ActionButton>
                        <ActionButton onClick={() => { void handleRevealSelected(); }} disabled={selectedNode.kind === 'other'}><HardDrive size={14} />Reveal</ActionButton>
                        <ActionButton onClick={() => { void handleScanSelected(); }} disabled={selectedNode.kind === 'other'}><FolderSearch size={14} />Scan Here</ActionButton>
                        <ActionButton onClick={() => { void handleTrashSelected(); }} disabled={selectedNode.kind === 'other' || actionBusy !== null} tone="accent"><Trash2 size={14} />Trash</ActionButton>
                        <ActionButton onClick={() => { void handleDeleteSelected(); }} disabled={selectedNode.kind === 'other' || actionBusy !== null} tone="danger"><AlertTriangle size={14} />Delete</ActionButton>
                      </div>
                      {selectedNode.kind === 'directory' ? <div style={{ fontSize: 12, color: 'var(--overlay-text-secondary)' }}>{formatCount(selectedNode.fileCount)} files · {formatCount(selectedNode.directoryCount)} nested folders</div> : null}
                    </div>
                  ) : null}
                </SectionCard>
                <SectionCard title="Largest Offenders" subtitle="The biggest files and folders captured by this scan.">
                  <div style={{ display: 'grid', gap: 8, overflow: 'auto', maxHeight: 420 }}>
                    {scanStatus.largestEntries.map((entry: StorageScanEntry) => (
                      <button key={entry.path} type="button" onClick={() => { setSelectedPath(entry.path); if (entry.kind === 'directory') { setFocusPath(entry.path); } else { const parent = getParentPath(entry.path); if (parent) { setFocusPath(parent); } } }} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 12, padding: '12px 14px', borderRadius: 12, border: entry.path === selectedNode?.path ? '1px solid color-mix(in srgb, var(--overlay-accent) 56%, transparent)' : '1px solid var(--overlay-border)', background: 'rgba(255,255,255,0.03)', color: 'var(--overlay-text-primary)', cursor: 'pointer', textAlign: 'left' }}>
                        <span style={{ minWidth: 0 }}>
                          <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 700 }}>{entry.name}</span>
                          <span style={{ display: 'block', marginTop: 4, color: 'var(--overlay-text-muted)', fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.path}</span>
                        </span>
                        <span style={{ alignSelf: 'center', color: 'var(--overlay-text-secondary)', fontSize: 12 }}>{formatBytes(entry.bytes)}</span>
                      </button>
                    ))}
                  </div>
                </SectionCard>
              </div>
            </div>
          ) : scanStatus?.completed && scanStatus.cancelled ? (
            <SectionCard title="Scan Cancelled" subtitle="The storage scan stopped before a final tree snapshot was built.">
              <div style={{ color: 'var(--overlay-text-secondary)', fontSize: 13 }}>Start another scan to rebuild the storage map.</div>
            </SectionCard>
          ) : null}
        </>
      )}
    </div>
  );
}

export default StoragePanel;
