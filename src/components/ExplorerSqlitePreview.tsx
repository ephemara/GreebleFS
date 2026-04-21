import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type UIEventHandler,
} from "react";
import { AlertCircle, Loader, Search, Table } from '@/components/AppIcons';
import type { SqliteDbInfo, SqliteTableInfo } from "../generated/tauri";
import { commands, type SqliteSortDirection } from "../runtime/tauriClient";
import { OverlayScrollArea } from "./OverlayScrollArea";

export interface ExplorerSqlitePreviewProps {
  dbPath: string;
  dbName: string;
}

type SqliteRowViewMode = "dense" | "comfortable" | "wrap";

type SqliteRowViewPreset = {
  tableFontSize: number;
  rowLineHeight: number;
  headerPadding: string;
  cellPadding: string;
  minWidthCompact: number;
  minWidthWide: number;
  maxWidthCompact: number;
  maxWidthWide: number;
  whiteSpace: "nowrap" | "pre-wrap";
  wordBreak: "normal" | "break-word";
  overflow: "hidden" | "visible";
  textOverflow: "ellipsis" | "clip";
};

const SQLITE_STREAM_CHUNK_SIZE = 400;
const SQLITE_STREAM_THRESHOLD_PX = 320;
const COMPACT_LAYOUT_BREAKPOINT_PX = 760;

const SQLITE_ROW_VIEW_PRESETS: Record<SqliteRowViewMode, SqliteRowViewPreset> =
  {
    dense: {
      tableFontSize: 11.5,
      rowLineHeight: 1.25,
      headerPadding: "7px 8px",
      cellPadding: "6px 8px",
      minWidthCompact: 88,
      minWidthWide: 108,
      maxWidthCompact: 150,
      maxWidthWide: 220,
      whiteSpace: "nowrap",
      wordBreak: "normal",
      overflow: "hidden",
      textOverflow: "ellipsis",
    },
    comfortable: {
      tableFontSize: 12.5,
      rowLineHeight: 1.4,
      headerPadding: "9px 10px",
      cellPadding: "8px 10px",
      minWidthCompact: 108,
      minWidthWide: 132,
      maxWidthCompact: 188,
      maxWidthWide: 260,
      whiteSpace: "nowrap",
      wordBreak: "normal",
      overflow: "hidden",
      textOverflow: "ellipsis",
    },
    wrap: {
      tableFontSize: 12.5,
      rowLineHeight: 1.45,
      headerPadding: "9px 10px",
      cellPadding: "8px 10px",
      minWidthCompact: 116,
      minWidthWide: 148,
      maxWidthCompact: 220,
      maxWidthWide: 320,
      whiteSpace: "pre-wrap",
      wordBreak: "break-word",
      overflow: "visible",
      textOverflow: "clip",
    },
  };

const SQLITE_ROW_VIEW_OPTIONS: Array<{
  id: SqliteRowViewMode;
  label: string;
}> = [
  { id: "dense", label: "Dense" },
  { id: "comfortable", label: "Table" },
  { id: "wrap", label: "Wrap" },
];

const integerFormatter = new Intl.NumberFormat();

