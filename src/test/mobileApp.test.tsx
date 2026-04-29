import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import App from "../../src-mobile/App";
import type { MobilePluginRuntimeContext } from "../../src-mobile/mobilePluginRuntime";
import { useMobileStore } from "../../src-mobile/mobileStore";
import type {
  MobilePreviewResponse,
  MobilePluginCatalogResponse,
  MobileSearchResponse,
  MobileSearchStatusResponse,
  MobileShareListingResponse,
  MobileShareThemeSnapshot,
} from "../../src-mobile/types";

const mobileThemeSnapshot: MobileShareThemeSnapshot = {
  themeId: "operator",
  themeName: "Operator",
  uiFontFamily: "Inter, system-ui, sans-serif",
  monoFontFamily: "\"JetBrains Mono\", monospace",
  palette: {
    appBackground: "#07111a",
    appBackgroundAlt: "#04070b",
    shellBackground: "rgba(10, 18, 28, 0.9)",
    topBarBackground: "#101010",
    panelBackground: "rgba(16, 28, 40, 0.96)",
    inputBackground: "rgba(8, 15, 24, 0.86)",
    textPrimary: "#edf4ff",
    textMuted: "rgba(218, 232, 247, 0.74)",
    border: "rgba(121, 167, 216, 0.18)",
    borderStrong: "rgba(121, 167, 216, 0.32)",
    accent: "#79d6ff",
    accentStrong: "#4fb8ff",
    accentSoft: "rgba(121, 214, 255, 0.12)",
  },
  metrics: {
    controlRadius: 16,
    panelRadius: 24,
    pagePadding: 16,
    panelGap: 14,
  },
  shadow: "0 18px 48px rgba(0, 0, 0, 0.34)",
  cssVars: {},
  iconTheme: {
    id: "builtin",
    name: "Builtin",
    file: "txt",
    folder: "folder",
    folderExpanded: "folder_open",
    iconDefinitions: {
      txt: "data:image/svg+xml;base64,PHN2Zy8+",
      folder: "data:image/svg+xml;base64,PHN2Zy8+",
      folder_open: "data:image/svg+xml;base64,PHN2Zy8+",
      image: "data:image/svg+xml;base64,PHN2Zy8+",
      search: "data:image/svg+xml;base64,PHN2Zy8+",
    },
    fileExtensions: {
      png: "image",
      txt: "txt",
    },
    fileNames: {},
    folderNames: {
      src: "folder",
    },
    folderNamesExpanded: {},
    uiIcons: {
      search: "lucide:Search",
      settings: "lucide:Settings2",
      folder_tree: "lucide:FolderTree",
      download: "lucide:ArrowDownToLine",
    },
  },
  folderIconRules: [
    {
      id: "docs",
      label: "Docs",
      matchers: ["docs"],
      icon: "folder",
    },
  ],
  defaultFolderIcon: "folder",
  layout: {
    viewMode: "icons-m",
    gridZoom: 1,
    interfaceScale: 1.08,
    chromeScale: 1.08,
    pagePadding: 16,
    touchComfort: "comfortable",
    showHiddenFiles: false,
    sortBy: "name",
    sortOrder: "asc",
    directoriesFirst: true,
    showTabLabels: true,
  },
  pluginSettingsById: {},
};

const listingResponse: MobileShareListingResponse = {
  currentPath: "",
  parentPath: "",
  canGoUp: false,
  shareName: "GreebleFS",
  hubMode: false,
  totalCount: 2,
  offset: 0,
  limit: 160,
  nextOffset: null,
  entries: [
    {
      name: "photos",
      relativePath: "photos",
      isDir: true,
      isHidden: false,
      size: 0,
      extension: "",
      mimeType: null,
      modifiedMs: 1710000000000,
      entryKind: "directory",
      iconId: "folder",
      thumbnailUrl: null,
      previewKind: "folder",
      canPreview: true,
      canDownload: false,
      fileUrl: null,
      downloadUrl: null,
    },
    {
      name: "photo.png",
      relativePath: "photo.png",
      isDir: false,
      isHidden: false,
      size: 2048,
      extension: "png",
      mimeType: "image/png",
      modifiedMs: 1710000000000,
      entryKind: "image",
      iconId: "image",
      thumbnailUrl: null,
      previewKind: "image",
      canPreview: true,
      canDownload: true,
      fileUrl: "/files/photo.png",
      downloadUrl: "/files/photo.png",
    },
  ],
};

