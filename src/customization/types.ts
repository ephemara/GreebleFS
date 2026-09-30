import type {
  ExplorerChromeControlId,
  ExplorerChromeOverrideEntry,
  ExplorerChromeOverrideSnapshot,
  ExplorerChromeResolvedControlPlacement,
  ExplorerChromeSizeVariant,
  ExplorerChromeSurfaceId,
  ExplorerChromeZoneId,
} from "../config/explorerChromeLayouts";

export type {
  ExplorerChromeControlId,
  ExplorerChromeOverrideEntry,
  ExplorerChromeOverrideSnapshot,
  ExplorerChromeResolvedControlPlacement,
  ExplorerChromeSizeVariant,
  ExplorerChromeSurfaceId,
  ExplorerChromeZoneId,
};

export interface ZBrushDropTarget {
  surfaceId: ExplorerChromeSurfaceId;
  zoneId: ExplorerChromeZoneId;
  targetIndex: number;
}

export interface ZBrushDragState {
  active: boolean;
  controlId: ExplorerChromeControlId;
  sourceKind: "placed" | "catalog";
  sourceSurfaceId?: ExplorerChromeSurfaceId;
  sourceZoneId?: ExplorerChromeZoneId;
  sourceIndex?: number;
  label: string;
  iconName?: string;
  pointerX: number;
  pointerY: number;
  dropTarget: ZBrushDropTarget | null;
  isRemoveTarget: boolean;
}

export interface ZBrushHotkeyModalState {
  active: boolean;
  controlId: ExplorerChromeControlId | null;
  commandId: string | null;
  label: string | null;
  currentBinding: string | null;
}

export interface ZBrushIconPickerState {
  active: boolean;
  controlId: ExplorerChromeControlId | null;
  anchorRect?: {
    top: number;
    left: number;
    width: number;
    height: number;
  } | null;
}

export interface ZBrushShelfItem {
  controlId: ExplorerChromeControlId;
  placement: ExplorerChromeResolvedControlPlacement;
  label: string;
  iconName?: string;
}
