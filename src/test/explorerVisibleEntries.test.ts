import { describe, expect, it } from "vitest";

import {
  computeExplorerBaseVisibleEntries,
  sortExplorerEntries,
} from "../runtime/explorerVisibleEntries";
import { createTestExplorerFileEntry } from "./helpers/explorerEntries";

describe("explorerVisibleEntries", () => {
  const folderEntry = createTestExplorerFileEntry({
    name: "src",
    path: "/workspace/src",
    is_dir: true,
    modified: 50,
  });
  const rustEntry = createTestExplorerFileEntry({
    name: "main.rs",
    path: "/workspace/main.rs",
    extension: "rs",
    size: 12,
    modified: 30,
  });
  const markdownEntry = createTestExplorerFileEntry({
    name: "README.md",
    path: "/workspace/README.md",
    extension: "md",
    size: 8,
    modified: 60,
  });
  const textEntry = createTestExplorerFileEntry({
    name: "notes.txt",
    path: "/workspace/notes.txt",
    extension: "txt",
    size: 21,
    modified: 10,
  });

  it("keeps directories first when sorting by name", () => {
    const result = sortExplorerEntries(
      [textEntry, folderEntry, markdownEntry, rustEntry],
      "name",
      "asc",
    );

    expect(result.map((entry) => entry.path)).toEqual([
      folderEntry.path,
      rustEntry.path,
      textEntry.path,
      markdownEntry.path,
    ]);
  });

  it("sorts by size and date with the existing dir-first behavior", () => {
    expect(
      sortExplorerEntries(
        [markdownEntry, textEntry, folderEntry, rustEntry],
        "size",
        "desc",
      ).map((entry) => entry.path),
    ).toEqual([
      folderEntry.path,
      textEntry.path,
      rustEntry.path,
      markdownEntry.path,
    ]);

    expect(
      sortExplorerEntries(
        [markdownEntry, textEntry, folderEntry, rustEntry],
        "date",
        "asc",
      ).map((entry) => entry.path),
    ).toEqual([
      folderEntry.path,
      textEntry.path,
      rustEntry.path,
      markdownEntry.path,
    ]);
  });

  it("sorts by type label and falls back stably by name", () => {
    const result = sortExplorerEntries(
      [textEntry, markdownEntry, folderEntry, rustEntry],
      "type",
      "asc",
    );

    expect(result.map((entry) => entry.path)).toEqual([
      folderEntry.path,
      markdownEntry.path,
      rustEntry.path,
      textEntry.path,
    ]);
  });

  it("filters by active tag ids before sorting", () => {
    const result = computeExplorerBaseVisibleEntries({
      entries: [folderEntry, rustEntry, markdownEntry, textEntry],
      activeTagFilterIds: ["favorite", "recent"],
      pathTagAssignments: [
        { path: folderEntry.path, tagIds: ["favorite"] },
        { path: rustEntry.path, tagIds: ["favorite", "recent"] },
        { path: markdownEntry.path, tagIds: ["recent"] },
      ],
      sortBy: "name",
      sortOrder: "asc",
    });

    expect(result.map((entry) => entry.path)).toEqual([rustEntry.path]);
  });

  it("returns an empty array for empty inputs", () => {
    expect(
      computeExplorerBaseVisibleEntries({
        entries: [],
        activeTagFilterIds: [],
        pathTagAssignments: [],
        sortBy: "name",
        sortOrder: "asc",
      }),
    ).toEqual([]);
  });
});
