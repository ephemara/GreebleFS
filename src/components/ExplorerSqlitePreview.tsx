import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Database,
  Loader,
  Table,
} from "@/components/AppIcons";
import {
  commands,
  type SqliteDbInfo,
  type SqliteTableInfo,
  type SqliteTablePreview,
} from "../generated/tauri";
import {
  ExplorerTablePreviewActionButton,
  ExplorerTablePreviewCenteredStatus,
  ExplorerTablePreviewCollectionButton,
  ExplorerTablePreviewCollectionStrip,
  ExplorerTablePreviewDatasetHeader,
  ExplorerTablePreviewGrid,
  ExplorerTablePreviewIdentityHeader,
  ExplorerTablePreviewSurface,
  resolveExplorerTablePreviewLayout,
  useExplorerTablePreviewLayout,
  type ExplorerTablePreviewCell,
  type ExplorerTablePreviewColumn,
  type ExplorerTablePreviewMetric,
  type ExplorerTablePreviewRow,
} from "./explorer/ExplorerTablePreviewSurface";

export interface ExplorerSqlitePreviewProps {
  dbPath: string;
  dbName: string;
}

const PAGE_SIZE = 100;

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

export function resolveSqlitePreviewLayout(
  containerWidth: number | null,
): "compact" | "wide" {
  return resolveExplorerTablePreviewLayout(containerWidth);
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

  const layoutMode = useExplorerTablePreviewLayout(containerRef);
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

  const identityMetrics = useMemo<ExplorerTablePreviewMetric[]>(
    () => [
      { label: "Tables", value: formatInteger(info?.tables.length ?? 0) },
      { label: "Page Size", value: formatInteger(PAGE_SIZE) },
      ...(activeTableInfo
        ? [
            {
              label: "Active Rows",
              value: formatInteger(activeTableInfo.row_count),
            },
          ]
        : []),
    ],
    [activeTableInfo, info?.tables.length],
  );

  const activeTableMetrics = useMemo<ExplorerTablePreviewMetric[]>(
    () => [
      { label: "Columns", value: formatInteger(tableData?.columns.length ?? 0) },
      { label: "Rows", value: formatInteger(totalRows) },
      { label: "Page", value: `${currentPage + 1} / ${totalPages}` },
    ],
    [currentPage, tableData?.columns.length, totalPages, totalRows],
  );

  const tableColumns = useMemo<ExplorerTablePreviewColumn[]>(
    () =>
      (tableData?.columns ?? []).map((columnName) => ({
        id: columnName,
        label: columnName,
        title: columnName,
        minWidth: isCompactLayout ? 132 : 152,
        maxWidth: isCompactLayout ? 220 : 280,
      })),
    [isCompactLayout, tableData?.columns],
  );

  const tableRows = useMemo<ExplorerTablePreviewRow[]>(
    () =>
      (tableData?.rows ?? []).map((row, rowIndex) => ({
        id: `${currentPage}-${rowIndex}`,
        cells: row.map((cell, cellIndex) => {
          const isNullCell = cell === "NULL";
          const isBlobCell = cell.startsWith("<Blob:");

          return {
            key: `${rowIndex}-${cellIndex}`,
            title: cell,
            tone: isNullCell ? "muted" : isBlobCell ? "secondary" : "default",
            content: isNullCell ? (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  padding: "2px 6px",
                  borderRadius: 999,
                  background: "var(--overlay-explorer-chip-bg)",
                  border: "1px solid var(--overlay-explorer-preview-border)",
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
            ),
          } satisfies ExplorerTablePreviewCell;
        }),
      })),
    [currentPage, tableData?.rows],
  );

  const handleSelectTable = (tableName: string) => {
    setActiveTable(tableName);
    setPage(0);
    setTableData(null);
    setTableQueryError(null);
  };

  if (error) {
    return (
      <ExplorerTablePreviewSurface>
        <ExplorerTablePreviewCenteredStatus textColor="var(--overlay-danger)">
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
        </ExplorerTablePreviewCenteredStatus>
      </ExplorerTablePreviewSurface>
    );
  }

  if (!info) {
    return (
      <ExplorerTablePreviewSurface>
        <ExplorerTablePreviewCenteredStatus>
          <Loader
            aria-label="Loading SQLite preview"
            size={20}
            style={{
              animation: "spin 1s linear infinite",
              color: "var(--overlay-text-muted)",
            }}
          />
        </ExplorerTablePreviewCenteredStatus>
      </ExplorerTablePreviewSurface>
    );
  }

  return (
    <ExplorerTablePreviewSurface
      containerRef={containerRef}
      layoutMode={layoutMode}
    >
      <ExplorerTablePreviewIdentityHeader
        icon={<Database size={16} />}
        title={<span title={dbName}>{dbName}</span>}
        subtitle={<span title={dbPath}>{dbPath}</span>}
        metrics={identityMetrics}
      />
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
            <ExplorerTablePreviewCenteredStatus>
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
              </div>
            </ExplorerTablePreviewCenteredStatus>
          ) : (
            <ExplorerTablePreviewCollectionStrip
              label="Tables"
              meta={`${formatInteger(info.tables.length)} total`}
            >
              {info.tables.map((table) => {
                const isActive = table.name === activeTable;

                return (
                  <ExplorerTablePreviewCollectionButton
                    key={table.name}
                    active={isActive}
                    icon={<Table size={13} />}
                    label={table.name}
                    detail={formatInteger(table.row_count)}
                    title={`${table.name} · ${formatInteger(table.row_count)} rows`}
                    layoutMode={layoutMode}
                    onClick={() => handleSelectTable(table.name)}
                  />
                );
              })}
            </ExplorerTablePreviewCollectionStrip>
          )}

          {!activeTable ? (
            <ExplorerTablePreviewCenteredStatus>
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
              </div>
            </ExplorerTablePreviewCenteredStatus>
          ) : (
            <>
              <ExplorerTablePreviewDatasetHeader
                icon={<Table size={16} />}
                title={<span title={activeTable}>{activeTable}</span>}
                metrics={activeTableMetrics}
                layoutMode={layoutMode}
                actions={
                  <>
                    <ExplorerTablePreviewActionButton
                      ariaLabel="Previous SQLite page"
                      disabled={!hasPreviousPage}
                      onClick={() =>
                        setPage((current) => Math.max(0, current - 1))
                      }
                    >
                      <ChevronLeft size={16} />
                      Prev
                    </ExplorerTablePreviewActionButton>
                    <ExplorerTablePreviewActionButton
                      ariaLabel="Next SQLite page"
                      disabled={!hasNextPage}
                      onClick={() => setPage((current) => current + 1)}
                    >
                      Next
                      <ChevronRight size={16} />
                    </ExplorerTablePreviewActionButton>
                  </>
                }
                footer={
                  <>
                    <span style={{ whiteSpace: "nowrap" }}>
                      {formatVisibleRangeLabel(currentPage, rowsOnPage, totalRows)}
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
                  </>
                }
              />

              {tableQueryError ? (
                <ExplorerTablePreviewCenteredStatus textColor="var(--overlay-danger)">
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
                  </div>
                </ExplorerTablePreviewCenteredStatus>
              ) : !tableData ? (
                <ExplorerTablePreviewCenteredStatus>
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
                  </div>
                </ExplorerTablePreviewCenteredStatus>
              ) : (
                <ExplorerTablePreviewGrid
                  columns={tableColumns}
                  rows={tableRows}
                  emptyState="This table is empty."
                  overlay={
                    loadingData ? (
                      <div
                        style={{
                          background: "var(--overlay-bg-card)",
                          border: "1px solid var(--overlay-explorer-preview-border)",
                          padding: 8,
                          borderRadius: 999,
                          boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
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
                    ) : null
                  }
                />
              )}
            </>
          )}
        </div>
      </div>
    </ExplorerTablePreviewSurface>
  );
}
