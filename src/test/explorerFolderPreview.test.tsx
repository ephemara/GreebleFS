import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ExplorerFolderPreview } from "../components/ExplorerFolderPreview";
import { getFolderIconSrc } from "../config/folderIcons";
import { getBuiltInIconTheme, resolveFileIconSrc } from "../config/iconTheme";
import { defaultExplorerThumbnailSettings } from "../config/explorerThumbnails";
import { listExplorerDirUncached } from "../runtime/explorerBackend";
import { readExplorerCollectionPreviewOverviewThumbnail } from "../runtime/explorerCollectionPreviewThumbnails";
import { useSettingsStore } from "../store/settingsStore";
import { createTestExplorerFileEntry } from "./helpers/explorerEntries";

vi.mock("../runtime/explorerBackend", () => ({
  listExplorerDirUncached: vi.fn(),
}));

vi.mock("../runtime/explorerCollectionPreviewThumbnails", () => ({
  canRenderExplorerCollectionPreviewOverviewThumbnail: vi.fn(() => true),
  readExplorerCollectionPreviewOverviewThumbnail: vi.fn(async () => ({
    kind: "image",
    posterDataUrl: "data:image/png;base64,Zm9sZGVyLXByZXZpZXc=",
    hoverFrames: [],
    hoverFrameDelayMs: null,
  })),
}));

