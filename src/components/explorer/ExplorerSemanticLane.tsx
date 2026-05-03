import { Database, RefreshCw, RotateCcw, Search, Sparkles, Trash2 } from "@/components/AppIcons";
import type { CSSProperties } from "react";
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

export interface ExplorerSemanticLaneSummary {
  indexed: boolean;
  stale: boolean;
  fileCount: number;
  chunkCount: number;
  indexedAt: number | null;
  modelId: string | null;
  backendKind: string | null;
  providerKind: string | null;
}

export interface ExplorerSemanticLaneDiagnostics {
  indexedFileCount: number;
  indexedChunkCount: number;
  queryKind: string;
  staleIndex: boolean;
}

export function ExplorerSemanticLane({
  currentPath,
  diagnostics,
  onBuild,
  onClear,
  onFindSimilar,
  onQueryChange,
  onRebuild,
  query,
  selectedPath,
  statusLabel,
  summary,
  tone,
}: {
  currentPath: string;
  diagnostics: ExplorerSemanticLaneDiagnostics | null;
  onBuild: () => void;
  onClear: () => void;
  onFindSimilar: () => void;
  onQueryChange: (query: string) => void;
  onRebuild: () => void;
  query: string;
  selectedPath: string | null;
  statusLabel: string;
  summary: ExplorerSemanticLaneSummary | null;
  tone: ExplorerPaneTone;
}) {
  const canFindSimilar = Boolean(selectedPath);
  return (
    <ExplorerSlatePane tone={tone}>
      <ExplorerSlatePaneHeader
        title="Semantic"
        subtitle={currentPath}
        tone={tone}
        actions={
          <ExplorerSlateIconButton label="Refresh index status" onClick={onRebuild} tone={tone}>
            <RefreshCw size={13} />
          </ExplorerSlateIconButton>
        }
      />
      <ExplorerSlateSection title="Index" tone={tone}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "24px minmax(0, 1fr)",
            gap: 9,
            alignItems: "start",
            padding: 10,
            borderRadius: "var(--overlay-explorer-control-radius)",
            border: `1px solid ${tone.border ?? "var(--overlay-explorer-chip-border)"}`,
            background: "var(--overlay-explorer-chip-bg)",
          }}
        >
          <Database size={16} style={{ color: tone.accent, marginTop: 1 }} />
          <div style={{ minWidth: 0 }}>
            <ExplorerBoundedText
              lines={2}
              style={{
                color: tone.text ?? "var(--overlay-text-primary)",
                fontSize: 12,
                fontWeight: 750,
              }}
            >
              {statusLabel}
            </ExplorerBoundedText>
            <ExplorerBoundedText
              lines={2}
              style={{
                marginTop: 4,
                color: tone.muted ?? "var(--overlay-text-muted)",
                fontSize: 10,
                lineHeight: 1.35,
              }}
            >
              {summary
                ? `${summary.modelId} / ${summary.backendKind || "backend"} / ${summary.providerKind || "provider"}`
                : "No semantic index has been resolved for this folder yet."}
            </ExplorerBoundedText>
          </div>
        </div>
        <ExplorerSlateToolbarRow style={{ padding: 0 }}>
          <button
            type="button"
            onClick={onBuild}
            style={semanticButtonStyle(tone, true)}
          >
            <Sparkles size={12} /> Index This Folder
          </button>
          <button type="button" onClick={onRebuild} style={semanticButtonStyle(tone, false)}>
            <RotateCcw size={12} /> Rebuild
          </button>
          <button type="button" onClick={onClear} style={semanticButtonStyle(tone, false)}>
            <Trash2 size={12} /> Clear
          </button>
        </ExplorerSlateToolbarRow>
      </ExplorerSlateSection>
      <ExplorerSlateSection title="Semantic Search" tone={tone}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1fr) 32px",
            gap: 6,
          }}
        >
          <input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Meaning search"
            style={{
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
          <ExplorerSlateIconButton active label="Semantic search" tone={tone}>
            <Search size={13} />
          </ExplorerSlateIconButton>
        </div>
        <button
          type="button"
          disabled={!canFindSimilar}
          onClick={onFindSimilar}
          style={{
            ...semanticButtonStyle(tone, canFindSimilar),
            width: "100%",
            justifyContent: "center",
            opacity: canFindSimilar ? 1 : 0.45,
            cursor: canFindSimilar ? "pointer" : "default",
          }}
        >
          <Sparkles size={12} /> Find Similar
        </button>
      </ExplorerSlateSection>
      <ExplorerSlateSection title="Last Query" tone={tone}>
        <div
          style={{
            display: "grid",
            gap: 5,
            color: tone.muted ?? "var(--overlay-text-muted)",
            fontSize: 10,
            lineHeight: 1.4,
          }}
        >
          <ExplorerBoundedText lines={1}>
            {diagnostics
              ? `${diagnostics.queryKind} / ${diagnostics.indexedFileCount} files`
              : "No semantic query has run in this lane yet."}
          </ExplorerBoundedText>
          <ExplorerBoundedText lines={1}>
            {diagnostics
              ? `${diagnostics.indexedChunkCount} chunks${diagnostics.staleIndex ? " / stale" : ""}`
              : selectedPath ?? "Select a text/code result to search by similarity."}
          </ExplorerBoundedText>
        </div>
      </ExplorerSlateSection>
      <ExplorerSlateStatusStrip tone={tone}>
        <span>{summary?.indexed ? "Indexed" : "Not indexed"}</span>
        <span>{summary?.stale ? "Stale" : "Ready"}</span>
      </ExplorerSlateStatusStrip>
    </ExplorerSlatePane>
  );
}

function semanticButtonStyle(tone: ExplorerPaneTone, active: boolean): CSSProperties {
  return {
    minHeight: 28,
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    borderRadius: "var(--overlay-explorer-control-radius)",
    border: `1px solid ${active ? tone.accent : tone.border ?? "var(--overlay-explorer-chip-border)"}`,
    background: active
      ? "var(--overlay-explorer-chip-active-bg)"
      : "var(--overlay-explorer-chip-bg)",
    color: active ? tone.accent : tone.muted ?? "var(--overlay-text-muted)",
    cursor: "pointer",
    fontSize: 10,
    fontWeight: 800,
    padding: "0 9px",
  };
}
