export type ExplorerChromeSurfaceId =
  | 'explorerTopbar'
  | 'explorerToolbar'
  | 'workspaceHeader'
  | 'railHeader'
  | 'previewHeader'
  | 'explorerStatusBar';

export type ExplorerChromeZoneId =
  | 'start'
  | 'center'
  | 'end'
  | 'primaryStart'
  | 'primaryCenter'
  | 'primaryEnd'
  | 'secondaryStart'
  | 'secondaryEnd';

export type BuiltInExplorerChromeLayoutId = 'default' | 'focused-search';
export type ExplorerChromeLayoutId = BuiltInExplorerChromeLayoutId | (string & {});

export type BuiltInExplorerChromeControlId =
  | 'navigateBack'
  | 'navigateForward'
  | 'navigateUp'
  | 'addressBar'
  | 'recentLocations'
  | 'pinnedLocations'
  | 'folderSizeSummary'
  | 'selectionSizeSummary'
  | 'pinLocation'
  | 'toggleSearchContent'
  | 'semanticIndexBuild'
  | 'semanticIndexRebuild'
  | 'semanticIndexClear'
  | 'saveSearch'
  | 'batchRename'
  | 'openPropertiesPanel'
  | 'tagSelection'
  | 'duplicateScan'
  | 'undoTrash'
  | 'toggleSources'
  | 'focusAddressBar'
  | 'experimentalModes'
  | 'shellLayout'
  | 'viewLayout'
  | 'togglePreview'
  | 'toggleHiddenFiles'
  | 'refresh'
  | 'customizeHome'
  | 'refreshHome'
  | 'openUserHome'
  | 'newFolder'
  | 'newFile'
  | 'pasteClipboard'
  | 'workspacePaneCounts'
  | 'workspaceMode'
  | 'workspaceCommanderSummary'
  | 'workspaceLayoutHint'
  | 'workspaceTabs'
  | 'workspaceNewTab'
  | 'workspacePaneActionsMenu'
  | 'workspaceDuplicateTab'
  | 'workspaceFocusLeft'
  | 'workspaceFocusRight'
  | 'workspaceMoveTab'
  | 'workspaceSyncPath'
  | 'workspaceLinkNavigation'
  | 'workspaceCopyToPane'
  | 'workspaceMoveToPane'
  | 'workspaceSwapPane'
  | 'workspaceSplitToggle'
  | 'workspaceCloseTab'
  | 'workspaceSplitSummary'
  | 'workspaceSplitNudgeLeft'
  | 'workspaceSplitReset'
  | 'workspaceSplitNudgeRight'
  | 'railIdentity'
  | 'railBookmarkSummary'
  | 'railClose'
  | 'railManageToggle'
  | 'previewIdentity'
  | 'previewState'
  | 'previewModeToggle'
  | 'previewSplitToggle'
  | 'previewLockToggle'
  | 'previewCopyPath'
  | 'previewTerminalToggle'
  | 'previewClose'
  | 'statusItemCount'
  | 'statusSelectionSummary'
  | 'statusModeProfile'
  | 'statusViewSummary'
  | 'statusPreviewSummary'
  | 'statusLabsSummary'
  | 'statusSearchSummary'
  | 'statusTaskBadge'
  | 'statusClipboardQueue'
  | 'statusPreviewLoading'
  | 'statusViewToggles';

export type ExplorerChromeControlId = BuiltInExplorerChromeControlId | `plugin:${string}`;

export interface ExplorerChromeControlDefinition {
  id: ExplorerChromeControlId;
  label: string;
  surfaces: ExplorerChromeSurfaceId[];
}

export interface ExplorerChromeSlotDefinition {
  zone: ExplorerChromeZoneId;
  order: number;
  grow?: number;
  shrink?: number;
  collapsePriority?: number;
  overflowEligible?: boolean;
}

export interface ExplorerChromeLayoutDefinition {
  id: ExplorerChromeLayoutId;
  label: string;
  placements: Partial<Record<ExplorerChromeControlId, Partial<Record<ExplorerChromeSurfaceId, ExplorerChromeSlotDefinition>>>>;
}

export interface ExplorerChromeOverrideEntry {
  controlId: ExplorerChromeControlId;
  surfaceId: ExplorerChromeSurfaceId;
  zone: ExplorerChromeZoneId;
  order: number;
}

export interface ExplorerChromeOverrideSnapshot {
  entries: ExplorerChromeOverrideEntry[];
}

export interface ExplorerChromeResolvedControlPlacement extends ExplorerChromeSlotDefinition {
  controlId: ExplorerChromeControlId;
  surfaceId: ExplorerChromeSurfaceId;
}

