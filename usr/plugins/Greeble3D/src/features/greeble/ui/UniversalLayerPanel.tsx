/**
 * UniversalLayerPanel.tsx - The Ultimate K_OS Layer System
 * 
 * A feature-complete layer management UI that works across all K_OS apps.
 * Inspired by ZBrush SubTools, Photoshop Layers, Blender Outliner, and Substance Painter.
 * 
 * Features:
 * - Visibility, lock, solo toggles
 * - Multi-select (Shift+Click, Ctrl+Click)
 * - Drag-to-reorder (via @dnd-kit)
 * - Inline rename (double-click)
 * - Color labels
 * - Context menu (right-click)
 * - Merge controls (down, selected, all, visible)
 * - Opacity slider (optional)
 * - Thumbnails (optional)
 * - Groups/Folders (optional)
 * - Search filter (optional)
 * 
 * Usage:
 * <UniversalLayerPanel
 *     layers={layers}
 *     activeLayerId={activeId}
 *     onSelect={(id) => setActiveId(id)}
 *     onToggleVisibility={(id) => toggleVis(id)}
 *     onDelete={(id) => deleteLayer(id)}
 *     features={{ add: true, rename: true, lock: true, solo: true, reorder: true, merge: true }}
 *     accentColor="orange"
 * />
 */

import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import {
    Layers, Eye, EyeOff, Trash2, Plus, Lock, Unlock, Headphones,
    ChevronUp, ChevronDown, Copy, Merge, Combine, Search, X,
    Edit3, GripVertical,
    MousePointer2
} from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

export type BlendMode = 'normal' | 'multiply' | 'screen' | 'overlay' | 'add' | 'subtract';

export interface UniversalLayer {
    id: string;
    name: string;
    visible: boolean;
    locked?: boolean;
    solo?: boolean;
    opacity?: number;
    blendMode?: BlendMode;
    polyCount?: number;
    color?: string;           // Color label (hex)
    thumbnail?: string;       // Base64 or URL
    hasMaterial?: boolean;    // Material indicator
    parentId?: string;        // For groups
    isGroup?: boolean;
    collapsed?: boolean;
}

export interface UniversalLayerFeatures {
    // Tier 1 - Core
    add?: boolean;
    visibility?: boolean;  // Show visibility toggle (default: true)
    delete?: boolean;      // Show delete button (default: true)
    rename?: boolean;
    lock?: boolean;
    solo?: boolean;

    // Tier 2 - Organization
    reorder?: boolean;
    colorLabels?: boolean;
    groups?: boolean;
    duplicate?: boolean;
    contextMenu?: boolean;

    // Tier 3 - Pro
    thumbnails?: boolean;
    search?: boolean;
    opacity?: boolean;
    blendModes?: boolean;
    polyCount?: boolean;
    materialIndicator?: boolean;

    // Tier 4 - Merge & Delete
    mergeDown?: boolean;
    mergeSelected?: boolean;
    mergeAll?: boolean;
    mergeVisible?: boolean;
    deleteSelected?: boolean;
    deleteAll?: boolean;
}

export type AccentColor = 'blue' | 'orange' | 'rose' | 'emerald' | 'purple' | 'cyan';

export interface UniversalLayerPanelProps {
    // Core (Required)
    layers: UniversalLayer[];
    activeLayerId: string | null;
    onSelect: (id: string, opts?: { multi?: boolean; shift?: boolean; ctrl?: boolean }) => void;
    onToggleVisibility: (id: string) => void;
    onDelete: (id: string) => void;
    selectedLayerIds?: Set<string>;
    onSelectionChange?: (ids: Set<string>) => void;

    // Feature flags
    features?: UniversalLayerFeatures;

    // Callbacks
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
    onMergeLayer?: (id: string) => void; // NEW: Merge all objects in this layer
    onMergeSelected?: () => void;
    onMergeAll?: () => void;
    onMergeVisible?: () => void;
    onDeleteSelected?: () => void;
    onDeleteAll?: () => void;
    onToggleGroup?: (id: string) => void;

    // Theming
    accentColor?: AccentColor;
    title?: string;
    emptyMessage?: string;
    compact?: boolean;

    // Custom header content
    headerActions?: React.ReactNode;
}

// ============================================================================
// ACCENT COLOR STYLES
// ============================================================================

