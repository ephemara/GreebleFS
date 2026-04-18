import React from "react";
import {
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

vi.mock("../components/ExplorerImageEditor", () => ({
  ExplorerImageEditor: ({ imageName }: { imageName: string }) => (
    <div data-testid="mock-explorer-image-editor">{imageName}</div>
  ),
}));

vi.mock("../components/ExplorerVideoEditor", () => ({
  ExplorerVideoEditor: ({ videoName }: { videoName: string }) => (
    <div data-testid="mock-explorer-video-editor">{videoName}</div>
  ),
}));

vi.mock("../components/ExplorerAudioWorkbench", () => ({
  ExplorerAudioWorkbench: ({ audioName }: { audioName: string }) => (
    <div data-testid="mock-explorer-audio-workbench">{audioName}</div>
  ),
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
    onControllerChange?: (controller: {
      goToPreviousPage: () => void;
      goToNextPage: () => void;
      goToPage: (pageIndex: number) => void;
      zoomIn: () => void;
      zoomOut: () => void;
      setFitMode: (mode: "none" | "fitWidth" | "fitPage") => void;
      toggleEditMode: () => void;
      save: () => Promise<boolean>;
    } | null) => void;
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
      onRegisterCloseGuard?.(async () => true);
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

import {
  FileExplorer,
  invalidateExplorerResultCaches,
} from "../components/FileExplorer";
import {
  normalizeThemeDefinition,
  resolveOverlayAppearance,
} from "../config/appearance";
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
] as const;

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

function getExplorerViewport(anchorText: string) {
  const anchor = screen.getByText(anchorText);
  const viewport = anchor.closest(".overlay-scroll-area__content")
    ?.parentElement as HTMLElement | null;
  if (!viewport) {
    throw new Error("Explorer viewport not found");
  }
  return viewport;
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

describe("FileExplorer view modes", () => {
  beforeEach(() => {
    resetOverlayTermStorage(window.localStorage);
    useSettingsStore.getState().resetToDefaults();
    useExplorerStore.getState().resetSession();
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
            return {
              kind: "image",
              posterDataUrl: "data:image/png;base64,ZmFrZQ==",
              hoverFrames: [],
              hoverFrameDelayMs: null,
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

  it("lets the user switch explorer modes from the toolbar without mutating the live session shell preset", async () => {
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
      expect(screen.queryByRole("button", { name: /manage/i })).toBeNull();
      expect(
        screen.getByRole("button", { name: /open sources rail/i }),
      ).toBeInTheDocument();
    });
  });

  it("can close the sources rail into focus mode and reopen it without leaving that mode", async () => {
    renderExplorer();
    await screen.findByText("alpha");

    fireEvent.click(screen.getByRole("button", { name: "Focus" }));

    await waitFor(() => {
      expect(
        useSettingsStore.getState().settings.explorer
          .modeProfileOverridesByThemeId.operator,
      ).toBe("focus");
      expect(useExplorerStore.getState().session.sourcesVisible).toBe(false);
      expect(useExplorerStore.getState().session.sourcesRailPinnedOpen).toBe(
        false,
      );
      expect(screen.queryByRole("button", { name: /manage/i })).toBeNull();
      expect(
        screen.getByRole("button", { name: /open sources rail/i }),
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /open sources rail/i }));

    await waitFor(() => {
      expect(useExplorerStore.getState().session.sourcesVisible).toBe(true);
      expect(useExplorerStore.getState().session.sourcesRailPinnedOpen).toBe(
        true,
      );
      expect(
        screen.getByRole("button", { name: /manage/i }),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /open sources rail/i }),
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

  it("opens html files in preview mode when a rendered document preview is available", async () => {
    renderExplorer();
    await screen.findByText("index.html");

    fireEvent.click(screen.getByText("index.html"));

    await waitFor(() => {
      expect(useExplorerStore.getState().session.documentViewMode).toBe("preview");
    });
    expect(await screen.findByTitle("HTML document preview")).toBeInTheDocument();
    expect(screen.queryByTestId("monaco-editor")).toBeNull();
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
            return {
              kind: "image",
              posterDataUrl: "data:image/png;base64,ZmFrZQ==",
              hoverFrames: [],
              hoverFrameDelayMs: null,
            };
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

  it("mounts the embedded audio workbench for previewable audio files without routing them through text loading", async () => {
    renderExplorer();
    await screen.findByText("anthem.mp3");

    fireEvent.click(screen.getByText("anthem.mp3"));

    expect(
      await screen.findByTestId("mock-explorer-audio-workbench"),
    ).toHaveTextContent("anthem.mp3");
    expect(
      vi
        .mocked(invoke)
        .mock.calls.some(([command]) => command === "fs_read_text_file"),
    ).toBe(false);
  });

  it("mounts the embedded video editor when selecting a previewable video file", async () => {
    renderExplorer();
    await screen.findByText("trailer.mp4");

    fireEvent.click(screen.getByText("trailer.mp4"));

    expect(
      await screen.findByTestId("mock-explorer-video-editor"),
    ).toHaveTextContent("trailer.mp4");
    expect(
      vi
        .mocked(invoke)
        .mock.calls.some(([command]) => command === "fs_read_text_file"),
    ).toBe(false);
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

    vi.mocked(invoke).mockImplementation(async (command: string, args?: unknown) => {
      const payload = args as { path?: string; showHidden?: boolean } | undefined;
      if (
        (command === "fs_list_dir" || command === "fs_list_dir_uncached") &&
        payload?.path === `${REPO_ROOT}\\alpha`
      ) {
        return folderEntries;
      }
      return baseInvokeImplementation(command, args as never);
    });

    renderExplorer();
    await screen.findByText("alpha");

    fireEvent.click(screen.getByText("alpha"));

    expect(await screen.findByText("Folder Contents")).toBeInTheDocument();
    expect(await screen.findByText("shots")).toBeInTheDocument();
    expect(await screen.findByText("readme.md")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /copy path/i })).toBeInTheDocument();
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

    vi.mocked(invoke).mockImplementation(async (command: string, args?: unknown) => {
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
    });

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
    await waitFor(() => {
      expect(useExplorerStore.getState().session.documentViewMode).toBe("edit");
    });
    expect(
      vi
        .mocked(invoke)
        .mock.calls.some(([command]) => command === "pdf_open_preview_document"),
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

  it("mounts the embedded image editor when selecting an editable image preview", async () => {
    renderExplorer();
    const imageEntry = await screen.findByText("preview.png");

    fireEvent.click(imageEntry);

    expect(
      await screen.findByTestId("mock-explorer-image-editor"),
    ).toHaveTextContent("preview.png");
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
    const dragSource = screen
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
