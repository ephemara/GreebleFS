import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ExplorerSqlitePreview,
  resolveSqlitePreviewLayout,
} from "../components/ExplorerSqlitePreview";

type QueryRequest = {
  path: string;
  tableName: string;
  limit: number;
  offset: number;
  searchText?: string | null;
  sortColumn?: string | null;
  sortDirection?: "asc" | "desc" | null;
};

type QueryResult = {
  columns: string[];
  rows: string[][];
  totalRows: number;
  filteredRows: number;
  appliedOffset: number;
  nextOffset: number | null;
};

const { sqliteGetInfoMock, sqliteQueryTableWindowMock } = vi.hoisted(() => ({
  sqliteGetInfoMock: vi.fn(),
  sqliteQueryTableWindowMock: vi.fn(),
}));

vi.mock("../runtime/tauriClient", async () => {
  const actual = await vi.importActual<typeof import("../runtime/tauriClient")>(
    "../runtime/tauriClient",
  );

  return {
    ...actual,
    commands: {
      ...actual.commands,
      sqliteGetInfo: sqliteGetInfoMock,
      sqliteQueryTableWindow: sqliteQueryTableWindowMock,
    },
  };
});

function createRows(totalRows: number, prefix: string): string[][] {
  return Array.from({ length: totalRows }, (_, index) => [
    String(index + 1),
    `${prefix} ${index + 1}`,
  ]);
}

function applyWindowQuery(
  rows: string[][],
  request: QueryRequest,
): QueryResult {
  const trimmedSearch = request.searchText?.trim().toLowerCase() ?? "";
  const filteredRows =
    trimmedSearch.length > 0
      ? rows.filter((row) =>
          row.some((cell) => cell.toLowerCase().includes(trimmedSearch)),
        )
      : [...rows];

  if (request.sortColumn === "id") {
    filteredRows.sort((left, right) => {
      const leftValue = Number(left[0]);
      const rightValue = Number(right[0]);
      return request.sortDirection === "desc"
        ? rightValue - leftValue
        : leftValue - rightValue;
    });
  } else if (request.sortColumn === "message") {
    filteredRows.sort((left, right) => {
      const comparison = left[1].localeCompare(right[1]);
      return request.sortDirection === "desc" ? -comparison : comparison;
    });
  }

  const batch = filteredRows.slice(
    request.offset,
    request.offset + request.limit,
  );
  const nextOffset =
    request.offset + batch.length < filteredRows.length
      ? request.offset + batch.length
      : null;

  return {
    columns: ["id", "message"],
    rows: batch,
    totalRows: rows.length,
    filteredRows: filteredRows.length,
    appliedOffset: request.offset,
    nextOffset,
  };
}

describe("ExplorerSqlitePreview", () => {
  const logsRows = createRows(405, "log entry");
  logsRows[1] = ["2", "critical beta"];
  logsRows[144] = ["145", "critical delta"];
  logsRows[289] = ["290", "critical omega"];
  const eventsRows = [
    ["1", "event 1"],
    ["2", "event 2"],
  ];

  beforeEach(() => {
    sqliteGetInfoMock.mockReset();
    sqliteQueryTableWindowMock.mockReset();

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

    sqliteQueryTableWindowMock.mockImplementation(
      async (request: QueryRequest) => ({
        status: "ok",
        data: applyWindowQuery(
          request.tableName === "events" ? eventsRows : logsRows,
          request,
        ),
      }),
    );
  });

  it("streams more rows, filters the active table, and resets search when switching tables", async () => {
    const user = userEvent.setup();

    render(
      <ExplorerSqlitePreview
        dbPath="/tmp/sample.sqlite"
        dbName="sample.sqlite"
      />,
    );

    expect(await screen.findByText("log entry 400")).toBeInTheDocument();
    expect(screen.queryByText("log entry 405")).not.toBeInTheDocument();
    expect(sqliteQueryTableWindowMock).toHaveBeenLastCalledWith({
      path: "/tmp/sample.sqlite",
      tableName: "logs",
      limit: 400,
      offset: 0,
      searchText: null,
      sortColumn: null,
      sortDirection: null,
    });

    await user.click(screen.getByRole("button", { name: /load more/i }));

    await screen.findByText("log entry 405");
    expect(sqliteQueryTableWindowMock).toHaveBeenLastCalledWith({
      path: "/tmp/sample.sqlite",
      tableName: "logs",
      limit: 400,
      offset: 400,
      searchText: null,
      sortColumn: null,
      sortDirection: null,
    });
    expect(
      screen.queryByRole("button", { name: /load more/i }),
    ).not.toBeInTheDocument();

    const searchInput = screen.getByPlaceholderText(
      "Search rows in this table",
    );
    await user.type(searchInput, "critical");

    await waitFor(() => {
      expect(sqliteQueryTableWindowMock).toHaveBeenLastCalledWith({
        path: "/tmp/sample.sqlite",
        tableName: "logs",
        limit: 400,
        offset: 0,
        searchText: "critical",
        sortColumn: null,
        sortDirection: null,
      });
    });
    expect(await screen.findByText("critical beta")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByText("log entry 405")).not.toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /^events/i }));

    await waitFor(() => {
      expect(
        screen.getByPlaceholderText("Search rows in this table"),
      ).toHaveValue("");
    });
    expect(await screen.findByText("event 1")).toBeInTheDocument();
    expect(sqliteQueryTableWindowMock).toHaveBeenLastCalledWith({
      path: "/tmp/sample.sqlite",
      tableName: "events",
      limit: 400,
      offset: 0,
      searchText: null,
      sortColumn: null,
      sortDirection: null,
    });
  });

  it("cycles sqlite sort state from ascending to descending to unsorted", async () => {
    const user = userEvent.setup();

    render(
      <ExplorerSqlitePreview
        dbPath="/tmp/sample.sqlite"
        dbName="sample.sqlite"
      />,
    );

    const messageHeader = await screen.findByRole("button", {
      name: /message/i,
    });

    await user.click(messageHeader);
    await waitFor(() => {
      expect(sqliteQueryTableWindowMock).toHaveBeenLastCalledWith({
        path: "/tmp/sample.sqlite",
        tableName: "logs",
        limit: 400,
        offset: 0,
        searchText: null,
        sortColumn: "message",
        sortDirection: "asc",
      });
    });

    await user.click(screen.getByRole("button", { name: /message/i }));
    await waitFor(() => {
      expect(sqliteQueryTableWindowMock).toHaveBeenLastCalledWith({
        path: "/tmp/sample.sqlite",
        tableName: "logs",
        limit: 400,
        offset: 0,
        searchText: null,
        sortColumn: "message",
        sortDirection: "desc",
      });
    });

    await user.click(screen.getByRole("button", { name: /message/i }));
    await waitFor(() => {
      expect(sqliteQueryTableWindowMock).toHaveBeenLastCalledWith({
        path: "/tmp/sample.sqlite",
        tableName: "logs",
        limit: 400,
        offset: 0,
        searchText: null,
        sortColumn: null,
        sortDirection: null,
      });
    });
  });

  it("resolves compact and wide layout modes from pane width", () => {
    expect(resolveSqlitePreviewLayout(null)).toBe("compact");
    expect(resolveSqlitePreviewLayout(420)).toBe("compact");
    expect(resolveSqlitePreviewLayout(759)).toBe("compact");
    expect(resolveSqlitePreviewLayout(760)).toBe("wide");
    expect(resolveSqlitePreviewLayout(920)).toBe("wide");
  });
});
