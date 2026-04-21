import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ExplorerSqlitePreview,
  resolveSqlitePreviewLayout,
} from "../components/ExplorerSqlitePreview";

const { sqliteGetInfoMock, sqliteQueryTableMock } = vi.hoisted(() => ({
  sqliteGetInfoMock: vi.fn(),
  sqliteQueryTableMock: vi.fn(),
}));

vi.mock("../generated/tauri", () => ({
  commands: {
    sqliteGetInfo: sqliteGetInfoMock,
    sqliteQueryTable: sqliteQueryTableMock,
  },
}));

function createTableRows(totalRows: number, labelPrefix: string) {
  return Array.from({ length: totalRows }, (_, index) => [
    String(index + 1),
    `${labelPrefix} ${index + 1}`,
  ]);
}

describe("ExplorerSqlitePreview", () => {
  const logsRows = createTableRows(240, "log entry");
  const eventsRows = createTableRows(12, "event");

  beforeEach(() => {
    sqliteGetInfoMock.mockReset();
    sqliteQueryTableMock.mockReset();

    sqliteGetInfoMock.mockResolvedValue({
      status: "ok",
      data: {
        path: "/tmp/sample.sqlite",
        tables: [
          { name: "logs", row_count: logsRows.length },
          { name: "events", row_count: eventsRows.length },
        ],
      },
    });

    sqliteQueryTableMock.mockImplementation(
      async (
        _path: string,
        tableName: string,
        limit: number,
        offset: number,
      ) => {
        const rows = tableName === "events" ? eventsRows : logsRows;

        return {
          status: "ok",
          data: {
            columns: ["id", "message"],
            rows: rows.slice(offset, offset + limit),
          },
        };
      },
    );
  });

  it("pages through large tables and resets pagination when switching tables", async () => {
    const user = userEvent.setup();

    render(
      <ExplorerSqlitePreview
        dbPath="/tmp/sample.sqlite"
        dbName="sample.sqlite"
      />,
    );

    expect(await screen.findByText("Rows 1-100 of 240")).toBeInTheDocument();
    expect(sqliteQueryTableMock).toHaveBeenLastCalledWith(
      "/tmp/sample.sqlite",
      "logs",
      100,
      0,
    );

    await user.click(screen.getByRole("button", { name: /next sqlite page/i }));

    await waitFor(() => {
      expect(screen.getByText("Rows 101-200 of 240")).toBeInTheDocument();
    });
    expect(sqliteQueryTableMock).toHaveBeenLastCalledWith(
      "/tmp/sample.sqlite",
      "logs",
      100,
      100,
    );

    await user.click(screen.getByRole("button", { name: /next sqlite page/i }));

    await waitFor(() => {
      expect(screen.getByText("Rows 201-240 of 240")).toBeInTheDocument();
    });
    expect(sqliteQueryTableMock).toHaveBeenLastCalledWith(
      "/tmp/sample.sqlite",
      "logs",
      100,
      200,
    );
    expect(
      screen.getByRole("button", { name: /next sqlite page/i }),
    ).toBeDisabled();

    await user.click(screen.getByRole("button", { name: /events/i }));

    await waitFor(() => {
      expect(screen.getByText("Rows 1-12 of 12")).toBeInTheDocument();
    });
    expect(sqliteQueryTableMock).toHaveBeenLastCalledWith(
      "/tmp/sample.sqlite",
      "events",
      100,
      0,
    );
    expect(
      screen.getByRole("button", { name: /previous sqlite page/i }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: /next sqlite page/i }),
    ).toBeDisabled();
  });

  it("resolves compact and wide layout modes from pane width", () => {
    expect(resolveSqlitePreviewLayout(null)).toBe("compact");
    expect(resolveSqlitePreviewLayout(420)).toBe("compact");
    expect(resolveSqlitePreviewLayout(759)).toBe("compact");
    expect(resolveSqlitePreviewLayout(760)).toBe("wide");
    expect(resolveSqlitePreviewLayout(920)).toBe("wide");
  });
});
