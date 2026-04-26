import { describe, expect, it } from "vitest";
import {
  buildConstellationFieldLayout,
  type ConstellationOrbitBandInput,
} from "../components/explorer/constellationLayout";
import type { ExplorerFileEntry as FileEntry } from "../runtime/explorerBackend";
import { createTestExplorerFileEntry } from "./helpers/explorerEntries";

function makeEntry(index: number, overrides: Partial<FileEntry> = {}): FileEntry {
  return createTestExplorerFileEntry({
    name: `entry-${index}`,
    path: `C:\\workspace\\entry-${index}`,
    is_dir: false,
    size: 1024 + index,
    modified: 1_700_000_000_000 + index,
    extension: "txt",
    is_hidden: false,
    is_symlink: false,
    ...overrides,
  });
}

describe("buildConstellationFieldLayout", () => {
  it("spreads semantic bands into distinct command clusters instead of one collapsed lane", () => {
    const bands: ConstellationOrbitBandInput[] = [
      {
        id: "folders",
        label: "Folders",
        description: "Anchors and destinations stay visually dominant.",
        dominant: true,
        entries: Array.from({ length: 12 }, (_, index) =>
          makeEntry(index, {
            name: `folder-${index}`,
            path: `C:\\workspace\\folders\\folder-${index}`,
            is_dir: true,
            extension: "",
          }),
        ),
      },
      {
        id: "recent",
        label: "Recent Activity",
        description: "Fresh work stays elevated without replacing the folder map.",
        dominant: false,
        entries: Array.from({ length: 10 }, (_, index) =>
          makeEntry(index + 20, {
            name: `recent-${index}.md`,
            path: `C:\\workspace\\recent\\recent-${index}.md`,
          }),
        ),
      },
    ];

    const layout = buildConstellationFieldLayout(bands, new Set(), 0.9);
    const [foldersBand, recentBand] = layout.bands;
    const foldersXRange = Math.max(...foldersBand.nodes.map((node) => node.x))
      - Math.min(...foldersBand.nodes.map((node) => node.x));
    const recentXRange = Math.max(...recentBand.nodes.map((node) => node.x))
      - Math.min(...recentBand.nodes.map((node) => node.x));
    const folderAnchorCount = foldersBand.nodes.filter(
      (node) => node.emphasis === "anchor",
    ).length;

    expect(layout.width).toBeGreaterThan(1500);
    expect(layout.bands).toHaveLength(2);
    expect(Math.abs(foldersBand.centerX - recentBand.centerX)).toBeGreaterThan(420);
    expect(foldersXRange).toBeGreaterThan(200);
    expect(recentXRange).toBeGreaterThan(220);
    expect(folderAnchorCount).toBeLessThan(foldersBand.nodes.length);
    expect(layout.connections.length).toBeGreaterThan(12);
  });

  it("caps visible nodes by density and reports the hidden remainder", () => {
    const manyEntries = Array.from({ length: 40 }, (_, index) => makeEntry(index));
    const layout = buildConstellationFieldLayout([
      {
        id: "everything-else",
        label: "Everything Else",
        description: "Remaining files preserve the active explorer sort.",
        dominant: false,
        entries: manyEntries,
      },
    ], new Set(), 0);

    expect(layout.bands).toHaveLength(1);
    expect(layout.bands[0]?.nodes).toHaveLength(8);
    expect(layout.bands[0]?.hiddenEntryCount).toBe(32);
  });

  it("keeps lone folder maps zoomed out by limiting labeled hubs and widening the spread", () => {
    const layout = buildConstellationFieldLayout([
      {
        id: "folders",
        label: "Folders",
        description: "Anchors and destinations stay visually dominant.",
        dominant: true,
        entries: Array.from({ length: 19 }, (_, index) =>
          makeEntry(index, {
            name: `folder-${index}`,
            path: `C:\\workspace\\folders\\folder-${index}`,
            is_dir: true,
            extension: "",
          }),
        ),
      },
    ], new Set(), 0.65);

    const [foldersBand] = layout.bands;
    const anchorNodes = foldersBand?.nodes.filter((node) => node.emphasis === "anchor") ?? [];
    const labeledSatellites = foldersBand?.nodes.filter(
      (node) => node.emphasis === "satellite" && node.labelVisible,
    ) ?? [];
    const xRange = Math.max(...(foldersBand?.nodes.map((node) => node.x) ?? [0]))
      - Math.min(...(foldersBand?.nodes.map((node) => node.x) ?? [0]));

    expect(anchorNodes).toHaveLength(2);
    expect(labeledSatellites).toHaveLength(0);
    expect(xRange).toBeGreaterThan(620);
  });

  it("keeps selected entries at the center of their cluster and highlights supporting links", () => {
    const selectedEntry = makeEntry(7, {
      name: "picked.txt",
      path: "C:\\workspace\\picked.txt",
    });
    const layout = buildConstellationFieldLayout([
      {
        id: "context",
        label: "Local Context",
        description: "Selection-adjacent files stay close while you change density.",
        dominant: false,
        entries: [
          makeEntry(1),
          selectedEntry,
          makeEntry(2, {
            name: "folder",
            path: "C:\\workspace\\folder",
            is_dir: true,
            extension: "",
          }),
          makeEntry(3),
          makeEntry(4),
        ],
      },
    ], new Set([selectedEntry.path]), 0.6);

    const [contextBand] = layout.bands;
    const selectedNode = contextBand?.nodes.find((node) => node.entry.path === selectedEntry.path);

    expect(selectedNode?.emphasis).toBe("selected");
    expect(selectedNode?.x).toBe(contextBand?.centerX);
    expect(selectedNode?.y).toBe(contextBand?.centerY);
    expect(
      layout.connections.some((connection) =>
        connection.highlighted && connection.id.includes(selectedEntry.path),
      ),
    ).toBe(true);
  });
});
