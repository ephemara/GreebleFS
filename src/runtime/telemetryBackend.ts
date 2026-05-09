import type {
  TelemetryConfig,
  TelemetryRecord,
  TelemetryRecordEvent,
  TelemetrySessionStatus,
  TelemetrySupportBundleResult,
} from '../generated/tauri';
import { commands, events, unwrapTauriResult } from './tauriClient';
import { useSettingsStore } from '../store/settingsStore';
import { callGreebleNativeWithInvokeFallback } from './nativeControl';

export type OverlayTelemetryConfig = TelemetryConfig;
export type OverlayTelemetryRecord = TelemetryRecord;
export type OverlayTelemetryRecordEvent = TelemetryRecordEvent;
export type OverlayTelemetrySessionStatus = TelemetrySessionStatus;
export type OverlayTelemetrySupportBundleResult = TelemetrySupportBundleResult;

export function buildTelemetryConfigFromSettings(): OverlayTelemetryConfig {
  const system = useSettingsStore.getState().settings.system;
  return {
    developer_telemetry_enabled: system.developerTelemetryEnabled,
    developer_telemetry_capture_mode: system.developerTelemetryCaptureMode,
    developer_telemetry_write_to_file: system.developerTelemetryWriteToFile,
    developer_telemetry_show_inspector: system.developerTelemetryShowInspector,
    developer_telemetry_payload_mode: system.developerTelemetryPayloadMode,
    developer_telemetry_max_file_size_mb: system.developerTelemetryMaxFileSizeMb,
    consumer_diagnostics_enabled: system.consumerDiagnosticsEnabled,
    consumer_diagnostics_include_plugin_runtime: system.consumerDiagnosticsIncludePluginRuntime,
    consumer_diagnostics_include_renderer_runtime: system.consumerDiagnosticsIncludeRendererRuntime,
    consumer_diagnostics_include_perf_samples: system.consumerDiagnosticsIncludePerfSamples,
  };
}

export async function configureTelemetry(config: OverlayTelemetryConfig = buildTelemetryConfigFromSettings()): Promise<void> {
  await callGreebleNativeWithInvokeFallback<void, OverlayTelemetryConfig>(
    'settings',
    'telemetryConfigure',
    config,
    () => commands.telemetryConfigure(config).then(unwrapTauriResult),
  );
}

export async function getTelemetryStatus(): Promise<OverlayTelemetrySessionStatus> {
  return callGreebleNativeWithInvokeFallback<OverlayTelemetrySessionStatus>(
    'settings',
    'telemetryStatus',
    undefined,
    () => commands.telemetryGetStatus().then(unwrapTauriResult),
  );
}

export async function getRecentTelemetryRecords(limit = 60): Promise<OverlayTelemetryRecord[]> {
  return commands.telemetryGetRecentRecords(limit).then(unwrapTauriResult);
}

export async function exportTelemetrySupportBundle(): Promise<OverlayTelemetrySupportBundleResult> {
  return callGreebleNativeWithInvokeFallback<OverlayTelemetrySupportBundleResult>(
    'settings',
    'telemetryExportSupportBundle',
    undefined,
    () => commands.telemetryExportSupportBundle().then(unwrapTauriResult),
  );
}

export async function clearTelemetrySessions(): Promise<void> {
  await callGreebleNativeWithInvokeFallback<void>(
    'settings',
    'telemetryClearSessions',
    undefined,
    () => commands.telemetryClearSessions().then(unwrapTauriResult),
  );
}

export async function listenToTelemetryRecords(
  listener: (record: OverlayTelemetryRecord) => void,
): Promise<() => void> {
  return events.telemetryRecordEvent.listen((event: { payload: OverlayTelemetryRecordEvent }) => {
    listener(event.payload.record);
  });
}
