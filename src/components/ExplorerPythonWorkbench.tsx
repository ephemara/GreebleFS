import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactElement,
} from "react";

import { OverlayScrollArea } from "./OverlayScrollArea";
import {
  bootstrapManagedPythonRuntime,
  getManagedPythonRuntimeStatus,
  installManagedPythonPackages,
  type ManagedPythonActionResponse,
  type ManagedPythonRuntimeConfig,
  type ManagedPythonRuntimeStatus,
} from "../runtime/pythonRuntimeBackend";

type ExplorerPythonWorkbenchProps = {
  pythonPath: string;
  pythonName: string;
  workingDirectory: string;
  workflowTabId?: string;
  runtimeConfig: ManagedPythonRuntimeConfig | null;
  packageInput: string;
  onRunManaged: () => Promise<ManagedPythonActionResponse>;
  onRunInTerminal: () => Promise<void>;
  onOpenManagedRepl: () => Promise<void>;
};

type PendingAction =
  | "status"
  | "run"
  | "terminal"
  | "bootstrap"
  | "install"
  | "repl"
  | null;

type ToolActivityState = {
  label: string;
  response: ManagedPythonActionResponse;
} | null;

const cardStyle: CSSProperties = {
  border: "1px solid var(--overlay-explorer-preview-border)",
  borderRadius: 18,
  background:
    "linear-gradient(180deg, color-mix(in srgb, var(--overlay-explorer-preview-header-bg) 92%, transparent), color-mix(in srgb, var(--overlay-explorer-preview-bg) 96%, transparent))",
  padding: 16,
  display: "grid",
  gap: 12,
};

const buttonStyle: CSSProperties = {
  border: "1px solid var(--overlay-explorer-chip-border)",
  borderRadius: "var(--overlay-explorer-control-radius)",
  background: "var(--overlay-explorer-chip-bg)",
  color: "var(--overlay-fg)",
  fontSize: 11,
  fontWeight: 700,
  padding: "8px 12px",
  cursor: "pointer",
};

const subtleTextStyle: CSSProperties = {
  color: "var(--overlay-explorer-muted, rgba(255,255,255,0.65))",
  fontSize: 11,
  lineHeight: 1.5,
};

function renderCommandResult(
  label: string,
  response: ManagedPythonActionResponse,
): ReactElement {
  return (
    <div style={{ ...cardStyle, gap: 10 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 700 }}>{label}</div>
        <span
          style={{
            borderRadius: 999,
            border: "1px solid var(--overlay-explorer-chip-border)",
            padding: "4px 8px",
            fontSize: 10,
            fontWeight: 700,
            color: response.result.success
              ? "var(--overlay-success, #7dd3a1)"
              : "var(--overlay-danger, #fca5a5)",
            background: "var(--overlay-explorer-chip-bg)",
          }}
        >
          {response.result.success
            ? `Exit ${response.result.exitCode}`
            : `Failed (${response.result.exitCode})`}
        </span>
      </div>
      <div style={{ display: "grid", gap: 6 }}>
        <div style={subtleTextStyle}>Command</div>
        <div style={codeBlockStyle}>{response.result.command}</div>
      </div>
      <div style={{ display: "grid", gap: 6 }}>
        <div style={subtleTextStyle}>Working Directory</div>
        <div style={codeBlockStyle}>{response.result.workingDirectory}</div>
      </div>
      <div style={{ display: "grid", gap: 10 }}>
        <div>
          <div style={subtleTextStyle}>stdout</div>
          <pre style={preStyle}>{response.result.stdout.trim() || "No stdout emitted."}</pre>
        </div>
        <div>
          <div style={subtleTextStyle}>stderr</div>
          <pre style={preStyle}>{response.result.stderr.trim() || "No stderr emitted."}</pre>
        </div>
      </div>
    </div>
  );
}

function buildStatusSummary(status: ManagedPythonRuntimeStatus | null): string {
  if (!status) {
    return "Checking managed Python runtime…";
  }

  if (!status.ready) {
    return "Managed runtime not ready";
  }

  return `Managed Python ${status.managedPythonVersion ?? "ready"}`;
}

