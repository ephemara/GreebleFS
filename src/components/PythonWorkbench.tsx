import { useCallback, useEffect, useMemo, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Bot, FolderOpen, PackagePlus, Play, RefreshCw, Rocket, SquareTerminal } from 'lucide-react';
import type { ResolvedOverlayAppearance } from '../config/appearance';
import {
  createPythonRuntimeConfig,
  formatCommandOutput,
  parseMultilineValues,
  pythonExamplePresets,
  pythonQuickPackagePresets,
  summarizeInterpreter,
  type PythonActionResponse,
  type PythonExecutionMode,
  type PythonRuntimeStatus,
} from '../config/python';
import { useSettingsStore } from '../store/settingsStore';
import { OverlayScrollArea } from './OverlayScrollArea';

function parseEnvironmentEntries(raw: string): Record<string, string> {
  return Object.fromEntries(
    parseMultilineValues(raw)
      .map(line => {
        const separatorIndex = line.indexOf('=');
        if (separatorIndex === -1) {
          return null;
        }

        const key = line.slice(0, separatorIndex).trim();
        const value = line.slice(separatorIndex + 1).trim();
        return key ? [key, value] as const : null;
      })
      .filter((entry): entry is readonly [string, string] => Array.isArray(entry)),
  );
}

function appendConsoleEntry(current: string, next: string): string {
  if (!next.trim()) {
    return current;
  }

  return current.trim() ? `${current.trim()}\n\n---\n\n${next.trim()}` : next.trim();
}

