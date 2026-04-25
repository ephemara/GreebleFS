import type { ReactNode } from "react";
import {
  AlertTriangle,
  Check,
  ExternalLink,
  TerminalSquare,
} from "@/components/AppIcons";
import { revealExplorerPath } from "../../runtime/explorerBackend";
import {
  clearExplorerActionRuns,
  type ExplorerActionRunRecord,
} from "../../store/explorerActionRunStore";

interface ExplorerActionRunCenterContentProps {
  accent: string;
  border: string;
  danger: string;
  muted: string;
  runs: ExplorerActionRunRecord[];
  text: string;
  headerActions?: ReactNode;
}

function ActionRunStatusIcon({
  accent,
  danger,
  run,
}: {
  accent: string;
  danger: string;
  run: ExplorerActionRunRecord;
}) {
  if (run.status === "failed") {
    return <AlertTriangle size={12} style={{ color: danger }} />;
  }
  if (run.status === "launched") {
    return <ExternalLink size={12} style={{ color: accent }} />;
  }
  return <Check size={12} style={{ color: accent }} />;
}

function ActionRunButton({
  disabled = false,
  label,
  onClick,
}: {
  disabled?: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        border: "1px solid rgba(255,255,255,0.08)",
        background: disabled ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.05)",
        color: disabled ? "rgba(255,255,255,0.35)" : "inherit",
        borderRadius: 8,
        padding: "4px 8px",
        fontSize: 10,
        fontWeight: 700,
        cursor: disabled ? "default" : "pointer",
      }}
    >
      {label}
    </button>
  );
}

function ActionRunCard({
  accent,
  border,
  children,
}: {
  accent: string;
  border: string;
  children: ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
        padding: 12,
        borderRadius: 12,
        border: `1px solid ${border}`,
        background: "rgba(255,255,255,0.02)",
        boxShadow: `inset 0 0 0 1px ${accent}08`,
      }}
    >
      {children}
    </div>
  );
}

function getActionRunSummary(run: ExplorerActionRunRecord): string {
  if (run.status === "failed") {
    return run.stderr.trim() || run.stdout.trim() || "Failed";
  }
  if (run.status === "launched") {
    return "Running in external terminal";
  }
  if (run.timedOut) {
    return "Timed out";
  }
  if (run.stdout.trim()) {
    return run.stdout.trim().split(/\r?\n/, 1)[0] ?? "Completed";
  }
  return "Completed";
}

export function ExplorerActionRunCenterContent({
  accent,
  border,
  danger,
  muted,
  runs,
  text,
  headerActions,
}: ExplorerActionRunCenterContentProps) {
  if (runs.length === 0) {
    return null;
  }

  const failedCount = runs.filter((run) => run.status === "failed").length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, minHeight: 0 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <div>
          <div
            style={{
              color: text,
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
            }}
          >
            Action Runs
          </div>
          <div style={{ color: muted, fontSize: 11 }}>
            {runs.length} recent run{runs.length === 1 ? "" : "s"}
            {failedCount > 0 ? ` · ${failedCount} failed` : ""}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <button
            type="button"
            onClick={clearExplorerActionRuns}
            style={{
              border: `1px solid ${border}`,
              background: "rgba(255,255,255,0.04)",
              color: text,
              cursor: "pointer",
              borderRadius: 8,
              padding: "5px 8px",
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
            }}
          >
            Clear
          </button>
          {headerActions}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {runs.slice(0, 8).map((run) => (
          <ActionRunCard
            key={run.id}
            accent={accent}
            border={border}
          >
            <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
              <ActionRunStatusIcon
                accent={accent}
                danger={danger}
                run={run}
              />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ color: text, fontSize: 12, fontWeight: 700 }}>
                  {run.actionTitle}
                </div>
                <div
                  style={{
                    color: run.status === "failed" ? danger : muted,
                    fontSize: 11,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                  title={run.commandDisplay}
                >
                  {getActionRunSummary(run)}
                </div>
                <div
                  style={{
                    marginTop: 4,
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    flexWrap: "wrap",
                    color: muted,
                    fontSize: 10,
                  }}
                >
                  <span>{run.packId}</span>
                  <span>•</span>
                  <span>{run.outputTarget}</span>
                  <span>•</span>
                  <span>{run.runtimeUsed}</span>
                </div>
              </div>
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  color: run.status === "failed" ? danger : accent,
                  fontSize: 10,
                  fontWeight: 700,
                  textTransform: "uppercase",
                }}
              >
                <TerminalSquare size={11} />
                {run.status === "failed"
                  ? "Failed"
                  : run.status === "launched"
                    ? "Launched"
                    : "Done"}
              </div>
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <ActionRunButton
                label="Copy Output"
                disabled={!run.stdout.trim()}
                onClick={() => {
                  if (run.stdout.trim()) {
                    void navigator.clipboard.writeText(run.stdout);
                  }
                }}
              />
              <ActionRunButton
                label="Copy Error"
                disabled={!run.stderr.trim()}
                onClick={() => {
                  if (run.stderr.trim()) {
                    void navigator.clipboard.writeText(run.stderr);
                  }
                }}
              />
              <ActionRunButton
                label="Copy Command"
                disabled={!run.commandDisplay.trim()}
                onClick={() => {
                  if (run.commandDisplay.trim()) {
                    void navigator.clipboard.writeText(run.commandDisplay);
                  }
                }}
              />
              <ActionRunButton
                label="Reveal Action"
                disabled={!run.actionDirectory.trim()}
                onClick={() => {
                  if (run.actionDirectory.trim()) {
                    void revealExplorerPath(run.actionDirectory);
                  }
                }}
              />
            </div>
          </ActionRunCard>
        ))}
      </div>
    </div>
  );
}
