import React from "react";
import {
  act,
  createEvent,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";

const {
  pdfPreviewMockState,
  previewContextMenuMockState,
  previewTerminalMockState,
  spreadsheetWorkbenchMockState,
  shaderWorkbenchMockState,
  explorerPolicyMockState,
} = vi.hoisted(() => ({
  pdfPreviewMockState: {
    closeGuardResult: true,
  },
  previewContextMenuMockState: {
    stopPropagationOnImageEditorContextMenu: false,
  },
  previewTerminalMockState: {
    mountCount: 0,
    reportedAlphaCwd: "C:\\workspace\\repo\\alpha",
    lastProps: null as null | {
      consumeExplorerCwdSync?: boolean;
      pendingCommandRequest?: {
        id: string;
        command: string;
        run: boolean;
      } | null;
      terminalIdNamespace?: string;
      workingDirectory?: string | null;
      onReportedWorkingDirectoryChange?: (cwd: string) => void;
    },
  },
  spreadsheetWorkbenchMockState: {
    lastMode: "preview" as "preview" | "edit",
  },
  shaderWorkbenchMockState: {
    lastSelectionLabel: "",
  },
  explorerPolicyMockState: {
    sessions: new Map<
      string,
      {
        currentPath: string;
        history: string[];
        historyIdx: number;
      }
    >(),
    resolveEntryOpenWithPolicyCalls: [] as Array<{
      entry: {
        path: string;
        is_dir: boolean;
        extension?: string;
      };
      previewEnabled: boolean;
    }>,
    returnNullHistoryOnNextNavigate: false,
  },
}));

vi.mock("@/components/AppIcons", async () =>
  vi.importActual<typeof import("lucide-react")>("lucide-react"),
);

vi.mock("../runtime/explorerBackend", async () => {
  const actual = await vi.importActual<typeof import("../runtime/explorerBackend")>(
    "../runtime/explorerBackend",
  );

  return {
    ...actual,
    explorerBackendContract: {
      ...actual.explorerBackendContract,
      bootstrapPolicySession: async (request: {
        sessionId: string;
        session: {
          currentPath: string;
          history: string[];
          historyIdx: number;
        };
      }) => {
        const snapshot = cloneMockExplorerPolicySessionSnapshot(request.session);
        explorerPolicyMockState.sessions.set(request.sessionId, snapshot);
        return { snapshot };
      },
      navigatePolicySession: async (request: {
        sessionId: string;
        path: string;
        pushHistory: boolean;
        historyIndex?: number | null;
        showHidden: boolean;
      }) => {
        const previous =
          explorerPolicyMockState.sessions.get(request.sessionId) ??
          createMockExplorerPolicySessionSnapshot(REPO_ROOT);
        const nextHistory = request.pushHistory
          ? [
              ...previous.history.slice(0, previous.historyIdx + 1),
              request.path,
            ]
          : [...previous.history];
        const nextHistoryIdx = request.pushHistory
          ? nextHistory.length - 1
          : request.historyIndex ?? previous.historyIdx;
        const snapshot = createMockExplorerPolicySessionSnapshot(
          request.path,
          nextHistory,
          nextHistoryIdx,
        );
        explorerPolicyMockState.sessions.set(request.sessionId, snapshot);
        const isHome = request.path === "greeblefs://home";
        const returnedSnapshot = explorerPolicyMockState.returnNullHistoryOnNextNavigate
          ? ({
              ...snapshot,
              history: null,
            } as unknown as typeof snapshot)
          : snapshot;
        explorerPolicyMockState.returnNullHistoryOnNextNavigate = false;
        return {
          snapshot: returnedSnapshot,
          listing: isHome
            ? null
            : await actual.explorerBackendContract.listLocation(
                request.path,
                request.showHidden,
              ),
          isHome,
          clearSelection: true,
        };
      },
      resolveEntryOpenWithPolicy: async (request: {
        entry: {
          path: string;
          is_dir: boolean;
          extension?: string;
        };
        previewEnabled: boolean;
      }) => {
        explorerPolicyMockState.resolveEntryOpenWithPolicyCalls.push(request);
        if (
          request.entry.is_dir ||
          isMockExplorerPolicyArchivePath(request.entry.path)
        ) {
          return {
            effect: "navigate" as const,
            targetPath: request.entry.path,
            clearSelection: true,
          };
        }

        if (
          request.previewEnabled &&
          shouldMockExplorerPolicyPreviewEntry(request.entry.extension)
        ) {
          return {
            effect: "preview" as const,
            targetPath: request.entry.path,
            clearSelection: false,
          };
        }

        return {
          effect: "openPath" as const,
          targetPath: request.entry.path,
          requiresArchiveMaterialize: false,
          clearSelection: false,
        };
      },
    },
  };
});

vi.mock("../components/ExplorerImageEditor", () => ({
  ExplorerImageEditor: ({
    imageName,
    mode = "edit",
    workflowTabId,
    onRegisterWorkflowTabs,
    onRegisterContextMenuRegistration,
  }: {
    imageName: string;
    mode?: "preview" | "edit";
    workflowTabId?: string | null;
    onRegisterWorkflowTabs?: (
      tabs: Array<{
        id: string;
        label: string;
        baseMode: "preview" | "edit";
      }> | null,
    ) => void;
    onRegisterContextMenuRegistration?: (
      registration:
        | {
            previewKind: string;
            baseActions: Array<{
              id: string;
              title: string;
              onSelect: () => void;
            }>;
            workflowOverlays?: Array<{
              workflowTabId: string;
              actions: Array<Record<string, unknown>>;
            }>;
          }
        | null,
    ) => void;
  }) => {
    React.useEffect(() => {
      onRegisterWorkflowTabs?.([
        {
          id: "cutout",
          label: "Cutout",
          baseMode: "edit",
        },
      ]);
      return () => onRegisterWorkflowTabs?.(null);
    }, [onRegisterWorkflowTabs]);

    React.useEffect(() => {
      onRegisterContextMenuRegistration?.({
        previewKind: "image",
        baseActions: [
          {
            id: "mock.image.base",
            title: "Image Menu Action",
            onSelect: () => {},
          },
          {
            id: "mock.image.auto-remove-background",
            title: "Auto Remove BG",
            onSelect: () => {},
          },
        ],
        workflowOverlays: [
          {
            workflowTabId: "cutout",
            actions: [
              {
                id: "mock.image.base",
                title: "Image Cutout Menu Action",
              },
              {
                id: "mock.image.cutout",
                title: "Cutout Menu Action",
                onSelect: () => {},
              },
              {
                id: "mock.image.tools.toggle",
                title: "Show Tool Rail",
                onSelect: () => {},
              },
            ],
          },
        ],
      });
      return () => onRegisterContextMenuRegistration?.(null);
    }, [onRegisterContextMenuRegistration]);

    return (
      <div
        data-testid="mock-explorer-image-editor"
        data-image-mode={mode}
        data-image-workflow-tab={workflowTabId ?? mode}
        onContextMenu={(event) => {
          if (!previewContextMenuMockState.stopPropagationOnImageEditorContextMenu) {
            return;
          }
          event.preventDefault();
          event.stopPropagation();
        }}
      >{`${imageName}:${workflowTabId ?? mode}`}</div>
    );
  },
}));

vi.mock("../components/ExplorerVideoEditor", () => ({
  ExplorerVideoEditor: ({
    videoName,
    mode = "edit",
  }: {
    videoName: string;
    mode?: "preview" | "edit";
  }) => (
    <div data-testid="mock-explorer-video-editor" data-video-mode={mode}>
      {`${videoName}:${mode}`}
    </div>
  ),
}));

vi.mock("../components/ExplorerAudioWorkbench", () => ({
  ExplorerAudioWorkbench: ({
    audioName,
    mode = "edit",
    workflowTabId,
    onRegisterWorkflowTabs,
  }: {
    audioName: string;
    mode?: "preview" | "edit";
    workflowTabId?: string;
    onRegisterWorkflowTabs?: (
      tabs: Array<{
        id: string;
        label: string;
        baseMode: "preview" | "edit";
      }> | null,
    ) => void;
  }) => {
    React.useEffect(() => {
      onRegisterWorkflowTabs?.([
        {
          id: "vst",
          label: "VST",
          baseMode: "edit",
        },
      ]);
      return () => onRegisterWorkflowTabs?.(null);
    }, [onRegisterWorkflowTabs]);

    return (
      <div
        data-testid="mock-explorer-audio-workbench"
        data-audio-mode={mode}
        data-audio-workflow-tab={workflowTabId ?? mode}
      >
        {`${audioName}:${workflowTabId ?? mode}`}
      </div>
    );
  },
}));

vi.mock("../components/ExplorerSpreadsheetWorkbench", () => ({
  ExplorerSpreadsheetWorkbench: ({
    name,
    mode = "preview",
  }: {
    name: string;
    mode?: "preview" | "edit";
  }) => {
    spreadsheetWorkbenchMockState.lastMode = mode;
    return (
      <div
        data-testid="mock-explorer-spreadsheet-workbench"
        data-spreadsheet-mode={mode}
      >
        {`${name}:${mode}`}
      </div>
    );
  },
}));

vi.mock("../components/ExplorerPdfWorkbench", () => ({
  ExplorerPdfWorkbench: ({
    document,
    onSaved,
    onChromeStateChange,
    onControllerChange,
    onRegisterCloseGuard,
  }: {
    document: { name: string; pageCount: number };
    onSaved?: () => Promise<void> | void;
    onChromeStateChange?: (state: {
      activePageIndex: number;
      pageCount: number;
      zoomScale: number;
      fitMode: "none" | "fitWidth" | "fitPage";
      isEditMode: boolean;
      isDirty: boolean;
      isSaving: boolean;
      error: string | null;
    }) => void;
    onControllerChange?: (
      controller: {
        goToPreviousPage: () => void;
        goToNextPage: () => void;
        goToPage: (pageIndex: number) => void;
        zoomIn: () => void;
        zoomOut: () => void;
        setFitMode: (mode: "none" | "fitWidth" | "fitPage") => void;
        toggleEditMode: () => void;
        save: () => Promise<boolean>;
      } | null,
    ) => void;
    onRegisterCloseGuard?: (guard: (() => Promise<boolean>) | null) => void;
  }) => {
    const controller = React.useMemo(
      () => ({
        goToPreviousPage: () => {},
        goToNextPage: () => {},
        goToPage: () => {},
        zoomIn: () => {},
        zoomOut: () => {},
        setFitMode: () => {},
        toggleEditMode: () => {},
        save: async () => {
          await onSaved?.();
          return true;
        },
      }),
      [onSaved],
    );

    React.useEffect(() => {
      onChromeStateChange?.({
        activePageIndex: 1,
        pageCount: document.pageCount,
        zoomScale: 1.25,
        fitMode: "fitWidth",
        isEditMode: true,
        isDirty: true,
        isSaving: false,
        error: null,
      });
      onControllerChange?.(controller);
      onRegisterCloseGuard?.(async () => pdfPreviewMockState.closeGuardResult);
      return () => {
        onControllerChange?.(null);
        onRegisterCloseGuard?.(null);
      };
    }, [
      controller,
      document.pageCount,
      onSaved,
      onChromeStateChange,
      onControllerChange,
      onRegisterCloseGuard,
    ]);

    return <div data-testid="mock-explorer-pdf-workbench">{document.name}</div>;
  },
}));

vi.mock("../components/ExplorerShaderWorkbench", () => ({
  ExplorerShaderWorkbench: ({
    path,
    name,
    format,
    selectedScene,
    selectedStage,
    selectedEntryPoint,
    isDirty,
    isSaving,
    isReadOnly,
    onSelectionChange,
    onSourceChange,
  }: {
    path: string;
    name: string;
    format: string;
    selectedScene: "sphere" | "fullscreen";
    selectedStage: "vertex" | "fragment" | "compute" | null;
    selectedEntryPoint: string | null;
    isDirty: boolean;
    isSaving: boolean;
    isReadOnly: boolean;
    onSelectionChange: (
      path: string,
      selection: {
        selectedStage?: "vertex" | "fragment" | "compute" | null;
        selectedEntryPoint?: string | null;
      },
    ) => void;
    onSourceChange: (path: string, value: string) => void;
  }) => {
    const selectionLabel = `${selectedStage ?? "none"}:${selectedEntryPoint ?? "none"}`;
    shaderWorkbenchMockState.lastSelectionLabel = selectionLabel;
    return (
      <div data-testid="mock-explorer-shader-workbench">
        <div>{name}</div>
        <div>{`${format}:${selectedScene}:${selectionLabel}`}</div>
        <div>
          {isReadOnly
            ? "readonly"
            : isDirty
              ? "dirty"
              : isSaving
                ? "saving"
                : "clean"}
        </div>
        <button
          type="button"
          onClick={() =>
            onSelectionChange(path, {
              selectedStage: "fragment",
              selectedEntryPoint: "shade",
            })
          }
        >
          Select Shader Fragment
        </button>
        <button
          type="button"
          onClick={() =>
            onSelectionChange(path, {
              selectedStage: "vertex",
              selectedEntryPoint: "shade_vs",
            })
          }
        >
          Select Shader Vertex
        </button>
        <button
          type="button"
          onClick={() => onSourceChange(path, "// dirty shader edit")}
        >
          Dirty Shader
        </button>
      </div>
    );
  },
}));

vi.mock("../components/TerminalOverlay", () => ({
  default: ({
    consumeExplorerCwdSync,
    pendingCommandRequest,
    onReportedWorkingDirectoryChange,
    terminalIdNamespace,
    workingDirectory,
  }: {
    consumeExplorerCwdSync?: boolean;
    pendingCommandRequest?: {
      id: string;
      command: string;
      run: boolean;
    } | null;
    onReportedWorkingDirectoryChange?: (cwd: string) => void;
    terminalIdNamespace?: string;
    workingDirectory?: string | null;
  }) => {
    React.useEffect(() => {
      previewTerminalMockState.mountCount += 1;
    }, []);

    previewTerminalMockState.lastProps = {
      consumeExplorerCwdSync,
      pendingCommandRequest,
      onReportedWorkingDirectoryChange,
      terminalIdNamespace,
      workingDirectory,
    };

    return (
      <div
        data-testid="mock-preview-terminal"
        data-terminal-namespace={terminalIdNamespace ?? ""}
        data-working-directory={workingDirectory ?? ""}
      >
        <div>{workingDirectory ?? "no-working-directory"}</div>
        <button
          type="button"
          onClick={() =>
            onReportedWorkingDirectoryChange?.(
              previewTerminalMockState.reportedAlphaCwd,
            )
          }
        >
          Report Alpha Cwd
        </button>
      </div>
    );
  },
}));

import {
  FileExplorer,
  invalidateExplorerResultCaches,
} from "../components/FileExplorer";
import type { LoadedExplorerAction } from "../config/actionPacks";
import type { OverlayPluginPreviewLaneContribution } from "../config/pluginContributions";
import { EXPLORER_CANONICAL_LAYOUT_ID } from "../config/explorerLayouts";
import { toExplorerActionChromeControlId } from "../config/explorerCustomizeCatalog";
import * as explorerThumbnailArtifactRuntime from "../runtime/explorerThumbnailArtifactRuntime";
import { EXPLORER_PREVIEW_WIDTH_BOUNDS } from "../config/explorerShellLayouts";
import {
  normalizeThemeDefinition,
  resolveOverlayAppearance,
} from "../config/appearance";
import { getBuiltInIconTheme, resolveFileIconSrc } from "../config/iconTheme";
import { createDefaultExplorerRailSnapshot } from "../components/explorer/explorerRailState";
import {
  EXPLORER_LEGACY_BOOKMARKS_KEY,
  EXPLORER_STATE_BACKUP_KEY,
  EXPLORER_STATE_STORAGE_KEY,
} from "../store/explorerStore";
import { useSettingsStore } from "../store/settingsStore";
import { useExplorerStore } from "../store/explorerStore";

const SETTINGS_STORAGE_KEY = "ultacode-settings";
const REPO_ROOT = "C:\\workspace\\repo";
const EMPTY_TAG_SNAPSHOT = { tags: [], assignments: [] };
const ENTRIES = [
  {
    name: "alpha",
    path: `${REPO_ROOT}\\alpha`,
    is_dir: true,
    size: 0,
    modified: 0,
    extension: "",
    is_hidden: false,
    is_symlink: false,
  },
  {
    name: "notes.txt",
    path: `${REPO_ROOT}\\notes.txt`,
    is_dir: false,
    size: 128,
    modified: 0,
    extension: "txt",
    is_hidden: false,
    is_symlink: false,
  },
  {
    name: "runner.py",
    path: `${REPO_ROOT}\\runner.py`,
    is_dir: false,
    size: 144,
    modified: 0,
    extension: "py",
    is_hidden: false,
    is_symlink: false,
  },
  {
    name: "build.bat",
    path: `${REPO_ROOT}\\build.bat`,
    is_dir: false,
    size: 96,
    modified: 0,
    extension: "bat",
    is_hidden: false,
    is_symlink: false,
  },
  {
    name: "index.html",
    path: `${REPO_ROOT}\\index.html`,
    is_dir: false,
    size: 256,
    modified: 0,
    extension: "html",
    is_hidden: false,
    is_symlink: false,
  },
  {
    name: "preview.png",
    path: `${REPO_ROOT}\\preview.png`,
    is_dir: false,
    size: 4096,
    modified: 0,
    extension: "png",
    is_hidden: false,
    is_symlink: false,
  },
  {
    name: "anthem.mp3",
    path: `${REPO_ROOT}\\anthem.mp3`,
    is_dir: false,
    size: 6 * 1024 * 1024,
    modified: 0,
    extension: "mp3",
    is_hidden: false,
    is_symlink: false,
  },
  {
    name: "trailer.mp4",
    path: `${REPO_ROOT}\\trailer.mp4`,
    is_dir: false,
    size: 48 * 1024 * 1024,
    modified: 0,
    extension: "mp4",
    is_hidden: false,
    is_symlink: false,
  },
  {
    name: "large.txt",
    path: `${REPO_ROOT}\\large.txt`,
    is_dir: false,
    size: 24 * 1024 * 1024,
    modified: 0,
    extension: "txt",
    is_hidden: false,
    is_symlink: false,
  },
  {
    name: "broken.png",
    path: `${REPO_ROOT}\\broken.png`,
    is_dir: false,
    size: 2048,
    modified: 0,
    extension: "png",
    is_hidden: false,
    is_symlink: false,
  },
  {
    name: "mystery.bin",
    path: `${REPO_ROOT}\\mystery.bin`,
    is_dir: false,
    size: 3 * 1024 * 1024,
    modified: 0,
    extension: "bin",
    is_hidden: false,
    is_symlink: false,
  },
  {
    name: "aaa_surface.wgsl",
    path: `${REPO_ROOT}\\aaa_surface.wgsl`,
    is_dir: false,
    size: 512,
    modified: 0,
    extension: "wgsl",
    is_hidden: false,
    is_symlink: false,
  },
  {
    name: "aab_lighting.hlsl",
    path: `${REPO_ROOT}\\aab_lighting.hlsl`,
    is_dir: false,
    size: 1024,
    modified: 0,
    extension: "hlsl",
    is_hidden: false,
    is_symlink: false,
  },
] as const;

const sampleExplorerAction: LoadedExplorerAction = {
  id: "workspace.sample-action",
  actionId: "sample-action",
  packId: "workspace-pack",
  packName: "Workspace Pack",
  version: 1,
  title: "Sample Workspace Action",
  description: "A sample action for customize drag tests.",
  tags: [],
  directoryPath: "/actions/workspace-pack/sample-action",
  manifestPath: "/actions/workspace-pack/sample-action/action.json",
  sourceKind: "action-pack-directory",
  sourceLabel: "Actions",
  sourceBadgeLabel: "ACTION",
  contexts: ["background", "entry", "multi-select"],
  appliesTo: "any",
  selection: {
    minCount: 0,
    allowFiles: true,
    allowDirectories: true,
    extensions: [],
  },
  execution: {
    runner: "shell",
    entry: "echo",
    args: ["hello"],
    env: {},
  },
  presentation: {
    outputTarget: "silent",
  },
  warnings: [],
};

function cloneMockExplorerPolicySessionSnapshot(snapshot: {
  currentPath: string;
  history: string[];
  historyIdx: number;
}) {
  return {
    currentPath: snapshot.currentPath,
    history: [...snapshot.history],
    historyIdx: snapshot.historyIdx,
  };
}

function createMockExplorerPolicySessionSnapshot(
  currentPath: string,
  history: string[] = [currentPath],
  historyIdx: number = Math.max(history.length - 1, 0),
) {
  return cloneMockExplorerPolicySessionSnapshot({
    currentPath,
    history,
    historyIdx,
  });
}

function isMockExplorerPolicyArchivePath(path: string) {
  return /\.(zip|rar|7z|tar|gz|tgz|bz2|xz)$/i.test(path);
}

function shouldMockExplorerPolicyPreviewEntry(extension: string | undefined) {
  if (!extension) {
    return false;
  }
  return !/^(exe|bat|cmd|ps1|sh|appimage)$/i.test(extension);
}

function getMockEntryThumbnailKind(
  path: string | undefined,
): "image" | "code" | "shader" | "audio" | "video" {
  const extension = path?.split(".").pop()?.toLowerCase();
  switch (extension) {
    case "png":
      return "image";
    case "mp3":
      return "audio";
    case "mp4":
      return "video";
    case "wgsl":
    case "hlsl":
    case "spv":
      return "shader";
    default:
      return "code";
  }
}

function createMockEntryThumbnail(path: string | undefined) {
  return {
    kind: getMockEntryThumbnailKind(path),
    posterDataUrl: "data:image/png;base64,ZmFrZQ==",
    hoverFrames: [],
    hoverFrameDelayMs: null,
  };
}

function createMockEntryThumbnailArtifact(path: string | undefined) {
  const normalizedPathSegment = (path ?? "thumbnail")
    .replace(/\\/g, "/")
    .split("/")
    .filter(Boolean)
    .pop()
    ?.replace(/[^a-zA-Z0-9._-]+/g, "-")
    ?? "thumbnail";
  const descriptor = {
    id: `artifact-${normalizedPathSegment}`,
    kind: "thumbnail.poster",
    filePath: `/tmp/${normalizedPathSegment}.png`,
    mediaType: "image/png",
    byteLength: 7,
    retention: "persistent" as const,
    identityKey: normalizedPathSegment,
    contentRevision: "rev-1",
  };
  return {
    entityId: normalizedPathSegment,
    contentRevision: "rev-1",
    kind: getMockEntryThumbnailKind(path),
    poster: descriptor,
    hoverFrames: [],
    hoverFrameDelayMs: null,
  };
}

function createDataTransfer() {
  const store = new Map<string, string>();
  return {
    dropEffect: "move",
    effectAllowed: "all",
    files: [],
    items: [],
    types: [],
    clearData: vi.fn((format?: string) => {
      if (format) {
        store.delete(format);
        return;
      }
      store.clear();
    }),
    getData: vi.fn((format: string) => store.get(format) ?? ""),
    setData: vi.fn((format: string, value: string) => {
      store.set(format, value);
    }),
    setDragImage: vi.fn(),
  };
}

function startExplorerPointerDrag(
  dragSource: HTMLElement,
  options?: {
    pointerId?: number;
    startX?: number;
    startY?: number;
    endX?: number;
    endY?: number;
    altKey?: boolean;
    ctrlKey?: boolean;
  },
) {
  const pointerId = options?.pointerId ?? 1;
  const startX = options?.startX ?? 24;
  const startY = options?.startY ?? 24;
  const endX = options?.endX ?? startX + 18;
  const endY = options?.endY ?? startY + 18;

  fireEvent.pointerDown(dragSource, {
    pointerId,
    button: 0,
    clientX: startX,
    clientY: startY,
    altKey: options?.altKey,
    ctrlKey: options?.ctrlKey,
  });
  fireEvent.pointerMove(window, {
    pointerId,
    clientX: endX,
    clientY: endY,
    altKey: options?.altKey,
    ctrlKey: options?.ctrlKey,
  });

  return {
    pointerId,
    endX,
    endY,
  };
}

function finishExplorerPointerDrag(args: {
  pointerId?: number;
  endX?: number;
  endY?: number;
  altKey?: boolean;
  ctrlKey?: boolean;
}) {
  fireEvent.pointerUp(window, {
    pointerId: args.pointerId ?? 1,
    clientX: args.endX ?? 42,
    clientY: args.endY ?? 42,
    altKey: args.altKey,
    ctrlKey: args.ctrlKey,
  });
}

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });

  return {
    promise,
    resolve,
    reject,
  };
}

function resetOverlayTermStorage(storage: Storage) {
  storage.removeItem(SETTINGS_STORAGE_KEY);
  storage.removeItem(EXPLORER_STATE_STORAGE_KEY);
  storage.removeItem(EXPLORER_STATE_BACKUP_KEY);
  storage.removeItem(EXPLORER_LEGACY_BOOKMARKS_KEY);
}

function renderExplorer(
  options: {
    actions?: LoadedExplorerAction[];
    appearance?: ReturnType<typeof resolveOverlayAppearance>;
    chromeControlSurface?: "toolbar" | "topbar";
    layoutMode?: "full" | "dock";
    pluginPreviewLanes?: OverlayPluginPreviewLaneContribution[];
    workspacePaneCount?: 1 | 2 | 3 | 4;
  } = {},
) {
  const appearance =
    options.appearance ??
    resolveOverlayAppearance({ activeThemeId: "operator" });
  return {
    appearance,
    ...render(
      <FileExplorer
        theme={{
          accent: appearance.theme.palette.accent,
          bg: appearance.theme.palette.appBackground,
          bgPanel: appearance.theme.palette.panelBackground,
          text: appearance.theme.palette.textPrimary,
          border: appearance.theme.palette.border,
          textMuted: appearance.theme.palette.textMuted,
        }}
        appearance={appearance}
        actions={options.actions}
        chromeControlSurface={options.chromeControlSurface}
        layoutMode={options.layoutMode}
        pluginPreviewLanes={options.pluginPreviewLanes}
        workspacePaneCount={options.workspacePaneCount}
        onOpenInTerminal={() => {}}
        onAddBookmark={async () => {}}
      />,
    ),
  };
}

function getActiveWorkspaceLayoutMode() {
  const { workspace } = useExplorerStore.getState();
  return workspace.tabs.find((tab) => tab.id === workspace.activeWorkspaceTabId)?.layoutMode
    ?? workspace.tabs[0]?.layoutMode
    ?? "single";
}

function getChromeControl(controlId: string) {
  return document.querySelector(
    `[data-overlay-explorer-control="${controlId}"]`,
  ) as HTMLElement | null;
}

function getChromeControlButtonLabels(controlId: string): string[] {
  const control = getChromeControl(controlId);
  if (!control) {
    throw new Error(`${controlId} control not found`);
  }
  return within(control)
    .getAllByRole("button")
    .map((button) => button.textContent?.replace(/\s+/g, " ").trim() ?? "");
}

function expectChromeControlButtonOrder(
  controlId: string,
  orderedLabels: readonly string[],
) {
  const labels = getChromeControlButtonLabels(controlId);
  let previousIndex = -1;
  for (const label of orderedLabels) {
    const nextIndex = labels.indexOf(label);
    expect(
      nextIndex,
      `Expected ${controlId} to contain ${label}. Buttons: ${labels.join(" | ")}`,
    ).toBeGreaterThan(-1);
    expect(
      nextIndex,
      `Expected ${controlId} order ${orderedLabels.join(" -> ")}. Buttons: ${labels.join(" | ")}`,
    ).toBeGreaterThan(previousIndex);
    previousIndex = nextIndex;
  }
}

function getExplorerViewport(anchorText: string) {
  const anchor = screen.getByText(anchorText);
  const viewport = anchor.closest(".overlay-scroll-area__content")
    ?.parentElement as HTMLElement | null;
  if (!viewport) {
    throw new Error("Explorer viewport not found");
  }
  return viewport;
}

function getPreviewPane() {
  const previewPane = document.querySelector(
    '[data-overlay-explorer-plane="preview"]',
  ) as HTMLElement | null;
  if (!previewPane) {
    throw new Error("Explorer preview pane not found");
  }
  return previewPane;
}

function queryPreviewPane() {
  return document.querySelector(
    '[data-overlay-explorer-plane="preview"]',
  ) as HTMLElement | null;
}

function getPreviewSplitToggleButton() {
  const control = getChromeControl("previewSplitToggle");
  if (!control) {
    throw new Error("Preview split toggle control not found");
  }
  return within(control).getByRole("button");
}

function getPreviewLockButton() {
  const control = getChromeControl("previewLockToggle");
  if (!control) {
    throw new Error("Preview lock toggle control not found");
  }
  return within(control).getByRole("button");
}

function getPreviewTerminalToggleButton() {
  const control = getChromeControl("previewTerminalToggle");
  if (!control) {
    throw new Error("Preview terminal toggle control not found");
  }
  return within(control).getByRole("button", {
    name: "Toggle preview terminal",
  });
}

