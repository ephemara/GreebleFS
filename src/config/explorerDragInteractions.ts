export type ExplorerDropSurfaceRole =
  | "scope-root"
  | "directory-target"
  | "navigation-target"
  | "non-target-chrome";

export type ExplorerResolvedDropSurfaceKind =
  | "scope-root"
  | "directory"
  | "navigation";

export const explorerDropSurfacePriority: Record<
  ExplorerDropSurfaceRole,
  number
> = {
  "scope-root": 0,
  "non-target-chrome": 0,
  "navigation-target": 1,
  "directory-target": 2,
};

export const EXPLORER_DIRECTORY_AUTO_OPEN_DELAY_MS = 950;
export const EXPLORER_NAVIGATION_AUTO_OPEN_DELAY_MS = 900;

export const explorerAutoOpenDelayMsByRole: Partial<
  Record<ExplorerDropSurfaceRole, number>
> = {
  "directory-target": EXPLORER_DIRECTORY_AUTO_OPEN_DELAY_MS,
  "navigation-target": EXPLORER_NAVIGATION_AUTO_OPEN_DELAY_MS,
};

export const EXPLORER_TAB_AUTO_OPEN_DELAY_MS = 1050;

export const EXPLORER_DRAG_OVERLAY_POINTER_OFFSET = {
  x: 18,
  y: 20,
} as const;

export const EXPLORER_DRAG_OVERLAY_MAX_STACK_DEPTH = 3;

export const EXPLORER_DRAG_OVERLAY_SPRING = {
  stiffness: 420,
  damping: 34,
  mass: 0.42,
} as const;

export const EXPLORER_DRAG_OVERLAY_ROTATION_SPRING = {
  stiffness: 320,
  damping: 26,
  mass: 0.3,
} as const;

export const EXPLORER_DRAG_OVERLAY_TILT_FACTOR = 0.16;
export const EXPLORER_DRAG_OVERLAY_MAX_TILT_DEGREES = 8;

export const EXPLORER_DRAG_SOURCE_GHOST_OPACITY = 0.28;
export const EXPLORER_DRAG_SOURCE_GHOST_SCALE = 0.985;

export const EXPLORER_DRAG_TARGET_HIGHLIGHT_SCALE = 1.028;
export const EXPLORER_DRAG_TARGET_HIGHLIGHT_OPACITY = 0.96;
export const EXPLORER_DRAG_DWELL_INDICATOR_HEIGHT_PX = 3;
export const EXPLORER_DRAG_FOLDER_INHALE_SCALE = 1.05;
export const EXPLORER_DRAG_FOLDER_DWELL_SCALE = 1.085;
export const EXPLORER_DRAG_FOLDER_INHALE_LIFT_PX = 2;
export const EXPLORER_DRAG_FOLDER_DWELL_LIFT_PX = 5;

export const EXPLORER_DRAG_AUTOSCROLL_EDGE_PX = 88;
export const EXPLORER_DRAG_AUTOSCROLL_OUTSET_PX = 24;
export const EXPLORER_DRAG_AUTOSCROLL_MIN_SPEED_PX_PER_SECOND = 220;
export const EXPLORER_DRAG_AUTOSCROLL_MAX_SPEED_PX_PER_SECOND = 1680;

export const EXPLORER_DRAG_DROP_BURST_DURATION_MS = 170;
export const EXPLORER_DRAG_CANCEL_BURST_DURATION_MS = 120;
