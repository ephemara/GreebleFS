export type { MobileShareThemeSnapshot } from "../src/config/mobileTheme";
export type {
  MobileLayoutSettings,
  MobileLayoutSortBy,
  MobileLayoutSortOrder,
  MobileLayoutViewMode,
} from "../src/config/mobileLayout";

export type MobileEntryKind =
  | "directory"
  | "image"
  | "video"
  | "audio"
  | "pdf"
  | "archive"
  | "text"
  | "code"
  | "shader"
  | "model"
  | "font"
  | "document"
  | "file";

export type MobilePreviewKind =
  | "image"
  | "video"
  | "audio"
  | "pdf"
  | "text"
  | "folder"
  | "archive";

export interface MobileShareEntry {
  name: string;
  relativePath: string;
  isDir: boolean;
  isHidden: boolean;
  size: number;
  extension: string;
  mimeType: string | null;
  modifiedMs: number | null;
  entryKind: MobileEntryKind;
  iconId: string;
  thumbnailUrl: string | null;
  previewKind: MobilePreviewKind | null;
  canPreview: boolean;
  canDownload: boolean;
  fileUrl: string | null;
  downloadUrl: string | null;
}

export interface MobileShareListingResponse {
  currentPath: string;
  parentPath: string;
  canGoUp: boolean;
  shareName: string;
  hubMode: boolean;
  totalCount: number;
  offset: number;
  limit: number;
  nextOffset: number | null;
  entries: MobileShareEntry[];
}

export interface MobileSearchResultEntry extends MobileShareEntry {
  parentRelativePath: string;
  score: number;
}

export interface MobileSearchResponse {
  query: string;
  shareName: string;
  scopePath: string;
  totalCount: number;
  entries: MobileSearchResultEntry[];
}

export interface MobileSearchStatusValue {
  isScanInProgress: boolean;
  isCommitting: boolean;
  isParallelScan: boolean;
  lastScanTime: number | null;
  indexedItemCount: number;
  indexSizeBytes: number;
  currentDriveRoot: string | null;
  driveScanErrors: Array<{
    driveRoot: string;
    message: string;
  }>;
  isIndexValid: boolean;
  scannedDrivesCount: number;
  totalDrivesCount: number;
}

export interface MobileSearchStatusResponse {
  shareName: string;
  scopePath: string;
  searchAvailable: boolean;
  message: string | null;
  status: MobileSearchStatusValue | null;
}

export interface MobileDirectoryPreviewSummary {
  folderCount: number;
  fileCount: number;
  totalVisibleFileBytes: number;
  truncated: boolean;
  entries: MobileShareEntry[];
}

export interface MobileArchivePreviewSummary {
  formatLabel: string;
  folderCount: number;
  fileCount: number;
  truncated: boolean;
  entries: MobileShareEntry[];
}

export interface MobilePreviewResponse {
  entry: MobileShareEntry;
  previewKind: MobilePreviewKind | null;
  mediaUrl: string | null;
  posterUrl: string | null;
  openUrl: string | null;
  pageCount: number | null;
  textExcerpt: string | null;
  textTruncated: boolean;
  folderSummary: MobileDirectoryPreviewSummary | null;
  archiveSummary: MobileArchivePreviewSummary | null;
}

export interface MobileUploadResponse {
  uploaded: number;
}

export interface MobilePluginCatalogResponse {
  pluginRoot: string;
  refreshedAtMs: number;
  plugins: MobilePluginSummary[];
  panes: MobilePluginPane[];
  warnings: string[];
}

export interface MobilePluginSummary {
  id: string;
  manifestId: string;
  directoryName: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  capabilities: MobilePluginCapabilitySummary;
  rootAccess: MobilePluginRootAccess;
}

export interface MobilePluginCapabilitySummary {
  mobilePanes: number;
  backendActions: number;
  themes: number;
  shaders: number;
  fonts: number;
  commands: number;
  previewLanes: number;
  settingsSlots: number;
  contextMenuItems: number;
}

export interface MobilePluginRootAccess {
  sameRootAsDesktopPlugins: boolean;
  usrRelativeRoot: string;
  pluginDirectoryName: string;
  backendDirectoryName: string;
  canRunBackend: boolean;
  backendRoute: string;
  assetRoutePrefix: string;
}

export interface MobilePluginPane {
  id: string;
  localId: string;
  pluginId: string;
  manifestId: string;
  pluginName: string;
  title: string;
  description: string;
  iconName: string;
  iconId: string;
  order: number;
  category: string;
  kind: "dashboard" | "tool" | "inspector" | "viewer" | string;
  theme: MobilePluginPaneTheme;
  sections: MobilePluginPaneSection[];
  actions: MobilePluginPaneAction[];
}

export interface MobilePluginPaneTheme {
  accent: string;
  cssVars: Record<string, string>;
}

export interface MobilePluginPaneSection {
  id: string;
  title: string;
  body: string;
  assetPath: string;
  assetUrl: string;
}

export interface MobilePluginPaneAction {
  id: string;
  label: string;
  description: string;
  iconName: string;
  tone: "neutral" | "accent" | "danger" | "success" | "warning" | string;
  kind: "backend" | "link" | "copy" | string;
  href: string;
  copyText: string;
  backend: MobilePluginPaneBackendAction | null;
}

export interface MobilePluginPaneBackendAction {
  entry: string;
  args: string[];
  successMessage: string;
}

export interface MobilePluginBackendRunRequest {
  entry: string;
  args?: string[];
  contextPath?: string;
  paneId?: string;
  actionId?: string;
}

export interface MobilePluginBackendRunResponse {
  pluginId: string;
  entry: string;
  contextPath: string;
  contextAbsolutePath: string;
  paneId: string;
  actionId: string;
  stdout: string;
  stderr: string;
  status: number;
}