export function ExplorerPythonWorkbench({
  pythonPath,
  pythonName,
  workingDirectory,
  workflowTabId = "run",
  runtimeConfig,
  packageInput,
  onRunManaged,
  onRunInTerminal,
  onOpenManagedRepl,
}: ExplorerPythonWorkbenchProps) {
  const [runtimeStatus, setRuntimeStatus] =
    useState<ManagedPythonRuntimeStatus | null>(null);
  const [runtimeError, setRuntimeError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction>("status");
  const [lastManagedRun, setLastManagedRun] =
    useState<ManagedPythonActionResponse | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [toolActivity, setToolActivity] = useState<ToolActivityState>(null);
  const [toolError, setToolError] = useState<string | null>(null);

  const refreshRuntimeStatus = useCallback(async () => {
    setPendingAction((current) => (current == null ? "status" : current));
    setRuntimeError(null);
    try {
      const status = await getManagedPythonRuntimeStatus(runtimeConfig);
      setRuntimeStatus(status);
    } catch (error) {
      setRuntimeError(String(error));
    } finally {
      setPendingAction((current) => (current === "status" ? null : current));
    }
  }, [runtimeConfig]);

  useEffect(() => {
    void refreshRuntimeStatus();
  }, [refreshRuntimeStatus]);

  const runManaged = useCallback(async () => {
    setPendingAction("run");
    setRunError(null);
    try {
      const response = await onRunManaged();
      setLastManagedRun(response);
      setRuntimeStatus(response.status);
    } catch (error) {
      setRunError(String(error));
    } finally {
      setPendingAction(null);
    }
  }, [onRunManaged]);

  const runInTerminal = useCallback(async () => {
    setPendingAction("terminal");
    setRunError(null);
    try {
      await onRunInTerminal();
    } catch (error) {
      setRunError(String(error));
    } finally {
      setPendingAction(null);
    }
  }, [onRunInTerminal]);

  const bootstrapRuntime = useCallback(async () => {
    setPendingAction("bootstrap");
    setToolError(null);
    try {
      const response = await bootstrapManagedPythonRuntime(runtimeConfig);
      setToolActivity({ label: "Bootstrapped Python Runtime", response });
      setRuntimeStatus(response.status);
    } catch (error) {
      setToolError(String(error));
    } finally {
      setPendingAction(null);
    }
  }, [runtimeConfig]);

  const installConfiguredPackages = useCallback(async () => {
    setPendingAction("install");
    setToolError(null);
    try {
      const response = await installManagedPythonPackages({
        config: runtimeConfig,
        packageInput,
        persistToRequirements: true,
      });
      setToolActivity({ label: "Installed Configured Packages", response });
      setRuntimeStatus(response.status);
    } catch (error) {
      setToolError(String(error));
    } finally {
      setPendingAction(null);
    }
  }, [packageInput, runtimeConfig]);

  const openManagedRepl = useCallback(async () => {
    setPendingAction("repl");
    setToolError(null);
    try {
      await onOpenManagedRepl();
      await refreshRuntimeStatus();
    } catch (error) {
      setToolError(String(error));
    } finally {
      setPendingAction(null);
    }
  }, [onOpenManagedRepl, refreshRuntimeStatus]);

  const statusSummary = useMemo(
    () => buildStatusSummary(runtimeStatus),
    [runtimeStatus],
  );

  const isRunTab = workflowTabId === "run";
  const isRuntimeTab = workflowTabId === "runtime";

  if (!isRunTab && !isRuntimeTab) {
    return null;
  }

  return (
    <OverlayScrollArea
      style={{ width: "100%", height: "100%" }}
      viewportStyle={{ padding: 16 }}
    >
      <div
        data-testid="explorer-python-workbench"
        data-python-workflow-tab={workflowTabId}
        style={{ display: "grid", gap: 14 }}
      >
        <div style={cardStyle}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <div>
              <div style={{ fontSize: 14, fontWeight: 800 }}>{pythonName}</div>
              <div style={subtleTextStyle}>{statusSummary}</div>
            </div>
            <button
              type="button"
              onClick={() => void refreshRuntimeStatus()}
              disabled={pendingAction != null}
              style={{
                ...buttonStyle,
                opacity: pendingAction != null ? 0.6 : 1,
              }}
            >
              Refresh Runtime
            </button>
          </div>
          <div style={{ display: "grid", gap: 6 }}>
            <div style={subtleTextStyle}>Entry</div>
            <div style={codeBlockStyle}>{pythonPath}</div>
          </div>
          <div style={{ display: "grid", gap: 6 }}>
            <div style={subtleTextStyle}>Working Directory</div>
            <div style={codeBlockStyle}>{workingDirectory}</div>
          </div>
          <div style={{ display: "grid", gap: 6 }}>
            <div style={subtleTextStyle}>Managed Interpreter</div>
            <div style={codeBlockStyle}>
              {runtimeStatus?.managedPythonPath ?? "Managed interpreter not created yet"}
            </div>
          </div>
          {runtimeError ? (
            <div style={errorBannerStyle}>{runtimeError}</div>
          ) : null}
        </div>

        {isRunTab ? (
          <>
            <div style={cardStyle}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>Run Actions</div>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 10,
                }}
              >
                <button
                  type="button"
                  onClick={() => void runManaged()}
                  disabled={pendingAction != null}
                  style={{
                    ...buttonStyle,
                    opacity: pendingAction != null ? 0.6 : 1,
                  }}
                >
                  Run Managed
                </button>
                <button
                  type="button"
                  onClick={() => void runInTerminal()}
                  disabled={pendingAction != null}
                  style={{
                    ...buttonStyle,
                    opacity: pendingAction != null ? 0.6 : 1,
                  }}
                >
                  Run in Terminal
                </button>
              </div>
              <div style={subtleTextStyle}>
                Managed runs capture stdout/stderr back into the preview. Use terminal run
                for interactive or long-lived scripts.
              </div>
            </div>
            {runError ? <div style={errorBannerStyle}>{runError}</div> : null}
            {lastManagedRun ? (
              renderCommandResult("Latest Managed Run", lastManagedRun)
            ) : (
              <div style={emptyStateStyle}>
                Managed output will appear here after the first run.
              </div>
            )}
          </>
        ) : null}

        {isRuntimeTab ? (
          <>
            <div style={cardStyle}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>Runtime Tools</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                <button
                  type="button"
                  onClick={() => void bootstrapRuntime()}
                  disabled={pendingAction != null}
                  style={{
                    ...buttonStyle,
                    opacity: pendingAction != null ? 0.6 : 1,
                  }}
                >
                  Bootstrap Runtime
                </button>
                <button
                  type="button"
                  onClick={() => void installConfiguredPackages()}
                  disabled={pendingAction != null || !packageInput.trim()}
                  style={{
                    ...buttonStyle,
                    opacity:
                      pendingAction != null || !packageInput.trim() ? 0.6 : 1,
                  }}
                >
                  Install Package Queue
                </button>
                <button
                  type="button"
                  onClick={() => void openManagedRepl()}
                  disabled={pendingAction != null}
                  style={{
                    ...buttonStyle,
                    opacity: pendingAction != null ? 0.6 : 1,
                  }}
                >
                  Open Managed REPL
                </button>
              </div>
              <div style={subtleTextStyle}>
                Package queue comes from Python settings and is installed into the managed
                environment.
              </div>
            </div>
            <div style={cardStyle}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>Configured Package Queue</div>
              <pre style={preStyle}>{packageInput.trim() || "No configured packages."}</pre>
            </div>
            {toolError ? <div style={errorBannerStyle}>{toolError}</div> : null}
            {toolActivity ? (
              renderCommandResult(toolActivity.label, toolActivity.response)
            ) : (
              <div style={emptyStateStyle}>
                Runtime maintenance logs will appear here after bootstrap or package actions.
              </div>
            )}
          </>
        ) : null}
      </div>
    </OverlayScrollArea>
  );
}

const codeBlockStyle: CSSProperties = {
  borderRadius: 12,
  border: "1px solid var(--overlay-explorer-chip-border)",
  background: "color-mix(in srgb, var(--overlay-explorer-preview-bg) 92%, black 8%)",
  color: "var(--overlay-fg)",
  fontFamily:
    'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
  fontSize: 11,
  lineHeight: 1.45,
  padding: "10px 12px",
  wordBreak: "break-word",
};

const preStyle: CSSProperties = {
  ...codeBlockStyle,
  margin: 0,
  whiteSpace: "pre-wrap",
};

const emptyStateStyle: CSSProperties = {
  ...cardStyle,
  color: "var(--overlay-explorer-muted, rgba(255,255,255,0.72))",
  fontSize: 12,
};

const errorBannerStyle: CSSProperties = {
  borderRadius: 14,
  border: "1px solid color-mix(in srgb, #ff8f8f 48%, transparent)",
  background: "color-mix(in srgb, #ff8f8f 12%, var(--overlay-explorer-preview-bg))",
  color: "#ffd4d4",
  padding: "10px 12px",
  fontSize: 11,
  lineHeight: 1.5,
};
