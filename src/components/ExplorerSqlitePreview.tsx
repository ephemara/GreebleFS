import { useEffect, useState } from "react";
import { Database, Table, Loader, ChevronLeft, ChevronRight, AlertCircle } from "lucide-react";
import { commands, type SqliteDbInfo, type SqliteTablePreview } from "../generated/tauri";

export interface ExplorerSqlitePreviewProps {
  dbPath: string;
  dbName: string;
}

const PAGE_SIZE = 100;

export function ExplorerSqlitePreview({ dbPath, dbName }: ExplorerSqlitePreviewProps) {
  const [info, setInfo] = useState<SqliteDbInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTable, setActiveTable] = useState<string | null>(null);
  
  const [tableData, setTableData] = useState<SqliteTablePreview | null>(null);
  const [page, setPage] = useState(0);
  const [loadingData, setLoadingData] = useState(false);

  useEffect(() => {
    let active = true;
    commands.sqliteGetInfo(dbPath).then(res => {
      if (!active) return;
      if (res.status === "ok") {
        setInfo(res.data);
        if (res.data.tables.length > 0) {
          setActiveTable(res.data.tables[0].name);
        }
      } else {
        setError(res.error);
      }
    });

    return () => { active = false; };
  }, [dbPath]);

  useEffect(() => {
    if (!activeTable) return;
    let active = true;
    setLoadingData(true);
    commands.sqliteQueryTable(dbPath, activeTable, PAGE_SIZE, page * PAGE_SIZE).then(res => {
      if (!active) return;
      setLoadingData(false);
      if (res.status === "ok") {
        setTableData(res.data);
      } else {
        // Fallback for query error (keep old data but you could show an error)
        console.error("Failed to query SQLite table:", res.error);
      }
    });

    return () => { active = false; };
  }, [dbPath, activeTable, page]);

  if (error) {
    return (
      <div style={{ width: "100%", height: "100%", display: "grid", placeItems: "center", background: "var(--overlay-explorer-preview-bg)", color: "var(--overlay-danger)" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
          <AlertCircle size={32} />
          <div style={{ fontWeight: 600 }}>Failed to read database</div>
          <div style={{ fontSize: 12, color: "var(--overlay-text-dim)" }}>{error}</div>
        </div>
      </div>
    );
  }

  if (!info) {
    return (
      <div style={{ width: "100%", height: "100%", display: "grid", placeItems: "center", background: "var(--overlay-explorer-preview-bg)" }}>
        <Loader size={20} style={{ animation: "spin 1s linear infinite", color: "var(--overlay-text-muted)" }} />
      </div>
    );
  }

  return (
    <div style={{ width: "100%", height: "100%", display: "flex", background: "var(--overlay-explorer-preview-bg)", overflow: "hidden", color: "var(--overlay-text-primary)" }}>
      {/* Left Rail - Table List */}
      <div style={{ width: 240, borderRight: "1px solid var(--overlay-explorer-preview-border)", display: "flex", flexDirection: "column", background: "var(--overlay-bg-card)", flexShrink: 0 }}>
         <div style={{ padding: "16px 16px", borderBottom: "1px solid var(--overlay-explorer-preview-border)", display: "flex", alignItems: "center", gap: 12 }}>
            <Database size={16} color="var(--overlay-accent)" />
            <div style={{ fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{dbName}</div>
         </div>
         <div style={{ padding: "12px 16px 8px", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--overlay-text-muted)" }}>
           Tables ({info.tables.length})
         </div>
         <div style={{ flex: 1, overflowY: "auto", padding: "0 8px 16px 8px" }}>
            {info.tables.map(t => (
              <div 
                key={t.name}
                onClick={() => { setActiveTable(t.name); setPage(0); }}
                style={{
                  padding: "8px", 
                  marginBottom: 2,
                  borderRadius: 6,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  background: activeTable === t.name ? "var(--overlay-selection-bg)" : "transparent",
                  color: activeTable === t.name ? "var(--overlay-text-primary)" : "var(--overlay-text-secondary)"
                }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, overflow: "hidden" }}>
                  <Table size={14} style={{ flexShrink: 0, opacity: activeTable === t.name ? 1 : 0.5 }} />
                  <span style={{ fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.name}</span>
                </div>
                <span style={{ fontSize: 11, color: "var(--overlay-text-dim)" }}>{t.row_count}</span>
              </div>
            ))}
            {info.tables.length === 0 && (
              <div style={{ padding: 16, textAlign: "center", color: "var(--overlay-text-dim)", fontSize: 12 }}>
                No tables found in database.
              </div>
            )}
         </div>
      </div>

      {/* Main View - Data Grid */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, position: "relative" }}>
        {activeTable && tableData ? (
          <>
            <div style={{ flex: 1, overflow: "auto", position: "relative" }}>
              <table style={{ minWidth: "100%", width: "max-content", borderCollapse: "collapse", fontSize: 13 }}>
                <thead style={{ position: "sticky", top: 0, background: "var(--overlay-bg-card)", zIndex: 1, boxShadow: "0 1px 0 var(--overlay-explorer-preview-border)" }}>
                  <tr>
                    {tableData.columns.map((c, i) => (
                      <th key={i} style={{ textAlign: "left", padding: "10px 16px", fontWeight: 600, color: "var(--overlay-text-secondary)", borderRight: "1px solid var(--overlay-explorer-preview-border)" }}>
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tableData.rows.map((row, ri) => (
                    <tr key={ri} style={{ borderBottom: "1px solid var(--overlay-explorer-preview-border)" }}>
                      {row.map((cell, ci) => (
                        <td key={ci} style={{ padding: "8px 16px", color: cell === "NULL" ? "var(--overlay-text-dim)" : "var(--overlay-text-primary)", borderRight: "1px solid var(--overlay-explorer-preview-border)", maxWidth: 350, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                  {tableData.rows.length === 0 && (
                    <tr>
                      <td colSpan={tableData.columns.length || 1} style={{ padding: 32, textAlign: "center", color: "var(--overlay-text-muted)" }}>
                        No rows returned.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {loadingData && (
              <div style={{ position: "absolute", top: 16, right: 16, background: "var(--overlay-bg-card)", padding: 6, borderRadius: "50%", boxShadow: "0 4px 12px rgba(0,0,0,0.2)", pointerEvents: "none" }}>
                <Loader size={14} style={{ animation: "spin 1s linear infinite", color: "var(--overlay-text-muted)" }} />
              </div>
            )}
            
            {/* Footer Pagination Controls */}
            <div style={{ padding: "12px 16px", borderTop: "1px solid var(--overlay-explorer-preview-border)", display: "flex", alignItems: "center", gap: 16, background: "var(--overlay-bg-card)" }}>
               <div style={{ flex: 1, fontSize: 12, color: "var(--overlay-text-dim)" }}>
                 Showing {tableData.rows.length > 0 ? page * PAGE_SIZE + 1 : 0} - {page * PAGE_SIZE + tableData.rows.length} 
               </div>
               
               <div style={{ display: "flex", gap: 8 }}>
                 <button 
                   disabled={page === 0}
                   onClick={() => setPage(p => Math.max(0, p - 1))}
                   style={{ padding: "6px 12px", borderRadius: 4, background: "transparent", border: "1px solid var(--overlay-explorer-preview-border)", cursor: page === 0 ? "not-allowed" : "pointer", opacity: page === 0 ? 0.4 : 1, display: "flex", alignItems: "center", gap: 4, color: "var(--overlay-text-primary)", outline: "none" }}>
                   <ChevronLeft size={16} /> Prev
                 </button>
                 <button 
                   disabled={tableData.rows.length < PAGE_SIZE}
                   onClick={() => setPage(p => p + 1)}
                   style={{ padding: "6px 12px", borderRadius: 4, background: "transparent", border: "1px solid var(--overlay-explorer-preview-border)", cursor: tableData.rows.length < PAGE_SIZE ? "not-allowed" : "pointer", opacity: tableData.rows.length < PAGE_SIZE ? 0.4 : 1, display: "flex", alignItems: "center", gap: 4, color: "var(--overlay-text-primary)", outline: "none" }}>
                   Next <ChevronRight size={16} />
                 </button>
               </div>
            </div>
          </>
        ) : (
          <div style={{ flex: 1, display: "grid", placeItems: "center", color: "var(--overlay-text-dim)", fontSize: 13 }}>
             Select a table to view data
          </div>
        )}
      </div>
    </div>
  );
}