export interface ExplorerChromeResolvedZone {
  id: ExplorerChromeZoneId;
  controls: ExplorerChromeResolvedControlPlacement[];
}

export interface ExplorerChromeResolvedRow {
  id: string;
  zones: ExplorerChromeResolvedZone[];
}

export interface ExplorerChromeResolvedSurface {
  surfaceId: ExplorerChromeSurfaceId;
  rows: ExplorerChromeResolvedRow[];
  visibleControlIds: ExplorerChromeControlId[];
}

interface ExplorerChromeSurfaceDefinition {
  id: ExplorerChromeSurfaceId;
  rows: Array<{
    id: string;
    zones: ExplorerChromeZoneId[];
  }>;
}

const explorerChromeSurfaceDefinitions: Record<ExplorerChromeSurfaceId, ExplorerChromeSurfaceDefinition> = {
  explorerTopbar: {
    id: 'explorerTopbar',
    rows: [
      {
        id: 'primary',
        zones: ['start', 'center', 'end'],
      },
    ],
  },
  explorerToolbar: {
    id: 'explorerToolbar',
    rows: [
      {
        id: 'primary',
        zones: ['primaryStart', 'primaryCenter', 'primaryEnd'],
      },
      {
        id: 'secondary',
        zones: ['secondaryStart', 'secondaryEnd'],
      },
    ],
  },
  workspaceHeader: {
    id: 'workspaceHeader',
    rows: [
      {
        id: 'primary',
        zones: ['start', 'center', 'end'],
      },
    ],
  },
  railHeader: {
    id: 'railHeader',
    rows: [
      {
        id: 'primary',
        zones: ['start', 'center', 'end'],
      },
    ],
  },
  previewHeader: {
    id: 'previewHeader',
    rows: [
      {
        id: 'primary',
        zones: ['start', 'center', 'end'],
      },
    ],
  },
  explorerStatusBar: {
    id: 'explorerStatusBar',
    rows: [
      {
        id: 'primary',
        zones: ['start', 'center', 'end'],
      },
    ],
  },
};

