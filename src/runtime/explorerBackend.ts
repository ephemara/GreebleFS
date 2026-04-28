import type { FileSearchResponse } from "../config/searchTelemetry";
import type { FsRuntimeCachePolicy } from "../config/runtimeCachePolicy";
import {
  buildExplorerArchiveVirtualPath,
  getExplorerArchiveContainerPath,
  getExplorerArchiveVirtualParentPath,
  getExplorerArchiveVirtualRootLabel,
  isExplorerArchiveVirtualPath,
  normalizeExplorerArchiveEntryPath,
  parseExplorerArchiveVirtualPath,
} from "../config/explorerArchives";
import { isExplorerVirtualPath } from "../config/explorerVirtualLocations";
import { commands, events, unwrapTauriResult } from "./tauriClient";
import { readIpcBinaryBytes } from "./ipc";
import { useExplorerStore } from "../store/explorerStore";
import {
  bootstrapExplorerPolicySession,
  navigateExplorerPolicySession,
  resolveExplorerEntryOpenWithPolicy,
} from "./goExplorerPolicyService";
import {
  type CloudAccountStatus,
  type CloudAccountSummary,
  type CloudAccountsSnapshot,
  type CloudAuthSession,
  type CloudAuthStatus,
  type CloudBreadcrumb,
  type CloudProviderConfigurationSource,
  type CloudProviderConfigurationStatus,
  type CloudProviderId,
  type RemoteAuthMode,
  type RemoteConnectionStatus,
  type RemoteConnectionSummary,
  type RemoteConnectionUpsertRequest,
  type RemoteDirectoryListing,
  type RemotePendingHostVerification,
  type RemoteProtocol,
  type RemoteTrustedHostRecord,
  type RemoteTrustedHostRemovalRequest,
  type AssociatedProgram,
  type AssociatedProgramsCatalog,
  type DriveInfo,
  type EntryStorageInfo,
  type ExplorerDuplicateScanStartResponse,
  type ExplorerDuplicateScanStatus,
  type ExplorerEntryThumbnail,
  type ExplorerThumbnailArtifact,
  type ExplorerEntryThumbnailRequest,
  type ExplorerSavedSearchRecord,
  type ExplorerSavedSearchSaveRequest,
  type ExplorerSearchMode,
  type ExplorerSemanticFindSimilarRequest,
  type ExplorerSemanticIndexBuildRequest,
  type ExplorerSemanticIndexBuildStartResponse,
  type ExplorerSemanticIndexSummary,
  type ExplorerSemanticSearchDiagnostics,
  type ExplorerSemanticSearchRequest,
  type ExplorerSemanticSearchResponse,
  type ExplorerSemanticSearchResult,
  type FsBatchRenameMode,
  type FsArchiveExtractionMode,
  type FsArchiveExtractionRequest,
  type FsArchiveExtractionResult,
  type FsArchiveEntryListingEntry,
  type FsArchiveEntryMaterializationMode,
  type FsArchiveEntryMaterializationRequest,
  type FsArchiveEntryMaterializationResult,
  type FsBatchRenamePreviewRow,
  type FsBatchRenameRecipe,
  type ExplorerTaskHistoryClearScope,
  type ExplorerTaskKind,
  type ExplorerTagMutationRequest,
  type ExplorerTaskRecord,
  type ExplorerTagSnapshot,
  type ExplorerTrashActionRecord,
  type ExplorerTrashRestoreResult,
  type ExplorerTaskProgressEvent,
  type ExplorerTaskStatus,
  type FileEntry,
  type FileSearchResult,
  type FileTransferCollision,
  type FileTransferCollisionPolicy,
  type FileTransferDisposition,
  type FileTransferOperation,
  type FileTransferResult,
  type FsChecksumEntryInfo,
  type FsItemPropertiesInfo,
  type FsJumpFilterEntry,
  type FsJumpFilterMatch,
  type FsJumpFilterRequest,
  type FsWriteFileContent,
  type FsBatchRenameItem,
  type FsBatchRenameResult,
  type TerminalShellIntegrationRequest,
  type TerminalShellIntegrationState,
  type TerminalShellIntegrationStateEvent,
  type YaziSchedulerTaskSnap,
} from "../generated/tauri";

export type ExplorerFileEntry = FileEntry;
export type ExplorerFileSearchResult = FileSearchResult;
export type ExplorerEntryStorageInfo = EntryStorageInfo;
export type ExplorerFileTransferOperation = FileTransferOperation;
export type ExplorerFileTransferResult = FileTransferResult;
export type ExplorerFileTransferCollision = FileTransferCollision;
export type ExplorerFileTransferCollisionPolicy = FileTransferCollisionPolicy;
export type ExplorerFileTransferDisposition = FileTransferDisposition;
export type ExplorerTaskProgress = ExplorerTaskProgressEvent;
export type ExplorerTaskSnapshot = ExplorerTaskRecord;
export type ExplorerSchedulerTask = YaziSchedulerTaskSnap;
export type ExplorerTaskHistoryScope = ExplorerTaskHistoryClearScope;
export type ExplorerTaskKindValue = ExplorerTaskKind;
export type ExplorerTaskStatusValue = ExplorerTaskStatus;
export type ExplorerWritableContent = string | number[];
export type ExplorerCloudProviderId = CloudProviderId;
export type ExplorerCloudAccountStatus = CloudAccountStatus;
export type ExplorerCloudAccountSummary = CloudAccountSummary;
export type ExplorerCloudAccountsSnapshot = CloudAccountsSnapshot;
export type ExplorerCloudAuthSession = CloudAuthSession;
export type ExplorerCloudAuthStatus = CloudAuthStatus;
export type ExplorerCloudProviderConfigurationSource =
  CloudProviderConfigurationSource;
export type ExplorerCloudProviderConfigurationStatus =
  CloudProviderConfigurationStatus;
export type ExplorerAssociatedProgram = AssociatedProgram;
export type ExplorerAssociatedProgramsCatalog = AssociatedProgramsCatalog;
export type ExplorerTagMetadataSnapshot = ExplorerTagSnapshot;
export type ExplorerTagMutation = ExplorerTagMutationRequest;
export type ExplorerSavedSearch = ExplorerSavedSearchRecord;
export type ExplorerSavedSearchInput = ExplorerSavedSearchSaveRequest;
export type ExplorerSearchModeValue = ExplorerSearchMode;
export type ExplorerSemanticIndexSummaryValue = ExplorerSemanticIndexSummary;
export type ExplorerSemanticIndexBuildInput = ExplorerSemanticIndexBuildRequest;
export type ExplorerSemanticIndexBuildStart =
  ExplorerSemanticIndexBuildStartResponse;
export type ExplorerSemanticSearchInput = ExplorerSemanticSearchRequest;
export type ExplorerSemanticSearchResultValue = ExplorerSemanticSearchResult;
export type ExplorerSemanticSearchDiagnosticsValue =
  ExplorerSemanticSearchDiagnostics;
export type ExplorerSemanticSearchOutput = ExplorerSemanticSearchResponse;
export type ExplorerSemanticFindSimilarInput =
  ExplorerSemanticFindSimilarRequest;
export type ExplorerArchiveExtractionMode = FsArchiveExtractionMode;
export type ExplorerArchiveExtractionInput = FsArchiveExtractionRequest;
export type ExplorerArchiveExtractionOutcome = FsArchiveExtractionResult;
export type ExplorerArchiveListingEntry = FsArchiveEntryListingEntry;
export type ExplorerArchiveEntryMaterializationModeValue =
  FsArchiveEntryMaterializationMode;
export type ExplorerArchiveEntryMaterializationInput =
  FsArchiveEntryMaterializationRequest;
export type ExplorerArchiveEntryMaterializationOutcome =
  FsArchiveEntryMaterializationResult;
export type ExplorerTrashAction = ExplorerTrashActionRecord;
export type ExplorerTrashRestore = ExplorerTrashRestoreResult;
export type ExplorerBatchRenameItem = FsBatchRenameItem;
export type ExplorerBatchRenameResult = FsBatchRenameResult;
export type ExplorerBatchRenameModeValue = FsBatchRenameMode;
export type ExplorerBatchRenameRecipeInput = FsBatchRenameRecipe;
export type ExplorerBatchRenamePreview = FsBatchRenamePreviewRow;
export type ExplorerDuplicateScanStart = ExplorerDuplicateScanStartResponse;
export type ExplorerDuplicateScan = ExplorerDuplicateScanStatus;
export type ExplorerEntryThumbnailData = ExplorerEntryThumbnail;
export type ExplorerEntryThumbnailInput = ExplorerEntryThumbnailRequest;
export type ExplorerThumbnailArtifactData = ExplorerThumbnailArtifact;
export type ExplorerChecksumInfo = FsChecksumEntryInfo;
export type ExplorerItemProperties = FsItemPropertiesInfo;
export type ExplorerJumpFilterEntryInput = FsJumpFilterEntry;
export type ExplorerJumpFilterInput = FsJumpFilterRequest;
export type ExplorerJumpFilterResult = FsJumpFilterMatch;
export type ExplorerTerminalShellIntegrationInput =
  TerminalShellIntegrationRequest;