const previewResponse: MobilePreviewResponse = {
  entry: listingResponse.entries[1],
  previewKind: "image",
  mediaUrl: "/files/photo.png",
  posterUrl: null,
  openUrl: "/files/photo.png",
  pageCount: null,
  textExcerpt: null,
  textTruncated: false,
  folderSummary: null,
  archiveSummary: null,
};

const searchStatusResponse: MobileSearchStatusResponse = {
  shareName: "GreebleFS",
  scopePath: "",
  searchAvailable: true,
  message: null,
  status: {
    isScanInProgress: false,
    isCommitting: false,
    isParallelScan: false,
    lastScanTime: 1710000000000,
    indexedItemCount: 42,
    indexSizeBytes: 1024,
    currentDriveRoot: null,
    driveScanErrors: [],
    isIndexValid: true,
    scannedDrivesCount: 1,
    totalDrivesCount: 1,
  },
};

const searchResponse: MobileSearchResponse = {
  query: "photo",
  shareName: "GreebleFS",
  scopePath: "",
  totalCount: 1,
  entries: [
    {
      ...listingResponse.entries[1],
      parentRelativePath: "",
      score: 0.98,
    },
  ],
};

const pluginCatalogResponse: MobilePluginCatalogResponse = {
  pluginRoot: "C:/Dev/GreebleFS/usr/plugins",
  refreshedAtMs: 1710000000000,
  plugins: [
    {
      id: "demo-mobile",
      manifestId: "demo-mobile",
      directoryName: "demo-mobile",
      name: "Demo Mobile",
      description: "Demo plugin",
      category: "Utilities",
      tags: ["mobile"],
      settingsValues: {},
      capabilities: {
        desktopPanel: true,
        mobilePanes: 1,
        backendActions: 1,
        themes: 0,
        shaders: 0,
        fonts: 0,
        commands: 0,
        previewLanes: 0,
        settingsSlots: 0,
        contextMenuItems: 0,
      },
      rootAccess: {
        sameRootAsDesktopPlugins: true,
        usrRelativeRoot: "plugins",
        pluginDirectoryName: "demo-mobile",
        backendDirectoryName: "backend",
        canRunBackend: true,
        backendRoute: "/api/plugins/demo-mobile/backend",
        assetRoutePrefix: "/api/plugins/demo-mobile/assets",
      },
    },
  ],
  panes: [
    {
      id: "demo-mobile.mobile-pane.tools",
      localId: "tools",
      pluginId: "demo-mobile",
      manifestId: "demo-mobile",
      pluginName: "Demo Mobile",
      title: "Tools",
      description: "Plugin-powered phone tools.",
      iconName: "Puzzle",
      iconId: "",
      order: 25,
      category: "Utilities",
      kind: "dashboard",
      renderer: "",
      rendererUrl: "",
      styles: [],
      styleUrls: [],
      theme: {
        accent: "var(--mobile-accent)",
        cssVars: {},
      },
      sections: [
        {
          id: "status",
          title: "Plugin Status",
          body: "Rendered from the plugin catalog.",
          assetPath: "assets/status.txt",
          assetUrl: "/api/plugins/demo-mobile/assets/assets/status.txt",
        },
      ],
      actions: [
        {
          id: "run-context",
          label: "Run Context",
          description: "Runs a backend action with the current mobile path.",
          iconName: "Play",
          tone: "accent",
          kind: "backend",
          href: "",
          copyText: "",
          backend: {
            entry: "hello-mobile.cmd",
            args: ["{currentPath}"],
            successMessage: "Backend finished.",
          },
        },
      ],
    },
  ],
  warnings: [],
};

let activePluginCatalogResponse = pluginCatalogResponse;

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