const builtInExplorerChromeLayouts: Record<BuiltInExplorerChromeLayoutId, ExplorerChromeLayoutDefinition> = {
  default: {
    id: 'default',
    label: 'Default',
    placements: {
      navigateBack: {
        explorerToolbar: { zone: 'primaryStart', order: 10 },
      },
      navigateForward: {
        explorerToolbar: { zone: 'primaryStart', order: 20 },
      },
      navigateUp: {
        explorerToolbar: { zone: 'primaryStart', order: 30 },
      },
      addressBar: {
        explorerToolbar: { zone: 'primaryCenter', order: 10, grow: 1, shrink: 1 },
      },
      recentLocations: {
        explorerToolbar: { zone: 'secondaryStart', order: 10, shrink: 1, collapsePriority: 20, overflowEligible: true },
      },
      pinnedLocations: {
        explorerToolbar: { zone: 'secondaryStart', order: 20, shrink: 1, collapsePriority: 20, overflowEligible: true },
      },
      folderSizeSummary: {
        explorerToolbar: { zone: 'secondaryStart', order: 30, shrink: 1, collapsePriority: 40, overflowEligible: true },
      },
      selectionSizeSummary: {
        explorerToolbar: { zone: 'secondaryStart', order: 40, shrink: 1, collapsePriority: 50, overflowEligible: true },
      },
      pinLocation: {
        explorerToolbar: { zone: 'secondaryEnd', order: 10 },
      },
      toggleSearchContent: {
        explorerToolbar: { zone: 'secondaryEnd', order: 20 },
      },
      semanticIndexBuild: {
        explorerToolbar: { zone: 'secondaryEnd', order: 25 },
      },
      semanticIndexRebuild: {
        explorerToolbar: { zone: 'secondaryEnd', order: 27 },
      },
      semanticIndexClear: {
        explorerToolbar: { zone: 'secondaryEnd', order: 29 },
      },
      saveSearch: {
        explorerToolbar: { zone: 'secondaryEnd', order: 30 },
      },
      batchRename: {
        explorerToolbar: { zone: 'secondaryEnd', order: 40 },
      },
      tagSelection: {
        explorerToolbar: { zone: 'secondaryEnd', order: 50 },
      },
      duplicateScan: {
        explorerToolbar: { zone: 'secondaryEnd', order: 60 },
      },
      undoTrash: {
        explorerToolbar: { zone: 'secondaryEnd', order: 70 },
      },
      toggleSources: {
        explorerToolbar: { zone: 'primaryStart', order: 5 },
        explorerTopbar: { zone: 'start', order: 5 },
      },
      focusAddressBar: {
        explorerToolbar: { zone: 'primaryEnd', order: 20 },
        explorerTopbar: { zone: 'start', order: 20 },
      },
      experimentalModes: {
        explorerToolbar: { zone: 'primaryEnd', order: 30 },
        explorerTopbar: { zone: 'end', order: 10 },
      },
      shellLayout: {
        explorerToolbar: { zone: 'primaryEnd', order: 40 },
        explorerTopbar: { zone: 'end', order: 20 },
      },
      viewLayout: {
        explorerToolbar: { zone: 'primaryEnd', order: 50 },
        explorerTopbar: { zone: 'end', order: 30 },
      },
      togglePreview: {
        explorerToolbar: { zone: 'primaryEnd', order: 60 },
        explorerTopbar: { zone: 'end', order: 40 },
      },
      toggleHiddenFiles: {
        explorerToolbar: { zone: 'primaryEnd', order: 70 },
      },
      refresh: {
        explorerToolbar: { zone: 'primaryEnd', order: 80 },
      },
      customizeHome: {
        explorerToolbar: { zone: 'secondaryEnd', order: 5 },
      },
      refreshHome: {
        explorerToolbar: { zone: 'secondaryEnd', order: 6 },
      },
      openUserHome: {
        explorerToolbar: { zone: 'secondaryEnd', order: 7 },
      },
      newFolder: {
        explorerToolbar: { zone: 'secondaryEnd', order: 80 },
      },
      newFile: {
        explorerToolbar: { zone: 'secondaryEnd', order: 90 },
      },
      pasteClipboard: {
        explorerToolbar: { zone: 'secondaryEnd', order: 100 },
      },
      workspacePaneCounts: {
        workspaceHeader: { zone: 'start', order: 10 },
      },
      workspaceMode: {
        workspaceHeader: { zone: 'start', order: 20 },
      },
      workspaceCommanderSummary: {
        workspaceHeader: { zone: 'start', order: 30, shrink: 1, collapsePriority: 20, overflowEligible: true },
      },
      workspaceLayoutHint: {
        workspaceHeader: { zone: 'start', order: 40, shrink: 1, collapsePriority: 40, overflowEligible: true },
      },
      workspaceTabs: {
        workspaceHeader: { zone: 'center', order: 10, grow: 1, shrink: 1 },
      },
      workspaceNewTab: {
        workspaceHeader: { zone: 'end', order: 10 },
      },
      workspacePaneActionsMenu: {
        workspaceHeader: { zone: 'end', order: 20 },
      },
      workspaceDuplicateTab: {
        workspaceHeader: { zone: 'end', order: 30 },
      },
      workspaceFocusLeft: {
        workspaceHeader: { zone: 'end', order: 40 },
      },
      workspaceFocusRight: {
        workspaceHeader: { zone: 'end', order: 50 },
      },
      workspaceMoveTab: {
        workspaceHeader: { zone: 'end', order: 60 },
      },
      workspaceSyncPath: {
        workspaceHeader: { zone: 'end', order: 65 },
      },
      workspaceLinkNavigation: {
        workspaceHeader: { zone: 'end', order: 66 },
      },
      workspaceCopyToPane: {
        workspaceHeader: { zone: 'end', order: 67 },
      },
      workspaceMoveToPane: {
        workspaceHeader: { zone: 'end', order: 68 },
      },
      workspaceSwapPane: {
        workspaceHeader: { zone: 'end', order: 70 },
      },
      workspaceSplitToggle: {
        workspaceHeader: { zone: 'end', order: 80 },
      },
      workspaceCloseTab: {
        workspaceHeader: { zone: 'end', order: 90 },
      },
      workspaceSplitSummary: {
        workspaceHeader: { zone: 'end', order: 100, collapsePriority: 30, overflowEligible: true },
      },
      workspaceSplitNudgeLeft: {
        workspaceHeader: { zone: 'end', order: 110 },
      },
      workspaceSplitReset: {
        workspaceHeader: { zone: 'end', order: 120 },
      },
      workspaceSplitNudgeRight: {
        workspaceHeader: { zone: 'end', order: 130 },
      },
      railIdentity: {
        railHeader: { zone: 'start', order: 10, grow: 1, shrink: 1 },
      },
      railBookmarkSummary: {
        railHeader: { zone: 'center', order: 10, shrink: 1, collapsePriority: 30, overflowEligible: true },
      },
      railClose: {
        railHeader: { zone: 'end', order: 10 },
      },
      railManageToggle: {
        railHeader: { zone: 'end', order: 20 },
      },
      previewIdentity: {
        previewHeader: { zone: 'start', order: 10, grow: 1, shrink: 1 },
      },
      previewState: {
        previewHeader: { zone: 'center', order: 10, shrink: 1, collapsePriority: 20, overflowEligible: true },
      },
      previewModeToggle: {
        previewHeader: { zone: 'end', order: 10 },
      },
      previewSplitToggle: {
        previewHeader: { zone: 'end', order: 20 },
      },
      previewLockToggle: {
        previewHeader: { zone: 'end', order: 25 },
      },
      previewCopyPath: {
        previewHeader: { zone: 'end', order: 30 },
      },
      previewTerminalToggle: {
        previewHeader: { zone: 'end', order: 35 },
      },
      previewClose: {
        previewHeader: { zone: 'end', order: 40 },
      },
      statusItemCount: {
        explorerStatusBar: { zone: 'start', order: 10 },
      },
      statusSelectionSummary: {
        explorerStatusBar: { zone: 'start', order: 20 },
      },
      statusModeProfile: {
        explorerStatusBar: { zone: 'start', order: 30 },
      },
      statusViewSummary: {
        explorerStatusBar: { zone: 'start', order: 40, shrink: 1, collapsePriority: 20, overflowEligible: true },
      },
      statusViewToggles: {
        explorerStatusBar: { zone: 'end', order: 20 },
      },
      statusPreviewSummary: {
        explorerStatusBar: { zone: 'center', order: 10, shrink: 1, collapsePriority: 30, overflowEligible: true },
      },
      statusLabsSummary: {
        explorerStatusBar: { zone: 'center', order: 20, shrink: 1, collapsePriority: 40, overflowEligible: true },
      },
      statusSearchSummary: {
        explorerStatusBar: { zone: 'center', order: 30, grow: 1, shrink: 1, collapsePriority: 10, overflowEligible: true },
      },
      statusTaskBadge: {
        explorerStatusBar: { zone: 'end', order: 10 },
      },
      statusClipboardQueue: {
        explorerStatusBar: { zone: 'center', order: 40, shrink: 1, collapsePriority: 10, overflowEligible: true },
      },
      statusPreviewLoading: {
        explorerStatusBar: { zone: 'center', order: 50 },
      },
    },
  },
  'focused-search': {
    id: 'focused-search',
    label: 'Focused Search',
    placements: {
      navigateBack: {
        explorerToolbar: { zone: 'primaryStart', order: 10 },
      },
      navigateForward: {
        explorerToolbar: { zone: 'primaryStart', order: 20 },
      },
      navigateUp: {
        explorerToolbar: { zone: 'primaryStart', order: 30 },
      },
      addressBar: {
        explorerToolbar: { zone: 'primaryCenter', order: 10, grow: 2, shrink: 1 },
      },
      recentLocations: {
        explorerToolbar: { zone: 'primaryEnd', order: 10, shrink: 1, collapsePriority: 20, overflowEligible: true },
      },
      pinnedLocations: {
        explorerToolbar: { zone: 'primaryEnd', order: 20, shrink: 1, collapsePriority: 20, overflowEligible: true },
      },
      folderSizeSummary: {
        explorerToolbar: { zone: 'secondaryStart', order: 10, shrink: 1, collapsePriority: 40, overflowEligible: true },
      },
      selectionSizeSummary: {
        explorerToolbar: { zone: 'secondaryStart', order: 20, shrink: 1, collapsePriority: 50, overflowEligible: true },
      },
      pinLocation: {
        explorerToolbar: { zone: 'primaryEnd', order: 30 },
      },
      toggleSearchContent: {
        explorerToolbar: { zone: 'primaryEnd', order: 40 },
      },
      semanticIndexBuild: {
        explorerToolbar: { zone: 'primaryEnd', order: 45 },
      },
      semanticIndexRebuild: {
        explorerToolbar: { zone: 'secondaryEnd', order: 5 },
      },
      semanticIndexClear: {
        explorerToolbar: { zone: 'secondaryEnd', order: 8 },
      },
      saveSearch: {
        explorerToolbar: { zone: 'secondaryEnd', order: 10 },
      },
      batchRename: {
        explorerToolbar: { zone: 'secondaryEnd', order: 20 },
      },
      tagSelection: {
        explorerToolbar: { zone: 'secondaryEnd', order: 30 },
      },
      duplicateScan: {
        explorerToolbar: { zone: 'secondaryEnd', order: 40 },
      },
      undoTrash: {
        explorerToolbar: { zone: 'secondaryEnd', order: 50 },
      },
      toggleSources: {
        explorerToolbar: { zone: 'primaryStart', order: 5 },
        explorerTopbar: { zone: 'start', order: 5 },
      },
      focusAddressBar: {
        explorerToolbar: { zone: 'secondaryStart', order: 40 },
        explorerTopbar: { zone: 'start', order: 20 },
      },
      experimentalModes: {
        explorerToolbar: { zone: 'secondaryEnd', order: 60 },
        explorerTopbar: { zone: 'end', order: 10 },
      },
      shellLayout: {
        explorerToolbar: { zone: 'secondaryEnd', order: 70 },
        explorerTopbar: { zone: 'end', order: 20 },
      },
      viewLayout: {
        explorerToolbar: { zone: 'secondaryEnd', order: 80 },
        explorerTopbar: { zone: 'end', order: 30 },
      },
      togglePreview: {
        explorerToolbar: { zone: 'secondaryEnd', order: 90 },
        explorerTopbar: { zone: 'end', order: 40 },
      },
      toggleHiddenFiles: {
        explorerToolbar: { zone: 'primaryEnd', order: 50 },
      },
      refresh: {
        explorerToolbar: { zone: 'primaryEnd', order: 60 },
      },
      customizeHome: {
        explorerToolbar: { zone: 'secondaryEnd', order: 6 },
      },
      refreshHome: {
        explorerToolbar: { zone: 'secondaryEnd', order: 7 },
      },
      openUserHome: {
        explorerToolbar: { zone: 'secondaryEnd', order: 8 },
      },
      newFolder: {
        explorerToolbar: { zone: 'secondaryEnd', order: 100 },
      },
      newFile: {
        explorerToolbar: { zone: 'secondaryEnd', order: 110 },
      },
      pasteClipboard: {
        explorerToolbar: { zone: 'secondaryEnd', order: 120 },
      },
      workspacePaneCounts: {
        workspaceHeader: { zone: 'start', order: 10 },
      },
      workspaceMode: {
        workspaceHeader: { zone: 'end', order: 10 },
      },
      workspaceCommanderSummary: {
        workspaceHeader: { zone: 'end', order: 15, shrink: 1, collapsePriority: 20, overflowEligible: true },
      },
      workspaceLayoutHint: {
        workspaceHeader: { zone: 'end', order: 20, shrink: 1, collapsePriority: 40, overflowEligible: true },
      },
      workspaceTabs: {
        workspaceHeader: { zone: 'center', order: 10, grow: 1, shrink: 1 },
      },
      workspaceNewTab: {
        workspaceHeader: { zone: 'start', order: 20 },
      },
      workspacePaneActionsMenu: {
        workspaceHeader: { zone: 'end', order: 20 },
      },
      workspaceDuplicateTab: {
        workspaceHeader: { zone: 'start', order: 30 },
      },
      workspaceFocusLeft: {
        workspaceHeader: { zone: 'end', order: 30 },
      },
      workspaceFocusRight: {
        workspaceHeader: { zone: 'end', order: 40 },
      },
      workspaceMoveTab: {
        workspaceHeader: { zone: 'end', order: 50 },
      },
      workspaceSyncPath: {
        workspaceHeader: { zone: 'end', order: 55 },
      },
      workspaceLinkNavigation: {
        workspaceHeader: { zone: 'end', order: 56 },
      },
      workspaceCopyToPane: {
        workspaceHeader: { zone: 'end', order: 57 },
      },
      workspaceMoveToPane: {
        workspaceHeader: { zone: 'end', order: 58 },
      },
      workspaceSwapPane: {
        workspaceHeader: { zone: 'end', order: 60 },
      },
      workspaceSplitToggle: {
        workspaceHeader: { zone: 'end', order: 70 },
      },
      workspaceCloseTab: {
        workspaceHeader: { zone: 'end', order: 80 },
      },
      workspaceSplitSummary: {
        workspaceHeader: { zone: 'start', order: 40, collapsePriority: 30, overflowEligible: true },
      },
      workspaceSplitNudgeLeft: {
        workspaceHeader: { zone: 'end', order: 90 },
      },
      workspaceSplitReset: {
        workspaceHeader: { zone: 'end', order: 100 },
      },
      workspaceSplitNudgeRight: {
        workspaceHeader: { zone: 'end', order: 110 },
      },
      railIdentity: {
        railHeader: { zone: 'start', order: 10, grow: 1, shrink: 1 },
      },
      railBookmarkSummary: {
        railHeader: { zone: 'end', order: 10, shrink: 1, collapsePriority: 20, overflowEligible: true },
      },
      railClose: {
        railHeader: { zone: 'end', order: 10 },
      },
      railManageToggle: {
        railHeader: { zone: 'end', order: 20 },
      },
      previewIdentity: {
        previewHeader: { zone: 'start', order: 10, grow: 1, shrink: 1 },
      },
      previewState: {
        previewHeader: { zone: 'end', order: 10, shrink: 1, collapsePriority: 20, overflowEligible: true },
      },
      previewModeToggle: {
        previewHeader: { zone: 'end', order: 20 },
      },
      previewSplitToggle: {
        previewHeader: { zone: 'end', order: 30 },
      },
      previewLockToggle: {
        previewHeader: { zone: 'end', order: 35 },
      },
      previewCopyPath: {
        previewHeader: { zone: 'end', order: 40 },
      },
      previewTerminalToggle: {
        previewHeader: { zone: 'end', order: 45 },
      },
      previewClose: {
        previewHeader: { zone: 'end', order: 50 },
      },
      statusItemCount: {
        explorerStatusBar: { zone: 'start', order: 10 },
      },
      statusSelectionSummary: {
        explorerStatusBar: { zone: 'start', order: 20 },
      },
      statusModeProfile: {
        explorerStatusBar: { zone: 'start', order: 30 },
      },
      statusViewSummary: {
        explorerStatusBar: { zone: 'center', order: 10, shrink: 1, collapsePriority: 20, overflowEligible: true },
      },
      statusViewToggles: {
        explorerStatusBar: { zone: 'end', order: 20 },
      },
      statusPreviewSummary: {
        explorerStatusBar: { zone: 'center', order: 20, shrink: 1, collapsePriority: 30, overflowEligible: true },
      },
      statusLabsSummary: {
        explorerStatusBar: { zone: 'center', order: 30, shrink: 1, collapsePriority: 40, overflowEligible: true },
      },
      statusSearchSummary: {
        explorerStatusBar: { zone: 'center', order: 40, grow: 1, shrink: 1, collapsePriority: 10, overflowEligible: true },
      },
      statusTaskBadge: {
        explorerStatusBar: { zone: 'end', order: 10 },
      },
      statusClipboardQueue: {
        explorerStatusBar: { zone: 'center', order: 50, shrink: 1, collapsePriority: 10, overflowEligible: true },
      },
      statusPreviewLoading: {
        explorerStatusBar: { zone: 'center', order: 60 },
      },
    },
  },
};

