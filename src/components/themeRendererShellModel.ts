import type { ReactNode } from 'react';

export interface OverlayThemeRendererSurfaceOwnership {
  chrome: boolean;
  launcher: boolean;
  contentFrame: boolean;
  pinnedPanels: boolean;
  wallpaper: boolean;
}

export const defaultOverlayThemeRendererSurfaceOwnership: OverlayThemeRendererSurfaceOwnership = {
  chrome: true,
  launcher: true,
  contentFrame: true,
  pinnedPanels: false,
  wallpaper: false,
};

export function normalizeOverlayThemeRendererSurfaceOwnership(
  value: Partial<OverlayThemeRendererSurfaceOwnership> | undefined,
): OverlayThemeRendererSurfaceOwnership {
  return {
    chrome: value?.chrome ?? defaultOverlayThemeRendererSurfaceOwnership.chrome,
    launcher: value?.launcher ?? defaultOverlayThemeRendererSurfaceOwnership.launcher,
    contentFrame: value?.contentFrame ?? defaultOverlayThemeRendererSurfaceOwnership.contentFrame,
    pinnedPanels: value?.pinnedPanels ?? defaultOverlayThemeRendererSurfaceOwnership.pinnedPanels,
    wallpaper: value?.wallpaper ?? defaultOverlayThemeRendererSurfaceOwnership.wallpaper,
  };
}

