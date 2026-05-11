import type {
  PathIndexAccelerationEnableRequest,
  PathIndexAccelerationEnableResponse,
  PathIndexAccelerationRebuildRequest,
  PathIndexAccelerationStatus,
} from "../generated/tauri";
import { resolveGreebleNativeLaneSelection } from "../config/nativeLaneMigration";
import {
  callGreebleNativeWithInvokeFallback,
  isGreebleNativeControlAvailable,
} from "./nativeControl";
import { commands, unwrapTauriResult } from "./tauriClient";

let autoRegisterPromise: Promise<PathIndexAccelerationEnableResponse | null> | null = null;

function normalizeAccelerationEnableRequest(
  request: Partial<PathIndexAccelerationEnableRequest> = {},
): PathIndexAccelerationEnableRequest {
  return {
    driveRoot: request.driveRoot ?? null,
    autoIndex: request.autoIndex ?? null,
    journalMaximumSizeBytes: request.journalMaximumSizeBytes ?? null,
    journalAllocationDeltaBytes: request.journalAllocationDeltaBytes ?? null,
  };
}

function shouldUsePathIndexAccelerationNativeControl(): boolean {
  return (
    resolveGreebleNativeLaneSelection(
      "pathIndexControls",
      {},
      { nativeControl: isGreebleNativeControlAvailable() },
    ).activeLane === "native_control"
  );
}

export async function getPathIndexAccelerationStatus(): Promise<PathIndexAccelerationStatus> {
  if (!shouldUsePathIndexAccelerationNativeControl()) {
    return unwrapTauriResult(await commands.pathIndexAccelerationStatus());
  }
  return callGreebleNativeWithInvokeFallback<PathIndexAccelerationStatus, Record<string, never>>(
    "explorer",
    "pathIndexAccelerationStatus",
    {},
    () => commands.pathIndexAccelerationStatus().then(unwrapTauriResult),
  );
}

export async function enablePathIndexAcceleration(
  request: Partial<PathIndexAccelerationEnableRequest> = {},
): Promise<PathIndexAccelerationEnableResponse> {
  const normalizedRequest = normalizeAccelerationEnableRequest(request);
  if (!shouldUsePathIndexAccelerationNativeControl()) {
    return unwrapTauriResult(await commands.pathIndexAccelerationEnable(normalizedRequest));
  }
  return callGreebleNativeWithInvokeFallback<
    PathIndexAccelerationEnableResponse,
    PathIndexAccelerationEnableRequest
  >("explorer", "pathIndexAccelerationEnable", normalizedRequest, () =>
    commands.pathIndexAccelerationEnable(normalizedRequest).then(unwrapTauriResult),
  );
}

export async function rebuildPathIndexAcceleration(
  request: PathIndexAccelerationRebuildRequest,
): Promise<PathIndexAccelerationEnableResponse> {
  if (!shouldUsePathIndexAccelerationNativeControl()) {
    return unwrapTauriResult(await commands.pathIndexAccelerationRebuild(request));
  }
  return callGreebleNativeWithInvokeFallback<
    PathIndexAccelerationEnableResponse,
    PathIndexAccelerationRebuildRequest
  >("explorer", "pathIndexAccelerationRebuild", request, () =>
    commands.pathIndexAccelerationRebuild(request).then(unwrapTauriResult),
  );
}

export function registerWindowsPathIndexAccelerationProfileOnce(args: {
  enabled: boolean;
  autoRegisterProfile: boolean;
  journalMaximumSizeBytes?: number;
  journalAllocationDeltaBytes?: number;
}): Promise<PathIndexAccelerationEnableResponse | null> {
  if (!args.enabled || !args.autoRegisterProfile) {
    return Promise.resolve(null);
  }
  if (autoRegisterPromise) {
    return autoRegisterPromise;
  }
  autoRegisterPromise = enablePathIndexAcceleration({
    autoIndex: false,
    journalMaximumSizeBytes: args.journalMaximumSizeBytes,
    journalAllocationDeltaBytes: args.journalAllocationDeltaBytes,
  }).catch((error) => {
    autoRegisterPromise = null;
    throw error;
  });
  return autoRegisterPromise;
}
