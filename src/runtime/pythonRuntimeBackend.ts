import type {
  IpcArtifactDescriptor,
  IpcArtifactRef,
  IpcResourceHandle,
  PythonActionResponse,
  PythonEmbeddedSnippetRequest,
  PythonEmbeddedSnippetResponse,
  PythonExecutionRequest,
  PythonRuntimeConfig,
  PythonRuntimeStatus,
  PythonSidecarActionDescriptor,
  PythonSidecarActionRequest,
  PythonSidecarActionResponse,
  PythonSidecarPackagePreset,
  PythonSidecarStartResponse,
  PythonSidecarStatus,
  PythonSidecarWorkspaceManifest,
} from '../generated/tauri';
import {
  pythonSidecarActionCatalog,
  pythonSidecarWorkspaceManifest,
} from '../config/python';
import { commands, unwrapTauriResult } from './tauriClient';

export type ManagedPythonActionResponse = PythonActionResponse;
export type ManagedPythonRuntimeConfig = PythonRuntimeConfig;
export type ManagedPythonRuntimeStatus = PythonRuntimeStatus;
export type ManagedPythonExecutionRequest = PythonExecutionRequest;
export type ManagedPythonSidecarStatus = PythonSidecarStatus;
export type ManagedPythonSidecarStartResponse = PythonSidecarStartResponse;
export type ManagedPythonSidecarActionDescriptor = PythonSidecarActionDescriptor;
export type ManagedPythonSidecarPackagePreset = PythonSidecarPackagePreset;
export type ManagedPythonSidecarWorkspaceManifest = PythonSidecarWorkspaceManifest;
export type ManagedIpcArtifactDescriptor = IpcArtifactDescriptor;
export type ManagedIpcArtifactRef = IpcArtifactRef;
export type ManagedIpcResourceHandle = IpcResourceHandle;

export interface PythonSidecarActionRunnerRequest<TPayload = unknown> {
  config: ManagedPythonRuntimeConfig | null;
  actionId: string;
  payload?: TPayload;
  inputArtifacts?: ManagedIpcArtifactRef[] | null;
  resourceHandles?: ManagedIpcResourceHandle[] | null;
  workingDirectory?: string | null;
  environment?: Record<string, string> | null;
  startIfNeeded?: boolean | null;
}

export interface PythonSidecarActionRunnerResponse<TResult = unknown>
  extends PythonSidecarActionResponse {
  result: TResult;
}

export interface EmbeddedPythonExecutionRequest<TPayload = unknown> {
  code: string;
  callableName?: string | null;
  payload?: TPayload;
}

export interface EmbeddedPythonExecutionResponse<TResult = unknown>
  extends PythonEmbeddedSnippetResponse {
  result: TResult;
}

export interface PythonSidecarRuntimeSummary {
  pythonVersion: string;
  executable: string;
  platform: string;
  cwd: string;
  runtimeRoot: string;
  workspaceRoot: string;
  environmentKeys: string[];
  availableActions: string[];
}

export interface PythonSidecarMlProbe {
  pythonVersion: string;
  onnxInstalled: boolean;
  onnxruntime: {
    installed: boolean;
    imported?: boolean;
    importError?: string | null;
    availableProviders?: string[];
    providerError?: string | null;
  };
  torch: {
    installed: boolean;
    imported?: boolean;
    importError?: string | null;
    version?: string | null;
    cudaAvailable?: boolean;
    cudaVersion?: string | null;
    mpsAvailable?: boolean;
  };
  cudaVisibleDevices?: string | null;
}

export interface PythonSidecarCudaDeviceInfo {
  index: number;
  name: string;
  capability?: string | null;
  totalMemoryBytes?: number | null;
}

export interface PythonSidecarCudaAccelerationProbe {
  pythonVersion: string;
  platform: string;
  cudaVisibleDevices?: string | null;
  cudaHome?: string | null;
  cudaPath?: string | null;
  torch: {
    installed: boolean;
    imported?: boolean | null;
    importError?: string | null;
    version?: string | null;
    cudaAvailable?: boolean | null;
    cudaVersion?: string | null;
    cudnnAvailable?: boolean | null;
    deviceCount?: number | null;
    devices: PythonSidecarCudaDeviceInfo[];
  };
  onnxruntime: {
    installed: boolean;
    imported?: boolean | null;
    importError?: string | null;
    availableProviders?: string[] | null;
    providerError?: string | null;
  };
  optionalModules: Array<{
    id: string;
    installed: boolean;
    imported?: boolean | null;
    importError?: string | null;
    version?: string | null;
  }>;
}

export interface PythonSidecarDirectoryScanEntry {
  name: string;
  path: string;
  isDir: boolean;
  sizeBytes: number | null;
  modifiedAtEpochMs: number;
}

export interface PythonSidecarDirectoryScanResult {
  root: string;
  count: number;
  truncated: boolean;
  entries: PythonSidecarDirectoryScanEntry[];
}

export interface PythonSidecarHashEntry {
  path: string;
  algorithm: string;
  digest: string;
}