export type ExplorerTerminalShellIntegration = TerminalShellIntegrationState;
export type ExplorerTerminalShellIntegrationEvent =
  TerminalShellIntegrationStateEvent;

export type ExplorerLocationBreadcrumb = {
  label: string;
  path: string;
};

export type ExplorerSourceKind = "local" | "cloud" | "remote";

export type ExplorerSourceCapabilities = {
  supportsGeneratedThumbnails: boolean;
  supportsNativeDragOut: boolean;
  supportsNativeIntegration: boolean;
  supportsScan: boolean;
  supportsSearch: boolean;
  supportsSemanticIndexing: boolean;
};

export type ExplorerLocationListing = {
  kind: "local" | "cloud" | "remote" | "archive";
  path: string;
  parentPath: string | null;
  breadcrumbs: ExplorerLocationBreadcrumb[];
  entries: ExplorerFileEntry[];
};

export type ExplorerLocalDriveInfo = DriveInfo & {
  kind: "local";
  capabilities: ExplorerSourceCapabilities;
};

export type ExplorerCloudDriveInfo = {
  kind: "cloud";
  capabilities: ExplorerSourceCapabilities;
  id: string;
  path: string;
  label: string;
  provider: ExplorerCloudProviderId;
  accountId: string;
  email: string;
  status: ExplorerCloudAccountStatus;
  avatarUrl: string | null;
};

export type ExplorerRemoteProtocol = RemoteProtocol;
export type ExplorerRemoteAuthMode = RemoteAuthMode;
export type ExplorerRemoteConnectionStatus = RemoteConnectionStatus;
export type ExplorerRemotePendingHostVerification =
  RemotePendingHostVerification;
export type ExplorerRemoteTrustedHostRecord = RemoteTrustedHostRecord;
export type ExplorerRemoteConnectionInput = RemoteConnectionUpsertRequest;
export type ExplorerRemoteConnectionSummary = RemoteConnectionSummary;
export type ExplorerRemoteTrustedHostRemovalInput =
  RemoteTrustedHostRemovalRequest;
export type ExplorerRemoteDirectoryListing = RemoteDirectoryListing;

export type ExplorerRemoteDriveInfo = RemoteConnectionSummary & {
  kind: "remote";
  path: string;
  capabilities: ExplorerSourceCapabilities;
};

export type ExplorerDriveInfo =
  | ExplorerLocalDriveInfo
  | ExplorerCloudDriveInfo
  | ExplorerRemoteDriveInfo;

const LOCAL_SOURCE_CAPABILITIES: ExplorerSourceCapabilities = {
  supportsGeneratedThumbnails: true,
  supportsNativeDragOut: true,
  supportsNativeIntegration: true,
  supportsScan: true,
  supportsSearch: true,
  supportsSemanticIndexing: true,
};

const REMOTE_SOURCE_CAPABILITIES: ExplorerSourceCapabilities = {
  supportsGeneratedThumbnails: false,
  supportsNativeDragOut: false,
  supportsNativeIntegration: false,
  supportsScan: false,
  supportsSearch: false,
  supportsSemanticIndexing: false,
};

const CLOUD_SOURCE_CAPABILITIES: ExplorerSourceCapabilities = {
  supportsGeneratedThumbnails: false,
  supportsNativeDragOut: false,
  supportsNativeIntegration: false,
  supportsScan: false,
  supportsSearch: false,
  supportsSemanticIndexing: false,
};

const REMOTE_PROTOCOL_PREFIX = "remote://sftp/";

function toWritablePayload(
  content: ExplorerWritableContent,
): FsWriteFileContent {
  return typeof content === "string"
    ? { kind: "text", value: content }
    : { kind: "bytes", value: content };
}

export function isCloudExplorerPath(path: string): boolean {
  return path.trim().startsWith("cloud://");
}

export function isRemoteExplorerPath(path: string): boolean {
  return path.trim().startsWith(REMOTE_PROTOCOL_PREFIX);
}

export type ExplorerPathSourceKind =
  | ExplorerSourceKind
  | "archive"
  | "virtual";

type ParsedRemoteExplorerPath = {
  connectionId: string;
  relativeSegments: string[];
};

function parseRemoteExplorerPath(
  path: string,
): ParsedRemoteExplorerPath | null {
  try {
    const url = new URL(path);
    if (url.protocol !== "remote:" || url.hostname !== "sftp") {
      return null;
    }
    const segments = url.pathname.split("/").filter(Boolean);
    if (segments[1] !== "root") {
      return null;
    }
    return {
      connectionId: decodeURIComponent(segments[0] ?? ""),
      relativeSegments: segments.slice(2).map((segment) =>
        decodeURIComponent(segment),
      ),
    };
  } catch {
    return null;
  }
}

export function buildRemoteExplorerRootPath(connectionId: string): string {
  return buildRemoteExplorerPath(connectionId, []);
}

function buildRemoteExplorerPath(
  connectionId: string,
  relativeSegments: string[],
): string {
  const encodedConnectionId = encodeURIComponent(connectionId);
  if (relativeSegments.length === 0) {
    return `remote://sftp/${encodedConnectionId}/root`;
  }
  return `remote://sftp/${encodedConnectionId}/root/${relativeSegments.map((segment) => encodeURIComponent(segment)).join("/")}`;
}

function getRemoteParentPath(path: string): string | null {
  const parsed = parseRemoteExplorerPath(path);
  if (!parsed || parsed.relativeSegments.length === 0) {
    return null;
  }
  return buildRemoteExplorerPath(
    parsed.connectionId,
    parsed.relativeSegments.slice(0, -1),
  );
}

function toExplorerRemoteBreadcrumbs(
  breadcrumbs: Array<{ label: string; path: string }>,
): ExplorerLocationBreadcrumb[] {
  return breadcrumbs.map((breadcrumb) => ({
    label: breadcrumb.label,
    path: breadcrumb.path,
  }));
}

export function getExplorerPathSourceKind(
  path: string,
): ExplorerPathSourceKind {
  if (isExplorerArchiveVirtualPath(path)) {
    return "archive";
  }
  if (isCloudExplorerPath(path)) {
    return "cloud";
  }
  if (isRemoteExplorerPath(path)) {
    return "remote";
  }
  if (isExplorerVirtualPath(path)) {
    return "virtual";
  }
  return "local";
}

function getExplorerSourceCapabilitiesForPath(
  path: string,
): ExplorerSourceCapabilities {
  switch (getExplorerPathSourceKind(path)) {
    case "local":
      return LOCAL_SOURCE_CAPABILITIES;
    case "archive":
      return {
        ...LOCAL_SOURCE_CAPABILITIES,
        supportsNativeDragOut: true,
        supportsNativeIntegration: false,
        supportsScan: false,
        supportsSearch: false,
        supportsSemanticIndexing: false,
      };
    case "cloud":
      return CLOUD_SOURCE_CAPABILITIES;
    case "remote":
      return REMOTE_SOURCE_CAPABILITIES;
    case "virtual":
      return {
        ...LOCAL_SOURCE_CAPABILITIES,
        supportsNativeDragOut: false,
        supportsNativeIntegration: false,
        supportsScan: false,
        supportsSearch: false,
        supportsSemanticIndexing: false,
      };
  }
}

function buildLocalBreadcrumbs(path: string): ExplorerLocationBreadcrumb[] {
  const normalizedPath = path.trim();
  if (!normalizedPath) {
    return [];
  }

  if (/^[A-Za-z]:\\?$/.test(normalizedPath)) {
    const drivePath = normalizedPath.endsWith("\\")
      ? normalizedPath
      : `${normalizedPath}\\`;
    return [{ label: drivePath, path: drivePath }];
  }

  if (/^[A-Za-z]:[\\/]/.test(normalizedPath)) {
    const drivePath = `${normalizedPath.slice(0, 2)}\\`;
    const parts = normalizedPath
      .replace(/[/\\]+$/, "")
      .split(/[/\\]/)
      .filter(Boolean);
    const breadcrumbs: ExplorerLocationBreadcrumb[] = [
      { label: drivePath, path: drivePath },
    ];

    for (let index = 1; index < parts.length; index += 1) {
      const nextPath = `${parts.slice(0, index + 1).join("\\")}${index === parts.length - 1 ? "" : ""}`;
      breadcrumbs.push({ label: parts[index] ?? "", path: nextPath });
    }

    return breadcrumbs;
  }

  if (normalizedPath.startsWith("/")) {
    const parts = normalizedPath.replace(/\/+$/, "").split("/").filter(Boolean);
    const breadcrumbs: ExplorerLocationBreadcrumb[] = [
      { label: "/", path: "/" },
    ];
    for (let index = 0; index < parts.length; index += 1) {
      breadcrumbs.push({
        label: parts[index] ?? "",
        path: `/${parts.slice(0, index + 1).join("/")}`,
      });
    }
    return breadcrumbs;
  }

  const parts = normalizedPath
    .replace(/[/\\]+$/, "")
    .split(/[/\\]/)
    .filter(Boolean);
  return parts.map((label, index) => ({
    label,
    path: parts.slice(0, index + 1).join("/"),
  }));
}