const explorerChromeZoneSurfaceMap = Object.values(explorerChromeSurfaceDefinitions).reduce(
  (map, surface) => {
    for (const row of surface.rows) {
      for (const zone of row.zones) {
        const currentSurfaceIds = map.get(zone) ?? [];
        if (!currentSurfaceIds.includes(surface.id)) {
          currentSurfaceIds.push(surface.id);
        }
        map.set(zone, currentSurfaceIds);
      }
    }
    return map;
  },
  new Map<ExplorerChromeZoneId, ExplorerChromeSurfaceId[]>(),
);

export const defaultExplorerChromeLayoutId: BuiltInExplorerChromeLayoutId = 'default';

function isExplorerChromeSurfaceId(value: unknown): value is ExplorerChromeSurfaceId {
  return value === 'explorerTopbar'
    || value === 'explorerToolbar'
    || value === 'workspaceHeader'
    || value === 'railHeader'
    || value === 'previewHeader'
    || value === 'explorerStatusBar';
}

function isExplorerChromeZoneId(value: unknown): value is ExplorerChromeZoneId {
  return typeof value === 'string' && explorerChromeZoneSurfaceMap.has(value as ExplorerChromeZoneId);
}

function isValidZoneForSurface(surfaceId: ExplorerChromeSurfaceId, zone: ExplorerChromeZoneId): boolean {
  return explorerChromeZoneSurfaceMap.get(zone)?.includes(surfaceId) ?? false;
}