export interface PythonSidecarHashPathsResult {
  algorithm: string;
  entries: PythonSidecarHashEntry[];
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

export async function getManagedPythonRuntimeStatus(
  config: ManagedPythonRuntimeConfig | null,
): Promise<ManagedPythonRuntimeStatus> {
  return unwrapTauriResult(await commands.pythonGetRuntimeStatus(config));
}

export async function bootstrapManagedPythonRuntime(
  config: ManagedPythonRuntimeConfig | null,
): Promise<ManagedPythonActionResponse> {
  return unwrapTauriResult(await commands.pythonBootstrapRuntime(config));
}

export async function installManagedPythonPackages(
  request: {
    config: ManagedPythonRuntimeConfig | null;
    packageInput: string;
    persistToRequirements?: boolean | null;
  },
): Promise<ManagedPythonActionResponse> {
  return unwrapTauriResult(await commands.pythonInstallPackages({
    config: request.config,
    packageInput: request.packageInput,
    persistToRequirements: request.persistToRequirements ?? true,
  }));
}

export async function executeManagedPython(
  request: ManagedPythonExecutionRequest,
): Promise<ManagedPythonActionResponse> {
  return unwrapTauriResult(await commands.pythonExecute(request));
}

export async function getPythonSidecarStatus(
  config: ManagedPythonRuntimeConfig | null,
): Promise<ManagedPythonSidecarStatus> {
  return unwrapTauriResult(await commands.pythonGetSidecarStatus(config));
}

export async function startPythonSidecar(
  config: ManagedPythonRuntimeConfig | null,
): Promise<ManagedPythonSidecarStartResponse> {
  return unwrapTauriResult(await commands.pythonStartSidecar(config));
}

export async function stopPythonSidecar(
  config: ManagedPythonRuntimeConfig | null,
): Promise<ManagedPythonSidecarStatus> {
  return unwrapTauriResult(await commands.pythonStopSidecar(config));
}

export async function runPythonSidecarAction<TResult = unknown, TPayload = unknown>(
  request: PythonSidecarActionRunnerRequest<TPayload>,
): Promise<PythonSidecarActionRunnerResponse<TResult>> {
  const response = unwrapTauriResult(await commands.pythonSidecarCall({
    config: request.config,
    actionId: request.actionId,
    payloadJson: encodeJsonPayload(request.payload),
    inputArtifacts: request.inputArtifacts ?? null,
    resourceHandles: request.resourceHandles ?? null,
    workingDirectory: request.workingDirectory ?? null,
    environment: request.environment ?? null,
    startIfNeeded: request.startIfNeeded ?? true,
  } satisfies PythonSidecarActionRequest));

  return {
    ...response,
    result: decodeJsonPayload<TResult>(response.resultJson),
  };
}

export function createPythonSidecarActionRunner<TPayload = unknown, TResult = unknown>(
  actionId: string,
  defaults: Omit<Partial<PythonSidecarActionRunnerRequest<TPayload>>, 'actionId' | 'payload'> = {},
) {
  return async (
    payload?: TPayload,
    overrides: Omit<Partial<PythonSidecarActionRunnerRequest<TPayload>>, 'actionId' | 'payload'> = {},
  ): Promise<PythonSidecarActionRunnerResponse<TResult>> =>
    runPythonSidecarAction<TResult, TPayload>({
      config: overrides.config ?? defaults.config ?? null,
      actionId,
      payload,
      workingDirectory: overrides.workingDirectory ?? defaults.workingDirectory ?? null,
      environment: overrides.environment ?? defaults.environment ?? null,
      startIfNeeded: overrides.startIfNeeded ?? defaults.startIfNeeded ?? true,
    });
}

export async function executeEmbeddedPython<TResult = unknown, TPayload = unknown>(
  request: EmbeddedPythonExecutionRequest<TPayload>,
): Promise<EmbeddedPythonExecutionResponse<TResult>> {
  const response = unwrapTauriResult(await commands.pythonExecuteEmbedded({
    code: request.code,
    callableName: request.callableName ?? null,
    payloadJson: encodeJsonPayload(request.payload),
  } satisfies PythonEmbeddedSnippetRequest));

  return {
    ...response,
    result: decodeJsonPayload<TResult>(response.resultJson),
  };
}

export const managedPythonSidecarManifest: ManagedPythonSidecarWorkspaceManifest =
  pythonSidecarWorkspaceManifest as ManagedPythonSidecarWorkspaceManifest;

export const managedPythonSidecarActionCatalog: ManagedPythonSidecarActionDescriptor[] =
  pythonSidecarActionCatalog as ManagedPythonSidecarActionDescriptor[];

export const managedPythonSidecarPackagePresets: ManagedPythonSidecarPackagePreset[] =
  managedPythonSidecarManifest.packagePresets;

export const getPythonRuntimeSummary =
  createPythonSidecarActionRunner<Record<string, never>, PythonSidecarRuntimeSummary>(
    'runtime.summary',
  );

export const probePythonMlRuntime =
  createPythonSidecarActionRunner<Record<string, never>, PythonSidecarMlProbe>(
    'ml.probe',
  );

export const probePythonCudaAcceleration =
  createPythonSidecarActionRunner<Record<string, never>, PythonSidecarCudaAccelerationProbe>(
    'acceleration.cuda_probe',
  );

export const scanDirectoryWithPython =
  createPythonSidecarActionRunner<
    { root?: string; limit?: number; includeHidden?: boolean },
    PythonSidecarDirectoryScanResult
  >('files.scan_directory');

export const hashPathsWithPython =
  createPythonSidecarActionRunner<
    { paths: string[]; algorithm?: string; chunkSize?: number },
    PythonSidecarHashPathsResult
  >('files.hash_paths');
