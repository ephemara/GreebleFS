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

export const explorerAutoOpenDelayMsByRole: Partial<
  Record<ExplorerDropSurfaceRole, number>
> = {
  "directory-target": 700,
  "navigation-target": 700,
};

export const EXPLORER_TAB_AUTO_OPEN_DELAY_MS = 800;

export const EXPLORER_DRAG_OVERLAY_POINTER_OFFSET = {
  x: 18,
  y: 20,
} as const;