function getLocalParentPath(path: string): string | null {
  const normalized = path.trim();
  if (!normalized) {
    return null;
  }

  if (/^[A-Za-z]:\\?$/.test(normalized) || normalized === "/") {
    return null;
  }

  const trimmed = normalized.replace(/[/\\]+$/, "");
  const parts = trimmed.split(/[/\\]/);
  if (parts.length <= 1) {
    return null;
  }

  if (/^[A-Za-z]:$/.test(parts[0] ?? "")) {
    return parts.length === 2
      ? `${parts[0]}\\`
      : `${parts.slice(0, -1).join("\\")}\\`;
  }

  return trimmed.startsWith("/")
    ? `/${parts.slice(0, -1).filter(Boolean).join("/")}` || "/"
    : parts.slice(0, -1).join("/");
}

function getCloudParentPath(path: string): string | null {
  const trimmed = path.replace(/\/+$/, "");
  if (!trimmed.startsWith("cloud://")) {
    return null;
  }

  const segments = trimmed.split("/");
  if (segments.length <= 5) {
    return null;
  }

  return segments.slice(0, -1).join("/");
}

function toExplorerCloudBreadcrumbs(
  breadcrumbs: CloudBreadcrumb[],
): ExplorerLocationBreadcrumb[] {
  return breadcrumbs.map((breadcrumb) => ({
    label: breadcrumb.label,
    path: breadcrumb.path,
  }));
}

function getLeafName(path: string): string {
  const trimmed = path.replace(/[/\\]+$/, "");
  const match = trimmed.match(/([^/\\]+)$/);
  return match?.[1] ?? trimmed;
}

function buildDerivedExplorerEntityId(
  namespace: string,
  stableKey: string,
): string {
  return `${namespace}:${stableKey}`;
}

function buildArchiveEntryContentRevision(
  entry: ExplorerArchiveListingEntry,
  normalizedRelativePath: string,
): string {
  return [
    "archive-entry",
    normalizedRelativePath,
    entry.isDir ? "dir" : "file",
    entry.size,
    entry.modified,
    entry.extension,
  ].join("::");
}

function getParentDir(path: string): string {
  if (isCloudExplorerPath(path)) {
    const parentPath = getCloudParentPath(path);
    if (!parentPath) {
      throw new Error(
        "Cloud root folders cannot be created without a parent path.",
      );
    }
    return parentPath;
  }

  if (isRemoteExplorerPath(path)) {
    const parentPath = getRemoteParentPath(path);
    if (!parentPath) {
      throw new Error(
        "Remote root folders cannot be created without a parent path.",
      );
    }
    return parentPath;
  }

  const trimmed = path.replace(/[/\\]+$/, "");
  const parentPath = trimmed.replace(/[/\\][^/\\]+$/, "");
  if (parentPath === trimmed) {
    throw new Error(`Unable to derive parent directory for ${path}`);
  }
  if (/^[A-Za-z]:$/.test(parentPath)) {
    return `${parentPath}\\`;
  }
  return parentPath || "/";
}

function toLocalDriveInfo(drive: DriveInfo): ExplorerLocalDriveInfo {
  return {
    ...drive,
    kind: "local",
    capabilities: {
      ...LOCAL_SOURCE_CAPABILITIES,
      supportsScan: drive.supportsScan,
    },
  };
}

function toCloudDriveInfo(
  account: CloudAccountSummary,
): ExplorerCloudDriveInfo {
  return {
    kind: "cloud",
    capabilities: CLOUD_SOURCE_CAPABILITIES,
    id: account.id,
    path: account.root_path,
    label: account.drive_label,
    provider: account.provider,
    accountId: account.id,
    email: account.email,
    status: account.status,
    avatarUrl: account.avatar_url,
  };
}

function toRemoteDriveInfo(
  connection: RemoteConnectionSummary,
): ExplorerRemoteDriveInfo {
  return {
    ...connection,
    kind: "remote",
    path: buildRemoteExplorerRootPath(connection.id),
    capabilities: REMOTE_SOURCE_CAPABILITIES,
  };
}

export type ExplorerBackendContract = {
  listDir: typeof listExplorerDir;
  listDirUncached: typeof listExplorerDirUncached;
  listArchiveDir: typeof listExplorerArchiveDir;
  listLocation: typeof listExplorerLocation;
  listLocationUncached: typeof listExplorerLocationUncached;
  bootstrapPolicySession: typeof bootstrapExplorerPolicySession;
  navigatePolicySession: typeof navigateExplorerPolicySession;
  resolveEntryOpenWithPolicy: typeof resolveExplorerEntryOpenWithPolicy;
  getDrives: typeof getExplorerDrives;
  measureEntrySizes: typeof measureExplorerEntrySizes;
  calculateRecursiveSizes: typeof calculateExplorerRecursiveSizes;
  calculateChecksums: typeof calculateExplorerChecksums;
  getItemProperties: typeof getExplorerItemProperties;
  fuzzyFilterEntries: typeof fuzzyFilterExplorerEntries;
  getRuntimeCachePolicy: typeof getExplorerRuntimeCachePolicy;
  getHomeDir: typeof getExplorerHomeDir;
  searchEntriesWithDiagnostics: typeof searchExplorerEntriesWithDiagnostics;
  cancelSearchEntries: typeof cancelExplorerSearchEntries;
  watchEntrySizeRoot: typeof watchExplorerEntrySizeRoot;
  unwatchEntrySizeRoot: typeof unwatchExplorerEntrySizeRoot;
  planItemTransfer: typeof planExplorerItemTransfer;
  openPath: typeof openExplorerPath;
  openArchive: typeof openExplorerArchive;
  inspectArchive: typeof inspectExplorerArchive;
  openWithDialog: typeof openExplorerPathWithDialog;
  getAssociatedPrograms: typeof getExplorerAssociatedPrograms;
  openPathWithProgram: typeof openExplorerPathWithProgram;
  revealPath: typeof revealExplorerPath;
  showPathProperties: typeof showExplorerPathProperties;
  openPathAsAdmin: typeof openExplorerPathAsAdmin;
  createDir: typeof createExplorerDir;
  createFile: typeof createExplorerFile;
  extractArchive: typeof extractExplorerArchive;
  materializeArchiveEntry: typeof materializeExplorerArchiveEntry;
  transferItems: typeof transferExplorerItems;
  listTasks: typeof listExplorerTasks;
  clearTaskHistory: typeof clearExplorerTaskHistory;
  retryTask: typeof retryExplorerTask;
  cancelTask: typeof cancelExplorerTask;
  writeFile: typeof writeExplorerFile;
  readTextFile: typeof readExplorerTextFile;
  readFileBase64: typeof readExplorerFileBase64;
  readPreviewBytes: typeof readExplorerPreviewBytes;
  readImageThumbnail: typeof readExplorerImageThumbnail;
  readEntryThumbnail: typeof readExplorerEntryThumbnail;
  readEntryThumbnailArtifact: typeof readExplorerThumbnailArtifact;
  renamePath: typeof renameExplorerPath;
  deletePath: typeof deleteExplorerPath;
  trashPaths: typeof trashExplorerPaths;
  restoreRecentTrashAction: typeof restoreExplorerTrashAction;
  batchRename: typeof batchRenameExplorerPaths;
  previewBatchRename: typeof previewBatchRenameExplorerPaths;
  applyBatchRenameRecipe: typeof applyBatchRenameExplorerRecipe;
  startDuplicateScan: typeof startExplorerDuplicateScan;
  pollDuplicateScan: typeof pollExplorerDuplicateScan;
  cancelDuplicateScan: typeof cancelExplorerDuplicateScan;
  listTags: typeof listExplorerTags;
  setTagsForPaths: typeof setExplorerTagsForPaths;
  listSavedSearches: typeof listExplorerSavedSearches;
  saveSavedSearch: typeof saveExplorerSavedSearch;
  deleteSavedSearch: typeof deleteExplorerSavedSearch;
  getSemanticIndexSummary: typeof getExplorerSemanticIndexSummary;
  buildSemanticIndex: typeof buildExplorerSemanticIndex;
  searchSemantic: typeof searchExplorerSemantic;
  findSemanticSimilar: typeof findSimilarExplorerSemantic;
  isCloudPath: typeof isCloudExplorerPath;
  isRemotePath: typeof isRemoteExplorerPath;
  supportsSearch: typeof supportsExplorerSearch;
  supportsNativeIntegration: typeof supportsExplorerNativeIntegration;
  supportsNativeDragOut: typeof supportsExplorerNativeDragOut;
  registerTerminalShellIntegration: typeof registerExplorerTerminalShellIntegration;
  syncTerminalCwd: typeof syncExplorerTerminalCwd;
  setTerminalPromptState: typeof setExplorerTerminalPromptState;
};

