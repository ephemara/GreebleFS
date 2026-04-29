import { describe, expect, it } from "vitest";
import {
  CONSTELLATION_GRAPH_NODE_BUDGETS,
  CONSTELLATION_LENS_RECENT_ENTRY_LIMIT,
} from "../config/constellationGraph";
import {
  buildConstellationGraph,
  buildConstellationLensBands,
} from "../components/explorer/constellationGraph";
import type { ExplorerFileEntry as FileEntry } from "../runtime/explorerBackend";
import { createTestExplorerFileEntry } from "./helpers/explorerEntries";

function makeEntry(index: number, overrides: Partial<FileEntry> = {}): FileEntry {
  return createTestExplorerFileEntry({
    name: `asset-${index}.tsx`,
    path: `C:\\workspace\\bulk\\folder-${index % 32}\\asset-${index}.tsx`,
    is_dir: false,
    size: 1024 + index,
    modified: 1_800_000_000_000 - index,
    extension: "tsx",
    is_hidden: false,
    is_symlink: false,
    ...overrides,
  });
}

describe("constellation graph performance", () => {
  it("keeps graph comparison work bounded while preserving active workset nodes", () => {
    const entries = Array.from({ length: 2_400 }, (_, index) => makeEntry(index));
    const selectedEntry = entries[2_399]!;
    const pinnedEntry = entries[2_100]!;
    const bookmarkedEntry = entries[1_900]!;
    const startedAt = performance.now();

    const graph = buildConstellationGraph({
      entries,
      selectedPaths: new Set([selectedEntry.path]),
      pinnedPaths: new Set([pinnedEntry.path]),
      bookmarkPaths: new Set([bookmarkedEntry.path]),
      pathTagIds: new Map([[bookmarkedEntry.path, ["important"]]]),
    });
    const elapsedMs = performance.now() - startedAt;
    const graphNodePaths = new Set(graph.nodes.map((node) => node.entry.path));

    expect(graph.nodes.length).toBeLessThanOrEqual(
      CONSTELLATION_GRAPH_NODE_BUDGETS.maxComparedNodes,
    );
    expect(graphNodePaths.has(selectedEntry.path)).toBe(true);
    expect(graphNodePaths.has(pinnedEntry.path)).toBe(true);
    expect(graphNodePaths.has(bookmarkedEntry.path)).toBe(true);
    expect(graph.edges.length).toBeGreaterThan(0);
    expect(elapsedMs).toBeLessThan(750);
  });

  it("selects recent workflow entries without sorting the full directory", () => {
    const entries = Array.from({ length: 640 }, (_, index) => makeEntry(index, {
      modified: 1_800_000_000_000 - (index * 2),
    }));

    const bands = buildConstellationLensBands({
      entries,
      selectedPaths: new Set(),
      pinnedPaths: new Set(),
      bookmarkPaths: new Set(),
      pathTagIds: new Map(),
      currentPath: "C:\\workspace\\bulk",
      activeLens: "workflow",
      sortBy: "name",
      sortOrder: "asc",
      nowMs: 1_800_000_000_000,
    });
    const recentBand = bands.find((band) => band.id === "recent-flow");

    expect(recentBand?.entries).toHaveLength(CONSTELLATION_LENS_RECENT_ENTRY_LIMIT);
    expect(recentBand?.entries[0]?.path).toBe(entries[0]?.path);
    expect(recentBand?.entries[CONSTELLATION_LENS_RECENT_ENTRY_LIMIT - 1]?.path).toBe(
      entries[CONSTELLATION_LENS_RECENT_ENTRY_LIMIT - 1]?.path,
    );
  });
});
