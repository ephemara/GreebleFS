import { invoke } from "@tauri-apps/api/core";
import { invokeBinary } from "@tauri-apps/api/transport";
import * as tauriBindings from "../generated/tauri";
import type { Result } from "../generated/tauri";
import {
  finishTelemetrySpan,
  recordFrontendTelemetry,
  startTelemetrySpan,
  summarizeTelemetryValue,
  type TelemetryMetadata,
} from "./telemetry";
import { bindDeferredUnlisten } from "./deferredUnlisten";

export type {
  LinuxDisplayBackendPreference,
  LinuxDisplayBackendStatus,
  LinuxNvidiaWebkitWorkaroundMode,
  SqliteSortDirection,
  SqliteTableQueryRequest,
  SqliteTableQueryResult,
} from "../generated/tauri";

export interface WaylandDockHostStatus {
  enabled: boolean;
  windowLabel: string | null;
}

export interface ManagedContentRootsSnapshot {
  bundledUsrRoot: string;
  writableRoot: string;
}

export interface RuntimeReadArtifactBytesRequest {
  runtimeId: string;
  cacheKey: string;
  artifactKind: string;
}

export type WaylandDockAnchor = "top" | "bottom";

const TELEMETRY_COMMANDS = new Set([
  "telemetryConfigure",
  "telemetryGetStatus",
  "telemetryGetRecentRecords",
  "telemetryExportSupportBundle",
  "telemetryClearSessions",
]);

function summarizeArgs(args: unknown[]): TelemetryMetadata {
  const metadata: TelemetryMetadata = {
    argCount: args.length,
  };

  args.forEach((arg, index) => {
    metadata[`arg${index}`] = summarizeTelemetryValue(arg, `arg${index}`);
  });

  return metadata;
}

function wrapCommand<TArgs extends unknown[], TResult>(
  name: string,
  fn: (...args: TArgs) => Promise<TResult>,
): (...args: TArgs) => Promise<TResult> {
  if (TELEMETRY_COMMANDS.has(name)) {
    return fn;
  }

  return async (...args: TArgs): Promise<TResult> => {
    const span = startTelemetrySpan({
      name,
      layer: "tauri-bridge",
      kind: "command",
      metadata: summarizeArgs(args),
    });

    try {
      const result = await fn(...args);
      finishTelemetrySpan(span, {
        status: "ok",
        metadata: {
          result: summarizeTelemetryValue(result, "result"),
        },
      });
      return result;
    } catch (error) {
      finishTelemetrySpan(span, {
        status: "error",
        error,
      });
      throw error;
    }
  };
}

function wrapEvents<
  TEvents extends Record<
    string,
    {
      listen: (
        listener: (event: { payload: unknown }) => void,
      ) => Promise<() => void>;
    }
  >,
>(source: TEvents): TEvents {
  return Object.fromEntries(
    Object.entries(source).map(([name, eventApi]) => [
      name,
      {
        ...eventApi,
        listen: async (listener: (event: { payload: unknown }) => void) => {
          const unlistenPromise = eventApi.listen((event: { payload: unknown }) => {
            recordFrontendTelemetry({
              layer: "tauri-bridge",
              kind: "event",
              name,
              status: "ok",
              metadata: {
                payload: summarizeTelemetryValue(event.payload, "payload"),
              },
            });
            listener(event);
          });
          const cleanup = bindDeferredUnlisten(unlistenPromise);
          await unlistenPromise;
          return cleanup;
        },
      },
    ]),
  ) as TEvents;
}

const baseCommands = {
  ...tauriBindings.commands,
  windowGetWaylandDockHostStatus: () =>
    invoke<WaylandDockHostStatus>("window_get_wayland_dock_host_status"),
  windowApplyWaylandDockLayout: (
    anchor: WaylandDockAnchor,
    monitorName: string | null,
    width: number,
    height: number,
  ) =>
    invoke<Result<null, string>>("window_apply_wayland_dock_layout", {
      anchor,
      monitorName,
      width,
      height,
    }),
  fsReadPreviewBytes: (path: string, maxBytes: number) =>
    invokeBinary("fs_read_preview_bytes", { path, maxBytes }),
  fsReadArchiveEntryPreviewBytes: (
    archivePath: string,
    entryPath: string,
    maxBytes: number,
  ) =>
    invokeBinary("fs_read_archive_entry_preview_bytes", {
      archivePath,
      entryPath,
      maxBytes,
    }),
  cloudReadPreviewBytes: (path: string, maxBytes: number) =>
    invokeBinary("cloud_read_preview_bytes", { path, maxBytes }),
  remoteReadPreviewBytes: (path: string, maxBytes: number) =>
    invokeBinary("remote_read_preview_bytes", { path, maxBytes }),
  runtimeReadArtifactBytes: (request: RuntimeReadArtifactBytesRequest) =>
    invokeBinary("runtime_read_artifact_bytes", { request }),
  audioEngineSetPluginParameter: (request: {
    deckId: "a" | "b";
    parameterId: number;
    valueNormalized: number;
  }) =>
    invoke<Result<tauriBindings.AudioEngineStateSnapshot, string>>(
      "audio_engine_set_plugin_parameter",
      { request },
    ),
  globalSearchQueryUnderPath: (
    rootPath: string,
    query: string,
    options: tauriBindings.GlobalSearchQueryOptions,
  ) =>
    invoke<Result<tauriBindings.GlobalSearchResultEntry[], string>>(
      "global_search_query_under_path",
      { rootPath, query, options },
    ),
  startupResolveManagedContentRoots: () =>
    invoke<Result<ManagedContentRootsSnapshot, string>>("startup_resolve_managed_content_roots"),
};

export const commands = Object.fromEntries(
  Object.entries(baseCommands).map(([name, fn]) => [
    name,
    wrapCommand(name, fn as (...args: unknown[]) => Promise<unknown>),
  ]),
) as typeof baseCommands;

export const events = wrapEvents(tauriBindings.events);

export function unwrapTauriResult<T>(result: Result<T, string>): T {
  if (result.status === "ok") {
    return result.data;
  }

  throw new Error(result.error);
}