function getBottomTerminalToggleButton() {
  const control = getChromeControl("terminalDrawerToggle");
  if (!control) {
    throw new Error("Bottom terminal toggle control not found");
  }
  return within(control).getByRole("button", {
    name: "Toggle bottom terminal drawer",
  });
}

function queryExplorerEmbeddedTerminalLayer() {
  return document.querySelector(
    '[data-overlay-explorer-plane="embedded-terminal"]',
  ) as HTMLElement | null;
}

function getExplorerEmbeddedTerminalLayer() {
  const layer = queryExplorerEmbeddedTerminalLayer();
  if (!layer) {
    throw new Error("Explorer embedded terminal layer not found");
  }
  return layer;
}

function getExplorerContentViewport() {
  const viewport = document.querySelector(
    '[data-overlay-explorer-plane="content-viewport"]',
  ) as HTMLElement | null;
  if (!viewport) {
    throw new Error("Explorer content viewport not found");
  }
  return viewport;
}

function getExplorerContentViewportCssNumber(name: string): number {
  const value = getExplorerContentViewport().style.getPropertyValue(name).trim();
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Explorer content viewport CSS variable ${name} was not numeric: ${value}`);
  }
  return parsed;
}

function getExplorerContentViewportGridIconBand(): string | undefined {
  return getExplorerContentViewport().dataset.overlayExplorerLiveGridIconBand;
}

function queryExplorerActionsPane() {
  return document.querySelector(
    '[data-overlay-explorer-plane="actions"]',
  ) as HTMLElement | null;
}

function getExplorerActionsPane() {
  const pane = queryExplorerActionsPane();
  if (!pane) {
    throw new Error("Explorer actions pane not found");
  }
  return pane;
}

async function openExplorerLayoutSwitcherCommand() {
  act(() => {
    window.dispatchEvent(
      new CustomEvent("greeblefs:open-explorer-layout-switcher"),
    );
  });
  return screen.findByRole("dialog", { name: /explorer layout switcher/i });
}

async function openExplorerCustomizeCommand() {
  act(() => {
    window.dispatchEvent(
      new CustomEvent("greeblefs:open-explorer-customize"),
    );
  });
  await waitFor(() => {
    expect(useExplorerStore.getState().chromeEditSession).not.toBeNull();
    expect(queryExplorerActionsPane()).not.toBeNull();
  });
}

function mockElementRect(
  element: Element | null | undefined,
  rect: Pick<DOMRect, "left" | "top" | "width" | "height">,
) {
  if (!(element instanceof HTMLElement)) {
    throw new Error("Expected element for rect mock");
  }
  const resolvedRect = {
    x: rect.left,
    y: rect.top,
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height,
    right: rect.left + rect.width,
    bottom: rect.top + rect.height,
    toJSON: () => ({}),
  } as DOMRect;
  Object.defineProperty(element, "getBoundingClientRect", {
    configurable: true,
    value: () => resolvedRect,
  });
}

function getPreviewCloseButton() {
  const control = getChromeControl("previewClose");
  if (!control) {
    throw new Error("Preview close control not found");
  }
  return within(control).getByRole("button");
}

function getToolbarPreviewToggleButton() {
  const control = getChromeControl("togglePreview");
  if (!control) {
    throw new Error("Toolbar preview toggle control not found");
  }
  return within(control).getByRole("button");
}

function getPreviewResizeHandle() {
  const handle = getPreviewPane().querySelector(
    '[data-overlay-explorer-preview-resize-handle="true"]',
  ) as HTMLElement | null;
  if (!handle) {
    throw new Error("Preview resize handle not found");
  }
  return handle;
}

function dispatchLayoutWheel(anchorText: string, deltaY: number) {
  const viewport = getExplorerViewport(anchorText);
  const wheelEvent = new WheelEvent("wheel", {
    bubbles: true,
    cancelable: true,
    ctrlKey: true,
    deltaY,
  });
  viewport.dispatchEvent(wheelEvent);
  return wheelEvent;
}

function dispatchLayoutWheelOnElement(element: Element, deltaY: number) {
  const wheelEvent = new WheelEvent("wheel", {
    bubbles: true,
    cancelable: true,
    ctrlKey: true,
    deltaY,
  });
  element.dispatchEvent(wheelEvent);
  return wheelEvent;
}

function dispatchLayoutWheelOnFileArea(deltaY: number) {
  const fileArea = document.querySelector(
    '[data-overlay-explorer-plane="file-area"]',
  ) as HTMLElement | null;
  if (!fileArea) {
    throw new Error("Explorer file area not found");
  }
  const wheelEvent = new WheelEvent("wheel", {
    bubbles: true,
    cancelable: true,
    ctrlKey: true,
    deltaY,
  });
  fileArea.dispatchEvent(wheelEvent);
  return wheelEvent;
}

function dispatchConstellationWheel(
  deltaY: number,
  options: Partial<WheelEventInit> = {},
) {
  const field = screen.getByRole("group", {
    name: /constellation field/i,
  });
  const wheelEvent = createEvent.wheel(field, {
    bubbles: true,
    cancelable: true,
    clientX: 320,
    clientY: 220,
    deltaY,
    ...options,
  });
  fireEvent(field, wheelEvent);
  return wheelEvent;
}

async function advanceLayoutZoomCommit() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(220);
  });
}

function getExplorerThumbnailReadCount() {
  return vi
    .mocked(invoke)
    .mock.calls.filter(
      ([command]) =>
        command === "fs_read_entry_thumbnail_artifact" ||
        command === "fs_read_entry_thumbnail" ||
        command === "fs_read_image_thumbnail",
    ).length;
}

function getEntryIconSrc(entryName: string): string {
  const entryLabel = screen
    .getAllByText(entryName)
    .find((candidate) =>
      candidate.closest('[data-overlay-explorer-plane="file-area"]'),
    );
  if (!entryLabel) {
    throw new Error(`Explorer label not found for ${entryName}`);
  }
  const entryRow = entryLabel.closest(
    '[data-entry-path], tr, [draggable="true"]',
  ) as HTMLElement | null;
  if (!entryRow) {
    throw new Error(`Explorer row not found for ${entryName}`);
  }

  const icon = entryRow.querySelector("img");
  if (!(icon instanceof HTMLImageElement)) {
    throw new Error(`Explorer icon not found for ${entryName}`);
  }

  return icon.getAttribute("src") ?? "";
}

function getEntryThumbnailBadgeSrc(entryName: string): string {
  const entryLabel = screen
    .getAllByText(entryName)
    .find((candidate) =>
      candidate.closest('[data-overlay-explorer-plane="file-area"]'),
    );
  if (!entryLabel) {
    throw new Error(`Explorer label not found for ${entryName}`);
  }
  const entryRow = entryLabel.closest(
    '[data-entry-path], tr, [draggable="true"]',
  ) as HTMLElement | null;
  if (!entryRow) {
    throw new Error(`Explorer row not found for ${entryName}`);
  }

  const badgeIcon = entryRow.querySelector(
    '[data-overlay-explorer-thumbnail-badge="true"] img',
  );
  if (!(badgeIcon instanceof HTMLImageElement)) {
    throw new Error(`Explorer thumbnail badge not found for ${entryName}`);
  }

  return badgeIcon.getAttribute("src") ?? "";
}

describe("FileExplorer view modes", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  beforeEach(() => {
    const currentWindow = getCurrentWindow();
    pdfPreviewMockState.closeGuardResult = true;
    previewContextMenuMockState.stopPropagationOnImageEditorContextMenu = false;
    previewTerminalMockState.mountCount = 0;
    previewTerminalMockState.lastProps = null;
    spreadsheetWorkbenchMockState.lastMode = "preview";
    shaderWorkbenchMockState.lastSelectionLabel = "";
    explorerPolicyMockState.sessions.clear();
    explorerPolicyMockState.resolveEntryOpenWithPolicyCalls = [];
    explorerPolicyMockState.returnNullHistoryOnNextNavigate = false;
    vi.mocked(currentWindow.onDragDropEvent).mockClear();
    vi.mocked(currentWindow.scaleFactor).mockClear();
    resetOverlayTermStorage(window.localStorage);
    useSettingsStore.getState().resetToDefaults();
    useSettingsStore.getState().updateExplorer({ defaultPath: REPO_ROOT });
    useExplorerStore.getState().closeChromeEditSession();
    useExplorerStore.getState().setChromeHotkeyCaptureControl(null);
    useExplorerStore.getState().resetSession();
    useExplorerStore.getState().setPropertiesPanel(null);
    useExplorerStore
      .getState()
      .replaceRail(createDefaultExplorerRailSnapshot());
    useExplorerStore.getState().clearPersistenceNotice();
    invalidateExplorerResultCaches();
    explorerThumbnailArtifactRuntime.invalidateExplorerThumbnailArtifactRuntimeCache();

    vi.mocked(invoke).mockReset();
    vi.mocked(invoke).mockImplementation(
      async (command: string, args?: unknown) => {
        const payload = args as
          | {
              path?: string;
              paths?: string[];
              request?: {
                path?: string;
                maxWidth?: number;
                maxHeight?: number;
                includeVideoHoverScrub?: boolean | null;
                videoHoverFrameCount?: number | null;
                format?: "wgsl" | "hlsl" | "spv";
                sourceText?: string | null;
                selectedStage?: "vertex" | "fragment" | "compute" | null;
                selectedEntryPoint?: string | null;
              };
              targetDir?: string;
              sources?: string[];
              operation?: "copy" | "move";
              collisionPolicy?: "keep_both" | "replace" | "skip";
            }
          | undefined;
        switch (command) {
          case "fs_get_drives":
            return [];
          case "fs_get_home_dir":
            return REPO_ROOT;
          case "fs_is_process_elevated":
            return false;
          case "fs_get_runtime_cache_policy":
            return {
              dirListCacheTtlMs: 2000,
              searchNameIndexCacheTtlMs: 1500,
              searchContentIndexCacheTtlMs: 1000,
              entrySizeCacheTtlMs: 10000,
              entrySizeScanBudgetMs: 900,
              searchContentIndexTotalBytesBudget: 12 * 1024 * 1024,
              maxSearchContentFileBytes: 8 * 1024 * 1024,
              searchMaxIndexedEntries: 25000,
            };
          case "fs_list_dir":
          case "fs_list_dir_uncached":
            return ENTRIES;
          case "fs_read_text_file":
            if (payload?.path === `${REPO_ROOT}\\large.txt`) {
              throw new Error("File is too large to preview (> 10 MB)");
            }
            if (payload?.path === `${REPO_ROOT}\\index.html`) {
              return "<html><body><h1>hello from html preview</h1></body></html>";
            }
            if (payload?.path === `${REPO_ROOT}\\runner.py`) {
              return 'print("hello from python preview")';
            }
            return "hello from preview";
          case "fs_write_file":
            return null;
          case "fs_read_file_base64":
            if (payload?.path === `${REPO_ROOT}\\broken.png`) {
              throw new Error("File is too large to preview (> 12 MB)");
            }
            return "data:text/plain;base64,aGVsbG8=";
          case "fs_read_image_thumbnail":
            if (payload?.path === `${REPO_ROOT}\\broken.png`) {
              throw new Error("Image is too large to thumbnail (> 64 MB)");
            }
            return "data:image/png;base64,ZmFrZQ==";
          case "pdf_open_preview_document":
            return {
              sessionId: "pdf-session-1",
              path: `${REPO_ROOT}\\\\forms.pdf`,
              name: "forms.pdf",
              pageCount: 2,
              pages: [
                { pageIndex: 0, widthPoints: 612, heightPoints: 792 },
                { pageIndex: 1, widthPoints: 612, heightPoints: 792 },
              ],
              formFields: [],
            };
          case "pdf_close_preview_document":
            return null;
          case "fs_read_entry_thumbnail":
            if (payload?.request?.path === `${REPO_ROOT}\\broken.png`) {
              throw new Error("Image is too large to thumbnail (> 64 MB)");
            }
            return createMockEntryThumbnail(payload?.request?.path);
          case "fs_read_entry_thumbnail_artifact":
            if (payload?.request?.path === `${REPO_ROOT}\\broken.png`) {
              throw new Error("Image is too large to thumbnail (> 64 MB)");
            }
            return createMockEntryThumbnailArtifact(payload?.request?.path);
          case "shader_preview_inspect":
            if (payload?.path === `${REPO_ROOT}\\aaa_surface.wgsl`) {
              return {
                path: `${REPO_ROOT}\\aaa_surface.wgsl`,
                name: "aaa_surface.wgsl",
                format: "wgsl",
                editableSource:
                  "@vertex fn shade_vs() -> @builtin(position) vec4<f32> { return vec4<f32>(0.0, 0.0, 0.0, 1.0); }",
                inspectionSource:
                  "@vertex fn shade_vs() -> @builtin(position) vec4<f32> { return vec4<f32>(0.0, 0.0, 0.0, 1.0); }",
                isReadOnly: false,
                selectedStage: "vertex",
                selectedEntryPoint: "shade_vs",
                entryPoints: [
                  {
                    name: "shade_vs",
                    stage: "vertex",
                    supportsLivePreview: true,
                  },
                  {
                    name: "shade",
                    stage: "fragment",
                    supportsLivePreview: true,
                  },
                ],
                diagnostics: [],
                normalizedWgsl:
                  "@fragment fn shade() -> @location(0) vec4<f32> { return vec4<f32>(1.0); }",
                supportsLivePreview: true,
                previewAbi: "GreebleFS Shader Preview ABI v1",
              };
            }
            if (payload?.path === `${REPO_ROOT}\\aab_lighting.hlsl`) {
              return {
                path: `${REPO_ROOT}\\aab_lighting.hlsl`,
                name: "aab_lighting.hlsl",
                format: "hlsl",
                editableSource:
                  '[shader("fragment")] float4 shade() : SV_Target { return float4(1,1,1,1); }',
                inspectionSource:
                  '[shader("fragment")] float4 shade() : SV_Target { return float4(1,1,1,1); }',
                isReadOnly: false,
                selectedStage: "fragment",
                selectedEntryPoint: "shade",
                entryPoints: [
                  {
                    name: "shade",
                    stage: "fragment",
                    supportsLivePreview: true,
                  },
                ],
                diagnostics: [],
                normalizedWgsl:
                  "@fragment fn shade() -> @location(0) vec4<f32> { return vec4<f32>(1.0); }",
                supportsLivePreview: true,
                previewAbi: "GreebleFS Shader Preview ABI v1",
              };
            }
            throw new Error(
              `Unexpected shader preview inspect path: ${payload?.path}`,
            );
          case "shader_preview_compile":
            return {
              format: payload?.request?.format ?? "wgsl",
              inspectionSource: payload?.request?.sourceText ?? "",
              entryPoints:
                payload?.request?.path === `${REPO_ROOT}\\aaa_surface.wgsl`
                  ? [
                      {
                        name: "shade_vs",
                        stage: "vertex",
                        supportsLivePreview: true,
                      },
                      {
                        name: "shade",
                        stage: "fragment",
                        supportsLivePreview: true,
                      },
                    ]
                  : [
                      {
                        name: "shade",
                        stage: "fragment",
                        supportsLivePreview: true,
                      },
                    ],
              selectedStage: payload?.request?.selectedStage ?? "fragment",
              selectedEntryPoint:
                payload?.request?.selectedEntryPoint ?? "shade",
              diagnostics: [],
              normalizedWgsl:
                "@fragment fn shade() -> @location(0) vec4<f32> { return vec4<f32>(1.0); }",
              supportsLivePreview: true,
              previewAbi: "GreebleFS Shader Preview ABI v1",
            };
          case "explorer_tags_list":
            return EMPTY_TAG_SNAPSHOT;
          case "explorer_tags_set_for_paths":
            return EMPTY_TAG_SNAPSHOT;
          case "fs_measure_entry_sizes":
            return (payload?.paths ?? []).map((path) => ({
              path,
              bytes: ENTRIES.find((entry) => entry.path === path)?.size ?? 0,
              is_dir:
                ENTRIES.find((entry) => entry.path === path)?.is_dir ?? false,
              is_complete: true,
            }));
          case "fs_resolve_native_icons":
            return [];
          case "fs_search_entries_with_diagnostics":
            return {
              results: [],
              diagnostics: {
                executionStrategy: "live_scan",
                contentCacheStatus: "not_requested",
                scannedEntryCount: 0,
                indexedEntryCount: 0,
                contentCacheStoredFileCount: 0,
                contentCacheStoredByteCount: 0,
                truncatedByScanBudget: false,
              },
            };
          case "fs_plan_transfer_items":
            return [];
          case "fs_transfer_items":
            return (payload?.sources ?? []).map((sourcePath) => ({
              source_path: sourcePath,
              destination_path: `${payload?.targetDir ?? REPO_ROOT}\\${sourcePath.split("\\").pop() ?? "item"}`,
              operation: payload?.operation ?? "copy",
              collision_policy: payload?.collisionPolicy ?? "keep_both",
              disposition: "transferred",
            }));
          case "fs_watch_entry_size_root":
          case "fs_unwatch_entry_size_root":
          case "fs_cancel_search_entries":
          case "fs_start_native_file_drag":
            return null;
          case "python_get_runtime_status":
            return {
              runtimeRoot: `${REPO_ROOT}\\.greeblefs-python`,
              envDir: `${REPO_ROOT}\\.greeblefs-python\\env`,
              scriptsDir: `${REPO_ROOT}\\.greeblefs-python\\scripts`,
              tempDir: `${REPO_ROOT}\\.greeblefs-python\\temp`,
              logsDir: `${REPO_ROOT}\\.greeblefs-python\\logs`,
              managedPythonPath:
                "C:\\Python Runtime\\env\\Scripts\\python.exe",
              envExists: true,
              ready: true,
              managedPythonVersion: "Python 3.11.9",
              managedPipVersion: "pip 25.0",
              preferredInterpreterPath: null,
              bootstrapPackages: [],
              interpreterHint: "Python 3.11 is preferred",
              baseInterpreter: {
                label: "Python 3.11",
                version: "3.11.9",
              },
              discoveredInterpreters: [],
              boilerplate: {
                readmePath: `${REPO_ROOT}\\.greeblefs-python\\README.md`,
                requirementsPath:
                  `${REPO_ROOT}\\.greeblefs-python\\requirements.txt`,
                packageDir:
                  `${REPO_ROOT}\\.greeblefs-python\\overlayterm_runtime`,
                helloScriptPath:
                  `${REPO_ROOT}\\.greeblefs-python\\scripts\\hello_runtime.py`,
                probeScriptPath:
                  `${REPO_ROOT}\\.greeblefs-python\\scripts\\probe.py`,
              },
            };
          case "python_execute":
            return {
              status: {
                runtimeRoot: `${REPO_ROOT}\\.greeblefs-python`,
                envDir: `${REPO_ROOT}\\.greeblefs-python\\env`,
                scriptsDir: `${REPO_ROOT}\\.greeblefs-python\\scripts`,
                tempDir: `${REPO_ROOT}\\.greeblefs-python\\temp`,
                logsDir: `${REPO_ROOT}\\.greeblefs-python\\logs`,
                managedPythonPath:
                  "C:\\Python Runtime\\env\\Scripts\\python.exe",
                envExists: true,
                ready: true,
                managedPythonVersion: "Python 3.11.9",
                managedPipVersion: "pip 25.0",
                preferredInterpreterPath: null,
                bootstrapPackages: [],
                interpreterHint: "Python 3.11 is preferred",
                baseInterpreter: {
                  label: "Python 3.11",
                  version: "3.11.9",
                },
                discoveredInterpreters: [],
                boilerplate: {
                  readmePath: `${REPO_ROOT}\\.greeblefs-python\\README.md`,
                  requirementsPath:
                    `${REPO_ROOT}\\.greeblefs-python\\requirements.txt`,
                  packageDir:
                    `${REPO_ROOT}\\.greeblefs-python\\overlayterm_runtime`,
                  helloScriptPath:
                    `${REPO_ROOT}\\.greeblefs-python\\scripts\\hello_runtime.py`,
                  probeScriptPath:
                    `${REPO_ROOT}\\.greeblefs-python\\scripts\\probe.py`,
                },
              },
              result: {
                command:
                  'C:\\Python Runtime\\env\\Scripts\\python.exe "C:\\workspace\\repo\\runner.py"',
                workingDirectory: REPO_ROOT,
                exitCode: 0,
                success: true,
                stdout: "hello from python preview",
                stderr: "",
              },
            };
          case "action_execute":
            return {
              packId: "workspace-pack",
              actionId: "sample-action",
              actionTitle: "Sample Workspace Action",
              success: true,
              exitCode: 0,
              timedOut: false,
              runtimeUsed: "shell",
              commandDisplay: "echo hello",
              workingDirectory: REPO_ROOT,
              stdout: "",
              stderr: "",
              launchedInNativeTerminal: false,
            };
          default:
            throw new Error(`Unexpected invoke command: ${command}`);
        }
      },
    );
  });

  it("lets the user pick columns from the explorer layout menu", async () => {
    renderExplorer();
    await screen.findByText("alpha");

    fireEvent.click(screen.getByRole("button", { name: /explorer layout:/i }));
    const layoutMenu = await screen.findByRole("menu", {
      name: /explorer layout menu/i,
    });
    expect(layoutMenu.closest("[data-overlay-explorer]")).not.toBeNull();
    expect(layoutMenu.style.background).toBe("var(--overlay-explorer-popup-bg)");
    fireEvent.click(screen.getByRole("menuitemradio", { name: /columns/i }));

    expect(useSettingsStore.getState().settings.explorer.viewMode).toBe(
      "columns",
    );
  });

  it("does not hardcode customize and layout controls into default explorer chrome", async () => {
    renderExplorer();
    await screen.findByText("alpha");

    expect(getChromeControl("customizeModeToggle")).toBeNull();
    expect(getChromeControl("shellLayout")).toBeNull();
    expect(
      screen.queryByRole("button", { name: /cycle explorer layouts/i }),
    ).toBeNull();
    expect(
      screen.queryByRole("button", {
        name: /open explorer layout preset menu/i,
      }),
    ).toBeNull();
  });

  it("opens customize mode and the layout switcher from command entry points", async () => {
    renderExplorer();
    await screen.findByText("alpha");

    const layoutSwitcher = await openExplorerLayoutSwitcherCommand();
    expect(layoutSwitcher).toHaveTextContent("Explorer Layout Switcher");

    await openExplorerCustomizeCommand();

    expect(
      screen.queryByRole("dialog", { name: /explorer layout switcher/i }),
    ).toBeNull();
    expect(getExplorerActionsPane()).toHaveTextContent("Explorer Customize");
    fireEvent.click(
      within(getExplorerActionsPane()).getByRole("button", { name: "Done" }),
    );
  });

  it("lets the user switch explorer layouts from the command switcher", async () => {
    renderExplorer();
    await screen.findByText("alpha");

    expect(screen.getByRole("button", { name: /manage/i })).toBeTruthy();

    const layoutSwitcher = await openExplorerLayoutSwitcherCommand();
    fireEvent.click(
      within(layoutSwitcher).getByRole("button", { name: /Focus/i }),
    );

    await waitFor(() => {
      expect(
        useSettingsStore.getState().settings.explorer.activeExplorerLayoutId,
      ).toBe("focus");
      expect(useExplorerStore.getState().session.shellLayoutId).toBe(
        "balanced",
      );
      expect(useExplorerStore.getState().session.sourcesVisible).toBe(false);
      expect(screen.queryByRole("button", { name: /manage/i })).toBeNull();
    });
  });

  it("keeps the search focus control anchored in the primary toolbar zone in focus mode", async () => {
    renderExplorer();
    await screen.findByText("alpha");

    const layoutSwitcher = await openExplorerLayoutSwitcherCommand();
    fireEvent.click(
      within(layoutSwitcher).getByRole("button", { name: /Focus/i }),
    );

    await waitFor(() => {
      expect(
        getChromeControl("focusAddressBar")?.getAttribute(
          "data-overlay-explorer-control-zone",
        ),
      ).toBe("primaryEnd");
    });

    fireEvent.click(screen.getByText("alpha"));

    await waitFor(() => {
      expect(
        getChromeControl("focusAddressBar")?.getAttribute(
          "data-overlay-explorer-control-zone",
        ),
      ).toBe("primaryEnd");
      expect(
        getChromeControl("selectionSizeSummary")?.getAttribute(
          "data-overlay-explorer-control-zone",
        ),
      ).toBe("secondaryStart");
    });
  });

  it("can close the sources rail in inspector mode and reopen it without leaving that mode", async () => {
    renderExplorer();
    await screen.findByText("alpha");

    const layoutSwitcher = await openExplorerLayoutSwitcherCommand();
    fireEvent.click(
      within(layoutSwitcher).getByRole("button", { name: /Inspector/i }),
    );

    await waitFor(() => {
      expect(
        useSettingsStore.getState().settings.explorer.activeExplorerLayoutId,
      ).toBe("inspector");
      expect(useExplorerStore.getState().session.sourcesVisible).toBe(true);
      expect(
        screen.getByRole("button", { name: /manage/i }),
      ).toBeInTheDocument();
    });

    fireEvent.click(
      within(getChromeControl("railClose") as HTMLElement).getByRole("button"),
    );

    await waitFor(() => {
      expect(
        useSettingsStore.getState().settings.explorer.activeExplorerLayoutId,
      ).toBe("inspector");
      expect(useExplorerStore.getState().session.sourcesVisible).toBe(false);
      expect(screen.queryByRole("button", { name: /manage/i })).toBeNull();
      expect(
        screen.getByRole("button", { name: /open sources panel/i }),
      ).toBeInTheDocument();
    });

    fireEvent.click(
      screen.getByRole("button", { name: /open sources panel/i }),
    );

    await waitFor(() => {
      expect(
        useSettingsStore.getState().settings.explorer.activeExplorerLayoutId,
      ).toBe("inspector");
      expect(useExplorerStore.getState().session.sourcesVisible).toBe(true);
      expect(
        screen.getByRole("button", { name: /manage/i }),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /open sources panel/i }),
      ).toBeNull();
    });
  });

  it("keeps shell layout as an optional catalog control instead of default chrome", async () => {
    renderExplorer();
    await screen.findByText("alpha");

    await openExplorerCustomizeCommand();

    expect(
      within(getExplorerActionsPane()).getByRole("button", {
        name: /shell layout/i,
      }),
    ).toBeInTheDocument();
    fireEvent.click(
      within(getExplorerActionsPane()).getByRole("button", { name: "Done" }),
    );
  });

  it("resets layout customization to canonical from the menu", async () => {
    useSettingsStore
      .getState()
      .setActiveExplorerLayoutId("focus");
    useSettingsStore.getState().setExplorerChromeLayoutOverride("operator", "default", {
      entries: [
        {
          controlId: "refresh",
          surfaceId: "explorerToolbar",
          zone: "primaryStart",
          order: 5,
        },
      ],
    });

    renderExplorer();
    await screen.findByText("alpha");

    await openExplorerLayoutSwitcherCommand();
    fireEvent.click(
      screen.getByRole("button", { name: /reset layout ui to canonical/i }),
    );

    await waitFor(() => {
      expect(
        useSettingsStore.getState().settings.explorer.activeExplorerLayoutId,
      ).toBe(EXPLORER_CANONICAL_LAYOUT_ID);
      expect(
        useSettingsStore.getState().settings.explorer.followThemeExplorerLayout,
      ).toBe(false);
      expect(
        useSettingsStore.getState().settings.explorer.chromeLayoutOverridesByThemeId,
      ).toEqual({});
      expect(
        screen.queryByRole("dialog", {
          name: /explorer layout switcher/i,
        }),
      ).toBeNull();
    });
  });

  it("opens the explorer layout switcher as a popup instead of a fixed utility strip", async () => {
    renderExplorer();
    await screen.findByText("alpha");

    const layoutSwitcher = await openExplorerLayoutSwitcherCommand();

    const switcherOverlay = document.querySelector(
      "[data-overlay-explorer-layout-command-menu='true']",
    ) as HTMLDivElement | null;

    expect(layoutSwitcher).toBeInTheDocument();
    expect(
      document.querySelector("[data-overlay-explorer-plane='fixed-utility-strip']"),
    ).toBeNull();
    expect(switcherOverlay?.style.position).toBe("fixed");
    expect(switcherOverlay?.style.zIndex).toBe("10030");
    fireEvent.click(within(layoutSwitcher).getByRole("button", { name: "Close" }));
  });

  it("shows a portal drag overlay when an authored action is dragged before hovering a target", async () => {
    renderExplorer({ actions: [sampleExplorerAction] });
    await screen.findByText("alpha");

    fireEvent.click(
      within(getChromeControl("actionsPaneToggle") as HTMLElement).getByRole(
        "button",
      ),
    );

    const actionButton = await within(getExplorerActionsPane()).findByRole(
      "button",
      { name: /sample workspace action/i },
    );
    fireEvent.pointerDown(actionButton, {
      button: 0,
      pointerId: 81,
      clientX: 24,
      clientY: 24,
    });

    const overlay = await screen.findByTestId(
      "explorer-customize-drag-overlay",
    );
    expect(overlay).toHaveTextContent("Sample Workspace Action");
    expect(overlay).toHaveTextContent("Choose a surface");

    finishExplorerPointerDrag({ pointerId: 81, endX: 24, endY: 24 });
    fireEvent.click(
      within(getExplorerActionsPane()).getByRole("button", { name: "Done" }),
    );
  });

  it("drags authored actions into chrome and persists through chromeLayoutOverridesByThemeId", async () => {
    renderExplorer({ actions: [sampleExplorerAction] });
    await screen.findByText("alpha");

    fireEvent.click(
      within(getChromeControl("actionsPaneToggle") as HTMLElement).getByRole(
        "button",
      ),
    );

    const actionButton = await within(getExplorerActionsPane()).findByRole(
      "button",
      { name: /sample workspace action/i },
    );
    const toolbarSurface = document.querySelector(
      "[data-explorer-customize-surface-id='explorerToolbar']",
    );
    const toolbarRow = toolbarSurface?.querySelector(
      "[data-explorer-customize-row-id]",
    );
    const toolbarZone = toolbarSurface?.querySelector(
      "[data-explorer-customize-zone-id='primaryStart']",
    );
    mockElementRect(toolbarSurface, {
      left: 0,
      top: 0,
      width: 760,
      height: 64,
    });
    mockElementRect(toolbarRow, {
      left: 0,
      top: 0,
      width: 760,
      height: 64,
    });
    mockElementRect(toolbarZone, {
      left: 280,
      top: 0,
      width: 460,
      height: 64,
    });

    const originalElementFromPoint = document.elementFromPoint;
    Object.defineProperty(document, "elementFromPoint", {
      configurable: true,
      value: vi.fn(() => toolbarSurface),
    });

    try {
      const dragGesture = startExplorerPointerDrag(actionButton, {
        pointerId: 82,
        startX: 24,
        startY: 24,
        endX: 420,
        endY: 28,
      });
      await waitFor(() => {
        expect(screen.getByTestId("explorer-customize-drag-overlay")).toHaveTextContent(
          "Drop on Toolbar",
        );
      });
      finishExplorerPointerDrag(dragGesture);
    } finally {
      if (originalElementFromPoint) {
        Object.defineProperty(document, "elementFromPoint", {
          configurable: true,
          value: originalElementFromPoint,
        });
      } else {
        Reflect.deleteProperty(document, "elementFromPoint");
      }
    }

    const actionControlId = toExplorerActionChromeControlId(
      sampleExplorerAction.id,
    );
    await waitFor(() => {
      expect(
        useSettingsStore.getState().settings.explorer
          .chromeLayoutOverridesByThemeId.operator?.default?.entries,
      ).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            controlId: actionControlId,
            surfaceId: "explorerToolbar",
            zone: "primaryStart",
            hidden: false,
          }),
        ]),
      );
    });
    expect(
      vi.mocked(invoke).mock.calls.some(([command]) => command === "action_execute"),
    ).toBe(false);
    fireEvent.click(
      within(getExplorerActionsPane()).getByRole("button", { name: "Done" }),
    );
  });

  it("moves toolbar controls when the active theme changes the default mode profile", async () => {
    const appearance = resolveOverlayAppearance({
      activeThemeId: "focused-layout",
      customThemes: [
        normalizeThemeDefinition({
          id: "focused-layout",
          name: "Focused Layout",
          explorer: {
            defaultModeProfileId: "focus",
          },
        }),
      ],
    });

    renderExplorer({ appearance });
    await screen.findByText("alpha");

    expect(
      getChromeControl("toggleSources")?.getAttribute(
        "data-overlay-explorer-control-zone",
      ),
    ).toBe("primaryStart");
  });

  it("can render global controls on the explorer topbar surface", async () => {
    renderExplorer({ chromeControlSurface: "topbar" });
    await screen.findByText("alpha");

    const toggleSources = getChromeControl("toggleSources");
    expect(
      toggleSources?.closest(
        '[data-overlay-explorer-surface="explorerTopbar"]',
      ),
    ).not.toBeNull();
    expect(
      document.querySelector(
        '[data-overlay-explorer-surface="explorerToolbar"] [data-overlay-explorer-control="toggleSources"]',
      ),
    ).toBeNull();
  });

  it("reads customize saves from the same chrome override lane the explorer writes", async () => {
    useExplorerStore.getState().updateSession({
      shellLayoutId: "focus",
      sourcesVisible: false,
    });
    useSettingsStore
      .getState()
      .setExplorerChromeLayoutOverride("operator", "default", {
        entries: [
          {
            controlId: "refresh",
            surfaceId: "explorerToolbar",
            zone: "primaryStart",
            order: 5,
          },
        ],
      });

    renderExplorer();
    await screen.findByText("alpha");

    expect(
      getChromeControl("refresh")?.getAttribute(
        "data-overlay-explorer-control-zone",
      ),
    ).toBe("primaryStart");
    expect(useExplorerStore.getState().session.shellLayoutId).toBe("focus");
    expect(
      useSettingsStore.getState().settings.explorer.activeExplorerLayoutId,
    ).toBeNull();
  });

  it("commits the active chrome customize draft when the live customize toggle exits the mode", async () => {
    useExplorerStore.getState().openChromeEditSession({
      themeId: "operator",
      layoutId: "default",
      initialOverride: {
        entries: [
          {
            controlId: "refresh",
            surfaceId: "explorerToolbar",
            zone: "primaryEnd",
            order: 5,
            offsetPx: 28,
          },
        ],
      },
    });

    renderExplorer();
    await screen.findByText("alpha");

    expect(getChromeControl("refresh")?.getAttribute("data-overlay-explorer-control-zone")).toBe(
      "primaryEnd",
    );

    act(() => {
      window.dispatchEvent(
        new CustomEvent("greeblefs:toggle-explorer-customize"),
      );
    });

    await waitFor(() => {
      expect(useExplorerStore.getState().chromeEditSession).toBeNull();
    });

    await waitFor(() => {
      expect(
        getChromeControl("refresh")?.getAttribute(
          "data-overlay-explorer-control-zone",
        ),
      ).toBe("primaryEnd");
    });

    expect(
      useSettingsStore.getState().settings.explorer.chromeLayoutOverridesByThemeId
        .operator?.default?.entries,
    ).toEqual([
      expect.objectContaining({
        controlId: "refresh",
        surfaceId: "explorerToolbar",
        zone: "primaryEnd",
        order: 5,
        offsetPx: 28,
        hidden: false,
      }),
    ]);
  });

  it("keeps the status bar representative during explorer customize mode", async () => {
    useExplorerStore.getState().openChromeEditSession({
      themeId: "operator",
      layoutId: "default",
      initialOverride: {
        entries: [],
      },
    });

    renderExplorer();
    await screen.findByText("alpha");

    await waitFor(() => {
      expect(
        document.querySelector(
          '[data-layout-dynamics-surface="explorerStatusBar"]',
        ),
      ).toBeNull();
      expect(
        document.querySelector(
          '[data-overlay-explorer-surface="explorerStatusBar"]',
        ),
      ).not.toBeNull();
    });
  });

  it("commits the active chrome customize draft when Done closes the actions pane", async () => {
    useExplorerStore.getState().openChromeEditSession({
      themeId: "operator",
      layoutId: "default",
      initialOverride: {
        entries: [
          {
            controlId: "refresh",
            surfaceId: "explorerToolbar",
            zone: "primaryEnd",
            order: 7,
            offsetPx: 44,
          },
        ],
      },
    });

    renderExplorer();
    await screen.findByText("alpha");

    await waitFor(() => {
      expect(queryExplorerActionsPane()).not.toBeNull();
    });

    fireEvent.click(
      within(getExplorerActionsPane()).getByRole("button", { name: "Done" }),
    );

    await waitFor(() => {
      expect(useExplorerStore.getState().chromeEditSession).toBeNull();
      expect(queryExplorerActionsPane()).toBeNull();
    });

    expect(
      getChromeControl("refresh")?.getAttribute(
        "data-overlay-explorer-control-zone",
      ),
    ).toBe("primaryEnd");
    expect(
      useSettingsStore.getState().settings.explorer.chromeLayoutOverridesByThemeId
        .operator?.default?.entries,
    ).toEqual([
      expect.objectContaining({
        controlId: "refresh",
        surfaceId: "explorerToolbar",
        zone: "primaryEnd",
        order: 7,
        offsetPx: 44,
        hidden: false,
      }),
    ]);
  });

  it("honors the preview toggle before opening previewable files", async () => {
    renderExplorer();
    await screen.findByText("notes.txt");

    fireEvent.click(screen.getByRole("button", { name: /^preview$/i }));

    await waitFor(() => {
      expect(useExplorerStore.getState().session.previewEnabled).toBe(false);
    });

    fireEvent.click(screen.getByText("notes.txt"));

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: /copy path/i })).toBeNull();
    });
    expect(
      vi
        .mocked(invoke)
        .mock.calls.some(([command]) => command === "fs_read_text_file"),
    ).toBe(false);
  });

  it("shows a friendly empty preview state while preview mode is enabled", async () => {
    renderExplorer();
    await screen.findByText("notes.txt");

    const previewPane = getPreviewPane();
    expect(previewPane).toHaveAttribute(
      "data-overlay-explorer-preview-surface-mode",
      "content",
    );
    expect(
      within(previewPane).getByText(/preview is standing by/i),
    ).toBeInTheDocument();
    expect(
      within(previewPane).getByText(
        /select any file or folder to bring it into view here/i,
      ),
    ).toBeInTheDocument();
    fireEvent.click(getPreviewCloseButton());

    await waitFor(() => {
      expect(queryPreviewPane()).toBeNull();
      expect(useExplorerStore.getState().session.previewEnabled).toBe(false);
    });

    expect(getChromeControl("previewModeToggle")).toBeNull();
    expect(getChromeControl("previewSplitToggle")).toBeNull();
  });

  it("opens executable scripts in an editor-first preview with edit left of the run workflow tab", async () => {
    renderExplorer();
    await screen.findByText("build.bat");

    fireEvent.click(screen.getByText("build.bat"));

    await screen.findByRole("button", { name: /copy path/i });
    expect(screen.queryByText(/preview unavailable/i)).toBeNull();
    expect(screen.getByRole("button", { name: /^edit$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^run$/i })).toBeInTheDocument();
    expectChromeControlButtonOrder("previewModeToggle", ["Edit", "Run"]);
    expect(getChromeControl("previewTerminalToggle")).toBeNull();
    expect(await screen.findByTestId("monaco-editor")).toHaveTextContent(
      "hello from preview",
    );

    fireEvent.click(screen.getByRole("button", { name: /^run$/i }));

    await waitFor(() => {
      expect(getPreviewPane()).toHaveAttribute(
        "data-overlay-explorer-preview-surface-mode",
        "terminal",
      );
      expect(getExplorerEmbeddedTerminalLayer()).toHaveAttribute(
        "data-overlay-explorer-terminal-placement",
        "preview",
      );
      expect(previewTerminalMockState.lastProps?.pendingCommandRequest).toEqual(
        expect.objectContaining({
          id: expect.stringContaining("explorer-terminal-primary:"),
          run: true,
        }),
      );
      expect(
        previewTerminalMockState.lastProps?.pendingCommandRequest?.command,
      ).toContain("build.bat");
    });

    fireEvent.click(screen.getByRole("button", { name: /^edit$/i }));

    await waitFor(() => {
      expect(getPreviewPane()).toHaveAttribute(
        "data-overlay-explorer-preview-surface-mode",
        "content",
      );
    });
  });

  it("opens Python files editor-first with run and runtime wildcard tabs", async () => {
    renderExplorer();
    await screen.findByText("runner.py");

    fireEvent.click(screen.getByText("runner.py"));

    expect(await screen.findByTestId("monaco-editor")).toHaveTextContent(
      'print("hello from python preview")',
    );
    expect(useExplorerStore.getState().session.documentViewMode).toBe("edit");
    expectChromeControlButtonOrder("previewModeToggle", [
      "Edit",
      "Run",
      "Runtime",
    ]);
    expect(screen.queryByTestId("explorer-python-workbench")).toBeNull();

    fireEvent.click(
      within(getChromeControl("previewModeToggle") as HTMLElement).getByRole(
        "button",
        {
          name: "Edit",
        },
      ),
    );

    await waitFor(() => {
      expect(useExplorerStore.getState().session.documentViewMode).toBe("edit");
    });

    fireEvent.click(
      within(getChromeControl("previewModeToggle") as HTMLElement).getByRole(
        "button",
        {
          name: "Run",
        },
      ),
    );

    expect(await screen.findByTestId("explorer-python-workbench")).toHaveAttribute(
      "data-python-workflow-tab",
      "run",
    );

    fireEvent.click(
      within(getChromeControl("previewModeToggle") as HTMLElement).getByRole(
        "button",
        {
          name: "Runtime",
        },
      ),
    );

    const pythonWorkbench = await screen.findByTestId(
      "explorer-python-workbench",
    );
    expect(pythonWorkbench).toHaveAttribute("data-python-workflow-tab", "runtime");
    expect(
      within(pythonWorkbench).getByRole("button", { name: "Open Managed REPL" }),
    ).toBeInTheDocument();
  });

  it("runs Python previews through managed and terminal actions from the workbench and hotkeys", async () => {
    const invokeMock = vi.mocked(invoke);
    renderExplorer();
    await screen.findByText("runner.py");

    fireEvent.click(screen.getByText("runner.py"));
    const pythonModeToggle = await waitFor(() => {
      const control = getChromeControl("previewModeToggle");
      expect(control).not.toBeNull();
      return control as HTMLElement;
    });

    fireEvent.click(
      within(pythonModeToggle).getByRole("button", {
        name: "Run",
      }),
    );

    const runManagedButton = await screen.findByRole("button", {
      name: "Run Managed",
    });
    await userEvent.click(runManagedButton);

    await screen.findByText("Latest Managed Run");
    expect(
      invokeMock.mock.calls.some(
        ([command, args]) =>
          command === "python_execute" &&
          JSON.stringify(args ?? {}).includes("runner.py"),
      ),
    ).toBe(true);

    const runInTerminalButton = screen.getByRole("button", {
      name: "Run in Terminal",
    });
    await userEvent.click(runInTerminalButton);

    await waitFor(() => {
      expect(getPreviewPane()).toHaveAttribute(
        "data-overlay-explorer-preview-surface-mode",
        "terminal",
      );
      expect(queryExplorerEmbeddedTerminalLayer()).toBeNull();
      expect(
        previewTerminalMockState.lastProps?.pendingCommandRequest?.command,
      ).toContain("runner.py");
    });

    fireEvent.click(getPreviewTerminalToggleButton());

    await waitFor(() => {
      expect(getPreviewPane()).toHaveAttribute(
        "data-overlay-explorer-preview-surface-mode",
        "content",
      );
      expect(getChromeControl("previewModeToggle")).not.toBeNull();
    });

    fireEvent.click(
      within(getChromeControl("previewModeToggle") as HTMLElement).getByRole(
        "button",
        {
          name: "Edit",
        },
      ),
    );

    const monacoEditor = await screen.findByTestId("monaco-editor");
    monacoEditor.tabIndex = -1;
    monacoEditor.focus();
    fireEvent.keyDown(monacoEditor, { key: "F9", bubbles: true });

    await waitFor(() => {
      expect(
        invokeMock.mock.calls.filter(([command]) => command === "python_execute")
          .length,
      ).toBeGreaterThanOrEqual(2);
      expect(screen.getByTestId("explorer-python-workbench")).toHaveAttribute(
        "data-python-workflow-tab",
        "run",
      );
    });

    fireEvent.keyDown(monacoEditor, {
      key: "F9",
      ctrlKey: true,
      bubbles: true,
    });

    await waitFor(() => {
      expect(
        previewTerminalMockState.lastProps?.pendingCommandRequest?.command,
      ).toContain("runner.py");
    });
  });

  it("only shows the preview split toggle when a preview is active", async () => {
    renderExplorer();
    await screen.findByText("notes.txt");

    expect(getChromeControl("previewSplitToggle")).toBeNull();

    fireEvent.click(screen.getByText("notes.txt"));

    await screen.findByRole("button", { name: /copy path/i });
    expect(getChromeControl("previewSplitToggle")).not.toBeNull();
    expect(getPreviewPane()).toHaveAttribute(
      "data-overlay-explorer-preview-split-mode",
      "inline",
    );
  });

  it("locks the active preview in place while selection keeps moving through the explorer", async () => {
    renderExplorer();
    await screen.findByText("notes.txt");

    fireEvent.click(screen.getByText("notes.txt"));
    await waitFor(() => {
      expect(screen.getByTestId("monaco-editor")).toHaveTextContent(
        "hello from preview",
      );
    });

    fireEvent.click(getPreviewLockButton());

    await waitFor(() => {
      expect(useExplorerStore.getState().session.previewLocked).toBe(true);
      expect(getPreviewPane()).toHaveAttribute(
        "data-overlay-explorer-preview-locked",
        "true",
      );
      expect(getPreviewLockButton()).toHaveAttribute("aria-pressed", "true");
    });
    expect(getChromeControl("previewState")).toHaveTextContent("Locked");

    fireEvent.click(screen.getByText("preview.png"));

    await waitFor(() => {
      expect(screen.getByTestId("monaco-editor")).toHaveTextContent(
        "hello from preview",
      );
      expect(screen.queryByTestId("mock-explorer-image-editor")).toBeNull();
    });

    fireEvent.keyDown(window, { key: "ArrowDown" });

    await waitFor(() => {
      expect(screen.getByTestId("monaco-editor")).toHaveTextContent(
        "hello from preview",
      );
      expect(screen.queryByTestId("mock-explorer-image-editor")).toBeNull();
    });
  });

  it("compacts explorer chrome and suppresses the side preview in multi-pane mode", async () => {
    renderExplorer({ workspacePaneCount: 2 });
    await screen.findByText("notes.txt");

    expect(queryPreviewPane()).toBeNull();
    expect(
      document.querySelector('[data-overlay-explorer-plane="status"]'),
    ).toBeNull();
    expect(getChromeControl("togglePreview")).toBeNull();
  });

  it("keeps the sources rail toggle compact in multi-pane mode", async () => {
    useExplorerStore.getState().updateSession({
      sourcesVisible: false,
    });

    renderExplorer({ workspacePaneCount: 2 });
    await screen.findByText("notes.txt");

    expect(
      screen.getByRole("button", { name: /open sources panel/i }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/sources rail closed/i)).toBeNull();
    expect(
      screen.queryByText(/focus mode keeps the sources rail tucked away/i),
    ).toBeNull();
  });

  it("applies the aggressive compact preset in three-pane workspace mode", async () => {
    renderExplorer({ workspacePaneCount: 3 });
    await screen.findByText("notes.txt");

    expect(getChromeControl("saveSearch")).toBeNull();
    expect(getChromeControl("duplicateScan")).toBeNull();
    expect(getChromeControl("experimentalModes")).toBeNull();
    expect(getChromeControl("viewLayout")).toBeNull();
    expect(getChromeControl("togglePreview")).toBeNull();
  });

  it("applies the aggressive compact preset in four-pane workspace mode", async () => {
    renderExplorer({ workspacePaneCount: 4 });
    await screen.findByText("notes.txt");

    expect(getChromeControl("saveSearch")).toBeNull();
    expect(getChromeControl("duplicateScan")).toBeNull();
    expect(getChromeControl("experimentalModes")).toBeNull();
    expect(getChromeControl("viewLayout")).toBeNull();
    expect(getChromeControl("togglePreview")).toBeNull();
  });

  it("restores the remembered preview when workspace compaction ends", async () => {
    const { appearance, rerender } = renderExplorer();
    await screen.findByText("notes.txt");

    fireEvent.click(screen.getByText("notes.txt"));
    await screen.findByRole("button", { name: /copy path/i });

    const sharedProps = {
      theme: {
        accent: appearance.theme.palette.accent,
        bg: appearance.theme.palette.appBackground,
        bgPanel: appearance.theme.palette.panelBackground,
        text: appearance.theme.palette.textPrimary,
        border: appearance.theme.palette.border,
        textMuted: appearance.theme.palette.textMuted,
      },
      appearance,
      onOpenInTerminal: () => {},
      onAddBookmark: async () => {},
    };

    rerender(<FileExplorer {...sharedProps} workspacePaneCount={2} />);
    expect(queryPreviewPane()).toBeNull();

    rerender(<FileExplorer {...sharedProps} workspacePaneCount={1} />);
    await screen.findByRole("button", { name: /copy path/i });
  });

  it("shows an icon-only preview terminal toggle, swaps surfaces, and keeps the preview terminal session mounted", async () => {
    renderExplorer();
    await screen.findByText("index.html");

    fireEvent.click(screen.getByText("index.html"));

    await screen.findByRole("button", { name: /copy path/i });
    expect(getChromeControl("previewState")).not.toBeNull();
    expect(getChromeControl("previewCopyPath")).not.toBeNull();
    expect(getChromeControl("previewSplitToggle")).not.toBeNull();
    expect(getChromeControl("previewClose")).not.toBeNull();
    expect(getPreviewPane()).toHaveAttribute(
      "data-overlay-explorer-preview-surface-mode",
      "content",
    );

    fireEvent.click(getPreviewTerminalToggleButton());

    await waitFor(() => {
      expect(getPreviewPane()).toHaveAttribute(
        "data-overlay-explorer-preview-surface-mode",
        "terminal",
      );
      expect(queryExplorerEmbeddedTerminalLayer()).toBeNull();
      expect(screen.getByTestId("mock-preview-terminal")).toHaveAttribute(
        "data-working-directory",
        REPO_ROOT,
      );
      expect(previewTerminalMockState.mountCount).toBe(1);
    });

    expect(
      within(getChromeControl("previewIdentity") as HTMLElement).getByText(
        "Terminal",
      ),
    ).toBeInTheDocument();
    expect(getChromeControl("previewState")).toBeNull();
    expect(getChromeControl("previewModeToggle")).toBeNull();
    expect(getChromeControl("previewCopyPath")).toBeNull();
    expect(getChromeControl("previewSplitToggle")).not.toBeNull();
    expect(getChromeControl("previewClose")).not.toBeNull();
    expect(previewTerminalMockState.lastProps?.consumeExplorerCwdSync).toBe(
      false,
    );

    fireEvent.click(getPreviewTerminalToggleButton());

    await waitFor(() => {
      expect(getPreviewPane()).toHaveAttribute(
        "data-overlay-explorer-preview-surface-mode",
        "content",
      );
      expect(queryExplorerEmbeddedTerminalLayer()).toBeNull();
      expect(previewTerminalMockState.mountCount).toBe(1);
      expect(getChromeControl("previewCopyPath")).not.toBeNull();
    });
  });

  it("opens the bottom terminal drawer from the status bar control", async () => {
    renderExplorer();
    await screen.findByText("notes.txt");

    expect(getChromeControl("terminalDrawerToggle")).not.toBeNull();

    fireEvent.click(getBottomTerminalToggleButton());

    await waitFor(() => {
      expect(getExplorerEmbeddedTerminalLayer()).toHaveAttribute(
        "data-overlay-explorer-terminal-placement",
        "bottom",
      );
      expect(getExplorerEmbeddedTerminalLayer()).toHaveAttribute(
        "data-overlay-explorer-terminal-visible",
        "true",
      );
      expect(screen.getByTestId("mock-preview-terminal")).toHaveAttribute(
        "data-working-directory",
        REPO_ROOT,
      );
      expect(previewTerminalMockState.mountCount).toBe(1);
    });
  });

  it("keeps the preview terminal and bottom drawer as separate explorer terminals", async () => {
    renderExplorer();
    await screen.findByText("index.html");

    fireEvent.click(screen.getByText("index.html"));
    await screen.findByRole("button", { name: /copy path/i });

    fireEvent.click(getPreviewTerminalToggleButton());

    await waitFor(() => {
      expect(getPreviewPane()).toHaveAttribute(
        "data-overlay-explorer-preview-surface-mode",
        "terminal",
      );
      expect(previewTerminalMockState.mountCount).toBe(1);
    });

    fireEvent.click(getBottomTerminalToggleButton());

    await waitFor(() => {
      expect(getPreviewPane()).toHaveAttribute(
        "data-overlay-explorer-preview-surface-mode",
        "terminal",
      );
      expect(getExplorerEmbeddedTerminalLayer()).toHaveAttribute(
        "data-overlay-explorer-terminal-placement",
        "bottom",
      );
      expect(getExplorerEmbeddedTerminalLayer()).toHaveAttribute(
        "data-overlay-explorer-terminal-visible",
        "true",
      );
      expect(screen.getAllByTestId("mock-preview-terminal")).toHaveLength(2);
      expect(previewTerminalMockState.mountCount).toBe(2);
    });

    fireEvent.click(getPreviewTerminalToggleButton());

    await waitFor(() => {
      expect(getPreviewPane()).toHaveAttribute(
        "data-overlay-explorer-preview-surface-mode",
        "content",
      );
      expect(getExplorerEmbeddedTerminalLayer()).toHaveAttribute(
        "data-overlay-explorer-terminal-placement",
        "bottom",
      );
      expect(getExplorerEmbeddedTerminalLayer()).toHaveAttribute(
        "data-overlay-explorer-terminal-visible",
        "true",
      );
      expect(previewTerminalMockState.mountCount).toBe(2);
    });
  });

  it("toggles the preview terminal from the explorer hotkey", async () => {
    renderExplorer();
    await screen.findByText("notes.txt");

    fireEvent.click(screen.getByText("notes.txt"));
    await screen.findByRole("button", { name: /copy path/i });

    fireEvent.keyDown(window, { key: "t", ctrlKey: true, altKey: true });

    await waitFor(() => {
      expect(getPreviewPane()).toHaveAttribute(
        "data-overlay-explorer-preview-surface-mode",
        "terminal",
      );
    });
  });

  it("reveals the bottom terminal drawer from Ctrl+J when the explorer is active", async () => {
    renderExplorer({ workspacePaneCount: 2 });
    await screen.findByText("notes.txt");

    expect(queryPreviewPane()).toBeNull();

    const explorerContentViewport = getExplorerContentViewport();
    explorerContentViewport.focus();
    expect(document.activeElement).toBe(explorerContentViewport);

    fireEvent.keyDown(window, { key: "j", ctrlKey: true });

    await waitFor(() => {
      expect(getExplorerEmbeddedTerminalLayer()).toHaveAttribute(
        "data-overlay-explorer-terminal-placement",
        "bottom",
      );
      expect(getExplorerEmbeddedTerminalLayer()).toHaveAttribute(
        "data-overlay-explorer-terminal-visible",
        "true",
      );
      expect(previewTerminalMockState.mountCount).toBe(1);
    });
  });

  it("toggles the preview lock from the explorer hotkey", async () => {
    renderExplorer();
    await screen.findByText("notes.txt");

    fireEvent.click(screen.getByText("notes.txt"));
    await screen.findByRole("button", { name: /copy path/i });

    fireEvent.keyDown(window, { key: "p", ctrlKey: true, altKey: true });

    await waitFor(() => {
      expect(useExplorerStore.getState().session.previewLocked).toBe(true);
      expect(getPreviewLockButton()).toHaveAttribute("aria-pressed", "true");
    });

    fireEvent.keyDown(window, { key: "p", ctrlKey: true, altKey: true });

    await waitFor(() => {
      expect(useExplorerStore.getState().session.previewLocked).toBe(false);
      expect(getPreviewLockButton()).toHaveAttribute("aria-pressed", "false");
    });
  });

  it("cycles shared folder preview modes from the explorer hotkeys", async () => {
    const folderEntries = [
      {
        name: "shots",
        path: `${REPO_ROOT}\\alpha\\shots`,
        is_dir: true,
        size: 0,
        modified: 1713400000000,
        extension: "",
        is_hidden: false,
        is_symlink: false,
      },
      {
        name: "readme.md",
        path: `${REPO_ROOT}\\alpha\\readme.md`,
        is_dir: false,
        size: 1024,
        modified: 1713400000000,
        extension: "md",
        is_hidden: false,
        is_symlink: false,
      },
    ] as const;
    const baseInvokeImplementation = vi.mocked(invoke).getMockImplementation();
    if (!baseInvokeImplementation) {
      throw new Error("Missing default invoke mock implementation");
    }

    vi.mocked(invoke).mockImplementation(
      async (command: string, args?: unknown) => {
        const payload = args as
          | { path?: string; showHidden?: boolean }
          | undefined;
        if (
          (command === "fs_list_dir" || command === "fs_list_dir_uncached") &&
          payload?.path === `${REPO_ROOT}\\alpha`
        ) {
          return folderEntries;
        }
        return baseInvokeImplementation(command, args as never);
      },
    );

    renderExplorer();
    await screen.findByText("alpha");

    fireEvent.click(screen.getByText("alpha"));
    await screen.findByText("Folder Contents");

    expect(useSettingsStore.getState().settings.explorer.collectionPreviewMode).toBe(
      "list",
    );

    fireEvent.keyDown(window, { key: "v", ctrlKey: true, altKey: true });

    await waitFor(() => {
      expect(
        useSettingsStore.getState().settings.explorer.collectionPreviewMode,
      ).toBe("overview");
      expect(
        within(getPreviewPane()).getByRole("button", {
          name: /use overview preview mode/i,
        }),
      ).toHaveAttribute("aria-pressed", "true");
    });

    fireEvent.keyDown(window, {
      key: "v",
      ctrlKey: true,
      altKey: true,
      shiftKey: true,
    });

    await waitFor(() => {
      expect(
        useSettingsStore.getState().settings.explorer.collectionPreviewMode,
      ).toBe("list");
      expect(
        within(getPreviewPane()).getByRole("button", {
          name: /use list preview mode/i,
        }),
      ).toHaveAttribute("aria-pressed", "true");
    });
  });

  it("uses Ctrl+C to arm Dolphin-style selection mode before copying", async () => {
    renderExplorer();
    await screen.findByText("notes.txt");

    expect(getChromeControl("statusSelectionMode")).toBeNull();

    fireEvent.keyDown(window, { key: "c", ctrlKey: true });

    await waitFor(() => {
      expect(getChromeControl("statusSelectionMode")).not.toBeNull();
    });

    fireEvent.keyDown(window, { key: "c", ctrlKey: true });

    await waitFor(() => {
      expect(getChromeControl("statusSelectionMode")).toBeNull();
    });

    fireEvent.keyDown(window, { key: "c", ctrlKey: true });

    await waitFor(() => {
      expect(getChromeControl("statusSelectionMode")).not.toBeNull();
    });

    fireEvent.click(screen.getByText("notes.txt"));

    await waitFor(() => {
      expect(getChromeControl("statusSelectionMode")).not.toBeNull();
      expect(getChromeControl("statusSelectionSummary")).toHaveTextContent(
        "1 selected",
      );
      expect(screen.queryByRole("button", { name: /copy path/i })).toBeNull();
    });

    fireEvent.keyDown(window, { key: "c", ctrlKey: true });

    await waitFor(() => {
      expect(screen.getByText(/copy queue:/i)).toBeInTheDocument();
      expect(getChromeControl("statusSelectionMode")).toBeNull();
    });
  });

  it("toggles the sources panel from the explorer hotkey", async () => {
    renderExplorer();
    await screen.findByText("alpha");

    fireEvent.keyDown(window, { key: "b", ctrlKey: true });

    await waitFor(() => {
      expect(useExplorerStore.getState().session.sourcesVisible).toBe(false);
      expect(
        screen.getByRole("button", { name: /open sources panel/i }),
      ).toBeInTheDocument();
    });

    fireEvent.keyDown(window, { key: "b", ctrlKey: true });

    await waitFor(() => {
      expect(useExplorerStore.getState().session.sourcesVisible).toBe(true);
      expect(
        screen.queryByRole("button", { name: /open sources panel/i }),
      ).toBeNull();
      expect(
        screen.getByRole("button", { name: /manage/i }),
      ).toBeInTheDocument();
    });
  });

  it("navigates the explorer when the preview terminal reports a new working directory", async () => {
    const alphaEntries = [
      {
        name: "inside-alpha.txt",
        path: `${REPO_ROOT}\\alpha\\inside-alpha.txt`,
        is_dir: false,
        size: 64,
        modified: 0,
        extension: "txt",
        is_hidden: false,
        is_symlink: false,
      },
    ];
    const baseInvokeImplementation = vi.mocked(invoke).getMockImplementation();
    if (!baseInvokeImplementation) {
      throw new Error("Missing default invoke mock implementation");
    }

    vi.mocked(invoke).mockImplementation(
      async (command: string, args?: unknown) => {
        const payload = args as { path?: string } | undefined;
        if (
          (command === "fs_list_dir" || command === "fs_list_dir_uncached") &&
          payload?.path === `${REPO_ROOT}\\alpha`
        ) {
          return alphaEntries;
        }
        return baseInvokeImplementation(command, args as never);
      },
    );

    renderExplorer();
    await screen.findByText("notes.txt");

    fireEvent.click(screen.getByText("notes.txt"));
    await screen.findByRole("button", { name: /copy path/i });
    fireEvent.click(getPreviewTerminalToggleButton());

    await screen.findByTestId("mock-preview-terminal");
    fireEvent.click(screen.getByRole("button", { name: "Report Alpha Cwd" }));

    await waitFor(() => {
      expect(useExplorerStore.getState().session.currentPath).toBe(
        `${REPO_ROOT}\\alpha`,
      );
      expect(screen.getByText("inside-alpha.txt")).toBeInTheDocument();
      expect(previewTerminalMockState.lastProps?.workingDirectory).toBe(
        `${REPO_ROOT}\\alpha`,
      );
    });
  });

  it("normalizes malformed navigation snapshots before storing explorer history", async () => {
    const alphaEntries = [
      {
        name: "inside-alpha.txt",
        path: `${REPO_ROOT}\\alpha\\inside-alpha.txt`,
        is_dir: false,
        size: 64,
        modified: 0,
        extension: "txt",
        is_hidden: false,
        is_symlink: false,
      },
    ];
    const baseInvokeImplementation = vi.mocked(invoke).getMockImplementation();
    if (!baseInvokeImplementation) {
      throw new Error("Missing default invoke mock implementation");
    }

    vi.mocked(invoke).mockImplementation(
      async (command: string, args?: unknown) => {
        const payload = args as { path?: string } | undefined;
        if (
          (command === "fs_list_dir" || command === "fs_list_dir_uncached") &&
          payload?.path === `${REPO_ROOT}\\alpha`
        ) {
          return alphaEntries;
        }
        return baseInvokeImplementation(command, args as never);
      },
    );

    explorerPolicyMockState.returnNullHistoryOnNextNavigate = true;

    renderExplorer();
    await screen.findByText("notes.txt");

    fireEvent.click(screen.getByText("notes.txt"));
    await screen.findByRole("button", { name: /copy path/i });
    fireEvent.click(getPreviewTerminalToggleButton());

    await screen.findByTestId("mock-preview-terminal");
    fireEvent.click(screen.getByRole("button", { name: "Report Alpha Cwd" }));

    await waitFor(() => {
      expect(useExplorerStore.getState().session.currentPath).toBe(
        `${REPO_ROOT}\\alpha`,
      );
      expect(useExplorerStore.getState().session.history).toEqual(
        expect.arrayContaining([`${REPO_ROOT}\\alpha`]),
      );
      const history = useExplorerStore.getState().session.history;
      expect(history[history.length - 1]).toBe(`${REPO_ROOT}\\alpha`);
      expect(screen.getByText("inside-alpha.txt")).toBeInTheDocument();
    });
  });

  it("splits the preview into a local pane without mutating workspace layout and keeps it live-synced", async () => {
    renderExplorer();
    await screen.findByText("preview.png");

    fireEvent.click(screen.getByText("preview.png"));

    expect(
      await screen.findByTestId("mock-explorer-image-editor"),
    ).toHaveTextContent("preview.png");

    fireEvent.click(getPreviewSplitToggleButton());

    await waitFor(() => {
      expect(useExplorerStore.getState().session.previewSplitMode).toBe("pane");
      expect(getActiveWorkspaceLayoutMode()).toBe("single");
      expect(
        document.querySelectorAll('[data-overlay-explorer-plane="file-area"]'),
      ).toHaveLength(1);
      expect(getPreviewPane()).toHaveAttribute(
        "data-overlay-explorer-preview-split-mode",
        "pane",
      );
    });

    fireEvent.click(screen.getByText("notes.txt"));

    expect(await screen.findByTestId("monaco-editor")).toHaveTextContent(
      "hello from preview",
    );
    expect(useExplorerStore.getState().session.previewSplitMode).toBe("pane");
    expect(getActiveWorkspaceLayoutMode()).toBe("single");
  });

  it("preserves preview width drag resize behavior while split mode is active", async () => {
    renderExplorer();
    await screen.findByText("preview.png");

    fireEvent.click(screen.getByText("preview.png"));
    expect(
      await screen.findByTestId("mock-explorer-image-editor"),
    ).toHaveTextContent("preview.png");

    fireEvent.click(getPreviewSplitToggleButton());
    await waitFor(() => {
      expect(useExplorerStore.getState().session.previewSplitMode).toBe("pane");
    });
    await waitFor(() => {
      expect(useExplorerStore.getState().session.previewWidth).not.toBeNull();
    });

    const initialWidth = useExplorerStore.getState().session.previewWidth ?? 0;

    fireEvent.mouseDown(getPreviewResizeHandle(), { clientX: 600 });
    fireEvent.mouseMove(window, { clientX: 520 });
    fireEvent.mouseUp(window);

    let resizedWidth = initialWidth;
    await waitFor(() => {
      resizedWidth = useExplorerStore.getState().session.previewWidth ?? 0;
      expect(resizedWidth).toBeGreaterThan(initialWidth);
    });

    fireEvent.mouseDown(getPreviewResizeHandle(), { clientX: 900 });
    fireEvent.mouseMove(window, { clientX: -900 });
    fireEvent.mouseUp(window);

    await waitFor(() => {
      expect(useExplorerStore.getState().session.previewWidth).toBe(
        EXPLORER_PREVIEW_WIDTH_BOUNDS.max,
      );
    });
    resizedWidth = useExplorerStore.getState().session.previewWidth ?? 0;

    fireEvent.click(screen.getByText("anthem.mp3"));

    expect(
      await screen.findByTestId("mock-explorer-audio-workbench"),
    ).toHaveTextContent("anthem.mp3");
    expect(useExplorerStore.getState().session.previewWidth).toBe(resizedWidth);
    expect(getPreviewPane()).toHaveAttribute(
      "data-overlay-explorer-preview-split-mode",
      "pane",
    );
  });

  it("keeps split pdf previews open when the close guard blocks destructive close flows", async () => {
    const pdfEntry = {
      name: "forms.pdf",
      path: `${REPO_ROOT}\\\\forms.pdf`,
      is_dir: false,
      size: 512 * 1024,
      modified: 0,
      extension: "pdf",
      is_hidden: false,
      is_symlink: false,
    } as const;
    const baseInvokeImplementation = vi.mocked(invoke).getMockImplementation();
    if (!baseInvokeImplementation) {
      throw new Error("Missing default invoke mock implementation");
    }

    pdfPreviewMockState.closeGuardResult = false;
    vi.mocked(invoke).mockImplementation(
      async (command: string, args?: unknown) => {
        if (command === "fs_list_dir" || command === "fs_list_dir_uncached") {
          return [...ENTRIES, pdfEntry];
        }
        if (command === "pdf_open_preview_document") {
          return {
            sessionId: "pdf-session-1",
            path: pdfEntry.path,
            name: pdfEntry.name,
            pageCount: 2,
            pages: [
              { pageIndex: 0, widthPoints: 612, heightPoints: 792 },
              { pageIndex: 1, widthPoints: 612, heightPoints: 792 },
            ],
            formFields: [],
          };
        }
        if (command === "pdf_close_preview_document") {
          return null;
        }
        return baseInvokeImplementation(command, args as never);
      },
    );

    renderExplorer();
    await screen.findByText("forms.pdf");

    fireEvent.click(screen.getByText("forms.pdf"));
    expect(
      await screen.findByTestId("mock-explorer-pdf-workbench"),
    ).toHaveTextContent("forms.pdf");

    fireEvent.click(getPreviewSplitToggleButton());
    await waitFor(() => {
      expect(useExplorerStore.getState().session.previewSplitMode).toBe("pane");
    });

    fireEvent.click(getPreviewCloseButton());

    await waitFor(() => {
      expect(
        screen.getByTestId("mock-explorer-pdf-workbench"),
      ).toHaveTextContent("forms.pdf");
      expect(getActiveWorkspaceLayoutMode()).toBe("single");
    });

    fireEvent.click(getToolbarPreviewToggleButton());

    await waitFor(() => {
      expect(useExplorerStore.getState().session.previewEnabled).toBe(true);
      expect(
        screen.getByTestId("mock-explorer-pdf-workbench"),
      ).toHaveTextContent("forms.pdf");
    });
  });

  it("closes split previews cleanly and reopens them in the remembered pane mode", async () => {
    renderExplorer();
    await screen.findByText("preview.png");

    fireEvent.click(screen.getByText("preview.png"));
    expect(
      await screen.findByTestId("mock-explorer-image-editor"),
    ).toHaveTextContent("preview.png");

    fireEvent.click(getPreviewSplitToggleButton());
    await waitFor(() => {
      expect(useExplorerStore.getState().session.previewSplitMode).toBe("pane");
    });

    fireEvent.click(getPreviewCloseButton());

    await waitFor(() => {
      expect(queryPreviewPane()).toBeNull();
      expect(getChromeControl("previewSplitToggle")).toBeNull();
    });

    expect(getActiveWorkspaceLayoutMode()).toBe("single");

    fireEvent.click(screen.getByText("preview.png"));
    expect(
      await screen.findByTestId("mock-explorer-image-editor"),
    ).toHaveTextContent("preview.png");
    expect(getPreviewPane()).toHaveAttribute(
      "data-overlay-explorer-preview-split-mode",
      "pane",
    );
  });

  it("keeps the previous fast preview mounted and only shows preview loading chrome after the delay threshold", async () => {
    const textLoad = createDeferred<string>();
    const defaultInvoke = vi.mocked(invoke).getMockImplementation();
    if (!defaultInvoke) {
      throw new Error("Expected default invoke mock implementation");
    }

    vi.mocked(invoke).mockImplementation(
      async (command: string, args?: unknown) => {
        const payload = args as { path?: string } | undefined;
        if (
          command === "fs_read_text_file" &&
          payload?.path === `${REPO_ROOT}\\notes.txt`
        ) {
          return textLoad.promise;
        }
        return defaultInvoke(command, args as never);
      },
    );

    useExplorerStore.getState().updateSession({ documentViewMode: "preview" });

    renderExplorer();
    await screen.findByText("preview.png");

    fireEvent.click(screen.getByText("preview.png"));
    expect(
      await screen.findByTestId("mock-explorer-image-editor"),
    ).toHaveTextContent("preview.png");

    vi.useFakeTimers();
    fireEvent.click(screen.getByText("notes.txt"));
    expect(screen.getByTestId("mock-explorer-image-editor")).toHaveTextContent(
      "preview.png",
    );
    expect(screen.queryByText(/loading editor/i)).toBeNull();
    expect(screen.queryByText(/^Loading…$/)).toBeNull();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(140);
    });
    expect(screen.queryByText(/^Loading…$/)).toBeNull();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(20);
    });
    expect(screen.getByText(/^Loading…$/)).toBeInTheDocument();

    await act(async () => {
      textLoad.resolve("const value = 1;");
      await Promise.resolve();
    });

    expect(screen.getByTestId("monaco-editor")).toHaveTextContent("const value = 1;");
    expect(screen.queryByText(/^Loading…$/)).toBeNull();
  });

  it("prefetches adjacent text and image previews for the active selection", async () => {
    const invokeMock = vi.mocked(invoke);
    const baseInvokeImplementation = invokeMock.getMockImplementation();
    if (!baseInvokeImplementation) {
      throw new Error("Missing default invoke mock implementation");
    }
    const prefetchEntries = [
      {
        name: "alpha.txt",
        path: `${REPO_ROOT}\\\\alpha.txt`,
        is_dir: false,
        size: 64,
        modified: 0,
        extension: "txt",
        is_hidden: false,
        is_symlink: false,
      },
      {
        name: "beta.txt",
        path: `${REPO_ROOT}\\\\beta.txt`,
        is_dir: false,
        size: 96,
        modified: 0,
        extension: "txt",
        is_hidden: false,
        is_symlink: false,
      },
      {
        name: "gamma.png",
        path: `${REPO_ROOT}\\\\gamma.png`,
        is_dir: false,
        size: 2048,
        modified: 0,
        extension: "png",
        is_hidden: false,
        is_symlink: false,
      },
    ];

    invokeMock.mockImplementation(async (command: string, args?: unknown) => {
      if (command === "fs_list_dir" || command === "fs_list_dir_uncached") {
        return prefetchEntries;
      }
      return baseInvokeImplementation(command, args as never);
    });

    renderExplorer();
    await screen.findByText("beta.txt");

    fireEvent.click(screen.getByText("beta.txt"));
    expect(await screen.findByTestId("monaco-editor")).toHaveTextContent(
      "hello from preview",
    );

    await waitFor(() => {
      expect(
        invokeMock.mock.calls.some(
          ([command, args]) =>
            command === "fs_read_text_file" &&
            (args as { path?: string } | undefined)?.path ===
              `${REPO_ROOT}\\\\alpha.txt`,
        ),
      ).toBe(true);
      expect(
        invokeMock.mock.calls.some(
          ([command, args]) =>
            command === "fs_read_file_base64" &&
            (args as { path?: string } | undefined)?.path ===
              `${REPO_ROOT}\\\\gamma.png`,
        ),
      ).toBe(true);
    });
  });

  it("shows Monaco text preview metrics and cursor location in the preview status strip", async () => {
    const baseInvokeImplementation = vi.mocked(invoke).getMockImplementation();
    if (!baseInvokeImplementation) {
      throw new Error("Missing default invoke mock implementation");
    }

    vi.mocked(invoke).mockImplementation(
      async (command: string, args?: unknown) => {
        const payload = args as { path?: string } | undefined;
        if (
          command === "fs_read_text_file" &&
          payload?.path === `${REPO_ROOT}\\notes.txt`
        ) {
          return "alpha beta\ngamma";
        }
        return baseInvokeImplementation(command, args as never);
      },
    );

    renderExplorer();
    await screen.findByText("notes.txt");

    fireEvent.click(screen.getByText("notes.txt"));

    expect(await screen.findByTestId("monaco-editor")).toHaveTextContent(
      "alpha beta gamma",
    );
    await waitFor(() => {
      expect(screen.getByTestId("text-preview-metrics")).toHaveTextContent(
        "16 chars · 3 words · 2 lines",
      );
    });
    expect(screen.getByTestId("text-preview-cursor")).toHaveTextContent(
      "Ln 1, Col 1",
    );
  });

  it("opens markdown files in rendered preview mode with themed document surfaces", async () => {
    const markdownEntry = {
      name: "ship-notes.md",
      path: `${REPO_ROOT}\\ship-notes.md`,
      is_dir: false,
      size: 512,
      modified: 0,
      extension: "md",
      is_hidden: false,
      is_symlink: false,
    };
    const baseInvokeImplementation = vi.mocked(invoke).getMockImplementation();
    if (!baseInvokeImplementation) {
      throw new Error("Missing default invoke mock implementation");
    }

    vi.mocked(invoke).mockImplementation(
      async (command: string, args?: unknown) => {
        const payload = args as { path?: string } | undefined;
        if (command === "fs_list_dir" || command === "fs_list_dir_uncached") {
          return [...ENTRIES, markdownEntry];
        }
        if (
          command === "fs_read_text_file" &&
          payload?.path === markdownEntry.path
        ) {
          return `# Ship Notes

Inline \`code\`

\`\`\`ts
const value = 1;
\`\`\``;
        }
        return baseInvokeImplementation(command, args as never);
      },
    );

    renderExplorer();
    await screen.findByText("ship-notes.md");

    fireEvent.click(screen.getByText("ship-notes.md"));

    await waitFor(() => {
      expect(useExplorerStore.getState().session.documentViewMode).toBe(
        "preview",
      );
    });
    const markdownPreviewRoot = await screen.findByTestId(
      "document-preview-root",
    );
    expect(markdownPreviewRoot).toHaveAttribute(
      "data-document-preview-kind",
      "markdown",
    );
    expect(markdownPreviewRoot.style.background).toBe(
      "var(--overlay-explorer-preview-bg)",
    );
    expect(
      await screen.findByTestId("document-preview-article"),
    ).toHaveTextContent("Ship Notes");
    expectChromeControlButtonOrder("previewModeToggle", ["Preview", "Edit"]);
    expect(screen.queryByTestId("monaco-editor")).toBeNull();
  });

  it("opens html files in preview mode when a rendered document preview is available", async () => {
    renderExplorer();
    await screen.findByText("index.html");

    fireEvent.click(screen.getByText("index.html"));

    await waitFor(() => {
      expect(useExplorerStore.getState().session.documentViewMode).toBe(
        "preview",
      );
    });
    expect(
      await screen.findByTitle("HTML document preview"),
    ).toBeInTheDocument();
    expectChromeControlButtonOrder("previewModeToggle", ["Preview", "Edit"]);
    expect(screen.queryByTestId("monaco-editor")).toBeNull();
  });

  it("opens spreadsheet previews in preview mode and lets the shared preview header switch to edit", async () => {
    const spreadsheetEntry = {
      name: "colors.csv",
      path: `${REPO_ROOT}\\colors.csv`,
      is_dir: false,
      size: 512,
      modified: 0,
      extension: "csv",
      is_hidden: false,
      is_symlink: false,
    };
    const defaultInvoke = vi.mocked(invoke).getMockImplementation();
    if (!defaultInvoke) {
      throw new Error("Missing default invoke mock implementation");
    }

    vi.mocked(invoke).mockImplementation(
      async (command: string, args?: unknown) => {
        if (command === "fs_list_dir" || command === "fs_list_dir_uncached") {
          return [...ENTRIES, spreadsheetEntry];
        }
        return defaultInvoke(command, args as never);
      },
    );

    renderExplorer();
    await screen.findByText("colors.csv");

    fireEvent.click(screen.getByText("colors.csv"));

    expect(
      await screen.findByTestId("mock-explorer-spreadsheet-workbench"),
    ).toHaveTextContent("colors.csv:preview");
    await waitFor(() => {
      expect(useExplorerStore.getState().session.documentViewMode).toBe(
        "preview",
      );
    });
    expectChromeControlButtonOrder("previewModeToggle", ["Preview", "Edit"]);

    fireEvent.click(
      within(getPreviewPane()).getByRole("button", { name: /^edit$/i }),
    );

    await waitFor(() => {
      expect(useExplorerStore.getState().session.documentViewMode).toBe("edit");
    });
    expect(
      await screen.findByTestId("mock-explorer-spreadsheet-workbench"),
    ).toHaveTextContent("colors.csv:edit");
  });

  it("keeps inline previews closed in dock mode", async () => {
    renderExplorer({ layoutMode: "dock" });
    await screen.findByText("notes.txt");

    fireEvent.click(screen.getByText("notes.txt"));

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: /copy path/i })).toBeNull();
    });
    expect(
      vi
        .mocked(invoke)
        .mock.calls.some(([command]) => command === "fs_read_text_file"),
    ).toBe(false);
  });

  it("closes an open inline preview when switching into dock mode and keeps it closed on return", async () => {
    const { appearance, rerender } = renderExplorer();
    await screen.findByText("notes.txt");

    fireEvent.click(screen.getByText("notes.txt"));
    await screen.findByRole("button", { name: /copy path/i });

    rerender(
      <FileExplorer
        theme={{
          accent: appearance.theme.palette.accent,
          bg: appearance.theme.palette.appBackground,
          bgPanel: appearance.theme.palette.panelBackground,
          text: appearance.theme.palette.textPrimary,
          border: appearance.theme.palette.border,
          textMuted: appearance.theme.palette.textMuted,
        }}
        appearance={appearance}
        layoutMode="dock"
        onOpenInTerminal={() => {}}
        onAddBookmark={async () => {}}
      />,
    );

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: /copy path/i })).toBeNull();
    });

    rerender(
      <FileExplorer
        theme={{
          accent: appearance.theme.palette.accent,
          bg: appearance.theme.palette.appBackground,
          bgPanel: appearance.theme.palette.panelBackground,
          text: appearance.theme.palette.textPrimary,
          border: appearance.theme.palette.border,
          textMuted: appearance.theme.palette.textMuted,
        }}
        appearance={appearance}
        layoutMode="full"
        onOpenInTerminal={() => {}}
        onAddBookmark={async () => {}}
      />,
    );

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: /copy path/i })).toBeNull();
    });
  });

  it("ignores stale directory responses after a newer refresh updates the explorer state", async () => {
    const lateDirectoryResponse = createDeferred<(typeof ENTRIES)[number][]>();
    const hiddenEntry = {
      name: "secret.txt",
      path: `${REPO_ROOT}\\secret.txt`,
      is_dir: false,
      size: 96,
      modified: 0,
      extension: "txt",
      is_hidden: true,
      is_symlink: false,
    } as const;

    vi.mocked(invoke).mockReset();
    vi.mocked(invoke).mockImplementation(
      async (command: string, args?: unknown) => {
        const payload = args as
          | {
              path?: string;
              paths?: string[];
              request?: {
                path?: string;
                maxWidth?: number;
                maxHeight?: number;
                includeVideoHoverScrub?: boolean | null;
                videoHoverFrameCount?: number | null;
              };
              showHidden?: boolean;
            }
          | undefined;
        switch (command) {
          case "fs_get_drives":
            return [];
          case "fs_get_home_dir":
            return REPO_ROOT;
          case "fs_is_process_elevated":
            return false;
          case "fs_get_runtime_cache_policy":
            return {
              dirListCacheTtlMs: 2000,
              searchNameIndexCacheTtlMs: 1500,
              searchContentIndexCacheTtlMs: 1000,
              entrySizeCacheTtlMs: 10000,
              entrySizeScanBudgetMs: 900,
              searchContentIndexTotalBytesBudget: 12 * 1024 * 1024,
              maxSearchContentFileBytes: 8 * 1024 * 1024,
              searchMaxIndexedEntries: 25000,
            };
          case "fs_list_dir":
            return lateDirectoryResponse.promise;
          case "fs_list_dir_uncached":
            return payload?.showHidden ? [...ENTRIES, hiddenEntry] : ENTRIES;
          case "fs_read_text_file":
            return "hello from preview";
          case "fs_read_file_base64":
            return "data:text/plain;base64,aGVsbG8=";
          case "fs_read_image_thumbnail":
            return "data:image/png;base64,ZmFrZQ==";
          case "fs_read_entry_thumbnail":
            return createMockEntryThumbnail(payload?.request?.path);
          case "fs_read_entry_thumbnail_artifact":
            return createMockEntryThumbnailArtifact(payload?.request?.path);
          case "fs_measure_entry_sizes":
            return (payload?.paths ?? []).map((path) => ({
              path,
              bytes:
                [...ENTRIES, hiddenEntry].find((entry) => entry.path === path)
                  ?.size ?? 0,
              is_dir:
                [...ENTRIES, hiddenEntry].find((entry) => entry.path === path)
                  ?.is_dir ?? false,
              is_complete: true,
            }));
          case "fs_resolve_native_icons":
            return [];
          case "fs_search_entries_with_diagnostics":
            return {
              results: [],
              diagnostics: {
                executionStrategy: "live_scan",
                contentCacheStatus: "not_requested",
                scannedEntryCount: 0,
                indexedEntryCount: 0,
                contentCacheStoredFileCount: 0,
                contentCacheStoredByteCount: 0,
                truncatedByScanBudget: false,
              },
            };
          case "fs_watch_entry_size_root":
          case "fs_unwatch_entry_size_root":
          case "fs_cancel_search_entries":
          case "fs_start_native_file_drag":
            return null;
          default:
            throw new Error(`Unexpected invoke command: ${command}`);
        }
      },
    );

    renderExplorer();

    await waitFor(() => {
      expect(
        vi
          .mocked(invoke)
          .mock.calls.some(([command]) => command === "fs_list_dir"),
      ).toBe(true);
    });

    useSettingsStore.getState().updateExplorer({ showHiddenFiles: true });

    await screen.findByText("secret.txt");

    lateDirectoryResponse.resolve([...ENTRIES]);

    await waitFor(() => {
      expect(screen.getByText("secret.txt")).toBeTruthy();
    });
  });

  it("does not trip the boot navigation mount path under StrictMode", async () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const appearance = resolveOverlayAppearance({ activeThemeId: "operator" });

    const { unmount } = render(
      <React.StrictMode>
        <FileExplorer
          theme={{
            accent: appearance.theme.palette.accent,
            bg: appearance.theme.palette.appBackground,
            bgPanel: appearance.theme.palette.panelBackground,
            text: appearance.theme.palette.textPrimary,
            border: appearance.theme.palette.border,
            textMuted: appearance.theme.palette.textMuted,
          }}
          appearance={appearance}
          onOpenInTerminal={() => {}}
          onAddBookmark={async () => {}}
        />
      </React.StrictMode>,
    );

    await screen.findByText("alpha");
    unmount();
    expect(consoleErrorSpy).not.toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });

  it("ignores stale properties checksum completions after an explorer tab remount", async () => {
    const propertiesPath = `${REPO_ROOT}\\notes.txt`;
    const firstChecksumResponse = createDeferred<
      Array<{
        path: string;
        bytes: number;
        isDir: boolean;
        md5: string | null;
        sha256: string | null;
        error: string | null;
      }>
    >();
    const secondChecksumResponse = createDeferred<
      Array<{
        path: string;
        bytes: number;
        isDir: boolean;
        md5: string | null;
        sha256: string | null;
        error: string | null;
      }>
    >();
    const defaultInvokeImplementation = vi
      .mocked(invoke)
      .getMockImplementation();
    let checksumCallCount = 0;

    vi.mocked(invoke).mockImplementation(
      async (command: string, args?: Parameters<typeof invoke>[1]) => {
        const payload = args as { path?: string } | undefined;
        switch (command) {
          case "fs_calculate_checksums":
            checksumCallCount += 1;
            return checksumCallCount === 1
              ? firstChecksumResponse.promise
              : secondChecksumResponse.promise;
          case "fs_get_item_properties":
            return {
              path: payload?.path ?? propertiesPath,
              name: "notes.txt",
              isDir: false,
              isSymlink: false,
              bytes: 128,
              modifiedAtMs: 0,
              createdAtMs: 0,
              accessedAtMs: 0,
              permissions: {
                readonly: false,
                display: "rw-rw-rw-",
                unixMode: null,
                unixModeOctal: null,
              },
            };
          default:
            if (!defaultInvokeImplementation) {
              throw new Error(`Unexpected invoke command: ${command}`);
            }
            return defaultInvokeImplementation(command, args);
        }
      },
    );

    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const appearance = resolveOverlayAppearance({ activeThemeId: "operator" });
    const renderExplorerTab = (instanceId: string) =>
      render(
        <FileExplorer
          theme={{
            accent: appearance.theme.palette.accent,
            bg: appearance.theme.palette.appBackground,
            bgPanel: appearance.theme.palette.panelBackground,
            text: appearance.theme.palette.textPrimary,
            border: appearance.theme.palette.border,
            textMuted: appearance.theme.palette.textMuted,
          }}
          appearance={appearance}
          instanceId={instanceId}
          onOpenInTerminal={() => {}}
          onAddBookmark={async () => {}}
        />,
      );

    const firstExplorer = renderExplorerTab("tab-alpha");
    await screen.findByText("notes.txt");

    await act(async () => {
      useExplorerStore.getState().setPropertiesPanel({
        loading: false,
        targetPaths: [propertiesPath],
        tab: "checksums",
        visible: true,
      });
    });

    await waitFor(() => {
      expect(checksumCallCount).toBe(1);
    });

    firstExplorer.unmount();

    renderExplorerTab("tab-bravo");
    await waitFor(() => {
      expect(screen.getAllByText("notes.txt").length).toBeGreaterThan(0);
    });
    await waitFor(() => {
      expect(checksumCallCount).toBe(2);
    });

    await act(async () => {
      firstChecksumResponse.resolve([
        {
          path: propertiesPath,
          bytes: 128,
          isDir: false,
          md5: "11111111111111111111111111111111",
          sha256:
            "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          error: null,
        },
      ]);
      await firstChecksumResponse.promise;
    });

    expect(consoleErrorSpy).not.toHaveBeenCalled();

    await act(async () => {
      secondChecksumResponse.resolve([
        {
          path: propertiesPath,
          bytes: 128,
          isDir: false,
          md5: "22222222222222222222222222222222",
          sha256:
            "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
          error: null,
        },
      ]);
      await secondChecksumResponse.promise;
    });

    expect(consoleErrorSpy).not.toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });

  it("shows fallback preview states for oversized text and broken image previews", async () => {
    renderExplorer();
    await screen.findByText("large.txt");

    fireEvent.click(screen.getByText("large.txt"));
    await screen.findByText(/text preview unavailable/i);
    expect(screen.getByText(/file is too large to preview/i)).toBeTruthy();

    fireEvent.click(screen.getByText("broken.png"));
    await screen.findByText(/image preview unavailable/i);
    expect(screen.getByText(/file is too large to preview/i)).toBeTruthy();
  });

  it("shows the unsupported fallback without routing the file through text or image loaders", async () => {
    renderExplorer();
    await screen.findByText("mystery.bin");

    vi.mocked(invoke).mockClear();
    fireEvent.click(screen.getByText("mystery.bin"));

    await screen.findByText(/preview unavailable/i);
    expect(
      vi
        .mocked(invoke)
        .mock.calls.some(
          ([command, args]) =>
            command === "fs_read_text_file" &&
            (args as { path?: string } | undefined)?.path ===
              `${REPO_ROOT}\\mystery.bin`,
        ),
    ).toBe(false);
    expect(
      vi
        .mocked(invoke)
        .mock.calls.some(
          ([command, args]) =>
            command === "fs_read_file_base64" &&
            (args as { path?: string } | undefined)?.path ===
              `${REPO_ROOT}\\mystery.bin`,
        ),
    ).toBe(false);
  });

  it("mounts the embedded audio workbench for previewable audio files without routing them through text loading", async () => {
    renderExplorer();
    await screen.findByText("anthem.mp3");

    fireEvent.click(screen.getByText("anthem.mp3"));

    const audioWorkbench = await screen.findByTestId(
      "mock-explorer-audio-workbench",
    );
    expect(audioWorkbench).toHaveTextContent("anthem.mp3:preview");
    expect(useExplorerStore.getState().session.documentViewMode).toBe(
      "preview",
    );
    const previewModeToggle = getChromeControl("previewModeToggle");
    expect(previewModeToggle).not.toBeNull();
    expectChromeControlButtonOrder("previewModeToggle", [
      "Preview",
      "Edit",
      "VST",
    ]);
    fireEvent.click(
      within(previewModeToggle as HTMLElement).getByRole("button", {
        name: "Edit",
      }),
    );

    expect(
      await screen.findByTestId("mock-explorer-audio-workbench"),
    ).toHaveTextContent("anthem.mp3:edit");

    fireEvent.click(
      within(previewModeToggle as HTMLElement).getByRole("button", {
        name: "VST",
      }),
    );

    expect(
      await screen.findByTestId("mock-explorer-audio-workbench"),
    ).toHaveTextContent("anthem.mp3:vst");
    expect(
      vi
        .mocked(invoke)
        .mock.calls.some(([command]) => command === "fs_read_text_file"),
    ).toBe(false);
  });

  it("routes explorer entry and preview workflow tab motion through the shared interaction resolver", async () => {
    renderExplorer();
    await screen.findByText("anthem.mp3");

    const entrySurface = screen
      .getByText("anthem.mp3")
      .closest('[data-interaction-motion-surface="explorerEntry"]') as HTMLElement | null;
    expect(entrySurface).not.toBeNull();
    expect(entrySurface).toHaveAttribute(
      "data-interaction-motion-surface",
      "explorerEntry",
    );

    fireEvent.pointerEnter(entrySurface as HTMLElement);
    expect((entrySurface as HTMLElement).style.transform).toContain(
      "translate3d",
    );

    fireEvent.click(screen.getByText("anthem.mp3"));
    const previewModeToggle = await waitFor(() => {
      const control = getChromeControl("previewModeToggle");
      expect(control).not.toBeNull();
      return control as HTMLElement;
    });
    const previewButton = within(previewModeToggle).getByRole("button", {
      name: "Preview",
    });
    expect(previewButton).toHaveAttribute(
      "data-interaction-motion-surface",
      "previewWorkflowTab",
    );
  });

  it("toggles audio preview and edit mode from the shared audio workbench hotkey", async () => {
    renderExplorer();
    await screen.findByText("anthem.mp3");

    fireEvent.click(screen.getByText("anthem.mp3"));

    expect(
      await screen.findByTestId("mock-explorer-audio-workbench"),
    ).toHaveTextContent("anthem.mp3:preview");

    fireEvent.keyDown(window, { key: "e" });

    await waitFor(() => {
      expect(useExplorerStore.getState().session.documentViewMode).toBe("edit");
      expect(
        screen.getByTestId("mock-explorer-audio-workbench"),
      ).toHaveTextContent("anthem.mp3:edit");
    });

    fireEvent.click(
      within(getChromeControl("previewModeToggle") as HTMLElement).getByRole(
        "button",
        {
          name: "VST",
        },
      ),
    );

    await waitFor(() => {
      expect(
        screen.getByTestId("mock-explorer-audio-workbench"),
      ).toHaveTextContent("anthem.mp3:vst");
    });

    fireEvent.keyDown(window, { key: "e" });

    await waitFor(() => {
      expect(useExplorerStore.getState().session.documentViewMode).toBe(
        "preview",
      );
      expect(
        screen.getByTestId("mock-explorer-audio-workbench"),
      ).toHaveTextContent("anthem.mp3:preview");
    });
  });

  it("resets wildcard workflow tabs when preview kind changes away from audio", async () => {
    renderExplorer();
    await screen.findByText("anthem.mp3");

    fireEvent.click(screen.getByText("anthem.mp3"));
    await screen.findByTestId("mock-explorer-audio-workbench");
    expectChromeControlButtonOrder("previewModeToggle", [
      "Preview",
      "Edit",
      "VST",
    ]);

    fireEvent.click(
      within(getChromeControl("previewModeToggle") as HTMLElement).getByRole(
        "button",
        {
          name: "VST",
        },
      ),
    );
    await waitFor(() => {
      expect(
        screen.getByTestId("mock-explorer-audio-workbench"),
      ).toHaveTextContent("anthem.mp3:vst");
    });

    fireEvent.click(screen.getByText("trailer.mp4"));
    await screen.findByTestId("mock-explorer-video-editor");
    expectChromeControlButtonOrder("previewModeToggle", ["Preview", "Edit"]);
    expect(
      within(getChromeControl("previewModeToggle") as HTMLElement).queryByRole(
        "button",
        {
          name: "VST",
        },
      ),
    ).toBeNull();
  });

  it("defaults videos to playback preview and only enters video edit mode when requested", async () => {
    renderExplorer();
    await screen.findByText("trailer.mp4");

    fireEvent.click(screen.getByText("trailer.mp4"));

    const videoWorkbench = await screen.findByTestId(
      "mock-explorer-video-editor",
    );
    expect(videoWorkbench).toHaveTextContent("trailer.mp4:preview");

    const previewModeToggle = getChromeControl("previewModeToggle");
    expect(previewModeToggle).not.toBeNull();
    expectChromeControlButtonOrder("previewModeToggle", ["Preview", "Edit"]);
    fireEvent.click(
      within(previewModeToggle as HTMLElement).getByRole("button", {
        name: "Edit",
      }),
    );

    expect(
      await screen.findByTestId("mock-explorer-video-editor"),
    ).toHaveTextContent("trailer.mp4:edit");
    expect(
      vi
        .mocked(invoke)
        .mock.calls.some(([command]) => command === "fs_read_text_file"),
    ).toBe(false);
  });

  it("routes shader files into the inline shader workbench and renders shader preview chrome", async () => {
    renderExplorer();
    await screen.findByText("aaa_surface.wgsl");

    fireEvent.click(screen.getByText("aaa_surface.wgsl"));

    expect(
      await screen.findByTestId("mock-explorer-shader-workbench"),
    ).toHaveTextContent("aaa_surface.wgsl");
    expect(
      vi
        .mocked(invoke)
        .mock.calls.some(([command]) => command === "shader_preview_inspect"),
    ).toBe(true);

    const previewModeToggle = getChromeControl("previewModeToggle");
    expect(previewModeToggle).not.toBeNull();
    expectChromeControlButtonOrder("previewModeToggle", ["Preview", "Edit"]);
    expect(
      within(previewModeToggle as HTMLElement).getByRole("button", {
        name: "Preview",
      }),
    ).toBeInTheDocument();
    expect(
      within(previewModeToggle as HTMLElement).getByRole("button", {
        name: "Edit",
      }),
    ).toBeInTheDocument();
    expect(
      within(previewModeToggle as HTMLElement).getByRole("button", {
        name: "Sphere",
      }),
    ).toBeInTheDocument();
    expect(
      within(previewModeToggle as HTMLElement).getByRole("button", {
        name: "Fullscreen",
      }),
    ).toBeInTheDocument();
    expect(
      within(previewModeToggle as HTMLElement).getByRole("button", {
        name: "Save",
      }),
    ).toBeDisabled();
  });

  it("remembers shader stage selection per file and enables save only after dirty edits", async () => {
    renderExplorer();
    await screen.findByText("aaa_surface.wgsl");

    fireEvent.click(screen.getByText("aaa_surface.wgsl"));
    const shaderWorkbench = await screen.findByTestId(
      "mock-explorer-shader-workbench",
    );

    fireEvent.click(
      within(shaderWorkbench).getByRole("button", {
        name: "Select Shader Fragment",
      }),
    );
    await waitFor(() => {
      expect(shaderWorkbenchMockState.lastSelectionLabel).toBe(
        "fragment:shade",
      );
    });

    const previewModeToggle = getChromeControl(
      "previewModeToggle",
    ) as HTMLElement;
    const saveButton = within(previewModeToggle).getByRole("button", {
      name: "Save",
    });
    expect(saveButton).toBeDisabled();

    fireEvent.click(
      within(shaderWorkbench).getByRole("button", { name: "Dirty Shader" }),
    );
    await waitFor(() => {
      expect(saveButton).toBeEnabled();
    });

    fireEvent.click(saveButton);
    await waitFor(() => {
      expect(
        vi
          .mocked(invoke)
          .mock.calls.some(
            ([command, args]) =>
              command === "fs_write_file" &&
              (args as { path?: string } | undefined)?.path ===
                `${REPO_ROOT}\\aaa_surface.wgsl`,
          ),
      ).toBe(true);
    });

    fireEvent.click(screen.getByText("aab_lighting.hlsl"));
    await screen.findByText("aab_lighting.hlsl");

    fireEvent.click(screen.getByText("aaa_surface.wgsl"));
    await waitFor(() => {
      expect(shaderWorkbenchMockState.lastSelectionLabel).toBe(
        "fragment:shade",
      );
    });
  });

  it("shows folder contents in preview pane when a folder is single-clicked in double-click mode", async () => {
    const folderEntries = [
      {
        name: "shots",
        path: `${REPO_ROOT}\\alpha\\shots`,
        is_dir: true,
        size: 0,
        modified: 1713400000000,
        extension: "",
        is_hidden: false,
        is_symlink: false,
      },
      {
        name: "readme.md",
        path: `${REPO_ROOT}\\alpha\\readme.md`,
        is_dir: false,
        size: 1024,
        modified: 1713400000000,
        extension: "md",
        is_hidden: false,
        is_symlink: false,
      },
    ] as const;
    const baseInvokeImplementation = vi.mocked(invoke).getMockImplementation();
    if (!baseInvokeImplementation) {
      throw new Error("Missing default invoke mock implementation");
    }

    vi.mocked(invoke).mockImplementation(
      async (command: string, args?: unknown) => {
        const payload = args as
          | { path?: string; showHidden?: boolean }
          | undefined;
        if (
          (command === "fs_list_dir" || command === "fs_list_dir_uncached") &&
          payload?.path === `${REPO_ROOT}\\alpha`
        ) {
          return folderEntries;
        }
        return baseInvokeImplementation(command, args as never);
      },
    );

    renderExplorer();
    await screen.findByText("alpha");

    fireEvent.click(screen.getByText("alpha"));

    expect(await screen.findByText("Folder Contents")).toBeInTheDocument();
    expect(await screen.findByText("shots")).toBeInTheDocument();
    expect(await screen.findByText("readme.md")).toBeInTheDocument();
    expect(getExplorerViewport("readme.md")).toHaveClass(
      "overlay-scroll-area__viewport--explorer-file-list",
    );
    expect(
      screen.getByRole("button", { name: /copy path/i }),
    ).toBeInTheDocument();
  });

  it("lets folder preview rows drive explorer navigation and file opening", async () => {
    const alphaPath = `${REPO_ROOT}\\alpha`;
    const shotsPath = `${alphaPath}\\shots`;
    const alphaEntries = [
      {
        name: "shots",
        path: shotsPath,
        is_dir: true,
        size: 0,
        modified: 1713400000000,
        extension: "",
        is_hidden: false,
        is_symlink: false,
      },
      {
        name: "child.txt",
        path: `${alphaPath}\\child.txt`,
        is_dir: false,
        size: 512,
        modified: 1713400000000,
        extension: "txt",
        is_hidden: false,
        is_symlink: false,
      },
    ] as const;
    const shotsEntries = [
      {
        name: "take01.txt",
        path: `${shotsPath}\\take01.txt`,
        is_dir: false,
        size: 256,
        modified: 1713400000000,
        extension: "txt",
        is_hidden: false,
        is_symlink: false,
      },
    ] as const;
    const baseInvokeImplementation = vi.mocked(invoke).getMockImplementation();
    if (!baseInvokeImplementation) {
      throw new Error("Missing default invoke mock implementation");
    }

    vi.mocked(invoke).mockImplementation(
      async (command: string, args?: unknown) => {
        const payload = args as { path?: string } | undefined;
        if (command === "fs_list_dir" || command === "fs_list_dir_uncached") {
          if (payload?.path === alphaPath) {
            return alphaEntries;
          }
          if (payload?.path === shotsPath) {
            return shotsEntries;
          }
        }
        if (
          command === "fs_read_text_file" &&
          payload?.path === `${shotsPath}\\take01.txt`
        ) {
          return "hello from nested preview";
        }
        return baseInvokeImplementation(command, args as never);
      },
    );

    renderExplorer();
    await screen.findByText("alpha");

    fireEvent.click(screen.getByText("alpha"));

    const previewPane = getPreviewPane();
    await within(previewPane).findByRole("button", {
      name: /open folder shots/i,
    });

    fireEvent.click(
      within(previewPane).getByRole("button", { name: /open folder shots/i }),
    );

    await screen.findByText("take01.txt");
    await within(getPreviewPane()).findByRole("button", {
      name: /open file take01\.txt/i,
    });

    fireEvent.click(
      within(getPreviewPane()).getByRole("button", {
        name: /open file take01\.txt/i,
      }),
    );

    expect(await screen.findByTestId("monaco-editor")).toHaveTextContent(
      "hello from nested preview",
    );
  });

  it("lets the preview pane browse folders in place when jump to folder is off", async () => {
    const alphaPath = `${REPO_ROOT}\\alpha`;
    const shotsPath = `${alphaPath}\\shots`;
    const alphaEntries = [
      {
        name: "shots",
        path: shotsPath,
        is_dir: true,
        size: 0,
        modified: 1713400000000,
        extension: "",
        is_hidden: false,
        is_symlink: false,
      },
      {
        name: "child.txt",
        path: `${alphaPath}\\child.txt`,
        is_dir: false,
        size: 512,
        modified: 1713400000000,
        extension: "txt",
        is_hidden: false,
        is_symlink: false,
      },
    ] as const;
    const shotsEntries = [
      {
        name: "take01.txt",
        path: `${shotsPath}\\take01.txt`,
        is_dir: false,
        size: 256,
        modified: 1713400000000,
        extension: "txt",
        is_hidden: false,
        is_symlink: false,
      },
    ] as const;
    const baseInvokeImplementation = vi.mocked(invoke).getMockImplementation();
    if (!baseInvokeImplementation) {
      throw new Error("Missing default invoke mock implementation");
    }

    vi.mocked(invoke).mockImplementation(
      async (command: string, args?: unknown) => {
        const payload = args as { path?: string } | undefined;
        if (command === "fs_list_dir" || command === "fs_list_dir_uncached") {
          if (payload?.path === alphaPath) {
            return alphaEntries;
          }
          if (payload?.path === shotsPath) {
            return shotsEntries;
          }
        }
        if (
          command === "fs_read_text_file" &&
          payload?.path === `${shotsPath}\\take01.txt`
        ) {
          return "hello from nested preview";
        }
        return baseInvokeImplementation(command, args as never);
      },
    );

    renderExplorer();
    await screen.findByText("alpha");

    fireEvent.click(screen.getByText("alpha"));

    const previewPane = getPreviewPane();
    await within(previewPane).findByRole("button", {
      name: /open folder shots/i,
    });
    const jumpToggle = within(previewPane).getByRole("button", {
      name: /jump to folder/i,
    });
    expect(jumpToggle).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(jumpToggle);
    expect(
      within(getPreviewPane()).getByRole("button", { name: /jump to folder/i }),
    ).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(
      within(getPreviewPane()).getByRole("button", { name: /open folder shots/i }),
    );

    await within(getPreviewPane()).findByRole("button", {
      name: /open file take01\.txt/i,
    });
    expect(within(getExplorerContentViewport()).getByText("alpha")).toBeInTheDocument();
    expect(
      within(getExplorerContentViewport()).queryByText("take01.txt"),
    ).not.toBeInTheDocument();
    expect(getChromeControl("previewNavigateBack")).not.toBeNull();

    fireEvent.click(
      within(getPreviewPane()).getByRole("button", {
        name: /open file take01\.txt/i,
      }),
    );

    expect(await screen.findByTestId("monaco-editor")).toHaveTextContent(
      "hello from nested preview",
    );
    expect(within(getExplorerContentViewport()).getByText("alpha")).toBeInTheDocument();

    const previewBackControl = getChromeControl("previewNavigateBack");
    if (!(previewBackControl instanceof HTMLElement)) {
      throw new Error("Expected preview back control");
    }

    fireEvent.click(
      within(previewBackControl).getByRole("button", {
        name: /go back in preview/i,
      }),
    );

    await within(getPreviewPane()).findByRole("button", {
      name: /open file take01\.txt/i,
    });
    expect(
      within(getExplorerContentViewport()).queryByText("take01.txt"),
    ).not.toBeInTheDocument();

    fireEvent.click(within(getExplorerContentViewport()).getByText("notes.txt"));

    expect(await screen.findByTestId("monaco-editor")).toHaveTextContent(
      "hello from preview",
    );
    expect(getChromeControl("previewNavigateBack")).toBeNull();
  });

  it("routes folder preview row drags through the app-owned explorer drag runtime", async () => {
    const alphaPath = `${REPO_ROOT}\\alpha`;
    const alphaEntries = [
      {
        name: "notes-a.txt",
        path: `${alphaPath}\\notes-a.txt`,
        is_dir: false,
        size: 512,
        modified: 1713400000000,
        extension: "txt",
        is_hidden: false,
        is_symlink: false,
      },
      {
        name: "notes-b.txt",
        path: `${alphaPath}\\notes-b.txt`,
        is_dir: false,
        size: 768,
        modified: 1713400000000,
        extension: "txt",
        is_hidden: false,
        is_symlink: false,
      },
    ] as const;
    const baseInvokeImplementation = vi.mocked(invoke).getMockImplementation();
    if (!baseInvokeImplementation) {
      throw new Error("Missing default invoke mock implementation");
    }

    vi.mocked(invoke).mockImplementation(
      async (command: string, args?: unknown) => {
        const payload = args as { path?: string } | undefined;
        if (
          (command === "fs_list_dir" || command === "fs_list_dir_uncached") &&
          payload?.path === alphaPath
        ) {
          return alphaEntries;
        }
        return baseInvokeImplementation(command, args as never);
      },
    );

    renderExplorer();
    await screen.findByText("alpha");

    fireEvent.click(screen.getByText("alpha"));

    const previewPane = getPreviewPane();
    const firstPreviewRow = await within(previewPane).findByRole("button", {
      name: /open file notes-a\.txt/i,
    });
    const secondPreviewRow = within(previewPane).getByRole("button", {
      name: /open file notes-b\.txt/i,
    });

    fireEvent.click(firstPreviewRow, { ctrlKey: true });
    fireEvent.click(secondPreviewRow, { ctrlKey: true });

    const explorerRoot = document.querySelector(
      "[data-overlay-explorer]",
    ) as HTMLElement | null;
    if (!(explorerRoot instanceof HTMLElement)) {
      throw new Error("Expected explorer root");
    }

    const originalElementFromPoint = document.elementFromPoint;
    Object.defineProperty(document, "elementFromPoint", {
      configurable: true,
      value: vi.fn(() => explorerRoot),
    });

    try {
      const dragGesture = startExplorerPointerDrag(secondPreviewRow, {
        endX: 96,
        endY: 48,
      });
      expect(screen.getByTestId("explorer-drag-overlay")).toHaveTextContent("2");
      expect(screen.getByTestId("explorer-drag-overlay")).toHaveTextContent(
        "notes-b.txt",
      );
      finishExplorerPointerDrag(dragGesture);
    } finally {
      if (originalElementFromPoint) {
        Object.defineProperty(document, "elementFromPoint", {
          configurable: true,
          value: originalElementFromPoint,
        });
      } else {
        Reflect.deleteProperty(document, "elementFromPoint");
      }
    }

    await waitFor(() => {
      const transferCalls = vi
        .mocked(invoke)
        .mock.calls.filter(([command]) => command === "fs_transfer_items");
      expect(transferCalls).toHaveLength(1);
      expect(transferCalls[0]?.[1]).toMatchObject({
        targetDir: REPO_ROOT,
        sources: [`${alphaPath}\\notes-a.txt`, `${alphaPath}\\notes-b.txt`],
        operation: "move",
      });
    });
    expect(
      vi
        .mocked(invoke)
        .mock.calls.some(
          ([command]) => command === "fs_start_native_file_drag",
        ),
    ).toBe(false);
  });

  it("drops explorer files into the previewed folder and refreshes the preview lane", async () => {
    const alphaPath = `${REPO_ROOT}\\alpha`;
    let alphaEntries: Array<{
      name: string;
      path: string;
      is_dir: boolean;
      size: number;
      modified: number;
      extension: string;
      is_hidden: boolean;
      is_symlink: boolean;
    }> = [];
    const baseInvokeImplementation = vi.mocked(invoke).getMockImplementation();
    if (!baseInvokeImplementation) {
      throw new Error("Missing default invoke mock implementation");
    }

    vi.mocked(invoke).mockImplementation(
      async (command: string, args?: unknown) => {
        const payload = args as
          | {
              path?: string;
              targetDir?: string;
              sources?: string[];
            }
          | undefined;
        if (
          (command === "fs_list_dir" || command === "fs_list_dir_uncached") &&
          payload?.path === alphaPath
        ) {
          return alphaEntries;
        }
        if (command === "fs_transfer_items" && payload?.targetDir === alphaPath) {
          alphaEntries = [
            ...alphaEntries,
            ...(payload.sources ?? []).map((sourcePath) => {
              const sourceName = sourcePath.split("\\").pop() ?? "item";
              const sourceEntry = ENTRIES.find(
                (entry) => entry.path === sourcePath,
              );
              return {
                name: sourceName,
                path: `${alphaPath}\\${sourceName}`,
                is_dir: false,
                size: sourceEntry?.size ?? 0,
                modified: 1713400000000,
                extension:
                  sourceEntry?.extension ??
                  sourceName.split(".").pop() ??
                  "",
                is_hidden: false,
                is_symlink: false,
              };
            }),
          ];
        }
        return baseInvokeImplementation(command, args as never);
      },
    );

    renderExplorer();
    await screen.findByText("alpha");

    fireEvent.click(screen.getByText("alpha"));

    const previewPane = getPreviewPane();
    await within(previewPane).findByText("Empty Folder");

    const dragSource = screen
      .getByText("notes.txt")
      .closest('[data-overlay-drag-source="file"]');
    if (!(dragSource instanceof HTMLElement)) {
      throw new Error("Expected draggable explorer entry");
    }

    const originalElementFromPoint = document.elementFromPoint;
    Object.defineProperty(document, "elementFromPoint", {
      configurable: true,
      value: vi.fn(() => previewPane),
    });

    try {
      const dragGesture = startExplorerPointerDrag(dragSource, {
        endX: 96,
        endY: 48,
      });
      expect(getPreviewPane()).toHaveAttribute(
        "data-overlay-explorer-preview-drop-active",
        "true",
      );
      finishExplorerPointerDrag(dragGesture);
    } finally {
      if (originalElementFromPoint) {
        Object.defineProperty(document, "elementFromPoint", {
          configurable: true,
          value: originalElementFromPoint,
        });
      } else {
        Reflect.deleteProperty(document, "elementFromPoint");
      }
    }

    await waitFor(() => {
      const transferCalls = vi
        .mocked(invoke)
        .mock.calls.filter(([command]) => command === "fs_transfer_items");
      expect(transferCalls).toHaveLength(1);
      expect(transferCalls[0]?.[1]).toMatchObject({
        targetDir: alphaPath,
        sources: [`${REPO_ROOT}\\notes.txt`],
        operation: "move",
      });
    });
    await within(getPreviewPane()).findByRole("button", {
      name: /open file notes\.txt/i,
    });
  });

  it("copies native external drops into the previewed folder and refreshes the preview lane", async () => {
    const currentWindow = getCurrentWindow();
    const alphaPath = `${REPO_ROOT}\\alpha`;
    let alphaEntries: Array<{
      name: string;
      path: string;
      is_dir: boolean;
      size: number;
      modified: number;
      extension: string;
      is_hidden: boolean;
      is_symlink: boolean;
    }> = [];
    const baseInvokeImplementation = vi.mocked(invoke).getMockImplementation();
    if (!baseInvokeImplementation) {
      throw new Error("Missing default invoke mock implementation");
    }

    vi.mocked(invoke).mockImplementation(
      async (command: string, args?: unknown) => {
        const payload = args as
          | {
              path?: string;
              targetDir?: string;
              sources?: string[];
            }
          | undefined;
        if (
          (command === "fs_list_dir" || command === "fs_list_dir_uncached") &&
          payload?.path === alphaPath
        ) {
          return alphaEntries;
        }
        if (command === "fs_transfer_items" && payload?.targetDir === alphaPath) {
          alphaEntries = [
            ...alphaEntries,
            ...(payload.sources ?? []).map((sourcePath) => {
              const sourceName = sourcePath.split("\\").pop() ?? "item";
              return {
                name: sourceName,
                path: `${alphaPath}\\${sourceName}`,
                is_dir: false,
                size: 0,
                modified: 1713400000000,
                extension: sourceName.split(".").pop() ?? "",
                is_hidden: false,
                is_symlink: false,
              };
            }),
          ];
        }
        return baseInvokeImplementation(command, args as never);
      },
    );

    renderExplorer();
    await screen.findByText("alpha");

    fireEvent.click(screen.getByText("alpha"));

    const previewPane = getPreviewPane();
    await within(previewPane).findByText("Empty Folder");

    await waitFor(() => {
      expect(
        vi.mocked(currentWindow.onDragDropEvent).mock.calls.length,
      ).toBeGreaterThan(0);
    });

    const dragDropCalls = vi.mocked(currentWindow.onDragDropEvent).mock.calls;
    const nativeDragHandler = dragDropCalls[dragDropCalls.length - 1]?.[0];
    if (!nativeDragHandler) {
      throw new Error("Expected native drag-drop listener");
    }

    const position = {
      x: 88,
      y: 44,
      toLogical: vi.fn().mockReturnValue({ x: 88, y: 44 }),
    };
    const originalElementFromPoint = document.elementFromPoint;
    Object.defineProperty(document, "elementFromPoint", {
      configurable: true,
      value: vi.fn(() => previewPane),
    });

    try {
      await nativeDragHandler({
        payload: {
          type: "enter",
          position,
        },
      } as never);
      await nativeDragHandler({
        payload: {
          type: "drop",
          paths: ["C:\\incoming\\dropped.txt"],
          position,
        },
      } as never);
    } finally {
      if (originalElementFromPoint) {
        Object.defineProperty(document, "elementFromPoint", {
          configurable: true,
          value: originalElementFromPoint,
        });
      } else {
        Reflect.deleteProperty(document, "elementFromPoint");
      }
    }

    await waitFor(() => {
      const transferCalls = vi
        .mocked(invoke)
        .mock.calls.filter(([command]) => command === "fs_transfer_items");
      expect(transferCalls).toHaveLength(1);
      expect(transferCalls[0]?.[1]).toMatchObject({
        targetDir: alphaPath,
        sources: ["C:\\incoming\\dropped.txt"],
        operation: "copy",
      });
    });
    await within(getPreviewPane()).findByRole("button", {
      name: /open file dropped\.txt/i,
    });
  });

  it("routes pdf files into the inline pdf workbench and surfaces pdf chrome state", async () => {
    const pdfEntry = {
      name: "forms.pdf",
      path: `${REPO_ROOT}\\\\forms.pdf`,
      is_dir: false,
      size: 512 * 1024,
      modified: 0,
      extension: "pdf",
      is_hidden: false,
      is_symlink: false,
    } as const;
    const baseInvokeImplementation = vi.mocked(invoke).getMockImplementation();
    if (!baseInvokeImplementation) {
      throw new Error("Missing default invoke mock implementation");
    }

    vi.mocked(invoke).mockImplementation(
      async (command: string, args?: unknown) => {
        if (command === "fs_list_dir" || command === "fs_list_dir_uncached") {
          return [...ENTRIES, pdfEntry];
        }
        if (command === "pdf_open_preview_document") {
          return {
            sessionId: "pdf-session-1",
            path: pdfEntry.path,
            name: pdfEntry.name,
            pageCount: 2,
            pages: [
              { pageIndex: 0, widthPoints: 612, heightPoints: 792 },
              { pageIndex: 1, widthPoints: 612, heightPoints: 792 },
            ],
            formFields: [],
          };
        }
        if (command === "pdf_close_preview_document") {
          return null;
        }
        return baseInvokeImplementation(command, args as never);
      },
    );

    renderExplorer();
    await screen.findByText("forms.pdf");

    fireEvent.click(screen.getByText("forms.pdf"));

    expect(
      await screen.findByTestId("mock-explorer-pdf-workbench"),
    ).toHaveTextContent("forms.pdf");
    expect(
      await screen.findByRole("button", { name: /^save$/i }),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole("button", { name: /^fit w$/i }),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole("button", { name: /^fit p$/i }),
    ).toBeInTheDocument();
    expectChromeControlButtonOrder("previewModeToggle", ["Preview", "Edit"]);
    await waitFor(() => {
      expect(useExplorerStore.getState().session.documentViewMode).toBe("edit");
    });
    expect(
      vi
        .mocked(invoke)
        .mock.calls.some(
          ([command]) => command === "pdf_open_preview_document",
        ),
    ).toBe(true);
  });

  it("renders grid thumbnails for visible image entries in icon layouts", async () => {
    const clientWidthDescriptor = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      "clientWidth",
    );
    const clientHeightDescriptor = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      "clientHeight",
    );
    Object.defineProperty(HTMLElement.prototype, "clientWidth", {
      configurable: true,
      get() {
        return 1280;
      },
    });
    Object.defineProperty(HTMLElement.prototype, "clientHeight", {
      configurable: true,
      get() {
        return 900;
      },
    });
    useSettingsStore.getState().updateExplorer({ viewMode: "icons-l" });

    try {
      renderExplorer();
      await screen.findByAltText("Thumbnail for preview.png");
      await waitFor(() => {
        expect(getExplorerThumbnailReadCount()).toBeGreaterThan(0);
      });
    } finally {
      if (clientWidthDescriptor) {
        Object.defineProperty(
          HTMLElement.prototype,
          "clientWidth",
          clientWidthDescriptor,
        );
      } else {
        Reflect.deleteProperty(HTMLElement.prototype, "clientWidth");
      }
      if (clientHeightDescriptor) {
        Object.defineProperty(
          HTMLElement.prototype,
          "clientHeight",
          clientHeightDescriptor,
        );
      } else {
        Reflect.deleteProperty(HTMLElement.prototype, "clientHeight");
      }
    }
  });

  it("keeps active search results icon-only and skips generated thumbnail reads", async () => {
    const searchResult = {
      name: "needle.ts",
      path: `${REPO_ROOT}\\alpha\\needle.ts`,
      is_dir: false,
      size: 160,
      modified: 0,
      extension: "ts",
      is_hidden: false,
      is_symlink: false,
      relative_path: "alpha\\needle.ts",
      match_kind: "content" as const,
      snippet: "const needle = true;",
      line_number: 17,
    };
    const baseInvokeImplementation = vi.mocked(invoke).getMockImplementation();
    if (!baseInvokeImplementation) {
      throw new Error("Missing default invoke mock implementation");
    }

    vi.mocked(invoke).mockImplementation(
      async (command: string, args?: unknown) => {
        if (command === "fs_list_dir" || command === "fs_list_dir_uncached") {
          return [ENTRIES[0]];
        }
        if (command === "fs_search_entries_with_diagnostics") {
          return {
            results: [searchResult],
            diagnostics: {
              executionStrategy: "live_scan",
              contentCacheStatus: "not_requested",
              scannedEntryCount: 1,
              indexedEntryCount: 0,
              contentCacheStoredFileCount: 0,
              contentCacheStoredByteCount: 0,
              truncatedByScanBudget: false,
            },
          };
        }
        return baseInvokeImplementation(command, args as never);
      },
    );

    renderExplorer();
    await screen.findByText("alpha");

    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 140));
    });

    expect(
      vi
        .mocked(invoke)
        .mock.calls.some(
          ([command]) => command === "fs_read_entry_thumbnail_artifact",
        ),
    ).toBe(false);

    vi.mocked(invoke).mockClear();

    fireEvent.keyDown(window, { key: "l", ctrlKey: true });
    const omnibox = await screen.findByPlaceholderText(/Search or enter path/i);
    fireEvent.change(omnibox, { target: { value: "needle" } });
    fireEvent.keyDown(omnibox, { key: "Enter" });

    await screen.findByText("needle.ts");
    await screen.findByText("alpha\\needle.ts");
    await screen.findByText("Content match");

    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 180));
    });

    expect(
      vi
        .mocked(invoke)
        .mock.calls.some(
          ([command]) => command === "fs_search_entries_with_diagnostics",
        ),
    ).toBe(true);
    expect(
      vi
        .mocked(invoke)
        .mock.calls.some(
          ([command]) => command === "fs_read_entry_thumbnail_artifact",
        ),
    ).toBe(false);
    expect(
      vi
        .mocked(invoke)
        .mock.calls.some(([command]) => command === "fs_read_image_thumbnail"),
    ).toBe(false);
  });

  it("overlays themed file-type badges on generated code thumbnails in icon layouts", async () => {
    const clientWidthDescriptor = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      "clientWidth",
    );
    const clientHeightDescriptor = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      "clientHeight",
    );
    Object.defineProperty(HTMLElement.prototype, "clientWidth", {
      configurable: true,
      get() {
        return 1280;
      },
    });
    Object.defineProperty(HTMLElement.prototype, "clientHeight", {
      configurable: true,
      get() {
        return 900;
      },
    });
    useSettingsStore.getState().updateExplorer({ viewMode: "icons-l" });

    try {
      const { appearance } = renderExplorer();
      const iconTheme =
        appearance.theme.assets?.iconTheme ?? getBuiltInIconTheme();

      await screen.findByAltText("Thumbnail for notes.txt");
      await screen.findByAltText("Thumbnail for build.bat");

      await waitFor(() => {
        expect(getEntryThumbnailBadgeSrc("notes.txt")).toBe(
          resolveFileIconSrc("notes.txt", "txt", iconTheme),
        );
        expect(getEntryThumbnailBadgeSrc("build.bat")).toBe(
          resolveFileIconSrc("build.bat", "bat", iconTheme),
        );
      });
    } finally {
      if (clientWidthDescriptor) {
        Object.defineProperty(
          HTMLElement.prototype,
          "clientWidth",
          clientWidthDescriptor,
        );
      } else {
        Reflect.deleteProperty(HTMLElement.prototype, "clientWidth");
      }
      if (clientHeightDescriptor) {
        Object.defineProperty(
          HTMLElement.prototype,
          "clientHeight",
          clientHeightDescriptor,
        );
      } else {
        Reflect.deleteProperty(HTMLElement.prototype, "clientHeight");
      }
    }
  });

  it("renders the footer view switcher as a fixed five-button view host on the status bar edge", async () => {
    renderExplorer();
    await screen.findByText("alpha");

    const switcher = screen.getByRole("group", {
      name: /explorer footer view switcher/i,
    });
    const statusSurface = document.querySelector(
      '[data-overlay-explorer-surface="explorerStatusBar"]',
    );
    const taskAnchor = document.querySelector(
      '[data-overlay-explorer-status-task-anchor="true"]',
    );

    expect(
      screen.queryByRole("button", { name: /experimental view modes:/i }),
    ).toBeNull();
    expect(statusSurface).toHaveStyle({ width: "100%", minWidth: "0" });
    expect(
      statusSurface?.closest('[data-overlay-explorer-plane="main"]'),
    ).toBeNull();
    expect(taskAnchor).toHaveStyle({
      left: "50%",
      top: "50%",
      transform: "translate(-50%, -50%)",
    });
    expect(within(switcher).getAllByRole("button")).toHaveLength(5);
    expect(
      within(switcher).getByRole("button", {
        name: /switch explorer to icon view/i,
      }),
    ).toBeTruthy();
    expect(
      within(switcher).getByRole("button", {
        name: /switch explorer to list view/i,
      }),
    ).toBeTruthy();
    expect(
      within(switcher).getByRole("button", {
        name: /switch explorer to adaptive semantic grid/i,
      }),
    ).toBeTruthy();
    expect(
      within(switcher).getByRole("button", {
        name: /switch explorer to constellation view/i,
      }),
    ).toBeTruthy();
    expect(
      within(switcher).getByRole("button", {
        name: /switch explorer to timeline surface/i,
      }),
    ).toBeTruthy();
  });

  it("activates adaptive semantic grid without mutating the saved normal layout mode", async () => {
    useSettingsStore.getState().updateExplorer({ viewMode: "columns" });

    renderExplorer();
    await screen.findByText("alpha");

    fireEvent.click(
      screen.getByRole("button", {
        name: /switch explorer to adaptive semantic grid/i,
      }),
    );

    expect(
      useSettingsStore.getState().settings.explorer.experimentalViewMode,
    ).toBe("adaptive-semantic-grid");
    expect(useSettingsStore.getState().settings.explorer.viewMode).toBe(
      "columns",
    );
    expect(getChromeControl("statusViewSummary")).toHaveTextContent(
      "View: Adaptive Semantic Grid",
    );
    expect(screen.queryByText(/experimental:/i)).toBeNull();
    expect(
      screen.getByRole("button", {
        name: /switch explorer to adaptive semantic grid/i,
      }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.queryByText(
        /larger semantic tiles that favor browsing and recognition\./i,
      ),
    ).toBeNull();
  });

  it("restores adaptive semantic entries to their semantic resting surface after hover", async () => {
    renderExplorer();
    await screen.findByText("alpha");

    fireEvent.click(
      screen.getByRole("button", {
        name: /switch explorer to adaptive semantic grid/i,
      }),
    );

    const notesEntry = screen
      .getByText("notes.txt")
      .closest('[data-overlay-drag-source="file"]') as HTMLElement | null;

    expect(notesEntry).toBeTruthy();

    const initialBackground = notesEntry!.style.background;
    const initialTransform = notesEntry!.style.transform;

    fireEvent.mouseEnter(notesEntry!);
    fireEvent.mouseLeave(notesEntry!);

    expect(notesEntry!.style.background).toBe(initialBackground);
    expect(notesEntry!.style.borderColor).toBe("transparent");
    expect(notesEntry!.style.transform).toBe(initialTransform);
  });

  it("keeps adaptive semantic grid visually minimal", async () => {
    renderExplorer();
    await screen.findByText("alpha");

    fireEvent.click(
      screen.getByRole("button", {
        name: /switch explorer to adaptive semantic grid/i,
      }),
    );

    const alphaEntry = screen
      .getByText("alpha")
      .closest('[data-overlay-drag-source="file"]') as HTMLElement | null;
    const notesEntry = screen
      .getByText("notes.txt")
      .closest('[data-overlay-drag-source="file"]') as HTMLElement | null;

    expect(alphaEntry).toBeTruthy();
    expect(notesEntry).toBeTruthy();

    expect(alphaEntry).not.toHaveAttribute("title");
    expect(notesEntry).not.toHaveAttribute("title");
    expect(alphaEntry!.style.background).toBe("transparent");
    expect(alphaEntry!.style.borderColor).toBe("transparent");
    expect(within(alphaEntry!).queryByText(/^Folder$/)).toBeNull();
    expect(within(notesEntry!).queryByText(/^Text$/)).toBeNull();
    expect(
      screen.queryByText(/anchors and destinations stay visually dominant\./i),
    ).toBeNull();
    expect(
      screen.queryByText(
        /selection-adjacent files stay close while you change density\./i,
      ),
    ).toBeNull();
  });

  it("activates constellation view without mutating the saved normal layout mode", async () => {
    useSettingsStore.getState().updateExplorer({ viewMode: "details" });

    renderExplorer();
    await screen.findByText("alpha");

    fireEvent.click(
      screen.getByRole("button", {
        name: /switch explorer to constellation view/i,
      }),
    );

    expect(
      useSettingsStore.getState().settings.explorer.experimentalViewMode,
    ).toBe("constellation");
    expect(useSettingsStore.getState().settings.explorer.viewMode).toBe(
      "details",
    );
    expect(getChromeControl("statusViewSummary")).toHaveTextContent(
      "View: Constellation View",
    );
    expect(screen.queryByText(/experimental:/i)).toBeNull();
    expect(
      screen.getByRole("button", {
        name: /switch explorer to constellation view/i,
      }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.getByRole("group", { name: /constellation field/i }),
    ).toBeTruthy();
    expect(screen.queryByText(/orbit map/i)).toBeNull();
    expect(
      screen.queryByText(
        /cluster files by relationship and navigate the orbit field\./i,
      ),
    ).toBeNull();
  });

  it("activates timeline surface without mutating the saved normal layout mode", async () => {
    useSettingsStore.getState().updateExplorer({ viewMode: "columns" });

    renderExplorer();
    await screen.findByText("alpha");

    fireEvent.click(
      screen.getByRole("button", {
        name: /switch explorer to timeline surface/i,
      }),
    );

    expect(
      useSettingsStore.getState().settings.explorer.experimentalViewMode,
    ).toBe("timeline-surface");
    expect(useSettingsStore.getState().settings.explorer.viewMode).toBe(
      "columns",
    );
    expect(getChromeControl("statusViewSummary")).toHaveTextContent(
      "View: Timeline Surface",
    );
    expect(screen.queryByText(/experimental:/i)).toBeNull();
    expect(
      screen.getByRole("button", {
        name: /switch explorer to timeline surface/i,
      }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.queryByText(
        /browse folders and files as time-banded activity surfaces\./i,
      ),
    ).toBeNull();
    expect(screen.getAllByText(/undated/i).length).toBeGreaterThan(0);
  });

  it("splits dense timeline surface into hourly bands for newest changes", async () => {
    const nowMs = new Date(2026, 3, 21, 14, 30, 0, 0).getTime();
    const timelineEntries = [
      {
        name: "this-hour.txt",
        path: `${REPO_ROOT}\\this-hour.txt`,
        is_dir: false,
        size: 64,
        modified: new Date(2026, 3, 21, 14, 15, 0, 0).getTime(),
        extension: "txt",
        is_hidden: false,
        is_symlink: false,
      },
      {
        name: "one-hour.txt",
        path: `${REPO_ROOT}\\one-hour.txt`,
        is_dir: false,
        size: 64,
        modified: new Date(2026, 3, 21, 13, 10, 0, 0).getTime(),
        extension: "txt",
        is_hidden: false,
        is_symlink: false,
      },
      {
        name: "earlier-today.txt",
        path: `${REPO_ROOT}\\earlier-today.txt`,
        is_dir: false,
        size: 64,
        modified: new Date(2026, 3, 21, 8, 45, 0, 0).getTime(),
        extension: "txt",
        is_hidden: false,
        is_symlink: false,
      },
      {
        name: "yesterday.txt",
        path: `${REPO_ROOT}\\yesterday.txt`,
        is_dir: false,
        size: 64,
        modified: new Date(2026, 3, 20, 18, 20, 0, 0).getTime(),
        extension: "txt",
        is_hidden: false,
        is_symlink: false,
      },
    ];
    const baseInvokeImplementation = vi.mocked(invoke).getMockImplementation();
    if (!baseInvokeImplementation) {
      throw new Error("Missing default invoke mock implementation");
    }

    const dateNowSpy = vi.spyOn(Date, "now").mockReturnValue(nowMs);
    vi.mocked(invoke).mockImplementation(
      async (command: string, args?: unknown) => {
        if (command === "fs_list_dir" || command === "fs_list_dir_uncached") {
          return timelineEntries;
        }
        return baseInvokeImplementation(command, args as never);
      },
    );
    useSettingsStore.getState().updateExplorer({
      viewMode: "details",
      experimentalViewMode: "timeline-surface",
      experimentalDensity: 1,
    });

    try {
      renderExplorer();
      await screen.findByText("this-hour.txt");

      const thisHourBand = screen.getByText("This Hour").closest("section");
      const previousHourBand = screen
        .getByText("1 Hour Ago")
        .closest("section");
      const earlierTodayBand = screen
        .getByText("Earlier Today")
        .closest("section");
      const yesterdayBand = screen.getByText("Yesterday").closest("section");

      expect(thisHourBand).toBeTruthy();
      expect(previousHourBand).toBeTruthy();
      expect(earlierTodayBand).toBeTruthy();
      expect(yesterdayBand).toBeTruthy();

      expect(
        within(thisHourBand as HTMLElement).getByText("this-hour.txt"),
      ).toBeInTheDocument();
      expect(
        within(previousHourBand as HTMLElement).getByText("one-hour.txt"),
      ).toBeInTheDocument();
      expect(
        within(earlierTodayBand as HTMLElement).getByText("earlier-today.txt"),
      ).toBeInTheDocument();
      expect(
        within(yesterdayBand as HTMLElement).getByText("yesterday.txt"),
      ).toBeInTheDocument();
    } finally {
      dateNowSpy.mockRestore();
    }
  });

  it("uses list view as the standard-view proxy when leaving a unique footer mode", async () => {
    useSettingsStore.getState().updateExplorer({
      viewMode: "columns",
      experimentalViewMode: "constellation",
    });

    renderExplorer();
    await screen.findByText("alpha");

    fireEvent.click(
      screen.getByRole("button", {
        name: /switch explorer to list view/i,
      }),
    );

    await waitFor(() => {
      expect(
        useSettingsStore.getState().settings.explorer.experimentalViewMode,
      ).toBe("off");
      expect(useSettingsStore.getState().settings.explorer.viewMode).toBe(
        "list",
      );
    });
  });

  it("scales the explorer grid with ctrl-wheel without changing app zoom and only commits after idle", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    useSettingsStore
      .getState()
      .updateExplorer({ viewMode: "icons-m", gridZoom: 0.34 });

    renderExplorer();
    await screen.findByText("alpha");

    const appearanceZoomBefore =
      useSettingsStore.getState().settings.appearance.appZoom;
    dispatchLayoutWheel("alpha", -120);
    const zoomHud = await screen.findByTestId("explorer-layout-zoom-hud");
    expect(zoomHud.closest("[data-overlay-explorer]")).not.toBeNull();
    expect(
      screen
        .getByRole("button", { name: /explorer layout:/i })
        .parentElement?.contains(zoomHud),
    ).toBe(false);
    expect(zoomHud.style.zIndex).toBe(
      "var(--overlay-explorer-floating-hud-layer, 9996)",
    );

    expect(useSettingsStore.getState().settings.explorer.viewMode).toBe(
      "icons-m",
    );
    expect(useSettingsStore.getState().settings.explorer.gridZoom).toBe(0.34);
    expect(useSettingsStore.getState().settings.appearance.appZoom).toBe(
      appearanceZoomBefore,
    );
    await advanceLayoutZoomCommit();

    expect(useSettingsStore.getState().settings.explorer.viewMode).toBe(
      "icons-m",
    );
    expect(
      useSettingsStore.getState().settings.explorer.gridZoom,
    ).toBeGreaterThan(0.34);
    expect(useSettingsStore.getState().settings.appearance.appZoom).toBe(
      appearanceZoomBefore,
    );
  });

  it("keeps the committed icon band stable while the live grid stage grows continuously", async () => {
    vi.useRealTimers();
    useSettingsStore
      .getState()
      .updateExplorer({ viewMode: "icons-m", gridZoom: 0.34 });

    renderExplorer();
    await screen.findByText("alpha");

    const initialStageSize = getExplorerContentViewportCssNumber(
      "--overlay-explorer-grid-icon-stage-size",
    );

    dispatchLayoutWheel("alpha", -120);
    dispatchLayoutWheel("alpha", -120);
    dispatchLayoutWheel("alpha", -120);
    dispatchLayoutWheel("alpha", -120);

    await waitFor(() => {
      expect(getExplorerContentViewportGridIconBand()).toBe("icons-m");
      expect(
        getExplorerContentViewportCssNumber(
          "--overlay-explorer-grid-icon-stage-size",
        ),
      ).toBeGreaterThan(initialStageSize);
    });

    await waitFor(() => {
      expect(useSettingsStore.getState().settings.explorer.viewMode).toBe(
        "icons-l",
      );
    });
    expect(getExplorerContentViewportGridIconBand()).toBe("icons-l");
    expect(
      getExplorerContentViewportCssNumber(
        "--overlay-explorer-grid-icon-stage-size",
      ),
    ).toBeGreaterThan(initialStageSize);
  });

  it("settles one explorer-settings commit for a ctrl-wheel gesture burst", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    useSettingsStore
      .getState()
      .updateExplorer({ viewMode: "icons-l", gridZoom: 0.67 });

    const updateExplorerSpy = vi.spyOn(
      useSettingsStore.getState(),
      "updateExplorer",
    );

    renderExplorer();
    await screen.findByText("alpha");

    dispatchLayoutWheel("alpha", -120);
    dispatchLayoutWheel("alpha", -120);
    dispatchLayoutWheel("alpha", -120);

    expect(updateExplorerSpy).toHaveBeenCalledTimes(0);
    await advanceLayoutZoomCommit();
    expect(updateExplorerSpy).toHaveBeenCalledTimes(1);
    updateExplorerSpy.mockRestore();
  });

  it("scales the explorer grid when ctrl-wheel happens on the file area shell", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    useSettingsStore
      .getState()
      .updateExplorer({ viewMode: "icons-m", gridZoom: 0.34 });

    renderExplorer();
    await screen.findByText("alpha");

    dispatchLayoutWheelOnFileArea(-120);
    await advanceLayoutZoomCommit();

    expect(useSettingsStore.getState().settings.explorer.viewMode).toBe(
      "icons-m",
    );
    expect(
      useSettingsStore.getState().settings.explorer.gridZoom,
    ).toBeGreaterThan(0.34);
  });

  it("drops into compact list mode at the minimum zoom boundary and can zoom back into the grid", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    useSettingsStore
      .getState()
      .updateExplorer({ viewMode: "icons-s", gridZoom: 0 });

    renderExplorer();
    await screen.findByText("alpha");

    dispatchLayoutWheel("alpha", 120);
    await advanceLayoutZoomCommit();

    expect(useSettingsStore.getState().settings.explorer.viewMode).toBe(
      "list",
    );

    dispatchLayoutWheel("alpha", -120);
    dispatchLayoutWheel("alpha", -120);
    await advanceLayoutZoomCommit();

    expect(
      useSettingsStore.getState().settings.explorer.viewMode,
    ).toMatch(/^icons-/);
    expect(
      useSettingsStore.getState().settings.explorer.gridZoom,
    ).toBeGreaterThan(0);
  });

  it("keeps a deep-grid viewport anchored instead of jumping back to the top while zooming", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const denseEntries = Array.from({ length: 220 }, (_, index) => ({
      name: `item-${index.toString().padStart(3, "0")}.txt`,
      path: `${REPO_ROOT}\\item-${index.toString().padStart(3, "0")}.txt`,
      is_dir: false,
      size: index + 1,
      modified: index,
      extension: "txt",
      is_hidden: false,
      is_symlink: false,
    }));
    const baseInvokeImplementation = vi.mocked(invoke).getMockImplementation();
    if (!baseInvokeImplementation) {
      throw new Error("Missing default invoke mock implementation");
    }

    vi.mocked(invoke).mockImplementation(
      async (command: string, args?: unknown) => {
        if (command === "fs_list_dir" || command === "fs_list_dir_uncached") {
          return denseEntries;
        }
        return baseInvokeImplementation(command, args as never);
      },
    );
    useSettingsStore
      .getState()
      .updateExplorer({ viewMode: "icons-l", gridZoom: 0.67 });

    renderExplorer();
    await screen.findByText("item-000.txt");

    const viewport = getExplorerViewport("item-000.txt");
    viewport.scrollTop = 1600;
    fireEvent.scroll(viewport);

    await waitFor(() => {
      expect(screen.getByText("item-120.txt")).toBeInTheDocument();
    });

    dispatchLayoutWheel("item-120.txt", -120);
    await advanceLayoutZoomCommit();

    expect(screen.getByText("item-120.txt")).toBeInTheDocument();
    expect(viewport.scrollTop).toBeGreaterThan(1000);
  });

  it("does not refetch an already-visible generated thumbnail during a zoom gesture", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    useSettingsStore
      .getState()
      .updateExplorer({ viewMode: "icons-l", gridZoom: 0.67 });

    renderExplorer();
    await screen.findByText("preview.png");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(220);
    });

    await waitFor(() => {
      expect(getExplorerThumbnailReadCount()).toBeGreaterThan(0);
    });

    vi.mocked(invoke).mockClear();
    dispatchLayoutWheel("preview.png", -120);
    dispatchLayoutWheel("preview.png", -120);
    await advanceLayoutZoomCommit();

    expect(
      vi
        .mocked(invoke)
        .mock.calls.some(
          ([command, args]) =>
            (command === "fs_read_entry_thumbnail_artifact" ||
              command === "fs_read_entry_thumbnail" ||
              command === "fs_read_image_thumbnail") &&
            (
              (args as { path?: string; request?: { path?: string } } | undefined)
                ?.request?.path ??
              (args as { path?: string; request?: { path?: string } } | undefined)
                ?.path
            ) ===
              `${REPO_ROOT}\\preview.png`,
        ),
    ).toBe(false);
  });

  it("keeps the durable oversize icon band clamped while the live stage keeps growing", async () => {
    vi.useRealTimers();
    useSettingsStore
      .getState()
      .updateExplorer({ viewMode: "icons-xl", gridZoom: 1 });

    renderExplorer();
    await screen.findByText("alpha");

    const initialStageSize = getExplorerContentViewportCssNumber(
      "--overlay-explorer-grid-icon-stage-size",
    );

    dispatchLayoutWheel("alpha", -120);

    await waitFor(() => {
      expect(getExplorerContentViewportGridIconBand()).toBe("icons-xl");
      expect(
        getExplorerContentViewportCssNumber(
          "--overlay-explorer-grid-icon-stage-size",
        ),
      ).toBeGreaterThan(initialStageSize);
    });

    await waitFor(() => {
      expect(useSettingsStore.getState().settings.explorer.viewMode).toBe(
        "icons-xl",
      );
      expect(
        useSettingsStore.getState().settings.explorer.gridZoom,
      ).toBeGreaterThan(1);
    });
    expect(getExplorerContentViewportGridIconBand()).toBe("icons-xl");
    expect(
      getExplorerContentViewportCssNumber(
        "--overlay-explorer-grid-icon-stage-size",
      ),
    ).toBeGreaterThan(initialStageSize);
  });

  it("uses the dedicated explorer viewport class for visible file-list scrollbars", async () => {
    renderExplorer();
    await screen.findByText("alpha");

    expect(getExplorerViewport("alpha")).toHaveClass(
      "overlay-scroll-area__viewport--explorer-file-list",
    );
    expect(getExplorerViewport("alpha")).toHaveClass("overlay-native-scrollbar");
    expect(getExplorerViewport("alpha")).toHaveAttribute(
      "data-overlay-native-scrollbar",
      "explorer-file-list",
    );
  });

  it("does not mount an entire huge folder while waiting for viewport measurement", async () => {
    const longEntries = Array.from({ length: 2000 }, (_, index) => ({
      name: `item-${index.toString().padStart(4, "0")}.txt`,
      path: `${REPO_ROOT}\\\\item-${index.toString().padStart(4, "0")}.txt`,
      is_dir: false,
      size: index + 1,
      modified: index,
      extension: "txt",
      is_hidden: false,
      is_symlink: false,
    }));
    const baseInvokeImplementation = vi.mocked(invoke).getMockImplementation();
    if (!baseInvokeImplementation) {
      throw new Error("Missing default invoke mock implementation");
    }

    vi.mocked(invoke).mockImplementation(
      async (command: string, args?: unknown) => {
        if (command === "fs_list_dir" || command === "fs_list_dir_uncached") {
          return longEntries;
        }
        return baseInvokeImplementation(
          command,
          args as Parameters<typeof invoke>[1],
        );
      },
    );
    useSettingsStore.getState().updateExplorer({ viewMode: "list" });

    renderExplorer();
    await screen.findByText("item-0000.txt");

    expect(screen.queryByText("item-1999.txt")).not.toBeInTheDocument();
    expect(document.querySelectorAll("[data-entry-path]").length).toBeLessThan(
      120,
    );
  });

  it.each([
    { viewMode: "list" as const, virtualSurface: "list" },
    { viewMode: "columns" as const, virtualSurface: "table" },
    { viewMode: "details" as const, virtualSurface: "table" },
  ])(
    "keeps a 100000-entry folder bounded to the $viewMode virtual surface",
    async ({ viewMode, virtualSurface }) => {
      const longEntries = Array.from({ length: 100000 }, (_, index) => ({
        name: `item-${index.toString().padStart(6, "0")}.txt`,
        path: `${REPO_ROOT}\\\\item-${index.toString().padStart(6, "0")}.txt`,
        is_dir: false,
        size: index + 1,
        modified: index,
        extension: "txt",
        is_hidden: false,
        is_symlink: false,
      }));
      const baseInvokeImplementation = vi.mocked(invoke).getMockImplementation();
      if (!baseInvokeImplementation) {
        throw new Error("Missing default invoke mock implementation");
      }

      vi.mocked(invoke).mockImplementation(
        async (command: string, args?: unknown) => {
          if (command === "fs_list_dir" || command === "fs_list_dir_uncached") {
            return longEntries;
          }
          return baseInvokeImplementation(
            command,
            args as Parameters<typeof invoke>[1],
          );
        },
      );

      const thumbnailPeekSpy = vi.spyOn(
        explorerThumbnailArtifactRuntime,
        "peekExplorerThumbnailForEntry",
      );
      useSettingsStore.getState().updateExplorer({ viewMode });

      renderExplorer();
      await screen.findByText("item-000000.txt", undefined, {
        timeout: 10000,
      });

      expect(
        document.querySelector(
          `[data-overlay-explorer-virtual-surface='${virtualSurface}']`,
        ),
      ).toBeInTheDocument();
      expect(
        document.querySelector(
          `[data-overlay-explorer-virtual-surface='${
            virtualSurface === "list" ? "table" : "list"
          }']`,
        ),
      ).not.toBeInTheDocument();
      expect(screen.queryByText("item-099999.txt")).not.toBeInTheDocument();
      expect(document.querySelectorAll("[data-entry-path]").length).toBeLessThan(
        160,
      );
      expect(thumbnailPeekSpy.mock.calls.length).toBeLessThan(1000);

      const viewport = getExplorerViewport("item-000000.txt");
      viewport.scrollTop = 10000;
      fireEvent.scroll(viewport);

      await waitFor(() => {
        expect(screen.queryByText("item-000000.txt")).not.toBeInTheDocument();
        expect(
          Array.from(document.querySelectorAll("[data-entry-path]")).some(
            (node) =>
              /item-0002[0-9]{2}\.txt$/.test(
                node.getAttribute("data-entry-path") ?? "",
              ),
          ),
        ).toBe(true);
        expect(
          document.querySelectorAll("[data-entry-path]").length,
        ).toBeLessThan(180);
      });
      thumbnailPeekSpy.mockRestore();
    },
    20000,
  );

  it("switches between icon and list view from footer toggles", async () => {
    useSettingsStore.getState().updateExplorer({
      viewMode: "details",
      experimentalViewMode: "timeline-surface",
    });

    renderExplorer();
    await screen.findByText("alpha");

    fireEvent.click(
      screen.getByRole("button", { name: /switch explorer to icon view/i }),
    );
    await waitFor(() => {
      expect(
        useSettingsStore.getState().settings.explorer.experimentalViewMode,
      ).toBe("off");
      expect(useSettingsStore.getState().settings.explorer.viewMode).toBe(
        "icons-l",
      );
    });

    fireEvent.click(
      screen.getByRole("button", { name: /switch explorer to list view/i }),
    );
    await waitFor(() => {
      expect(
        useSettingsStore.getState().settings.explorer.experimentalViewMode,
      ).toBe("off");
      expect(useSettingsStore.getState().settings.explorer.viewMode).toBe(
        "list",
      );
    });
  });

  it.each(["icons-l", "list"] as const)(
    "keeps the final item reachable at the bottom of a 5000-item %s viewport",
    async (viewMode) => {
      const clientWidthDescriptor = Object.getOwnPropertyDescriptor(
        HTMLElement.prototype,
        "clientWidth",
      );
      const clientHeightDescriptor = Object.getOwnPropertyDescriptor(
        HTMLElement.prototype,
        "clientHeight",
      );
      Object.defineProperty(HTMLElement.prototype, "clientWidth", {
        configurable: true,
        get() {
          return 1280;
        },
      });
      Object.defineProperty(HTMLElement.prototype, "clientHeight", {
        configurable: true,
        get() {
          return 900;
        },
      });

      const longEntries = Array.from({ length: 5000 }, (_, index) => ({
        name: `item-${index.toString().padStart(4, "0")}.txt`,
        path: `${REPO_ROOT}\\\\item-${index.toString().padStart(4, "0")}.txt`,
        is_dir: false,
        size: index + 1,
        modified: index,
        extension: "txt",
        is_hidden: false,
        is_symlink: false,
      }));
      const longEntriesByPath = new Map(
        longEntries.map((entry) => [entry.path, entry] as const),
      );

      const baseInvokeImplementation = vi
        .mocked(invoke)
        .getMockImplementation();
      if (!baseInvokeImplementation) {
        throw new Error("Missing default invoke mock implementation");
      }

      vi.mocked(invoke).mockImplementation(
        async (command: string, args?: unknown) => {
          const payload = args as
            | { path?: string; paths?: string[] }
            | undefined;
          if (command === "fs_list_dir" || command === "fs_list_dir_uncached") {
            return payload?.path === REPO_ROOT ? longEntries : [];
          }
          if (command === "fs_measure_entry_sizes") {
            return (payload?.paths ?? []).map((path) => ({
              path,
              bytes: longEntriesByPath.get(path)?.size ?? 0,
              is_dir: longEntriesByPath.get(path)?.is_dir ?? false,
              is_complete: true,
            }));
          }
          return baseInvokeImplementation(
            command,
            args as Parameters<typeof invoke>[1],
          );
        },
      );

      useSettingsStore.getState().updateAppearance({ useNativeOsIcons: false });
      useSettingsStore.getState().updateExplorer({ viewMode, gridZoom: 0.67 });

      try {
        renderExplorer();
        await screen.findByText("item-0000.txt");

        const viewport = getExplorerViewport("item-0000.txt");
        viewport.scrollTop = 1_000_000;
        fireEvent.scroll(viewport);

        await waitFor(() => {
          expect(screen.getByText("item-4999.txt")).toBeInTheDocument();
        });
      } finally {
        if (clientWidthDescriptor) {
          Object.defineProperty(
            HTMLElement.prototype,
            "clientWidth",
            clientWidthDescriptor,
          );
        } else {
          Reflect.deleteProperty(HTMLElement.prototype, "clientWidth");
        }
        if (clientHeightDescriptor) {
          Object.defineProperty(
            HTMLElement.prototype,
            "clientHeight",
            clientHeightDescriptor,
          );
        } else {
          Reflect.deleteProperty(HTMLElement.prototype, "clientHeight");
        }
      }
    },
  );

  it("steps back out of details mode when ctrl-wheel originates from a row element", async () => {
    useSettingsStore.getState().updateExplorer({ viewMode: "details" });

    renderExplorer();
    const entry = await screen.findByText("notes.txt");

    dispatchLayoutWheelOnElement(entry, -120);

    await waitFor(() => {
      expect(useSettingsStore.getState().settings.explorer.viewMode).toBe(
        "list",
      );
    });
  });

  it("renders the destination folder after navigating from a deeply scrolled icon grid", async () => {
    const alphaPath = `${REPO_ROOT}\\\\alpha`;
    const longEntries = [
      {
        name: "alpha",
        path: alphaPath,
        is_dir: true,
        size: 0,
        modified: 0,
        extension: "",
        is_hidden: false,
        is_symlink: false,
      },
      ...Array.from({ length: 180 }, (_, index) => ({
        name: `item-${index.toString().padStart(3, "0")}.txt`,
        path: `${REPO_ROOT}\\\\item-${index.toString().padStart(3, "0")}.txt`,
        is_dir: false,
        size: index + 1,
        modified: index,
        extension: "txt",
        is_hidden: false,
        is_symlink: false,
      })),
    ];
    const shortEntries = [
      {
        name: "child.txt",
        path: `${alphaPath}\\\\child.txt`,
        is_dir: false,
        size: 42,
        modified: 0,
        extension: "txt",
        is_hidden: false,
        is_symlink: false,
      },
    ];
    const allEntriesByPath = new Map([
      ...longEntries.map((entry) => [entry.path, entry] as const),
      ...shortEntries.map((entry) => [entry.path, entry] as const),
    ]);
    const baseInvokeImplementation = vi.mocked(invoke).getMockImplementation();
    if (!baseInvokeImplementation) {
      throw new Error("Missing default invoke mock implementation");
    }
    vi.mocked(invoke).mockImplementation(
      async (command: string, args?: unknown) => {
        const payload = args as { path?: string; paths?: string[] } | undefined;
        if (command === "fs_list_dir" || command === "fs_list_dir_uncached") {
          return payload?.path === alphaPath ? shortEntries : longEntries;
        }
        if (command === "fs_measure_entry_sizes") {
          return (payload?.paths ?? []).map((path) => {
            const entry = allEntriesByPath.get(path);
            return {
              path,
              bytes: entry?.size ?? 0,
              is_dir: entry?.is_dir ?? false,
              is_complete: true,
            };
          });
        }
        return baseInvokeImplementation(
          command,
          args as Parameters<typeof invoke>[1],
        );
      },
    );
    useSettingsStore
      .getState()
      .updateExplorer({ viewMode: "icons-l", gridZoom: 0.67 });

    renderExplorer();
    await screen.findByText("alpha");

    const viewport = getExplorerViewport("alpha");
    viewport.scrollTop = 20000;
    fireEvent.scroll(viewport);

    fireEvent.doubleClick(screen.getByText("alpha"));

    await waitFor(() => {
      expect(screen.getByText("child.txt")).toBeInTheDocument();
    });
  });

  it("keeps the current folder mounted until the next folder listing resolves", async () => {
    const alphaPath = `${REPO_ROOT}\\alpha`;
    const childEntries = [
      {
        name: "child.txt",
        path: `${alphaPath}\\child.txt`,
        is_dir: false,
        size: 42,
        modified: 0,
        extension: "txt",
        is_hidden: false,
        is_symlink: false,
      },
    ];
    const deferredListing = createDeferred<typeof childEntries>();
    const baseInvokeImplementation = vi.mocked(invoke).getMockImplementation();
    if (!baseInvokeImplementation) {
      throw new Error("Missing default invoke mock implementation");
    }

    vi.mocked(invoke).mockImplementation(
      async (command: string, args?: unknown) => {
        const payload = args as { path?: string } | undefined;
        if (command === "fs_list_dir" || command === "fs_list_dir_uncached") {
          return payload?.path === alphaPath
            ? deferredListing.promise
            : ENTRIES;
        }
        return baseInvokeImplementation(
          command,
          args as Parameters<typeof invoke>[1],
        );
      },
    );

    renderExplorer();
    await screen.findByText("alpha");
    expect(screen.getByText("notes.txt")).toBeInTheDocument();

    fireEvent.doubleClick(screen.getByText("alpha"));

    expect(screen.getByText("notes.txt")).toBeInTheDocument();
    expect(screen.queryByText("child.txt")).not.toBeInTheDocument();

    deferredListing.resolve(childEntries);

    await waitFor(() => {
      expect(screen.getByText("child.txt")).toBeInTheDocument();
    });
    expect(screen.queryByText("notes.txt")).not.toBeInTheDocument();
  });

  it.each(["icons-l", "list"] as const)(
    "keeps folder icons closed during single-click navigation in %s view",
    async (viewMode) => {
      const alphaPath = `${REPO_ROOT}\\alpha`;
      const childEntries = [
        {
          name: "child.txt",
          path: `${alphaPath}\\child.txt`,
          is_dir: false,
          size: 42,
          modified: 0,
          extension: "txt",
          is_hidden: false,
          is_symlink: false,
        },
      ];
      const deferredListing = createDeferred<typeof childEntries>();
      const baseInvokeImplementation = vi
        .mocked(invoke)
        .getMockImplementation();
      if (!baseInvokeImplementation) {
        throw new Error("Missing default invoke mock implementation");
      }

      vi.mocked(invoke).mockImplementation(
        async (command: string, args?: unknown) => {
          const payload = args as { path?: string } | undefined;
          if (command === "fs_list_dir" || command === "fs_list_dir_uncached") {
            return payload?.path === alphaPath
              ? deferredListing.promise
              : ENTRIES;
          }
          return baseInvokeImplementation(
            command,
            args as Parameters<typeof invoke>[1],
          );
        },
      );

      useSettingsStore.getState().updateExplorer({
        viewMode,
        gridZoom: 0.67,
        folderClickMode: "single",
      });

      renderExplorer();
      await screen.findByText("alpha");
      const selectionSummary = screen.getByTitle("Selected item size summary");

      expect(getEntryIconSrc("alpha")).not.toContain("folder_open");
      expect(selectionSummary).toHaveStyle({ visibility: "hidden" });

      const alphaEntry = screen.getByText("alpha");
      fireEvent.pointerDown(alphaEntry, {
        button: 0,
        clientX: 32,
        clientY: 24,
        pointerId: 1,
      });

      expect(
        vi
          .mocked(invoke)
          .mock.calls.some(
            ([command, args]) =>
              (command === "fs_list_dir" ||
                command === "fs_list_dir_uncached") &&
              (args as { path?: string } | undefined)?.path === alphaPath,
          ),
      ).toBe(true);

      fireEvent.click(alphaEntry);

      expect(selectionSummary).toHaveStyle({ visibility: "hidden" });
      expect(getEntryIconSrc("alpha")).not.toContain("folder_open");

      deferredListing.resolve(childEntries);

      await waitFor(() => {
        expect(screen.getByText("child.txt")).toBeInTheDocument();
      });
    },
  );

  it.each(["icons-l", "list"] as const)(
    "primes the open-folder icon only after a short grace window in double-click mode for %s view",
    async (viewMode) => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      useSettingsStore.getState().updateExplorer({
        viewMode,
        gridZoom: 0.67,
        folderClickMode: "double",
      });

      renderExplorer();
      await screen.findByText("alpha");

      expect(getEntryIconSrc("alpha")).not.toContain("folder_open");

      fireEvent.click(screen.getByText("alpha"));

      expect(
        vi
          .mocked(invoke)
          .mock.calls.some(
            ([command, args]) =>
              (command === "fs_list_dir" ||
                command === "fs_list_dir_uncached") &&
              (args as { path?: string } | undefined)?.path ===
                `${REPO_ROOT}\\alpha`,
          ),
      ).toBe(true);
      expect(getEntryIconSrc("alpha")).not.toContain("folder_open");

      await vi.advanceTimersByTimeAsync(180);

      expect(getEntryIconSrc("alpha")).toContain("folder_open");
      expect(await screen.findByText("Folder Contents")).toBeInTheDocument();
    },
  );

  it("cancels folder preview priming when a double click opens the directory", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const alphaPath = `${REPO_ROOT}\\alpha`;
    const childEntries = [
      {
        name: "child.txt",
        path: `${alphaPath}\\child.txt`,
        is_dir: false,
        size: 42,
        modified: 0,
        extension: "txt",
        is_hidden: false,
        is_symlink: false,
      },
    ];
    const deferredListing = createDeferred<typeof childEntries>();
    const baseInvokeImplementation = vi.mocked(invoke).getMockImplementation();
    if (!baseInvokeImplementation) {
      throw new Error("Missing default invoke mock implementation");
    }

    vi.mocked(invoke).mockImplementation(
      async (command: string, args?: unknown) => {
        const payload = args as { path?: string } | undefined;
        if (command === "fs_list_dir" || command === "fs_list_dir_uncached") {
          return payload?.path === alphaPath ? deferredListing.promise : ENTRIES;
        }
        return baseInvokeImplementation(
          command,
          args as Parameters<typeof invoke>[1],
        );
      },
    );

    useSettingsStore.getState().updateExplorer({
      viewMode: "icons-l",
      gridZoom: 0.67,
      folderClickMode: "double",
    });

    renderExplorer();
    await screen.findByText("alpha");

    const alphaEntry = screen.getByText("alpha");
    fireEvent.click(alphaEntry);
    expect(getEntryIconSrc("alpha")).not.toContain("folder_open");

    fireEvent.doubleClick(alphaEntry);
    await vi.advanceTimersByTimeAsync(220);

    expect(screen.queryByText("Folder Contents")).not.toBeInTheDocument();
    expect(
      explorerPolicyMockState.resolveEntryOpenWithPolicyCalls.some(
        (request) => request.entry.path === alphaPath,
      ),
    ).toBe(false);

    deferredListing.resolve(childEntries);

    await waitFor(() => {
      expect(screen.getByText("child.txt")).toBeInTheDocument();
    });
  });

  it("keeps managed theme icons ahead of native icon fallback for mapped explorer entries", async () => {
    useSettingsStore.getState().updateAppearance({ useNativeOsIcons: true });
    useSettingsStore.getState().updateExplorer({
      folderIconRules: [
        {
          id: "alpha-folder",
          label: "Alpha Folder",
          matchers: ["alpha"],
          icon: "folder_src",
        },
      ],
    });

    const baseInvokeImplementation = vi.mocked(invoke).getMockImplementation();
    if (!baseInvokeImplementation) {
      throw new Error("Missing default invoke mock implementation");
    }

    vi.mocked(invoke).mockImplementation(
      async (command: string, args?: unknown) => {
        if (command === "fs_resolve_native_icons") {
          const payload = args as
            | { requests?: Array<{ path: string }> }
            | undefined;
          return (payload?.requests ?? []).map(({ path }) => ({
            path,
            src: "data:image/png;base64,bmF0aXZlLWljb24=",
          }));
        }

        return baseInvokeImplementation(
          command,
          args as Parameters<typeof invoke>[1],
        );
      },
    );

    renderExplorer();
    await screen.findByText("alpha");

    expect(getEntryIconSrc("alpha")).toContain("/icons/folder_src.svg");
    expect(getEntryIconSrc("preview.png")).toContain("/icons/image.svg");
    expect(getEntryIconSrc("notes.txt")).toContain("/icons/txt.svg");
    expect(
      vi
        .mocked(invoke)
        .mock.calls.some(([command]) => command === "fs_resolve_native_icons"),
    ).toBe(false);
  });

  it("keeps managed semantic icons ahead of native fallback when entry metadata drifts from the filename extension", async () => {
    useSettingsStore.getState().updateAppearance({ useNativeOsIcons: true });

    const driftedEntries = ENTRIES.map((entry) =>
      entry.name === "preview.png"
        ? {
            ...entry,
            extension: "mystery",
          }
        : entry,
    );

    const baseInvokeImplementation = vi.mocked(invoke).getMockImplementation();
    if (!baseInvokeImplementation) {
      throw new Error("Missing default invoke mock implementation");
    }

    vi.mocked(invoke).mockImplementation(
      async (command: string, args?: unknown) => {
        if (command === "fs_list_dir" || command === "fs_list_dir_uncached") {
          return driftedEntries;
        }
        if (command === "fs_resolve_native_icons") {
          const payload = args as
            | { requests?: Array<{ path: string }> }
            | undefined;
          return (payload?.requests ?? []).map(({ path }) => ({
            path,
            src: "data:image/png;base64,bmF0aXZlLWljb24=",
          }));
        }

        return baseInvokeImplementation(
          command,
          args as Parameters<typeof invoke>[1],
        );
      },
    );

    renderExplorer();
    await screen.findByText("preview.png");

    expect(getEntryIconSrc("preview.png")).toContain("/icons/image.svg");
    expect(
      vi
        .mocked(invoke)
        .mock.calls.some(([command]) => command === "fs_resolve_native_icons"),
    ).toBe(false);
  });

  it("keeps ctrl-wheel scaling responsive after the explorer remounts its layout shell", async () => {
    useSettingsStore
      .getState()
      .updateExplorer({ viewMode: "icons-m", gridZoom: 0 });

    const { appearance, rerender } = renderExplorer();
    await screen.findByText("alpha");

    rerender(
      <FileExplorer
        theme={{
          accent: appearance.theme.palette.accent,
          bg: appearance.theme.palette.appBackground,
          bgPanel: appearance.theme.palette.panelBackground,
          text: appearance.theme.palette.textPrimary,
          border: appearance.theme.palette.border,
          textMuted: appearance.theme.palette.textMuted,
        }}
        appearance={appearance}
        layoutMode="dock"
        onOpenInTerminal={() => {}}
        onAddBookmark={async () => {}}
      />,
    );
    await screen.findByText("alpha");

    rerender(
      <FileExplorer
        theme={{
          accent: appearance.theme.palette.accent,
          bg: appearance.theme.palette.appBackground,
          bgPanel: appearance.theme.palette.panelBackground,
          text: appearance.theme.palette.textPrimary,
          border: appearance.theme.palette.border,
          textMuted: appearance.theme.palette.textMuted,
        }}
        appearance={appearance}
        onOpenInTerminal={() => {}}
        onAddBookmark={async () => {}}
      />,
    );
    await screen.findByText("alpha");

    dispatchLayoutWheelOnFileArea(-120);

    await waitFor(() => {
      expect(useSettingsStore.getState().settings.explorer.viewMode).toBe(
        "icons-s",
      );
      expect(
        useSettingsStore.getState().settings.explorer.gridZoom,
      ).toBeGreaterThan(0);
    });
  });

  it("changes adaptive density with ctrl-wheel without leaving the experimental mode", async () => {
    useSettingsStore.getState().updateExplorer({
      experimentalViewMode: "adaptive-semantic-grid",
      experimentalDensity: 0.4,
      viewMode: "details",
    });

    renderExplorer();
    await screen.findByText("alpha");

    dispatchLayoutWheel("alpha", -120);

    await waitFor(() => {
      expect(
        useSettingsStore.getState().settings.explorer.experimentalViewMode,
      ).toBe("adaptive-semantic-grid");
      expect(
        useSettingsStore.getState().settings.explorer.experimentalDensity,
      ).toBeGreaterThan(0.4);
      expect(useSettingsStore.getState().settings.explorer.viewMode).toBe(
        "details",
      );
    });
  });

  it("uses plain wheel to zoom the constellation field instead of falling back to page scroll", async () => {
    useSettingsStore.getState().updateExplorer({
      experimentalViewMode: "constellation",
      experimentalDensity: 0.5,
      viewMode: "details",
    });

    renderExplorer();
    await screen.findByText("alpha");

    const field = screen.getByRole("group", {
      name: /constellation field/i,
    });
    const initialZoom = Number(
      field.getAttribute("data-overlay-constellation-zoom"),
    );

    dispatchConstellationWheel(-120);

    await waitFor(() => {
      expect(
        Number(field.getAttribute("data-overlay-constellation-zoom")),
      ).toBeGreaterThan(initialZoom);
      expect(
        useSettingsStore.getState().settings.explorer.experimentalDensity,
      ).toBe(0.5);
      expect(
        useSettingsStore.getState().settings.explorer.experimentalViewMode,
      ).toBe("constellation");
    });
  });

  it("routes ctrl-wheel inside the constellation field to camera zoom without touching app zoom or density", async () => {
    useSettingsStore.getState().updateExplorer({
      experimentalViewMode: "constellation",
      experimentalDensity: 0.32,
      viewMode: "details",
    });

    renderExplorer();
    await screen.findByText("alpha");

    const field = screen.getByRole("group", {
      name: /constellation field/i,
    });
    const initialZoom = Number(
      field.getAttribute("data-overlay-constellation-zoom"),
    );
    const appZoomBefore =
      useSettingsStore.getState().settings.appearance.appZoom;

    dispatchConstellationWheel(-120, { ctrlKey: true });

    await waitFor(() => {
      expect(
        Number(field.getAttribute("data-overlay-constellation-zoom")),
      ).toBeGreaterThan(initialZoom);
      expect(
        useSettingsStore.getState().settings.explorer.experimentalDensity,
      ).toBe(0.32);
      expect(useSettingsStore.getState().settings.appearance.appZoom).toBe(
        appZoomBefore,
      );
    });
  });

  it("extends the selection with shift+arrow navigation", async () => {
    renderExplorer();
    await screen.findByText("alpha");

    fireEvent.click(screen.getByText("alpha"));
    expect(screen.getByText(/1 selected/i)).toBeTruthy();

    fireEvent.keyDown(window, { key: "ArrowDown", shiftKey: true });

    await waitFor(() => {
      expect(screen.getByText(/2 selected/i)).toBeTruthy();
    });
  });

  it("keeps the selection summary visible while a selected empty folder waits on size measurement", async () => {
    const alphaPath = `${REPO_ROOT}\\alpha`;
    const selectedFolderMeasureDeferred = createDeferred<
      Array<{
        path: string;
        bytes: number;
        is_dir: boolean;
        is_complete: boolean;
      }>
    >();
    const measureRequests: string[][] = [];
    const baseInvokeImplementation = vi.mocked(invoke).getMockImplementation();
    if (!baseInvokeImplementation) {
      throw new Error("Missing default invoke mock implementation");
    }

    vi.mocked(invoke).mockImplementation(
      async (command: string, args?: Parameters<typeof invoke>[1]) => {
        const payload = args as { paths?: string[] } | undefined;
        if (command === "fs_measure_entry_sizes") {
          const paths = payload?.paths ?? [];
          measureRequests.push(paths);
          if (paths.includes(alphaPath)) {
            return selectedFolderMeasureDeferred.promise;
          }
        }
        return baseInvokeImplementation(command, args);
      },
    );

    renderExplorer();
    const idleSelectionSummary = screen.getByTitle(
      "Selected item size summary",
    );
    expect(idleSelectionSummary).toHaveStyle({ visibility: "hidden" });
    const alphaEntry = (await screen.findAllByText("alpha")).find((candidate) =>
      candidate.closest('[data-overlay-explorer-plane="file-area"]'),
    );
    if (!alphaEntry) {
      throw new Error("Explorer row not found for alpha");
    }
    fireEvent.click(alphaEntry);

    const selectionSummary = screen.getByTitle("Selected item size summary");
    expect(selectionSummary).toHaveStyle({ visibility: "visible" });
    expect(selectionSummary).toHaveTextContent("Selected");
    expect(selectionSummary).toHaveTextContent("0/1 measured");
    expect(selectionSummary).toHaveTextContent("—");

    await waitFor(() => {
      expect(measureRequests[0]).toContain(alphaPath);
    });

    selectedFolderMeasureDeferred.resolve([
      {
        path: alphaPath,
        bytes: 0,
        is_dir: true,
        is_complete: true,
      },
    ]);
  });

  it("updates the preview while arrow navigation moves through row-based explorer views", async () => {
    const keyboardEntries = [
      {
        name: "alpha.txt",
        path: `${REPO_ROOT}\\alpha.txt`,
        is_dir: false,
        size: 128,
        modified: 0,
        extension: "txt",
        is_hidden: false,
        is_symlink: false,
      },
      {
        name: "beta.png",
        path: `${REPO_ROOT}\\beta.png`,
        is_dir: false,
        size: 256,
        modified: 0,
        extension: "png",
        is_hidden: false,
        is_symlink: false,
      },
      {
        name: "gamma.txt",
        path: `${REPO_ROOT}\\gamma.txt`,
        is_dir: false,
        size: 512,
        modified: 0,
        extension: "txt",
        is_hidden: false,
        is_symlink: false,
      },
    ] as const;
    const baseInvokeImplementation = vi.mocked(invoke).getMockImplementation();
    if (!baseInvokeImplementation) {
      throw new Error("Missing default invoke mock implementation");
    }

    vi.mocked(invoke).mockImplementation(
      async (command: string, args?: unknown) => {
        const payload = args as { path?: string } | undefined;
        if (command === "fs_list_dir" || command === "fs_list_dir_uncached") {
          return keyboardEntries;
        }
        if (command === "fs_read_text_file") {
          if (payload?.path === keyboardEntries[0].path) {
            return "alpha keyboard preview";
          }
          if (payload?.path === keyboardEntries[2].path) {
            return "gamma keyboard preview";
          }
        }
        if (
          command === "fs_read_file_base64" &&
          payload?.path === keyboardEntries[1].path
        ) {
          return "data:image/png;base64,ZmFrZQ==";
        }
        return baseInvokeImplementation(command, args as never);
      },
    );

    useSettingsStore.getState().updateExplorer({ viewMode: "details" });

    renderExplorer();
    await screen.findByText("alpha.txt");

    fireEvent.click(screen.getByText("alpha.txt"));
    await waitFor(() => {
      expect(screen.getByTestId("monaco-editor")).toHaveTextContent(
        "alpha keyboard preview",
      );
    });

    fireEvent.keyDown(window, { key: "ArrowDown" });
    await waitFor(() => {
      expect(
        screen.getByTestId("mock-explorer-image-editor"),
      ).toHaveTextContent("beta.png");
    });

    fireEvent.keyDown(window, { key: "ArrowDown" });
    await waitFor(() => {
      expect(screen.getByTestId("monaco-editor")).toHaveTextContent(
        "gamma keyboard preview",
      );
    });
  });

  it("uses the icon-grid layout for left-right-up-down explorer navigation", async () => {
    const clientWidthDescriptor = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      "clientWidth",
    );
    const clientHeightDescriptor = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      "clientHeight",
    );
    Object.defineProperty(HTMLElement.prototype, "clientWidth", {
      configurable: true,
      get() {
        return 540;
      },
    });
    Object.defineProperty(HTMLElement.prototype, "clientHeight", {
      configurable: true,
      get() {
        return 900;
      },
    });

    const gridEntries = [
      {
        name: "a.txt",
        path: `${REPO_ROOT}\\a.txt`,
        is_dir: false,
        size: 128,
        modified: 0,
        extension: "txt",
        is_hidden: false,
        is_symlink: false,
      },
      {
        name: "b.png",
        path: `${REPO_ROOT}\\b.png`,
        is_dir: false,
        size: 256,
        modified: 0,
        extension: "png",
        is_hidden: false,
        is_symlink: false,
      },
      {
        name: "c.txt",
        path: `${REPO_ROOT}\\c.txt`,
        is_dir: false,
        size: 384,
        modified: 0,
        extension: "txt",
        is_hidden: false,
        is_symlink: false,
      },
      {
        name: "d.png",
        path: `${REPO_ROOT}\\d.png`,
        is_dir: false,
        size: 512,
        modified: 0,
        extension: "png",
        is_hidden: false,
        is_symlink: false,
      },
      {
        name: "e.txt",
        path: `${REPO_ROOT}\\e.txt`,
        is_dir: false,
        size: 640,
        modified: 0,
        extension: "txt",
        is_hidden: false,
        is_symlink: false,
      },
      {
        name: "f.png",
        path: `${REPO_ROOT}\\f.png`,
        is_dir: false,
        size: 768,
        modified: 0,
        extension: "png",
        is_hidden: false,
        is_symlink: false,
      },
    ] as const;
    const baseInvokeImplementation = vi.mocked(invoke).getMockImplementation();
    if (!baseInvokeImplementation) {
      throw new Error("Missing default invoke mock implementation");
    }

    vi.mocked(invoke).mockImplementation(
      async (command: string, args?: unknown) => {
        const payload = args as { path?: string } | undefined;
        if (command === "fs_list_dir" || command === "fs_list_dir_uncached") {
          return gridEntries;
        }
        if (command === "fs_read_text_file") {
          if (payload?.path === gridEntries[0].path) {
            return "preview a";
          }
          if (payload?.path === gridEntries[2].path) {
            return "preview c";
          }
          if (payload?.path === gridEntries[4].path) {
            return "preview e";
          }
        }
        if (
          command === "fs_read_file_base64" &&
          typeof payload?.path === "string" &&
          payload.path.endsWith(".png")
        ) {
          return "data:image/png;base64,ZmFrZQ==";
        }
        return baseInvokeImplementation(command, args as never);
      },
    );

    useSettingsStore.getState().updateExplorer({ viewMode: "icons-l" });

    try {
      renderExplorer();
      await screen.findByText("d.png");

      fireEvent.click(screen.getByText("d.png"));
      await waitFor(() => {
        expect(
          screen.getByTestId("mock-explorer-image-editor"),
        ).toHaveTextContent("d.png");
      });

      fireEvent.keyDown(window, { key: "ArrowRight" });
      await waitFor(() => {
        expect(screen.getByTestId("monaco-editor")).toHaveTextContent(
          "preview e",
        );
      });

      fireEvent.keyDown(window, { key: "ArrowLeft" });
      await waitFor(() => {
        expect(
          screen.getByTestId("mock-explorer-image-editor"),
        ).toHaveTextContent("d.png");
      });

      fireEvent.keyDown(window, { key: "ArrowUp" });
      await waitFor(() => {
        expect(screen.getByTestId("monaco-editor")).toHaveTextContent(
          "preview a",
        );
      });

      fireEvent.keyDown(window, { key: "ArrowDown" });
      await waitFor(() => {
        expect(
          screen.getByTestId("mock-explorer-image-editor"),
        ).toHaveTextContent("d.png");
      });
    } finally {
      if (clientWidthDescriptor) {
        Object.defineProperty(
          HTMLElement.prototype,
          "clientWidth",
          clientWidthDescriptor,
        );
      } else {
        Reflect.deleteProperty(HTMLElement.prototype, "clientWidth");
      }
      if (clientHeightDescriptor) {
        Object.defineProperty(
          HTMLElement.prototype,
          "clientHeight",
          clientHeightDescriptor,
        );
      } else {
        Reflect.deleteProperty(HTMLElement.prototype, "clientHeight");
      }
    }
  });

  it("prompts for a collision policy before pasting over an existing name", async () => {
    const defaultInvoke = vi.mocked(invoke).getMockImplementation();
    if (!defaultInvoke) {
      throw new Error("Expected default invoke mock implementation");
    }

    useExplorerStore.getState().setClipboard({
      action: "copy",
      entries: [
        {
          path: `${REPO_ROOT}\\notes.txt`,
          name: "notes.txt",
          is_dir: false,
        },
      ],
    });

    vi.mocked(invoke).mockImplementation(
      async (command: string, args?: unknown) => {
        const payload = args as
          | {
              targetDir?: string;
              sources?: string[];
              operation?: "copy" | "move";
              collisionPolicy?: "keep_both" | "replace" | "skip";
            }
          | undefined;
        if (command === "fs_plan_transfer_items") {
          return [
            {
              source_path: `${REPO_ROOT}\\notes.txt`,
              source_name: "notes.txt",
              destination_path: `${REPO_ROOT}\\notes.txt`,
              operation: "copy",
              destination_exists: true,
              destination_is_dir: false,
            },
          ];
        }
        if (command === "fs_transfer_items") {
          return [
            {
              source_path: `${REPO_ROOT}\\notes.txt`,
              destination_path: `${payload?.targetDir ?? REPO_ROOT}\\notes.txt`,
              operation: payload?.operation ?? "copy",
              collision_policy: payload?.collisionPolicy ?? "keep_both",
              disposition: "transferred",
            },
          ];
        }
        return defaultInvoke(command, args as never);
      },
    );

    renderExplorer();
    await screen.findByText("alpha");

    fireEvent.keyDown(window, { key: "v", ctrlKey: true });

    await screen.findByText(/name conflict/i);
    fireEvent.click(screen.getByLabelText(/replace existing items/i));
    fireEvent.click(screen.getByRole("button", { name: /copy with replace/i }));

    await waitFor(() => {
      expect(
        vi
          .mocked(invoke)
          .mock.calls.some(
            ([command, payload]) =>
              command === "fs_transfer_items" &&
              (payload as { collisionPolicy?: string }).collisionPolicy ===
                "replace",
          ),
      ).toBe(true);
    });
  });

  it("opens editable image previews in fullscreen preview mode and only enters edit tools on demand", async () => {
    renderExplorer();
    const imageEntry = await screen.findByText("preview.png");

    fireEvent.click(imageEntry);

    const imageEditor = await screen.findByTestId("mock-explorer-image-editor");
    expect(imageEditor).toHaveTextContent("preview.png:preview");
    expect(imageEditor).toHaveAttribute("data-image-mode", "preview");
    expect(imageEditor).toHaveAttribute("data-image-workflow-tab", "preview");

    await waitFor(() => {
      const previewModeToggle = getChromeControl("previewModeToggle");
      expect(previewModeToggle).not.toBeNull();
      expectChromeControlButtonOrder("previewModeToggle", [
        "Preview",
        "Edit",
        "Cutout",
      ]);
    });
    const previewModeToggle = getChromeControl("previewModeToggle");

    fireEvent.click(
      within(previewModeToggle as HTMLElement).getByRole("button", {
        name: "Edit",
      }),
    );

    await waitFor(() => {
      expect(
        screen.getByTestId("mock-explorer-image-editor"),
      ).toHaveTextContent("preview.png:edit");
      expect(screen.getByTestId("mock-explorer-image-editor")).toHaveAttribute(
        "data-image-mode",
        "edit",
      );
      expect(screen.getByTestId("mock-explorer-image-editor")).toHaveAttribute(
        "data-image-workflow-tab",
        "edit",
      );
    });

    fireEvent.click(
      within(previewModeToggle as HTMLElement).getByRole("button", {
        name: "Cutout",
      }),
    );

    await waitFor(() => {
      expect(
        screen.getByTestId("mock-explorer-image-editor"),
      ).toHaveTextContent("preview.png:cutout");
      expect(screen.getByTestId("mock-explorer-image-editor")).toHaveAttribute(
        "data-image-mode",
        "edit",
      );
      expect(screen.getByTestId("mock-explorer-image-editor")).toHaveAttribute(
        "data-image-workflow-tab",
        "cutout",
      );
    });

  });

  it("adapts preview-pane context-menu actions to the active image workflow tab", async () => {
    renderExplorer();
    fireEvent.click(await screen.findByText("preview.png"));

    const imageEditor = await screen.findByTestId("mock-explorer-image-editor");
    fireEvent.contextMenu(imageEditor);

    await screen.findByText("Image Menu Action");
    expect(screen.queryByText("Cutout Menu Action")).not.toBeInTheDocument();
    expect(screen.queryByText("Show Tool Rail")).not.toBeInTheDocument();

    const previewModeToggle = getChromeControl("previewModeToggle");
    fireEvent.click(
      within(previewModeToggle as HTMLElement).getByRole("button", {
        name: "Cutout",
      }),
    );

    await waitFor(() => {
      expect(screen.getByTestId("mock-explorer-image-editor")).toHaveAttribute(
        "data-image-workflow-tab",
        "cutout",
      );
    });

    fireEvent.contextMenu(screen.getByTestId("mock-explorer-image-editor"));
    await screen.findByText("Image Cutout Menu Action");
    expect(screen.getByText("Cutout Menu Action")).toBeInTheDocument();
    expect(screen.getByText("Show Tool Rail")).toBeInTheDocument();
  });

  it("lets plugin preview lanes claim files and register workflow tabs plus preview context actions", async () => {
    const mockPluginPreviewLane: OverlayPluginPreviewLaneContribution = {
      id: "mock-plugin.preview-lane.notes",
      pluginId: "mock-plugin",
      pluginName: "Mock Plugin",
      title: "Notes Lane",
      priority: 900,
      rendererEntry: "preview/notes.tsx",
      runtimeId: null,
      match: {
        appliesTo: "file",
        extensions: ["txt"],
        fileNames: [],
      },
      capabilities: {
        editable: true,
        save: false,
        export: false,
        workflowTabs: true,
        contextMenu: true,
        prefetch: false,
        closeGuard: false,
      },
      component: function MockPluginPreviewLane({
        file,
        viewMode,
        workflowTabId,
        onRegisterWorkflowTabs,
        onRegisterContextMenuRegistration,
      }) {
        React.useEffect(() => {
          onRegisterWorkflowTabs?.([
            {
              id: "inspect",
              label: "Inspect",
              baseMode: "edit",
            },
          ]);
          return () => onRegisterWorkflowTabs?.(null);
        }, [onRegisterWorkflowTabs]);

        React.useEffect(() => {
          onRegisterContextMenuRegistration?.({
            previewKind: "plugin",
            baseActions: [
              {
                id: "mock.plugin.base",
                title: "Plugin Preview Action",
                onSelect: () => {},
              },
            ],
            workflowOverlays: [
              {
                workflowTabId: "inspect",
                actions: [
                  {
                    id: "mock.plugin.base",
                    title: "Plugin Inspect Action",
                  },
                  {
                    id: "mock.plugin.inspect.extra",
                    title: "Inspect Extra Action",
                    onSelect: () => {},
                  },
                ],
              },
            ],
          });
          return () => onRegisterContextMenuRegistration?.(null);
        }, [onRegisterContextMenuRegistration]);

        return (
          <div
            data-testid="mock-plugin-preview-lane"
            data-plugin-file={file.name}
            data-plugin-view-mode={viewMode}
            data-plugin-workflow-tab={workflowTabId}
          >
            {`${file.name}:${workflowTabId}:${viewMode}`}
          </div>
        );
      },
    };

    renderExplorer({
      pluginPreviewLanes: [mockPluginPreviewLane],
    });
    fireEvent.click(
      await screen.findByText("notes.txt", undefined, {
        timeout: 5000,
      }),
    );

    await waitFor(() => {
      expect(screen.getByTestId("mock-plugin-preview-lane")).toHaveAttribute(
        "data-plugin-file",
        "notes.txt",
      );
    });
    expect(screen.getByTestId("mock-plugin-preview-lane")).toHaveAttribute(
      "data-plugin-workflow-tab",
      "preview",
    );

    const workbenchChooserToggle = await screen.findByTestId(
      "preview-workbench-chooser-toggle",
    );
    fireEvent.click(workbenchChooserToggle);
    const workbenchChooser = screen.getByTestId("preview-workbench-chooser");
    expect(
      workbenchChooserToggle.parentElement?.contains(workbenchChooser),
    ).toBe(false);
    expect(
      within(workbenchChooser).getByText("Mock Plugin: Notes Lane"),
    ).toBeInTheDocument();
    expect(
      within(workbenchChooser).getByText("Text Workbench"),
    ).toBeInTheDocument();
    expect(
      within(workbenchChooser).getByText(
        "The current workbench won on priority.",
      ),
    ).toBeInTheDocument();
    fireEvent.click(workbenchChooserToggle);

    fireEvent.contextMenu(getPreviewPane());
    await screen.findByText("Plugin Preview Action");
    expect(screen.queryByText("Inspect Extra Action")).not.toBeInTheDocument();

    const previewModeToggle = getChromeControl("previewModeToggle");
    fireEvent.click(
      within(previewModeToggle as HTMLElement).getByRole("button", {
        name: "Inspect",
      }),
    );

    await waitFor(() => {
      expect(screen.getByTestId("mock-plugin-preview-lane")).toHaveAttribute(
        "data-plugin-workflow-tab",
        "inspect",
      );
      expect(screen.getByTestId("mock-plugin-preview-lane")).toHaveAttribute(
        "data-plugin-view-mode",
        "edit",
      );
    });

    fireEvent.contextMenu(getPreviewPane());
    await screen.findByText("Plugin Inspect Action");
    expect(screen.getByText("Inspect Extra Action")).toBeInTheDocument();
  });

  it("lets child preview surfaces suppress the shared preview-pane context menu", async () => {
    previewContextMenuMockState.stopPropagationOnImageEditorContextMenu = true;

    renderExplorer();
    fireEvent.click(await screen.findByText("preview.png"));

    const imageEditor = await screen.findByTestId("mock-explorer-image-editor");
    fireEvent.contextMenu(imageEditor);

    expect(screen.queryByText("Image Menu Action")).not.toBeInTheDocument();
    expect(
      document.querySelector("[data-overlay-explorer-context-menu-node]"),
    ).toBeNull();
  });

  it("starts pointer-driven internal explorer drags without invoking the native drag bridge", async () => {
    renderExplorer();
    const entry = await screen.findByText("notes.txt");
    const dragSource = entry.closest('[data-overlay-drag-source="file"]');
    if (!(dragSource instanceof HTMLElement)) {
      throw new Error("Expected draggable explorer entry");
    }

    const dragGesture = startExplorerPointerDrag(dragSource);

    expect(screen.getByTestId("explorer-drag-overlay")).toHaveTextContent(
      "notes.txt",
    );
    expect(screen.getByTestId("explorer-drag-overlay")).toHaveTextContent(
      "Move",
    );

    expect(
      vi
        .mocked(invoke)
        .mock.calls.some(
          ([command]) => command === "fs_start_native_file_drag",
        ),
    ).toBe(false);

    finishExplorerPointerDrag(dragGesture);
  });

  it("moves multi-selected files into the hovered folder without leaking the drop to the viewport root", async () => {
    renderExplorer();
    await screen.findByText("alpha");
    const contentViewport = document.querySelector(
      '[data-overlay-explorer-plane="content-viewport"]',
    ) as HTMLElement | null;
    if (!(contentViewport instanceof HTMLElement)) {
      throw new Error("Expected explorer content viewport");
    }

    fireEvent.click(within(contentViewport).getByText("notes.txt"));
    fireEvent.click(within(contentViewport).getByText("preview.png"), {
      ctrlKey: true,
    });
    expect(screen.getByText(/2 selected/i)).toBeTruthy();
    const dragSource = within(contentViewport)
      .getByText("preview.png")
      .closest('[data-overlay-drag-source="file"]');
    const folderTarget = screen
      .getByText("alpha")
      .closest('[data-overlay-drag-source="file"]');
    if (
      !(dragSource instanceof HTMLElement) ||
      !(folderTarget instanceof HTMLElement)
    ) {
      throw new Error("Expected draggable explorer entries");
    }

    const originalElementFromPoint = document.elementFromPoint;
    Object.defineProperty(document, "elementFromPoint", {
      configurable: true,
      value: vi.fn(() => folderTarget),
    });

    try {
      const dragGesture = startExplorerPointerDrag(dragSource, {
        endX: 96,
        endY: 48,
      });
      expect(screen.getByTestId("explorer-drag-overlay")).toHaveTextContent("2");
      expect(screen.getByTestId("explorer-drag-overlay")).toHaveTextContent(
        "preview.png",
      );
      finishExplorerPointerDrag(dragGesture);
    } finally {
      if (originalElementFromPoint) {
        Object.defineProperty(document, "elementFromPoint", {
          configurable: true,
          value: originalElementFromPoint,
        });
      } else {
        Reflect.deleteProperty(document, "elementFromPoint");
      }
    }

    await waitFor(() => {
      const transferCalls = vi
        .mocked(invoke)
        .mock.calls.filter(([command]) => command === "fs_transfer_items");
      expect(transferCalls).toHaveLength(1);
      expect(transferCalls[0]?.[1]).toMatchObject({
        targetDir: `${REPO_ROOT}\\alpha`,
        sources: [`${REPO_ROOT}\\notes.txt`, `${REPO_ROOT}\\preview.png`],
        operation: "move",
      });
    });
  });

  it("drops into the current folder when hovering explorer chrome outside the main file plane", async () => {
    renderExplorer();
    await screen.findByText("alpha");

    const dataTransfer = createDataTransfer();
    const explorerRoot = document.querySelector(
      "[data-overlay-explorer]",
    ) as HTMLElement | null;
    if (!(explorerRoot instanceof HTMLElement)) {
      throw new Error("Expected explorer root");
    }
    vi.mocked(dataTransfer.getData).mockImplementation((kind: string) => {
      if (kind === "text/uri-list") {
        return "file:///C:/incoming/drop-me.txt";
      }
      return "";
    });

    const originalElementFromPoint = document.elementFromPoint;
    const mockElementFromPoint = vi.fn(() => explorerRoot);
    Object.defineProperty(document, "elementFromPoint", {
      configurable: true,
      value: mockElementFromPoint,
    });

    try {
      fireEvent.dragOver(explorerRoot, {
        dataTransfer,
        clientX: 28,
        clientY: 28,
      });
      expect(
        screen.getByTestId("explorer-window-drop-indicator"),
      ).toHaveTextContent("Copy 1 item into this folder");
      fireEvent.drop(explorerRoot, {
        dataTransfer,
        clientX: 28,
        clientY: 28,
      });
    } finally {
      if (originalElementFromPoint) {
        Object.defineProperty(document, "elementFromPoint", {
          configurable: true,
          value: originalElementFromPoint,
        });
      } else {
        Reflect.deleteProperty(document, "elementFromPoint");
      }
    }

    await waitFor(() => {
      const transferCalls = vi
        .mocked(invoke)
        .mock.calls.filter(([command]) => command === "fs_transfer_items");
      expect(transferCalls).toHaveLength(1);
      expect(transferCalls[0]?.[1]).toMatchObject({
        targetDir: REPO_ROOT,
        sources: ["C:\\incoming\\drop-me.txt"],
        operation: "copy",
      });
    });
  });

  it("copies native external drops into the hovered folder via the Tauri drag-drop listener", async () => {
    const currentWindow = getCurrentWindow();
    renderExplorer();
    await screen.findByText("alpha");
    const folderTarget = screen
      .getByText("alpha")
      .closest('[data-overlay-drag-source="file"]');
    if (!(folderTarget instanceof HTMLElement)) {
      throw new Error("Expected folder target");
    }

    await waitFor(() => {
      expect(
        vi.mocked(currentWindow.onDragDropEvent).mock.calls.length,
      ).toBeGreaterThan(0);
    });

    const dragDropCalls = vi.mocked(currentWindow.onDragDropEvent).mock.calls;
    const nativeDragHandler = dragDropCalls[dragDropCalls.length - 1]?.[0];
    if (!nativeDragHandler) {
      throw new Error("Expected native drag-drop listener");
    }
    const expectedTargetDir = folderTarget.getAttribute(
      "data-overlay-drop-target-path",
    );
    if (!expectedTargetDir) {
      throw new Error("Expected folder drop target path");
    }

    const position = {
      x: 64,
      y: 32,
      toLogical: vi.fn().mockReturnValue({ x: 64, y: 32 }),
    };
    const originalElementFromPoint = document.elementFromPoint;
    const mockElementFromPoint = vi.fn(() => folderTarget);
    Object.defineProperty(document, "elementFromPoint", {
      configurable: true,
      value: mockElementFromPoint,
    });

    try {
      await nativeDragHandler({
        payload: {
          type: "over",
          position,
        },
      } as never);
      await nativeDragHandler({
        payload: {
          type: "drop",
          paths: [`${REPO_ROOT}\\\\notes.txt`],
          position,
        },
      } as never);
    } finally {
      if (originalElementFromPoint) {
        Object.defineProperty(document, "elementFromPoint", {
          configurable: true,
          value: originalElementFromPoint,
        });
      } else {
        Reflect.deleteProperty(document, "elementFromPoint");
      }
    }

    await waitFor(() => {
      const transferCalls = vi
        .mocked(invoke)
        .mock.calls.filter(([command]) => command === "fs_transfer_items");
      expect(transferCalls).toHaveLength(1);
      expect(transferCalls[0]?.[1]).toMatchObject({
        targetDir: expectedTargetDir,
        sources: [`${REPO_ROOT}\\\\notes.txt`],
        operation: "copy",
      });
    });
  });

  it("drops native external drags into the current folder when the pointer is over a file card", async () => {
    const currentWindow = getCurrentWindow();
    renderExplorer();
    await screen.findByText("alpha");
    const fileTarget = screen
      .getByText("preview.png")
      .closest('[data-overlay-drag-source="file"]');
    if (!(fileTarget instanceof HTMLElement)) {
      throw new Error("Expected file target");
    }

    await waitFor(() => {
      expect(
        vi.mocked(currentWindow.onDragDropEvent).mock.calls.length,
      ).toBeGreaterThan(0);
    });

    const dragDropCalls = vi.mocked(currentWindow.onDragDropEvent).mock.calls;
    const nativeDragHandler = dragDropCalls[dragDropCalls.length - 1]?.[0];
    if (!nativeDragHandler) {
      throw new Error("Expected native drag-drop listener");
    }

    const position = {
      x: 96,
      y: 48,
      toLogical: vi.fn().mockReturnValue({ x: 96, y: 48 }),
    };
    const originalElementFromPoint = document.elementFromPoint;
    const mockElementFromPoint = vi.fn(() => fileTarget);
    Object.defineProperty(document, "elementFromPoint", {
      configurable: true,
      value: mockElementFromPoint,
    });

    try {
      await nativeDragHandler({
        payload: {
          type: "over",
          position,
        },
      } as never);
      await nativeDragHandler({
        payload: {
          type: "drop",
          paths: [`${REPO_ROOT}\\\\notes.txt`],
          position,
        },
      } as never);
    } finally {
      if (originalElementFromPoint) {
        Object.defineProperty(document, "elementFromPoint", {
          configurable: true,
          value: originalElementFromPoint,
        });
      } else {
        Reflect.deleteProperty(document, "elementFromPoint");
      }
    }

    await waitFor(() => {
      const transferCalls = vi
        .mocked(invoke)
        .mock.calls.filter(([command]) => command === "fs_transfer_items");
      expect(transferCalls).toHaveLength(1);
      expect(transferCalls[0]?.[1]).toMatchObject({
        targetDir: REPO_ROOT,
        sources: [`${REPO_ROOT}\\\\notes.txt`],
        operation: "copy",
      });
    });
  });

  it("starts the native drag bridge only when Alt is held for supported local entries", async () => {
    renderExplorer();
    const entry = await screen.findByText("notes.txt");
    const dragSource = entry.closest('[data-overlay-drag-source=\"file\"]');
    if (!(dragSource instanceof HTMLElement)) {
      throw new Error("Expected draggable explorer entry");
    }

    const dragGesture = startExplorerPointerDrag(dragSource, { altKey: true });
    expect(
      vi
        .mocked(invoke)
        .mock.calls.some(
          ([command]) => command === "fs_start_native_file_drag",
        ),
    ).toBe(true);
    finishExplorerPointerDrag({ ...dragGesture, altKey: true });
  });

  it("opens an in-app tag dialog and applies comma-separated tags to the current selection", async () => {
    const user = userEvent.setup();
    const invokeMock = vi.mocked(invoke);

    renderExplorer();

    await screen.findByText("notes.txt");
    await user.click(screen.getByText("notes.txt"));
    await user.click(screen.getByRole("button", { name: "Tag" }));

    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByRole("textbox"), "docs, review");
    await user.click(
      within(dialog).getByRole("button", { name: "Apply Tags" }),
    );

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith("explorer_tags_set_for_paths", {
        request: {
          paths: [`${REPO_ROOT}\\notes.txt`],
          tagNames: ["docs", "review"],
          mode: "add",
        },
      });
    });
  });
});
