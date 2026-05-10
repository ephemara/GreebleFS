import {
  defaultExplorerDragEngine,
  type ExplorerDropSurfaceRole,
  type ExplorerResolvedDropSurfaceKind,
} from "./explorerDragEngines";

export type { ExplorerDropSurfaceRole, ExplorerResolvedDropSurfaceKind };

export const explorerDropSurfacePriority =
  defaultExplorerDragEngine.dropTargets.surfacePriority;

export const EXPLORER_DIRECTORY_AUTO_OPEN_DELAY_MS =
  defaultExplorerDragEngine.dropTargets.directoryAutoOpenDelayMs;
export const EXPLORER_NAVIGATION_AUTO_OPEN_DELAY_MS =
  defaultExplorerDragEngine.dropTargets.navigationAutoOpenDelayMs;

export const explorerAutoOpenDelayMsByRole: Partial<
  Record<ExplorerDropSurfaceRole, number>
> = {
  "directory-target": EXPLORER_DIRECTORY_AUTO_OPEN_DELAY_MS,
  "navigation-target": EXPLORER_NAVIGATION_AUTO_OPEN_DELAY_MS,
};

export const EXPLORER_TAB_AUTO_OPEN_DELAY_MS =
  defaultExplorerDragEngine.dropTargets.tabAutoOpenDelayMs;

export const EXPLORER_SHARED_DRAG_SESSION_LINGER_MS =
  defaultExplorerDragEngine.pointer.sharedSessionLingerMs;

export const EXPLORER_DRAG_OVERLAY_POINTER_OFFSET =
  defaultExplorerDragEngine.presentation.pointerOffset;

export const EXPLORER_DRAG_OVERLAY_MAX_STACK_DEPTH =
  defaultExplorerDragEngine.presentation.maxStackDepth;

export const EXPLORER_DRAG_OVERLAY_SPRING =
  defaultExplorerDragEngine.presentation.spring;

export const EXPLORER_DRAG_OVERLAY_ROTATION_SPRING =
  defaultExplorerDragEngine.presentation.rotationSpring;

export const EXPLORER_DRAG_OVERLAY_TILT_FACTOR =
  defaultExplorerDragEngine.presentation.tiltFactor;
export const EXPLORER_DRAG_OVERLAY_MAX_TILT_DEGREES =
  defaultExplorerDragEngine.presentation.maxTiltDegrees;

export const EXPLORER_DRAG_SOURCE_GHOST_OPACITY =
  defaultExplorerDragEngine.presentation.sourceGhostOpacity;
export const EXPLORER_DRAG_SOURCE_GHOST_SCALE =
  defaultExplorerDragEngine.presentation.sourceGhostScale;

export const EXPLORER_DRAG_TARGET_HIGHLIGHT_SCALE =
  defaultExplorerDragEngine.presentation.targetHighlightScale;
export const EXPLORER_DRAG_TARGET_HIGHLIGHT_OPACITY =
  defaultExplorerDragEngine.presentation.targetHighlightOpacity;
export const EXPLORER_DRAG_DWELL_INDICATOR_HEIGHT_PX =
  defaultExplorerDragEngine.presentation.dwellIndicatorHeightPx;
export const EXPLORER_DRAG_FOLDER_INHALE_SCALE =
  defaultExplorerDragEngine.presentation.folderInhaleScale;
export const EXPLORER_DRAG_FOLDER_DWELL_SCALE =
  defaultExplorerDragEngine.presentation.folderDwellScale;
export const EXPLORER_DRAG_FOLDER_INHALE_LIFT_PX =
  defaultExplorerDragEngine.presentation.folderInhaleLiftPx;
export const EXPLORER_DRAG_FOLDER_DWELL_LIFT_PX =
  defaultExplorerDragEngine.presentation.folderDwellLiftPx;

export const EXPLORER_DRAG_AUTOSCROLL_EDGE_PX =
  defaultExplorerDragEngine.autoscroll.edgePx;
export const EXPLORER_DRAG_AUTOSCROLL_OUTSET_PX =
  defaultExplorerDragEngine.autoscroll.outsetPx;
export const EXPLORER_DRAG_AUTOSCROLL_MIN_SPEED_PX_PER_SECOND =
  defaultExplorerDragEngine.autoscroll.minSpeedPxPerSecond;
export const EXPLORER_DRAG_AUTOSCROLL_MAX_SPEED_PX_PER_SECOND =
  defaultExplorerDragEngine.autoscroll.maxSpeedPxPerSecond;

export const EXPLORER_DRAG_DROP_BURST_DURATION_MS =
  defaultExplorerDragEngine.presentation.dropBurstDurationMs;
export const EXPLORER_DRAG_CANCEL_BURST_DURATION_MS =
  defaultExplorerDragEngine.presentation.cancelBurstDurationMs;
