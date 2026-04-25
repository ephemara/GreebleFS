import type { CSSProperties } from 'react';
import { Download, Loader2, Settings2 } from '@/components/AppIcons';
import type {
  AccelerationRuntimeStatusSnapshot,
  GpuRuntimeStatusSnapshot,
  LinuxDisplayBackendPreference,
  LinuxDisplayBackendStatus,
} from '../../../generated/tauri';
import type {
  AccelerationProviderResolution,
  AccelerationRoutingModeOption,
  AccelerationWorkloadDefinition,
} from '../../../config/accelerationRuntime';
import type { GpuRuntimeTierOption } from '../../../config/gpuRuntime';
import { formatHotkeyLabel } from '../../../config/hotkeys';
import {
  SettingsActionStrip,
  SettingsRow,
  SettingsSectionBlock,
  SettingsSectionHeader,
  ThemeBadge,
} from '../SettingsPrimitives';

type AccelerationWorkloadRouteView = {
  definition: AccelerationWorkloadDefinition;
  resolution: AccelerationProviderResolution;
};

type TelemetrySessionStatusView = {
  config: {
    developer_telemetry_enabled: boolean;
    consumer_diagnostics_enabled: boolean;
  };
  recent_record_count: number;
  session_id: string;
  current_file_path: string | null;
};

