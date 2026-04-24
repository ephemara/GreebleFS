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
