import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from 'react';
import {
  ChevronDown,
  ChevronUp,
  Combine,
  Copy,
  Eye,
  EyeOff,
  Folder,
  FolderOpen,
  Headphones,
  Layers,
  Lock,
  LockOpen,
  MousePointer2,
  Palette,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import {
  OverlayScrollArea,
  PremiumSlider,
} from 'overlayterm-plugin';

export type BlendMode =
  | 'normal'
  | 'multiply'
  | 'screen'
  | 'overlay'
  | 'add'
  | 'subtract';

export interface UniversalLayer {
  id: string;
  name: string;
  visible: boolean;
  locked?: boolean;
  solo?: boolean;
  opacity?: number;
  blendMode?: BlendMode;
  polyCount?: number;
  color?: string;
  thumbnail?: string;
  hasMaterial?: boolean;
  parentId?: string;
  isGroup?: boolean;
  collapsed?: boolean;
}

export interface UniversalLayerFeatures {
  add?: boolean;
  visibility?: boolean;
  delete?: boolean;
  rename?: boolean;
  lock?: boolean;
  solo?: boolean;
  reorder?: boolean;
  colorLabels?: boolean;
  groups?: boolean;
  duplicate?: boolean;
  contextMenu?: boolean;
  thumbnails?: boolean;
  search?: boolean;
  opacity?: boolean;
  blendModes?: boolean;
  polyCount?: boolean;
  materialIndicator?: boolean;
  mergeDown?: boolean;
  mergeSelected?: boolean;
  mergeAll?: boolean;
  mergeVisible?: boolean;
  deleteSelected?: boolean;
  deleteAll?: boolean;
}

export type AccentColor =
  | 'blue'
  | 'orange'
  | 'rose'
  | 'emerald'
  | 'purple'
  | 'cyan';

export interface UniversalLayerPanelProps {
  layers: UniversalLayer[];
  activeLayerId: string | null;
  onSelect: (
    id: string,
    opts?: { multi?: boolean; shift?: boolean; ctrl?: boolean },
  ) => void;
  onToggleVisibility: (id: string) => void;
  onDelete: (id: string) => void;
  selectedLayerIds?: Set<string>;
  onSelectionChange?: (ids: Set<string>) => void;
  features?: UniversalLayerFeatures;
  onAdd?: () => void;
  onRename?: (id: string, name: string) => void;
  onLock?: (id: string) => void;
  onSolo?: (id: string) => void;
  onReorder?: (fromIndex: number, toIndex: number) => void;
  onColorLabel?: (id: string, color: string) => void;
  onDuplicate?: (id: string) => void;
  onOpacityChange?: (id: string, opacity: number) => void;
  onBlendModeChange?: (id: string, mode: BlendMode) => void;
  onMergeDown?: (id: string) => void;
  onMergeSelected?: () => void;
  onMergeAll?: () => void;
  onMergeVisible?: () => void;
  onDeleteSelected?: () => void;
  onDeleteAll?: () => void;
  onToggleGroup?: (id: string) => void;
  accentColor?: AccentColor;
  title?: string;
  emptyMessage?: string;
  compact?: boolean;
  headerActions?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

interface LayerRowProps {
  layer: UniversalLayer;
  displayIndex: number;
  totalCount: number;
  compact: boolean;
  resolvedFeatures: Required<Pick<UniversalLayerFeatures, 'delete' | 'visibility'>> & UniversalLayerFeatures;
  accent: AccentPalette;
  isActive: boolean;
  isSelected: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  renameRequestToken?: string | null;
  onSelect: (id: string, opts?: { multi?: boolean; shift?: boolean; ctrl?: boolean }) => void;
  onToggleVisibility: (id: string) => void;
  onDelete: (id: string) => void;
  onRename?: (id: string, name: string) => void;
  onLock?: (id: string) => void;
  onSolo?: (id: string) => void;
  onDuplicate?: (id: string) => void;
  onMergeDown?: (id: string) => void;
  onColorLabel?: (id: string, color: string) => void;
  onOpacityChange?: (id: string, opacity: number) => void;
  onBlendModeChange?: (id: string, mode: BlendMode) => void;
  onToggleGroup?: (id: string) => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}

interface LayerContextMenuState {
  layerId: string;
  x: number;
  y: number;
}

interface AccentPalette {
  accent: string;
  softBackground: string;
  softBorder: string;
  softForeground: string;
  subtleBackground: string;
}

const blendModeOptions: BlendMode[] = [
  'normal',
  'multiply',
  'screen',
  'overlay',
  'add',
  'subtract',
];

const colorLabelSwatches = [
  '#ef4444',
  '#f97316',
  '#facc15',
  '#4ade80',
  '#22d3ee',
  '#60a5fa',
  '#a855f7',
  '#f472b6',
  '#94a3b8',
  '#ffffff',
];

function resolveAccentPalette(accentColor: AccentColor): AccentPalette {
  const accentById: Record<AccentColor, string> = {
    blue: 'var(--overlay-accent, #60a5fa)',
    orange: 'var(--overlay-warning, #f59e0b)',
    rose: 'var(--overlay-danger, #fb7185)',
    emerald: 'var(--overlay-success, #34d399)',
    purple: '#a855f7',
    cyan: '#22d3ee',
  };
  const accent = accentById[accentColor];
  return {
    accent,
    softBackground: `color-mix(in srgb, ${accent} 14%, var(--overlay-bg-panel))`,
    softBorder: `color-mix(in srgb, ${accent} 45%, var(--overlay-border))`,
    softForeground: `color-mix(in srgb, ${accent} 88%, var(--overlay-text-primary) 12%)`,
    subtleBackground: `color-mix(in srgb, ${accent} 8%, transparent)`,
  };
}

function clampContextMenuCoordinate(value: number, maxValue: number): number {
  return Math.max(12, Math.min(value, Math.max(12, maxValue - 196)));
}

function resolveBlendModeLabel(blendMode: BlendMode): string {
  return blendMode === 'add' || blendMode === 'screen'
    ? blendMode.toUpperCase()
    : blendMode.replace(/^\w/, (character) => character.toUpperCase());
}

function formatPolyCount(polyCount: number): string {
  return `${polyCount.toLocaleString()} polys`;
}

function LayerRow({
  layer,
  displayIndex,
  totalCount,
  compact,
  resolvedFeatures,
  accent,
  isActive,
  isSelected,
  canMoveUp,
  canMoveDown,
  renameRequestToken,
  onSelect,
  onToggleVisibility,
  onDelete,
  onRename,
  onLock,
  onSolo,
  onDuplicate,
  onMergeDown,
  onColorLabel,
  onOpacityChange,
  onBlendModeChange,
  onToggleGroup,
  onMoveUp,
  onMoveDown,
}: LayerRowProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(layer.name);

  useEffect(() => {
    setRenameValue(layer.name);
  }, [layer.name]);

  const commitRename = useCallback(() => {
    const nextName = renameValue.trim();
    if (nextName.length > 0 && nextName !== layer.name) {
      onRename?.(layer.id, nextName);
    }
    setIsRenaming(false);
  }, [layer.id, layer.name, onRename, renameValue]);

  const startRename = useCallback(() => {
    if (!resolvedFeatures.rename || !onRename) {
      return;
    }
    setIsRenaming(true);
    setRenameValue(layer.name);
    requestAnimationFrame(() => inputRef.current?.select());
  }, [layer.name, onRename, resolvedFeatures.rename]);

  useEffect(() => {
    if (!renameRequestToken) {
      return;
    }
    startRename();
  }, [renameRequestToken, startRename]);

  const handleRenameKeyDown = useCallback((event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      commitRename();
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      setIsRenaming(false);
      setRenameValue(layer.name);
    }
  }, [commitRename, layer.name]);

  return (
    <div
      onClick={(event) => {
        onSelect(layer.id, {
          multi: event.shiftKey || event.ctrlKey || event.metaKey,
          shift: event.shiftKey,
          ctrl: event.ctrlKey || event.metaKey,
        });
      }}
      onDoubleClick={startRename}
      style={{
        display: 'grid',
        gap: compact ? 8 : 10,
        padding: compact ? '8px 9px' : '10px 11px',
        borderRadius: 'var(--overlay-explorer-control-radius)',
        border: `1px solid ${isActive ? accent.softBorder : isSelected ? 'color-mix(in srgb, var(--overlay-border) 72%, white 28%)' : 'transparent'}`,
        background: isActive
          ? accent.softBackground
          : isSelected
            ? 'color-mix(in srgb, var(--overlay-bg-panel) 82%, rgba(255,255,255,0.05) 18%)'
            : 'transparent',
        boxShadow: isActive
          ? `0 0 0 1px color-mix(in srgb, ${accent.accent} 16%, transparent), 0 10px 26px color-mix(in srgb, ${accent.accent} 14%, transparent)`
          : 'none',
        cursor: 'pointer',
        opacity: layer.locked ? 0.68 : 1,
        transition: 'background 140ms ease, border-color 140ms ease, box-shadow 140ms ease, opacity 140ms ease',
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'auto auto auto auto auto auto minmax(0, 1fr) auto auto auto auto auto',
          alignItems: 'center',
          gap: compact ? 6 : 8,
          minWidth: 0,
        }}
      >
        {resolvedFeatures.groups ? (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              if (layer.isGroup) {
                onToggleGroup?.(layer.id);
              }
            }}
            disabled={!layer.isGroup}
            title={layer.isGroup ? (layer.collapsed ? 'Expand group' : 'Collapse group') : undefined}
            style={iconButtonStyle({
              active: Boolean(layer.isGroup),
              compact,
              disabled: !layer.isGroup,
            })}
          >
            {layer.isGroup ? (
              layer.collapsed ? <Folder size={compact ? 12 : 14} /> : <FolderOpen size={compact ? 12 : 14} />
            ) : (
              <div style={{ width: compact ? 12 : 14 }} />
            )}
          </button>
        ) : null}
        {layer.color ? (
          <span
            aria-hidden="true"
            style={{
              width: 9,
              height: 9,
              borderRadius: 999,
              background: layer.color,
              boxShadow: '0 0 0 1px rgba(0,0,0,0.35)',
            }}
          />
        ) : (
          <div style={{ width: 9, height: 9 }} />
        )}
        {resolvedFeatures.visibility ? (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onToggleVisibility(layer.id);
            }}
            title={layer.visible ? 'Hide layer' : 'Show layer'}
            style={iconButtonStyle({ active: layer.visible, compact })}
          >
            {layer.visible ? <Eye size={compact ? 12 : 14} /> : <EyeOff size={compact ? 12 : 14} />}
          </button>
        ) : null}
        {resolvedFeatures.lock && onLock ? (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onLock(layer.id);
            }}
            title={layer.locked ? 'Unlock layer' : 'Lock layer'}
            style={iconButtonStyle({ active: layer.locked, compact })}
          >
            {layer.locked ? <Lock size={compact ? 11 : 13} /> : <LockOpen size={compact ? 11 : 13} />}
          </button>
        ) : null}
        {resolvedFeatures.solo && onSolo ? (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onSolo(layer.id);
            }}
            title={layer.solo ? 'Disable solo' : 'Solo layer'}
            style={iconButtonStyle({ active: layer.solo, compact })}
          >
            <Headphones size={compact ? 11 : 13} />
          </button>
        ) : null}
        {resolvedFeatures.thumbnails ? (
          layer.thumbnail ? (
            <div
              style={{
                width: compact ? 26 : 32,
                height: compact ? 26 : 32,
                overflow: 'hidden',
                borderRadius: 'calc(var(--overlay-explorer-control-radius) - 2px)',
                border: '1px solid var(--overlay-border)',
                background: 'var(--overlay-bg-shell)',
                flexShrink: 0,
              }}
            >
              <img
                src={layer.thumbnail}
                alt=""
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              />
            </div>
          ) : (
            <div style={{ width: compact ? 26 : 32, height: compact ? 26 : 32 }} />
          )
        ) : null}
        <div style={{ minWidth: 0, display: 'grid', gap: compact ? 2 : 3 }}>
          {isRenaming ? (
            <input
              ref={inputRef}
              value={renameValue}
              onClick={(event) => event.stopPropagation()}
              onChange={(event) => setRenameValue(event.target.value)}
              onBlur={commitRename}
              onKeyDown={handleRenameKeyDown}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                minHeight: compact ? 24 : 26,
                borderRadius: 'calc(var(--overlay-explorer-control-radius) - 2px)',
                border: `1px solid ${accent.softBorder}`,
                background: 'var(--overlay-bg-shell)',
                color: 'var(--overlay-text-primary)',
                outline: 'none',
                fontSize: compact ? 10 : 11,
                fontWeight: 700,
                padding: '0 8px',
              }}
            />
          ) : (
            <div
              style={{
                color: isActive ? 'var(--overlay-text-primary)' : 'color-mix(in srgb, var(--overlay-text-primary) 88%, transparent)',
                fontSize: compact ? 10 : 11,
                fontWeight: 800,
                lineHeight: 1.1,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {layer.name}
            </div>
          )}
          {!compact && resolvedFeatures.polyCount && typeof layer.polyCount === 'number' ? (
            <div
              style={{
                color: 'var(--overlay-text-muted)',
                fontSize: 10,
                fontFamily: 'var(--overlay-font-mono)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {formatPolyCount(layer.polyCount)}
            </div>
          ) : null}
        </div>
        {resolvedFeatures.materialIndicator && layer.hasMaterial ? (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              minHeight: 20,
              borderRadius: 999,
              border: '1px solid var(--overlay-border)',
              background: accent.subtleBackground,
              color: accent.softForeground,
              padding: '0 7px',
              fontSize: 9,
              fontWeight: 800,
              letterSpacing: '0.08em',
            }}
          >
            <span
              aria-hidden="true"
              style={{
                width: 6,
                height: 6,
                borderRadius: 999,
                background: accent.accent,
              }}
            />
            MAT
          </span>
        ) : null}
        {isActive ? (
          <MousePointer2 size={compact ? 11 : 13} style={{ color: accent.accent, flexShrink: 0 }} />
        ) : isSelected ? (
          <span
            aria-hidden="true"
            style={{
              width: 7,
              height: 7,
              borderRadius: 999,
              background: accent.accent,
              opacity: 0.65,
              flexShrink: 0,
            }}
          />
        ) : (
          <div style={{ width: compact ? 11 : 13 }} />
        )}
        {resolvedFeatures.reorder ? (
          <div style={{ display: 'grid', gap: 2 }}>
            <button
              type="button"
              disabled={!canMoveUp}
              onClick={(event) => {
                event.stopPropagation();
                onMoveUp?.();
              }}
              title="Move layer up"
              style={iconButtonStyle({ active: false, compact, disabled: !canMoveUp })}
            >
              <ChevronUp size={compact ? 11 : 13} />
            </button>
            <button
              type="button"
              disabled={!canMoveDown}
              onClick={(event) => {
                event.stopPropagation();
                onMoveDown?.();
              }}
              title="Move layer down"
              style={iconButtonStyle({ active: false, compact, disabled: !canMoveDown })}
            >
              <ChevronDown size={compact ? 11 : 13} />
            </button>
          </div>
        ) : (
          <div style={{ width: compact ? 20 : 22 }} />
        )}
        {resolvedFeatures.duplicate && onDuplicate ? (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onDuplicate(layer.id);
            }}
            title="Duplicate layer"
            style={iconButtonStyle({ active: false, compact })}
          >
            <Copy size={compact ? 11 : 13} />
          </button>
        ) : null}
        {resolvedFeatures.mergeDown && onMergeDown && displayIndex < totalCount - 1 ? (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onMergeDown(layer.id);
            }}
            title="Merge layer down"
            style={iconButtonStyle({ active: false, compact })}
          >
            <Combine size={compact ? 11 : 13} />
          </button>
        ) : null}
        {resolvedFeatures.delete ? (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onDelete(layer.id);
            }}
            title="Delete layer"
            style={iconButtonStyle({ active: false, compact, tone: 'danger' })}
          >
            <Trash2 size={compact ? 11 : 13} />
          </button>
        ) : null}
      </div>
      {isActive && resolvedFeatures.opacity && onOpacityChange ? (
        <div
          style={{
            display: 'grid',
            gap: 8,
            paddingTop: 4,
          }}
          onClick={(event) => event.stopPropagation()}
        >
          <div style={inlineMetaStyle}>
            <span style={miniSectionLabelStyle}>Opacity</span>
            <span style={valueBadgeStyle}>{Math.round((layer.opacity ?? 1) * 100)}%</span>
          </div>
          <PremiumSlider
            value={layer.opacity ?? 1}
            min={0}
            max={1}
            step={0.01}
            density={compact ? 'compact' : 'comfortable'}
            ariaLabel={`${layer.name} opacity`}
            onChange={(nextOpacity) => onOpacityChange(layer.id, nextOpacity)}
          />
        </div>
      ) : null}
      {isActive && resolvedFeatures.blendModes && onBlendModeChange ? (
        <div
          style={{
            display: 'grid',
            gap: 6,
          }}
          onClick={(event) => event.stopPropagation()}
        >
          <span style={miniSectionLabelStyle}>Blend Mode</span>
          <select
            value={layer.blendMode ?? 'normal'}
            onChange={(event) => onBlendModeChange(layer.id, event.target.value as BlendMode)}
            style={inputStyle}
          >
            {blendModeOptions.map((blendMode) => (
              <option key={blendMode} value={blendMode}>
                {resolveBlendModeLabel(blendMode)}
              </option>
            ))}
          </select>
        </div>
      ) : null}
      {resolvedFeatures.contextMenu && onColorLabel ? (
        <div style={srOnlyStyle}>
          <Palette />
        </div>
      ) : null}
    </div>
  );
}

