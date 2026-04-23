import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ExplorerFolderPreview } from "../components/ExplorerFolderPreview";
import { getFolderIconSrc } from "../config/folderIcons";
import { getBuiltInIconTheme, resolveFileIconSrc } from "../config/iconTheme";
import { listExplorerDirUncached } from "../runtime/explorerBackend";

vi.mock("../runtime/explorerBackend", () => ({
  listExplorerDirUncached: vi.fn(),
}));

describe("ExplorerFolderPreview", () => {
  beforeEach(() => {
    vi.mocked(listExplorerDirUncached).mockReset();
  });

  it("renders icon-theme folder and file icons for folder contents", async () => {
    const folderPath = "C:\\Assets\\alpha";
    const iconTheme = getBuiltInIconTheme();

    vi.mocked(listExplorerDirUncached).mockResolvedValue([
      {
        name: "shots",
        path: `${folderPath}\\shots`,
        is_dir: true,
        size: 0,
        modified: 1713400000000,
        extension: "",
        is_hidden: false,
        is_symlink: false,
      },
      {
        name: "readme.md",
        path: `${folderPath}\\readme.md`,
        is_dir: false,
        size: 1024,
        modified: 1713400000000,
        extension: "md",
        is_hidden: false,
        is_symlink: false,
      },
    ]);

    render(
      <ExplorerFolderPreview
        folderPath={folderPath}
        folderName="alpha"
        showHiddenFiles={false}
        onOpenEntry={() => undefined}
        iconTheme={iconTheme}
      />,
    );

    const folderRow = await screen.findByRole("button", {
      name: /open folder shots/i,
    });
    const fileRow = screen.getByRole("button", {
      name: /open file readme\.md/i,
    });

    const folderIcon = folderRow.querySelector(
      '[data-overlay-preview-entry-icon="true"]',
    );
    const fileIcon = fileRow.querySelector(
      '[data-overlay-preview-entry-icon="true"]',
    );

    expect(folderIcon).toBeInstanceOf(HTMLImageElement);
    expect(fileIcon).toBeInstanceOf(HTMLImageElement);
    expect((folderIcon as HTMLImageElement).getAttribute("src")).toBe(
      getFolderIconSrc(`${folderPath}\\shots`, false, { iconTheme }),
    );
    expect((fileIcon as HTMLImageElement).getAttribute("src")).toBe(
      resolveFileIconSrc("readme.md", "md", iconTheme),
    );
    expect(vi.mocked(listExplorerDirUncached)).toHaveBeenCalledWith(
      folderPath,
      false,
    );
  });

  it("starts a direct drag-out from preview rows without triggering open", async () => {
    const folderPath = "C:\\Assets\\alpha";
    const onOpenEntry = vi.fn();
    const onStartDragOutEntry = vi.fn();

    vi.mocked(listExplorerDirUncached).mockResolvedValue([
      {
        name: "readme.md",
        path: `${folderPath}\\readme.md`,
        is_dir: false,
        size: 1024,
        modified: 1713400000000,
        extension: "md",
        is_hidden: false,
        is_symlink: false,
      },
    ]);

    render(
      <ExplorerFolderPreview
        folderPath={folderPath}
        folderName="alpha"
        showHiddenFiles={false}
        onOpenEntry={onOpenEntry}
        onStartDragOutEntry={onStartDragOutEntry}
      />,
    );

    const fileRow = await screen.findByRole("button", {
      name: /open file readme\.md/i,
    });

    fireEvent.pointerDown(fileRow, {
      button: 0,
      pointerId: 1,
      clientX: 20,
      clientY: 20,
    });
    fireEvent.pointerMove(window, {
      pointerId: 1,
      clientX: 34,
      clientY: 20,
    });
    fireEvent.click(fileRow);

    expect(onStartDragOutEntry).toHaveBeenCalledTimes(1);
    expect(onStartDragOutEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        path: `${folderPath}\\readme.md`,
        name: "readme.md",
      }),
    );
    expect(onOpenEntry).not.toHaveBeenCalled();
  });
});
