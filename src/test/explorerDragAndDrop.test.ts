import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createExplorerDropSurfaceBinding,
  clearExplorerSharedDragSession,
  endExplorerDragInteraction,
  getExplorerDragInteractionState,
  getExplorerSharedDragSession,
  readExplorerPathsFromDataTransfer,
  resolveExplorerDropHitFromPoint,
  settleExplorerSharedDragSessionAfterDragEnd,
  startExplorerSharedDragSession,
  updateExplorerDragInteractionFromResolvedHit,
  validateExplorerDropTarget,
} from "../components/explorer/explorerDragAndDrop";

function setElementRect(
  element: HTMLElement,
  rect: {
    left: number;
    top: number;
    right: number;
    bottom: number;
  },
) {
  vi.spyOn(element, "getBoundingClientRect").mockReturnValue({
    x: rect.left,
    y: rect.top,
    left: rect.left,
    top: rect.top,
    right: rect.right,
    bottom: rect.bottom,
    width: rect.right - rect.left,
    height: rect.bottom - rect.top,
    toJSON: () => ({
      left: rect.left,
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
    }),
  } as DOMRect);
}

describe("explorerDragAndDrop", () => {
  beforeEach(() => {
    clearExplorerSharedDragSession();
    document.body.innerHTML = "";
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    clearExplorerSharedDragSession();
    document.body.innerHTML = "";
  });

  it("falls back to the viewport root when the pointer is over a non-folder card", () => {
    document.body.innerHTML = `
      <div data-overlay-explorer-drop-scope-id="pane-a" data-overlay-explorer-drop-root-path="/workspace">
        <div id="folder-card" data-overlay-drop-target-path="/workspace/alpha">
          <span id="folder-label">alpha</span>
        </div>
        <div id="file-card">
          <span id="file-label">notes.txt</span>
        </div>
      </div>
    `;

    const scope = document.querySelector(
      '[data-overlay-explorer-drop-scope-id="pane-a"]',
    ) as HTMLElement | null;
    const folderCard = document.getElementById("folder-card");
    const fileCard = document.getElementById("file-card");
    const fileLabel = document.getElementById("file-label");
    if (
      !(scope instanceof HTMLElement) ||
      !(folderCard instanceof HTMLElement) ||
      !(fileCard instanceof HTMLElement) ||
      !(fileLabel instanceof HTMLElement)
    ) {
      throw new Error("Expected drag/drop fixture elements");
    }

    setElementRect(scope, { left: 0, top: 0, right: 320, bottom: 240 });
    setElementRect(folderCard, { left: 24, top: 24, right: 120, bottom: 120 });
    setElementRect(fileCard, { left: 144, top: 24, right: 240, bottom: 120 });

    Object.defineProperty(document, "elementFromPoint", {
      configurable: true,
      value: vi.fn(() => fileLabel),
    });

    const hit = resolveExplorerDropHitFromPoint({ x: 192, y: 72 });
    expect(hit?.scopeId).toBe("pane-a");
    expect(hit?.targetKind).toBe("scope-root");
    expect(hit?.targetPath).toBe("/workspace");
  });

  it("resolves the folder target when the pointer is directly inside the folder card", () => {
    document.body.innerHTML = `
      <div data-overlay-explorer-drop-scope-id="pane-a" data-overlay-explorer-drop-root-path="/workspace">
        <div id="folder-card" data-overlay-drop-target-path="/workspace/alpha">
          <span id="folder-label">alpha</span>
        </div>
      </div>
    `;

    const scope = document.querySelector(
      '[data-overlay-explorer-drop-scope-id="pane-a"]',
    ) as HTMLElement | null;
    const folderCard = document.getElementById("folder-card");
    const folderLabel = document.getElementById("folder-label");
    if (
      !(scope instanceof HTMLElement) ||
      !(folderCard instanceof HTMLElement) ||
      !(folderLabel instanceof HTMLElement)
    ) {
      throw new Error("Expected drag/drop fixture elements");
    }

    setElementRect(scope, { left: 0, top: 0, right: 320, bottom: 240 });
    setElementRect(folderCard, { left: 24, top: 24, right: 120, bottom: 120 });

    Object.defineProperty(document, "elementFromPoint", {
      configurable: true,
      value: vi.fn(() => folderLabel),
    });

    const hit = resolveExplorerDropHitFromPoint({ x: 72, y: 72 });
    expect(hit?.scopeId).toBe("pane-a");
    expect(hit?.targetKind).toBe("directory");
    expect(hit?.targetPath).toBe("/workspace/alpha");
  });

  it("reuses drop surface bindings for the same surface id across rerenders", () => {
    const firstBinding = createExplorerDropSurfaceBinding({
      surfaceId: "folder-surface",
      scopeId: "pane-a",
      role: "directory-target",
      targetPath: "/workspace/alpha",
      label: "alpha",
    });
    const secondBinding = createExplorerDropSurfaceBinding({
      surfaceId: "folder-surface",
      scopeId: "pane-a",
      role: "directory-target",
      targetPath: "/workspace/alpha",
      label: "alpha (updated)",
    });

    expect(secondBinding).toBe(firstBinding);
    expect(secondBinding.ref).toBe(firstBinding.ref);
    expect(secondBinding["data-overlay-drop-target-path"]).toBe(
      "/workspace/alpha",
    );
  });

  it("reuses the last resolved drop target while the pointer stays inside the same surface", () => {
    const scopeBinding = createExplorerDropSurfaceBinding({
      surfaceId: "scope-root",
      scopeId: "pane-a",
      role: "scope-root",
      rootPath: "/workspace",
    });
    const folderBinding = createExplorerDropSurfaceBinding({
      surfaceId: "folder-surface",
      scopeId: "pane-a",
      role: "directory-target",
      targetPath: "/workspace/alpha",
      label: "alpha",
    });

    const scopeElement = document.createElement("div");
    const folderElement = document.createElement("div");
    const folderLabel = document.createElement("span");
    folderElement.append(folderLabel);
    scopeElement.append(folderElement);
    document.body.append(scopeElement);

    scopeElement.setAttribute(
      "data-overlay-explorer-drop-scope-id",
      scopeBinding["data-overlay-explorer-drop-scope-id"],
    );
    scopeElement.setAttribute(
      "data-overlay-explorer-drop-surface-role",
      scopeBinding["data-overlay-explorer-drop-surface-role"],
    );
    scopeElement.setAttribute(
      "data-overlay-explorer-drop-surface-id",
      scopeBinding["data-overlay-explorer-drop-surface-id"],
    );
    scopeElement.setAttribute(
      "data-overlay-explorer-drop-root-path",
      scopeBinding["data-overlay-explorer-drop-root-path"] ?? "",
    );
    folderElement.setAttribute(
      "data-overlay-explorer-drop-scope-id",
      folderBinding["data-overlay-explorer-drop-scope-id"],
    );
    folderElement.setAttribute(
      "data-overlay-explorer-drop-surface-role",
      folderBinding["data-overlay-explorer-drop-surface-role"],
    );
    folderElement.setAttribute(
      "data-overlay-explorer-drop-surface-id",
      folderBinding["data-overlay-explorer-drop-surface-id"],
    );
    folderElement.setAttribute(
      "data-overlay-drop-target-path",
      folderBinding["data-overlay-drop-target-path"] ?? "",
    );

    scopeBinding.ref(scopeElement);
    folderBinding.ref(folderElement);

    setElementRect(scopeElement, { left: 0, top: 0, right: 320, bottom: 240 });
    setElementRect(folderElement, { left: 24, top: 24, right: 120, bottom: 120 });

    const elementFromPoint = vi.fn(() => folderLabel);
    Object.defineProperty(document, "elementFromPoint", {
      configurable: true,
      value: elementFromPoint,
    });

    const firstHit = resolveExplorerDropHitFromPoint({ x: 72, y: 72 });
    const secondHit = resolveExplorerDropHitFromPoint({ x: 80, y: 80 });

    expect(firstHit?.targetPath).toBe("/workspace/alpha");
    expect(secondHit?.targetPath).toBe("/workspace/alpha");
    expect(elementFromPoint).toHaveBeenCalledTimes(1);

    folderBinding.ref(null);
    scopeBinding.ref(null);
  });

  it("routes drop hit-testing to the correct explorer scope in a multi-pane window", () => {
    document.body.innerHTML = `
      <div data-overlay-explorer-drop-scope-id="pane-a" data-overlay-explorer-drop-root-path="/left">
        <div id="left-folder" data-overlay-drop-target-path="/left/alpha"></div>
      </div>
      <div data-overlay-explorer-drop-scope-id="pane-b" data-overlay-explorer-drop-root-path="/right">
        <div id="right-folder" data-overlay-drop-target-path="/right/beta">
          <span id="right-folder-label">beta</span>
        </div>
      </div>
    `;

    const leftScope = document.querySelector(
      '[data-overlay-explorer-drop-scope-id="pane-a"]',
    ) as HTMLElement | null;
    const rightScope = document.querySelector(
      '[data-overlay-explorer-drop-scope-id="pane-b"]',
    ) as HTMLElement | null;
    const rightFolder = document.getElementById("right-folder");
    const rightFolderLabel = document.getElementById("right-folder-label");
    if (
      !(leftScope instanceof HTMLElement) ||
      !(rightScope instanceof HTMLElement) ||
      !(rightFolder instanceof HTMLElement) ||
      !(rightFolderLabel instanceof HTMLElement)
    ) {
      throw new Error("Expected multi-pane drag/drop fixture elements");
    }

    setElementRect(leftScope, { left: 0, top: 0, right: 320, bottom: 240 });
    setElementRect(rightScope, { left: 340, top: 0, right: 660, bottom: 240 });
    setElementRect(rightFolder, {
      left: 380,
      top: 32,
      right: 500,
      bottom: 128,
    });

    Object.defineProperty(document, "elementFromPoint", {
      configurable: true,
      value: vi.fn(() => rightFolderLabel),
    });

    const hit = resolveExplorerDropHitFromPoint({ x: 420, y: 80 });
    expect(hit?.scopeId).toBe("pane-b");
    expect(hit?.targetPath).toBe("/right/beta");
  });

  it("keeps native-out drag sessions alive briefly for same-window drops", () => {
    vi.useFakeTimers();

    startExplorerSharedDragSession({
      paths: ["/workspace/notes.txt"],
      intent: "native-out",
      sourceScopeId: "pane-a",
    });
    settleExplorerSharedDragSessionAfterDragEnd("native-out");

    expect(getExplorerSharedDragSession()?.paths).toEqual([
      "/workspace/notes.txt",
    ]);

    vi.advanceTimersByTime(1501);
    expect(getExplorerSharedDragSession()).toBeNull();
  });

  it("reads explorer payload paths from data transfer before falling back to the shared session", () => {
    startExplorerSharedDragSession({
      paths: ["/workspace/from-session.txt"],
      intent: "native-out",
      sourceScopeId: "pane-a",
    });

    const payloadDataTransfer = {
      getData: vi.fn((kind: string) =>
        kind === "application/x-overlayterm-paths"
          ? JSON.stringify(["/workspace/from-payload.txt"])
          : "",
      ),
    } as unknown as DataTransfer;
    expect(
      readExplorerPathsFromDataTransfer({
        dataTransfer: payloadDataTransfer,
        fallbackPaths: getExplorerSharedDragSession()?.paths ?? [],
      }),
    ).toEqual(["/workspace/from-payload.txt"]);

    const fallbackDataTransfer = {
      getData: vi.fn(() => ""),
    } as unknown as DataTransfer;
    expect(
      readExplorerPathsFromDataTransfer({
        dataTransfer: fallbackDataTransfer,
        fallbackPaths: getExplorerSharedDragSession()?.paths ?? [],
      }),
    ).toEqual(["/workspace/from-session.txt"]);
  });

  it("reads external file paths from text/uri-list before falling back to plain text", () => {
    const uriListTransfer = {
      files: [],
      getData: vi.fn((kind: string) => {
        if (kind === "text/uri-list") {
          return "file:///workspace/alpha%20beta.txt\r\n# comment\r\nfile:///workspace/gamma.txt";
        }
        if (kind === "text/plain") {
          return "/workspace/plain-text.txt";
        }
        return "";
      }),
    } as unknown as DataTransfer;

    expect(
      readExplorerPathsFromDataTransfer({
        dataTransfer: uriListTransfer,
      }),
    ).toEqual([
      "/workspace/alpha beta.txt",
      "/workspace/gamma.txt",
    ]);
  });

  it("rejects descendant drops before the transfer path runs", () => {
    expect(
      validateExplorerDropTarget({
        sourcePaths: ["/workspace/alpha"],
        targetPath: "/workspace/alpha/nested",
        platform: "linux",
      }),
    ).toEqual({
      valid: false,
      reason: "descendant",
    });
  });

  it("auto-opens hovered folder targets once after dwell", () => {
    vi.useFakeTimers();
    const onAutoOpen = vi.fn();
    const folderElement = document.createElement("div");
    const binding = createExplorerDropSurfaceBinding({
      surfaceId: "folder-auto-open",
      scopeId: "pane-a",
      role: "directory-target",
      targetPath: "/workspace/alpha",
      onAutoOpen,
      autoOpenDelayMs: 120,
      label: "alpha",
    });

    binding.ref(folderElement);

    updateExplorerDragInteractionFromResolvedHit({
      resolvedHit: {
        scopeId: "pane-a",
        surfaceId: "folder-auto-open",
        surfaceRole: "directory-target",
        targetKind: "directory",
        targetPath: "/workspace/alpha",
        scopeElement: null,
        targetElement: folderElement,
        point: { x: 24, y: 24 },
      },
      sourceKind: "internal",
      sourcePaths: ["/workspace/notes.txt"],
      operation: "move",
      platform: "linux",
      primaryLabel: "notes.txt",
    });

    vi.advanceTimersByTime(121);

    expect(onAutoOpen).toHaveBeenCalledTimes(1);
    expect(getExplorerDragInteractionState().dwellSurfaceId).toBeNull();

    binding.ref(null);
    endExplorerDragInteraction();
  });

  it("restores hover-open behavior when a drop surface ref detaches and reattaches", () => {
    vi.useFakeTimers();
    const onAutoOpen = vi.fn();
    const folderElement = document.createElement("div");
    const binding = createExplorerDropSurfaceBinding({
      surfaceId: "folder-auto-open-reattach",
      scopeId: "pane-a",
      role: "directory-target",
      targetPath: "/workspace/alpha",
      onAutoOpen,
      autoOpenDelayMs: 120,
      label: "alpha",
    });

    binding.ref(folderElement);
    binding.ref(null);
    binding.ref(folderElement);

    updateExplorerDragInteractionFromResolvedHit({
      resolvedHit: {
        scopeId: "pane-a",
        surfaceId: "folder-auto-open-reattach",
        surfaceRole: "directory-target",
        targetKind: "directory",
        targetPath: "/workspace/alpha",
        scopeElement: null,
        targetElement: folderElement,
        point: { x: 24, y: 24 },
      },
      sourceKind: "internal",
      sourcePaths: ["/workspace/notes.txt"],
      operation: "move",
      platform: "linux",
      primaryLabel: "notes.txt",
    });

    vi.advanceTimersByTime(121);

    expect(onAutoOpen).toHaveBeenCalledTimes(1);

    binding.ref(null);
    endExplorerDragInteraction();
  });
});