export function queueExplorerTerminalDirectorySync(args: {
  path: string;
  shell?: string | null;
  source?: "navigation" | "open-terminal";
}): void {
  const path = args.path.trim();
  if (!path) {
    return;
  }

  useExplorerStore.getState().setPendingTerminalCwdSync({
    path,
    shell: args.shell ?? null,
    source: args.source ?? "navigation",
    updatedAt: Date.now(),
  });
}

function buildExplorerArchiveBreadcrumbs(
  location: ReturnType<typeof parseExplorerArchiveVirtualPath>,
): ExplorerLocationBreadcrumb[] {
  if (!location) {
    return [];
  }

  const containerPath = getExplorerArchiveContainerPath(location.archivePath);
  const breadcrumbs = containerPath ? buildLocalBreadcrumbs(containerPath) : [];
  const archiveRootPath = buildExplorerArchiveVirtualPath({
    archivePath: location.archivePath,
    entryPath: "",
  });

  breadcrumbs.push({
    label: getExplorerArchiveVirtualRootLabel(archiveRootPath),
    path: archiveRootPath,
  });

  const entrySegments = location.entryPath.split("/").filter(Boolean);
  for (let index = 0; index < entrySegments.length; index += 1) {
    breadcrumbs.push({
      label: entrySegments[index] ?? "",
      path: buildExplorerArchiveVirtualPath({
        archivePath: location.archivePath,
        entryPath: entrySegments.slice(0, index + 1).join("/"),
      }),
    });
  }

  return breadcrumbs;
}

function toExplorerArchiveVirtualEntry(
  archivePath: string,
  entry: ExplorerArchiveListingEntry,
): ExplorerFileEntry {
  const normalizedRelativePath = normalizeExplorerArchiveEntryPath(
    entry.relativePath,
  );
  const contentRevision = buildArchiveEntryContentRevision(
    entry,
    normalizedRelativePath,
  );
  const virtualPath = buildExplorerArchiveVirtualPath({
    archivePath,
    entryPath: normalizedRelativePath,
  });

  return {
    name: entry.name,
    path: virtualPath,
    is_dir: entry.isDir,
    size: entry.size,
    modified: entry.modified,
    extension: entry.extension,
    is_hidden: entry.name.startsWith("."),
    is_symlink: false,
    entityId: buildDerivedExplorerEntityId(
      "archive-entry",
      `${archivePath}::${normalizedRelativePath}`,
    ),
    identityKind: "derived",
    contentRevision,
  };
}

export async function listExplorerArchiveDir(
  archivePath: string,
  entryPath = "",
): Promise<ExplorerFileEntry[]> {
  const entries = unwrapTauriResult(
    await commands.fsListArchiveDir(
      archivePath,
      normalizeExplorerArchiveEntryPath(entryPath),
    ),
  );

  return entries.map((entry) => toExplorerArchiveVirtualEntry(archivePath, entry));
}

export async function listExplorerLocation(
  path: string,
  showHidden: boolean,
): Promise<ExplorerLocationListing> {
  const archiveLocation = parseExplorerArchiveVirtualPath(path);
  if (archiveLocation) {
    const archiveVirtualPath = buildExplorerArchiveVirtualPath(archiveLocation);
    return {
      kind: "archive",
      path: archiveVirtualPath,
      parentPath: getExplorerArchiveVirtualParentPath(archiveVirtualPath),
      breadcrumbs: buildExplorerArchiveBreadcrumbs(archiveLocation),
      entries: await listExplorerArchiveDir(
        archiveLocation.archivePath,
        archiveLocation.entryPath,
      ),
    };
  }

  if (isCloudExplorerPath(path)) {
    const listing = unwrapTauriResult(await commands.cloudListDir(path));
    return {
      kind: "cloud",
      path: listing.path,
      parentPath: listing.parent_path,
      breadcrumbs: toExplorerCloudBreadcrumbs(listing.breadcrumbs),
      entries: listing.entries,
    };
  }

  if (isRemoteExplorerPath(path)) {
    const listing = unwrapTauriResult(await commands.remoteListDir(path));
    return {
      kind: "remote",
      path: listing.path,
      parentPath: listing.parentPath,
      breadcrumbs: toExplorerRemoteBreadcrumbs(listing.breadcrumbs),
      entries: listing.entries,
    };
  }

  const normalizedPath = /^[A-Za-z]:$/.test(path) ? `${path}\\` : path;
  const entries = unwrapTauriResult(
    await commands.fsListDir(normalizedPath, showHidden),
  );
  return {
    kind: "local",
    path: normalizedPath,
    parentPath: getLocalParentPath(normalizedPath),
    breadcrumbs: buildLocalBreadcrumbs(normalizedPath),
    entries,
  };
}

export async function listExplorerLocationUncached(
  path: string,
  showHidden: boolean,
): Promise<ExplorerLocationListing> {
  if (isExplorerArchiveVirtualPath(path)) {
    return listExplorerLocation(path, showHidden);
  }

  if (isCloudExplorerPath(path) || isRemoteExplorerPath(path)) {
    return listExplorerLocation(path, showHidden);
  }

  const normalizedPath = /^[A-Za-z]:$/.test(path) ? `${path}\\` : path;
  const entries = unwrapTauriResult(
    await commands.fsListDirUncached(normalizedPath, showHidden),
  );
  return {
    kind: "local",
    path: normalizedPath,
    parentPath: getLocalParentPath(normalizedPath),
    breadcrumbs: buildLocalBreadcrumbs(normalizedPath),
    entries,
  };
}

export async function listExplorerDir(
  path: string,
  showHidden: boolean,
): Promise<ExplorerFileEntry[]> {
  return (await listExplorerLocation(path, showHidden)).entries;
}

export async function listExplorerDirUncached(
  path: string,
  showHidden: boolean,
): Promise<ExplorerFileEntry[]> {
  return (await listExplorerLocationUncached(path, showHidden)).entries;
}

export async function getExplorerDrives(): Promise<ExplorerDriveInfo[]> {
  const [localDrives, remoteConnections, cloudSnapshot] = await Promise.all([
    commands.fsGetDrives().then(unwrapTauriResult),
    commands.remoteListConnections().then(unwrapTauriResult).catch(
      (): ExplorerRemoteConnectionSummary[] => [],
    ),
    listCloudAccounts().catch(
      (): ExplorerCloudAccountsSnapshot => ({ accounts: [], providers: [] }),
    ),
  ]);

  return [
    ...localDrives.map(toLocalDriveInfo),
    ...remoteConnections.map(toRemoteDriveInfo),
    ...cloudSnapshot.accounts
      .filter((account) => account.status === "connected")
      .map(toCloudDriveInfo),
  ];
}

export async function measureExplorerEntrySizes(
  paths: string[],
  forceRefresh = false,
): Promise<ExplorerEntryStorageInfo[]> {
  const localPaths = paths.filter(
    (path) => getExplorerPathSourceKind(path) === "local",
  );
  if (localPaths.length === 0) {
    return [];
  }
  return unwrapTauriResult(
    await commands.fsMeasureEntrySizes(localPaths, forceRefresh),
  );
}

export async function calculateExplorerRecursiveSizes(
  paths: string[],
  forceRefresh = false,
): Promise<ExplorerEntryStorageInfo[]> {
  const localPaths = paths.filter(
    (path) => getExplorerPathSourceKind(path) === "local",
  );
  if (localPaths.length === 0) {
    return [];
  }
  return unwrapTauriResult(
    await commands.fsCalculateRecursiveSizes(localPaths, forceRefresh),
  );
}

export async function calculateExplorerChecksums(
  paths: string[],
): Promise<ExplorerChecksumInfo[]> {
  const localPaths = paths.filter(
    (path) => getExplorerPathSourceKind(path) === "local",
  );
  if (localPaths.length === 0) {
    return [];
  }
  return unwrapTauriResult(await commands.fsCalculateChecksums(localPaths));
}

