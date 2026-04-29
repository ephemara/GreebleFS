import { describe, expect, it } from "vitest";

import type { OverlayPluginPreviewLaneContribution } from "../config/pluginContributions";
import { normalizeExplorerPreviewWorkbenchChromeMetadata } from "../config/previewWorkbenchChrome";
import {
  resolveExplorerPreviewDescriptor,
  resolveExplorerPreviewWorkbenchSelection,
  type ExplorerPreviewResolverOptions,
} from "../components/explorer/explorerPreviewRegistry";
import type { ExplorerFileEntry } from "../runtime/explorerBackend";

const PREVIEW_OPTIONS: ExplorerPreviewResolverOptions = {
  assetUrlResolver: (path) => `asset://${path}`,
  documentPreviewKindResolver: () => "none",
};

function createEntry(
  partial: Partial<ExplorerFileEntry> & Pick<ExplorerFileEntry, "name" | "path">,
): ExplorerFileEntry {
  return {
    name: partial.name,
    path: partial.path,
    is_dir: partial.is_dir ?? false,
    size: partial.size ?? 1024,
    modified: partial.modified ?? 0,
    extension: partial.extension ?? "",
    is_hidden: partial.is_hidden ?? false,
    is_symlink: partial.is_symlink ?? false,
    entityId: partial.entityId ?? `entity:${partial.path}`,
    identityKind: partial.identityKind ?? "native",
    contentRevision: partial.contentRevision ?? "rev-1",
  };
}

function createPluginLane(
  partial: Partial<OverlayPluginPreviewLaneContribution> &
    Pick<OverlayPluginPreviewLaneContribution, "id" | "priority">,
): OverlayPluginPreviewLaneContribution {
  return {
    id: partial.id,
    pluginId: partial.pluginId ?? partial.id,
    pluginName: partial.pluginName ?? partial.id,
    title: partial.title ?? partial.id,
    priority: partial.priority,
    rendererEntry: partial.rendererEntry ?? "preview/workbench.tsx",
    runtimeId: partial.runtimeId ?? null,
    match: partial.match ?? {
      appliesTo: "file",
      extensions: ["txt"],
      fileNames: [],
      previewKinds: [],
    },
    capabilities: partial.capabilities ?? {
      editable: true,
      save: true,
      export: false,
      workflowTabs: true,
      contextMenu: true,
      prefetch: false,
      closeGuard: true,
    },
    workbenchChrome:
      partial.workbenchChrome ??
      normalizeExplorerPreviewWorkbenchChromeMetadata(undefined, {
        includeEditTab: partial.capabilities?.editable ?? true,
      }),
    component:
      partial.component ??
      ((() => null) as OverlayPluginPreviewLaneContribution["component"]),
  };
}

