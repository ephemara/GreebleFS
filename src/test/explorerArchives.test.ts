import { describe, expect, it } from "vitest";
import {
  getExplorerArchiveDefaultFolderName,
  getExplorerArchiveDescriptor,
  getExplorerArchiveExtractToFolderLabel,
  isExplorerArchiveEntry,
} from "../config/explorerArchives";

describe("explorer archive registry", () => {
  it("prefers compound archive suffixes before plain gzip suffixes", () => {
    expect(getExplorerArchiveDescriptor("demo.tar.gz")?.id).toBe("tar-gzip");
    expect(getExplorerArchiveDescriptor("demo.tgz")?.id).toBe("tar-gzip");
    expect(getExplorerArchiveDescriptor("demo.gz")?.id).toBe("gzip");
  });

  it("recognizes supported archive entries and ignores directories", () => {
    expect(
      isExplorerArchiveEntry({
        name: "demo.zip",
        is_dir: false,
      }),
    ).toBe(true);

    expect(
      isExplorerArchiveEntry({
        name: "demo.zip",
        is_dir: true,
      }),
    ).toBe(false);
  });

  it("builds extraction folder names without leaving compound suffixes behind", () => {
    expect(getExplorerArchiveDefaultFolderName("demo.tar.gz")).toBe("demo");
    expect(getExplorerArchiveDefaultFolderName("demo.zip")).toBe("demo");
    expect(getExplorerArchiveDefaultFolderName(".zip")).toBe("archive");
  });

  it("builds a user-facing extract label from the normalized folder name", () => {
    expect(getExplorerArchiveExtractToFolderLabel("demo.tar.xz")).toBe(
      'Extract to "demo"/',
    );
  });

  it("stores access guidance alongside format detection so the preview can stay data-driven", () => {
    expect(getExplorerArchiveDescriptor("demo.zip")).toMatchObject({
      accessSummary: "Entry-addressable archive",
      recommendedWorkflow: "browse-first",
    });
    expect(getExplorerArchiveDescriptor("demo.tar.xz")).toMatchObject({
      accessSummary: "Dense streamed tree archive",
      recommendedWorkflow: "extract-first",
    });
    expect(getExplorerArchiveDescriptor("demo.7z")).toMatchObject({
      accessSummary: "Compression-first archive",
      recommendedWorkflow: "extract-first",
    });
  });
});
