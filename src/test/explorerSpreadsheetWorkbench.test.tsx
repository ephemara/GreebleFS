import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ExplorerSpreadsheetWorkbench } from "../components/ExplorerSpreadsheetWorkbench";
import { useSettingsStore } from "../store/settingsStore";

const {
  readExplorerFileBase64Mock,
  readExplorerTextFileMock,
  writeExplorerFileMock,
} = vi.hoisted(() => ({
  readExplorerFileBase64Mock: vi.fn(),
  readExplorerTextFileMock: vi.fn(),
  writeExplorerFileMock: vi.fn(),
}));

vi.mock("@glideapps/glide-data-grid", async () => {
  const ReactModule = await import("react");

  return {
    CompactSelection: {
      empty: () => ({ items: [] }),
    },
    DataEditor: ReactModule.forwardRef((_props: unknown, ref) => {
      ReactModule.useImperativeHandle(
        ref,
        () => ({
          focus: () => {},
        }),
        [],
      );

      return <div data-testid="mock-spreadsheet-grid" />;
    }),
    GridCellKind: {
      Loading: "loading",
      Text: "text",
      Number: "number",
      Boolean: "boolean",
      Markdown: "markdown",
      Uri: "uri",
      Image: "image",
      Custom: "custom",
    },
  };
});

vi.mock("../runtime/explorerBackend", () => ({
  readExplorerFileBase64: readExplorerFileBase64Mock,
  readExplorerTextFile: readExplorerTextFileMock,
  writeExplorerFile: writeExplorerFileMock,
}));

describe("ExplorerSpreadsheetWorkbench", () => {
  beforeEach(() => {
    useSettingsStore.getState().resetToDefaults();
    readExplorerFileBase64Mock.mockReset();
    readExplorerTextFileMock.mockReset();
    writeExplorerFileMock.mockReset();
    readExplorerTextFileMock.mockResolvedValue("name,score\nAda,1\n");
    readExplorerFileBase64Mock.mockResolvedValue("");
    writeExplorerFileMock.mockResolvedValue(undefined);
  });

  it("rejects invalid formula edits and restores the last valid cell value", async () => {
    const user = userEvent.setup();

    render(
      <ExplorerSpreadsheetWorkbench
        path="/tmp/scores.csv"
        name="scores.csv"
        sourceExtension="csv"
        fileKind="tabular"
      />,
    );

    const formulaInput = await screen.findByPlaceholderText(
      /enter a value or formula/i,
    );
    await waitFor(() => expect(formulaInput).toHaveValue("name"));

    await user.clear(formulaInput);
    await user.type(formulaInput, "=");
    fireEvent.keyDown(formulaInput, { key: "Enter" });

    expect(
      await screen.findByText(/formulas must include an expression after =/i),
    ).toBeInTheDocument();
    expect(formulaInput).toHaveValue("name");
    expect(writeExplorerFileMock).not.toHaveBeenCalled();
  });

  it("preserves spreadsheet edits after a save failure and allows retry", async () => {
    const user = userEvent.setup();

    render(
      <ExplorerSpreadsheetWorkbench
        path="/tmp/scores.csv"
        name="scores.csv"
        sourceExtension="csv"
        fileKind="tabular"
      />,
    );

    const formulaInput = await screen.findByPlaceholderText(
      /enter a value or formula/i,
    );
    await waitFor(() => expect(formulaInput).toHaveValue("name"));

    await user.clear(formulaInput);
    await user.type(formulaInput, "title");
    fireEvent.keyDown(formulaInput, { key: "Enter" });

    const saveButton = screen.getByRole("button", { name: /^save$/i });
    expect(saveButton).not.toBeDisabled();

    writeExplorerFileMock.mockRejectedValueOnce(new Error("Disk full"));
    await user.click(saveButton);

    expect(
      await screen.findByText(/disk full draft preserved; use save to retry\./i),
    ).toBeInTheDocument();
    expect(saveButton).not.toBeDisabled();

    writeExplorerFileMock.mockResolvedValueOnce(undefined);
    await user.click(saveButton);

    await waitFor(() => expect(writeExplorerFileMock).toHaveBeenCalledTimes(2));
    expect(await screen.findByText(/spreadsheet saved/i)).toBeInTheDocument();
    expect(saveButton).toBeDisabled();
  });
});
