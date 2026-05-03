import { describe, expect, it } from "vitest";

import { shouldMaterializeArchiveEntryForPreviewKind } from "../runtime/explorerArchivePreviewPolicy";

describe("explorer archive preview materialization policy", () => {
  it("keeps stream-capable archive preview kinds virtual", () => {
    for (const kind of ["docx", "image", "model3d", "script", "spreadsheet", "text"]) {
      expect(shouldMaterializeArchiveEntryForPreviewKind(kind)).toBe(false);
    }
  });

  it("materializes archive entries for path-required preview kinds", () => {
    for (const kind of ["audio", "font", "pdf", "shader", "unsupported", "video"]) {
      expect(shouldMaterializeArchiveEntryForPreviewKind(kind)).toBe(true);
    }
  });
});
