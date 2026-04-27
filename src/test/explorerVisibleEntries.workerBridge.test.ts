import { beforeEach, describe, expect, it } from "vitest";

import { computeExplorerBaseVisibleEntriesInBackground } from "../runtime/explorerVisibleEntriesRuntime";
import {
  readFrontendWorkerTelemetrySnapshot,
  resetFrontendWorkerTelemetryForTests,
} from "../runtime/workerHost";
import { createTestExplorerFileEntry } from "./helpers/explorerEntries";

describe("explorerVisibleEntries worker bridge", () => {
  beforeEach(() => {
    resetFrontendWorkerTelemetryForTests();
  });

  it("shapes base visible entries through the worker bridge fallback path", async () => {
    const result = await computeExplorerBaseVisibleEntriesInBackground({
      entries: [
        createTestExplorerFileEntry({
          name: "notes.txt",
          path: "/workspace/notes.txt",
          extension: "txt",
          size: 5,
        }),
        createTestExplorerFileEntry({
          name: "src",
          path: "/workspace/src",
          is_dir: true,
        }),
        createTestExplorerFileEntry({
          name: "main.rs",
          path: "/workspace/main.rs",
          extension: "rs",
          size: 10,
        }),
      ],
      activeTagFilterIds: [],
      pathTagAssignments: [],
      sortBy: "name",
      sortOrder: "asc",
    });

    expect(result.map((entry) => entry.path)).toEqual([
      "/workspace/src",
      "/workspace/main.rs",
      "/workspace/notes.txt",
    ]);

    const telemetry = readFrontendWorkerTelemetrySnapshot();
    expect(telemetry.lanes["explorer-compute"].fallbackCount).toBeGreaterThan(0);
  });
});
