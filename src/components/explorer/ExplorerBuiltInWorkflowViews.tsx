import { useEffect, type ReactNode } from "react";

import type { ExplorerDuplicateScan } from "../../runtime/explorerBackend";
import type {
  ExplorerWorkflowComponentProps,
} from "./explorerWorkflowContracts";
import type {
  ExplorerBatchRenameMode,
  ExplorerBatchRenamePreviewRow,
} from "../explorerBatchRename";
import {
  ExplorerWorkflowButton,
  ExplorerWorkflowEmptyState,
  ExplorerWorkflowFieldGrid,
  ExplorerWorkflowInput,
  ExplorerWorkflowMetaStrip,
  ExplorerWorkflowResultCard,
  ExplorerWorkflowResultCardHeader,
  ExplorerWorkflowResultList,
  ExplorerWorkflowResultRow,
  ExplorerWorkflowRowActions,
  ExplorerWorkflowSection,
  ExplorerWorkflowStatusNotice,
} from "./ExplorerWorkflowPrimitives";

type WorkflowPayload = Record<string, unknown> | null;

interface BatchRenameWorkflowState {
  mode: ExplorerBatchRenameMode;
  findText: string;
  replaceText: string;
  prefix: string;
  suffix: string;
  startingNumber: number;
  padding: number;
}

