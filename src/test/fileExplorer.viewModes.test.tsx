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
import { beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";

const {
  pdfPreviewMockState,
  previewTerminalMockState,
  spreadsheetWorkbenchMockState,
  shaderWorkbenchMockState,
} = vi.hoisted(() => ({
  pdfPreviewMockState: {
    closeGuardResult: true,
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
}));

vi.mock("@/components/AppIcons", async () =>
  vi.importActual<typeof import("lucide-react")>("lucide-react"),
);

vi.mock("../components/ExplorerImageEditor", () => ({
  ExplorerImageEditor: ({
    imageName,
    mode = "edit",
  }: {
    imageName: string;
    mode?: "preview" | "edit";
  }) => (
    <div
      data-testid="mock-explorer-image-editor"
      data-image-mode={mode}
    >{`${imageName}:${mode}`}</div>
  ),
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
  }: {
    audioName: string;
    mode?: "preview" | "edit";
  }) => (
    <div data-testid="mock-explorer-audio-workbench" data-audio-mode={mode}>
      {`${audioName}:${mode}`}
    </div>
  ),
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
      <div data-testid="mock-explorer-spreadsheet-workbench" data-spreadsheet-mode={mode}>
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
import {
  normalizeThemeDefinition,
  resolveOverlayAppearance,
} from "../config/appearance";
import {
  getBuiltInIconTheme,
  resolveFileIconSrc,
} from "../config/iconTheme";
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
    appearance?: ReturnType<typeof resolveOverlayAppearance>;
    chromeControlSurface?: "toolbar" | "topbar";
    layoutMode?: "full" | "dock";
    workspacePaneCount?: 1 | 2 | 4;
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
        chromeControlSurface={options.chromeControlSurface}
        layoutMode={options.layoutMode}
        workspacePaneCount={options.workspacePaneCount}
        onOpenInTerminal={() => {}}
        onAddBookmark={async () => {}}
      />,
    ),
  };
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
  viewport.dispatchEvent(
    new WheelEvent("wheel", {
      bubbles: true,
      cancelable: true,
      ctrlKey: true,
      deltaY,
    }),
  );
}

function dispatchLayoutWheelOnElement(element: Element, deltaY: number) {
  element.dispatchEvent(
    new WheelEvent("wheel", {
      bubbles: true,
      cancelable: true,
      ctrlKey: true,
      deltaY,
    }),
  );
}