const ACCENT_STYLES: Record<AccentColor, {
    bg: string; border: string; text: string; hover: string; glow: string;
}> = {
    blue: {
        bg: 'bg-blue-900/30',
        border: 'border-blue-500/50',
        text: 'text-blue-400',
        hover: 'hover:bg-blue-900/50',
        glow: 'shadow-[0_0_15px_rgba(59,130,246,0.15)]'
    },
    orange: {
        bg: 'bg-orange-900/30',
        border: 'border-orange-500/50',
        text: 'text-orange-400',
        hover: 'hover:bg-orange-900/50',
        glow: 'shadow-[0_0_15px_rgba(249,115,22,0.15)]'
    },
    rose: {
        bg: 'bg-rose-900/30',
        border: 'border-rose-500/50',
        text: 'text-rose-400',
        hover: 'hover:bg-rose-900/50',
        glow: 'shadow-[0_0_15px_rgba(244,63,94,0.15)]'
    },
    emerald: {
        bg: 'bg-emerald-900/30',
        border: 'border-emerald-500/50',
        text: 'text-emerald-400',
        hover: 'hover:bg-emerald-900/50',
        glow: 'shadow-[0_0_15px_rgba(16,185,129,0.15)]'
    },
    purple: {
        bg: 'bg-purple-900/30',
        border: 'border-purple-500/50',
        text: 'text-purple-400',
        hover: 'hover:bg-purple-900/50',
        glow: 'shadow-[0_0_15px_rgba(168,85,247,0.15)]'
    },
    cyan: {
        bg: 'bg-cyan-900/30',
        border: 'border-cyan-500/50',
        text: 'text-cyan-400',
        hover: 'hover:bg-cyan-900/50',
        glow: 'shadow-[0_0_15px_rgba(6,182,212,0.15)]'
    }
};

const COLOR_LABELS = [
    '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6',
    '#3b82f6', '#8b5cf6', '#ec4899', '#6b7280', '#ffffff'
];

// ============================================================================
// LAYER ITEM COMPONENT
// ============================================================================

interface LayerItemProps {
    layer: UniversalLayer;
    isActive: boolean;
    isSelected: boolean;
    index: number;
    totalCount: number;
    features: UniversalLayerFeatures;
    accent: typeof ACCENT_STYLES.orange;
    compact: boolean;
    onSelect: (id: string, opts?: { multi?: boolean; shift?: boolean; ctrl?: boolean }) => void;
    onToggleVisibility: (id: string) => void;
    onDelete: (id: string) => void;
    onLock?: (id: string) => void;
    onSolo?: (id: string) => void;
    onRename?: (id: string, name: string) => void;
    onDuplicate?: (id: string) => void;
    onMergeDown?: (id: string) => void;
    onMergeLayer?: (id: string) => void; // NEW
    onColorLabel?: (id: string, color: string) => void;
    onOpacityChange?: (id: string, opacity: number) => void;
    onMoveUp?: () => void;
    onMoveDown?: () => void;
}

