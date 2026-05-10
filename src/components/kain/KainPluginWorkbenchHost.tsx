import { type CSSProperties, type ReactNode, useMemo, useState } from "react";
import { AppSelect } from "../AppSelect";

import {
  runKainPluginAction,
  type KainPluginAction,
  type KainPluginActionResult,
  type KainPluginDefinition,
  type KainPluginPreviewWorkbench,
  type KainPluginTool,
  type KainPluginWorkbench,
} from "@/runtime/kainPluginCatalog";
import {
  convertKainImage,
  inspectKainImageConverterSource,
  planKainImageConversion,
  type KainImageConverterResult,
} from "@/runtime/kainImageConverterBackend";

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
  const surfaceToolId = workbench?.toolId ?? previewWorkbench?.toolId;
  const surfaceTool = useMemo(
    () => surfaceToolId
      ? kainPlugin.tools.find((tool) => tool.id === surfaceToolId) ?? null
      : kainPlugin.tools[0] ?? null,
    [kainPlugin.tools, surfaceToolId],
  );
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
  const authoringFeatureCount = kainPlugin.authoring?.languageFeatures.length ?? 0;
  const authoringExampleCount = kainPlugin.authoring?.examples.length ?? 0;
  const contractCount = kainPlugin.contracts.length;
  const pipelineStageCount = kainPlugin.pipelineStages.length;
  const hostUiComponents = [
    ...kainPlugin.hostUiComponents,
    ...(kainPlugin.hostUiKit?.components ?? []),
  ];
  const hostUiComponentCount = hostUiComponents.length;
  const hostUiPrimitiveCount = new Set([
    ...(kainPlugin.hostUiKit?.primitives ?? []),
    ...hostUiComponents.flatMap((component) => component.primitives),
  ]).size;
  const fabricPipelineCount = kainPlugin.fabricPipelines.length;
  const fabricStepCount = kainPlugin.fabricPipelines.reduce(
    (count, pipeline) => count + pipeline.steps.length,
    0,
  );
  const fabricRuntimeSummary = [
    ...new Set(kainPlugin.fabricPipelines.flatMap((pipeline) => pipeline.runtimes)),
  ].join("|");

  const runAction = async (
    action: KainPluginAction,
    actionContext: Record<string, unknown> = {},
  ): Promise<KainPluginActionResult> => {
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
          toolId: surfaceTool?.id ?? null,
          toolKind: surfaceTool?.kind ?? null,
          ...actionContext,
        },
      });
      setLastActionResult(
        `${result.label}: ${result.summary || (result.ok ? "ok" : "failed")}`,
      );
      return result;
    } catch (error) {
      setLastActionError(error instanceof Error ? error.message : String(error));
      throw error;
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
      data-kain-plugin-authoring-features={authoringFeatureCount}
      data-kain-plugin-authoring-examples={authoringExampleCount}
      data-kain-plugin-contracts={contractCount}
      data-kain-plugin-pipeline-stages={pipelineStageCount}
      data-kain-plugin-host-ui-components={hostUiComponentCount}
      data-kain-plugin-host-ui-primitives={hostUiPrimitiveCount}
      data-kain-plugin-fabric-pipelines={fabricPipelineCount}
      data-kain-plugin-fabric-steps={fabricStepCount}
      data-kain-plugin-fabric-runtimes={fabricRuntimeSummary}
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

      {authoringFeatureCount || authoringExampleCount || contractCount || pipelineStageCount ? (
        <div
          data-kain-plugin-reference-strip="true"
          style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 6 }}
        >
          <Metric label="features" value={String(authoringFeatureCount)} />
          <Metric label="examples" value={String(authoringExampleCount)} />
          <Metric label="contracts" value={String(contractCount)} />
          <Metric label="stages" value={String(pipelineStageCount)} />
        </div>
      ) : null}

      {hostUiComponentCount || fabricPipelineCount ? (
        <div
          data-kain-plugin-capability-strip="true"
          style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 6 }}
        >
          <Metric label="host ui" value={String(hostUiComponentCount)} />
          <Metric label="prims" value={String(hostUiPrimitiveCount)} />
          <Metric label="fabric" value={String(fabricPipelineCount)} />
          <Metric label="steps" value={String(fabricStepCount)} />
        </div>
      ) : null}

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

      {hostUiComponents.length > 0 ? (
        <div
          data-kain-plugin-host-ui-strip="true"
          style={{ display: "flex", flexWrap: "wrap", gap: 5 }}
        >
          {hostUiComponents.slice(0, 8).map((component) => (
            <span
              key={component.id}
              data-kain-plugin-host-ui-component={component.id}
              style={pillStyle(component.status === "live")}
              title={component.summary || component.role}
            >
              {component.kind}
            </span>
          ))}
        </div>
      ) : null}

      {kainPlugin.fabricPipelines.length > 0 ? (
        <div
          data-kain-plugin-fabric-strip="true"
          style={{ display: "grid", gap: 5 }}
        >
          {kainPlugin.fabricPipelines.slice(0, 2).map((pipeline) => (
            <div
              key={pipeline.id}
              data-kain-plugin-fabric-pipeline={pipeline.id}
              data-kain-plugin-fabric-manifest={pipeline.manifestPath}
              data-kain-plugin-fabric-step-count={pipeline.steps.length}
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(0, 1fr) auto",
                gap: 8,
                alignItems: "center",
                minHeight: 24,
                padding: "5px 7px",
                borderRadius: 5,
                background: "var(--overlay-muted-bg, rgba(255,255,255,0.05))",
              }}
            >
              <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 10, fontWeight: 750 }}>
                {pipeline.label}
              </span>
              <span style={{ fontSize: 10, opacity: 0.58 }}>
                {pipeline.steps.length} steps
              </span>
            </div>
          ))}
        </div>
      ) : null}

      {surfaceTool?.kind === "image-converter" ? (
        <KainImageConverterWorkbench
          tool={surfaceTool}
          file={file}
          actions={visibleActions}
          busyActionId={runningActionId}
          onRunKainAction={runAction}
          onStatus={setLastActionResult}
          onError={setLastActionError}
        />
      ) : (
        <div style={{ flex: 1, minHeight: 0, overflow: "auto", opacity: 0.76, lineHeight: 1.45 }}>
          {summary}
        </div>
      )}

      {surfaceTool?.kind !== "image-converter" && visibleActions.length > 0 ? (
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

function KainImageConverterWorkbench({
  tool,
  file,
  actions,
  busyActionId,
  onRunKainAction,
  onStatus,
  onError,
}: {
  tool: KainPluginTool;
  file: KainPluginHostFile | null;
  actions: KainPluginAction[];
  busyActionId: string | null;
  onRunKainAction: (
    action: KainPluginAction,
    actionContext?: Record<string, unknown>,
  ) => Promise<KainPluginActionResult>;
  onStatus: (message: string | null) => void;
  onError: (message: string | null) => void;
}) {
  const defaultPreset = tool.resizePresets[0] ?? null;
  const [sourcePath, setSourcePath] = useState(file?.resolvedPath ?? "");
  const [outputPath, setOutputPath] = useState("");
  const [outputFormat, setOutputFormat] = useState(
    tool.defaultOutputFormat ?? tool.formats.find((format) => format.write)?.id ?? "png",
  );
  const [fitMode, setFitMode] = useState(defaultPreset?.fitMode ?? tool.resizeModes[0] ?? "contain");
  const [width, setWidth] = useState(defaultPreset?.width ? String(defaultPreset.width) : "");
  const [height, setHeight] = useState(defaultPreset?.height ? String(defaultPreset.height) : "");
  const [quality, setQuality] = useState("92");
  const [background, setBackground] = useState("#000000");
  const [lastConversion, setLastConversion] = useState<KainImageConverterResult | null>(null);
  const [pythonBusy, setPythonBusy] = useState(false);
  const supportedFormats = tool.formats.filter((format) => format.write);
  const inspectAction = findToolAction(actions, "inspect");
  const planAction = findToolAction(actions, "plan");
  const convertAction = findToolAction(actions, "convert") ?? actions.find((action) => action.id === tool.primaryActionId) ?? null;
  const busy = Boolean(busyActionId || pythonBusy);
  const backendSummary = tool.pipelineBackends
    .map((backend) => `${backend.lane}:${backend.status}`)
    .join("|");

  const buildPayload = () => ({
    sourcePath: sourcePath.trim(),
    outputPath: outputPath.trim() || null,
    outputFormat,
    width: parseOptionalPositiveInt(width),
    height: parseOptionalPositiveInt(height),
    fitMode,
    quality: parseOptionalPositiveInt(quality) ?? 92,
    background,
  });

  const runImageAction = async (
    action: KainPluginAction | null,
    phase: "inspect" | "plan" | "convert",
  ) => {
    const payload = buildPayload();
    onError(null);
    setLastConversion(null);
    if (!payload.sourcePath) {
      onError("Choose an image path first.");
      return;
    }

    try {
      if (action) {
        await onRunKainAction(action, { imageConverter: payload, phase });
      }
      setPythonBusy(true);
      const response = phase === "inspect"
        ? await inspectKainImageConverterSource({ sourcePath: payload.sourcePath })
        : phase === "plan"
          ? await planKainImageConversion(payload)
          : await convertKainImage({ ...payload, overwrite: false });
      setLastConversion(response.result);
      onStatus(
        `${phase}: ${response.result.outputPath ?? response.result.source?.path ?? "ready"}`,
      );
    } catch (error) {
      onError(error instanceof Error ? error.message : String(error));
    } finally {
      setPythonBusy(false);
    }
  };

  return (
    <div
      data-kain-image-converter-workbench="true"
      data-kain-image-converter-tool={tool.id}
      data-kain-image-converter-source={sourcePath}
      data-kain-image-converter-format={outputFormat}
      data-kain-image-converter-backends={backendSummary}
      data-kain-image-converter-result={lastConversion?.outputPath ?? ""}
      style={{ flex: 1, minHeight: 0, display: "grid", gridTemplateRows: "auto auto minmax(0, 1fr)", gap: 8 }}
    >
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(120px, 0.22fr)", gap: 6 }}>
        <Field label="source">
          <input
            value={sourcePath}
            onChange={(event) => setSourcePath(event.currentTarget.value)}
            placeholder={file?.resolvedPath ?? "D:/path/image.png"}
            style={inputStyle()}
          />
        </Field>
        <Field label="format">
          <AppSelect
            value={outputFormat}
            onChange={(event) => setOutputFormat(event.currentTarget.value)}
            style={inputStyle()}
          >
            {supportedFormats.map((format) => (
              <option key={format.id} value={format.id}>
                {format.label}
              </option>
            ))}
          </AppSelect>
        </Field>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: 6 }}>
        <Field label="w">
          <input value={width} onChange={(event) => setWidth(event.currentTarget.value)} inputMode="numeric" style={inputStyle()} />
        </Field>
        <Field label="h">
          <input value={height} onChange={(event) => setHeight(event.currentTarget.value)} inputMode="numeric" style={inputStyle()} />
        </Field>
        <Field label="fit">
          <AppSelect value={fitMode} onChange={(event) => setFitMode(event.currentTarget.value)} style={inputStyle()}>
            {tool.resizeModes.map((mode) => <option key={mode} value={mode}>{mode}</option>)}
          </AppSelect>
        </Field>
        <Field label="q">
          <input value={quality} onChange={(event) => setQuality(event.currentTarget.value)} inputMode="numeric" style={inputStyle()} />
        </Field>
        <Field label="bg">
          <input value={background} onChange={(event) => setBackground(event.currentTarget.value)} style={inputStyle()} />
        </Field>
      </div>

      <div style={{ minHeight: 0, display: "grid", gridTemplateRows: "auto auto minmax(0, 1fr)", gap: 8 }}>
        <Field label="output">
          <input
            value={outputPath}
            onChange={(event) => setOutputPath(event.currentTarget.value)}
            placeholder="auto"
            style={inputStyle()}
          />
        </Field>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {tool.resizePresets.slice(0, 5).map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => {
                setWidth(String(preset.width));
                setHeight(String(preset.height));
                setFitMode(preset.fitMode);
              }}
              style={smallButtonStyle(false, false)}
            >
              {preset.label}
            </button>
          ))}
          <button
            type="button"
            disabled={busy}
            data-kain-image-converter-command="inspect"
            onClick={() => void runImageAction(inspectAction, "inspect")}
            style={smallButtonStyle(busyActionId === inspectAction?.id, busy)}
          >
            Inspect
          </button>
          <button
            type="button"
            disabled={busy}
            data-kain-image-converter-command="plan"
            onClick={() => void runImageAction(planAction, "plan")}
            style={smallButtonStyle(busyActionId === planAction?.id, busy)}
          >
            Plan
          </button>
          <button
            type="button"
            disabled={busy}
            data-kain-image-converter-command="convert"
            onClick={() => void runImageAction(convertAction, "convert")}
            style={smallButtonStyle(busyActionId === convertAction?.id || pythonBusy, busy)}
          >
            Convert
          </button>
        </div>

        <div style={{ minHeight: 0, overflow: "auto", display: "grid", alignContent: "start", gap: 6 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 6 }}>
            <Metric label="formats" value={String(supportedFormats.length)} />
            <Metric label="modes" value={String(tool.resizeModes.length)} />
            <Metric label="backends" value={String(tool.pipelineBackends.length)} />
            <Metric label="image" value={lastConversion?.source ? `${lastConversion.source.width}x${lastConversion.source.height}` : "idle"} />
          </div>
          {lastConversion ? (
            <div style={resultPanelStyle()}>
              <div style={{ fontSize: 10, opacity: 0.56 }}>{lastConversion.backend}</div>
              <div style={{ fontSize: 12, fontWeight: 750, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {lastConversion.outputPath ?? lastConversion.source?.path}
              </div>
              {lastConversion.warnings.length ? (
                <div style={{ fontSize: 10, opacity: 0.65 }}>{lastConversion.warnings.join(" | ")}</div>
              ) : null}
            </div>
          ) : (
            <div style={resultPanelStyle()}>
              <div style={{ fontSize: 10, opacity: 0.56 }}>{tool.label}</div>
              <div style={{ fontSize: 12, opacity: 0.78 }}>{tool.summary}</div>
            </div>
          )}
        </div>
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

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label style={{ display: "grid", gap: 3, minWidth: 0, fontSize: 9, fontWeight: 750, opacity: 0.72 }}>
      <span>{label}</span>
      {children}
    </label>
  );
}

