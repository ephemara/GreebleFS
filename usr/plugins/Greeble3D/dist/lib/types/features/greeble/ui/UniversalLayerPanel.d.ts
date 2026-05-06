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
import React from 'react';
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
export type AccentColor = 'blue' | 'orange' | 'rose' | 'emerald' | 'purple' | 'cyan';
export interface UniversalLayerPanelProps {
    layers: UniversalLayer[];
    activeLayerId: string | null;
    onSelect: (id: string, opts?: {
        multi?: boolean;
        shift?: boolean;
        ctrl?: boolean;
    }) => void;
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
    onMergeLayer?: (id: string) => void;
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
    headerActions?: React.ReactNode;
}
export declare function UniversalLayerPanel({ layers, activeLayerId, onSelect, onToggleVisibility, onDelete, selectedLayerIds, features, onAdd, onRename, onLock, onSolo, onReorder, onColorLabel, onDuplicate, onOpacityChange, onMergeDown, onMergeLayer, onMergeSelected, onSelectionChange, accentColor, title, emptyMessage, compact, headerActions }: UniversalLayerPanelProps): import("react/jsx-runtime").JSX.Element;
export default UniversalLayerPanel;