export async function getExplorerItemProperties(
  path: string,
): Promise<ExplorerItemProperties> {
  if (getExplorerPathSourceKind(path) !== "local") {
    throw new Error(
      "Properties are only available for local filesystem items.",
    );
  }
  return unwrapTauriResult(await commands.fsGetItemProperties(path));
}

export async function fuzzyFilterExplorerEntries(
  request: ExplorerJumpFilterInput,
): Promise<ExplorerJumpFilterResult[]> {
  return unwrapTauriResult(await commands.fsFuzzyFilterEntries(request));
}

export async function getExplorerRuntimeCachePolicy(): Promise<FsRuntimeCachePolicy> {
  return commands.fsGetRuntimeCachePolicy();
}

export async function getExplorerHomeDir(): Promise<string> {
  return unwrapTauriResult(await commands.fsGetHomeDir());
}

export async function searchExplorerEntriesWithDiagnostics(args: {
  path: string;
  query: string;
  showHidden: boolean;
  includeContent?: boolean;
  limit?: number;
  requestId?: number;
  requestScope?: string;
}): Promise<FileSearchResponse<ExplorerFileSearchResult>> {
  if (!supportsExplorerSearch(args.path)) {
    throw new Error("Search is only available for local filesystem roots.");
  }

  return unwrapTauriResult(
    await commands.fsSearchEntriesWithDiagnostics(
      args.path,
      args.query,
      args.showHidden,
      args.includeContent ?? false,
      args.limit ?? null,
      args.requestId ?? null,
      args.requestScope ?? null,
    ),
  ) as FileSearchResponse<ExplorerFileSearchResult>;
}

export async function cancelExplorerSearchEntries(args: {
  path: string;
  requestId?: number;
  requestScope?: string;
}): Promise<void> {
  if (!supportsExplorerSearch(args.path)) {
    return;
  }

  unwrapTauriResult(
    await commands.fsCancelSearchEntries(
      args.path,
      args.requestId ?? null,
      args.requestScope ?? null,
    ),
  );
}

export async function watchExplorerEntrySizeRoot(path: string): Promise<void> {
  if (getExplorerPathSourceKind(path) !== "local") {
    return;
  }
  unwrapTauriResult(await commands.fsWatchEntrySizeRoot(path));
}

export async function unwatchExplorerEntrySizeRoot(
  path: string,
): Promise<void> {
  if (getExplorerPathSourceKind(path) !== "local") {
    return;
  }
  unwrapTauriResult(await commands.fsUnwatchEntrySizeRoot(path));
}

export async function openExplorerPath(path: string): Promise<void> {
  if (isCloudExplorerPath(path)) {
    unwrapTauriResult(await commands.cloudOpenFile(path));
    return;
  }
  if (isRemoteExplorerPath(path)) {
    unwrapTauriResult(await commands.remoteOpenFile(path));
    return;
  }
  unwrapTauriResult(await commands.fsOpenFile(path));
}

export async function openExplorerArchive(
  path: string,
): Promise<ExplorerArchiveExtractionOutcome> {
  if (getExplorerPathSourceKind(path) !== "local") {
    throw new Error(
      "Archive extraction is only available for local filesystem items.",
    );
  }
  return unwrapTauriResult(await commands.fsOpenArchive(path));
}

export async function inspectExplorerArchive(path: string): Promise<string[]> {
  if (getExplorerPathSourceKind(path) !== "local") {
    throw new Error(
      "Archive inspection is only available for local filesystem items.",
    );
  }
  return unwrapTauriResult(await commands.fsInspectArchive(path));
}

export async function openExplorerPathWithDialog(path: string): Promise<void> {
  if (getExplorerPathSourceKind(path) !== "local") {
    throw new Error("Open With is only available for local filesystem items.");
  }
  unwrapTauriResult(await commands.fsOpenWithDialog(path));
}

export async function getExplorerAssociatedPrograms(
  path: string,
): Promise<ExplorerAssociatedProgramsCatalog> {
  if (getExplorerPathSourceKind(path) !== "local") {
    throw new Error("Open With is only available for local filesystem items.");
  }
  return unwrapTauriResult(await commands.openWithGetAssociatedPrograms(path));
}

export async function openExplorerPathWithProgram(
  path: string,
  programPath: string,
  launchArguments: string[] = [],
): Promise<void> {
  if (getExplorerPathSourceKind(path) !== "local") {
    throw new Error("Open With is only available for local filesystem items.");
  }
  unwrapTauriResult(
    await commands.openWithLaunchProgram(path, programPath, launchArguments),
  );
}

export async function revealExplorerPath(path: string): Promise<void> {
  if (getExplorerPathSourceKind(path) !== "local") {
    throw new Error(
      "Reveal in the OS file manager is only available for local filesystem items.",
    );
  }
  unwrapTauriResult(await commands.fsRevealInExplorer(path));
}

export async function showExplorerPathProperties(path: string): Promise<void> {
  if (getExplorerPathSourceKind(path) !== "local") {
    throw new Error(
      "Properties are only available for local filesystem items.",
    );
  }
  unwrapTauriResult(await commands.fsShowItemProperties(path));
}

export async function openExplorerPathAsAdmin(path: string): Promise<void> {
  if (getExplorerPathSourceKind(path) !== "local") {
    throw new Error(
      "Administrative open is only available for local filesystem items.",
    );
  }
  unwrapTauriResult(await commands.fsOpenAsAdmin(path));
}

export async function createExplorerDir(path: string): Promise<void> {
  if (isCloudExplorerPath(path)) {
    unwrapTauriResult(
      await commands.cloudCreateDirectory(
        getParentDir(path),
        getLeafName(path),
      ),
    );
    return;
  }
  if (isRemoteExplorerPath(path)) {
    unwrapTauriResult(
      await commands.remoteCreateDirectory(getParentDir(path), getLeafName(path)),
    );
    return;
  }
  unwrapTauriResult(await commands.fsCreateDir(path));
}

export async function extractExplorerArchive(
  request: ExplorerArchiveExtractionInput,
): Promise<ExplorerArchiveExtractionOutcome> {
  if (isCloudExplorerPath(request.archivePath)) {
    throw new Error(
      "Archive extraction is only available for local filesystem items.",
    );
  }
  return unwrapTauriResult(await commands.fsExtractArchive(request));
}

export async function materializeExplorerArchiveEntry(
  request: ExplorerArchiveEntryMaterializationInput,
): Promise<ExplorerArchiveEntryMaterializationOutcome> {
  if (isCloudExplorerPath(request.archivePath)) {
    throw new Error(
      "Archive entry materialization is only available for local filesystem items.",
    );
  }
  return unwrapTauriResult(await commands.fsMaterializeArchiveEntry(request));
}

export async function createExplorerFile(
  parentPath: string,
  name: string,
  content: ExplorerWritableContent = "",
): Promise<void> {
  const payload = toWritablePayload(content);
  switch (getExplorerPathSourceKind(parentPath)) {
    case "cloud":
      unwrapTauriResult(await commands.cloudCreateFile(parentPath, name, payload));
      return;
    case "remote":
      unwrapTauriResult(await commands.remoteCreateFile(parentPath, name, payload));
      return;
    case "local": {
      const separator = parentPath.includes("\\") ? "\\" : "/";
      const normalizedParent = parentPath.replace(/[/\\]+$/, "");
      const nextPath = normalizedParent
        ? `${normalizedParent}${separator}${name}`
        : name;
      unwrapTauriResult(await commands.fsWriteFile(nextPath, payload));
      return;
    }
    default:
      throw new Error("Files can only be created in local, remote, or cloud folders.");
  }
}

export async function transferExplorerItems(
  targetDir: string,
  sources: string[],
  operation: ExplorerFileTransferOperation,
  collisionPolicy: ExplorerFileTransferCollisionPolicy = "keep_both",
): Promise<ExplorerFileTransferResult[]> {
  const sourceKinds = new Set(sources.map((source) => getExplorerPathSourceKind(source)));
  const targetKind = getExplorerPathSourceKind(targetDir);
  const involvesCloud = targetKind === "cloud" || sourceKinds.has("cloud");
  const involvesRemote = targetKind === "remote" || sourceKinds.has("remote");

  if ((targetKind !== "local" && targetKind !== "cloud" && targetKind !== "remote")
    || [...sourceKinds].some(
      (kind) => kind !== "local" && kind !== "cloud" && kind !== "remote",
    )) {
    throw new Error("Transfers are only available for local, remote, or cloud items.");
  }

  if (involvesCloud || involvesRemote) {
    if (collisionPolicy !== "keep_both") {
      throw new Error(
        "Replace and skip collision policies are only available for local filesystem transfers.",
      );
    }
  }

  if (involvesCloud && involvesRemote) {
    throw new Error(
      "Direct transfers between remote and cloud sources are not supported yet. Use a local staging folder.",
    );
  }

  if (involvesCloud) {
    return unwrapTauriResult(
      await commands.cloudTransferItems(targetDir, sources, operation),
    );
  }

  if (involvesRemote) {
    return unwrapTauriResult(
      await commands.remoteTransferItems(targetDir, sources, operation),
    );
  }

  return unwrapTauriResult(
    await commands.fsTransferItems(
      targetDir,
      sources,
      operation,
      collisionPolicy,
    ),
  );
}