export function UniversalLayerPanel({
  layers,
  activeLayerId,
  onSelect,
  onToggleVisibility,
  onDelete,
  selectedLayerIds = new Set<string>(),
  onSelectionChange,
  features = {},
  onAdd,
  onRename,
  onLock,
  onSolo,
  onReorder,
  onColorLabel,
  onDuplicate,
  onOpacityChange,
  onBlendModeChange,
  onMergeDown,
  onMergeSelected,
  onMergeAll,
  onMergeVisible,
  onDeleteSelected,
  onDeleteAll,
  onToggleGroup,
  accentColor = 'orange',
  title = 'Layers',
  emptyMessage = 'No layers',
  compact = false,
  headerActions,
  className,
  style,
}: UniversalLayerPanelProps) {
  const accent = useMemo(() => resolveAccentPalette(accentColor), [accentColor]);
  const resolvedFeatures = useMemo<Required<Pick<UniversalLayerFeatures, 'delete' | 'visibility'>> & UniversalLayerFeatures>(() => ({
    delete: features.delete !== false,
    visibility: features.visibility !== false,
    ...features,
  }), [features]);
  const [searchQuery, setSearchQuery] = useState('');
  const [lastSelectedId, setLastSelectedId] = useState<string | null>(activeLayerId);
  const [contextMenuState, setContextMenuState] = useState<LayerContextMenuState | null>(null);
  const [renameRequestLayerId, setRenameRequestLayerId] = useState<string | null>(null);
  const [renameRequestNonce, setRenameRequestNonce] = useState(0);
  const contextMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setLastSelectedId(activeLayerId);
  }, [activeLayerId]);

  const filteredLayers = useMemo(() => {
    if (!resolvedFeatures.search || searchQuery.trim().length === 0) {
      return layers;
    }
    const normalizedQuery = searchQuery.trim().toLowerCase();
    return layers.filter((layer) => layer.name.toLowerCase().includes(normalizedQuery));
  }, [layers, resolvedFeatures.search, searchQuery]);

  const displayLayers = useMemo(() => [...filteredLayers].reverse(), [filteredLayers]);
  const selectedCount = selectedLayerIds.size;
  const rowFeatures = useMemo(
    () => ({
      ...resolvedFeatures,
      reorder: Boolean(resolvedFeatures.reorder && searchQuery.trim().length === 0),
    }),
    [resolvedFeatures, searchQuery],
  );

  useEffect(() => {
    if (!contextMenuState) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (contextMenuRef.current?.contains(event.target as Node)) {
        return;
      }
      setContextMenuState(null);
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setContextMenuState(null);
      }
    };

    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleEscape);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleEscape);
    };
  }, [contextMenuState]);

  const contextMenuLayer = useMemo(() => (
    contextMenuState
      ? layers.find((layer) => layer.id === contextMenuState.layerId) ?? null
      : null
  ), [contextMenuState, layers]);

  const handleLayerSelection = useCallback((id: string, opts?: { multi?: boolean; shift?: boolean; ctrl?: boolean }) => {
    if (!onSelectionChange) {
      onSelect(id, opts);
      setLastSelectedId(id);
      return;
    }

    const nextSelection = new Set(selectedLayerIds);
    if (opts?.shift && lastSelectedId) {
      const currentIndex = filteredLayers.findIndex((layer) => layer.id === id);
      const lastIndex = filteredLayers.findIndex((layer) => layer.id === lastSelectedId);
      if (currentIndex !== -1 && lastIndex !== -1) {
        if (!opts.ctrl) {
          nextSelection.clear();
        }
        const startIndex = Math.min(currentIndex, lastIndex);
        const endIndex = Math.max(currentIndex, lastIndex);
        for (let index = startIndex; index <= endIndex; index += 1) {
          nextSelection.add(filteredLayers[index].id);
        }
      }
    } else if (opts?.ctrl) {
      if (nextSelection.has(id)) {
        nextSelection.delete(id);
      } else {
        nextSelection.add(id);
      }
    } else {
      nextSelection.clear();
      nextSelection.add(id);
    }

    onSelectionChange(nextSelection);
    onSelect(id, opts);
    setLastSelectedId(id);
  }, [filteredLayers, lastSelectedId, onSelect, onSelectionChange, selectedLayerIds]);

  const openContextMenu = useCallback((event: React.MouseEvent, layerId: string) => {
    if (!resolvedFeatures.contextMenu) {
      return;
    }
    event.preventDefault();
    setContextMenuState({
      layerId,
      x: clampContextMenuCoordinate(event.clientX, window.innerWidth),
      y: clampContextMenuCoordinate(event.clientY, window.innerHeight),
    });
  }, [resolvedFeatures.contextMenu]);

  return (
    <section
      className={className}
      style={{
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0,
        minHeight: 0,
        height: '100%',
        border: '1px solid var(--overlay-border)',
        borderRadius: 'var(--overlay-workbench-panel-radius)',
        background: 'var(--overlay-bg-panel)',
        color: 'var(--overlay-text-primary)',
        overflow: 'hidden',
        ...style,
      }}
    >
      <header
        style={{
          display: 'grid',
          gap: compact ? 8 : 10,
          padding: compact ? '10px 11px' : '12px 13px',
          borderBottom: '1px solid var(--overlay-border)',
          background: 'color-mix(in srgb, var(--overlay-bg-shell) 64%, var(--overlay-bg-panel) 36%)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            minWidth: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <Layers size={compact ? 14 : 16} style={{ color: accent.accent, flexShrink: 0 }} />
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  color: accent.softForeground,
                  fontSize: compact ? 10 : 11,
                  fontWeight: 900,
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                  lineHeight: 1.1,
                }}
              >
                {title}
              </div>
              <div style={panelMetaStyle}>
                {layers.length} {layers.length === 1 ? 'layer' : 'layers'}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {headerActions}
            {resolvedFeatures.add && onAdd ? (
              <button
                type="button"
                onClick={onAdd}
                style={actionButtonStyle({
                  accent,
                  compact,
                  tone: 'accent',
                })}
              >
                <Plus size={compact ? 12 : 14} />
                {!compact ? 'Add' : null}
              </button>
            ) : null}
          </div>
        </div>
        {resolvedFeatures.search ? (
          <label
            style={{
              display: 'grid',
              gridTemplateColumns: 'auto minmax(0, 1fr) auto',
              alignItems: 'center',
              gap: 8,
              minHeight: compact ? 30 : 32,
              borderRadius: 'var(--overlay-explorer-control-radius)',
              border: '1px solid var(--overlay-explorer-input-border)',
              background: 'var(--overlay-explorer-input-bg)',
              padding: '0 10px',
            }}
          >
            <Search size={compact ? 12 : 14} style={{ color: 'var(--overlay-text-muted)' }} />
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search layers"
              style={{
                border: 0,
                outline: 'none',
                background: 'transparent',
                color: 'var(--overlay-text-primary)',
                minWidth: 0,
                fontSize: 12,
                padding: '7px 0',
              }}
            />
            {searchQuery ? (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                style={iconButtonStyle({ active: false, compact })}
              >
                <X size={compact ? 11 : 12} />
              </button>
            ) : null}
          </label>
        ) : null}
        {(resolvedFeatures.mergeSelected
          || resolvedFeatures.mergeAll
          || resolvedFeatures.mergeVisible
          || resolvedFeatures.deleteSelected
          || resolvedFeatures.deleteAll) ? (
            <div style={{ display: 'grid', gap: 6 }}>
              {(resolvedFeatures.mergeSelected || resolvedFeatures.mergeAll || resolvedFeatures.mergeVisible) ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {resolvedFeatures.mergeSelected && onMergeSelected ? (
                    <button
                      type="button"
                      disabled={selectedCount < 2}
                      onClick={onMergeSelected}
                      style={actionButtonStyle({
                        accent,
                        compact,
                        tone: 'accent',
                        disabled: selectedCount < 2,
                      })}
                    >
                      <Combine size={compact ? 11 : 12} />
                      Merge Selected {selectedCount > 0 ? `(${selectedCount})` : null}
                    </button>
                  ) : null}
                  {resolvedFeatures.mergeVisible && onMergeVisible ? (
                    <button
                      type="button"
                      disabled={!layers.some((layer) => layer.visible)}
                      onClick={onMergeVisible}
                      style={actionButtonStyle({
                        accent,
                        compact,
                        disabled: !layers.some((layer) => layer.visible),
                      })}
                    >
                      <Eye size={compact ? 11 : 12} />
                      Merge Visible
                    </button>
                  ) : null}
                  {resolvedFeatures.mergeAll && onMergeAll ? (
                    <button
                      type="button"
                      disabled={layers.length < 2}
                      onClick={onMergeAll}
                      style={actionButtonStyle({
                        accent,
                        compact,
                        disabled: layers.length < 2,
                      })}
                    >
                      <Combine size={compact ? 11 : 12} />
                      Merge All
                    </button>
                  ) : null}
                </div>
              ) : null}
              {(resolvedFeatures.deleteSelected || resolvedFeatures.deleteAll) ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {resolvedFeatures.deleteSelected && onDeleteSelected ? (
                    <button
                      type="button"
                      disabled={selectedCount === 0}
                      onClick={onDeleteSelected}
                      style={actionButtonStyle({
                        accent,
                        compact,
                        tone: 'danger',
                        disabled: selectedCount === 0,
                      })}
                    >
                      <Trash2 size={compact ? 11 : 12} />
                      Delete Selected {selectedCount > 0 ? `(${selectedCount})` : null}
                    </button>
                  ) : null}
                  {resolvedFeatures.deleteAll && onDeleteAll ? (
                    <button
                      type="button"
                      disabled={layers.length === 0}
                      onClick={onDeleteAll}
                      style={actionButtonStyle({
                        accent,
                        compact,
                        tone: 'danger',
                        disabled: layers.length === 0,
                      })}
                    >
                      <Trash2 size={compact ? 11 : 12} />
                      Delete All
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
      </header>
      <OverlayScrollArea
        scrollbarStyle="themed"
        style={{ flex: 1, minHeight: 0 }}
        viewportStyle={{ minHeight: 0 }}
        contentStyle={{
          display: 'grid',
          gap: compact ? 6 : 8,
          padding: compact ? 8 : 10,
          minWidth: 0,
        }}
      >
        {displayLayers.length === 0 ? (
          <div
            style={{
              display: 'grid',
              placeItems: 'center',
              minHeight: 180,
              border: '1px dashed var(--overlay-border)',
              borderRadius: 'var(--overlay-explorer-control-radius)',
              color: 'var(--overlay-text-muted)',
              fontSize: 12,
              textAlign: 'center',
              padding: 16,
            }}
          >
            {searchQuery ? 'No matching layers' : emptyMessage}
          </div>
        ) : (
          displayLayers.map((layer, displayIndex) => (
            <div
              key={layer.id}
              onContextMenu={(event) => openContextMenu(event, layer.id)}
            >
              <LayerRow
                layer={layer}
                displayIndex={displayIndex}
                totalCount={displayLayers.length}
                compact={compact}
                resolvedFeatures={rowFeatures}
                accent={accent}
                isActive={activeLayerId === layer.id}
                isSelected={selectedLayerIds.has(layer.id)}
                canMoveUp={displayIndex > 0}
                canMoveDown={displayIndex < displayLayers.length - 1}
                renameRequestToken={
                  renameRequestLayerId === layer.id
                    ? `${layer.id}:${renameRequestNonce}`
                    : null
                }
                onSelect={handleLayerSelection}
                onToggleVisibility={onToggleVisibility}
                onDelete={onDelete}
                onRename={onRename}
                onLock={onLock}
                onSolo={onSolo}
                onDuplicate={onDuplicate}
                onMergeDown={onMergeDown}
                onColorLabel={onColorLabel}
                onOpacityChange={onOpacityChange}
                onBlendModeChange={onBlendModeChange}
                onToggleGroup={onToggleGroup}
                onMoveUp={() => {
                  if (!onReorder) {
                    return;
                  }
                  const fromIndex = filteredLayers.length - 1 - displayIndex;
                  const toIndex = filteredLayers.length - displayIndex;
                  onReorder(fromIndex, toIndex);
                }}
                onMoveDown={() => {
                  if (!onReorder) {
                    return;
                  }
                  const fromIndex = filteredLayers.length - 1 - displayIndex;
                  const toIndex = filteredLayers.length - 2 - displayIndex;
                  onReorder(fromIndex, toIndex);
                }}
              />
            </div>
          ))
        )}
      </OverlayScrollArea>
      <footer
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          minWidth: 0,
          padding: compact ? '8px 10px' : '10px 12px',
          borderTop: '1px solid var(--overlay-border)',
          color: 'var(--overlay-text-muted)',
          fontSize: 10,
          fontFamily: 'var(--overlay-font-mono)',
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
        }}
      >
        <span>{layers.length} {layers.length === 1 ? 'layer' : 'layers'}</span>
        {resolvedFeatures.solo ? <span>S to solo</span> : null}
      </footer>
      {contextMenuState && contextMenuLayer ? (
        <div
          ref={contextMenuRef}
          style={{
            position: 'fixed',
            left: contextMenuState.x,
            top: contextMenuState.y,
            zIndex: 12000,
            display: 'grid',
            gap: 4,
            minWidth: 188,
            borderRadius: 'calc(var(--overlay-explorer-control-radius) + 2px)',
            border: '1px solid var(--overlay-border)',
            background: 'var(--overlay-bg-shell)',
            boxShadow: '0 20px 50px rgba(0,0,0,0.45)',
            padding: 6,
          }}
        >
          {resolvedFeatures.rename && onRename ? (
            <button
              type="button"
              onClick={() => {
                handleLayerSelection(contextMenuLayer.id);
                setRenameRequestLayerId(contextMenuLayer.id);
                setRenameRequestNonce((currentValue) => currentValue + 1);
                setContextMenuState(null);
              }}
              style={contextMenuButtonStyle}
            >
              Rename
            </button>
          ) : null}
          {resolvedFeatures.duplicate && onDuplicate ? (
            <button
              type="button"
              onClick={() => {
                onDuplicate(contextMenuLayer.id);
                setContextMenuState(null);
              }}
              style={contextMenuButtonStyle}
            >
              Duplicate
            </button>
          ) : null}
          {resolvedFeatures.lock && onLock ? (
            <button
              type="button"
              onClick={() => {
                onLock(contextMenuLayer.id);
                setContextMenuState(null);
              }}
              style={contextMenuButtonStyle}
            >
              {contextMenuLayer.locked ? 'Unlock Layer' : 'Lock Layer'}
            </button>
          ) : null}
          {resolvedFeatures.solo && onSolo ? (
            <button
              type="button"
              onClick={() => {
                onSolo(contextMenuLayer.id);
                setContextMenuState(null);
              }}
              style={contextMenuButtonStyle}
            >
              {contextMenuLayer.solo ? 'Disable Solo' : 'Solo Layer'}
            </button>
          ) : null}
          {resolvedFeatures.colorLabels && onColorLabel ? (
            <div
              style={{
                display: 'grid',
                gap: 6,
                padding: '6px 4px 2px 4px',
                borderTop: '1px solid var(--overlay-border)',
                borderBottom: '1px solid var(--overlay-border)',
              }}
            >
              <div style={miniSectionLabelStyle}>Color Label</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {colorLabelSwatches.map((swatch) => (
                  <button
                    key={swatch}
                    type="button"
                    onClick={() => {
                      onColorLabel(contextMenuLayer.id, swatch);
                      setContextMenuState(null);
                    }}
                    title={swatch}
                    style={{
                      width: 16,
                      height: 16,
                      borderRadius: 999,
                      border: `1px solid ${contextMenuLayer.color === swatch ? accent.softBorder : 'rgba(255,255,255,0.14)'}`,
                      background: swatch,
                      cursor: 'pointer',
                      boxShadow: contextMenuLayer.color === swatch
                        ? `0 0 0 1px color-mix(in srgb, ${accent.accent} 26%, transparent)`
                        : 'none',
                    }}
                  />
                ))}
                {contextMenuLayer.color ? (
                  <button
                    type="button"
                    onClick={() => {
                      onColorLabel(contextMenuLayer.id, '');
                      setContextMenuState(null);
                    }}
                    style={contextMenuButtonStyle}
                  >
                    Clear
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}
          {resolvedFeatures.delete ? (
            <button
              type="button"
              onClick={() => {
                onDelete(contextMenuLayer.id);
                setContextMenuState(null);
              }}
              style={{
                ...contextMenuButtonStyle,
                color: 'var(--overlay-danger, #fb7185)',
              }}
            >
              Delete
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

const inputStyle: CSSProperties = {
  width: '100%',
  minHeight: 30,
  boxSizing: 'border-box',
  borderRadius: 'var(--overlay-explorer-control-radius)',
  border: '1px solid var(--overlay-explorer-input-border)',
  background: 'var(--overlay-explorer-input-bg)',
  color: 'var(--overlay-text-primary)',
  outline: 'none',
  padding: '0 10px',
  fontSize: 12,
};

const panelMetaStyle: CSSProperties = {
  color: 'var(--overlay-text-muted)',
  fontSize: 10,
  fontFamily: 'var(--overlay-font-mono)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
};

const inlineMetaStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
  minWidth: 0,
};

const miniSectionLabelStyle: CSSProperties = {
  color: 'var(--overlay-text-muted)',
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
};

const valueBadgeStyle: CSSProperties = {
  color: 'var(--overlay-text-primary)',
  fontSize: 10,
  fontWeight: 800,
  fontFamily: 'var(--overlay-font-mono)',
};

const contextMenuButtonStyle: CSSProperties = {
  border: 0,
  background: 'transparent',
  color: 'var(--overlay-text-primary)',
  textAlign: 'left',
  borderRadius: 'calc(var(--overlay-explorer-control-radius) - 2px)',
  minHeight: 30,
  padding: '0 10px',
  fontSize: 12,
  cursor: 'pointer',
};

const srOnlyStyle: CSSProperties = {
  position: 'absolute',
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: 'hidden',
  clip: 'rect(0, 0, 0, 0)',
  border: 0,
};

function iconButtonStyle(args: {
  active: boolean;
  compact: boolean;
  disabled?: boolean;
  tone?: 'neutral' | 'danger';
}): CSSProperties {
  const toneColor = args.tone === 'danger'
    ? 'var(--overlay-danger, #fb7185)'
    : 'var(--overlay-text-secondary)';
  return {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: args.compact ? 22 : 24,
    height: args.compact ? 22 : 24,
    borderRadius: 'calc(var(--overlay-explorer-control-radius) - 3px)',
    border: '1px solid var(--overlay-border)',
    background: args.active
      ? 'color-mix(in srgb, var(--overlay-accent) 14%, var(--overlay-bg-panel))'
      : 'var(--overlay-workbench-settings-badge-bg)',
    color: args.active ? 'var(--overlay-text-primary)' : toneColor,
    opacity: args.disabled ? 0.38 : 1,
    cursor: args.disabled ? 'not-allowed' : 'pointer',
    flexShrink: 0,
  };
}

function actionButtonStyle(args: {
  accent: AccentPalette;
  compact: boolean;
  disabled?: boolean;
  tone?: 'neutral' | 'accent' | 'danger';
}): CSSProperties {
  const tone = args.tone ?? 'neutral';
  const background = tone === 'accent'
    ? args.accent.softBackground
    : tone === 'danger'
      ? 'var(--overlay-explorer-danger-soft-bg, rgba(248,113,113,0.12))'
      : 'var(--overlay-workbench-settings-badge-bg)';
  const borderColor = tone === 'accent'
    ? args.accent.softBorder
    : tone === 'danger'
      ? 'var(--overlay-explorer-danger-soft-border, rgba(248,113,113,0.28))'
      : 'var(--overlay-border)';
  const color = tone === 'accent'
    ? args.accent.softForeground
    : tone === 'danger'
      ? 'var(--overlay-danger, #fb7185)'
      : 'var(--overlay-text-primary)';
  return {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: args.compact ? 28 : 30,
    borderRadius: 'var(--overlay-explorer-control-radius)',
    border: `1px solid ${borderColor}`,
    background,
    color,
    padding: args.compact ? '0 9px' : '0 11px',
    fontSize: 11,
    fontWeight: 800,
    cursor: args.disabled ? 'not-allowed' : 'pointer',
    opacity: args.disabled ? 0.45 : 1,
  };
}