describe("explorerPreviewRegistry", () => {
  it("routes built-in image files through the registry", () => {
    const descriptor = resolveExplorerPreviewDescriptor(
      createEntry({
        name: "hero.png",
        path: "/tmp/hero.png",
        extension: "png",
      }),
      PREVIEW_OPTIONS,
    );

    expect(descriptor).toEqual({
      kind: "image",
      extension: "png",
    });
  });

  it("routes built-in text files through the registry", () => {
    const descriptor = resolveExplorerPreviewDescriptor(
      createEntry({
        name: "notes.md",
        path: "/tmp/notes.md",
        extension: "md",
        size: 4096,
      }),
      {
        ...PREVIEW_OPTIONS,
        documentPreviewKindResolver: () => "markdown",
      },
    );

    expect(descriptor).toEqual({
      kind: "text",
      extension: "md",
      language: "markdown",
      renderKind: "markdown",
    });
  });

  it("lets plugin lanes override built-ins by priority", () => {
    const pluginLane = createPluginLane({
      id: "notes-lane",
      pluginId: "com.test.notes",
      pluginName: "Notes Plugin",
      title: "Notes Preview",
      priority: 900,
      rendererEntry: "preview/notes.js",
      match: {
        appliesTo: "file",
        extensions: ["txt"],
        fileNames: [],
        previewKinds: [],
      },
    });

    const descriptor = resolveExplorerPreviewDescriptor(
      createEntry({
        name: "journal.txt",
        path: "/tmp/journal.txt",
        extension: "txt",
      }),
      {
        ...PREVIEW_OPTIONS,
        pluginPreviewLanes: [pluginLane],
      },
    );

    expect(descriptor.kind).toBe("plugin");
    if (descriptor.kind !== "plugin") {
      throw new Error("Expected plugin preview lane.");
    }
    expect(descriptor.extension).toBe("txt");
    expect(descriptor.assetUrl).toBe("asset:///tmp/journal.txt");
    expect(descriptor.lane.id).toBe("notes-lane");
  });

  it("does not register a built-in sqlite workbench once SQLite is extension-owned", () => {
    const selection = resolveExplorerPreviewWorkbenchSelection(
      createEntry({
        name: "cache.sqlite",
        path: "/tmp/cache.sqlite",
        extension: "sqlite",
      }),
      PREVIEW_OPTIONS,
    );

    expect(selection.activeWorkbench?.id).toBe("builtin-text");
    expect(selection.candidates.map((candidate) => candidate.id)).toEqual([
      "builtin-text",
    ]);
    expect(selection.resolutionSource).toBe("priority");
    expect(
      resolveExplorerPreviewDescriptor(
        createEntry({
          name: "cache.sqlite",
          path: "/tmp/cache.sqlite",
          extension: "sqlite",
        }),
        PREVIEW_OPTIONS,
      ),
    ).toEqual({
      kind: "text",
      extension: "sqlite",
      language: "plaintext",
      renderKind: "none",
    });
  });

  it("routes sqlite files through contributed plugin workbenches", () => {
    const sqlitePluginLane = createPluginLane({
      id: "greeblefs-workbench-sqlite.preview.sqlite",
      pluginId: "greeblefs-workbench-sqlite",
      pluginName: "GreebleFS SQLite Workbench",
      title: "SQLite Workbench",
      priority: 720,
      rendererEntry: "preview/sqliteWorkbench.tsx",
      match: {
        appliesTo: "file",
        extensions: ["sqlite", "sqlite3", "db"],
        fileNames: [],
        previewKinds: [],
      },
      capabilities: {
        editable: false,
        save: false,
        export: false,
        workflowTabs: false,
        contextMenu: false,
        prefetch: false,
        closeGuard: false,
      },
    });

    const selection = resolveExplorerPreviewWorkbenchSelection(
      createEntry({
        name: "cache.sqlite",
        path: "/tmp/cache.sqlite",
        extension: "sqlite",
      }),
      {
        ...PREVIEW_OPTIONS,
        pluginPreviewLanes: [sqlitePluginLane],
      },
    );

    expect(selection.activeWorkbench?.id).toBe(sqlitePluginLane.id);
    expect(selection.candidates.map((candidate) => candidate.id)).toEqual([
      sqlitePluginLane.id,
      "builtin-text",
    ]);
    expect(selection.resolutionSource).toBe("priority");

    const descriptor = resolveExplorerPreviewDescriptor(
      createEntry({
        name: "cache.sqlite",
        path: "/tmp/cache.sqlite",
        extension: "sqlite",
      }),
      {
        ...PREVIEW_OPTIONS,
        pluginPreviewLanes: [sqlitePluginLane],
      },
    );

    expect(descriptor.kind).toBe("plugin");
    if (descriptor.kind !== "plugin") {
      throw new Error("Expected SQLite to resolve through the plugin workbench.");
    }
    expect(descriptor.extension).toBe("sqlite");
    expect(descriptor.assetUrl).toBe("asset:///tmp/cache.sqlite");
    expect(descriptor.lane.id).toBe(sqlitePluginLane.id);
  });

  it("lets plugin lanes match built-in preview kinds without duplicating extension lists", () => {
    const folderLane = createPluginLane({
      id: "greeblefs-workbench-folder.preview.folder",
      pluginId: "greeblefs-workbench-folder",
      pluginName: "GreebleFS Folder Workbench",
      title: "Folder Workbench",
      priority: 720,
      match: {
        appliesTo: "directory",
        extensions: [],
        fileNames: [],
        previewKinds: ["folder"],
      },
    });
    const textLane = createPluginLane({
      id: "greeblefs-workbench-text.preview.text",
      pluginId: "greeblefs-workbench-text",
      pluginName: "GreebleFS Text Workbench",
      title: "Text Workbench",
      priority: 640,
      match: {
        appliesTo: "file",
        extensions: [],
        fileNames: [],
        previewKinds: ["text"],
      },
    });

    const folderDescriptor = resolveExplorerPreviewDescriptor(
      createEntry({
        name: "fixtures",
        path: "/tmp/fixtures",
        is_dir: true,
      }),
      {
        ...PREVIEW_OPTIONS,
        pluginPreviewLanes: [folderLane],
      },
    );
    expect(folderDescriptor.kind).toBe("plugin");
    if (folderDescriptor.kind !== "plugin") {
      throw new Error("Expected folder to resolve through a plugin workbench.");
    }
    expect(folderDescriptor.assetUrl).toBe("");
    expect(folderDescriptor.delegateDescriptor).toEqual({ kind: "folder" });

    const textDescriptor = resolveExplorerPreviewDescriptor(
      createEntry({
        name: "notes.md",
        path: "/tmp/notes.md",
        extension: "md",
        size: 1024,
      }),
      {
        ...PREVIEW_OPTIONS,
        documentPreviewKindResolver: () => "markdown",
        pluginPreviewLanes: [textLane],
      },
    );
    expect(textDescriptor.kind).toBe("plugin");
    if (textDescriptor.kind !== "plugin") {
      throw new Error("Expected text to resolve through a plugin workbench.");
    }
    expect(textDescriptor.delegateDescriptor).toEqual({
      kind: "text",
      extension: "md",
      language: "markdown",
      renderKind: "markdown",
    });
  });

  it("lets a saved user default win over a higher priority candidate", () => {
    const lowerPriorityDefault = createPluginLane({
      id: "lower-priority-default",
      priority: 600,
    });
    const higherPriorityCandidate = createPluginLane({
      id: "higher-priority-candidate",
      priority: 900,
    });

    const selection = resolveExplorerPreviewWorkbenchSelection(
      createEntry({
        name: "journal.txt",
        path: "/tmp/journal.txt",
        extension: "txt",
      }),
      {
        ...PREVIEW_OPTIONS,
        preferredWorkbenchId: lowerPriorityDefault.id,
        pluginPreviewLanes: [higherPriorityCandidate, lowerPriorityDefault],
      },
    );

    expect(selection.activeWorkbench?.id).toBe(lowerPriorityDefault.id);
    expect(selection.resolutionSource).toBe("user-default");
    expect(selection.candidates.map((candidate) => candidate.id)).toEqual([
      higherPriorityCandidate.id,
      lowerPriorityDefault.id,
      "builtin-text",
    ]);
  });

  it("uses priority when no saved default matches", () => {
    const lowPriorityCandidate = createPluginLane({
      id: "low-priority-candidate",
      priority: 500,
    });
    const highPriorityCandidate = createPluginLane({
      id: "high-priority-candidate",
      priority: 900,
    });

    const selection = resolveExplorerPreviewWorkbenchSelection(
      createEntry({
        name: "journal.txt",
        path: "/tmp/journal.txt",
        extension: "txt",
      }),
      {
        ...PREVIEW_OPTIONS,
        preferredWorkbenchId: "missing-workbench",
        pluginPreviewLanes: [lowPriorityCandidate, highPriorityCandidate],
      },
    );

    expect(selection.activeWorkbench?.id).toBe(highPriorityCandidate.id);
    expect(selection.resolutionSource).toBe("priority");
  });

  it("uses deterministic discovery order for same-priority candidates", () => {
    const firstCandidate = createPluginLane({
      id: "first-candidate",
      priority: 700,
    });
    const secondCandidate = createPluginLane({
      id: "second-candidate",
      priority: 700,
    });

    const selection = resolveExplorerPreviewWorkbenchSelection(
      createEntry({
        name: "journal.txt",
        path: "/tmp/journal.txt",
        extension: "txt",
      }),
      {
        ...PREVIEW_OPTIONS,
        pluginPreviewLanes: [firstCandidate, secondCandidate],
      },
    );

    expect(selection.activeWorkbench?.id).toBe(firstCandidate.id);
    expect(selection.resolutionSource).toBe("discovery-order");
    expect(selection.candidates.slice(0, 2).map((candidate) => candidate.id)).toEqual([
      firstCandidate.id,
      secondCandidate.id,
    ]);
  });

  it("returns no active workbench for unmatched files so the shell can fall back", () => {
    const selection = resolveExplorerPreviewWorkbenchSelection(
      createEntry({
        name: "asset.unknown-extension",
        path: "/tmp/asset.unknown-extension",
        extension: "unknown-extension",
        size: 3 * 1024 * 1024,
      }),
      PREVIEW_OPTIONS,
    );

    expect(selection.activeWorkbench).toBeNull();
    expect(selection.candidates).toEqual([]);
    expect(selection.resolutionSource).toBeNull();
    expect(resolveExplorerPreviewDescriptor(
      createEntry({
        name: "asset.unknown-extension",
        path: "/tmp/asset.unknown-extension",
        extension: "unknown-extension",
        size: 3 * 1024 * 1024,
      }),
      PREVIEW_OPTIONS,
    )).toEqual({
      kind: "unsupported",
      extension: "unknown-extension",
    });
  });
});