export async function planExplorerItemTransfer(
  targetDir: string,
  sources: string[],
  operation: ExplorerFileTransferOperation,
): Promise<ExplorerFileTransferCollision[]> {
  if (
    getExplorerPathSourceKind(targetDir) !== "local"
    || sources.some((source) => getExplorerPathSourceKind(source) !== "local")
  ) {
    return [];
  }
  return unwrapTauriResult(
    await commands.fsPlanTransferItems(targetDir, sources, operation),
  );
}

export async function listExplorerTasks(): Promise<ExplorerTaskSnapshot[]> {
  return unwrapTauriResult(await commands.fsListExplorerTasks());
}

export async function clearExplorerTaskHistory(
  scope: ExplorerTaskHistoryScope,
): Promise<void> {
  unwrapTauriResult(await commands.fsClearExplorerTaskHistory(scope));
}

export async function retryExplorerTask(
  taskId: string,
): Promise<ExplorerTaskSnapshot> {
  return unwrapTauriResult(await commands.fsRetryExplorerTask(taskId));
}

export async function cancelExplorerTask(
  taskId: string,
): Promise<ExplorerTaskSnapshot> {
  return unwrapTauriResult(await commands.fsCancelExplorerTask(taskId));
}

export async function writeExplorerFile(
  path: string,
  content: ExplorerWritableContent,
): Promise<void> {
  const payload = toWritablePayload(content);
  switch (getExplorerPathSourceKind(path)) {
    case "cloud":
      unwrapTauriResult(await commands.cloudWriteFile(path, payload));
      return;
    case "remote":
      unwrapTauriResult(await commands.remoteWriteFile(path, payload));
      return;
    case "local":
      unwrapTauriResult(await commands.fsWriteFile(path, payload));
      return;
    default:
      throw new Error("Writing files is only available for local, remote, or cloud items.");
  }
}

export async function readExplorerTextFile(path: string): Promise<string> {
  switch (getExplorerPathSourceKind(path)) {
    case "cloud":
      return unwrapTauriResult(await commands.cloudReadTextFile(path));
    case "remote":
      return unwrapTauriResult(await commands.remoteReadTextFile(path));
    case "local":
      return unwrapTauriResult(await commands.fsReadTextFile(path));
    default:
      throw new Error("Text file reads are only available for local, remote, or cloud items.");
  }
}

export async function readExplorerFileBase64(path: string): Promise<string> {
  switch (getExplorerPathSourceKind(path)) {
    case "cloud":
      return unwrapTauriResult(await commands.cloudReadFileBase64(path));
    case "remote":
      return unwrapTauriResult(await commands.remoteReadFileBase64(path));
    case "local":
      return unwrapTauriResult(await commands.fsReadFileBase64(path));
    default:
      throw new Error("Binary file reads are only available for local, remote, or cloud items.");
  }
}

export async function readExplorerPreviewBytes(
  path: string,
  maxBytes: number,
): Promise<Uint8Array> {
  switch (getExplorerPathSourceKind(path)) {
    case "cloud":
      return readIpcBinaryBytes("cloudPreviewBytes", path, maxBytes);
    case "remote":
      return readIpcBinaryBytes("remotePreviewBytes", path, maxBytes);
    case "local":
      return readIpcBinaryBytes("fsPreviewBytes", path, maxBytes);
    default:
      throw new Error("Preview bytes are only available for local, remote, or cloud items.");
  }
}

export async function readExplorerImageThumbnail(
  path: string,
  maxWidth: number,
  maxHeight: number,
): Promise<string> {
  switch (getExplorerPathSourceKind(path)) {
    case "cloud":
    case "remote":
      return readExplorerFileBase64(path);
    case "local":
      return unwrapTauriResult(
        await commands.fsReadImageThumbnail(path, maxWidth, maxHeight),
      );
    default:
      throw new Error("Image previews are only available for local, remote, or cloud items.");
  }
}

export async function readExplorerEntryThumbnail(
  request: ExplorerEntryThumbnailInput,
): Promise<ExplorerEntryThumbnailData> {
  if (getExplorerPathSourceKind(request.path) !== "local") {
    throw new Error(
      "Generated thumbnails are only available for local filesystem items.",
    );
  }
  return unwrapTauriResult(await commands.fsReadEntryThumbnail(request));
}

export async function readExplorerThumbnailArtifact(
  request: ExplorerEntryThumbnailInput,
): Promise<ExplorerThumbnailArtifactData> {
  if (getExplorerPathSourceKind(request.path) !== "local") {
    throw new Error(
      "Generated thumbnail artifacts are only available for local filesystem items.",
    );
  }
  return unwrapTauriResult(await commands.fsReadEntryThumbnailArtifact(request));
}

export async function renameExplorerPath(
  oldPath: string,
  newPath: string,
): Promise<void> {
  const oldKind = getExplorerPathSourceKind(oldPath);
  const newKind = getExplorerPathSourceKind(newPath);

  if (oldKind !== newKind) {
    throw new Error(
      "Renaming between different source types is not supported. Use move or copy instead.",
    );
  }

  if (oldKind === "cloud") {
    if (getCloudParentPath(oldPath) !== getCloudParentPath(newPath)) {
      throw new Error(
        "Cloud rename only supports changing the item name within the same parent folder.",
      );
    }
    unwrapTauriResult(await commands.cloudRenamePath(oldPath, getLeafName(newPath)));
    return;
  }

  if (oldKind === "remote") {
    const oldParsed = parseRemoteExplorerPath(oldPath);
    const newParsed = parseRemoteExplorerPath(newPath);
    if (!oldParsed || !newParsed || oldParsed.connectionId !== newParsed.connectionId) {
      throw new Error(
        "Remote rename only supports changing the item name within the same connection.",
      );
    }
    if (getRemoteParentPath(oldPath) !== getRemoteParentPath(newPath)) {
      throw new Error(
        "Remote rename only supports changing the item name within the same parent folder.",
      );
    }
    unwrapTauriResult(await commands.remoteRenamePath(oldPath, getLeafName(newPath)));
    return;
  }

  if (oldKind !== "local") {
    throw new Error("Renaming is only available for local, remote, or cloud items.");
  }

  unwrapTauriResult(await commands.fsRename(oldPath, newPath));
}

export async function deleteExplorerPath(
  path: string,
  recursive: boolean,
): Promise<void> {
  switch (getExplorerPathSourceKind(path)) {
    case "cloud":
      unwrapTauriResult(await commands.cloudDeletePath(path));
      return;
    case "remote":
      unwrapTauriResult(await commands.remoteDeletePath(path));
      return;
    case "local":
      unwrapTauriResult(await commands.fsDelete(path, recursive));
      return;
    default:
      throw new Error("Delete is only available for local, remote, or cloud items.");
  }
}

export async function deleteExplorerPaths(paths: string[]): Promise<void> {
  const kinds = new Set(paths.map((path) => getExplorerPathSourceKind(path)));
  if (kinds.size === 0) {
    return;
  }
  if (kinds.size > 1) {
    throw new Error(
      "Batch delete only supports items from a single source type at a time.",
    );
  }
  const [kind] = [...kinds];
  if (kind === "local") {
    unwrapTauriResult(await commands.fsDeleteMany(paths));
    return;
  }
  if (kind === "cloud") {
    await Promise.all(paths.map(async (path) => {
      unwrapTauriResult(await commands.cloudDeletePath(path));
    }));
    return;
  }
  if (kind === "remote") {
    await Promise.all(paths.map(async (path) => {
      unwrapTauriResult(await commands.remoteDeletePath(path));
    }));
    return;
  }
  throw new Error("Batch delete is only available for local, remote, or cloud items.");
}

export async function trashExplorerPaths(
  paths: string[],
): Promise<ExplorerTrashAction> {
  const localPaths = paths.filter(
    (path) => getExplorerPathSourceKind(path) === "local",
  );
  if (localPaths.length !== paths.length) {
    throw new Error("Trash is only available for local filesystem items.");
  }
  return unwrapTauriResult(await commands.fsTrash(localPaths));
}