export function BatchRenameWorkflowView({
  session,
  host,
  state,
  previewRows,
  targetCount,
  onChange,
  onConfirm,
}: ExplorerWorkflowComponentProps<WorkflowPayload> & {
  state: BatchRenameWorkflowState;
  previewRows: ExplorerBatchRenamePreviewRow[];
  targetCount: number;
  onChange: (updates: Partial<BatchRenameWorkflowState>) => void;
  onConfirm: () => Promise<void> | void;
}) {
  const previewCount = previewRows.length;
  const collisionCount = previewRows.filter((row) => row.collision).length;
  const validationError =
    previewRows.find((row) => row.validationError)?.validationError ?? null;
  const canCommit =
    previewCount > 0 &&
    collisionCount === 0 &&
    !validationError;

  useEffect(() => {
    host.setTitle(session.title);
    host.setSize("lg");
    host.setBusy(false);
    host.setCloseGuard(null);
    host.setStatus(
      validationError
        ? { label: validationError, tone: "danger" }
        : collisionCount > 0
          ? {
              label: `${collisionCount} rename collision${
                collisionCount === 1 ? "" : "s"
              } detected.`,
              tone: "warning",
            }
          : previewCount > 0
            ? {
                label: `${previewCount} rename preview${
                  previewCount === 1 ? "" : "s"
                } ready.`,
                tone: "neutral",
              }
            : targetCount > 0
              ? {
                  label: "Building preview…",
                  tone: "neutral",
                }
              : {
                  label: "No file targets are available for batch rename.",
                  tone: "warning",
                },
    );
    host.setFooterActions([
      {
        id: "cancel",
        label: "Cancel",
        tone: "neutral",
        onSelect: () => host.close(),
      },
      {
        id: "confirm",
        label: "Rename",
        tone: "accent",
        disabled: !canCommit,
        onSelect: onConfirm,
      },
    ]);
  }, [
    canCommit,
    collisionCount,
    host,
    onConfirm,
    previewCount,
    session.title,
    targetCount,
    validationError,
  ]);

  return (
    <>
      <ExplorerWorkflowSection
        title="Recipe"
        description={
          state.mode === "regex"
            ? "Regex mode supports capture groups like $1 and ${name}. Tokens still expand after replacement."
            : "Literal mode replaces plain text in the filename stem and then expands any supported tokens."
        }
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <ExplorerWorkflowMetaStrip>
            <span>{targetCount} target{targetCount === 1 ? "" : "s"}</span>
            <span>
              Capture groups:{" "}
              {state.mode === "regex" ? "$1..$99, ${name}" : "literal text"}
            </span>
            <span>
              Tokens: <code>{"{{date}}"}</code>, <code>{"{{index}}"}</code>,{" "}
              <code>{"{{parent}}"}</code>
            </span>
          </ExplorerWorkflowMetaStrip>
          <ExplorerWorkflowButton
            type="button"
            onClick={() =>
              onChange({
                mode: state.mode === "regex" ? "literal" : "regex",
              })
            }
          >
            {state.mode === "regex" ? "Regex On" : "Regex Off"}
          </ExplorerWorkflowButton>
        </div>
        <ExplorerWorkflowFieldGrid columns={3}>
          <LabeledField label={state.mode === "regex" ? "Find pattern" : "Find text"}>
            <ExplorerWorkflowInput
              value={state.findText}
              onChange={(event) => onChange({ findText: event.target.value })}
              placeholder={state.mode === "regex" ? "Find pattern" : "Find text"}
            />
          </LabeledField>
          <LabeledField label="Replace with">
            <ExplorerWorkflowInput
              value={state.replaceText}
              onChange={(event) =>
                onChange({ replaceText: event.target.value })
              }
              placeholder="Replace with"
            />
          </LabeledField>
          <LabeledField label="Prefix">
            <ExplorerWorkflowInput
              value={state.prefix}
              onChange={(event) => onChange({ prefix: event.target.value })}
              placeholder="Prefix"
            />
          </LabeledField>
          <LabeledField label="Suffix">
            <ExplorerWorkflowInput
              value={state.suffix}
              onChange={(event) => onChange({ suffix: event.target.value })}
              placeholder="Suffix"
            />
          </LabeledField>
          <LabeledField label="Start #">
            <ExplorerWorkflowInput
              value={state.startingNumber}
              onChange={(event) =>
                onChange({
                  startingNumber: Number(event.target.value) || 1,
                })
              }
              placeholder="Start #"
              type="number"
            />
          </LabeledField>
          <LabeledField label="Pad width">
            <ExplorerWorkflowInput
              value={state.padding}
              onChange={(event) =>
                onChange({
                  padding: Number(event.target.value) || 1,
                })
              }
              placeholder="Pad width"
              type="number"
            />
          </LabeledField>
        </ExplorerWorkflowFieldGrid>
      </ExplorerWorkflowSection>

      {validationError ? (
        <ExplorerWorkflowStatusNotice tone="danger">
          {validationError}
        </ExplorerWorkflowStatusNotice>
      ) : null}

      <ExplorerWorkflowSection
        title="Preview"
        description="Each target shows its current name and the next generated result."
      >
        <ExplorerWorkflowResultList maxHeight="50vh">
          {previewRows.length > 0 ? (
            previewRows.map((row) => (
              <ExplorerWorkflowResultRow key={row.sourcePath}>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr) auto",
                    gap: 12,
                    alignItems: "center",
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        color: "var(--overlay-text-muted)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {row.currentName}
                    </div>
                    <div
                      style={{
                        marginTop: 2,
                        color: "var(--overlay-text-dim)",
                        fontSize: 10,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {row.sourcePath}
                    </div>
                  </div>
                  <div
                    style={{
                      minWidth: 0,
                      color: "var(--overlay-text-primary)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {row.nextName}
                  </div>
                  <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                    {row.collision ? (
                      <span
                        style={{
                          color: "var(--overlay-danger)",
                          fontSize: 10,
                          fontWeight: 700,
                        }}
                      >
                        Collision
                      </span>
                    ) : null}
                    {row.validationError ? (
                      <span
                        style={{
                          color: "var(--overlay-danger)",
                          fontSize: 10,
                          fontWeight: 700,
                        }}
                      >
                        {row.validationError}
                      </span>
                    ) : null}
                  </div>
                </div>
              </ExplorerWorkflowResultRow>
            ))
          ) : (
            <ExplorerWorkflowEmptyState>
              {targetCount > 0
                ? "Waiting for preview rows…"
                : "Select files or open a folder with files to batch rename them."}
            </ExplorerWorkflowEmptyState>
          )}
        </ExplorerWorkflowResultList>
      </ExplorerWorkflowSection>
    </>
  );
}

export function DuplicateFinderWorkflowView({
  session,
  host,
  state,
  formatSize,
  onStartScan,
  onCancelScan,
  onSelectPath,
  onRevealPath,
  onTrashPath,
  onDeletePath,
}: ExplorerWorkflowComponentProps<WorkflowPayload> & {
  state: {
    scanId: string | null;
    status: ExplorerDuplicateScan | null;
    loading: boolean;
  };
  formatSize: (bytes: number) => string;
  onStartScan: () => Promise<void> | void;
  onCancelScan: () => Promise<void> | void;
  onSelectPath: (path: string) => void;
  onRevealPath: (path: string) => void;
  onTrashPath: (path: string) => void;
  onDeletePath: (path: string) => void;
}) {
  useEffect(() => {
    void onStartScan();
  }, [onStartScan]);

  useEffect(() => {
    host.setTitle(session.title);
    host.setSize("xl");
    host.setBusy(state.loading);
    host.setCloseGuard(null);
    host.setStatus(
      state.status
        ? {
            label: `${state.status.groups.length} duplicate group${
              state.status.groups.length === 1 ? "" : "s"
            }, ${state.status.scannedFileCount} file${
              state.status.scannedFileCount === 1 ? "" : "s"
            } scanned.`,
            tone: state.status.cancelled ? "warning" : "neutral",
          }
        : state.loading
          ? { label: "Scanning current folder tree…", tone: "neutral" }
          : { label: "Preparing duplicate scan…", tone: "neutral" },
    );
    host.setFooterActions(
      state.loading
        ? [
            {
              id: "cancel-scan",
              label: "Cancel Scan",
              tone: "neutral",
              onSelect: onCancelScan,
            },
          ]
        : [
            {
              id: "close",
              label: "Close",
              tone: "neutral",
              onSelect: () => host.close(),
            },
          ],
    );
  }, [host, onCancelScan, session.title, state.loading, state.status]);

  const groups = state.status?.groups ?? [];

  return (
    <ExplorerWorkflowSection
      title="Results"
      description="Scan groups identical files by content hash so you can select, reveal, trash, or delete each duplicate."
    >
      <ExplorerWorkflowResultList maxHeight="68vh">
        {groups.length > 0 ? (
          groups.map((group) => (
            <ExplorerWorkflowResultCard
              key={`${group.contentHash}-${group.fileSize}`}
            >
              <ExplorerWorkflowResultCardHeader>
                <span
                  style={{
                    color: "var(--overlay-text-primary)",
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                >
                  {group.entries.length} duplicates
                </span>
                <span
                  style={{
                    color: "var(--overlay-text-muted)",
                    fontSize: 11,
                  }}
                >
                  {formatSize(group.fileSize)}
                </span>
              </ExplorerWorkflowResultCardHeader>
              {group.entries.map((entry) => (
                <ExplorerWorkflowResultRow key={entry.path}>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "minmax(0, 1fr) auto",
                      gap: 12,
                      alignItems: "center",
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          color: "var(--overlay-text-primary)",
                          fontSize: 11.5,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {entry.name}
                      </div>
                      <div
                        style={{
                          marginTop: 3,
                          color: "var(--overlay-text-muted)",
                          fontSize: 10,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {entry.path}
                      </div>
                    </div>
                    <ExplorerWorkflowRowActions>
                      <ExplorerWorkflowButton
                        type="button"
                        onClick={() => onSelectPath(entry.path)}
                      >
                        Select
                      </ExplorerWorkflowButton>
                      <ExplorerWorkflowButton
                        type="button"
                        onClick={() => onRevealPath(entry.path)}
                      >
                        Reveal
                      </ExplorerWorkflowButton>
                      <ExplorerWorkflowButton
                        type="button"
                        onClick={() => onTrashPath(entry.path)}
                      >
                        Trash
                      </ExplorerWorkflowButton>
                      <ExplorerWorkflowButton
                        type="button"
                        tone="danger"
                        onClick={() => onDeletePath(entry.path)}
                      >
                        Delete
                      </ExplorerWorkflowButton>
                    </ExplorerWorkflowRowActions>
                  </div>
                </ExplorerWorkflowResultRow>
              ))}
            </ExplorerWorkflowResultCard>
          ))
        ) : (
          <ExplorerWorkflowEmptyState>
            {state.loading
              ? "Scanning for duplicates…"
              : state.status?.cancelled
                ? "Duplicate scan cancelled."
                : "No duplicate groups found in the current folder tree."}
          </ExplorerWorkflowEmptyState>
        )}
      </ExplorerWorkflowResultList>
    </ExplorerWorkflowSection>
  );
}

function LabeledField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label style={{ display: "grid", gap: 6 }}>
      <span
        style={{
          color: "var(--overlay-text-muted)",
          fontSize: 11,
          fontWeight: 600,
        }}
      >
        {label}
      </span>
      {children}
    </label>
  );
}