function LayerItem({
    layer,
    isActive,
    isSelected,
    index,
    totalCount,
    features,
    accent,
    compact,
    onSelect,
    onToggleVisibility,
    onDelete,
    onLock,
    onSolo,
    onRename,
    onDuplicate,
    onMergeDown,
    onMergeLayer,
    onColorLabel,
    onOpacityChange,
    onMoveUp,
    onMoveDown
}: LayerItemProps) {
    const [isRenaming, setIsRenaming] = useState(false);
    const [renameValue, setRenameValue] = useState(layer.name);
    const [showContextMenu, setShowContextMenu] = useState(false);
    const [contextMenuPos, setContextMenuPos] = useState({ x: 0, y: 0 });
    const inputRef = useRef<HTMLInputElement>(null);

    const handleDoubleClick = useCallback(() => {
        if (features.rename && onRename) {
            setIsRenaming(true);
            setRenameValue(layer.name);
            setTimeout(() => inputRef.current?.select(), 0);
        }
    }, [features.rename, onRename, layer.name]);

    const handleRenameSubmit = useCallback(() => {
        if (renameValue.trim() && renameValue !== layer.name) {
            onRename?.(layer.id, renameValue.trim());
        }
        setIsRenaming(false);
    }, [renameValue, layer.name, layer.id, onRename]);

    const handleContextMenu = useCallback((e: React.MouseEvent) => {
        if (!features.contextMenu) return;
        e.preventDefault();
        setContextMenuPos({ x: e.clientX, y: e.clientY });
        setShowContextMenu(true);
    }, [features.contextMenu]);

    const handleClick = useCallback((e: React.MouseEvent) => {
        onSelect(layer.id, {
            multi: e.shiftKey || e.ctrlKey || e.metaKey,
            shift: e.shiftKey,
            ctrl: e.ctrlKey || e.metaKey
        });
    }, [layer.id, onSelect]);

    return (
        <div
            onClick={handleClick}
            onDoubleClick={handleDoubleClick}
            onContextMenu={handleContextMenu}
            className={`
                group flex flex-col rounded border cursor-pointer transition-all
                ${compact ? 'p-1.5' : 'p-2'}
                ${isActive
                    ? `${accent.bg} ${accent.border} ${accent.glow}`
                    : isSelected
                        ? 'bg-[#1a1a1a] border-white/20'
                        : 'bg-transparent border-transparent hover:bg-[#161616] hover:border-[#333]'
                }
                ${layer.locked ? 'opacity-60' : ''}
            `}
        >
            {/* Main Row */}
            <div className="flex items-center gap-2">
                {/* Selection Checkbox */}
                <div 
                    className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                        isSelected 
                            ? `${accent.border} bg-white/10` 
                            : 'border-gray-700 hover:border-gray-500'
                    }`}
                    onClick={(e) => {
                        e.stopPropagation();
                        onSelect(layer.id, { ctrl: true });
                    }}
                >
                    {isSelected && (
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                            <path d="M1 5L4 8L9 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={accent.text} />
                        </svg>
                    )}
                </div>
                
                {/* Drag Handle */}
                {features.reorder && (
                    <div className="text-gray-700 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity">
                        <GripVertical size={12} />
                    </div>
                )}

                {/* Color Label */}
                {layer.color && (
                    <div
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: layer.color }}
                    />
                )}

                {/* Visibility */}
                <button
                    onClick={(e) => { e.stopPropagation(); onToggleVisibility(layer.id); }}
                    className={`p-0.5 rounded hover:bg-black/50 transition-colors ${layer.visible ? 'text-gray-400' : 'text-gray-700'}`}
                >
                    {layer.visible ? <Eye size={compact ? 12 : 14} /> : <EyeOff size={compact ? 12 : 14} />}
                </button>

                {/* Lock */}
                {features.lock && onLock && (
                    <button
                        onClick={(e) => { e.stopPropagation(); onLock(layer.id); }}
                        className={`p-0.5 rounded hover:bg-black/50 transition-colors ${layer.locked ? 'text-yellow-500' : 'text-gray-700'}`}
                    >
                        {layer.locked ? <Lock size={compact ? 10 : 12} /> : <Unlock size={compact ? 10 : 12} />}
                    </button>
                )}

                {/* Solo */}
                {features.solo && onSolo && (
                    <button
                        onClick={(e) => { e.stopPropagation(); onSolo(layer.id); }}
                        className={`p-0.5 rounded hover:bg-black/50 transition-colors ${layer.solo ? accent.text : 'text-gray-700'}`}
                        title="Solo (S)"
                    >
                        <Headphones size={compact ? 10 : 12} />
                    </button>
                )}

                {/* Thumbnail */}
                {features.thumbnails && layer.thumbnail && (
                    <div className="w-8 h-8 rounded border border-[#333] overflow-hidden flex-shrink-0">
                        <img src={layer.thumbnail} alt="" className="w-full h-full object-cover" />
                    </div>
                )}

                {/* Name */}
                <div className="flex-1 min-w-0">
                    {isRenaming ? (
                        <input
                            ref={inputRef}
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            onBlur={handleRenameSubmit}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') handleRenameSubmit();
                                if (e.key === 'Escape') setIsRenaming(false);
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className={`w-full bg-black border ${accent.border} rounded px-1 text-white outline-none ${compact ? 'text-[9px]' : 'text-[10px]'}`}
                            autoFocus
                        />
                    ) : (
                        <div className={`font-bold truncate ${compact ? 'text-[9px]' : 'text-[10px]'} ${isActive ? 'text-white' : isSelected ? 'text-gray-200' : 'text-gray-400'}`}>
                            {layer.name}
                        </div>
                    )}

                    {/* Poly Count / Info Row */}
                    {!compact && features.polyCount && layer.polyCount !== undefined && (
                        <div className="text-[8px] text-gray-600 font-mono">
                            {layer.polyCount.toLocaleString()} polys
                        </div>
                    )}
                </div>

                {/* Material Indicator */}
                {features.materialIndicator && layer.hasMaterial && (
                    <div className="flex items-center gap-1 bg-[#222] px-1.5 py-0.5 rounded border border-[#333]">
                        <div className={`w-1.5 h-1.5 rounded-full ${accent.text.replace('text-', 'bg-')} animate-pulse`} />
                        <span className="text-[7px] text-gray-400 font-mono">MAT</span>
                    </div>
                )}

                {/* Active Indicator */}
                {isActive && <MousePointer2 size={10} className={accent.text} />}
                {isSelected && !isActive && <div className={`w-1.5 h-1.5 rounded-full ${accent.text.replace('text-', 'bg-')}/50`} />}

                {/* Move Buttons */}
                {features.reorder && (
                    <div className="flex flex-col opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                            onClick={(e) => { e.stopPropagation(); onMoveUp?.(); }}
                            disabled={index === 0}
                            className="text-gray-600 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed p-0.5"
                        >
                            <ChevronUp size={10} />
                        </button>
                        <button
                            onClick={(e) => { e.stopPropagation(); onMoveDown?.(); }}
                            disabled={index === totalCount - 1}
                            className="text-gray-600 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed p-0.5"
                        >
                            <ChevronDown size={10} />
                        </button>
                    </div>
                )}

                {/* Quick Actions */}
                {features.duplicate && onDuplicate && (
                    <button
                        onClick={(e) => { e.stopPropagation(); onDuplicate(layer.id); }}
                        className="p-1 rounded text-gray-700 hover:text-green-400 hover:bg-black/50 opacity-0 group-hover:opacity-100 transition-all"
                        title="Duplicate"
                    >
                        <Copy size={12} />
                    </button>
                )}

                {features.mergeDown && onMergeDown && index < totalCount - 1 && (
                    <button
                        onClick={(e) => { e.stopPropagation(); onMergeDown(layer.id); }}
                        className="p-1 rounded text-gray-700 hover:text-blue-400 hover:bg-black/50 opacity-0 group-hover:opacity-100 transition-all"
                        title="Merge Down"
                    >
                        <Combine size={12} />
                    </button>
                )}

                {/* Merge Layer - Combine all objects in this layer */}
                {onMergeLayer && (
                    <button
                        onClick={(e) => { e.stopPropagation(); onMergeLayer(layer.id); }}
                        className="p-1 rounded text-gray-700 hover:text-emerald-400 hover:bg-black/50 opacity-0 group-hover:opacity-100 transition-all"
                        title="Merge all objects in this layer into one mesh"
                    >
                        <Merge size={12} />
                    </button>
                )}

                {/* Delete */}
                <button
                    onClick={(e) => { e.stopPropagation(); onDelete(layer.id); }}
                    className="p-1 rounded text-gray-700 hover:text-red-400 hover:bg-black/50 opacity-0 group-hover:opacity-100 transition-all"
                    title="Delete"
                >
                    <Trash2 size={12} />
                </button>
            </div>

            {/* Opacity Slider (shown when active) */}
            {isActive && features.opacity && onOpacityChange && (
                <div
                    className="flex items-center gap-2 mt-2 px-1 animate-in fade-in slide-in-from-top-1 duration-200"
                    onClick={(e) => e.stopPropagation()}
                >
                    <span className="text-[8px] text-gray-600 font-bold w-8">OPACITY</span>
                    <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.01"
                        value={layer.opacity ?? 1}
                        onChange={(e) => onOpacityChange(layer.id, parseFloat(e.target.value))}
                        className={`flex-1 h-1 bg-[#222] rounded-lg appearance-none cursor-pointer accent-current ${accent.text}`}
                    />
                    <span className={`text-[8px] ${accent.text} w-6 text-right`}>
                        {Math.round((layer.opacity ?? 1) * 100)}%
                    </span>
                </div>
            )}

            {/* Context Menu */}
            {showContextMenu && features.contextMenu && (
                <ContextMenu
                    x={contextMenuPos.x}
                    y={contextMenuPos.y}
                    onClose={() => setShowContextMenu(false)}
                    layer={layer}
                    features={features}
                    accent={accent}
                    onRename={() => { setShowContextMenu(false); handleDoubleClick(); }}
                    onDuplicate={() => { setShowContextMenu(false); onDuplicate?.(layer.id); }}
                    onDelete={() => { setShowContextMenu(false); onDelete(layer.id); }}
                    onColorLabel={(color) => { setShowContextMenu(false); onColorLabel?.(layer.id, color); }}
                    onLock={() => { setShowContextMenu(false); onLock?.(layer.id); }}
                    onSolo={() => { setShowContextMenu(false); onSolo?.(layer.id); }}
                />
            )}
        </div>
    );
}

