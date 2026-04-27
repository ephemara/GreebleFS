/**
 * Go-flavored convenience layer over the universal runtime pipeline.
 *
 * This module is intentionally a thin ergonomics wrapper. The truth lane is
 * `externalRuntimeBackend.ts`; surfaces like the explorer `.go` workbench,
 * the Plugins manager, and authored actions should call into this module so
 * Go-specific defaults (compiler routing, target naming, panel host args)
 * stay in one place.
 */

import {
  callRuntimeAction,
  createRuntimeActionRunner,
  getRuntimeToolchainStatus,
  listRuntimePackages,
  openRuntimeTui,
  prepareRuntimePackage,
  runRuntimeCommand,
  startRuntimeSidecar,
  stopRuntimeSidecar,
  type DiscoveredRuntimePackage,
  type ExternalRuntimeCommandRequest,
  type ExternalRuntimeCommandResult,
  type ExternalRuntimeSidecarCallResponse,
  type ExternalRuntimeSidecarStatus,
  type ExternalRuntimeTuiLaunch,
  type RuntimeCallTypedRequest,
  type RuntimeCallTypedResponse,
  type RuntimePreparePackageResponse,
  type RuntimeToolchainStatus,
} from './externalRuntimeBackend';

export type GoRuntimeMode = 'release' | 'debug';
export type GoRuntimeTarget =
  | 'host-native'
  | 'js-wasm'
  | 'tinygo-wasm'
  | (string & {});

export interface GoRuntimeToolchainStatus extends RuntimeToolchainStatus {}

export interface GoRuntimePackageSummary {
  id: string;
  displayName: string;
  kind: DiscoveredRuntimePackage['manifest']['kind'];
  compiler: DiscoveredRuntimePackage['manifest']['compiler'];
  origin: DiscoveredRuntimePackage['origin'];
  manifestDir: string;
  hasPanel: boolean;
  hasCommand: boolean;
  hasSidecar: boolean;
  hasTui: boolean;
}

function isGoCompiler(compiler: DiscoveredRuntimePackage['manifest']['compiler']): boolean {
  return (
    compiler === 'go-native' || compiler === 'go-js-wasm' || compiler === 'tinygo-wasm'
  );
}

export async function listGoRuntimePackages(): Promise<GoRuntimePackageSummary[]> {
  const { packages } = await listRuntimePackages();
  return packages
    .filter(pkg => isGoCompiler(pkg.manifest.compiler))
    .map(pkg => ({
      id: pkg.manifest.id,
      displayName: pkg.manifest.displayName,
      kind: pkg.manifest.kind,
      compiler: pkg.manifest.compiler,
      origin: pkg.origin,
      manifestDir: pkg.manifest.manifestDir,
      hasPanel: Boolean(pkg.manifest.panel),
      hasCommand: pkg.manifest.kind === 'native-command',
      hasSidecar: pkg.manifest.kind === 'native-sidecar',
      hasTui: pkg.manifest.kind === 'native-tui',
    }));
}

export async function getGoToolchainStatus(): Promise<GoRuntimeToolchainStatus> {
  return getRuntimeToolchainStatus();
}

export async function buildGoRuntimePackage(args: {
  runtimeId: string;
  mode?: GoRuntimeMode;
  target?: GoRuntimeTarget;
  forceRebuild?: boolean;
}): Promise<RuntimePreparePackageResponse> {
  return prepareRuntimePackage({
    runtimeId: args.runtimeId,
    mode: args.mode ?? 'release',
    target: args.target ?? null,
    forceRebuild: args.forceRebuild ?? false,
  });
}

export async function runGoCommand(
  request: ExternalRuntimeCommandRequest,
): Promise<ExternalRuntimeCommandResult> {
  return runRuntimeCommand(request);
}

export async function startGoSidecar(runtimeId: string): Promise<ExternalRuntimeSidecarStatus> {
  return startRuntimeSidecar(runtimeId);
}

export async function stopGoSidecar(runtimeId: string): Promise<ExternalRuntimeSidecarStatus> {
  return stopRuntimeSidecar(runtimeId);
}

export async function callGoSidecarAction<TResult = unknown, TPayload = unknown>(
  request: RuntimeCallTypedRequest<TPayload>,
): Promise<RuntimeCallTypedResponse<TResult>> {
  return callRuntimeAction<TResult, TPayload>(request);
}

export async function openGoTui(runtimeId: string): Promise<ExternalRuntimeTuiLaunch> {
  return openRuntimeTui(runtimeId);
}

export const createGoSidecarActionRunner = createRuntimeActionRunner;

export type {
  DiscoveredRuntimePackage,
  ExternalRuntimeCommandRequest,
  ExternalRuntimeCommandResult,
  ExternalRuntimeSidecarCallResponse,
  ExternalRuntimeSidecarStatus,
  ExternalRuntimeTuiLaunch,
  RuntimePreparePackageResponse,
};