function asFiniteInteger(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.round(value)
    : null;
}

function asTrimmedString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : null;
}

export function normalizeExplorerChromeLayoutId(value: unknown): ExplorerChromeLayoutId {
  const trimmed = asTrimmedString(value);
  return trimmed ?? defaultExplorerChromeLayoutId;
}

export function getExplorerChromeSurfaceDefinition(
  surfaceId: ExplorerChromeSurfaceId,
): ExplorerChromeSurfaceDefinition {
  return explorerChromeSurfaceDefinitions[surfaceId];
}

export function getExplorerChromeLayoutDefinition(
  layoutId?: ExplorerChromeLayoutId | null,
): ExplorerChromeLayoutDefinition {
  const normalizedId = normalizeExplorerChromeLayoutId(layoutId);
  return builtInExplorerChromeLayouts[normalizedId as BuiltInExplorerChromeLayoutId]
    ?? builtInExplorerChromeLayouts[defaultExplorerChromeLayoutId];
}

export function normalizeExplorerChromeOverrideSnapshot(
  value: unknown,
): ExplorerChromeOverrideSnapshot {
  const entries = Array.isArray((value as ExplorerChromeOverrideSnapshot | undefined)?.entries)
    ? (value as ExplorerChromeOverrideSnapshot).entries
    : [];
  const normalizedEntries = new Map<ExplorerChromeControlId, ExplorerChromeOverrideEntry>();

  for (const entry of entries) {
    const controlId = asTrimmedString(entry?.controlId) as ExplorerChromeControlId | null;
    const surfaceId = entry?.surfaceId;
    const zone = entry?.zone;
    const order = asFiniteInteger(entry?.order);

    if (
      !controlId
      || !isExplorerChromeSurfaceId(surfaceId)
      || !isExplorerChromeZoneId(zone)
      || order == null
      || !isValidZoneForSurface(surfaceId, zone)
    ) {
      continue;
    }

    normalizedEntries.set(controlId, {
      controlId,
      surfaceId,
      zone,
      order,
    });
  }

  return {
    entries: Array.from(normalizedEntries.values()),
  };
}