export function SystemSettingsSection({
  platform,
  startupSyncPending,
  startupSyncError,
  launchAtStartup,
  startMobileShareOnBoot,
  hideAppInTray,
  showInTaskbar,
  developerMode,
  developerTelemetryEnabled,
  sourceTraceModeEnabled,
  consumerDiagnosticsEnabled,
  developerTelemetryCaptureMode,
  developerTelemetryPayloadMode,
  developerTelemetryMaxFileSizeMb,
  developerTelemetryWriteToFile,
  developerTelemetryShowInspector,
  consumerDiagnosticsIncludePluginRuntime,
  consumerDiagnosticsIncludeRendererRuntime,
  consumerDiagnosticsIncludePerfSamples,
  toggleDeveloperTelemetryHud,
  linuxDisplayBackendPreference,
  availableLinuxDisplayBackends,
  linuxDisplayBackendStatus,
  linuxDisplayBackendSyncPending,
  linuxDisplayBackendStatusSummary,
  telemetryStatusPending,
  telemetryStatusError,
  telemetryStatus,
  telemetryActionPending,
  telemetryNotice,
  systemPresentationState,
  border,
  accent,
  text,
  muted,
  settingsSelectStyle,
  settingsFieldStyle,
  gpuRuntimeSnapshot,
  gpuTierMode,
  gpuRuntimeDiagnosticsSummary,
  gpuRuntimeFeedStatus,
  gpuRuntimeTierOptions,
  gpuTierLabel,
  accelerationRoutingMode,
  accelerationRoutingModeOptions,
  accelerationProviderSummary,
  accelerationPipelineStatus,
  accelerationInstallRecommended,
  accelerationInstallButtonLabel,
  accelerationProbePending,
  accelerationInstallPending,
  accelerationAutoInstallPlanAvailable,
  accelerationRuntimeSnapshot,
  accelerationWorkloadRoutes,
  onSetLaunchAtStartup,
  onUpdateSystem,
  onSetHideAppInTray,
  onSetShowInTaskbar,
  onProbeAccelerationPipeline,
  onQueueAccelerationInstall,
  onSetLinuxDisplayBackendPreference,
  onRefreshTelemetryStatus,
  onTelemetryExport,
  onTelemetryClear,
}: {
  platform: 'windows' | 'macos' | 'linux' | 'unknown';
  startupSyncPending: boolean;
  startupSyncError: string | null;
  launchAtStartup: boolean;
  startMobileShareOnBoot: boolean;
  hideAppInTray: boolean;
  showInTaskbar: boolean;
  developerMode: boolean;
  developerTelemetryEnabled: boolean;
  sourceTraceModeEnabled: boolean;
  consumerDiagnosticsEnabled: boolean;
  developerTelemetryCaptureMode: 'raw' | 'sampled' | 'perf-only';
  developerTelemetryPayloadMode: 'metadata-only' | 'metadata+small-payloads';
  developerTelemetryMaxFileSizeMb: number;
  developerTelemetryWriteToFile: boolean;
  developerTelemetryShowInspector: boolean;
  consumerDiagnosticsIncludePluginRuntime: boolean;
  consumerDiagnosticsIncludeRendererRuntime: boolean;
  consumerDiagnosticsIncludePerfSamples: boolean;
  toggleDeveloperTelemetryHud: string;
  linuxDisplayBackendPreference: LinuxDisplayBackendPreference;
  availableLinuxDisplayBackends: string[];
  linuxDisplayBackendStatus: LinuxDisplayBackendStatus | null;
  linuxDisplayBackendSyncPending: boolean;
  linuxDisplayBackendStatusSummary: string | null;
  telemetryStatusPending: boolean;
  telemetryStatusError: string | null;
  telemetryStatus: TelemetrySessionStatusView | null;
  telemetryActionPending: 'export' | 'clear' | null;
  telemetryNotice: string | null;
  systemPresentationState: {
    trayVisible: boolean;
    taskbarVisible: boolean;
    recoveryPath: 'tray' | 'taskbar';
  };
  border: string;
  accent: string;
  text: string;
  muted: string;
  settingsSelectStyle: CSSProperties;
  settingsFieldStyle: CSSProperties;
  gpuRuntimeSnapshot: GpuRuntimeStatusSnapshot;
  gpuTierMode: string;
  gpuRuntimeDiagnosticsSummary: string;
  gpuRuntimeFeedStatus: string;
  gpuRuntimeTierOptions: readonly GpuRuntimeTierOption[];
  gpuTierLabel: string;
  accelerationRoutingMode: string;
  accelerationRoutingModeOptions: readonly AccelerationRoutingModeOption[];
  accelerationProviderSummary: string;
  accelerationPipelineStatus: string;
  accelerationInstallRecommended: boolean;
  accelerationInstallButtonLabel: string;
  accelerationProbePending: boolean;
  accelerationInstallPending: boolean;
  accelerationAutoInstallPlanAvailable: boolean;
  accelerationRuntimeSnapshot: AccelerationRuntimeStatusSnapshot;
  accelerationWorkloadRoutes: AccelerationWorkloadRouteView[];
  onSetLaunchAtStartup: (enabled: boolean) => Promise<void> | void;
  onUpdateSystem: (patch: Record<string, unknown>) => void;
  onSetHideAppInTray: (enabled: boolean) => void;
  onSetShowInTaskbar: (enabled: boolean) => void;
  onProbeAccelerationPipeline: () => Promise<void> | void;
  onQueueAccelerationInstall: () => Promise<void> | void;
  onSetLinuxDisplayBackendPreference: (preference: LinuxDisplayBackendPreference) => Promise<void> | void;
  onRefreshTelemetryStatus: () => Promise<void> | void;
  onTelemetryExport: () => Promise<void> | void;
  onTelemetryClear: () => Promise<void> | void;
}) {
  return (
    <section className="space-y-4" data-settings-section="system">
      <SettingsSectionHeader
        icon={<Settings2 size={12} />}
        title="System"
        subtitle="Machine-level startup behavior and OS integration state."
      />

      <div className="space-y-3">
        <SettingsRow
          title="Launch At Startup"
          description="Registers GreebleFS as a login item so the tray and overlay are available after sign-in."
          control={(
            <input
              type="checkbox"
              checked={launchAtStartup}
              disabled={startupSyncPending}
              onChange={event => void onSetLaunchAtStartup(event.target.checked)}
            />
          )}
        />
        <SettingsRow
          title="Start Mobile Share On Boot"
          description="When the main desktop host launches, immediately bring the phone-facing mobile share online using the current Mobile routing mode and the active explorer path fallback."
          control={(
            <input
              type="checkbox"
              checked={startMobileShareOnBoot}
              onChange={event => onUpdateSystem({ startMobileShareOnBoot: event.target.checked })}
            />
          )}
        />
        <SettingsRow
          title="Hide App In Tray"
          description={`Keeps a ${platform === 'macos' ? 'menu bar' : 'system tray'} entry available so the overlay can stay resident when the main window is hidden.`}
          control={(
            <input
              type="checkbox"
              checked={hideAppInTray}
              onChange={event => onSetHideAppInTray(event.target.checked)}
            />
          )}
        />
        <SettingsRow
          title="Show In Taskbar"
          description={`Shows the main window in the ${platform === 'macos' ? 'Dock' : 'taskbar'} while the shell is running so application mode behaves like a regular desktop app.`}
          control={(
            <input
              type="checkbox"
              checked={showInTaskbar}
              onChange={event => onSetShowInTaskbar(event.target.checked)}
            />
          )}
        />

        <SettingsSectionBlock
          title="GPU Runtime"
          subtitle="Controls the native wgpu offload lane used for image thumbnails, image preview rendering, and audio analysis. Safe forces CPU fallback."
          tone="muted"
          badges={[gpuTierLabel]}
        >
          <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
            {gpuRuntimeTierOptions.map(option => {
              const selected = option.id === gpuTierMode;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => onUpdateSystem({ gpuTierMode: option.id })}
                  className="rounded px-3 py-3 text-left transition-colors"
                  style={{
                    border: `1px solid ${selected ? accent : border}`,
                    background: selected ? `${accent}14` : 'rgba(255,255,255,0.03)',
                    color: text,
                  }}
                >
                  <div className="text-[10px] font-semibold uppercase tracking-[0.12em]">{option.label}</div>
                  <p className="mt-2 text-[11px] leading-4 opacity-65">{option.description}</p>
                </button>
              );
            })}
          </div>

          <div className="mt-3 rounded border px-3 py-2 text-[11px]" style={{ borderColor: border, background: 'rgba(255,255,255,0.025)', color: text }}>
            {gpuRuntimeDiagnosticsSummary}
          </div>
          <div className="mt-2 rounded border px-3 py-2 text-[11px]" style={{ borderColor: border, background: 'rgba(255,255,255,0.025)', color: muted }}>
            {gpuRuntimeFeedStatus}
          </div>
          {gpuRuntimeSnapshot.workloads.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {gpuRuntimeSnapshot.workloads.map(workload => (
                <ThemeBadge
                  key={workload.workloadId}
                  label={`${workload.label} · ${workload.ready ? 'GPU ready' : 'CPU fallback'} · exec ${workload.executions} · fallback ${workload.fallbackCount}`}
                />
              ))}
            </div>
          ) : null}
        </SettingsSectionBlock>

        <SettingsSectionBlock
          title="Acceleration Pipeline"
          subtitle="Cross-provider routing for CPU fallback, native wgpu, and the Python-sidecar CUDA / AI lane."
          tone="muted"
          actions={(
            <SettingsActionStrip>
              <button
                type="button"
                onClick={() => void onProbeAccelerationPipeline()}
                disabled={accelerationProbePending}
                className="rounded border px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] transition-colors"
                style={{
                  borderColor: accelerationProbePending ? border : accent,
                  background: accelerationProbePending ? 'rgba(255,255,255,0.03)' : `${accent}14`,
                  color: text,
                  opacity: accelerationProbePending ? 0.7 : 1,
                }}
              >
                {accelerationProbePending ? 'Probing…' : 'Probe CUDA / AI'}
              </button>
              <button
                type="button"
                onClick={() => void onQueueAccelerationInstall()}
                disabled={accelerationInstallPending || !accelerationAutoInstallPlanAvailable}
                className="inline-flex items-center gap-1.5 rounded border px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] transition-colors"
                style={{
                  borderColor: accelerationInstallPending || !accelerationAutoInstallPlanAvailable ? border : accent,
                  background: accelerationInstallPending || !accelerationAutoInstallPlanAvailable ? 'rgba(255,255,255,0.03)' : `${accent}14`,
                  color: text,
                  opacity: accelerationInstallPending || !accelerationAutoInstallPlanAvailable ? 0.7 : 1,
                }}
              >
                {accelerationInstallPending ? <Loader2 size={11} className="animate-spin" /> : <Download size={11} />}
                {accelerationInstallPending ? 'Opening Terminal…' : accelerationInstallButtonLabel}
              </button>
            </SettingsActionStrip>
          )}
        >
          <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
            {accelerationRoutingModeOptions.map(option => {
              const active = accelerationRoutingMode === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => onUpdateSystem({ accelerationRoutingMode: option.id })}
                  className="rounded px-3 py-3 text-left transition-colors"
                  style={{
                    border: `1px solid ${active ? accent : border}`,
                    background: active ? `${accent}14` : 'rgba(255,255,255,0.03)',
                    color: text,
                  }}
                >
                  <div className="text-[10px] font-semibold uppercase tracking-[0.12em]">{option.label}</div>
                  <p className="mt-2 text-[11px] leading-4 opacity-65">{option.description}</p>
                </button>
              );
            })}
          </div>

          <div className="mt-3 rounded border px-3 py-2 text-[11px]" style={{ borderColor: border, background: 'rgba(255,255,255,0.025)', color: text }}>
            {accelerationProviderSummary}
          </div>
          <div className="mt-2 rounded border px-3 py-2 text-[11px]" style={{ borderColor: border, background: 'rgba(255,255,255,0.025)', color: muted }}>
            {accelerationPipelineStatus}
          </div>
          <div className="mt-2 rounded border px-3 py-2 text-[11px]" style={{ borderColor: border, background: 'rgba(255,255,255,0.02)', color: muted }}>
            {accelerationInstallRecommended
              ? 'Blank runtime detected. Use Download to queue the recommended managed packages in Terminal.'
              : 'Download uses the current routing mode. Keep routing on Auto or CPU fallback if you do not want CUDA packages.'}
          </div>

          {accelerationRuntimeSnapshot.providers.length > 0 ? (
            <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-3">
              {accelerationRuntimeSnapshot.providers.map(provider => (
                <div key={provider.providerKind} className="rounded border px-3 py-3" style={{ borderColor: border, background: 'rgba(255,255,255,0.02)', color: text }}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.12em]">{provider.label}</div>
                    <span className="opacity-55">{provider.ready ? 'Ready' : provider.available ? 'Detected' : 'Unavailable'}</span>
                  </div>
                  <p className="mt-2 text-[11px] leading-4 opacity-70">{provider.detail}</p>
                  {provider.supportedWorkloadIds.length > 0 ? (
                    <div className="mt-2 text-[10px] uppercase tracking-[0.12em] opacity-50">
                      {provider.supportedWorkloadIds.join(' · ')}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}

          <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
            {accelerationWorkloadRoutes.map(route => (
              <div key={route.definition.id} className="rounded border px-3 py-3" style={{ borderColor: border, background: 'rgba(255,255,255,0.02)', color: text }}>
                <div className="flex items-center justify-between gap-2">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.12em]">{route.definition.label}</div>
                  <span className="opacity-55">{route.resolution.provider?.label ?? route.resolution.providerKind}</span>
                </div>
                <p className="mt-2 text-[11px] leading-4 opacity-65">{route.definition.description}</p>
                <div className="mt-2 text-[10px] uppercase tracking-[0.12em] opacity-50">
                  {route.resolution.ready
                    ? 'provider ready'
                    : route.resolution.available
                      ? 'provider detected'
                      : 'cpu fallback'}
                </div>
              </div>
            ))}
          </div>

          {accelerationRuntimeSnapshot.pythonProbe ? (
            <div className="mt-3 rounded border px-3 py-3 text-[11px]" style={{ borderColor: border, background: 'rgba(255,255,255,0.02)', color: text }}>
              <div className="font-semibold uppercase tracking-[0.12em] opacity-60">Python CUDA Probe</div>
              <p className="mt-2 opacity-70">
                {accelerationRuntimeSnapshot.pythonProbe.platform} · Python {accelerationRuntimeSnapshot.pythonProbe.pythonVersion}
                {accelerationRuntimeSnapshot.pythonProbe.cudaVisibleDevices
                  ? ` · CUDA_VISIBLE_DEVICES=${accelerationRuntimeSnapshot.pythonProbe.cudaVisibleDevices}`
                  : ''}
              </p>
              {accelerationRuntimeSnapshot.pythonProbe.torch.devices.length > 0 ? (
                <p className="mt-2 opacity-65">
                  Torch devices: {accelerationRuntimeSnapshot.pythonProbe.torch.devices.map(device => device.name).join(', ')}
                </p>
              ) : null}
              {accelerationRuntimeSnapshot.pythonProbe.optionalModules.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {accelerationRuntimeSnapshot.pythonProbe.optionalModules.map(module => (
                    <ThemeBadge
                      key={module.id}
                      label={`${module.id} · ${module.imported ? 'ready' : module.installed ? 'installed' : 'missing'}`}
                    />
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </SettingsSectionBlock>

        <SettingsRow
          title="Developer Mode"
          description="Enables live watchers and hot reload for plugins, shaders, animations, and explorer metadata. Leave this off for the normal production path and use manual refresh actions instead."
          control={<input type="checkbox" checked={developerMode} onChange={event => onUpdateSystem({ developerMode: event.target.checked })} />}
        />
        <SettingsRow
          title="Developer Telemetry"
          description="Records frontend, bridge, native, and plugin/runtime spans into structured session traces for deep debugging in dev and installed builds."
          control={<input type="checkbox" checked={developerTelemetryEnabled} onChange={event => onUpdateSystem({ developerTelemetryEnabled: event.target.checked })} />}
        />
        <SettingsRow
          title="Source Trace Mode"
          description={(
            <>
              Dev-only extra trace depth with source-aware stacks and callsites. Pressing {formatHotkeyLabel(toggleDeveloperTelemetryHud)} also arms this automatically when the HUD opens.
            </>
          )}
          control={<input type="checkbox" checked={sourceTraceModeEnabled} onChange={event => onUpdateSystem({ sourceTraceModeEnabled: event.target.checked })} />}
        />
        <SettingsRow
          title="Consumer Diagnostics"
          description="Keeps local diagnostic traces available for support bundles when themes, plugins, or renderers misbehave in production."
          control={<input type="checkbox" checked={consumerDiagnosticsEnabled} onChange={event => onUpdateSystem({ consumerDiagnosticsEnabled: event.target.checked })} />}
        />

        <div className="grid gap-3 md:grid-cols-2">
          <label className="rounded border px-3 py-3 text-[11px]" style={{ borderColor: border }}>
            <div className="font-semibold uppercase tracking-[0.12em] opacity-60">Capture Mode</div>
            <p className="mt-1 opacity-40">Raw keeps the deepest trace. Sampled trims noise. Perf-only records timing without full action detail.</p>
            <select
              aria-label="Telemetry Capture Mode"
              value={developerTelemetryCaptureMode}
              onChange={event => onUpdateSystem({ developerTelemetryCaptureMode: event.target.value })}
              className="mt-3 w-full rounded border bg-transparent px-2 py-2 text-[11px]"
              style={settingsSelectStyle}
            >
              <option value="raw">Raw</option>
              <option value="sampled">Sampled</option>
              <option value="perf-only">Perf Only</option>
            </select>
          </label>
          <label className="rounded border px-3 py-3 text-[11px]" style={{ borderColor: border }}>
            <div className="font-semibold uppercase tracking-[0.12em] opacity-60">Payload Detail</div>
            <p className="mt-1 opacity-40">Metadata-only avoids noisy args. Small payload mode preserves compact command details for debugging.</p>
            <select
              aria-label="Telemetry Payload Detail"
              value={developerTelemetryPayloadMode}
              onChange={event => onUpdateSystem({ developerTelemetryPayloadMode: event.target.value })}
              className="mt-3 w-full rounded border bg-transparent px-2 py-2 text-[11px]"
              style={settingsSelectStyle}
            >
              <option value="metadata-only">Metadata Only</option>
              <option value="metadata+small-payloads">Metadata + Small Payloads</option>
            </select>
          </label>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <label className="rounded border px-3 py-3 text-[11px]" style={{ borderColor: border }}>
            <div className="font-semibold uppercase tracking-[0.12em] opacity-60">Max Session File</div>
            <p className="mt-1 opacity-40">Hard cap before the native writer rolls to the next session file.</p>
            <input
              type="number"
              min={8}
              max={512}
              step={1}
              value={developerTelemetryMaxFileSizeMb}
              onChange={event => onUpdateSystem({ developerTelemetryMaxFileSizeMb: Number(event.target.value) })}
              className="mt-3 w-full rounded border bg-transparent px-2 py-2 text-[11px]"
              style={settingsFieldStyle}
            />
          </label>
          <SettingsRow
            title="Write Trace Files"
            description="Persist session JSONL traces to disk for later inspection and bundle export."
            control={<input type="checkbox" checked={developerTelemetryWriteToFile} onChange={event => onUpdateSystem({ developerTelemetryWriteToFile: event.target.checked })} />}
            className="h-full"
          />
          <SettingsRow
            title="Show Inspector Surface"
            description="Keeps the live telemetry inspector lane available for future dev HUD and diagnostics UI."
            control={<input type="checkbox" checked={developerTelemetryShowInspector} onChange={event => onUpdateSystem({ developerTelemetryShowInspector: event.target.checked })} />}
            className="h-full"
          />
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <SettingsRow
            title="Plugin Runtime Diagnostics"
            description="Include plugin attribution and execution context in consumer bundles."
            control={<input type="checkbox" checked={consumerDiagnosticsIncludePluginRuntime} onChange={event => onUpdateSystem({ consumerDiagnosticsIncludePluginRuntime: event.target.checked })} />}
            className="h-full"
          />
          <SettingsRow
            title="Renderer Diagnostics"
            description="Include renderer/theme execution context in exported support bundles."
            control={<input type="checkbox" checked={consumerDiagnosticsIncludeRendererRuntime} onChange={event => onUpdateSystem({ consumerDiagnosticsIncludeRendererRuntime: event.target.checked })} />}
            className="h-full"
          />
          <SettingsRow
            title="Perf Samples In Bundles"
            description="Keep performance timing summaries alongside trace files for support triage."
            control={<input type="checkbox" checked={consumerDiagnosticsIncludePerfSamples} onChange={event => onUpdateSystem({ consumerDiagnosticsIncludePerfSamples: event.target.checked })} />}
            className="h-full"
          />
        </div>

        {platform === 'linux' ? (
          <SettingsRow
            title="Linux Display Backend"
            description="Chooses whether GreebleFS launches through Auto selection, X11 fallback, or native Wayland. Auto will switch to X11 on NVIDIA Wayland sessions when XWayland is available."
            control={(
              <select
                aria-label="Linux Display Backend"
                value={linuxDisplayBackendPreference}
                disabled={linuxDisplayBackendSyncPending}
                onChange={event => void onSetLinuxDisplayBackendPreference(event.target.value as LinuxDisplayBackendPreference)}
                className="min-w-[140px] rounded border bg-transparent px-2 py-1 text-[11px]"
                style={settingsSelectStyle}
              >
                <option value="auto">Auto</option>
                <option value="x11" disabled={linuxDisplayBackendStatus != null && !availableLinuxDisplayBackends.includes('x11')}>
                  X11
                </option>
                <option value="wayland" disabled={linuxDisplayBackendStatus != null && !availableLinuxDisplayBackends.includes('wayland')}>
                  Wayland
                </option>
              </select>
            )}
          />
        ) : null}

        <SettingsSectionBlock
          title="Telemetry Session"
          subtitle={
            telemetryStatusPending
              ? 'Refreshing telemetry session status...'
              : telemetryStatusError
                ? `Telemetry unavailable: ${telemetryStatusError}`
                : telemetryStatus == null
                  ? 'No telemetry session has been created yet.'
                  : `Enabled ${telemetryStatus.config.developer_telemetry_enabled || telemetryStatus.config.consumer_diagnostics_enabled ? 'yes' : 'no'} · records ${telemetryStatus.recent_record_count} · session ${telemetryStatus.session_id} · file ${telemetryStatus.current_file_path ?? 'not started'}`
          }
          tone="muted"
          actions={(
            <SettingsActionStrip>
              <button type="button" onClick={() => void onRefreshTelemetryStatus()} className="rounded border px-3 py-2 transition-colors" style={{ borderColor: border }}>
                Refresh
              </button>
              <button type="button" onClick={() => void onTelemetryExport()} disabled={telemetryActionPending != null} className="rounded border px-3 py-2 transition-colors disabled:opacity-50" style={{ borderColor: border }}>
                {telemetryActionPending === 'export' ? 'Exporting...' : 'Export Support Bundle'}
              </button>
              <button type="button" onClick={() => void onTelemetryClear()} disabled={telemetryActionPending != null} className="rounded border px-3 py-2 transition-colors disabled:opacity-50" style={{ borderColor: border, color: '#fca5a5' }}>
                {telemetryActionPending === 'clear' ? 'Clearing...' : 'Clear Sessions'}
              </button>
            </SettingsActionStrip>
          )}
        >
          {telemetryNotice ? (
            <div className="rounded border px-3 py-2 text-[11px]" style={{ borderColor: border, color: text }}>
              {telemetryNotice}
            </div>
          ) : null}
        </SettingsSectionBlock>

        <div className="rounded border px-3 py-2 text-[11px]" style={{ borderColor: border, background: 'rgba(255,255,255,0.025)', color: startupSyncError ? '#fda4af' : muted }}>
          {startupSyncPending
            ? 'Updating OS startup registration...'
            : startupSyncError
              ? `Startup registration failed: ${startupSyncError}`
              : `Current status: startup ${launchAtStartup ? 'enabled' : 'disabled'} · mobile share boot ${startMobileShareOnBoot ? 'enabled' : 'disabled'} · tray ${systemPresentationState.trayVisible ? 'enabled' : 'disabled'} · ${platform === 'macos' ? 'Dock' : 'taskbar'} ${systemPresentationState.taskbarVisible ? 'enabled' : 'disabled'} · recovery path ${systemPresentationState.recoveryPath === 'tray' ? (platform === 'macos' ? 'Dock' : 'tray') : platform === 'macos' ? 'Dock' : 'taskbar'} · developer mode ${developerMode ? 'enabled' : 'disabled'} · deep telemetry ${developerTelemetryEnabled ? 'enabled' : 'disabled'} · source trace ${sourceTraceModeEnabled ? 'enabled' : 'disabled'} · consumer diagnostics ${consumerDiagnosticsEnabled ? 'enabled' : 'disabled'}${platform === 'linux' && linuxDisplayBackendStatusSummary ? ` · ${linuxDisplayBackendStatusSummary}` : ''}`}
        </div>
      </div>
    </section>
  );
}