function dispatchLayoutWheelOnFileArea(deltaY: number) {
  const fileArea = document.querySelector(
    '[data-overlay-explorer-plane="file-area"]',
  ) as HTMLElement | null;
  if (!fileArea) {
    throw new Error("Explorer file area not found");
  }
  fileArea.dispatchEvent(
    new WheelEvent("wheel", {
      bubbles: true,
      cancelable: true,
      ctrlKey: true,
      deltaY,
    }),
  );
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
    'tr, [draggable="true"]',
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
    'tr, [draggable="true"]',
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
  beforeEach(() => {
    const currentWindow = getCurrentWindow();
    pdfPreviewMockState.closeGuardResult = true;
    previewTerminalMockState.mountCount = 0;
    previewTerminalMockState.lastProps = null;
    spreadsheetWorkbenchMockState.lastMode = "preview";
    shaderWorkbenchMockState.lastSelectionLabel = "";
    vi.mocked(currentWindow.onDragDropEvent).mockClear();
    vi.mocked(currentWindow.scaleFactor).mockClear();
    resetOverlayTermStorage(window.localStorage);
    useSettingsStore.getState().resetToDefaults();
    useExplorerStore.getState().resetSession();
    useExplorerStore.getState().setPropertiesPanel(null);
    useExplorerStore
      .getState()
      .replaceRail(createDefaultExplorerRailSnapshot());
    useExplorerStore.getState().clearPersistenceNotice();
    invalidateExplorerResultCaches();

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
    fireEvent.click(screen.getByRole("menuitemradio", { name: /columns/i }));

    expect(useSettingsStore.getState().settings.explorer.viewMode).toBe(
      "columns",
    );
  });

  it("lets the user switch explorer modes from the toolbar without mutating the live session shell preset or sources visibility", async () => {
    renderExplorer();
    await screen.findByText("alpha");

    expect(screen.getByRole("button", { name: /manage/i })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /explorer mode:/i }));
    fireEvent.click(screen.getByRole("menuitemradio", { name: /focus/i }));

    await waitFor(() => {
      expect(
        useSettingsStore.getState().settings.explorer
          .modeProfileOverridesByThemeId.operator,
      ).toBe("focus");
      expect(useExplorerStore.getState().session.shellLayoutId).toBe(
        "balanced",
      );
      expect(useExplorerStore.getState().session.sourcesVisible).toBe(true);
      expect(screen.getByRole("button", { name: /manage/i })).toBeInTheDocument();
      expect(getChromeControl("railClose")).not.toBeNull();
      expect(
        screen.queryByRole("button", { name: /open sources panel/i }),
      ).toBeNull();
    });
  });

  it("can close the sources rail in inspector mode and reopen it without leaving that mode", async () => {
    renderExplorer();
    await screen.findByText("alpha");

    fireEvent.click(screen.getByRole("button", { name: /explorer mode:/i }));
    fireEvent.click(screen.getByRole("menuitemradio", { name: /inspector/i }));

    await waitFor(() => {
      expect(
        useSettingsStore.getState().settings.explorer
          .modeProfileOverridesByThemeId.operator,
      ).toBe("inspector");
      expect(useExplorerStore.getState().session.sourcesVisible).toBe(true);
      expect(screen.getByRole("button", { name: /manage/i })).toBeInTheDocument();
    });

    fireEvent.click(within(getChromeControl("railClose") as HTMLElement).getByRole("button"));

    await waitFor(() => {
      expect(
        useSettingsStore.getState().settings.explorer
          .modeProfileOverridesByThemeId.operator,
      ).toBe("inspector");
      expect(useExplorerStore.getState().session.sourcesVisible).toBe(false);
      expect(screen.queryByRole("button", { name: /manage/i })).toBeNull();
      expect(
        screen.getByRole("button", { name: /open sources panel/i }),
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /open sources panel/i }));

    await waitFor(() => {
      expect(
        useSettingsStore.getState().settings.explorer
          .modeProfileOverridesByThemeId.operator,
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
    ).toBe("secondaryStart");
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

  it("applies persisted chrome layout overrides without mutating shell layout state", async () => {
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
    expect(useExplorerStore.getState().session.sourcesVisible).toBe(false);
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

  it("opens executable scripts in an editor-first preview with a run mode backed by the preview terminal", async () => {
    renderExplorer();
    await screen.findByText("build.bat");

    fireEvent.click(screen.getByText("build.bat"));

    await screen.findByRole("button", { name: /copy path/i });
    expect(screen.queryByText(/preview unavailable/i)).toBeNull();
    expect(screen.getByRole("button", { name: /^edit$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^run$/i })).toBeInTheDocument();
    expectChromeControlButtonOrder("previewModeToggle", ["Run", "Edit"]);
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
      expect(previewTerminalMockState.lastProps?.pendingCommandRequest).toEqual(
        expect.objectContaining({
          id: expect.stringContaining("preview-primary:"),
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

  it("collapses the closed sources rail helper copy in multi-pane mode", async () => {
    useExplorerStore.getState().updateSession({
      sourcesVisible: false,
    });

    renderExplorer({ workspacePaneCount: 2 });
    await screen.findByText("notes.txt");

    expect(screen.getByRole("button", { name: /open sources panel/i })).toHaveTextContent("Sources");
    expect(screen.queryByText(/sources rail closed/i)).toBeNull();
    expect(
      screen.queryByText(/focus mode keeps the sources rail tucked away/i),
    ).toBeNull();
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

    rerender(
      <FileExplorer
        {...sharedProps}
        workspacePaneCount={2}
      />,
    );
    expect(queryPreviewPane()).toBeNull();

    rerender(
      <FileExplorer
        {...sharedProps}
        workspacePaneCount={1}
      />,
    );
    await screen.findByRole("button", { name: /copy path/i });
  });

  it("shows an icon-only preview terminal toggle, swaps surfaces, and keeps the terminal session mounted", async () => {
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
      expect(previewTerminalMockState.mountCount).toBe(1);
      expect(getChromeControl("previewCopyPath")).not.toBeNull();
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

  it("toggles the sources panel from the explorer hotkey", async () => {
    renderExplorer();
    await screen.findByText("alpha");

    fireEvent.keyDown(window, { key: "b", ctrlKey: true });

    await waitFor(() => {
      expect(useExplorerStore.getState().session.sourcesVisible).toBe(false);
      expect(screen.getByRole("button", { name: /open sources panel/i })).toBeInTheDocument();
    });

    fireEvent.keyDown(window, { key: "b", ctrlKey: true });

    await waitFor(() => {
      expect(useExplorerStore.getState().session.sourcesVisible).toBe(true);
      expect(screen.queryByRole("button", { name: /open sources panel/i })).toBeNull();
      expect(screen.getByRole("button", { name: /manage/i })).toBeInTheDocument();
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
    await userEvent.click(
      screen.getByRole("button", { name: "Report Alpha Cwd" }),
    );

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
      expect(useExplorerStore.getState().workspace.layoutMode).toBe("single");
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
    expect(useExplorerStore.getState().workspace.layoutMode).toBe("single");
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
      expect(useExplorerStore.getState().workspace.layoutMode).toBe("single");
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

    expect(useExplorerStore.getState().workspace.layoutMode).toBe("single");

    fireEvent.click(screen.getByText("preview.png"));
    expect(
      await screen.findByTestId("mock-explorer-image-editor"),
    ).toHaveTextContent("preview.png");
    expect(getPreviewPane()).toHaveAttribute(
      "data-overlay-explorer-preview-split-mode",
      "pane",
    );
  });

  it("switches text files back to Monaco with a loading fallback while text content resolves", async () => {
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

    fireEvent.click(screen.getByText("notes.txt"));

    await waitFor(() => {
      expect(useExplorerStore.getState().session.documentViewMode).toBe("edit");
    });
    expect(await screen.findByText(/loading editor/i)).toBeInTheDocument();
    expect(screen.queryByTestId("mock-explorer-image-editor")).toBeNull();

    textLoad.resolve("const value = 1;");

    expect(await screen.findByTestId("monaco-editor")).toHaveTextContent(
      "const value = 1;",
    );
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

    vi.mocked(invoke).mockImplementation(async (command: string, args?: unknown) => {
      if (command === "fs_list_dir" || command === "fs_list_dir_uncached") {
        return [...ENTRIES, spreadsheetEntry];
      }
      return defaultInvoke(command, args as never);
    });

    renderExplorer();
    await screen.findByText("colors.csv");

    fireEvent.click(screen.getByText("colors.csv"));

    expect(
      await screen.findByTestId("mock-explorer-spreadsheet-workbench"),
    ).toHaveTextContent("colors.csv:preview");
    await waitFor(() => {
      expect(useExplorerStore.getState().session.documentViewMode).toBe("preview");
    });
    expectChromeControlButtonOrder("previewModeToggle", ["Preview", "Edit"]);

    fireEvent.click(within(getPreviewPane()).getByRole("button", { name: /^edit$/i }));

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
    const defaultInvokeImplementation = vi.mocked(invoke).getMockImplementation();
    let checksumCallCount = 0;

    vi.mocked(invoke).mockImplementation(async (command: string, args?: Parameters<typeof invoke>[1]) => {
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
    });

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
    expectChromeControlButtonOrder("previewModeToggle", ["Preview", "Edit"]);
    fireEvent.click(
      within(previewModeToggle as HTMLElement).getByRole("button", {
        name: "Edit",
      }),
    );

    expect(await screen.findByTestId("mock-explorer-audio-workbench")).toHaveTextContent(
      "anthem.mp3:edit",
    );
    expect(
      vi
        .mocked(invoke)
        .mock.calls.some(([command]) => command === "fs_read_text_file"),
    ).toBe(false);
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
      expect(screen.getByTestId("mock-explorer-audio-workbench")).toHaveTextContent(
        "anthem.mp3:edit",
      );
    });

    fireEvent.keyDown(window, { key: "e" });

    await waitFor(() => {
      expect(useExplorerStore.getState().session.documentViewMode).toBe(
        "preview",
      );
      expect(screen.getByTestId("mock-explorer-audio-workbench")).toHaveTextContent(
        "anthem.mp3:preview",
      );
    });
  });

  it("defaults videos to playback preview and only enters video edit mode when requested", async () => {
    renderExplorer();
    await screen.findByText("trailer.mp4");

    fireEvent.click(screen.getByText("trailer.mp4"));

    const videoWorkbench = await screen.findByTestId("mock-explorer-video-editor");
    expect(videoWorkbench).toHaveTextContent("trailer.mp4:preview");

    const previewModeToggle = getChromeControl("previewModeToggle");
    expect(previewModeToggle).not.toBeNull();
    expectChromeControlButtonOrder("previewModeToggle", ["Preview", "Edit"]);
    fireEvent.click(
      within(previewModeToggle as HTMLElement).getByRole("button", {
        name: "Edit",
      }),
    );

    expect(await screen.findByTestId("mock-explorer-video-editor")).toHaveTextContent(
      "trailer.mp4:edit",
    );
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
      expect(vi.mocked(invoke)).toHaveBeenCalledWith(
        "fs_read_entry_thumbnail",
        {
          request: {
            path: `${REPO_ROOT}\\preview.png`,
            maxWidth: 256,
            maxHeight: 256,
            includeVideoHoverScrub: false,
            videoHoverFrameCount: null,
          },
        },
      );
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

  it("renders a dedicated experimental modes button and menu next to the standard layout control", async () => {
    renderExplorer();
    await screen.findByText("alpha");

    fireEvent.click(
      screen.getByRole("button", { name: /experimental view modes:/i }),
    );

    expect(
      screen.getByRole("menu", { name: /explorer experimental modes menu/i }),
    ).toBeTruthy();
    expect(
      screen.getByRole("menuitemradio", { name: /adaptive semantic grid/i }),
    ).toBeTruthy();
    expect(
      screen.getByRole("menuitemradio", { name: /constellation view/i }),
    ).not.toBeDisabled();
    expect(
      screen.getByRole("menuitemradio", { name: /timeline surface/i }),
    ).not.toBeDisabled();
  });

  it("activates adaptive semantic grid without mutating the saved normal layout mode", async () => {
    useSettingsStore.getState().updateExplorer({ viewMode: "columns" });

    renderExplorer();
    await screen.findByText("alpha");

    fireEvent.click(
      screen.getByRole("button", { name: /experimental view modes:/i }),
    );
    fireEvent.click(
      screen.getByRole("menuitemradio", { name: /adaptive semantic grid/i }),
    );

    expect(
      useSettingsStore.getState().settings.explorer.experimentalViewMode,
    ).toBe("adaptive-semantic-grid");
    expect(useSettingsStore.getState().settings.explorer.viewMode).toBe(
      "columns",
    );
    expect(
      screen.getByRole("button", {
        name: /experimental view modes: adaptive semantic grid/i,
      }),
    ).toBeTruthy();
    expect(
      screen.queryByText(
        /larger semantic tiles that favor browsing and recognition\./i,
      ),
    ).toBeNull();
  });

  it("activates constellation view without mutating the saved normal layout mode", async () => {
    useSettingsStore.getState().updateExplorer({ viewMode: "details" });

    renderExplorer();
    await screen.findByText("alpha");

    fireEvent.click(
      screen.getByRole("button", { name: /experimental view modes:/i }),
    );
    fireEvent.click(
      screen.getByRole("menuitemradio", { name: /constellation view/i }),
    );

    expect(
      useSettingsStore.getState().settings.explorer.experimentalViewMode,
    ).toBe("constellation");
    expect(useSettingsStore.getState().settings.explorer.viewMode).toBe(
      "details",
    );
    expect(
      screen.getByRole("button", {
        name: /experimental view modes: constellation view/i,
      }),
    ).toBeTruthy();
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
      screen.getByRole("button", { name: /experimental view modes:/i }),
    );
    fireEvent.click(
      screen.getByRole("menuitemradio", { name: /timeline surface/i }),
    );

    expect(
      useSettingsStore.getState().settings.explorer.experimentalViewMode,
    ).toBe("timeline-surface");
    expect(useSettingsStore.getState().settings.explorer.viewMode).toBe(
      "columns",
    );
    expect(
      screen.getByRole("button", {
        name: /experimental view modes: timeline surface/i,
      }),
    ).toBeTruthy();
    expect(
      screen.queryByText(
        /browse folders and files as time-banded activity surfaces\./i,
      ),
    ).toBeNull();
    expect(screen.getAllByText(/undated/i).length).toBeGreaterThan(0);
  });

  it("scales the explorer grid with ctrl-wheel without changing app zoom", async () => {
    useSettingsStore
      .getState()
      .updateExplorer({ viewMode: "icons-m", gridZoom: 0 });

    renderExplorer();
    await screen.findByText("alpha");

    const appearanceZoomBefore =
      useSettingsStore.getState().settings.appearance.appZoom;
    dispatchLayoutWheel("alpha", -120);

    await waitFor(() => {
      expect(useSettingsStore.getState().settings.explorer.viewMode).toBe(
        "icons-l",
      );
      expect(
        useSettingsStore.getState().settings.explorer.gridZoom,
      ).toBeGreaterThan(0);
    });
    expect(useSettingsStore.getState().settings.appearance.appZoom).toBe(
      appearanceZoomBefore,
    );
  });

  it("smoothly scales icon layouts before switching away from the grid", async () => {
    useSettingsStore
      .getState()
      .updateExplorer({ viewMode: "icons-l", gridZoom: 0.5 });

    renderExplorer();
    await screen.findByText("alpha");

    dispatchLayoutWheel("alpha", -120);

    await waitFor(() => {
      expect(
        useSettingsStore.getState().settings.explorer.gridZoom,
      ).toBeGreaterThan(0.5);
      expect(useSettingsStore.getState().settings.explorer.viewMode).toBe(
        "icons-xl",
      );
    });
  });

  it("scales the explorer grid when ctrl-wheel happens on the file area shell", async () => {
    useSettingsStore
      .getState()
      .updateExplorer({ viewMode: "icons-m", gridZoom: 0 });

    renderExplorer();
    await screen.findByText("alpha");

    dispatchLayoutWheelOnFileArea(-120);

    await waitFor(() => {
      expect(useSettingsStore.getState().settings.explorer.viewMode).toBe(
        "icons-l",
      );
      expect(
        useSettingsStore.getState().settings.explorer.gridZoom,
      ).toBeGreaterThan(0);
    });
  });

  it("uses the dedicated explorer viewport class for visible file-list scrollbars", async () => {
    renderExplorer();
    await screen.findByText("alpha");

    expect(getExplorerViewport("alpha")).toHaveClass(
      "overlay-scroll-area__viewport--explorer-file-list",
    );
  });

  it("switches between icon and list view from footer toggles", async () => {
    useSettingsStore.getState().updateExplorer({ viewMode: "details" });

    renderExplorer();
    await screen.findByText("alpha");

    fireEvent.click(
      screen.getByRole("button", { name: /switch explorer to icon view/i }),
    );
    await waitFor(() => {
      expect(useSettingsStore.getState().settings.explorer.viewMode).toBe(
        "icons-l",
      );
    });

    fireEvent.click(
      screen.getByRole("button", { name: /switch explorer to list view/i }),
    );
    await waitFor(() => {
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

      expect(getEntryIconSrc("alpha")).not.toContain("folder_open");

      fireEvent.click(screen.getByText("alpha"));

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
      expect(getEntryIconSrc("alpha")).not.toContain("folder_open");

      deferredListing.resolve(childEntries);

      await waitFor(() => {
        expect(screen.getByText("child.txt")).toBeInTheDocument();
      });
    },
  );

  it.each(["icons-l", "list"] as const)(
    "shows the primed open-folder icon and loads folder preview on first click in double-click mode for %s view",
    async (viewMode) => {
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
      expect(getEntryIconSrc("alpha")).toContain("folder_open");
    },
  );

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
        "icons-l",
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
      expect(screen.getByTestId("mock-explorer-image-editor")).toHaveTextContent(
        "beta.png",
      );
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
        expect(screen.getByTestId("mock-explorer-image-editor")).toHaveTextContent(
          "d.png",
        );
      });

      fireEvent.keyDown(window, { key: "ArrowRight" });
      await waitFor(() => {
        expect(screen.getByTestId("monaco-editor")).toHaveTextContent(
          "preview e",
        );
      });

      fireEvent.keyDown(window, { key: "ArrowLeft" });
      await waitFor(() => {
        expect(screen.getByTestId("mock-explorer-image-editor")).toHaveTextContent(
          "d.png",
        );
      });

      fireEvent.keyDown(window, { key: "ArrowUp" });
      await waitFor(() => {
        expect(screen.getByTestId("monaco-editor")).toHaveTextContent(
          "preview a",
        );
      });

      fireEvent.keyDown(window, { key: "ArrowDown" });
      await waitFor(() => {
        expect(screen.getByTestId("mock-explorer-image-editor")).toHaveTextContent(
          "d.png",
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

    const previewModeToggle = getChromeControl("previewModeToggle");
    expect(previewModeToggle).not.toBeNull();
    expectChromeControlButtonOrder("previewModeToggle", ["Preview", "Edit"]);

    fireEvent.click(
      within(previewModeToggle as HTMLElement).getByRole("button", {
        name: "Edit",
      }),
    );

    await waitFor(() => {
      expect(screen.getByTestId("mock-explorer-image-editor")).toHaveTextContent(
        "preview.png:edit",
      );
      expect(
        screen.getByTestId("mock-explorer-image-editor"),
      ).toHaveAttribute("data-image-mode", "edit");
    });
  });

  it("starts native drag on plain explorer drags while keeping in-app payloads available", async () => {
    renderExplorer();
    const entry = await screen.findByText("notes.txt");
    const dataTransfer = createDataTransfer();
    const dragSource = entry.closest('[data-overlay-drag-source="file"]');
    if (!(dragSource instanceof HTMLElement)) {
      throw new Error("Expected draggable explorer entry");
    }

    const event = createEvent.dragStart(dragSource, { dataTransfer });
    fireEvent(dragSource, event);

    expect(dataTransfer.setData).toHaveBeenCalledWith(
      "application/x-overlayterm-drag-intent",
      "native-out",
    );
    expect(dataTransfer.setDragImage).toHaveBeenCalledTimes(1);
    const [dragImage] =
      vi.mocked(dataTransfer.setDragImage).mock.calls[0] ?? [];
    expect(dragImage).toBeInstanceOf(HTMLCanvasElement);
    expect(
      vi
        .mocked(invoke)
        .mock.calls.some(
          ([command]) => command === "fs_start_native_file_drag",
        ),
    ).toBe(true);
    expect(dataTransfer.setData).toHaveBeenCalledWith(
      "application/x-overlayterm-paths",
      JSON.stringify([`${REPO_ROOT}\\notes.txt`]),
    );
  });

  it("moves multi-selected files into the hovered folder without leaking the drop to the viewport root", async () => {
    renderExplorer();
    await screen.findByText("alpha");

    fireEvent.click(screen.getByText("notes.txt"));
    fireEvent.click(screen.getByText("preview.png"), { ctrlKey: true });
    expect(screen.getByText(/2 selected/i)).toBeTruthy();

    const dataTransfer = createDataTransfer();
    const contentViewport = document.querySelector(
      '[data-overlay-explorer-plane="content-viewport"]',
    ) as HTMLElement | null;
    if (!(contentViewport instanceof HTMLElement)) {
      throw new Error("Expected explorer content viewport");
    }
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

    fireEvent(dragSource, createEvent.dragStart(dragSource, { dataTransfer }));
    fireEvent.dragOver(folderTarget, { dataTransfer });
    fireEvent.drop(folderTarget, { dataTransfer });

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

  it("moves native same-window drags into the hovered folder via the Tauri drag-drop listener", async () => {
    const currentWindow = getCurrentWindow();
    renderExplorer();
    await screen.findByText("alpha");

    const dataTransfer = createDataTransfer();
    const dragSource = screen
      .getByText("notes.txt")
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

    fireEvent(dragSource, createEvent.dragStart(dragSource, { dataTransfer }));

    await waitFor(() => {
      expect(vi.mocked(currentWindow.onDragDropEvent).mock.calls.length).toBeGreaterThan(0);
    });

    const dragDropCalls = vi.mocked(currentWindow.onDragDropEvent).mock.calls;
    const nativeDragHandler =
      dragDropCalls[dragDropCalls.length - 1]?.[0];
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
        operation: "move",
      });
    });
  });

  it("keeps explorer drags internal when Shift is held", async () => {
    renderExplorer();
    const entry = await screen.findByText("notes.txt");
    const dataTransfer = createDataTransfer();
    const dragSource = entry.closest('[data-overlay-drag-source=\"file\"]');
    if (!(dragSource instanceof HTMLElement)) {
      throw new Error("Expected draggable explorer entry");
    }

    const event = createEvent.dragStart(dragSource, { dataTransfer });
    Object.defineProperty(event, "shiftKey", { value: true });
    fireEvent(dragSource, event);

    expect(dataTransfer.setData).toHaveBeenCalledWith(
      "application/x-overlayterm-drag-intent",
      "internal",
    );
    expect(
      vi
        .mocked(invoke)
        .mock.calls.some(
          ([command]) => command === "fs_start_native_file_drag",
        ),
    ).toBe(false);
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