function findToolAction(actions: KainPluginAction[], effect: string): KainPluginAction | null {
  return actions.find((action) => action.effect === effect)
    ?? actions.find((action) => action.id.toLowerCase().includes(effect))
    ?? null;
}

function parseOptionalPositiveInt(value: string): number | null {
  const parsed = Number.parseInt(value.trim(), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function inputStyle(): CSSProperties {
  return {
    width: "100%",
    minWidth: 0,
    minHeight: 24,
    boxSizing: "border-box",
    border: "1px solid var(--overlay-border, rgba(255,255,255,0.12))",
    borderRadius: 5,
    background: "var(--overlay-control-bg, rgba(255,255,255,0.07))",
    color: "inherit",
    fontSize: 11,
    padding: "4px 6px",
    outline: "none",
  };
}

function smallButtonStyle(active: boolean, busy: boolean): CSSProperties {
  return {
    border: 0,
    borderRadius: 5,
    padding: "5px 8px",
    minHeight: 24,
    background: active
      ? "var(--overlay-accent-soft, rgba(125,211,252,0.18))"
      : "var(--overlay-control-bg, rgba(255,255,255,0.08))",
    color: "inherit",
    fontSize: 10,
    fontWeight: 750,
    cursor: busy ? "wait" : "pointer",
    opacity: busy && !active ? 0.55 : 1,
    whiteSpace: "nowrap",
  };
}

function resultPanelStyle(): CSSProperties {
  return {
    minWidth: 0,
    display: "grid",
    gap: 4,
    padding: 8,
    borderRadius: 5,
    background: "var(--overlay-muted-bg, rgba(255,255,255,0.05))",
    overflow: "hidden",
  };
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