// ============================================================================
// CONTEXT MENU COMPONENT
// ============================================================================

interface ContextMenuProps {
    x: number;
    y: number;
    onClose: () => void;
    layer: UniversalLayer;
    features: UniversalLayerFeatures;
    accent: typeof ACCENT_STYLES.orange;
    onRename: () => void;
    onDuplicate: () => void;
    onDelete: () => void;
    onColorLabel: (color: string) => void;
    onLock: () => void;
    onSolo: () => void;
}

function ContextMenu({ x, y, onClose, layer, features, onRename, onDuplicate, onDelete, onColorLabel, onLock, onSolo }: ContextMenuProps) {
    const menuRef = useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                onClose();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [onClose]);

    const MenuItem = ({ icon: Icon, label, onClick, danger }: { icon: any; label: string; onClick: () => void; danger?: boolean }) => (
        <button
            onClick={onClick}
            className={`w-full flex items-center gap-2 px-3 py-1.5 text-[10px] ${danger ? 'text-red-400 hover:bg-red-900/30' : 'text-gray-300 hover:bg-white/5'} transition-colors`}
        >
            <Icon size={12} />
            {label}
        </button>
    );

    return (
        <div
            ref={menuRef}
            className="fixed z-[9999] bg-[#1a1a1a] border border-[#333] rounded-lg shadow-2xl py-1 min-w-[160px] animate-in fade-in zoom-in-95 duration-100"
            style={{ left: x, top: y }}
        >
            {features.rename && <MenuItem icon={Edit3} label="Rename" onClick={onRename} />}
            {features.duplicate && <MenuItem icon={Copy} label="Duplicate" onClick={onDuplicate} />}
            {features.lock && <MenuItem icon={layer.locked ? Unlock : Lock} label={layer.locked ? 'Unlock' : 'Lock'} onClick={onLock} />}
            {features.solo && <MenuItem icon={Headphones} label={layer.solo ? 'Unsolo' : 'Solo'} onClick={onSolo} />}

            {features.colorLabels && (
                <>
                    <div className="h-px bg-[#333] my-1" />
                    <div className="px-2 py-1">
                        <div className="text-[8px] text-gray-600 mb-1 font-bold">COLOR LABEL</div>
                        <div className="flex gap-1 flex-wrap">
                            {COLOR_LABELS.map(color => (
                                <button
                                    key={color}
                                    onClick={() => onColorLabel(color)}
                                    className={`w-4 h-4 rounded-full border border-black/50 hover:scale-110 transition-transform ${layer.color === color ? 'ring-2 ring-white/50' : ''}`}
                                    style={{ backgroundColor: color }}
                                />
                            ))}
                            {layer.color && (
                                <button
                                    onClick={() => onColorLabel('')}
                                    className="w-4 h-4 rounded-full border border-[#333] flex items-center justify-center text-gray-500 hover:text-white"
                                >
                                    <X size={8} />
                                </button>
                            )}
                        </div>
                    </div>
                </>
            )}

            <div className="h-px bg-[#333] my-1" />
            <MenuItem icon={Trash2} label="Delete" onClick={onDelete} danger />
        </div>
    );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function UniversalLayerPanel({
    layers,
    activeLayerId,
    onSelect,
    onToggleVisibility,
    onDelete,
    selectedLayerIds = new Set(),
    features = {},
    onAdd,
    onRename,
    onLock,
    onSolo,
    onReorder,
    onColorLabel,
    onDuplicate,
    onOpacityChange,
    // onBlendModeChange,
    onMergeDown,
    onMergeLayer,
    onMergeSelected,
    // onMergeAll,
    // onMergeVisible,
    // onDeleteSelected,
    // onDeleteAll,
    // onToggleGroup,
    onSelectionChange,
    accentColor = 'orange',
    title = 'LAYERS',
    emptyMessage = 'No layers',
    compact = false,
    headerActions
}: UniversalLayerPanelProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const accent = ACCENT_STYLES[accentColor];

    const selectedCount = selectedLayerIds.size;
    
    const [lastSelectedId, setLastSelectedId] = useState<string | null>(activeLayerId);
    
    // DEBUG: Log selection changes
    React.useEffect(() => {
        console.log('🔍 UniversalLayerPanel - selectedLayerIds:', Array.from(selectedLayerIds), 'count:', selectedCount);
    }, [selectedLayerIds, selectedCount]);

    // Filter layers by search
    const filteredLayers = useMemo(() => {
        if (!features.search || !searchQuery.trim()) return layers;
        const q = searchQuery.toLowerCase();
        return layers.filter(l => l.name.toLowerCase().includes(q));
    }, [layers, searchQuery, features.search]);

    // Internal selection logic for range selection
    const handleSelect = useCallback((id: string, opts?: { multi?: boolean; shift?: boolean; ctrl?: boolean }) => {
        console.log('🎯 handleSelect called:', { id, opts, hasOnSelectionChange: !!onSelectionChange });
        
        if (!onSelectionChange) {
            onSelect(id, opts);
            setLastSelectedId(id);
            return;
        }

        const newSelection = new Set(selectedLayerIds);

        if (opts?.shift && lastSelectedId) {
            // Range Selection
            const currentIndex = filteredLayers.findIndex(l => l.id === id);
            const lastIndex = filteredLayers.findIndex(l => l.id === lastSelectedId);

            if (currentIndex !== -1 && lastIndex !== -1) {
                const start = Math.min(currentIndex, lastIndex);
                const end = Math.max(currentIndex, lastIndex);

                // If not holding ctrl, clear selection first
                if (!opts.ctrl) newSelection.clear();

                for (let i = start; i <= end; i++) {
                    newSelection.add(filteredLayers[i].id);
                }
            }
        } else if (opts?.ctrl) {
            // Toggle
            if (newSelection.has(id)) {
                newSelection.delete(id);
            } else {
                newSelection.add(id);
            }
        } else {
            // Single select
            newSelection.clear();
            newSelection.add(id);
        }

        console.log('📦 Calling onSelectionChange with:', Array.from(newSelection));
        onSelectionChange(newSelection);
        onSelect(id, opts);
        setLastSelectedId(id);
    }, [filteredLayers, selectedLayerIds, lastSelectedId, onSelect, onSelectionChange]);

    // Display layers (reversed for stack order - top layer first)
    const displayLayers = useMemo(() => [...filteredLayers].reverse(), [filteredLayers]);

    const handleMoveUp = useCallback((index: number) => {
        if (index > 0 && onReorder) {
            onReorder(filteredLayers.length - 1 - index, filteredLayers.length - index);
        }
    }, [onReorder, filteredLayers.length]);

    const handleMoveDown = useCallback((index: number) => {
        if (index < displayLayers.length - 1 && onReorder) {
            onReorder(filteredLayers.length - 1 - index, filteredLayers.length - 2 - index);
        }
    }, [onReorder, displayLayers.length, filteredLayers.length]);

    // KEYBOARD SHORTCUTS
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Ignore if typing in input fields
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
            
            // S - Solo active layer
            if (e.key === 's' || e.key === 'S') {
                if (activeLayerId && onSolo) {
                    e.preventDefault();
                    onSolo(activeLayerId);
                }
            }
            
            // Delete - Delete selected layers
            if (e.key === 'Delete' || e.key === 'Backspace') {
                if (selectedCount > 0) {
                    e.preventDefault();
                    // Delete all selected layers
                    selectedLayerIds.forEach(id => onDelete(id));
                } else if (activeLayerId && onDelete) {
                    e.preventDefault();
                    onDelete(activeLayerId);
                }
            }
            
            // Ctrl/Cmd + D - Duplicate active layer
            if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
                if (activeLayerId && onDuplicate) {
                    e.preventDefault();
                    onDuplicate(activeLayerId);
                }
            }
            
            // Ctrl/Cmd + M - Merge selected layers
            if ((e.ctrlKey || e.metaKey) && e.key === 'm') {
                if (selectedCount > 1 && onMergeSelected) {
                    e.preventDefault();
                    onMergeSelected();
                }
            }
        };
        
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [activeLayerId, selectedCount, onSolo, onDelete, onDuplicate, onMergeSelected]);

    return (
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            {/* HEADER */}
            <div className={`bg-[#111] border-b border-[#222] ${compact ? 'p-2' : 'p-3'}`}>
                <div className="flex items-center justify-between">
                    <div className={`font-bold uppercase tracking-widest flex items-center gap-2 ${compact ? 'text-[9px]' : 'text-[10px]'} ${accent.text}`}>
                        <Layers size={compact ? 12 : 14} />
                        {title} ({layers.length})
                    </div>
                    <div className="flex gap-1">
                        {headerActions}
                        {features.add && onAdd && (
                            <button
                                onClick={onAdd}
                                className={`p-1.5 ${accent.bg} ${accent.hover} border ${accent.border} ${accent.text} rounded transition-all hover:scale-105`}
                                title="Add Layer"
                            >
                                <Plus size={compact ? 12 : 14} />
                            </button>
                        )}
                    </div>
                </div>

                {/* MERGE SELECTED BUTTON - Always visible, ZBrush style */}
                {features.mergeSelected && onMergeSelected && (
                    <div className="mt-2">
                        <button
                            onClick={() => {
                                console.log('🔥 MERGE BUTTON CLICKED! selectedCount:', selectedCount, 'callback exists:', !!onMergeSelected);
                                onMergeSelected();
                            }}
                            disabled={selectedCount < 2}
                            className={`w-full py-2 rounded-lg text-[10px] font-bold border-2 transition-all flex items-center justify-center gap-2 ${selectedCount >= 2
                                ? `${accent.bg} ${accent.text} ${accent.border} ${accent.hover} shadow-lg ${accent.glow} animate-pulse`
                                : 'bg-[#0a0a0a] text-gray-700 border-[#1a1a1a] cursor-not-allowed'
                                }`}
                            title={selectedCount < 2 ? "Select 2+ layers to merge (Ctrl+Click checkboxes)" : `Merge ${selectedCount} selected layers`}
                        >
                            <Merge size={14} className={selectedCount >= 2 ? 'animate-bounce' : ''} />
                            {selectedCount >= 2 ? `MERGE ${selectedCount} LAYERS` : 'SELECT LAYERS TO MERGE'}
                        </button>
                    </div>
                )}

                {/* Search */}
                {features.search && (
                    <div className="mt-2 relative">
                        <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-600" />
                        <input
                            type="text"
                            placeholder="Search layers..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-[#0a0a0a] border border-[#222] rounded pl-7 pr-2 py-1 text-[10px] text-gray-300 placeholder-gray-600 outline-none focus:border-[#333]"
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery('')}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-600 hover:text-white"
                            >
                                <X size={10} />
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* LAYER LIST */}
            <div className={`flex-1 overflow-y-auto custom-scrollbar ${compact ? 'p-1 space-y-0.5' : 'p-2 space-y-1'}`}>
                {displayLayers.length === 0 ? (
                    <div className="text-center py-8 text-[10px] text-gray-700 italic border-2 border-dashed border-[#222] rounded">
                        {searchQuery ? 'No matching layers' : emptyMessage}
                    </div>
                ) : (
                    displayLayers.map((layer, index) => (
                        <LayerItem
                            key={layer.id}
                            layer={layer}
                            isActive={activeLayerId === layer.id}
                            isSelected={selectedLayerIds.has(layer.id)}
                            index={index}
                            totalCount={displayLayers.length}
                            features={features}
                            accent={accent}
                            compact={compact}
                            onSelect={handleSelect}
                            onToggleVisibility={onToggleVisibility}
                            onDelete={onDelete}
                            onLock={onLock}
                            onSolo={onSolo}
                            onRename={onRename}
                            onDuplicate={onDuplicate}
                            onMergeDown={onMergeDown}
                            onMergeLayer={onMergeLayer}
                            onColorLabel={onColorLabel}
                            onOpacityChange={onOpacityChange}
                            onMoveUp={() => handleMoveUp(index)}
                            onMoveDown={() => handleMoveDown(index)}
                        />
                    ))
                )}
            </div>

            {/* FOOTER */}
            <div className={`border-t border-[#222] flex justify-between text-[9px] text-gray-600 font-mono ${compact ? 'p-1 px-2' : 'p-2 px-3'}`}>
                <span>{layers.length} {layers.length === 1 ? 'LAYER' : 'LAYERS'}</span>
                {features.solo && <span>'S' TO SOLO</span>}
            </div>
        </div>
    );
}

export default UniversalLayerPanel;