describe("mobile app shell", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/");
    window.localStorage.clear();
    useMobileStore.setState((state) => ({
      ...state,
      activeTab: "explorer",
      explorerPath: "",
      pinnedPaths: [],
      recentPaths: [],
      transfers: [],
      layoutOverrides: {},
    }));

    vi.spyOn(window, "open").mockImplementation(() => null);
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    activePluginCatalogResponse = pluginCatalogResponse;
    window.__GREEBLEFS_MOBILE_PLUGIN_MODULES__ = {};

    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input), "https://mobile.greeblefs.test");

      if (url.pathname === "/api/theme") {
        return jsonResponse(mobileThemeSnapshot);
      }
      if (url.pathname === "/api/plugins") {
        return jsonResponse(activePluginCatalogResponse);
      }
      if (url.pathname === "/api/plugins/demo-mobile/backend") {
        const body = init?.body ? JSON.parse(String(init.body)) : {};
        return jsonResponse({
          pluginId: "demo-mobile",
          entry: body.entry,
          contextPath: body.contextPath ?? "",
          contextAbsolutePath: "C:/share",
          paneId: body.paneId ?? "",
          actionId: body.actionId ?? "",
          stdout: `context=${body.contextPath ?? ""}`,
          stderr: "",
          status: 0,
        });
      }
      if (url.pathname === "/api/list") {
        return jsonResponse(listingResponse);
      }
      if (url.pathname === "/api/search/status") {
        return jsonResponse(searchStatusResponse);
      }
      if (url.pathname === "/api/search") {
        return jsonResponse(searchResponse);
      }
      if (url.pathname === "/api/index/pictures") {
        return jsonResponse({
          query: url.searchParams.get("query") ?? "",
          shareName: "GreebleFS",
          scopePath: "",
          totalCount: 1,
          offset: Number(url.searchParams.get("offset") ?? 0),
          limit: Number(url.searchParams.get("limit") ?? 96),
          entries: [
            {
              ...listingResponse.entries[1],
              parentRelativePath: "",
              score: 1,
            },
          ],
        });
      }
      if (url.pathname === "/api/preview") {
        return jsonResponse(previewResponse);
      }

      return new Response("Not found", { status: 404 });
    }) as typeof fetch;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("switches between tabs, previews explorer entries, and logs downloads", async () => {
    const user = userEvent.setup();

    render(<App />);

    expect(await screen.findByText("photo.png")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Settings" }));
    expect(screen.getByText("Pair State")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Explorer" }));
    await user.click(screen.getByRole("button", { name: /photo\.png/i }));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Download")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Download" }));
    await user.click(screen.getByRole("button", { name: "Transfers" }));
    expect(
      await screen.findByText("Sent to the browser download manager."),
    ).toBeInTheDocument();
    expect(screen.getAllByText("photo.png").length).toBeGreaterThan(0);
  });

  it("navigates into folders, syncs the URL, and sends the browse policy", async () => {
    const user = userEvent.setup();

    render(<App />);

    await user.click(
      await screen.findByRole("button", { name: /photos folder/i }),
    );

    let listRequest: URL | undefined;
    await waitFor(() => {
      listRequest = (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls
        .map(([input]) => new URL(String(input), "https://mobile.greeblefs.test"))
        .find((url) => url.pathname === "/api/list" && url.searchParams.get("path") === "photos");
      expect(listRequest).toBeDefined();
    });

    expect(listRequest?.searchParams.get("showHiddenFiles")).toBe("false");
    expect(listRequest?.searchParams.get("sortBy")).toBe("name");
    expect(listRequest?.searchParams.get("sortOrder")).toBe("asc");
    expect(listRequest?.searchParams.get("directoriesFirst")).toBe("true");
  });

  it("updates the active mobile layout from the explorer action strip", async () => {
    const user = userEvent.setup();

    render(<App />);

    await screen.findByText("photo.png");
    await user.click(screen.getByRole("button", { name: "Switch to List view" }));

    expect(useMobileStore.getState().layoutOverrides.viewMode).toBe("list");
  });

  it("queries indexed search results from the dedicated search tab", async () => {
    const user = userEvent.setup();

    render(<App />);

    await screen.findByText("photo.png");
    await user.click(screen.getByRole("button", { name: "Search" }));

    const searchInput = screen.getByPlaceholderText("Search the indexed share");
    await user.type(searchInput, "photo");

    await waitFor(() => {
      expect(screen.getByText("Indexed 42 items")).toBeInTheDocument();
    });
    expect(await screen.findByText("photo.png")).toBeInTheDocument();
  });

  it("renders mobile plugin panes and runs host backend actions with path context", async () => {
    const user = userEvent.setup();

    render(<App />);

    await user.click(
      await screen.findByRole("button", { name: /photos folder/i }),
    );
    await user.click(await screen.findByRole("button", { name: "Tools" }));

    expect(await screen.findByText("Plugin Status")).toBeInTheDocument();
    expect(screen.getByText("Rendered from the plugin catalog.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Run Context" }));

    expect(await screen.findByText("Backend finished.")).toBeInTheDocument();
    expect(screen.getByText("context=photos")).toBeInTheDocument();

    const backendRequest = (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls
      .map(([input, init]) => ({
        url: new URL(String(input), "https://mobile.greeblefs.test"),
        init: init as RequestInit | undefined,
      }))
      .find((call) => call.url.pathname === "/api/plugins/demo-mobile/backend");
    expect(backendRequest).toBeDefined();
    expect(JSON.parse(String(backendRequest?.init?.body))).toMatchObject({
      entry: "hello-mobile.cmd",
      args: ["photos"],
      contextPath: "photos",
      paneId: "tools",
      actionId: "run-context",
    });
  });

  it("mounts plugin-provided mobile renderer modules with host index helpers", async () => {
    const user = userEvent.setup();
    const rendererUrl = "/api/plugins/demo-mobile/assets/mobile/gallery.js";
    const runtimeMount = vi.fn(async (
      container: HTMLElement,
      api: MobilePluginRuntimeContext,
    ) => {
      const response = await api.index.media.findPictures({
        limit: 1,
        rootPaths: api.settings.getValue<string[]>("rootPaths", []) ?? [],
        extensions: api.settings.getValue<string[]>("extensions", []) ?? [],
      });
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = `Runtime ${response.entries[0]?.name ?? "empty"}`;
      button.addEventListener("click", () => {
        void api.files.openPreview(response.entries[0]?.relativePath ?? "");
      });
      container.append(button);
      return {
        update: vi.fn(),
        dispose: vi.fn(),
      };
    });
    window.__GREEBLEFS_MOBILE_PLUGIN_MODULES__ = {
      [rendererUrl]: {
        mount: runtimeMount,
      },
    };
    activePluginCatalogResponse = {
      ...pluginCatalogResponse,
      plugins: pluginCatalogResponse.plugins.map((plugin) => ({
        ...plugin,
        settingsValues: {
          rootPaths: ["photos"],
          extensions: ["png", "webp"],
        },
      })),
      panes: pluginCatalogResponse.panes.map((pane) => ({
        ...pane,
        title: "Gallery",
        renderer: "mobile/gallery.js",
        rendererUrl,
        styles: ["mobile/gallery.css"],
        styleUrls: ["/api/plugins/demo-mobile/assets/mobile/gallery.css"],
      })),
    };

    render(<App />);

    await user.click(await screen.findByRole("button", { name: "Gallery" }));
    expect(await screen.findByText("Runtime photo.png")).toBeInTheDocument();
    expect(runtimeMount).toHaveBeenCalled();

    const mediaRequest = (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls
      .map(([input]) => new URL(String(input), "https://mobile.greeblefs.test"))
      .find((url) => url.pathname === "/api/index/pictures");
    expect(mediaRequest?.searchParams.get("limit")).toBe("1");
    expect(mediaRequest?.searchParams.getAll("rootPaths")).toEqual(["photos"]);
    expect(mediaRequest?.searchParams.getAll("extensions")).toEqual(["png", "webp"]);

    await user.click(screen.getByRole("button", { name: "Runtime photo.png" }));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Download")).toBeInTheDocument();
  });

  it("pins mobile paths and surfaces saved path shortcuts", async () => {
    const user = userEvent.setup();

    render(<App />);

    await user.click(
      await screen.findByRole("button", { name: /photos folder/i }),
    );
    await user.click(await screen.findByRole("button", { name: "Pin current path" }));
    await user.click(screen.getByRole("button", { name: "Settings" }));

    expect(await screen.findByText("Saved Paths")).toBeInTheDocument();
    expect(useMobileStore.getState().pinnedPaths).toContain("photos");
    expect(screen.getAllByText("photos").length).toBeGreaterThan(0);
  });
});
