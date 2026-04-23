import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ExplorerArchivePreview } from "../components/ExplorerArchivePreview";
import { buildExplorerArchiveVirtualPath } from "../config/explorerArchives";
import { getFolderIconSrc } from "../config/folderIcons";
import { getBuiltInIconTheme, resolveFileIconSrc } from "../config/iconTheme";
import { explorerBackendContract } from "../runtime/explorerBackend";

vi.mock("../runtime/explorerBackend", () => ({
  explorerBackendContract: {
    listArchiveDir: vi.fn(),
  },
}));

describe("ExplorerArchivePreview", () => {
  beforeEach(() => {
    vi.mocked(explorerBackendContract.listArchiveDir).mockReset();
  });

  it("renders archive directory entries from the typed archive listing bridge", async () => {
    const archivePath = "C:\\Assets\\demo.zip";
    const iconTheme = getBuiltInIconTheme();
    const texturesPath = buildExplorerArchiveVirtualPath({
      archivePath,
      entryPath: "textures",
    });
    const readmePath = buildExplorerArchiveVirtualPath({
      archivePath,
      entryPath: "docs/readme.txt",
    });

    vi.mocked(explorerBackendContract.listArchiveDir).mockResolvedValue([
      {
        name: "textures",
        path: texturesPath,
        is_dir: true,
        size: 0,
        modified: 1713400000000,
        extension: "",
        is_hidden: false,
        is_symlink: false,
      },
      {
        name: "readme.txt",
        path: readmePath,
        is_dir: false,
        size: 1024,
        modified: 1713400000000,
        extension: "txt",
        is_hidden: false,
        is_symlink: false,
      },
    ]);

    render(
      <ExplorerArchivePreview
        archivePath={archivePath}
        archiveName="demo.zip"
        archiveSize={2048}
        descriptor={{ id: "zip", suffixes: [".zip"], label: "Zip Archive" }}
        onExtract={() => undefined}
        onOpenEntry={() => undefined}
        iconTheme={iconTheme}
      />,
    );

    expect(
      await screen.findByRole("button", { name: /open archive folder textures/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /open archive file readme\.txt/i }),
    ).toBeInTheDocument();
    expect(vi.mocked(explorerBackendContract.listArchiveDir)).toHaveBeenCalledWith(
      archivePath,
      "",
    );

    const folderRow = screen.getByRole("button", {
      name: /open archive folder textures/i,
    });
    const fileRow = screen.getByRole("button", {
      name: /open archive file readme\.txt/i,
    });
    const folderIcon = folderRow?.querySelector(
      '[data-overlay-preview-entry-icon="true"]',
    );
    const fileIcon = fileRow?.querySelector(
      '[data-overlay-preview-entry-icon="true"]',
    );

    expect(folderIcon).toBeInstanceOf(HTMLImageElement);
    expect(fileIcon).toBeInstanceOf(HTMLImageElement);
    expect((folderIcon as HTMLImageElement).getAttribute("src")).toBe(
      getFolderIconSrc("textures", false, { iconTheme }),
    );
    expect((fileIcon as HTMLImageElement).getAttribute("src")).toBe(
      resolveFileIconSrc("readme.txt", "txt", iconTheme),
    );

    const viewport = document.querySelector(
      '[data-overlay-scrollbar-style="explorer-file-list"]',
    );
    expect(viewport).not.toBeNull();
    expect(
      viewport?.classList.contains(
        "overlay-scroll-area__viewport--explorer-file-list",
      ),
    ).toBe(true);
  });
});
