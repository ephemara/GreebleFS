import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Database,
  Loader,
  Table,
} from "lucide-react";
import {
  commands,
  type SqliteDbInfo,
  type SqliteTableInfo,
  type SqliteTablePreview,
} from "../generated/tauri";
import { OverlayScrollArea } from "./OverlayScrollArea";

export interface ExplorerSqlitePreviewProps {
  dbPath: string;
  dbName: string;
}

const PAGE_SIZE = 100;
const COMPACT_LAYOUT_BREAKPOINT_PX = 760;

const integerFormatter = new Intl.NumberFormat();

function formatInteger(value: number): string {
  return integerFormatter.format(Math.max(0, Math.trunc(value)));
}

function formatVisibleRangeLabel(
  page: number,
  rowsOnPage: number,
  totalRows: number,
): string {
  if (rowsOnPage <= 0 || totalRows <= 0) {
    return "Rows 0-0";
  }

  const start = page * PAGE_SIZE + 1;
  const end = page * PAGE_SIZE + rowsOnPage;
  return `Rows ${formatInteger(start)}-${formatInteger(end)}`;
}

function renderMetricPill(label: string, value: string) {
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "3px 7px",
        borderRadius: 999,
        background: "var(--overlay-explorer-chip-bg)",
        border: "1px solid var(--overlay-explorer-preview-border)",
        minWidth: 0,
      }}
    >
      <span
        style={{
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: "0.05em",
          textTransform: "uppercase",
          color: "var(--overlay-text-muted)",
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: 10,
          color: "var(--overlay-text-primary)",
          whiteSpace: "nowrap",
        }}
      >
        {value}
      </span>
    </div>
  );
}

function renderCenteredStatus(
  content: ReactNode,
  textColor = "var(--overlay-text-dim)",
) {
  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        display: "grid",
        placeItems: "center",
        padding: 24,
        color: textColor,
      }}
    >
      {content}
    </div>
  );
}

export function resolveSqlitePreviewLayout(
  containerWidth: number | null,
): "compact" | "wide" {
  return containerWidth == null || containerWidth < COMPACT_LAYOUT_BREAKPOINT_PX
    ? "compact"
    : "wide";
}

