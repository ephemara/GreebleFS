import { describe, expect, it } from "vitest";

import type { ExplorerPathIndexWarmupPolicy } from "../config/explorerPerformance";
import { resolveExplorerPathIndexWarmupRoot } from "../runtime/explorerPathIndex";

const enabledPolicy: ExplorerPathIndexWarmupPolicy = {
  enabled: true,
  allowDriveRoots: false,
  minimumImplicitRootDepth: 1,
  maxImplicitRootDepth: 4,
  maxBuildingRoots: 1,
  requestCooldownMs: 30_000,
  failureCooldownMs: 60_000,
  staleBuildingRootMs: 600_000,
  excludedDirectoryNames: [".git", "node_modules", "appdata", "target"],
};

describe("explorer path index warmup policy", () => {
  it("keeps implicit warmup disabled when policy says so", () => {
    expect(
      resolveExplorerPathIndexWarmupRoot("D:/GreebleFS/usr", {
        ...enabledPolicy,
        enabled: false,
      }),
    ).toBeNull();
  });

  it("refuses drive roots and shallow roots by default", () => {
    expect(resolveExplorerPathIndexWarmupRoot("D:", enabledPolicy)).toBeNull();
    expect(resolveExplorerPathIndexWarmupRoot("D:/", enabledPolicy)).toBeNull();
    expect(resolveExplorerPathIndexWarmupRoot("D:/GreebleFS", enabledPolicy)).toBe(
      "D:\\GreebleFS",
    );
  });

  it("caps overly deep implicit roots to the authored depth", () => {
    expect(
      resolveExplorerPathIndexWarmupRoot(
        "D:/GreebleFS/usr/plugins/demo/themes/deep",
        enabledPolicy,
      ),
    ).toBe("D:\\GreebleFS\\usr\\plugins\\demo");
  });

  it("skips noisy dependency and cache folders", () => {
    expect(
      resolveExplorerPathIndexWarmupRoot(
        "D:/GreebleFS/node_modules/react",
        enabledPolicy,
      ),
    ).toBeNull();
    expect(
      resolveExplorerPathIndexWarmupRoot(
        "C:/Users/Admin/AppData/Local",
        enabledPolicy,
      ),
    ).toBeNull();
  });
});