describe("ExplorerFolderPreview", () => {
  beforeEach(() => {
    vi.mocked(listExplorerDirUncached).mockReset();
    vi.mocked(readExplorerCollectionPreviewOverviewThumbnail).mockClear();
    useSettingsStore.getState().resetToDefaults();
  });

  it("renders icon-theme folder and file icons for folder contents", async () => {
    const folderPath = "C:\\Assets\\alpha";
    const iconTheme = getBuiltInIconTheme();

    vi.mocked(listExplorerDirUncached).mockResolvedValue([
      createTestExplorerFileEntry({
        name: "shots",
        path: `${folderPath}\\shots`,
        is_dir: true,
        size: 0,
        modified: 1713400000000,
        extension: "",
        is_hidden: false,
        is_symlink: false,
      }),
      createTestExplorerFileEntry({
        name: "readme.md",
        path: `${folderPath}\\readme.md`,
        is_dir: false,
        size: 1024,
        modified: 1713400000000,
        extension: "md",
        is_hidden: false,
        is_symlink: false,
      }),
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

  it("supports ctrl multiselect in preview rows and drags the full selected set without opening", async () => {
    const folderPath = "C:\\Assets\\alpha";
    const onOpenEntry = vi.fn();
    const onStartDragOutEntry = vi.fn();

    vi.mocked(listExplorerDirUncached).mockResolvedValue([
      createTestExplorerFileEntry({
        name: "notes.txt",
        path: `${folderPath}\\notes.txt`,
        is_dir: false,
        size: 640,
        modified: 1713400000000,
        extension: "txt",
        is_hidden: false,
        is_symlink: false,
      }),
      createTestExplorerFileEntry({
        name: "readme.md",
        path: `${folderPath}\\readme.md`,
        is_dir: false,
        size: 1024,
        modified: 1713400000000,
        extension: "md",
        is_hidden: false,
        is_symlink: false,
      }),
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

    const notesRow = await screen.findByRole("button", {
      name: /open file notes\.txt/i,
    });
    const fileRow = await screen.findByRole("button", {
      name: /open file readme\.md/i,
    });

    fireEvent.click(notesRow, { ctrlKey: true });
    fireEvent.click(fileRow, { ctrlKey: true });

    expect(notesRow).toHaveAttribute("aria-pressed", "true");
    expect(fileRow).toHaveAttribute("aria-pressed", "true");
    expect(onOpenEntry).not.toHaveBeenCalled();

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
        entry: expect.objectContaining({
          path: `${folderPath}\\readme.md`,
          name: "readme.md",
        }),
        entries: [
          expect.objectContaining({
            path: `${folderPath}\\notes.txt`,
            name: "notes.txt",
          }),
          expect.objectContaining({
            path: `${folderPath}\\readme.md`,
            name: "readme.md",
          }),
        ],
      }),
    );
    expect(onOpenEntry).not.toHaveBeenCalled();
  });

  it("keeps overview tiles draggable and still renders forced thumbnails when normal explorer thumbnails are disabled", async () => {
    const folderPath = "C:\\Assets\\alpha";
    const onOpenEntry = vi.fn();
    const onStartDragOutEntry = vi.fn();
    const onToggleJumpToFolder = vi.fn();

    useSettingsStore.getState().updateExplorer({
      collectionPreviewMode: "overview",
      thumbnails: {
        ...defaultExplorerThumbnailSettings,
        enabled: false,
      },
    });

    vi.mocked(listExplorerDirUncached).mockResolvedValue([
      createTestExplorerFileEntry({
        name: "notes.txt",
        path: `${folderPath}\\notes.txt`,
        is_dir: false,
        size: 640,
        modified: 1713400000000,
        extension: "txt",
        is_hidden: false,
        is_symlink: false,
      }),
      createTestExplorerFileEntry({
        name: "readme.md",
        path: `${folderPath}\\readme.md`,
        is_dir: false,
        size: 1024,
        modified: 1713400000000,
        extension: "md",
        is_hidden: false,
        is_symlink: false,
      }),
    ]);

    render(
      <ExplorerFolderPreview
        folderPath={folderPath}
        folderName="alpha"
        showHiddenFiles={false}
        onOpenEntry={onOpenEntry}
        onStartDragOutEntry={onStartDragOutEntry}
        jumpToFolderEnabled={false}
        onToggleJumpToFolder={onToggleJumpToFolder}
      />,
    );

    const notesTile = await screen.findByRole("button", {
      name: /open file notes\.txt/i,
    });
    const readmeTile = await screen.findByRole("button", {
      name: /open file readme\.md/i,
    });

    expect(
      screen.getByRole("button", { name: /use overview preview mode/i }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.getByRole("button", { name: /jump to folder/i }),
    ).toHaveTextContent("Jump Off");
    expect(screen.getByText("notes.txt")).toBeInTheDocument();
    expect(screen.getByText("readme.md")).toBeInTheDocument();

    await screen.findByRole("button", { name: /open file readme\.md/i });
    await waitFor(() => {
      expect(readExplorerCollectionPreviewOverviewThumbnail).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByRole("button", { name: /jump to folder/i }));
    expect(onToggleJumpToFolder).toHaveBeenCalledTimes(1);

    fireEvent.click(notesTile, { ctrlKey: true });
    fireEvent.click(readmeTile, { ctrlKey: true });

    expect(notesTile).toHaveAttribute("aria-pressed", "true");
    expect(readmeTile).toHaveAttribute("aria-pressed", "true");
    expect(onOpenEntry).not.toHaveBeenCalled();

    fireEvent.pointerDown(readmeTile, {
      button: 0,
      pointerId: 7,
      clientX: 20,
      clientY: 20,
    });
    fireEvent.pointerMove(window, {
      pointerId: 7,
      clientX: 36,
      clientY: 20,
    });
    fireEvent.click(readmeTile);

    expect(onStartDragOutEntry).toHaveBeenCalledTimes(1);
    expect(onStartDragOutEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        entry: expect.objectContaining({
          path: `${folderPath}\\readme.md`,
          name: "readme.md",
        }),
        entries: [
          expect.objectContaining({
            path: `${folderPath}\\notes.txt`,
            name: "notes.txt",
          }),
          expect.objectContaining({
            path: `${folderPath}\\readme.md`,
            name: "readme.md",
          }),
        ],
      }),
    );
    expect(onOpenEntry).not.toHaveBeenCalled();
  });
});