export function ExplorerSqlitePreview({
  dbPath,
  dbName,
}: ExplorerSqlitePreviewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [info, setInfo] = useState<SqliteDbInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTable, setActiveTable] = useState<string | null>(null);
  const [tableData, setTableData] = useState<SqliteTablePreview | null>(null);
  const [tableQueryError, setTableQueryError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [loadingData, setLoadingData] = useState(false);
  const [containerWidth, setContainerWidth] = useState<number | null>(null);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) {
      return;
    }

    const updateWidth = (nextWidth: number) => {
      setContainerWidth((currentWidth) => {
        if (
          currentWidth != null &&
          Number.isFinite(nextWidth) &&
          Math.abs(currentWidth - nextWidth) < 1
        ) {
          return currentWidth;
        }
        return nextWidth;
      });
    };

    updateWidth(element.getBoundingClientRect().width);

    const ResizeObserverConstructor = globalThis.ResizeObserver;
    if (typeof ResizeObserverConstructor !== "function") {
      return;
    }

    const observer = new ResizeObserverConstructor((entries) => {
      const nextWidth =
        entries[0]?.contentRect.width ?? element.getBoundingClientRect().width;
      updateWidth(nextWidth);
    });
    observer.observe(element);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let isActive = true;

    setInfo(null);
    setError(null);
    setActiveTable(null);
    setTableData(null);
    setTableQueryError(null);
    setPage(0);
    setLoadingData(false);

    commands.sqliteGetInfo(dbPath).then((result) => {
      if (!isActive) {
        return;
      }

      if (result.status === "ok") {
        setInfo(result.data);
        setActiveTable(result.data.tables[0]?.name ?? null);
        return;
      }

      setError(result.error);
    });

    return () => {
      isActive = false;
    };
  }, [dbPath]);

  useEffect(() => {
    if (!activeTable) {
      setTableData(null);
      setTableQueryError(null);
      setLoadingData(false);
      return;
    }

    let isActive = true;

    setLoadingData(true);
    setTableQueryError(null);

    commands
      .sqliteQueryTable(dbPath, activeTable, PAGE_SIZE, page * PAGE_SIZE)
      .then((result) => {
        if (!isActive) {
          return;
        }

        setLoadingData(false);

        if (result.status === "ok") {
          setTableData(result.data);
          return;
        }

        setTableData(null);
        setTableQueryError(result.error);
      });

    return () => {
      isActive = false;
    };
  }, [activeTable, dbPath, page]);

  const layoutMode = resolveSqlitePreviewLayout(containerWidth);
  const isCompactLayout = layoutMode === "compact";

  const activeTableInfo = useMemo<SqliteTableInfo | null>(
    () => info?.tables.find((table) => table.name === activeTable) ?? null,
    [activeTable, info],
  );

  const totalRows = Math.max(
    0,
    activeTableInfo?.row_count ?? tableData?.rows.length ?? 0,
  );
  const totalPages = Math.max(1, Math.ceil(totalRows / PAGE_SIZE) || 1);
  const currentPage = Math.min(page, totalPages - 1);
  const rowsOnPage = tableData?.rows.length ?? 0;
  const hasPreviousPage = currentPage > 0;
  const hasNextPage = currentPage + 1 < totalPages;

  const handleSelectTable = (tableName: string) => {
    setActiveTable(tableName);
    setPage(0);
    setTableData(null);
    setTableQueryError(null);
  };

  if (error) {
    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "grid",
          placeItems: "center",
          background: "var(--overlay-explorer-preview-bg)",
          color: "var(--overlay-danger)",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 12,
            textAlign: "center",
            maxWidth: 320,
          }}
        >
          <AlertCircle size={32} />
          <div style={{ fontWeight: 600 }}>Failed to read database</div>
          <div style={{ fontSize: 12, color: "var(--overlay-text-dim)" }}>
            {error}
          </div>
        </div>
      </div>
    );
  }

  if (!info) {
    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "grid",
          placeItems: "center",
          background: "var(--overlay-explorer-preview-bg)",
        }}
      >
        <Loader
          aria-label="Loading SQLite preview"
          size={20}
          style={{
            animation: "spin 1s linear infinite",
            color: "var(--overlay-text-muted)",
          }}
        />
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      data-sqlite-layout={layoutMode}
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: "var(--overlay-explorer-preview-bg)",
        overflow: "hidden",
        color: "var(--overlay-text-primary)",
      }}
    >
      <div
        style={{
          padding: "10px 12px",
          borderBottom: "1px solid var(--overlay-explorer-preview-border)",
          background: "var(--overlay-bg-card)",
          display: "flex",
          alignItems: "flex-start",
          gap: 10,
        }}
      >
        <div
          style={{
            width: 30,
            height: 30,
            borderRadius: 8,
            background: "var(--overlay-explorer-chip-bg)",
            color: "var(--overlay-accent)",
            display: "grid",
            placeItems: "center",
            flexShrink: 0,
          }}
        >
          <Database size={16} />
        </div>
        <div style={{ minWidth: 0, display: "grid", gap: 6, flex: 1 }}>
          <div style={{ display: "grid", gap: 4 }}>
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
              title={dbName}
            >
              {dbName}
            </div>
            <div
              style={{
                fontSize: 9.5,
                color: "var(--overlay-text-muted)",
                fontFamily: "var(--overlay-font-mono, monospace)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
              title={dbPath}
            >
              {dbPath}
            </div>
          </div>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 8,
            }}
          >
            {renderMetricPill("Tables", formatInteger(info.tables.length))}
            {renderMetricPill("Page Size", formatInteger(PAGE_SIZE))}
            {activeTableInfo
              ? renderMetricPill(
                  "Active Rows",
                  formatInteger(activeTableInfo.row_count),
                )
              : null}
          </div>
        </div>
      </div>

      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            flex: 1,
            minWidth: 0,
            minHeight: 0,
            display: "flex",
            flexDirection: "column",
          }}
        >
          {info.tables.length === 0 ? (
            renderCenteredStatus(
              <div
                style={{
                  display: "grid",
                  gap: 8,
                  textAlign: "center",
                  maxWidth: 240,
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 600 }}>
                  No user tables found
                </div>
                <div style={{ fontSize: 12 }}>
                  SQLite system tables are hidden in this preview.
                </div>
              </div>,
            )
          ) : (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
                padding: "8px 12px 10px",
                borderBottom:
                  "1px solid var(--overlay-explorer-preview-border)",
                background: "var(--overlay-bg-panel)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                }}
              >
                <div
                  style={{
                    fontSize: 9.5,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    color: "var(--overlay-text-muted)",
                  }}
                >
                  Tables
                </div>
                <div style={{ fontSize: 10, color: "var(--overlay-text-dim)" }}>
                  {formatInteger(info.tables.length)} total
                </div>
              </div>

              <OverlayScrollArea
                direction="horizontal"
                style={{ flex: "0 0 auto" }}
                viewportStyle={{ paddingBottom: 2 }}
                contentStyle={{
                  display: "flex",
                  alignItems: "stretch",
                  gap: 8,
                  minWidth: "max-content",
                  paddingRight: 8,
                }}
                scrollbarStyle="themed"
              >
                {info.tables.map((table) => {
                  const isActive = table.name === activeTable;

                  return (
                    <button
                      key={table.name}
                      type="button"
                      onClick={() => handleSelectTable(table.name)}
                      style={{
                        flex: "0 0 auto",
                        minWidth: isCompactLayout ? 152 : 176,
                        maxWidth: isCompactLayout ? 196 : 228,
                        border:
                          "1px solid var(--overlay-explorer-preview-border)",
                        borderRadius: 999,
                        padding: "8px 10px",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        textAlign: "left",
                        background: isActive
                          ? "var(--overlay-selection-bg)"
                          : "var(--overlay-explorer-chip-bg)",
                        color: isActive
                          ? "var(--overlay-text-primary)"
                          : "var(--overlay-text-secondary)",
                        boxShadow: isActive
                          ? "inset 0 0 0 1px var(--overlay-explorer-preview-border)"
                          : "none",
                      }}
                      title={`${table.name} · ${formatInteger(table.row_count)} rows`}
                    >
                      <Table
                        size={13}
                        style={{
                          flexShrink: 0,
                          opacity: isActive ? 1 : 0.65,
                        }}
                      />
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          minWidth: 0,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          flex: 1,
                        }}
                      >
                        {table.name}
                      </span>
                      <span
                        style={{
                          fontSize: 10,
                          color: "var(--overlay-text-dim)",
                          whiteSpace: "nowrap",
                          flexShrink: 0,
                        }}
                      >
                        {formatInteger(table.row_count)}
                      </span>
                    </button>
                  );
                })}
              </OverlayScrollArea>
            </div>
          )}

          {!activeTable ? (
            renderCenteredStatus(
              <div
                style={{
                  display: "grid",
                  gap: 8,
                  textAlign: "center",
                  maxWidth: 260,
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 600 }}>
                  Select a table
                </div>
                <div style={{ fontSize: 12 }}>
                  Pick a user table to inspect its columns and rows.
                </div>
              </div>,
            )
          ) : (
            <>
              <div
                style={{
                  padding: "10px 12px",
                  borderBottom:
                    "1px solid var(--overlay-explorer-preview-border)",
                  background: "var(--overlay-bg-card)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                }}
              >
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: isCompactLayout
                      ? "minmax(0, 1fr)"
                      : "minmax(0, 1fr) auto",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                  }}
                >
                  <div style={{ minWidth: 0, display: "grid", gap: 6 }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        minWidth: 0,
                      }}
                    >
                      <Table
                        size={16}
                        style={{
                          flexShrink: 0,
                          color: "var(--overlay-accent)",
                        }}
                      />
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                          minWidth: 0,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                        title={activeTable}
                      >
                        {activeTable}
                      </div>
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {renderMetricPill(
                        "Columns",
                        formatInteger(tableData?.columns.length ?? 0),
                      )}
                      {renderMetricPill("Rows", formatInteger(totalRows))}
                      {renderMetricPill(
                        "Page",
                        `${currentPage + 1} / ${totalPages}`,
                      )}
                    </div>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      flexWrap: isCompactLayout ? "wrap" : "nowrap",
                    }}
                  >
                    <button
                      type="button"
                      aria-label="Previous SQLite page"
                      disabled={!hasPreviousPage}
                      onClick={() =>
                        setPage((current) => Math.max(0, current - 1))
                      }
                      style={{
                        padding: "6px 9px",
                        borderRadius: 8,
                        background: "transparent",
                        border:
                          "1px solid var(--overlay-explorer-preview-border)",
                        cursor: hasPreviousPage ? "pointer" : "not-allowed",
                        opacity: hasPreviousPage ? 1 : 0.45,
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                        color: "var(--overlay-text-primary)",
                        outline: "none",
                        whiteSpace: "nowrap",
                      }}
                    >
                      <ChevronLeft size={16} />
                      Prev
                    </button>
                    <button
                      type="button"
                      aria-label="Next SQLite page"
                      disabled={!hasNextPage}
                      onClick={() => setPage((current) => current + 1)}
                      style={{
                        padding: "6px 9px",
                        borderRadius: 8,
                        background: "transparent",
                        border:
                          "1px solid var(--overlay-explorer-preview-border)",
                        cursor: hasNextPage ? "pointer" : "not-allowed",
                        opacity: hasNextPage ? 1 : 0.45,
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                        color: "var(--overlay-text-primary)",
                        outline: "none",
                        whiteSpace: "nowrap",
                      }}
                    >
                      Next
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    flexWrap: isCompactLayout ? "wrap" : "nowrap",
                    fontSize: 11,
                    color: "var(--overlay-text-dim)",
                  }}
                >
                  <span style={{ whiteSpace: "nowrap" }}>
                    {formatVisibleRangeLabel(
                      currentPage,
                      rowsOnPage,
                      totalRows,
                    )}
                    {totalRows > 0 ? ` of ${formatInteger(totalRows)}` : ""}
                  </span>
                  <span
                    style={{
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    Horizontal scroll keeps wide datasets compact.
                  </span>
                </div>
              </div>

              {tableQueryError ? (
                renderCenteredStatus(
                  <div
                    style={{
                      display: "grid",
                      gap: 8,
                      textAlign: "center",
                      maxWidth: 320,
                    }}
                  >
                    <div
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 8,
                        fontSize: 13,
                        fontWeight: 600,
                        color: "var(--overlay-danger)",
                      }}
                    >
                      <AlertCircle size={16} />
                      Failed to query table
                    </div>
                    <div
                      style={{ fontSize: 12, color: "var(--overlay-text-dim)" }}
                    >
                      {tableQueryError}
                    </div>
                  </div>,
                  "var(--overlay-danger)",
                )
              ) : !tableData ? (
                renderCenteredStatus(
                  <div
                    role="status"
                    aria-label="Loading SQLite table"
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 12,
                    }}
                  >
                    <Loader
                      size={22}
                      style={{
                        animation: "spin 1s linear infinite",
                      }}
                    />
                    <div style={{ fontSize: 12 }}>Loading table preview…</div>
                  </div>,
                )
              ) : (
                <div
                  style={{
                    flex: 1,
                    minHeight: 0,
                    minWidth: 0,
                    position: "relative",
                  }}
                >
                  <OverlayScrollArea
                    direction="both"
                    style={{ flex: 1, minHeight: 0 }}
                    scrollbarStyle="themed"
                  >
                    <table
                      style={{
                        minWidth: "100%",
                        width: "max-content",
                        borderCollapse: "separate",
                        borderSpacing: 0,
                        fontSize: 12.5,
                        lineHeight: 1.45,
                      }}
                    >
                      <thead
                        style={{
                          position: "sticky",
                          top: 0,
                          zIndex: 1,
                          background: "var(--overlay-bg-card)",
                          boxShadow:
                            "0 1px 0 var(--overlay-explorer-preview-border)",
                        }}
                      >
                        <tr>
                          {tableData.columns.map((columnName) => (
                            <th
                              key={columnName}
                              title={columnName}
                              style={{
                                textAlign: "left",
                                padding: "10px 12px",
                                fontWeight: 700,
                                color: "var(--overlay-text-secondary)",
                                borderRight:
                                  "1px solid var(--overlay-explorer-preview-border)",
                                borderBottom:
                                  "1px solid var(--overlay-explorer-preview-border)",
                                verticalAlign: "bottom",
                                minWidth: isCompactLayout ? 132 : 152,
                                maxWidth: isCompactLayout ? 220 : 280,
                                background: "var(--overlay-bg-card)",
                              }}
                            >
                              <div
                                style={{
                                  whiteSpace: "normal",
                                  wordBreak: "break-word",
                                }}
                              >
                                {columnName}
                              </div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {tableData.rows.length > 0 ? (
                          tableData.rows.map((row, rowIndex) => (
                            <tr
                              key={`${currentPage}-${rowIndex}`}
                              style={{
                                background:
                                  rowIndex % 2 === 0
                                    ? "transparent"
                                    : "rgba(255,255,255,0.018)",
                              }}
                            >
                              {row.map((cell, cellIndex) => {
                                const isNullCell = cell === "NULL";
                                const isBlobCell = cell.startsWith("<Blob:");

                                return (
                                  <td
                                    key={`${rowIndex}-${cellIndex}`}
                                    title={cell}
                                    style={{
                                      padding: "10px 12px",
                                      color: isNullCell
                                        ? "var(--overlay-text-dim)"
                                        : isBlobCell
                                          ? "var(--overlay-text-secondary)"
                                          : "var(--overlay-text-primary)",
                                      borderRight:
                                        "1px solid var(--overlay-explorer-preview-border)",
                                      borderBottom:
                                        "1px solid var(--overlay-explorer-preview-border)",
                                      verticalAlign: "top",
                                      minWidth: isCompactLayout ? 132 : 152,
                                      maxWidth: isCompactLayout ? 220 : 320,
                                      whiteSpace: "pre-wrap",
                                      wordBreak: "break-word",
                                    }}
                                  >
                                    {isNullCell ? (
                                      <span
                                        style={{
                                          display: "inline-flex",
                                          alignItems: "center",
                                          padding: "2px 6px",
                                          borderRadius: 999,
                                          background:
                                            "var(--overlay-explorer-chip-bg)",
                                          border:
                                            "1px solid var(--overlay-explorer-preview-border)",
                                          fontSize: 10,
                                          fontWeight: 700,
                                          letterSpacing: "0.04em",
                                          textTransform: "uppercase",
                                        }}
                                      >
                                        NULL
                                      </span>
                                    ) : (
                                      cell
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td
                              colSpan={tableData.columns.length || 1}
                              style={{
                                padding: 32,
                                textAlign: "center",
                                color: "var(--overlay-text-muted)",
                                borderBottom:
                                  "1px solid var(--overlay-explorer-preview-border)",
                              }}
                            >
                              This table is empty.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </OverlayScrollArea>

                  {loadingData ? (
                    <div
                      style={{
                        position: "absolute",
                        top: 12,
                        right: 12,
                        background: "var(--overlay-bg-card)",
                        border:
                          "1px solid var(--overlay-explorer-preview-border)",
                        padding: 8,
                        borderRadius: 999,
                        boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
                        pointerEvents: "none",
                      }}
                    >
                      <Loader
                        size={14}
                        style={{
                          animation: "spin 1s linear infinite",
                          color: "var(--overlay-text-muted)",
                        }}
                      />
                    </div>
                  ) : null}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
