import { useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import Fuse from "fuse.js";
import { Database, FileSearch, Search, X } from "@/components/AppIcons";
import {
  explorerSearchModeLabels,
  type ExplorerSearchModeValue,
} from "../../config/semanticSearch";
import {
  ExplorerBoundedText,
  ExplorerSlateIconButton,
  ExplorerSlatePane,
  ExplorerSlatePaneHeader,
  ExplorerSlateSection,
  ExplorerSlateStatusStrip,
  ExplorerSlateToolbarRow,
  type ExplorerPaneTone,
} from "./ExplorerPanePrimitives";

export interface ExplorerUtilitySearchResult {
  name: string;
  path: string;
  relative_path?: string;
  relativePath?: string;
  is_dir?: boolean;
  snippet?: string;
  line_number?: number | null;
  search_mode?: ExplorerSearchModeValue;
  semantic_score?: number | null;
  match_kind?: string | null;
}

type SearchResultRow =
  | { kind: "group"; id: string; label: string; count: number }
  | { kind: "result"; id: string; result: ExplorerUtilitySearchResult };

function getResultRelativePath(result: ExplorerUtilitySearchResult): string {
  return result.relative_path ?? result.relativePath ?? result.path;
}

function getResultGroupLabel(result: ExplorerUtilitySearchResult): string {
  const relativePath = getResultRelativePath(result);
  const separatorIndex = Math.max(
    relativePath.lastIndexOf("/"),
    relativePath.lastIndexOf("\\"),
  );
  if (separatorIndex <= 0) {
    return ".";
  }
  return relativePath.slice(0, separatorIndex);
}

function buildSearchResultRows(
  results: ExplorerUtilitySearchResult[],
): SearchResultRow[] {
  const rows: SearchResultRow[] = [];
  const grouped = new Map<string, ExplorerUtilitySearchResult[]>();
  for (const result of results) {
    const label = getResultGroupLabel(result);
    const group = grouped.get(label) ?? [];
    group.push(result);
    grouped.set(label, group);
  }
  for (const [label, groupResults] of grouped.entries()) {
    rows.push({
      kind: "group",
      id: `group:${label}`,
      label,
      count: groupResults.length,
    });
    for (const result of groupResults) {
      rows.push({ kind: "result", id: result.path, result });
    }
  }
  return rows;
}

export function ExplorerSearchLane({
  currentPath,
  loading,
  mode,
  onCancel,
  onModeChange,
  onOpenResult,
  onQueryChange,
  onToggleHidden,
  query,
  results,
  showHidden,
  tone,
}: {
  currentPath: string;
  loading: boolean;
  mode: ExplorerSearchModeValue;
  onCancel: () => void;
  onModeChange: (mode: ExplorerSearchModeValue) => void;
  onOpenResult: (result: ExplorerUtilitySearchResult) => void;
  onQueryChange: (query: string) => void;
  onToggleHidden: () => void;
  query: string;
  results: ExplorerUtilitySearchResult[];
  showHidden: boolean;
  tone: ExplorerPaneTone;
}) {
  const [resultFilter, setResultFilter] = useState("");
  const filteredResults = useMemo(() => {
    const trimmedFilter = resultFilter.trim();
    if (!trimmedFilter) {
      return results;
    }
    const fuse = new Fuse(results, {
      ignoreLocation: true,
      includeScore: false,
      keys: ["name", "path", "relative_path", "relativePath", "snippet"],
      threshold: 0.36,
    });
    return fuse.search(trimmedFilter).map((entry) => entry.item);
  }, [resultFilter, results]);
  const rows = useMemo(
    () => buildSearchResultRows(filteredResults),
    [filteredResults],
  );
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const virtualizer = useVirtualizer({
    count: rows.length,
    estimateSize: (index) => (rows[index]?.kind === "group" ? 30 : 68),
    getScrollElement: () => scrollerRef.current,
    overscan: 8,
  });

  return (
    <ExplorerSlatePane tone={tone}>
      <ExplorerSlatePaneHeader
        title="Search"
        subtitle={currentPath}
        tone={tone}
        actions={
          <ExplorerSlateIconButton
            active={loading}
            label={loading ? "Cancel search" : "Clear search"}
            onClick={onCancel}
            tone={tone}
          >
            {loading ? <X size={13} /> : <Search size={13} />}
          </ExplorerSlateIconButton>
        }
      />
      <ExplorerSlateSection tone={tone}>
        <input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Search files"
          style={{
            width: "100%",
            minHeight: 32,
            borderRadius: "var(--overlay-explorer-control-radius)",
            border: `1px solid ${tone.border ?? "var(--overlay-explorer-input-border)"}`,
            background: "var(--overlay-explorer-input-bg)",
            color: tone.text ?? "var(--overlay-text-primary)",
            outline: "none",
            padding: "0 9px",
            fontSize: 12,
          }}
        />
        <ExplorerSlateToolbarRow style={{ padding: 0 }}>
          {(["name", "content", "semantic"] as const).map((candidateMode) => (
            <button
              key={candidateMode}
              type="button"
              aria-pressed={mode === candidateMode}
              onClick={() => onModeChange(candidateMode)}
              style={{
                height: 24,
                borderRadius: "var(--overlay-explorer-control-radius)",
                border: `1px solid ${mode === candidateMode ? tone.accent : tone.border ?? "var(--overlay-explorer-chip-border)"}`,
                background:
                  mode === candidateMode
                    ? "var(--overlay-explorer-chip-active-bg)"
                    : "var(--overlay-explorer-chip-bg)",
                color:
                  mode === candidateMode
                    ? tone.accent
                    : tone.muted ?? "var(--overlay-text-muted)",
                cursor: "pointer",
                fontSize: 10,
                fontWeight: 800,
                padding: "0 8px",
              }}
            >
              {explorerSearchModeLabels[candidateMode]}
            </button>
          ))}
          <button
            type="button"
            aria-pressed={showHidden}
            onClick={onToggleHidden}
            style={{
              height: 24,
              borderRadius: "var(--overlay-explorer-control-radius)",
              border: `1px solid ${showHidden ? tone.accent : tone.border ?? "var(--overlay-explorer-chip-border)"}`,
              background: showHidden
                ? "var(--overlay-explorer-chip-active-bg)"
                : "var(--overlay-explorer-chip-bg)",
              color: showHidden
                ? tone.accent
                : tone.muted ?? "var(--overlay-text-muted)",
              cursor: "pointer",
              fontSize: 10,
              fontWeight: 800,
              padding: "0 8px",
            }}
          >
            Hidden
          </button>
        </ExplorerSlateToolbarRow>
      </ExplorerSlateSection>
      <ExplorerSlateSection title="Loaded Results" tone={tone}>
        <input
          value={resultFilter}
          onChange={(event) => setResultFilter(event.target.value)}
          placeholder="Filter loaded results"
          style={{
            width: "100%",
            minHeight: 28,
            borderRadius: "var(--overlay-explorer-control-radius)",
            border: `1px solid ${tone.border ?? "var(--overlay-explorer-input-border)"}`,
            background: "var(--overlay-explorer-input-bg)",
            color: tone.text ?? "var(--overlay-text-primary)",
            outline: "none",
            padding: "0 8px",
            fontSize: 11,
          }}
        />
      </ExplorerSlateSection>
      <div
        ref={scrollerRef}
        style={{
          flex: 1,
          minHeight: 0,
          overflow: "auto",
          borderTop: `1px solid ${tone.border ?? "var(--overlay-explorer-toolbar-border)"}`,
        }}
      >
        <div
          style={{
            height: virtualizer.getTotalSize(),
            position: "relative",
            width: "100%",
          }}
        >
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const row = rows[virtualRow.index];
            if (!row) {
              return null;
            }
            return (
              <div
                key={row.id}
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  top: 0,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                {row.kind === "group" ? (
                  <div
                    style={{
                      height: 30,
                      display: "grid",
                      gridTemplateColumns: "minmax(0, 1fr) auto",
                      alignItems: "center",
                      gap: 8,
                      padding: "0 10px",
                      color: tone.muted ?? "var(--overlay-text-muted)",
                      fontSize: 10,
                      fontWeight: 800,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                    }}
                  >
                    <ExplorerBoundedText lines={1}>{row.label}</ExplorerBoundedText>
                    <span>{row.count}</span>
                  </div>
                ) : (
                  <button
                    type="button"
                    title={row.result.path}
                    onClick={() => onOpenResult(row.result)}
                    style={{
                      width: "100%",
                      minHeight: 68,
                      display: "grid",
                      gridTemplateColumns: "22px minmax(0, 1fr)",
                      gap: 8,
                      alignItems: "start",
                      padding: "8px 10px",
                      border: 0,
                      borderBottom: `1px solid ${tone.border ?? "var(--overlay-explorer-toolbar-border)"}`,
                      background: "transparent",
                      color: tone.text ?? "var(--overlay-text-primary)",
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                  >
                    {row.result.search_mode === "semantic" ? (
                      <Database size={14} style={{ color: tone.accent, marginTop: 2 }} />
                    ) : (
                      <FileSearch size={14} style={{ color: tone.accent, marginTop: 2 }} />
                    )}
                    <span style={{ minWidth: 0 }}>
                      <ExplorerBoundedText
                        lines={1}
                        style={{ fontSize: 12, fontWeight: 750 }}
                      >
                        {row.result.name}
                      </ExplorerBoundedText>
                      <ExplorerBoundedText
                        lines={1}
                        style={{
                          marginTop: 2,
                          color: tone.muted ?? "var(--overlay-text-muted)",
                          fontSize: 10,
                        }}
                      >
                        {getResultRelativePath(row.result)}
                      </ExplorerBoundedText>
                      {row.result.snippet ? (
                        <ExplorerBoundedText
                          lines={2}
                          style={{
                            marginTop: 4,
                            color: tone.muted ?? "var(--overlay-text-muted)",
                            fontSize: 10,
                            lineHeight: 1.35,
                          }}
                        >
                          {row.result.snippet}
                        </ExplorerBoundedText>
                      ) : null}
                    </span>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
      <ExplorerSlateStatusStrip tone={tone}>
        <span>{filteredResults.length} results</span>
        <span>{loading ? "Searching" : mode}</span>
      </ExplorerSlateStatusStrip>
    </ExplorerSlatePane>
  );
}
