import type { MouseEvent as ReactMouseEvent } from "react";

import type {
  ExplorerActivityLaneDefinition,
  ExplorerActivityLaneId,
  ExplorerActivityRailSide,
} from "../../config/explorerActivityRail";
import type {
  ExplorerMenuRendererKind,
  ExplorerMenuTone,
} from "../../config/explorerContextMenu";
import type {
  ExplorerChromeControlId,
  ExplorerChromeSurfaceId,
} from "../../config/explorerChromeLayouts";
import type { ExplorerTagMetadataSnapshot } from "../../runtime/explorerBackend";

export type OverlayContextMenuDensity = "compact" | "balanced" | "touch";

export interface OverlayContextMenuCommandNode {
  kind: "command";
  id: string;
  label: string;
  description?: string;
  iconName?: string;
  tone: ExplorerMenuTone;
  shortcutId?: string;
  disabled?: boolean;
  onSelect: () => void | Promise<void>;
}

export interface OverlayContextMenuSubmenuNode {
  kind: "submenu";
  id: string;
  label: string;
  iconName?: string;
  tone: ExplorerMenuTone;
  children: OverlayContextMenuNode[];
}

export interface OverlayContextMenuSeparatorNode {
  kind: "separator";
  id: string;
  tone: ExplorerMenuTone;
}

export type OverlayContextMenuNode =
  | OverlayContextMenuCommandNode
  | OverlayContextMenuSubmenuNode
  | OverlayContextMenuSeparatorNode;

export interface OverlayContextMenuPresentationOptions {
  renderer?: ExplorerMenuRendererKind;
  fallbackRenderer?: ExplorerMenuRendererKind;
  density?: OverlayContextMenuDensity;
  showDescriptions?: boolean;
  shapeLanguage?: string;
  motionStyle?: string;
  materialStyle?: string;
  iconTreatment?: "standard" | "duotone" | "outlined";
  submenuBehavior?: "sidecar" | "sheet" | "stacked";
  focusStyle?: "line" | "glow" | "pill";
  backdropStyle?: "none" | "blur" | "scrim";
}

export interface OverlayContextMenuOpenRequest {
  event: Pick<
    ReactMouseEvent<HTMLElement>,
    "clientX" | "clientY" | "preventDefault" | "stopPropagation"
  >;
  nodes: OverlayContextMenuNode[];
  presentation?: OverlayContextMenuPresentationOptions;
}

export interface ExplorerChromeContextMenuRequest {
  event: ReactMouseEvent<HTMLElement>;
  surfaceId: ExplorerChromeSurfaceId;
  controlId: ExplorerChromeControlId | null;
}

export interface ExplorerActivityRailContextMenuRequest {
  event: ReactMouseEvent<HTMLElement>;
  railSide: ExplorerActivityRailSide;
  laneId: ExplorerActivityLaneId | null;
  laneDefinition: ExplorerActivityLaneDefinition | null;
}

export interface ExplorerSideRailTagContextMenuRequest {
  kind: "tag-filter";
  event: ReactMouseEvent<HTMLElement>;
  tag: ExplorerTagMetadataSnapshot["tags"][number] | null;
}

export interface ExplorerSideRailControlsContextMenuRequest {
  kind: "rail-controls";
  event: ReactMouseEvent<HTMLElement>;
  nodes: OverlayContextMenuNode[];
  presentation?: OverlayContextMenuPresentationOptions;
}

export type ExplorerSideRailContextMenuRequest =
  | ExplorerSideRailTagContextMenuRequest
  | ExplorerSideRailControlsContextMenuRequest;

export function createOverlayContextMenuCommandNode(input: {
  id: string;
  label: string;
  description?: string;
  iconName?: string;
  tone?: ExplorerMenuTone;
  shortcutId?: string;
  disabled?: boolean;
  onSelect: () => void | Promise<void>;
}): OverlayContextMenuCommandNode {
  return {
    kind: "command",
    id: input.id,
    label: input.label,
    description: input.description,
    iconName: input.iconName,
    tone: input.tone ?? "safe",
    shortcutId: input.shortcutId,
    disabled: input.disabled ?? false,
    onSelect: input.onSelect,
  };
}

export function createOverlayContextMenuSubmenuNode(input: {
  id: string;
  label: string;
  iconName?: string;
  tone?: ExplorerMenuTone;
  children: OverlayContextMenuNode[];
}): OverlayContextMenuSubmenuNode {
  return {
    kind: "submenu",
    id: input.id,
    label: input.label,
    iconName: input.iconName,
    tone: input.tone ?? "safe",
    children: input.children,
  };
}

export function createOverlayContextMenuSeparatorNode(
  id: string,
): OverlayContextMenuSeparatorNode {
  return {
    kind: "separator",
    id,
    tone: "muted",
  };
}
