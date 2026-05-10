import { type CSSProperties, useMemo, useState } from "react";

import {
  runKainPluginAction,
  type KainPluginAction,
  type KainPluginDefinition,
  type KainPluginPreviewWorkbench,
  type KainPluginWorkbench,
} from "@/runtime/kainPluginCatalog";

interface KainPluginHostFile {
  name: string;
  resolvedPath: string;
  extension: string;
  size?: number;
  isDirectory?: boolean;
}

export function KainPluginWorkbenchHost({
  kainPlugin,
  mode,
  workbench = null,
  previewWorkbench = null,
  file = null,
}: {
  kainPlugin: KainPluginDefinition;
  mode: "workbench" | "preview-workbench";
  workbench?: KainPluginWorkbench | null;
  previewWorkbench?: KainPluginPreviewWorkbench | null;
  file?: KainPluginHostFile | null;
}) {
  const [runningActionId, setRunningActionId] = useState<string | null>(null);
  const [lastActionResult, setLastActionResult] = useState<string | null>(null);
  const [lastActionError, setLastActionError] = useState<string | null>(null);
  const surface = workbench ?? previewWorkbench;
  const surfaceActionIds = surface?.actions ?? [];
  const visibleActions = useMemo(
    () => surfaceActionIds
      .map((actionId) => kainPlugin.actions.find((action) => action.id === actionId))
      .filter((action): action is KainPluginAction => Boolean(action)),
    [kainPlugin.actions, surfaceActionIds],
  );
  const surfaceFfiLanes = surface?.ffiLanes.length
    ? surface.ffiLanes
    : kainPlugin.ffiCapabilities.map((capability) => capability.lane);
  const uniqueFfiLanes = [...new Set(surfaceFfiLanes)].slice(0, 8);
  const summary = surface?.summary || kainPlugin.description;

  const runAction = async (action: KainPluginAction) => {
    setRunningActionId(action.id);
    setLastActionError(null);
    try {
      const result = await runKainPluginAction({
        pluginId: kainPlugin.id,
        actionId: action.id,
        context: {
          mode,
          surfaceId: surface?.id ?? null,
          file: file
            ? {
                name: file.name,
                path: file.resolvedPath,
                extension: file.extension,
                size: file.size ?? null,
                isDirectory: file.isDirectory === true,
              }
            : null,
        },
      });
      setLastActionResult(
        `${result.label}: ${result.summary || (result.ok ? "ok" : "failed")}`,
      );
    } catch (error) {
      setLastActionError(error instanceof Error ? error.message : String(error));
    } finally {
      setRunningActionId(null);
    }
  };

  return (
    <div
      data-kain-plugin-workbench-host="true"
      data-kain-plugin-id={kainPlugin.id}
      data-kain-plugin-mode={mode}
      data-kain-plugin-surface={surface?.id ?? "none"}
      data-kain-plugin-ffi-lanes={uniqueFfiLanes.join("|")}
      style={{
        width: "100%",
        height: "100%",
        minWidth: 0,
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
        gap: 10,
        padding: 12,
        background: "var(--overlay-panel-bg, var(--overlay-surface, #0f1117))",
        color: "var(--overlay-text, #f8fafc)",
        overflow: "hidden",
        fontSize: 12,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {surface?.title ?? kainPlugin.name}
          </div>
          <div style={{ marginTop: 2, fontSize: 10, opacity: 0.58, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {kainPlugin.source}
          </div>
        </div>
        <span style={pillStyle(true)}>{kainPlugin.status}</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 6 }}>
        <Metric label="ffi" value={String(kainPlugin.ffiCapabilities.length)} />
        <Metric label="wasm" value={String(kainPlugin.wasmTargets.length)} />
        <Metric label="cargo" value={String(kainPlugin.cargoFfiTargets.length)} />
        <Metric label="actions" value={String(kainPlugin.actions.length)} />
      </div>

      {file ? (
        <div
          data-kain-plugin-preview-file={file.resolvedPath}
          style={{
            display: "flex",
            gap: 8,
            alignItems: "center",
            minHeight: 26,
            padding: "5px 7px",
            background: "var(--overlay-muted-bg, rgba(255,255,255,0.05))",
            borderRadius: 5,
            minWidth: 0,
          }}
        >
          <span style={{ opacity: 0.52 }}>file</span>
          <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {file.name}
          </span>
          <span style={{ marginLeft: "auto", opacity: 0.52 }}>{file.extension || "none"}</span>
        </div>
      ) : null}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
        {uniqueFfiLanes.map((lane) => (
          <span key={lane} style={pillStyle(false)}>{lane}</span>
        ))}
      </div>

      <div style={{ flex: 1, minHeight: 0, overflow: "auto", opacity: 0.76, lineHeight: 1.45 }}>
        {summary}
      </div>

      {visibleActions.length > 0 ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {visibleActions.map((action) => (
            <button
              key={action.id}
              type="button"
              data-kain-plugin-action={action.id}
              disabled={runningActionId != null}
              onClick={() => void runAction(action)}
              style={{
                border: 0,
                borderRadius: 5,
                padding: "5px 8px",
                minHeight: 26,
                background: "var(--overlay-control-bg, rgba(255,255,255,0.08))",
                color: "inherit",
                fontSize: 11,
                fontWeight: 650,
                cursor: runningActionId ? "wait" : "pointer",
                opacity: runningActionId && runningActionId !== action.id ? 0.55 : 1,
              }}
            >
              {runningActionId === action.id ? "Running" : action.label}
            </button>
          ))}
        </div>
      ) : null}

      <div
        data-kain-plugin-action-result={lastActionResult ?? ""}
        data-kain-plugin-action-error={lastActionError ?? ""}
        style={{
          minHeight: 16,
          fontSize: 10,
          opacity: lastActionError ? 0.9 : 0.55,
          color: lastActionError ? "var(--overlay-danger, #fca5a5)" : "inherit",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {lastActionError ?? lastActionResult ?? `${kainPlugin.name} ready`}
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        minWidth: 0,
        padding: "6px 7px",
        borderRadius: 5,
        background: "var(--overlay-muted-bg, rgba(255,255,255,0.05))",
      }}
    >
      <div style={{ fontSize: 9, opacity: 0.48 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 750, lineHeight: 1.1 }}>{value}</div>
    </div>
  );
}

function pillStyle(active: boolean): CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    minHeight: 20,
    padding: "2px 6px",
    borderRadius: 999,
    background: active
      ? "var(--overlay-accent-soft, rgba(125,211,252,0.14))"
      : "var(--overlay-muted-bg, rgba(255,255,255,0.06))",
    color: active
      ? "var(--overlay-accent, #7dd3fc)"
      : "var(--overlay-text-muted, rgba(248,250,252,0.7))",
    fontSize: 10,
    fontWeight: 650,
    whiteSpace: "nowrap",
  };
}