export function normalizeExplorerChromeOverrideSnapshotMap(
  value: unknown,
): Record<string, Record<string, ExplorerChromeOverrideSnapshot>> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([themeId, themeOverrides]) => {
      const trimmedThemeId = themeId.trim();
      if (!trimmedThemeId || !themeOverrides || typeof themeOverrides !== 'object' || Array.isArray(themeOverrides)) {
        return [trimmedThemeId, {}] as const;
      }

      const normalizedThemeOverrides = Object.fromEntries(
        Object.entries(themeOverrides as Record<string, unknown>)
          .map(([layoutId, snapshot]) => {
            const trimmedLayoutId = layoutId.trim();
            if (!trimmedLayoutId) {
              return null;
            }

            return [
              trimmedLayoutId,
              normalizeExplorerChromeOverrideSnapshot(snapshot),
            ] as const;
          })
          .filter((entry): entry is readonly [string, ExplorerChromeOverrideSnapshot] => entry != null),
      );

      return [trimmedThemeId, normalizedThemeOverrides] as const;
    }).filter((entry): entry is readonly [string, Record<string, ExplorerChromeOverrideSnapshot>] => Boolean(entry[0])),
  );
}

function getOverridePlacementMap(
  override?: ExplorerChromeOverrideSnapshot | null,
): Map<ExplorerChromeControlId, ExplorerChromeOverrideEntry> {
  const normalized = normalizeExplorerChromeOverrideSnapshot(override);
  return new Map(normalized.entries.map((entry) => [entry.controlId, entry]));
}

