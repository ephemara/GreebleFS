import { useEffect, useState, type CSSProperties } from 'react';
import { Download, HardDrive, Loader2, RefreshCw, Settings2, Trash2 } from '@/components/AppIcons';
import type {
  AccelerationRuntimeStatusSnapshot,
  GpuRuntimeStatusSnapshot,
  LinuxDisplayBackendPreference,
  LinuxDisplayBackendStatus,
  LinuxNvidiaWebkitWorkaroundMode,
  PathIndexAccelerationStatus,
  RuntimeToolchainStatus,
} from '../../../generated/tauri';
import type {
  AccelerationProviderResolution,
  AccelerationRoutingModeOption,
  AccelerationWorkloadDefinition,
} from '../../../config/accelerationRuntime';
import type { GpuRuntimeTierOption } from '../../../config/gpuRuntime';
import { formatHotkeyLabel } from '../../../config/hotkeys';
import { getRuntimeToolchainStatus } from '../../../runtime/externalRuntimeBackend';
import {
  createGreebleNativeSurface,
  getGreebleNativeSurfaceTelemetry,
  type NativeSurfaceTelemetry,
} from '../../../runtime/nativeSurface';
import {
  SettingsCompactActionButton,
  SettingsCompactPath,
  SettingsCompactSection,
  SettingsControlRow,
  SettingsIconActionButton,
  SettingsInlineNotice,
  SettingsMetricStrip,
  SettingsRow,
  SettingsRowGroup,
  SettingsSectionScaffold,
  SettingsSelect,
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

type SemanticSearchProofView = {
  recordedAt: number;
  durationMs: number;
  queryKind: string | null;
  backendKind: string | null;
  providerKind: string | null;
  indexedFileCount: number | null;
  indexedChunkCount: number | null;
  staleIndex: boolean | null;
  forceCpu: boolean | null;
  resultCount: number | null;
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
  developerTestSettingsEnabled,
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
  linuxNvidiaWebkitWorkaroundMode,
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
  pathIndexAccelerationStatus,
  pathIndexAccelerationPending,
  pathIndexAccelerationActionPending,
  pathIndexAccelerationNotice,
  pathIndexAccelerationError,
  semanticSearchProof,
  onSetLaunchAtStartup,
  onUpdateSystem,
  onSetHideAppInTray,
  onSetShowInTaskbar,
  onProbeAccelerationPipeline,
  onQueueAccelerationInstall,
  onInstallPathIndexAccelerationService,
  onRefreshPathIndexAccelerationStatus,
  onEnablePathIndexAcceleration,
  onRebuildPathIndexAcceleration,
  onSetLinuxDisplayBackendPreference,
  onSetLinuxNvidiaWebkitWorkaroundMode,
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
  developerTestSettingsEnabled: boolean;
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
  linuxNvidiaWebkitWorkaroundMode: LinuxNvidiaWebkitWorkaroundMode;
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
  pathIndexAccelerationStatus: PathIndexAccelerationStatus | null;
  pathIndexAccelerationPending: boolean;
  pathIndexAccelerationActionPending: 'install' | 'enable' | 'rebuild' | null;
  pathIndexAccelerationNotice: string | null;
  pathIndexAccelerationError: string | null;
  semanticSearchProof: SemanticSearchProofView | null;
  onSetLaunchAtStartup: (enabled: boolean) => Promise<void> | void;
  onUpdateSystem: (patch: Record<string, unknown>) => void;
  onSetHideAppInTray: (enabled: boolean) => void;
  onSetShowInTaskbar: (enabled: boolean) => void;
  onProbeAccelerationPipeline: () => Promise<void> | void;
  onQueueAccelerationInstall: () => Promise<void> | void;
  onInstallPathIndexAccelerationService: () => Promise<void> | void;
  onRefreshPathIndexAccelerationStatus: () => Promise<void> | void;
  onEnablePathIndexAcceleration: () => Promise<void> | void;
  onRebuildPathIndexAcceleration: () => Promise<void> | void;
  onSetLinuxDisplayBackendPreference: (preference: LinuxDisplayBackendPreference) => Promise<void> | void;
  onSetLinuxNvidiaWebkitWorkaroundMode: (mode: LinuxNvidiaWebkitWorkaroundMode) => Promise<void> | void;
  onRefreshTelemetryStatus: () => Promise<void> | void;
  onTelemetryExport: () => Promise<void> | void;
  onTelemetryClear: () => Promise<void> | void;
}) {
  const semanticBackendLabel = [
    semanticSearchProof?.backendKind,
    semanticSearchProof?.providerKind,
  ]
    .filter(Boolean)
    .join(' / ');
  const semanticRecordedAtLabel =
    semanticSearchProof == null
      ? null
      : new Date(semanticSearchProof.recordedAt).toISOString();
  const [runtimeToolchainStatus, setRuntimeToolchainStatus] = useState<RuntimeToolchainStatus | null>(null);
  const [runtimeToolchainPending, setRuntimeToolchainPending] = useState(true);
  const [runtimeToolchainError, setRuntimeToolchainError] = useState<string | null>(null);
  const [nativeSurfaceTelemetry, setNativeSurfaceTelemetry] = useState<NativeSurfaceTelemetry | null>(null);
  const [nativeSurfacePending, setNativeSurfacePending] = useState(false);
  const [nativeSurfaceError, setNativeSurfaceError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setRuntimeToolchainPending(true);
    getRuntimeToolchainStatus()
      .then(status => {
        if (cancelled) return;
        setRuntimeToolchainStatus(status);
        setRuntimeToolchainError(null);
      })
      .catch(error => {
        if (cancelled) return;
        setRuntimeToolchainError(error instanceof Error ? error.message : String(error));
      })
      .finally(() => {
        if (!cancelled) {
          setRuntimeToolchainPending(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!developerTestSettingsEnabled) {
      setNativeSurfaceTelemetry(null);
      setNativeSurfacePending(false);
      setNativeSurfaceError(null);
      return () => {};
    }

    let cancelled = false;
    let intervalId: number | null = null;

    const refresh = () => {
      void getGreebleNativeSurfaceTelemetry()
        .then(telemetry => {
          if (cancelled) return;
          setNativeSurfaceTelemetry(telemetry);
          setNativeSurfaceError(telemetry.lastError);
        })
        .catch(error => {
          if (cancelled) return;
          setNativeSurfaceError(error instanceof Error ? error.message : String(error));
        });
    };

    setNativeSurfacePending(true);
    void createGreebleNativeSurface()
      .then(telemetry => {
        if (cancelled) return;
        setNativeSurfaceTelemetry(telemetry);
        setNativeSurfaceError(telemetry.lastError);
      })
      .catch(error => {
        if (cancelled) return;
        setNativeSurfaceError(error instanceof Error ? error.message : String(error));
      })
      .finally(() => {
        if (!cancelled) {
          setNativeSurfacePending(false);
        }
      });

    refresh();
    intervalId = window.setInterval(refresh, 4000);

    return () => {
      cancelled = true;
      if (intervalId != null) {
        window.clearInterval(intervalId);
      }
    };
  }, [developerTestSettingsEnabled]);

  const kainProbe = runtimeToolchainStatus?.kain ?? null;
  const kainStatusLabel = runtimeToolchainPending
    ? 'Kain checking'
    : kainProbe?.installed
      ? `Kain ${kainProbe.version ?? 'ready'}`
      : 'Kain missing';
  const compactPath = (value: string | null | undefined) => {
    if (!value) return 'path n/a';
    const normalized = value.replace(/\\/g, '/');
    const parts = normalized.split('/').filter(Boolean);
    return parts.slice(Math.max(0, parts.length - 4)).join('/');
  };

  const compactSelectStyle: CSSProperties = {
    ...settingsSelectStyle,
    borderColor: border,
    color: text,
  };
  const compactFieldStyle: CSSProperties = {
    ...settingsFieldStyle,
    borderColor: border,
    color: text,
  };
  const borderTopStyle: CSSProperties = { borderColor: border };
  const rowGroupFlatStyle: CSSProperties = {
    borderWidth: 0,
    background: 'transparent',
  };
  const mutedTextStyle: CSSProperties = { color: muted };
  const trayLabel = platform === 'macos' ? 'Menu Bar' : 'Tray';
  const taskbarLabel = platform === 'macos' ? 'Dock' : 'Taskbar';
  const recoveryTargetLabel =
    systemPresentationState.recoveryPath === 'tray'
      ? platform === 'macos'
        ? 'Dock'
        : 'tray'
      : platform === 'macos'
        ? 'Dock'
        : 'taskbar';
  const selectedGpuTierOption = gpuRuntimeTierOptions.find(option => option.id === gpuTierMode);
  const selectedAccelerationRoutingOption = accelerationRoutingModeOptions.find(option => option.id === accelerationRoutingMode);
  const telemetryConfigEnabled =
    telemetryStatus?.config.developer_telemetry_enabled
    || telemetryStatus?.config.consumer_diagnostics_enabled
    || developerTelemetryEnabled
    || consumerDiagnosticsEnabled;
  const startupStatusSummary = startupSyncPending
    ? 'Syncing OS startup registration'
    : startupSyncError
      ? `Startup registration failed: ${startupSyncError}`
      : `startup ${launchAtStartup ? 'on' : 'off'} · mobile ${startMobileShareOnBoot ? 'on' : 'off'} · ${trayLabel.toLowerCase()} ${systemPresentationState.trayVisible ? 'on' : 'off'} · ${taskbarLabel.toLowerCase()} ${systemPresentationState.taskbarVisible ? 'on' : 'off'} · recovery ${recoveryTargetLabel} · dev ${developerMode ? 'on' : 'off'} · telemetry ${developerTelemetryEnabled ? 'on' : 'off'} · source trace ${sourceTraceModeEnabled ? 'on' : 'off'} · diagnostics ${consumerDiagnosticsEnabled ? 'on' : 'off'}${platform === 'linux' && linuxDisplayBackendStatusSummary ? ` · ${linuxDisplayBackendStatusSummary}` : ''}`;
  const telemetrySessionSummary = telemetryStatusPending
    ? 'Refreshing'
    : telemetryStatusError
      ? `Unavailable: ${telemetryStatusError}`
      : telemetryStatus == null
        ? 'No session'
        : `${telemetryConfigEnabled ? 'enabled' : 'idle'} · ${telemetryStatus.recent_record_count} records · ${telemetryStatus.session_id}`;
  const gpuRuntimeSummary =
    `${gpuRuntimeSnapshot.adapterName ?? 'adapter n/a'} · ${gpuRuntimeSnapshot.backendName ?? 'backend n/a'} · ${gpuRuntimeSnapshot.computeAvailable ? 'compute ready' : 'compute unavailable'}`;
  const accelerationInstallNotice = accelerationInstallRecommended
    ? 'Blank runtime detected. Queue managed packages from Terminal.'
    : 'Install follows the selected routing mode.';
  const pathIndexAccelerationSummary = pathIndexAccelerationStatus == null
    ? 'USN daemon status pending'
    : `${pathIndexAccelerationStatus.running ? 'service running' : 'service offline'} · ${pathIndexAccelerationStatus.profileRegistered ? 'profile linked' : 'profile unlinked'} · ${pathIndexAccelerationStatus.volumes.length} drives`;
  const pathIndexHealthy = pathIndexAccelerationStatus?.volumes.some(
    volume => volume.source === 'windowsUsnService'
      && volume.state === 'ready'
      && volume.journalId != null
      && volume.lastUsn != null,
  ) ?? false;
  const nativeSurfaceSummary = nativeSurfaceTelemetry == null
    ? (nativeSurfacePending ? 'starting' : 'surface pending')
    : `${nativeSurfaceTelemetry.visualHostingMode} · ${nativeSurfaceTelemetry.framesRendered} frames`;

  return (
    <SettingsSectionScaffold
      sectionKey="system"
      className="space-y-2.5"
      icon={<Settings2 size={12} />}
      title="System"
      subtitle="Startup, runtime routing, telemetry."
      badges={[platform, gpuTierLabel]}
    >
      <SettingsMetricStrip
        items={[
          {
            id: 'startup',
            label: 'Startup',
            value: launchAtStartup ? 'enabled' : 'disabled',
            tone: launchAtStartup ? 'accent' : 'default',
          },
          {
            id: 'mobile',
            label: 'Mobile Share',
            value: startMobileShareOnBoot ? 'boot' : 'manual',
            tone: startMobileShareOnBoot ? 'accent' : 'default',
          },
          {
            id: 'presentation',
            label: `${trayLabel} / ${taskbarLabel}`,
            value: `${systemPresentationState.trayVisible ? 'tray on' : 'tray off'} · ${systemPresentationState.taskbarVisible ? 'bar on' : 'bar off'}`,
          },
          {
            id: 'gpu',
            label: 'GPU',
            value: gpuTierLabel,
            tone: gpuRuntimeSnapshot.computeAvailable ? 'accent' : 'default',
          },
          {
            id: 'acceleration',
            label: 'Routing',
            value: selectedAccelerationRoutingOption?.label ?? accelerationRoutingMode,
            tone: accelerationRuntimeSnapshot.providers.some(provider => provider.ready) ? 'accent' : 'default',
          },
          {
            id: 'telemetry',
            label: 'Telemetry',
            value: telemetryConfigEnabled ? 'active' : 'quiet',
            tone: telemetryConfigEnabled ? 'accent' : 'default',
          },
        ]}
      />

      <SettingsInlineNotice tone={startupSyncError ? 'danger' : startupSyncPending ? 'warning' : 'muted'}>
        {startupStatusSummary}
      </SettingsInlineNotice>

      <SettingsCompactSection
        title="Startup + Shell"
        subtitle={`${trayLabel} ${systemPresentationState.trayVisible ? 'on' : 'off'} · ${taskbarLabel} ${systemPresentationState.taskbarVisible ? 'on' : 'off'} · recovery ${recoveryTargetLabel}`}
      >
        <SettingsRowGroup className="rounded-none" style={rowGroupFlatStyle}>
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
        </SettingsRowGroup>
      </SettingsCompactSection>

      <SettingsCompactSection
        title="GPU Runtime"
        subtitle={gpuRuntimeDiagnosticsSummary}
        actions={<ThemeBadge label={gpuTierLabel} active={gpuRuntimeSnapshot.computeAvailable} />}
      >
        <SettingsControlRow
          label="Mode"
          detail={selectedGpuTierOption?.description ?? gpuTierLabel}
          control={(
            <SettingsSelect
              aria-label="GPU Runtime Mode"
              value={gpuTierMode}
              onChange={event => onUpdateSystem({ gpuTierMode: event.target.value })}
              className="w-full max-w-xs"
              style={compactSelectStyle}
            >
              {gpuRuntimeTierOptions.map(option => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </SettingsSelect>
          )}
        />
        <SettingsInlineNotice
          tone={gpuRuntimeSnapshot.computeAvailable ? 'success' : 'muted'}
          className="mx-3 my-2"
        >
          {gpuRuntimeFeedStatus}
        </SettingsInlineNotice>
        {gpuRuntimeSnapshot.workloads.length > 0 ? (
          <div className="flex min-w-0 flex-wrap gap-1.5 border-t px-3 py-2" style={borderTopStyle}>
            {gpuRuntimeSnapshot.workloads.map(workload => (
              <ThemeBadge
                key={workload.workloadId}
                label={`${workload.label} · ${workload.ready ? 'GPU ready' : 'CPU fallback'} · exec ${workload.executions} · fallback ${workload.fallbackCount}`}
                active={workload.ready}
              />
            ))}
          </div>
        ) : null}
      </SettingsCompactSection>

      <SettingsCompactSection
        title="Acceleration"
        subtitle={accelerationProviderSummary}
        actions={(
          <>
            <SettingsIconActionButton
              aria-label="Probe CUDA / AI"
              title="Probe CUDA / AI"
              onClick={() => void onProbeAccelerationPipeline()}
              disabled={accelerationProbePending}
              active={accelerationProbePending}
              accent={accent}
            >
              {accelerationProbePending ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
            </SettingsIconActionButton>
            <SettingsCompactActionButton
              onClick={() => void onQueueAccelerationInstall()}
              disabled={accelerationInstallPending || !accelerationAutoInstallPlanAvailable}
              active={accelerationInstallRecommended}
              accent={accent}
              title={accelerationInstallButtonLabel}
            >
              {accelerationInstallPending ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
              <span className="truncate">
                {accelerationInstallPending ? 'Opening' : accelerationInstallButtonLabel}
              </span>
            </SettingsCompactActionButton>
          </>
        )}
      >
        <SettingsControlRow
          label="Routing"
          detail={selectedAccelerationRoutingOption?.description ?? accelerationPipelineStatus}
          control={(
            <SettingsSelect
              aria-label="Acceleration Routing Mode"
              value={accelerationRoutingMode}
              onChange={event => onUpdateSystem({ accelerationRoutingMode: event.target.value })}
              className="w-full max-w-xs"
              style={compactSelectStyle}
            >
              {accelerationRoutingModeOptions.map(option => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </SettingsSelect>
          )}
        />
        <SettingsInlineNotice tone="muted" className="mx-3 my-2">
          {accelerationPipelineStatus}
        </SettingsInlineNotice>
        <SettingsInlineNotice
          tone={accelerationInstallRecommended ? 'warning' : 'muted'}
          className="mx-3 my-2"
        >
          {accelerationInstallNotice}
        </SettingsInlineNotice>

        {accelerationRuntimeSnapshot.providers.length > 0 ? (
          <>
            <div className="border-t px-3 py-1.5 text-[9px] font-semibold uppercase opacity-50" style={borderTopStyle}>
              Providers
            </div>
            {accelerationRuntimeSnapshot.providers.map(provider => {
              const status = provider.ready
                ? 'Ready'
                : provider.available
                  ? 'Detected'
                  : 'Unavailable';
              return (
                <SettingsControlRow
                  key={provider.providerKind}
                  label={provider.label}
                  detail={provider.detail}
                  control={<ThemeBadge label={status} active={provider.ready} />}
                  action={provider.supportedWorkloadIds.length > 0 ? (
                    <ThemeBadge label={`${provider.supportedWorkloadIds.length} workloads`} />
                  ) : undefined}
                />
              );
            })}
          </>
        ) : null}

        {accelerationWorkloadRoutes.length > 0 ? (
          <>
            <div className="border-t px-3 py-1.5 text-[9px] font-semibold uppercase opacity-50" style={borderTopStyle}>
              Workloads
            </div>
            {accelerationWorkloadRoutes.map(route => {
              const status = route.resolution.ready
                ? 'provider ready'
                : route.resolution.available
                  ? 'provider detected'
                  : 'cpu fallback';
              return (
                <SettingsControlRow
                  key={route.definition.id}
                  label={route.definition.label}
                  detail={`${status} · ${route.definition.description}`}
                  control={<ThemeBadge label={route.resolution.provider?.label ?? route.resolution.providerKind} active={route.resolution.ready} />}
                />
              );
            })}
          </>
        ) : null}

        {accelerationRuntimeSnapshot.pythonProbe ? (
          <>
            <SettingsControlRow
              label="Python CUDA"
              detail={`${accelerationRuntimeSnapshot.pythonProbe.platform} · Python ${accelerationRuntimeSnapshot.pythonProbe.pythonVersion}${accelerationRuntimeSnapshot.pythonProbe.cudaVisibleDevices ? ` · CUDA_VISIBLE_DEVICES=${accelerationRuntimeSnapshot.pythonProbe.cudaVisibleDevices}` : ''}`}
              control={(
                <ThemeBadge
                  label={`${accelerationRuntimeSnapshot.pythonProbe.torch.devices.length} torch devices`}
                  active={accelerationRuntimeSnapshot.pythonProbe.torch.devices.length > 0}
                />
              )}
            />
            {accelerationRuntimeSnapshot.pythonProbe.torch.devices.length > 0 ? (
              <SettingsInlineNotice tone="muted" className="mx-3 my-2">
                Torch devices: {accelerationRuntimeSnapshot.pythonProbe.torch.devices.map(device => device.name).join(', ')}
              </SettingsInlineNotice>
            ) : null}
            {accelerationRuntimeSnapshot.pythonProbe.optionalModules.length > 0 ? (
              <div className="flex min-w-0 flex-wrap gap-1.5 border-t px-3 py-2" style={borderTopStyle}>
                {accelerationRuntimeSnapshot.pythonProbe.optionalModules.map(module => (
                  <ThemeBadge
                    key={module.id}
                    label={`${module.id} · ${module.imported ? 'ready' : module.installed ? 'installed' : 'missing'}`}
                    active={module.imported === true}
                  />
                ))}
              </div>
            ) : null}
          </>
        ) : null}
      </SettingsCompactSection>

      {platform === 'windows' ? (
        <SettingsCompactSection
          title="Path Index"
          subtitle={pathIndexAccelerationSummary}
          actions={(
            <>
              <SettingsIconActionButton
                aria-label="Refresh Path Index Acceleration"
                title="Refresh Path Index Acceleration"
                onClick={() => void onRefreshPathIndexAccelerationStatus()}
                disabled={pathIndexAccelerationPending}
              >
                {pathIndexAccelerationPending ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
              </SettingsIconActionButton>
              <SettingsCompactActionButton
                onClick={() => void onInstallPathIndexAccelerationService()}
                disabled={pathIndexAccelerationActionPending != null}
                active={pathIndexAccelerationActionPending === 'install'}
                accent={accent}
              >
                {pathIndexAccelerationActionPending === 'install' ? <Loader2 size={12} className="animate-spin" /> : <Settings2 size={12} />}
                <span className="truncate">{pathIndexAccelerationStatus?.installed ? 'Repair' : 'Install'}</span>
              </SettingsCompactActionButton>
              <SettingsCompactActionButton
                onClick={() => void onEnablePathIndexAcceleration()}
                disabled={pathIndexAccelerationActionPending != null}
                active={pathIndexAccelerationStatus?.running === true}
                accent={accent}
              >
                {pathIndexAccelerationActionPending === 'enable' ? <Loader2 size={12} className="animate-spin" /> : <HardDrive size={12} />}
                <span className="truncate">Enable</span>
              </SettingsCompactActionButton>
              <SettingsCompactActionButton
                onClick={() => void onRebuildPathIndexAcceleration()}
                disabled={pathIndexAccelerationActionPending != null}
                active={pathIndexAccelerationActionPending === 'rebuild'}
                accent={accent}
              >
                {pathIndexAccelerationActionPending === 'rebuild' ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                <span className="truncate">Rebuild</span>
              </SettingsCompactActionButton>
            </>
          )}
        >
          <SettingsMetricStrip
            items={[
              {
                id: 'usn-service',
                label: 'Daemon',
                value: pathIndexAccelerationStatus?.running ? 'running' : 'offline',
                tone: pathIndexAccelerationStatus?.running ? 'accent' : 'default',
              },
              {
                id: 'usn-profile',
                label: 'Profile',
                value: pathIndexAccelerationStatus?.profileRegistered ? 'linked' : 'unlinked',
                tone: pathIndexAccelerationStatus?.profileRegistered ? 'accent' : 'default',
              },
              {
                id: 'usn-drives',
                label: 'Drives',
                value: String(pathIndexAccelerationStatus?.volumes.length ?? 0),
                tone: pathIndexHealthy ? 'accent' : 'default',
              },
            ]}
          />
          {pathIndexAccelerationNotice ? (
            <SettingsInlineNotice tone="success" className="mx-3 my-2">
              {pathIndexAccelerationNotice}
            </SettingsInlineNotice>
          ) : null}
          {pathIndexAccelerationError ? (
            <SettingsInlineNotice tone="danger" className="mx-3 my-2">
              {pathIndexAccelerationError}
            </SettingsInlineNotice>
          ) : null}
          {pathIndexAccelerationStatus?.volumes.length ? (
            pathIndexAccelerationStatus.volumes.map(volume => (
              <SettingsControlRow
                key={volume.volumeKey}
                label={volume.driveRoot}
                detail={`journal ${volume.journalId ?? 'n/a'} · usn ${volume.lastUsn ?? 'n/a'} · entries ${volume.entryCount}`}
                control={<ThemeBadge label={volume.state} active={volume.state === 'ready'} />}
                action={<ThemeBadge label={volume.source} active={volume.source === 'windowsUsnService'} />}
              />
            ))
          ) : (
            <SettingsInlineNotice tone="muted" className="mx-3 my-2">
              {pathIndexAccelerationStatus?.running
                ? 'No drive index registered yet.'
                : 'Daemon service is not responding.'}
            </SettingsInlineNotice>
          )}
        </SettingsCompactSection>
      ) : null}

      <SettingsCompactSection
        title="Diagnostics"
        subtitle={`HUD ${formatHotkeyLabel(toggleDeveloperTelemetryHud)} · trace ${sourceTraceModeEnabled ? 'on' : 'off'} · bundles ${consumerDiagnosticsEnabled ? 'on' : 'off'}`}
      >
        <SettingsRowGroup className="rounded-none" style={rowGroupFlatStyle}>
          <SettingsRow
            title="Developer Mode"
            description="Enables live watchers and hot reload for plugins, shaders, animations, and explorer metadata. Leave this off for the normal production path and use manual refresh actions instead."
            control={<input type="checkbox" checked={developerMode} onChange={event => onUpdateSystem({ developerMode: event.target.checked })} />}
          />
          <SettingsRow
            title="Developer Test Settings"
            description="Exposes release-safe proof surfaces for GPU workload telemetry and semantic-search routing so backend validation can happen without dev-only HUDs."
            control={<input type="checkbox" checked={developerTestSettingsEnabled} onChange={event => onUpdateSystem({ developerTestSettingsEnabled: event.target.checked })} />}
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
        </SettingsRowGroup>

        <SettingsControlRow
          label="Capture"
          detail="trace depth"
          control={(
            <SettingsSelect
              aria-label="Telemetry Capture Mode"
              value={developerTelemetryCaptureMode}
              onChange={event => onUpdateSystem({ developerTelemetryCaptureMode: event.target.value })}
              className="w-full max-w-xs"
              style={compactSelectStyle}
            >
              <option value="raw">Raw</option>
              <option value="sampled">Sampled</option>
              <option value="perf-only">Perf Only</option>
            </SettingsSelect>
          )}
        />
        <SettingsControlRow
          label="Payload"
          detail="argument detail"
          control={(
            <SettingsSelect
              aria-label="Telemetry Payload Detail"
              value={developerTelemetryPayloadMode}
              onChange={event => onUpdateSystem({ developerTelemetryPayloadMode: event.target.value })}
              className="w-full max-w-xs"
              style={compactSelectStyle}
            >
              <option value="metadata-only">Metadata Only</option>
              <option value="metadata+small-payloads">Metadata + Small Payloads</option>
            </SettingsSelect>
          )}
        />
        <SettingsControlRow
          label="Max Session File"
          detail="MB per JSONL session"
          control={(
            <input
              aria-label="Telemetry Max Session File"
              type="number"
              min={8}
              max={512}
              step={1}
              value={developerTelemetryMaxFileSizeMb}
              onChange={event => onUpdateSystem({ developerTelemetryMaxFileSizeMb: Number(event.target.value) })}
              className="h-7 w-28 rounded border bg-transparent px-2 text-[11px] outline-none"
              style={compactFieldStyle}
            />
          )}
        />

        <SettingsRowGroup className="rounded-none" style={rowGroupFlatStyle}>
          <SettingsRow
            title="Write Trace Files"
            description="Persist session JSONL traces to disk for later inspection and bundle export."
            control={<input type="checkbox" checked={developerTelemetryWriteToFile} onChange={event => onUpdateSystem({ developerTelemetryWriteToFile: event.target.checked })} />}
          />
          <SettingsRow
            title="Show Inspector Surface"
            description="Keeps the live telemetry inspector lane available for future dev HUD and diagnostics UI."
            control={<input type="checkbox" checked={developerTelemetryShowInspector} onChange={event => onUpdateSystem({ developerTelemetryShowInspector: event.target.checked })} />}
          />
          <SettingsRow
            title="Plugin Runtime Diagnostics"
            description="Include plugin attribution and execution context in consumer bundles."
            control={<input type="checkbox" checked={consumerDiagnosticsIncludePluginRuntime} onChange={event => onUpdateSystem({ consumerDiagnosticsIncludePluginRuntime: event.target.checked })} />}
          />
          <SettingsRow
            title="Renderer Diagnostics"
            description="Include renderer/theme execution context in exported support bundles."
            control={<input type="checkbox" checked={consumerDiagnosticsIncludeRendererRuntime} onChange={event => onUpdateSystem({ consumerDiagnosticsIncludeRendererRuntime: event.target.checked })} />}
          />
          <SettingsRow
            title="Perf Samples In Bundles"
            description="Keep performance timing summaries alongside trace files for support triage."
            control={<input type="checkbox" checked={consumerDiagnosticsIncludePerfSamples} onChange={event => onUpdateSystem({ consumerDiagnosticsIncludePerfSamples: event.target.checked })} />}
          />
        </SettingsRowGroup>
      </SettingsCompactSection>

      {developerTestSettingsEnabled ? (
        <SettingsCompactSection
          title="Proofs"
          subtitle={`${gpuRuntimeSummary} · ${semanticSearchProof ? 'semantic captured' : 'semantic pending'} · ${kainStatusLabel}`}
          actions={<ThemeBadge label={kainStatusLabel} active={kainProbe?.installed === true} />}
        >
          <SettingsMetricStrip
            items={[
              {
                id: 'gpu-proof',
                label: 'GPU Workload',
                value: gpuRuntimeSummary,
                tone: gpuRuntimeSnapshot.computeAvailable ? 'accent' : 'default',
              },
              {
                id: 'semantic-proof',
                label: 'Semantic',
                value: semanticSearchProof
                  ? `${semanticBackendLabel || 'backend unknown'} · ${semanticSearchProof.durationMs.toFixed(2)} ms`
                  : 'pending',
                tone: semanticSearchProof ? 'accent' : 'default',
              },
              {
                id: 'kain-proof',
                label: 'Kain',
                value: `${runtimeToolchainPending ? 'checking' : kainProbe?.installed ? 'ready' : 'missing'} · ${kainProbe?.version ?? 'version n/a'}`,
                tone: kainProbe?.installed ? 'accent' : 'default',
              },
              {
                id: 'native-surface-proof',
                label: 'Native Surface',
                value: nativeSurfaceSummary,
                tone: nativeSurfaceTelemetry?.wgpuSurfaceReady ? 'accent' : 'default',
              },
            ]}
          />

          <SettingsControlRow
            label="Backplane"
            detail={nativeSurfaceTelemetry ? `${nativeSurfaceTelemetry.backend ?? 'backend n/a'} · ${nativeSurfaceTelemetry.adapterName ?? 'adapter n/a'}${nativeSurfaceTelemetry.averageFrameMs != null ? ` · ${nativeSurfaceTelemetry.averageFrameMs.toFixed(2)} ms` : ''}` : 'pending'}
            control={<ThemeBadge label={nativeSurfaceTelemetry?.running ? 'running' : 'idle'} active={nativeSurfaceTelemetry?.wgpuSurfaceReady === true} />}
            action={<ThemeBadge label={nativeSurfaceTelemetry?.surfaceFormat ?? 'format n/a'} />}
          />

          {nativeSurfaceError ? (
            <SettingsInlineNotice tone={nativeSurfaceTelemetry?.available ? 'warning' : 'danger'} className="mx-3 my-2">
              {nativeSurfaceError}
            </SettingsInlineNotice>
          ) : null}

          {gpuRuntimeSnapshot.workloads.length > 0 ? (
            <>
              <div className="border-t px-3 py-1.5 text-[9px] font-semibold uppercase opacity-50" style={borderTopStyle}>
                GPU Workloads
              </div>
              {gpuRuntimeSnapshot.workloads.map(workload => (
                <SettingsControlRow
                  key={workload.workloadId}
                  label={workload.label}
                  detail={`exec ${workload.executions} · fallback ${workload.fallbackCount} · last ${workload.lastExecutionPath ?? 'never'}`}
                  control={<ThemeBadge label={workload.ready ? 'GPU ready' : 'Fallback active'} active={workload.ready} />}
                  action={workload.kernelLabels.length > 0 ? (
                    <ThemeBadge label={workload.kernelLabels.join(' · ')} />
                  ) : undefined}
                />
              ))}
              {gpuRuntimeSnapshot.workloads.map(workload => (
                workload.lastFallbackReason || workload.lastError ? (
                  <SettingsInlineNotice
                    key={`${workload.workloadId}-notice`}
                    tone={workload.lastError ? 'danger' : 'muted'}
                    className="mx-3 my-2"
                  >
                    {workload.lastError
                      ? `${workload.label}: ${workload.lastError}`
                      : `${workload.label}: ${workload.lastFallbackReason}`}
                  </SettingsInlineNotice>
                ) : null
              ))}
            </>
          ) : (
            <SettingsInlineNotice tone="muted" className="mx-3 my-2">
              No workload executions recorded.
            </SettingsInlineNotice>
          )}

          {semanticSearchProof ? (
            <>
              <SettingsControlRow
                label="Semantic Search"
                detail={`${semanticSearchProof.queryKind ?? 'query kind unknown'} · ${semanticRecordedAtLabel ?? 'time n/a'}`}
                control={<ThemeBadge label={semanticBackendLabel || 'backend unknown'} active />}
              />
              <div className="flex min-w-0 flex-wrap gap-1.5 border-t px-3 py-2" style={borderTopStyle}>
                <ThemeBadge label={`files ${semanticSearchProof.indexedFileCount ?? 'n/a'}`} />
                <ThemeBadge label={`chunks ${semanticSearchProof.indexedChunkCount ?? 'n/a'}`} />
                <ThemeBadge label={semanticSearchProof.staleIndex ? 'stale index' : 'fresh index'} active={semanticSearchProof.staleIndex === false} />
                <ThemeBadge label={semanticSearchProof.forceCpu ? 'forced CPU' : 'accelerator allowed'} active={semanticSearchProof.forceCpu === false} />
                <ThemeBadge label={`results ${semanticSearchProof.resultCount ?? 'n/a'}`} />
              </div>
            </>
          ) : (
            <SettingsInlineNotice tone="muted" className="mx-3 my-2">
              Run semantic search to capture proof.
            </SettingsInlineNotice>
          )}

          <SettingsControlRow
            label="Kain Toolchain"
            detail={runtimeToolchainStatus?.kainManifestPath ? 'manifest pinned' : 'manifest n/a'}
            control={<ThemeBadge label={kainProbe?.installed ? 'kain-script enabled' : 'kain-script offline'} active={kainProbe?.installed === true} />}
            action={<ThemeBadge label={runtimeToolchainStatus?.kainManifestPath ? 'manifest pinned' : 'manifest n/a'} />}
          />
          <SettingsControlRow
            label="Kain Path"
            detail={runtimeToolchainError ?? kainProbe?.error ?? 'resolved executable'}
            control={(
              <SettingsCompactPath
                value={runtimeToolchainError ?? kainProbe?.error ?? compactPath(kainProbe?.executablePath)}
                title={runtimeToolchainError ?? kainProbe?.error ?? kainProbe?.executablePath ?? undefined}
              />
            )}
          />
        </SettingsCompactSection>
      ) : null}

      {platform === 'linux' ? (
        <SettingsCompactSection
          title="Linux Host"
          subtitle={linuxDisplayBackendStatusSummary ?? 'Display backend policy'}
        >
          <SettingsControlRow
            label="Display Backend"
            detail="startup backend"
            control={(
              <SettingsSelect
                aria-label="Linux Display Backend"
                value={linuxDisplayBackendPreference}
                disabled={linuxDisplayBackendSyncPending}
                onChange={event => void onSetLinuxDisplayBackendPreference(event.target.value as LinuxDisplayBackendPreference)}
                className="w-full max-w-xs"
                style={compactSelectStyle}
              >
                <option value="auto">Auto</option>
                <option value="x11" disabled={linuxDisplayBackendStatus != null && !availableLinuxDisplayBackends.includes('x11')}>
                  X11
                </option>
                <option value="wayland" disabled={linuxDisplayBackendStatus != null && !availableLinuxDisplayBackends.includes('wayland')}>
                  Wayland
                </option>
              </SettingsSelect>
            )}
          />
          <SettingsControlRow
            label="NVIDIA WebKit"
            detail={linuxDisplayBackendStatus != null ? `NVIDIA GPU ${linuxDisplayBackendStatus.nvidiaGpuDetected ? 'detected' : 'not detected'}` : 'restart required'}
            control={(
              <SettingsSelect
                aria-label="NVIDIA WebKit Workaround"
                value={linuxNvidiaWebkitWorkaroundMode}
                disabled={linuxDisplayBackendSyncPending}
                onChange={event => void onSetLinuxNvidiaWebkitWorkaroundMode(event.target.value as LinuxNvidiaWebkitWorkaroundMode)}
                className="w-full max-w-xs"
                style={compactSelectStyle}
              >
                <option value="auto">Auto</option>
                <option value="force-on">Force On</option>
                <option value="force-off">Force Off</option>
              </SettingsSelect>
            )}
          />
          {linuxDisplayBackendStatusSummary ? (
            <SettingsInlineNotice tone="muted" className="mx-3 my-2">
              {linuxDisplayBackendStatusSummary}
            </SettingsInlineNotice>
          ) : null}
        </SettingsCompactSection>
      ) : null}

      <SettingsCompactSection
        title="Telemetry Session"
        subtitle={telemetrySessionSummary}
        actions={(
          <>
            <SettingsIconActionButton
              aria-label="Refresh Telemetry Status"
              title="Refresh Telemetry Status"
              onClick={() => void onRefreshTelemetryStatus()}
              disabled={telemetryStatusPending}
            >
              {telemetryStatusPending ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
            </SettingsIconActionButton>
            <SettingsIconActionButton
              aria-label="Export Support Bundle"
              title="Export Support Bundle"
              onClick={() => void onTelemetryExport()}
              disabled={telemetryActionPending != null}
              active={telemetryActionPending === 'export'}
              accent={accent}
            >
              {telemetryActionPending === 'export' ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
            </SettingsIconActionButton>
            <SettingsIconActionButton
              aria-label="Clear Telemetry Sessions"
              title="Clear Telemetry Sessions"
              onClick={() => void onTelemetryClear()}
              disabled={telemetryActionPending != null}
              active={telemetryActionPending === 'clear'}
            >
              {telemetryActionPending === 'clear' ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
            </SettingsIconActionButton>
          </>
        )}
      >
        {telemetryNotice ? (
          <SettingsInlineNotice tone="success" className="mx-3 my-2">
            {telemetryNotice}
          </SettingsInlineNotice>
        ) : null}
        {telemetryStatusError ? (
          <SettingsInlineNotice tone="danger" className="mx-3 my-2">
            {telemetryStatusError}
          </SettingsInlineNotice>
        ) : null}
        {telemetryStatus ? (
          <>
            <SettingsControlRow
              label="Session"
              detail={`${telemetryStatus.recent_record_count} records`}
              control={<SettingsCompactPath value={telemetryStatus.session_id} title={telemetryStatus.session_id} />}
              action={<ThemeBadge label={telemetryConfigEnabled ? 'enabled' : 'idle'} active={telemetryConfigEnabled} />}
            />
            <SettingsControlRow
              label="File"
              detail={telemetryStatus.current_file_path ? 'current trace' : 'not started'}
              control={(
                <SettingsCompactPath
                  value={telemetryStatus.current_file_path ?? 'not started'}
                  title={telemetryStatus.current_file_path ?? undefined}
                />
              )}
            />
          </>
        ) : telemetryStatusPending ? (
          <SettingsInlineNotice tone="muted" className="mx-3 my-2">
            Refreshing telemetry session.
          </SettingsInlineNotice>
        ) : (
          <SettingsInlineNotice tone="muted" className="mx-3 my-2">
            No telemetry session has been created.
          </SettingsInlineNotice>
        )}
        <div className="border-t px-3 py-2 text-[10px]" style={{ ...borderTopStyle, ...mutedTextStyle }}>
          {startupStatusSummary}
        </div>
      </SettingsCompactSection>
    </SettingsSectionScaffold>
  );
}
