import { describe, expect, it } from "vitest";

import type { OverlayPluginPreviewLaneContribution } from "../config/pluginContributions";
import {
  resolveExplorerPreviewDescriptor,
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
    const pluginLane: OverlayPluginPreviewLaneContribution = {
      id: "notes-lane",
      pluginId: "com.test.notes",
      pluginName: "Notes Plugin",
      title: "Notes Preview",
      priority: 900,
      rendererEntry: "preview/notes.js",
      runtimeId: null,
      match: {
        appliesTo: "file",
        extensions: ["txt"],
        fileNames: [],
      },
      capabilities: {
        editable: true,
        save: true,
        export: false,
        workflowTabs: true,
        contextMenu: true,
        prefetch: false,
        closeGuard: true,
      },
      component: (() => null) as OverlayPluginPreviewLaneContribution["component"],
    };

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
});
