import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ExplorerSpreadsheetWorkbench } from "../components/ExplorerSpreadsheetWorkbench";
import { useSettingsStore } from "../store/settingsStore";

const {
  readExplorerFileBase64Mock,
  readExplorerTextFileMock,
  writeExplorerFileMock,
  spreadsheetGridMockState,
} = vi.hoisted(() => ({
  readExplorerFileBase64Mock: vi.fn(),
  readExplorerTextFileMock: vi.fn(),
  writeExplorerFileMock: vi.fn(),
  spreadsheetGridMockState: {
    lastProps: null as null | Record<string, unknown>,
  },
}));

vi.mock("@glideapps/glide-data-grid", async () => {
  const ReactModule = await import("react");

  return {
    CompactSelection: {
      empty: () => ({ items: [] }),
    },
    DataEditor: ReactModule.forwardRef((props: Record<string, unknown>, ref) => {
      spreadsheetGridMockState.lastProps = props;
      ReactModule.useImperativeHandle(
        ref,
        () => ({
          focus: () => {},
        }),
        [],
      );

      return (
        <div
          data-testid="mock-spreadsheet-grid"
          data-edit-on-type={String(Boolean(props.editOnType))}
          data-has-trailing-row={String(Boolean(props.trailingRowOptions))}
        />
      );
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
    spreadsheetGridMockState.lastProps = null;
    readExplorerTextFileMock.mockResolvedValue("name,score\nAda,1\nGrace,2\n");
    readExplorerFileBase64Mock.mockResolvedValue("");
    writeExplorerFileMock.mockResolvedValue(undefined);
  });

  it("renders csv previews as read-only spreadsheets with the full tabular cell matrix", async () => {
    render(
      <ExplorerSpreadsheetWorkbench
        path="/tmp/scores.csv"
        name="scores.csv"
        sourceExtension="csv"
        fileKind="tabular"
        mode="preview"
      />,
    );

    expect(await screen.findByTestId("spreadsheet-preview-shell")).toBeInTheDocument();
    expect(screen.getByText("scores.csv")).toBeInTheDocument();
    expect(screen.getByText("/tmp/scores.csv")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sheet1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^reload$/i })).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/enter a value or formula/i)).toBeNull();
    expect(screen.queryByRole("button", { name: /^save$/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /new sheet/i })).toBeNull();
    expect(spreadsheetGridMockState.lastProps).toBeNull();
    expect(screen.getByText("name")).toBeInTheDocument();
    expect(screen.getByText("score")).toBeInTheDocument();
    expect(screen.getByText("Ada")).toBeInTheDocument();
    expect(screen.getByTitle("2")).toBeInTheDocument();
  });

  it("requests edit mode from preview when the spreadsheet edit hotkey fires", async () => {
    const onModeChange = vi.fn();

    render(
      <ExplorerSpreadsheetWorkbench
        path="/tmp/scores.csv"
        name="scores.csv"
        sourceExtension="csv"
        fileKind="tabular"
        mode="preview"
        onModeChange={onModeChange}
      />,
    );

    const previewShell = await screen.findByTestId("spreadsheet-preview-shell");

    fireEvent.keyDown(previewShell, {
      key: "e",
      code: "KeyE",
    });

    expect(onModeChange).toHaveBeenCalledWith("edit");
  });

  it("rejects invalid formula edits and restores the last valid cell value", async () => {
    const user = userEvent.setup();

    render(
      <ExplorerSpreadsheetWorkbench
        path="/tmp/scores.csv"
        name="scores.csv"
        sourceExtension="csv"
        fileKind="tabular"
        mode="edit"
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
        mode="edit"
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