function getBasePlacement(
  layout: ExplorerChromeLayoutDefinition,
  controlId: ExplorerChromeControlId,
  surfaceId: ExplorerChromeSurfaceId,
): ExplorerChromeResolvedControlPlacement | null {
  const placement = layout.placements[controlId]?.[surfaceId];
  if (!placement) {
    return null;
  }

  return {
    controlId,
    surfaceId,
    ...placement,
  };
}

function getOverridePlacement(
  overridePlacementMap: Map<ExplorerChromeControlId, ExplorerChromeOverrideEntry>,
  controlId: ExplorerChromeControlId,
  surfaceId: ExplorerChromeSurfaceId,
  basePlacement: ExplorerChromeResolvedControlPlacement | null,
): ExplorerChromeResolvedControlPlacement | null {
  const overridePlacement = overridePlacementMap.get(controlId);
  if (!overridePlacement) {
    return basePlacement;
  }

  if (overridePlacement.surfaceId !== surfaceId) {
    return basePlacement?.surfaceId === surfaceId
      ? null
      : null;
  }

  return {
    controlId,
    surfaceId,
    zone: overridePlacement.zone,
    order: overridePlacement.order,
    grow: basePlacement?.grow,
    shrink: basePlacement?.shrink,
    collapsePriority: basePlacement?.collapsePriority,
    overflowEligible: basePlacement?.overflowEligible,
  };
}

function collectResolvedSurfacePlacements(
  surface: ExplorerChromeResolvedSurface,
): ExplorerChromeResolvedControlPlacement[] {
  return surface.rows.flatMap((row) => row.zones.flatMap((zone) => zone.controls));
}

export function createExplorerChromeOverrideSnapshotFromResolvedSurfaces(
  surfaces: ExplorerChromeResolvedSurface[],
): ExplorerChromeOverrideSnapshot {
  return normalizeExplorerChromeOverrideSnapshot({
    entries: surfaces
      .flatMap((surface) => collectResolvedSurfacePlacements(surface))
      .map((placement) => ({
        controlId: placement.controlId,
        surfaceId: placement.surfaceId,
        zone: placement.zone,
        order: placement.order,
      })),
  });
}