export async function restoreExplorerTrashAction(): Promise<ExplorerTrashRestore | null> {
  return unwrapTauriResult(await commands.fsRestoreRecentTrashAction());
}

export async function batchRenameExplorerPaths(
  items: ExplorerBatchRenameItem[],
): Promise<ExplorerBatchRenameResult[]> {
  return unwrapTauriResult(await commands.fsBatchRename(items));
}

export async function previewBatchRenameExplorerPaths(
  recipe: ExplorerBatchRenameRecipeInput,
): Promise<ExplorerBatchRenamePreview[]> {
  if (
    recipe.sourcePaths.some(
      (path) => getExplorerPathSourceKind(path) !== "local",
    )
  ) {
    throw new Error(
      "Batch rename preview is only available for local filesystem items.",
    );
  }
  return unwrapTauriResult(await commands.fsBatchRenamePreview(recipe));
}

export async function applyBatchRenameExplorerRecipe(
  recipe: ExplorerBatchRenameRecipeInput,
): Promise<ExplorerBatchRenameResult[]> {
  if (
    recipe.sourcePaths.some(
      (path) => getExplorerPathSourceKind(path) !== "local",
    )
  ) {
    throw new Error(
      "Batch rename is only available for local filesystem items.",
    );
  }
  return unwrapTauriResult(await commands.fsBatchRenameApply(recipe));
}

export async function startExplorerDuplicateScan(
  rootPath: string,
): Promise<ExplorerDuplicateScanStart> {
  if (getExplorerPathSourceKind(rootPath) !== "local") {
    throw new Error(
      "Duplicate scanning is only available for local filesystem roots.",
    );
  }
  return unwrapTauriResult(await commands.fsFindDuplicatesStart(rootPath));
}

export async function pollExplorerDuplicateScan(
  scanId: string,
): Promise<ExplorerDuplicateScan> {
  return unwrapTauriResult(await commands.fsFindDuplicatesPoll(scanId));
}

export async function cancelExplorerDuplicateScan(
  scanId: string,
): Promise<void> {
  unwrapTauriResult(await commands.fsFindDuplicatesCancel(scanId));
}

export async function listExplorerTags(
  paths: string[] = [],
): Promise<ExplorerTagMetadataSnapshot> {
  return unwrapTauriResult(
    await commands.explorerTagsList(paths.length > 0 ? paths : null),
  );
}

export async function setExplorerTagsForPaths(
  request: ExplorerTagMutation,
): Promise<ExplorerTagMetadataSnapshot> {
  return unwrapTauriResult(await commands.explorerTagsSetForPaths(request));
}

export async function listExplorerSavedSearches(): Promise<
  ExplorerSavedSearch[]
> {
  return unwrapTauriResult(await commands.explorerSavedSearchesList());
}

export async function saveExplorerSavedSearch(
  request: ExplorerSavedSearchInput,
): Promise<ExplorerSavedSearch> {
  return unwrapTauriResult(await commands.explorerSavedSearchesSave(request));
}

export async function deleteExplorerSavedSearch(id: string): Promise<void> {
  unwrapTauriResult(await commands.explorerSavedSearchesDelete(id));
}

export async function getExplorerSemanticIndexSummary(
  rootPath: string,
): Promise<ExplorerSemanticIndexSummaryValue> {
  if (!getExplorerSourceCapabilitiesForPath(rootPath).supportsSemanticIndexing) {
    throw new Error(
      "Semantic indexing is only available for local filesystem roots.",
    );
  }
  return unwrapTauriResult(await commands.explorerSemanticIndexGetSummary(rootPath));
}

export async function buildExplorerSemanticIndex(
  request: ExplorerSemanticIndexBuildInput,
): Promise<ExplorerSemanticIndexBuildStart> {
  if (
    !getExplorerSourceCapabilitiesForPath(request.rootPath)
      .supportsSemanticIndexing
  ) {
    throw new Error(
      "Semantic indexing is only available for local filesystem roots.",
    );
  }
  return unwrapTauriResult(await commands.explorerSemanticIndexBuild(request));
}

export async function searchExplorerSemantic(
  request: ExplorerSemanticSearchInput,
): Promise<ExplorerSemanticSearchOutput> {
  if (
    !getExplorerSourceCapabilitiesForPath(request.rootPath)
      .supportsSemanticIndexing
  ) {
    throw new Error(
      "Semantic search is only available for local filesystem roots.",
    );
  }
  return unwrapTauriResult(await commands.explorerSemanticSearch(request));
}

export async function findSimilarExplorerSemantic(
  request: ExplorerSemanticFindSimilarInput,
): Promise<ExplorerSemanticSearchOutput> {
  if (
    !getExplorerSourceCapabilitiesForPath(request.rootPath)
      .supportsSemanticIndexing
  ) {
    throw new Error(
      "Semantic similarity search is only available for local filesystem roots.",
    );
  }
  return unwrapTauriResult(await commands.explorerSemanticFindSimilar(request));
}

export function supportsExplorerSearch(path: string): boolean {
  return getExplorerSourceCapabilitiesForPath(path).supportsSearch;
}

export function supportsExplorerNativeIntegration(path: string): boolean {
  return getExplorerSourceCapabilitiesForPath(path).supportsNativeIntegration;
}

export function supportsExplorerNativeDragOut(paths: string[]): boolean {
  return paths.every((path) => {
    if (isExplorerVirtualPath(path) && !isExplorerArchiveVirtualPath(path)) {
      return false;
    }
    return getExplorerSourceCapabilitiesForPath(path).supportsNativeDragOut;
  });
}

export async function listRemoteConnections(): Promise<
  ExplorerRemoteConnectionSummary[]
> {
  return unwrapTauriResult(await commands.remoteListConnections());
}

export async function upsertRemoteConnection(
  request: ExplorerRemoteConnectionInput,
): Promise<ExplorerRemoteConnectionSummary> {
  return unwrapTauriResult(await commands.remoteUpsertConnection(request));
}

export async function deleteRemoteConnection(connectionId: string): Promise<void> {
  unwrapTauriResult(await commands.remoteDeleteConnection(connectionId));
}

export async function connectRemoteConnection(
  connectionId: string,
): Promise<ExplorerRemoteConnectionSummary> {
  return unwrapTauriResult(await commands.remoteConnect(connectionId));
}

export async function disconnectRemoteConnection(
  connectionId: string,
): Promise<void> {
  unwrapTauriResult(await commands.remoteDisconnect(connectionId));
}

export async function listRemoteTrustedHosts(): Promise<
  ExplorerRemoteTrustedHostRecord[]
> {
  return unwrapTauriResult(await commands.remoteListTrustedHosts());
}

export async function trustRemotePendingHost(
  connectionId: string,
): Promise<ExplorerRemoteTrustedHostRecord> {
  return unwrapTauriResult(await commands.remoteTrustPendingHost(connectionId));
}

export async function removeRemoteTrustedHost(
  request: ExplorerRemoteTrustedHostRemovalInput,
): Promise<void> {
  unwrapTauriResult(await commands.remoteRemoveTrustedHost(request));
}

export async function listCloudAccounts(): Promise<ExplorerCloudAccountsSnapshot> {
  return unwrapTauriResult(await commands.cloudListAccounts());
}

export async function setCloudProviderConfiguration(
  provider: ExplorerCloudProviderId,
  clientId: string,
  clientSecret: string | null,
): Promise<ExplorerCloudProviderConfigurationStatus> {
  return unwrapTauriResult(
    await commands.cloudSetProviderConfiguration(
      provider,
      clientId,
      clientSecret,
    ),
  );
}

export async function clearCloudProviderConfiguration(
  provider: ExplorerCloudProviderId,
): Promise<ExplorerCloudProviderConfigurationStatus> {
  return unwrapTauriResult(
    await commands.cloudClearProviderConfiguration(provider),
  );
}

export async function beginCloudAuth(
  provider: ExplorerCloudProviderId,
): Promise<ExplorerCloudAuthSession> {
  return unwrapTauriResult(await commands.cloudBeginAuth(provider));
}

export async function pollCloudAuth(
  requestId: string,
): Promise<ExplorerCloudAuthStatus> {
  return unwrapTauriResult(await commands.cloudPollAuth(requestId));
}

export async function disconnectCloudAccount(accountId: string): Promise<void> {
  unwrapTauriResult(await commands.cloudDisconnectAccount(accountId));
}

export async function registerExplorerTerminalShellIntegration(
  request: ExplorerTerminalShellIntegrationInput,
): Promise<ExplorerTerminalShellIntegration> {
  return unwrapTauriResult(
    await commands.terminalRegisterShellIntegration(request),
  );
}

export async function syncExplorerTerminalCwd(
  id: string,
  cwd: string,
): Promise<ExplorerTerminalShellIntegration> {
  return unwrapTauriResult(await commands.terminalSyncCwd(id, cwd));
}

