/**
 * Generic frontend bridge for the universal polyglot runtime pipeline.
 *
 * This module is the canonical TypeScript seam over the `runtime_*` Tauri
 * commands. Language-flavored wrappers (e.g. `goRuntimeBackend.ts`) compose
 * these helpers; React surfaces should never `invoke()` runtime commands
 * directly.
 *
 * The native side guarantees that:
 *   - manifest parsing, path sandboxing, compile cache, and lifecycle live
 *     entirely behind these commands
 *   - identical inputs yield identical cache keys
 *   - sidecars/commands/TUIs reject mismatched runtime kinds with typed errors
 */

import type {
  DiscoveredRuntimePackage,
  ExternalRuntimeCommandRequest,
  ExternalRuntimeCommandResult,
  ExternalRuntimeSidecarCallResponse,
  ExternalRuntimeSidecarStatus,
  ExternalRuntimeTuiLaunch,
  RuntimeCallRequest,
  RuntimeDiscoveryRootDto,
  RuntimeListPackagesRequest,
  RuntimeListPackagesResponse,
  RuntimeOpenTuiRequest,
  RuntimePreparePackageRequest,
  RuntimePreparePackageResponse,
  RuntimeStartSidecarRequest,
  RuntimeStopSidecarRequest,
  RuntimeToolchainStatus,
} from '../generated/tauri';
import { commands, unwrapTauriResult } from './tauriClient';

export type {
  DiscoveredRuntimePackage,
  ExternalRuntimeCommandRequest,
  ExternalRuntimeCommandResult,
  ExternalRuntimeSidecarCallResponse,
  ExternalRuntimeSidecarStatus,
  ExternalRuntimeTuiLaunch,
  RuntimeCallRequest,
  RuntimeDiscoveryRootDto,
  RuntimeListPackagesRequest,
  RuntimeListPackagesResponse,
  RuntimeOpenTuiRequest,
  RuntimePreparePackageRequest,
  RuntimePreparePackageResponse,
  RuntimeStartSidecarRequest,
  RuntimeStopSidecarRequest,
  RuntimeToolchainStatus,
};

export interface RuntimeCallTypedRequest<TPayload = unknown> {
  runtimeId: string;
  actionId: string;
  payload?: TPayload;
  workingDirectory?: string | null;
  environment?: Record<string, string> | null;
  startIfNeeded?: boolean | null;
}

export interface RuntimeCallTypedResponse<TResult = unknown>
  extends Omit<ExternalRuntimeSidecarCallResponse, 'resultJson'> {
  result: TResult;
  resultJson: string;
}

function encodeJsonPayload(payload: unknown): string | null {
  if (payload === undefined) {
    return null;
  }
  return JSON.stringify(payload);
}

function decodeJsonPayload<TResult>(payloadJson: string): TResult {
  return JSON.parse(payloadJson) as TResult;
}

export async function listRuntimePackages(
  request?: RuntimeListPackagesRequest | null,
): Promise<RuntimeListPackagesResponse> {
  return unwrapTauriResult(
    await commands.runtimeListPackages(request ?? null),
  );
}

export async function getRuntimeToolchainStatus(): Promise<RuntimeToolchainStatus> {
  return unwrapTauriResult(await commands.runtimeGetToolchainStatus());
}

export async function prepareRuntimePackage(
  request: RuntimePreparePackageRequest,
): Promise<RuntimePreparePackageResponse> {
  return unwrapTauriResult(await commands.runtimePreparePackage(request));
}

export async function startRuntimeSidecar(
  runtimeId: string,
): Promise<ExternalRuntimeSidecarStatus> {
  return unwrapTauriResult(
    await commands.runtimeStartSidecar({ runtimeId } satisfies RuntimeStartSidecarRequest),
  );
}

export async function stopRuntimeSidecar(
  runtimeId: string,
): Promise<ExternalRuntimeSidecarStatus> {
  return unwrapTauriResult(
    await commands.runtimeStopSidecar({ runtimeId } satisfies RuntimeStopSidecarRequest),
  );
}

export async function callRuntimeAction<TResult = unknown, TPayload = unknown>(
  request: RuntimeCallTypedRequest<TPayload>,
): Promise<RuntimeCallTypedResponse<TResult>> {
  const response = unwrapTauriResult(
    await commands.runtimeCall({
      runtimeId: request.runtimeId,
      actionId: request.actionId,
      payloadJson: encodeJsonPayload(request.payload),
      workingDirectory: request.workingDirectory ?? null,
      environment: request.environment ?? null,
      startIfNeeded: request.startIfNeeded ?? true,
    } satisfies RuntimeCallRequest),
  );

  return {
    ...response,
    result: decodeJsonPayload<TResult>(response.resultJson),
  };
}

export async function runRuntimeCommand(
  request: ExternalRuntimeCommandRequest,
): Promise<ExternalRuntimeCommandResult> {
  return unwrapTauriResult(await commands.runtimeRunCommand(request));
}

export async function openRuntimeTui(
  runtimeId: string,
): Promise<ExternalRuntimeTuiLaunch> {
  return unwrapTauriResult(
    await commands.runtimeOpenTui({ runtimeId } satisfies RuntimeOpenTuiRequest),
  );
}

/** Convenience helper for surfaces that only care about a runtime by id. */
export async function getRuntimePackage(
  runtimeId: string,
): Promise<DiscoveredRuntimePackage | null> {
  const { packages } = await listRuntimePackages();
  return packages.find(pkg => pkg.manifest.id === runtimeId) ?? null;
}

/**
 * Build a typed action runner closure. Used by language-flavored backends to
 * pre-bind a `runtimeId` + `actionId` pair so call sites stay terse.
 */
export function createRuntimeActionRunner<TPayload = unknown, TResult = unknown>(
  runtimeId: string,
  actionId: string,
  defaults: Omit<Partial<RuntimeCallTypedRequest<TPayload>>, 'runtimeId' | 'actionId' | 'payload'> = {},
) {
  return async (
    payload?: TPayload,
    overrides: Omit<Partial<RuntimeCallTypedRequest<TPayload>>, 'runtimeId' | 'actionId' | 'payload'> = {},
  ): Promise<RuntimeCallTypedResponse<TResult>> =>
    callRuntimeAction<TResult, TPayload>({
      runtimeId,
      actionId,
      payload,
      workingDirectory: overrides.workingDirectory ?? defaults.workingDirectory ?? null,
      environment: overrides.environment ?? defaults.environment ?? null,
      startIfNeeded: overrides.startIfNeeded ?? defaults.startIfNeeded ?? true,
    });
}