export interface OverlayThemeRendererLayoutRegion {
  visible: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface OverlayThemeRendererShellLayoutModel {
  viewportWidth: number;
  viewportHeight: number;
  shellInset: number;
  panelGap: number;
  contentInnerPadding: number;
  regions: {
    chrome: OverlayThemeRendererLayoutRegion;
    launcher: OverlayThemeRendererLayoutRegion;
    content: OverlayThemeRendererLayoutRegion;
    pinnedLeft: OverlayThemeRendererLayoutRegion;
    pinnedRight: OverlayThemeRendererLayoutRegion;
  };
}

export interface NormalizeThemeRendererShellLayoutArgs {
  viewportWidth: number;
  viewportHeight: number;
  shellInset: number;
  panelGap: number;
  contentInnerPadding: number;
  chromeHeight: number;
  launcherVisible: boolean;
  launcherWidth: number;
  leftPinnedWidth: number;
  rightPinnedWidth: number;
}

export interface OverlayThemeRendererShellLauncherPanelModel {
  id: string;
  label: string;
  description: string;
  icon: ReactNode;
  isActive: boolean;
  isOpen: boolean;
  isPinned: boolean;
  activate: () => void;
}

export interface OverlayThemeRendererShellLauncherGroupModel {
  id: string;
  label: string;
  order: number;
  panels: OverlayThemeRendererShellLauncherPanelModel[];
}

export interface OverlayThemeRendererShellLauncherModel {
  railWidth: number;
  groups: OverlayThemeRendererShellLauncherGroupModel[];
  panels: OverlayThemeRendererShellLauncherPanelModel[];
}

export interface OverlayThemeRendererShellChromeActionModel {
  id: string;
  label: string;
  title: string;
  icon?: ReactNode;
  isActive?: boolean;
  isVisible: boolean;
  onSelect: () => void;
}

export interface OverlayThemeRendererShellChromeModel {
  utilityActions: OverlayThemeRendererShellChromeActionModel[];
}

export interface OverlayThemeRendererShellModel {
  layout: OverlayThemeRendererShellLayoutModel;
  launcher: OverlayThemeRendererShellLauncherModel;
  chrome: OverlayThemeRendererShellChromeModel;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function createHiddenRegion(): OverlayThemeRendererLayoutRegion {
  return {
    visible: false,
    x: 0,
    y: 0,
    width: 0,
    height: 0,
  };
}

function shrinkWidths(
  widths: {
    launcher: number;
    pinnedLeft: number;
    pinnedRight: number;
  },
  overflow: number,
): {
  launcher: number;
  pinnedLeft: number;
  pinnedRight: number;
} {
  let remainingOverflow = overflow;
  let launcher = widths.launcher;
  let pinnedLeft = widths.pinnedLeft;
  let pinnedRight = widths.pinnedRight;

  if (launcher > 0 && remainingOverflow > 0) {
    const nextLauncher = Math.max(220, launcher - remainingOverflow);
    remainingOverflow -= launcher - nextLauncher;
    launcher = nextLauncher;
  }

  if (pinnedRight > 0 && remainingOverflow > 0) {
    const nextPinnedRight = Math.max(180, pinnedRight - remainingOverflow);
    remainingOverflow -= pinnedRight - nextPinnedRight;
    pinnedRight = nextPinnedRight;
  }

  if (pinnedLeft > 0 && remainingOverflow > 0) {
    const nextPinnedLeft = Math.max(180, pinnedLeft - remainingOverflow);
    remainingOverflow -= pinnedLeft - nextPinnedLeft;
    pinnedLeft = nextPinnedLeft;
  }

  if (remainingOverflow > 0 && launcher > 0) {
    launcher = Math.max(0, launcher - remainingOverflow);
  }

  return {
    launcher,
    pinnedLeft,
    pinnedRight,
  };
}

export function normalizeThemeRendererShellLayout(
  args: NormalizeThemeRendererShellLayoutArgs,
): OverlayThemeRendererShellLayoutModel {
  const viewportWidth = Math.max(360, Math.round(args.viewportWidth));
  const viewportHeight = Math.max(240, Math.round(args.viewportHeight));
  const shellInset = clamp(
    Math.round(args.shellInset),
    0,
    Math.max(12, Math.floor(Math.min(viewportWidth, viewportHeight) * 0.08)),
  );
  const panelGap = clamp(Math.round(args.panelGap), 0, 32);
  const contentInnerPadding = clamp(Math.round(args.contentInnerPadding), 0, 40);
  const chromeHeight = clamp(
    Math.round(args.chromeHeight),
    32,
    Math.min(96, Math.floor(viewportHeight * 0.2)),
  );
  const horizontalBudget = viewportWidth - shellInset * 2;
  const verticalBudget = viewportHeight - shellInset * 2;
  const minContentWidth = clamp(Math.floor(horizontalBudget * 0.48), 280, 720);
  const minContentHeight = clamp(Math.floor(verticalBudget * 0.42), 220, 560);

  let launcherWidth = args.launcherVisible
    ? clamp(
        Math.round(args.launcherWidth),
        220,
        Math.min(360, Math.floor(horizontalBudget * 0.38)),
      )
    : 0;
  let pinnedLeftWidth = args.leftPinnedWidth > 0
    ? clamp(
        Math.round(args.leftPinnedWidth),
        180,
        Math.min(360, Math.floor(horizontalBudget * 0.3)),
      )
    : 0;
  let pinnedRightWidth = args.rightPinnedWidth > 0
    ? clamp(
        Math.round(args.rightPinnedWidth),
        180,
        Math.min(360, Math.floor(horizontalBudget * 0.3)),
      )
    : 0;

  const sectionCount = [
    pinnedLeftWidth > 0,
    launcherWidth > 0,
    true,
    pinnedRightWidth > 0,
  ].filter(Boolean).length;
  const gapBudget = Math.max(0, sectionCount - 1) * panelGap;

  const requestedContentWidth = horizontalBudget - pinnedLeftWidth - pinnedRightWidth - launcherWidth - gapBudget;
  if (requestedContentWidth < minContentWidth) {
    const shrunk = shrinkWidths(
      {
        launcher: launcherWidth,
        pinnedLeft: pinnedLeftWidth,
        pinnedRight: pinnedRightWidth,
      },
      minContentWidth - requestedContentWidth,
    );
    launcherWidth = shrunk.launcher;
    pinnedLeftWidth = shrunk.pinnedLeft;
    pinnedRightWidth = shrunk.pinnedRight;
  }

  const contentHeightBeforeClamp = verticalBudget - chromeHeight - panelGap;
  const resolvedChromeHeight = contentHeightBeforeClamp >= minContentHeight
    ? chromeHeight
    : Math.max(32, verticalBudget - minContentHeight - panelGap);
  const contentHeight = Math.max(220, verticalBudget - resolvedChromeHeight - panelGap);

  let nextX = shellInset;
  const pinnedLeft = pinnedLeftWidth > 0
    ? {
        visible: true,
        x: nextX,
        y: shellInset + resolvedChromeHeight + panelGap,
        width: pinnedLeftWidth,
        height: contentHeight,
      }
    : createHiddenRegion();
  if (pinnedLeft.visible) {
    nextX += pinnedLeft.width + panelGap;
  }

  const launcher = launcherWidth > 0
    ? {
        visible: true,
        x: nextX,
        y: shellInset + resolvedChromeHeight + panelGap,
        width: launcherWidth,
        height: contentHeight,
      }
    : createHiddenRegion();
  if (launcher.visible) {
    nextX += launcher.width + panelGap;
  }

  const rightReservedWidth = pinnedRightWidth > 0 ? pinnedRightWidth + panelGap : 0;
  const content = {
    visible: true,
    x: nextX,
    y: shellInset + resolvedChromeHeight + panelGap,
    width: Math.max(280, viewportWidth - shellInset - rightReservedWidth - nextX),
    height: contentHeight,
  };

  const pinnedRight = pinnedRightWidth > 0
    ? {
        visible: true,
        x: content.x + content.width + panelGap,
        y: shellInset + resolvedChromeHeight + panelGap,
        width: pinnedRightWidth,
        height: contentHeight,
      }
    : createHiddenRegion();

  return {
    viewportWidth,
    viewportHeight,
    shellInset,
    panelGap,
    contentInnerPadding,
    regions: {
      chrome: {
        visible: true,
        x: shellInset,
        y: shellInset,
        width: horizontalBudget,
        height: resolvedChromeHeight,
      },
      launcher,
      content,
      pinnedLeft,
      pinnedRight,
    },
  };
}