export async function setExplorerTerminalPromptState(
  id: string,
  atPrompt: boolean,
  reportedCwd: string | null = null,
): Promise<ExplorerTerminalShellIntegration> {
  return unwrapTauriResult(
    await commands.terminalSetPromptState(id, atPrompt, reportedCwd),
  );
}

export const explorerBackendContract: ExplorerBackendContract = {
  listDir: listExplorerDir,
  listDirUncached: listExplorerDirUncached,
  listArchiveDir: listExplorerArchiveDir,
  listLocation: listExplorerLocation,
  listLocationUncached: listExplorerLocationUncached,
  bootstrapPolicySession: bootstrapExplorerPolicySession,
  navigatePolicySession: navigateExplorerPolicySession,
  resolveEntryOpenWithPolicy: resolveExplorerEntryOpenWithPolicy,
  getDrives: getExplorerDrives,
  measureEntrySizes: measureExplorerEntrySizes,
  calculateRecursiveSizes: calculateExplorerRecursiveSizes,
  calculateChecksums: calculateExplorerChecksums,
  getItemProperties: getExplorerItemProperties,
  fuzzyFilterEntries: fuzzyFilterExplorerEntries,
  getRuntimeCachePolicy: getExplorerRuntimeCachePolicy,
  getHomeDir: getExplorerHomeDir,
  searchEntriesWithDiagnostics: searchExplorerEntriesWithDiagnostics,
  cancelSearchEntries: cancelExplorerSearchEntries,
  watchEntrySizeRoot: watchExplorerEntrySizeRoot,
  unwatchEntrySizeRoot: unwatchExplorerEntrySizeRoot,
  planItemTransfer: planExplorerItemTransfer,
  openPath: openExplorerPath,
  openArchive: openExplorerArchive,
  inspectArchive: inspectExplorerArchive,
  openWithDialog: openExplorerPathWithDialog,
  getAssociatedPrograms: getExplorerAssociatedPrograms,
  openPathWithProgram: openExplorerPathWithProgram,
  revealPath: revealExplorerPath,
  showPathProperties: showExplorerPathProperties,
  openPathAsAdmin: openExplorerPathAsAdmin,
  createDir: createExplorerDir,
  createFile: createExplorerFile,
  extractArchive: extractExplorerArchive,
  materializeArchiveEntry: materializeExplorerArchiveEntry,
  transferItems: transferExplorerItems,
  listTasks: listExplorerTasks,
  clearTaskHistory: clearExplorerTaskHistory,
  retryTask: retryExplorerTask,
  cancelTask: cancelExplorerTask,
  writeFile: writeExplorerFile,
  readTextFile: readExplorerTextFile,
  readFileBase64: readExplorerFileBase64,
  readPreviewBytes: readExplorerPreviewBytes,
  readImageThumbnail: readExplorerImageThumbnail,
  readEntryThumbnail: readExplorerEntryThumbnail,
  readEntryThumbnailArtifact: readExplorerThumbnailArtifact,
  renamePath: renameExplorerPath,
  deletePath: deleteExplorerPath,
  trashPaths: trashExplorerPaths,
  restoreRecentTrashAction: restoreExplorerTrashAction,
  batchRename: batchRenameExplorerPaths,
  previewBatchRename: previewBatchRenameExplorerPaths,
  applyBatchRenameRecipe: applyBatchRenameExplorerRecipe,
  startDuplicateScan: startExplorerDuplicateScan,
  pollDuplicateScan: pollExplorerDuplicateScan,
  cancelDuplicateScan: cancelExplorerDuplicateScan,
  listTags: listExplorerTags,
  setTagsForPaths: setExplorerTagsForPaths,
  listSavedSearches: listExplorerSavedSearches,
  saveSavedSearch: saveExplorerSavedSearch,
  deleteSavedSearch: deleteExplorerSavedSearch,
  getSemanticIndexSummary: getExplorerSemanticIndexSummary,
  buildSemanticIndex: buildExplorerSemanticIndex,
  searchSemantic: searchExplorerSemantic,
  findSemanticSimilar: findSimilarExplorerSemantic,
  isCloudPath: isCloudExplorerPath,
  isRemotePath: isRemoteExplorerPath,
  supportsSearch: supportsExplorerSearch,
  supportsNativeIntegration: supportsExplorerNativeIntegration,
  supportsNativeDragOut: supportsExplorerNativeDragOut,
  registerTerminalShellIntegration: registerExplorerTerminalShellIntegration,
  syncTerminalCwd: syncExplorerTerminalCwd,
  setTerminalPromptState: setExplorerTerminalPromptState,
};

export async function listenToExplorerTaskProgress(
  listener: (event: ExplorerTaskProgress) => void,
): Promise<() => void> {
  return events.explorerTaskProgressEvent.listen(
    (event: { payload: ExplorerTaskProgress }) => listener(event.payload),
  );
}

function getSchedulerTaskProgressPercent(
  task: ExplorerSchedulerTask,
): number | null {
  switch (task.prog.kind) {
    case "fileCopy":
    case "fileCut":
    case "fileDelete":
    case "fileDownload":
    case "fileUpload":
      return task.prog.totalBytes > 0
        ? Math.min(
            100,
            Math.round((task.prog.processedBytes / task.prog.totalBytes) * 100),
          )
        : task.prog.collected === true
          ? 100
          : task.prog.failedFiles > 0
            ? 0
            : null;
    case "fileHardlink":
      return task.prog.total > 0
        ? Math.min(100, Math.round((task.prog.success / task.prog.total) * 100))
        : task.prog.collected === true
          ? 100
          : task.prog.failed > 0
            ? 0
            : null;
    case "fileLink":
    case "fileTrash":
      return null;
    default:
      return null;
  }
}

function didSchedulerTaskFail(task: ExplorerSchedulerTask): boolean {
  switch (task.prog.kind) {
    case "fileCopy":
    case "fileCut":
    case "fileDelete":
    case "fileDownload":
    case "fileUpload":
      return task.prog.cleaned === false || task.prog.collected === false;
    case "fileHardlink":
      return task.prog.collected === false;
    case "fileLink":
      return task.prog.state === false;
    case "fileTrash":
      return task.prog.cleaned === false || task.prog.state === false;
    default:
      return false;
  }
}

function isSchedulerTaskFinished(task: ExplorerSchedulerTask): boolean {
  switch (task.prog.kind) {
    case "fileCopy":
    case "fileCut":
    case "fileDelete":
    case "fileDownload":
    case "fileUpload":
      return task.prog.cleaned !== null || task.prog.collected === false;
    case "fileHardlink":
      return task.prog.collected !== null;
    case "fileLink":
      return task.prog.state !== null;
    case "fileTrash":
      return task.prog.cleaned !== null || task.prog.state === false;
    default:
      return false;
  }
}

export function getExplorerTaskProgressPercent(
  task: ExplorerTaskSnapshot | ExplorerSchedulerTask,
): number | null {
  if ("status" in task) {
    if (
      typeof task.progressCurrent === "number" &&
      typeof task.progressTotal === "number" &&
      task.progressTotal > 0
    ) {
      return Math.min(
        100,
        Math.round((task.progressCurrent / task.progressTotal) * 100),
      );
    }
    if (task.schedulerTask) {
      return getSchedulerTaskProgressPercent(task.schedulerTask);
    }
    return null;
  }

  return getSchedulerTaskProgressPercent(task);
}

export function didExplorerTaskFail(
  task: ExplorerTaskSnapshot | ExplorerSchedulerTask,
): boolean {
  if ("status" in task) {
    return task.status === "failed";
  }

  return didSchedulerTaskFail(task);
}

export function isExplorerTaskFinished(
  task: ExplorerTaskSnapshot | ExplorerSchedulerTask,
): boolean {
  if ("status" in task) {
    return task.status !== "running";
  }

  return isSchedulerTaskFinished(task);
}

export function getExplorerTaskStatusLabel(
  task: ExplorerTaskSnapshot | ExplorerSchedulerTask,
): string {
  if ("status" in task) {
    if (task.status === "failed") {
      return "Failed";
    }
    if (task.status === "cancelled") {
      return "Cancelled";
    }
    const percent = getExplorerTaskProgressPercent(task);
    if (percent != null && task.status === "running") {
      return `${percent}%`;
    }
    return task.status === "succeeded" ? "Done" : "Working…";
  }

  if (didSchedulerTaskFail(task)) {
    return "Failed";
  }

  const percent = getSchedulerTaskProgressPercent(task);
  if (percent != null && !isSchedulerTaskFinished(task)) {
    return `${percent}%`;
  }

  return isSchedulerTaskFinished(task) ? "Done" : "Working…";
}