export function PythonWorkbench({ appearance }: { appearance: ResolvedOverlayAppearance }) {
  const pythonSettings = useSettingsStore(s => s.settings.python);
  const updatePython = useSettingsStore(s => s.updatePython);
  const [status, setStatus] = useState<PythonRuntimeStatus | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [packageDraft, setPackageDraft] = useState(pythonSettings.bootstrapPackages);
  const [persistPackages, setPersistPackages] = useState(true);
  const [executionMode, setExecutionMode] = useState<PythonExecutionMode>('inline');
  const [runnerEntry, setRunnerEntry] = useState('hello_runtime.py');
  const [runnerArgs, setRunnerArgs] = useState('');
  const [runnerWorkingDirectory, setRunnerWorkingDirectory] = useState('');
  const [runnerEnvironment, setRunnerEnvironment] = useState('');
  const [inlineCode, setInlineCode] = useState(pythonExamplePresets[0]?.entry ?? 'print("hello")');
  const [consoleOutput, setConsoleOutput] = useState('');

  const theme = appearance.theme.palette;
  const runtimeConfig = useMemo(
    () => createPythonRuntimeConfig(pythonSettings),
    [pythonSettings],
  );

  useEffect(() => {
    setPackageDraft(pythonSettings.bootstrapPackages);
  }, [pythonSettings.bootstrapPackages]);

  const sectionStyle = useMemo(
    () => ({
      border: `1px solid ${theme.border}`,
      background: `linear-gradient(180deg, ${theme.panelBackground} 0%, ${theme.shellBackground} 100%)`,
      boxShadow: `inset 0 1px 0 ${theme.accent}12`,
    }),
    [theme.accent, theme.border, theme.panelBackground, theme.shellBackground],
  );

  const inputStyle = useMemo(
    () => ({
      borderColor: theme.border,
      background: 'rgba(255,255,255,0.04)',
      color: theme.textPrimary,
    }),
    [theme.border, theme.textPrimary],
  );

  const buttonStyle = useMemo(
    () => ({
      border: `1px solid ${theme.accent}55`,
      background: `${theme.accent}16`,
      color: theme.accent,
    }),
    [theme.accent],
  );

  const quietButtonStyle = useMemo(
    () => ({
      border: `1px solid ${theme.border}`,
      background: 'rgba(255,255,255,0.035)',
      color: theme.textPrimary,
    }),
    [theme.border, theme.textPrimary],
  );

  const refreshStatus = useCallback(async () => {
    setLoadingStatus(true);
    setStatusError(null);

    try {
      const nextStatus = await invoke<PythonRuntimeStatus>('python_get_runtime_status', {
        config: runtimeConfig,
      });
      setStatus(nextStatus);
    } catch (error) {
      setStatusError(String(error));
    } finally {
      setLoadingStatus(false);
    }
  }, [runtimeConfig]);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  const runAction = useCallback(async (
    label: string,
    factory: () => Promise<PythonActionResponse>,
  ) => {
    setPendingAction(label);
    setStatusError(null);
    try {
      const response = await factory();
      setStatus(response.status);
      setConsoleOutput(current => appendConsoleEntry(current, formatCommandOutput(response.result)));
      return response.result;
    } catch (error) {
      const errorText = String(error);
      setStatusError(errorText);
      setConsoleOutput(current => appendConsoleEntry(current, `${label} failed\n\n${errorText}`));
      return null;
    } finally {
      setPendingAction(null);
    }
  }, []);

  const bootstrapRuntime = useCallback(async () => {
    updatePython({ bootstrapPackages: packageDraft });
    await runAction('Bootstrap runtime', () =>
      invoke<PythonActionResponse>('python_bootstrap_runtime', {
        config: {
          ...runtimeConfig,
          bootstrapPackages: packageDraft.trim() || null,
        },
      }));
  }, [packageDraft, runAction, runtimeConfig, updatePython]);

  const installPackages = useCallback(async () => {
    updatePython({ bootstrapPackages: packageDraft });
    await runAction('Install packages', () =>
      invoke<PythonActionResponse>('python_install_packages', {
        request: {
          config: {
            ...runtimeConfig,
            bootstrapPackages: packageDraft.trim() || null,
          },
          packageInput: packageDraft,
          persistToRequirements: persistPackages,
        },
      }));
  }, [packageDraft, persistPackages, runAction, runtimeConfig, updatePython]);

  const executeRunner = useCallback(async () => {
    const entry = executionMode === 'inline' ? inlineCode : runnerEntry;
    await runAction('Run Python', () =>
      invoke<PythonActionResponse>('python_execute', {
        request: {
          config: runtimeConfig,
          executionMode,
          entry,
          arguments: parseMultilineValues(runnerArgs),
          workingDirectory: runnerWorkingDirectory.trim() || null,
          environment: parseEnvironmentEntries(runnerEnvironment),
          useManagedEnvironment: true,
        },
      }));
  }, [executionMode, inlineCode, runAction, runnerArgs, runnerEntry, runnerEnvironment, runnerWorkingDirectory, runtimeConfig]);

  const openPath = useCallback(async (path: string | null | undefined) => {
    if (!path?.trim()) {
      return;
    }

    try {
      await invoke('fs_open_file', { path });
    } catch (error) {
      setStatusError(String(error));
    }
  }, []);

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col" style={{ background: theme.shellBackground, color: theme.textPrimary }}>
      <div className="border-b px-5 py-4" style={{ borderColor: theme.border, background: 'rgba(255,255,255,0.02)' }}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em]" style={{ color: theme.textMuted }}>
              <Bot size={13} />
              <span>Python Runtime</span>
            </div>
            <h2 className="mt-2 text-[22px] font-semibold" style={{ color: theme.textPrimary }}>Managed Python workbench.</h2>
            <p className="mt-2 max-w-[780px] text-[11px] leading-5" style={{ color: theme.textMuted }}>
              Bootstrap a dedicated virtual environment, install libraries like ONNX when needed, and execute scripts or inline Python directly from the overlay.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void refreshStatus()}
              disabled={loadingStatus || Boolean(pendingAction)}
              className="rounded px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em]"
              style={quietButtonStyle}
            >
              <span className="flex items-center gap-2"><RefreshCw size={12} />Refresh</span>
            </button>
            <button
              type="button"
              onClick={() => void bootstrapRuntime()}
              disabled={Boolean(pendingAction)}
              className="rounded px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em]"
              style={buttonStyle}
            >
              <span className="flex items-center gap-2"><Rocket size={12} />Bootstrap</span>
            </button>
          </div>
        </div>
      </div>

      <OverlayScrollArea style={{ flex: 1, minHeight: 0 }} viewportStyle={{ padding: '18px 20px 24px 20px' }}>
        <div className="space-y-4">
          <section className="rounded-xl p-4" style={sectionStyle}>
            <div className="grid gap-3 md:grid-cols-4">
              {[
                { label: 'Status', value: loadingStatus ? 'Checking…' : status?.ready ? 'Managed env ready' : 'Bootstrap required' },
                { label: 'Interpreter', value: summarizeInterpreter(status?.baseInterpreter ?? null) },
                { label: 'Managed Python', value: status?.managedPythonVersion ?? 'Not created yet' },
                { label: 'Pip', value: status?.managedPipVersion ?? 'Not installed yet' },
              ].map(card => (
                <div key={card.label} className="rounded-lg border px-3 py-3" style={{ borderColor: theme.border, background: 'rgba(255,255,255,0.03)' }}>
                  <div className="text-[9px] font-semibold uppercase tracking-[0.16em]" style={{ color: theme.textMuted }}>{card.label}</div>
                  <div className="mt-2 text-[12px] font-semibold" style={{ color: theme.textPrimary }}>{card.value}</div>
                </div>
              ))}
            </div>
            {statusError && (
              <div className="mt-3 rounded-lg border px-3 py-2 text-[11px]" style={{ borderColor: `${theme.danger}55`, background: `${theme.danger}14`, color: theme.danger }}>
                {statusError}
              </div>
            )}
            <div className="mt-3 flex flex-wrap gap-2 text-[10px]">
              <button type="button" onClick={() => void openPath(status?.runtimeRoot)} className="rounded px-2.5 py-1.5 font-semibold uppercase tracking-[0.12em]" style={quietButtonStyle}>Open Runtime Root</button>
              <button type="button" onClick={() => void openPath(status?.boilerplate.requirementsPath)} className="rounded px-2.5 py-1.5 font-semibold uppercase tracking-[0.12em]" style={quietButtonStyle}>Open Requirements</button>
              <button type="button" onClick={() => void openPath(status?.boilerplate.helloScriptPath)} className="rounded px-2.5 py-1.5 font-semibold uppercase tracking-[0.12em]" style={quietButtonStyle}>Open Hello Script</button>
              <button type="button" onClick={() => void openPath(status?.boilerplate.probeScriptPath)} className="rounded px-2.5 py-1.5 font-semibold uppercase tracking-[0.12em]" style={quietButtonStyle}>Open ONNX Probe</button>
            </div>
          </section>

          <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
            <section className="rounded-xl p-4" style={sectionStyle}>
              <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em]" style={{ color: theme.textMuted }}>
                <PackagePlus size={12} />
                <span>Runtime Setup</span>
              </div>
              <div className="mt-4 grid gap-3">
                <label className="space-y-1.5">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: theme.textMuted }}>Preferred Interpreter Path</div>
                  <input
                    value={pythonSettings.preferredInterpreterPath}
                    onChange={event => updatePython({ preferredInterpreterPath: event.target.value })}
                    className="w-full rounded border px-3 py-2 text-[11px] outline-none"
                    style={inputStyle}
                    placeholder="Leave blank to auto-detect Python 3.11/3.10 first"
                  />
                </label>
                <label className="space-y-1.5">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: theme.textMuted }}>Runtime Root Override</div>
                  <input
                    value={pythonSettings.runtimeRoot}
                    onChange={event => updatePython({ runtimeRoot: event.target.value })}
                    className="w-full rounded border px-3 py-2 text-[11px] outline-none"
                    style={inputStyle}
                    placeholder="Leave blank to use the app-local managed runtime"
                  />
                </label>
                <label className="space-y-1.5">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: theme.textMuted }}>Bootstrap / Install Packages</div>
                  <textarea
                    value={packageDraft}
                    onChange={event => setPackageDraft(event.target.value)}
                    className="min-h-[148px] w-full rounded border px-3 py-2 text-[11px] outline-none"
                    style={inputStyle}
                    placeholder={'numpy\nonnxruntime\npillow'}
                  />
                </label>
                <div className="flex flex-wrap gap-2">
                  {pythonQuickPackagePresets.map(preset => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => setPackageDraft(preset.packages.join('\n'))}
                      className="rounded px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em]"
                      style={quietButtonStyle}
                      title={preset.description}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-3 text-[11px]" style={{ color: theme.textMuted }}>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={pythonSettings.autoUpgradePip}
                      onChange={event => updatePython({ autoUpgradePip: event.target.checked })}
                    />
                    <span>Upgrade pip/setuptools/wheel during bootstrap</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={pythonSettings.createBoilerplate}
                      onChange={event => updatePython({ createBoilerplate: event.target.checked })}
                    />
                    <span>Seed boilerplate scripts and helper package</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={persistPackages}
                      onChange={event => setPersistPackages(event.target.checked)}
                    />
                    <span>Persist installs to `requirements.txt`</span>
                  </label>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => void bootstrapRuntime()} disabled={Boolean(pendingAction)} className="rounded px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em]" style={buttonStyle}>Bootstrap Runtime</button>
                  <button type="button" onClick={() => void installPackages()} disabled={Boolean(pendingAction)} className="rounded px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em]" style={quietButtonStyle}>Install Packages</button>
                </div>
              </div>
            </section>

            <section className="rounded-xl p-4" style={sectionStyle}>
              <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em]" style={{ color: theme.textMuted }}>
                <FolderOpen size={12} />
                <span>Discovery</span>
              </div>
              <div className="mt-4 space-y-3">
                <div className="rounded-lg border px-3 py-3 text-[11px]" style={{ borderColor: theme.border, background: 'rgba(255,255,255,0.03)' }}>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: theme.textMuted }}>Managed Paths</div>
                  <div className="mt-2 space-y-1 font-mono text-[10px]">
                    <div>{status?.runtimeRoot ?? 'Runtime root not resolved yet'}</div>
                    <div>{status?.managedPythonPath ?? 'Managed interpreter not created yet'}</div>
                  </div>
                </div>
                <div className="rounded-lg border px-3 py-3" style={{ borderColor: theme.border, background: 'rgba(255,255,255,0.03)' }}>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: theme.textMuted }}>Detected Interpreters</div>
                  <div className="mt-2 space-y-2">
                    {(status?.discoveredInterpreters ?? []).length === 0 && (
                      <div className="text-[11px]" style={{ color: theme.textMuted }}>No Python interpreter detected yet.</div>
                    )}
                    {(status?.discoveredInterpreters ?? []).map(interpreter => (
                      <div key={interpreter.id} className="rounded border px-2.5 py-2 text-[11px]" style={{ borderColor: theme.border, background: interpreter.preferred ? `${theme.accent}12` : 'rgba(255,255,255,0.025)' }}>
                        <div className="flex items-center justify-between gap-3">
                          <div className="font-semibold" style={{ color: theme.textPrimary }}>
                            {interpreter.label} · {interpreter.version}
                          </div>
                          <div className="text-[9px] uppercase tracking-[0.12em]" style={{ color: interpreter.recommended ? theme.success : theme.textMuted }}>
                            {interpreter.preferred ? 'Preferred' : interpreter.recommended ? 'Recommended' : interpreter.source}
                          </div>
                        </div>
                        <div className="mt-1 break-all font-mono text-[10px]" style={{ color: theme.textMuted }}>
                          {interpreter.executable}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-lg border px-3 py-3 text-[11px]" style={{ borderColor: theme.border, background: `${theme.accent}0f`, color: theme.textMuted }}>
                  {status?.interpreterHint ?? 'Bootstrap the runtime to generate boilerplate and lock the environment.'}
                </div>
              </div>
            </section>
          </div>

          <div className="grid gap-4 xl:grid-cols-[1fr_0.95fr]">
            <section className="rounded-xl p-4" style={sectionStyle}>
              <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em]" style={{ color: theme.textMuted }}>
                <Play size={12} />
                <span>Runner</span>
              </div>
              <div className="mt-4 grid gap-3">
                <div className="flex flex-wrap gap-2">
                  {(['inline', 'script', 'module'] as const).map(mode => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setExecutionMode(mode)}
                      className="rounded px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em]"
                      style={executionMode === mode ? buttonStyle : quietButtonStyle}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2">
                  {pythonExamplePresets.map(example => (
                    <button
                      key={example.id}
                      type="button"
                      onClick={() => {
                        setExecutionMode(example.mode);
                        if (example.mode === 'inline') {
                          setInlineCode(example.entry);
                        } else {
                          setRunnerEntry(example.entry);
                        }
                      }}
                      className="rounded px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em]"
                      style={quietButtonStyle}
                      title={example.description}
                    >
                      {example.label}
                    </button>
                  ))}
                </div>
                {executionMode === 'inline' ? (
                  <textarea
                    value={inlineCode}
                    onChange={event => setInlineCode(event.target.value)}
                    className="min-h-[190px] w-full rounded border px-3 py-2 text-[11px] outline-none"
                    style={{ ...inputStyle, fontFamily: appearance.fonts.mono }}
                  />
                ) : (
                  <label className="space-y-1.5">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: theme.textMuted }}>
                      {executionMode === 'module' ? 'Module Name' : 'Script Path'}
                    </div>
                    <input
                      value={runnerEntry}
                      onChange={event => setRunnerEntry(event.target.value)}
                      className="w-full rounded border px-3 py-2 text-[11px] outline-none"
                      style={{ ...inputStyle, fontFamily: appearance.fonts.mono }}
                      placeholder={executionMode === 'module' ? 'pip' : 'hello_runtime.py'}
                    />
                  </label>
                )}
                <label className="space-y-1.5">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: theme.textMuted }}>Arguments</div>
                  <textarea
                    value={runnerArgs}
                    onChange={event => setRunnerArgs(event.target.value)}
                    className="min-h-[74px] w-full rounded border px-3 py-2 text-[11px] outline-none"
                    style={{ ...inputStyle, fontFamily: appearance.fonts.mono }}
                    placeholder={'--flag\nvalue'}
                  />
                </label>
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="space-y-1.5">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: theme.textMuted }}>Working Directory</div>
                    <input
                      value={runnerWorkingDirectory}
                      onChange={event => setRunnerWorkingDirectory(event.target.value)}
                      className="w-full rounded border px-3 py-2 text-[11px] outline-none"
                      style={inputStyle}
                      placeholder="Optional override"
                    />
                  </label>
                  <label className="space-y-1.5">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: theme.textMuted }}>Environment Overrides</div>
                    <textarea
                      value={runnerEnvironment}
                      onChange={event => setRunnerEnvironment(event.target.value)}
                      className="min-h-[74px] w-full rounded border px-3 py-2 text-[11px] outline-none"
                      style={{ ...inputStyle, fontFamily: appearance.fonts.mono }}
                      placeholder={'MODEL_DIR=C:\\models\nAPP_MODE=dev'}
                    />
                  </label>
                </div>
                <div>
                  <button type="button" onClick={() => void executeRunner()} disabled={Boolean(pendingAction)} className="rounded px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em]" style={buttonStyle}>
                    Run In Managed Env
                  </button>
                </div>
              </div>
            </section>

            <section className="rounded-xl p-4" style={sectionStyle}>
              <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em]" style={{ color: theme.textMuted }}>
                <SquareTerminal size={12} />
                <span>Console</span>
              </div>
              <div className="mt-4 rounded-lg border" style={{ borderColor: theme.border, background: '#05070d' }}>
                <OverlayScrollArea style={{ height: 420 }} viewportStyle={{ padding: '14px' }}>
                  <pre className="whitespace-pre-wrap break-words text-[11px]" style={{ color: '#c9d1d9', fontFamily: appearance.fonts.mono }}>
                    {consoleOutput || 'Runtime output will appear here.\n\nBootstrap the environment, install packages, or run a script to begin.'}
                  </pre>
                </OverlayScrollArea>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={() => setConsoleOutput('')} className="rounded px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em]" style={quietButtonStyle}>
                  Clear Console
                </button>
                {status?.boilerplate.readmePath && (
                  <button type="button" onClick={() => void openPath(status.boilerplate.readmePath)} className="rounded px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em]" style={quietButtonStyle}>
                    Open Runtime README
                  </button>
                )}
              </div>
            </section>
          </div>
        </div>
      </OverlayScrollArea>
    </div>
  );
}