function formatInteger(value: number): string {
  return integerFormatter.format(Math.max(0, Math.trunc(value)));
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
  dbName: _dbName,
}: ExplorerSqlitePreviewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const tableViewportRef = useRef<HTMLDivElement | null>(null);
  const queryRevisionRef = useRef(0);
  const pendingAppendOffsetRef = useRef<number | null>(null);

  const [info, setInfo] = useState<SqliteDbInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTable, setActiveTable] = useState<string | null>(null);
  const [tableColumns, setTableColumns] = useState<string[]>([]);
  const [tableRows, setTableRows] = useState<string[][]>([]);
  const [tableQueryError, setTableQueryError] = useState<string | null>(null);
  const [totalRows, setTotalRows] = useState(0);
  const [filteredRows, setFilteredRows] = useState(0);
  const [nextOffset, setNextOffset] = useState<number | null>(null);
  const [loadingInitialRows, setLoadingInitialRows] = useState(false);
  const [loadingMoreRows, setLoadingMoreRows] = useState(false);
  const [containerWidth, setContainerWidth] = useState<number | null>(null);
  const [searchText, setSearchText] = useState("");
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] =
    useState<SqliteSortDirection | null>(null);
  const [rowViewMode, setRowViewMode] = useState<SqliteRowViewMode>("dense");

  const deferredSearchText = useDeferredValue(searchText.trim());

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
    setTableColumns([]);
    setTableRows([]);
    setTableQueryError(null);
    setTotalRows(0);
    setFilteredRows(0);
    setNextOffset(null);
    setLoadingInitialRows(false);
    setLoadingMoreRows(false);
    setSearchText("");
    setSortColumn(null);
    setSortDirection(null);
    queryRevisionRef.current += 1;
    pendingAppendOffsetRef.current = null;

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

  const layoutMode = resolveSqlitePreviewLayout(containerWidth);
  const isCompactLayout = layoutMode === "compact";
  const rowViewPreset = SQLITE_ROW_VIEW_PRESETS[rowViewMode];

  const activeTableInfo = useMemo<SqliteTableInfo | null>(
    () => info?.tables.find((table) => table.name === activeTable) ?? null,
    [activeTable, info],
  );

  const hasActiveSearch = deferredSearchText.length > 0;
  const visibleRowCount = hasActiveSearch ? filteredRows : totalRows;
  const loadedRowCount = tableRows.length;

  const queryTableWindow = useCallback(
    async (offset: number, replace: boolean, revision: number) => {
      if (!activeTable) {
        return;
      }

      if (replace) {
        setLoadingInitialRows(true);
        setLoadingMoreRows(false);
        pendingAppendOffsetRef.current = null;
      } else {
        if (pendingAppendOffsetRef.current === offset) {
          return;
        }
        pendingAppendOffsetRef.current = offset;
        setLoadingMoreRows(true);
      }

      try {
        const result = await commands.sqliteQueryTableWindow({
          path: dbPath,
          tableName: activeTable,
          limit: SQLITE_STREAM_CHUNK_SIZE,
          offset,
          searchText: deferredSearchText.length > 0 ? deferredSearchText : null,
          sortColumn,
          sortDirection,
        });

        if (revision !== queryRevisionRef.current) {
          return;
        }

        if (result.status === "ok") {
          setTableColumns(result.data.columns);
          setTableRows((currentRows) =>
            replace ? result.data.rows : [...currentRows, ...result.data.rows],
          );
          setTotalRows(result.data.totalRows);
          setFilteredRows(result.data.filteredRows);
          setNextOffset(result.data.nextOffset);
          setTableQueryError(null);
        } else {
          if (replace) {
            setTableColumns([]);
            setTableRows([]);
            setTotalRows(activeTableInfo?.row_count ?? 0);
            setFilteredRows(0);
          }
          setNextOffset(null);
          setTableQueryError(result.error);
        }
      } catch (queryError) {
        if (revision !== queryRevisionRef.current) {
          return;
        }

        if (replace) {
          setTableColumns([]);
          setTableRows([]);
          setTotalRows(activeTableInfo?.row_count ?? 0);
          setFilteredRows(0);
        }
        setNextOffset(null);
        setTableQueryError(String(queryError));
      } finally {
        if (revision === queryRevisionRef.current) {
          if (replace) {
            setLoadingInitialRows(false);
          } else {
            setLoadingMoreRows(false);
            pendingAppendOffsetRef.current = null;
          }
        }
      }
    },
    [
      activeTable,
      activeTableInfo?.row_count,
      dbPath,
      deferredSearchText,
      sortColumn,
      sortDirection,
    ],
  );

  useEffect(() => {
    if (!activeTable) {
      setTableColumns([]);
      setTableRows([]);
      setTableQueryError(null);
      setTotalRows(0);
      setFilteredRows(0);
      setNextOffset(null);
      setLoadingInitialRows(false);
      setLoadingMoreRows(false);
      pendingAppendOffsetRef.current = null;
      return;
    }

    const nextRevision = queryRevisionRef.current + 1;
    queryRevisionRef.current = nextRevision;
    pendingAppendOffsetRef.current = null;

    setTableColumns([]);
    setTableRows([]);
    setTableQueryError(null);
    setTotalRows(activeTableInfo?.row_count ?? 0);
    setFilteredRows(activeTableInfo?.row_count ?? 0);
    setNextOffset(null);
    setLoadingMoreRows(false);
    if (tableViewportRef.current) {
      if (typeof tableViewportRef.current.scrollTo === "function") {
        tableViewportRef.current.scrollTo({ top: 0, left: 0 });
      } else {
        tableViewportRef.current.scrollTop = 0;
        tableViewportRef.current.scrollLeft = 0;
      }
    }

    void queryTableWindow(0, true, nextRevision);
  }, [
    activeTable,
    activeTableInfo?.row_count,
    deferredSearchText,
    queryTableWindow,
    sortColumn,
    sortDirection,
  ]);

  const handleSelectTable = useCallback((tableName: string) => {
    setActiveTable(tableName);
    setSearchText("");
    setSortColumn(null);
    setSortDirection(null);
    setTableQueryError(null);
    setTableColumns([]);
    setTableRows([]);
    setNextOffset(null);
    setLoadingMoreRows(false);
    pendingAppendOffsetRef.current = null;
  }, []);

  const handleToggleSort = useCallback(
    (columnName: string) => {
      if (sortColumn !== columnName) {
        setSortColumn(columnName);
        setSortDirection("asc");
        return;
      }

      if (sortDirection === "asc") {
        setSortDirection("desc");
        return;
      }

      setSortColumn(null);
      setSortDirection(null);
    },
    [sortColumn, sortDirection],
  );

  const requestMoreRows = useCallback(() => {
    if (
      nextOffset == null ||
      loadingInitialRows ||
      loadingMoreRows ||
      !activeTable
    ) {
      return;
    }

    void queryTableWindow(nextOffset, false, queryRevisionRef.current);
  }, [
    activeTable,
    loadingInitialRows,
    loadingMoreRows,
    nextOffset,
    queryTableWindow,
  ]);

  const handleTableViewportScroll = useCallback<UIEventHandler<HTMLDivElement>>(
    (event) => {
      if (
        nextOffset == null ||
        loadingInitialRows ||
        loadingMoreRows ||
        tableQueryError
      ) {
        return;
      }

      const viewport = event.currentTarget;
      const remainingScrollDistance =
        viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;

      if (remainingScrollDistance <= SQLITE_STREAM_THRESHOLD_PX) {
        requestMoreRows();
      }
    },
    [
      loadingInitialRows,
      loadingMoreRows,
      nextOffset,
      requestMoreRows,
      tableQueryError,
    ],
  );

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
      aria-label={`${_dbName} SQLite preview`}
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
        <>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 8,
              padding: "8px 12px 10px",
              borderBottom: "1px solid var(--overlay-explorer-preview-border)",
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
                      minWidth: isCompactLayout ? 146 : 172,
                      maxWidth: isCompactLayout ? 192 : 228,
                      border:
                        "1px solid var(--overlay-explorer-preview-border)",
                      borderRadius: 999,
                      padding: "7px 10px",
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
                  Pick a user table to inspect, filter, and sort it.
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
                        formatInteger(tableColumns.length),
                      )}
                      {renderMetricPill(
                        hasActiveSearch ? "Matches" : "Rows",
                        formatInteger(visibleRowCount),
                      )}
                      {renderMetricPill(
                        "Loaded",
                        formatInteger(loadedRowCount),
                      )}
                      {sortColumn && sortDirection
                        ? renderMetricPill(
                            "Sort",
                            `${sortColumn} ${sortDirection === "desc" ? "↓" : "↑"}`,
                          )
                        : null}
                      {loadingMoreRows
                        ? renderMetricPill("Stream", "Loading")
                        : null}
                    </div>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      flexWrap: isCompactLayout ? "wrap" : "nowrap",
                      justifyContent: isCompactLayout
                        ? "flex-start"
                        : "flex-end",
                    }}
                  >
                    <label
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 8,
                        minWidth: isCompactLayout ? "100%" : 230,
                        padding: "6px 9px",
                        borderRadius: 10,
                        border:
                          "1px solid var(--overlay-explorer-preview-border)",
                        background: "var(--overlay-explorer-chip-bg)",
                      }}
                    >
                      <Search
                        size={14}
                        style={{
                          flexShrink: 0,
                          color: "var(--overlay-text-dim)",
                        }}
                      />
                      <input
                        value={searchText}
                        onChange={(event) =>
                          setSearchText(event.currentTarget.value)
                        }
                        placeholder="Search rows in this table"
                        style={{
                          border: "none",
                          outline: "none",
                          background: "transparent",
                          color: "var(--overlay-text-primary)",
                          fontSize: 12,
                          width: "100%",
                          minWidth: 0,
                        }}
                      />
                      {searchText.length > 0 ? (
                        <button
                          type="button"
                          onClick={() => setSearchText("")}
                          style={{
                            border: "none",
                            background: "transparent",
                            color: "var(--overlay-text-dim)",
                            cursor: "pointer",
                            fontSize: 10,
                            padding: 0,
                            flexShrink: 0,
                          }}
                        >
                          Clear
                        </button>
                      ) : null}
                    </label>

                    <div
                      role="group"
                      aria-label="SQLite row view"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        borderRadius: 10,
                        border:
                          "1px solid var(--overlay-explorer-preview-border)",
                        background: "var(--overlay-explorer-chip-bg)",
                        overflow: "hidden",
                      }}
                    >
                      {SQLITE_ROW_VIEW_OPTIONS.map((option) => {
                        const isActive = rowViewMode === option.id;

                        return (
                          <button
                            key={option.id}
                            type="button"
                            onClick={() => setRowViewMode(option.id)}
                            style={{
                              border: "none",
                              background: isActive
                                ? "var(--overlay-selection-bg)"
                                : "transparent",
                              color: isActive
                                ? "var(--overlay-text-primary)"
                                : "var(--overlay-text-secondary)",
                              cursor: "pointer",
                              fontSize: 10,
                              fontWeight: 700,
                              letterSpacing: "0.05em",
                              textTransform: "uppercase",
                              padding: "7px 9px",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {option.label}
                          </button>
                        );
                      })}
                    </div>

                    {nextOffset != null ? (
                      <button
                        type="button"
                        onClick={requestMoreRows}
                        disabled={loadingMoreRows}
                        style={{
                          padding: "6px 9px",
                          borderRadius: 8,
                          background: "transparent",
                          border:
                            "1px solid var(--overlay-explorer-preview-border)",
                          cursor: loadingMoreRows ? "wait" : "pointer",
                          color: "var(--overlay-text-primary)",
                          fontSize: 11,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {loadingMoreRows ? "Loading…" : "Load More"}
                      </button>
                    ) : null}
                  </div>
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
              ) : loadingInitialRows && loadedRowCount === 0 ? (
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
                      style={{ animation: "spin 1s linear infinite" }}
                    />
                    <div style={{ fontSize: 12 }}>Loading table rows…</div>
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
                    viewportClassName="sqlite-preview__table-viewport"
                    viewportRef={tableViewportRef}
                    onViewportScroll={handleTableViewportScroll}
                    scrollbarStyle="themed"
                  >
                    <table
                      style={{
                        minWidth: "100%",
                        width: "max-content",
                        borderCollapse: "separate",
                        borderSpacing: 0,
                        fontSize: rowViewPreset.tableFontSize,
                        lineHeight: rowViewPreset.rowLineHeight,
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
                          {tableColumns.map((columnName) => {
                            const isSorted = sortColumn === columnName;
                            const sortIndicator =
                              sortDirection === "desc" ? "↓" : "↑";

                            return (
                              <th
                                key={columnName}
                                title={columnName}
                                style={{
                                  textAlign: "left",
                                  padding: rowViewPreset.headerPadding,
                                  fontWeight: 700,
                                  color: "var(--overlay-text-secondary)",
                                  borderRight:
                                    "1px solid var(--overlay-explorer-preview-border)",
                                  borderBottom:
                                    "1px solid var(--overlay-explorer-preview-border)",
                                  verticalAlign: "bottom",
                                  minWidth: isCompactLayout
                                    ? rowViewPreset.minWidthCompact
                                    : rowViewPreset.minWidthWide,
                                  maxWidth: isCompactLayout
                                    ? rowViewPreset.maxWidthCompact
                                    : rowViewPreset.maxWidthWide,
                                  background: "var(--overlay-bg-card)",
                                }}
                              >
                                <button
                                  type="button"
                                  onClick={() => handleToggleSort(columnName)}
                                  style={{
                                    border: "none",
                                    background: "transparent",
                                    color: "inherit",
                                    padding: 0,
                                    margin: 0,
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 6,
                                    cursor: "pointer",
                                    maxWidth: "100%",
                                  }}
                                >
                                  <span
                                    style={{
                                      overflow: "hidden",
                                      textOverflow: "ellipsis",
                                      whiteSpace: "nowrap",
                                    }}
                                  >
                                    {columnName}
                                  </span>
                                  <span
                                    style={{
                                      fontSize: 10,
                                      color: isSorted
                                        ? "var(--overlay-text-primary)"
                                        : "var(--overlay-text-dim)",
                                      flexShrink: 0,
                                    }}
                                  >
                                    {isSorted ? sortIndicator : "↕"}
                                  </span>
                                </button>
                              </th>
                            );
                          })}
                        </tr>
                      </thead>
                      <tbody>
                        {tableRows.length > 0 ? (
                          tableRows.map((row, rowIndex) => (
                            <tr
                              key={`${rowIndex}-${row[0] ?? "row"}`}
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
                                      padding: rowViewPreset.cellPadding,
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
                                      minWidth: isCompactLayout
                                        ? rowViewPreset.minWidthCompact
                                        : rowViewPreset.minWidthWide,
                                      maxWidth: isCompactLayout
                                        ? rowViewPreset.maxWidthCompact
                                        : rowViewPreset.maxWidthWide,
                                      whiteSpace: rowViewPreset.whiteSpace,
                                      wordBreak: rowViewPreset.wordBreak,
                                      overflow: rowViewPreset.overflow,
                                      textOverflow: rowViewPreset.textOverflow,
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
                              colSpan={Math.max(1, tableColumns.length)}
                              style={{
                                padding: 32,
                                textAlign: "center",
                                color: "var(--overlay-text-muted)",
                                borderBottom:
                                  "1px solid var(--overlay-explorer-preview-border)",
                              }}
                            >
                              {hasActiveSearch
                                ? `No rows matched “${deferredSearchText}”.`
                                : `This table is empty.`}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </OverlayScrollArea>

                  {(loadingMoreRows || loadingInitialRows) &&
                  tableRows.length > 0 ? (
                    <div
                      style={{
                        position: "absolute",
                        top: 10,
                        right: 10,
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
        </>
      )}
    </div>
  );
}