export function moveExplorerChromeControlInResolvedSurfaces(input: {
  surfaces: ExplorerChromeResolvedSurface[];
  controlId: ExplorerChromeControlId;
  targetSurfaceId: ExplorerChromeSurfaceId;
  targetZoneId: ExplorerChromeZoneId;
  targetIndex: number;
}): ExplorerChromeOverrideSnapshot {
  const normalizedTargetIndex = Math.max(0, Math.trunc(input.targetIndex));
  const placementsBySurfaceAndZone = new Map<string, ExplorerChromeResolvedControlPlacement[]>();
  let movingPlacement: ExplorerChromeResolvedControlPlacement | null = null;

  for (const surface of input.surfaces) {
    for (const row of surface.rows) {
      for (const zone of row.zones) {
        const nextControls = zone.controls
          .filter((placement) => {
            if (placement.controlId !== input.controlId) {
              return true;
            }
            movingPlacement = placement;
            return false;
          })
          .map((placement) => ({ ...placement }));
        placementsBySurfaceAndZone.set(`${surface.surfaceId}:${zone.id}`, nextControls);
      }
    }
  }

  const targetKey = `${input.targetSurfaceId}:${input.targetZoneId}`;
  const targetControls = placementsBySurfaceAndZone.get(targetKey);
  if (!targetControls || !isValidZoneForSurface(input.targetSurfaceId, input.targetZoneId)) {
    return createExplorerChromeOverrideSnapshotFromResolvedSurfaces(input.surfaces);
  }

  const fallbackPlacement = movingPlacement ?? {
    controlId: input.controlId,
    surfaceId: input.targetSurfaceId,
    zone: input.targetZoneId,
    order: 10,
  };
  const nextPlacement: ExplorerChromeResolvedControlPlacement = {
    ...fallbackPlacement,
    surfaceId: input.targetSurfaceId,
    zone: input.targetZoneId,
  };
  const insertionIndex = Math.min(normalizedTargetIndex, targetControls.length);
  targetControls.splice(insertionIndex, 0, nextPlacement);
  placementsBySurfaceAndZone.set(targetKey, targetControls);

  return normalizeExplorerChromeOverrideSnapshot({
    entries: input.surfaces.flatMap((surface) => surface.rows.flatMap((row) => row.zones.flatMap((zone) => {
      const controls = placementsBySurfaceAndZone.get(`${surface.surfaceId}:${zone.id}`) ?? [];
      return controls.map((placement, index) => ({
        controlId: placement.controlId,
        surfaceId: surface.surfaceId,
        zone: zone.id,
        order: (index + 1) * 10,
      }));
    }))),
  });
}

export function resolveExplorerChromeSurfaceLayout(input: {
  layoutId?: ExplorerChromeLayoutId | null;
  surfaceId: ExplorerChromeSurfaceId;
  controlDefinitions: ExplorerChromeControlDefinition[];
  override?: ExplorerChromeOverrideSnapshot | null;
  isControlVisible?: (controlId: ExplorerChromeControlId, surfaceId: ExplorerChromeSurfaceId) => boolean;
}): ExplorerChromeResolvedSurface {
  const surfaceDefinition = getExplorerChromeSurfaceDefinition(input.surfaceId);
  const layout = getExplorerChromeLayoutDefinition(input.layoutId);
  const overridePlacementMap = getOverridePlacementMap(input.override);
  const resolvedPlacements: ExplorerChromeResolvedControlPlacement[] = [];

  for (const control of input.controlDefinitions) {
    if (!control.surfaces.includes(input.surfaceId)) {
      continue;
    }
    if (input.isControlVisible && !input.isControlVisible(control.id, input.surfaceId)) {
      continue;
    }

    const basePlacement = getBasePlacement(layout, control.id, input.surfaceId);
    const resolvedPlacement = getOverridePlacement(
      overridePlacementMap,
      control.id,
      input.surfaceId,
      basePlacement,
    );

    if (!resolvedPlacement || !isValidZoneForSurface(input.surfaceId, resolvedPlacement.zone)) {
      continue;
    }

    resolvedPlacements.push(resolvedPlacement);
  }

  resolvedPlacements.sort((left, right) => {
    if (left.order !== right.order) {
      return left.order - right.order;
    }
    return left.controlId.localeCompare(right.controlId);
  });

  const placementsByZone = new Map<ExplorerChromeZoneId, ExplorerChromeResolvedControlPlacement[]>();
  for (const placement of resolvedPlacements) {
    const current = placementsByZone.get(placement.zone) ?? [];
    current.push(placement);
    placementsByZone.set(placement.zone, current);
  }

  return {
    surfaceId: input.surfaceId,
    rows: surfaceDefinition.rows.map((row) => ({
      id: row.id,
      zones: row.zones.map((zone) => ({
        id: zone,
        controls: placementsByZone.get(zone) ?? [],
      })),
    })),
    visibleControlIds: resolvedPlacements.map((placement) => placement.controlId),
  };
}
