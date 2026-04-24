import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import App from "../../src-mobile/App";
import { useMobileStore } from "../../src-mobile/mobileStore";
import type {
  MobilePreviewResponse,
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
    useMobileStore.setState((state) => ({
      ...state,
      activeTab: "explorer",
      explorerPath: "",
      transfers: [],
      layoutOverrides: {},
    }));

    vi.spyOn(window, "open").mockImplementation(() => null);
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input), "https://mobile.greeblefs.test");

      if (url.pathname === "/api/theme") {
        return jsonResponse(mobileThemeSnapshot);
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
});
