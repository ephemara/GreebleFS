import type {
  ExecutionContextPreviewSession,
  ExecutionContextSnapshot,
  ExtensionBuildResult,
  ExtensionHostApiSchema,
  ExtensionInspection,
  ExtensionInstallResult,
  ExtensionPackResult,
  ExternalTerminalRequest,
} from '../generated/tauri';
import { commands, unwrapTauriResult } from './tauriClient';

export type {
  ExecutionContextPreviewSession,
  ExecutionContextSnapshot,
  ExtensionBuildResult,
  ExtensionHostApiSchema,
  ExtensionInspection,
  ExtensionInstallResult,
  ExtensionPackResult,
};

export interface ExtensionHostCallRequest {
  callerPluginId?: string | null;
  callerRuntimeId?: string | null;
  methodId: string;
  payloadJson?: string | null;
  executionContext?: ExecutionContextSnapshot | null;
}

export interface ExtensionHostCallResponse {
  methodId: string;
  resultJson: string;
}

export interface ExtensionInspectRequest {
  path: string;
}

export interface ExtensionBuildRequest {
  sourceDirectory: string;
  outputDirectory?: string | null;
  includeDebugSources?: boolean;
}

export interface ExtensionPackRequest {
  sourceDirectory: string;
  outputPath?: string | null;
  includeDebugSources?: boolean;
}

export interface ExtensionInstallRequest {
  bundlePath: string;
  replaceExisting?: boolean;
}

export interface ExtensionHostFileStat {
  path: string;
  exists: boolean;
  isDirectory: boolean;
  size: number;
  modifiedMs: number | null;
  extension: string | null;
}

export interface ExtensionHostExplorerBreadcrumb {
  label: string;
  path: string;
}

export interface ExtensionHostExplorerLocationListing {
  kind: string;
  path: string;
  parentPath: string | null;
  breadcrumbs: ExtensionHostExplorerBreadcrumb[];
  entries: unknown[];
}

export interface ExtensionHostTaskRunCommandRequest {
  program: string;
  args?: string[];
  workingDirectory?: string | null;
  environment?: Record<string, string> | null;
  timeoutSecs?: number | null;
}

export interface ExtensionHostTaskRunCommandResult {
  status: number;
  stdout: string;
  stderr: string;
}

export interface ExtensionHostClientOptions {
  callerPluginId?: string | null;
  callerRuntimeId?: string | null;
  getExecutionContext?: (() => ExecutionContextSnapshot | null | undefined) | null;
}

function encodePayload(payload: unknown): string | null {
  if (payload === undefined) {
    return null;
  }
  return JSON.stringify(payload);
}

function decodePayload<TResult>(payloadJson: string): TResult {
  return JSON.parse(payloadJson) as TResult;
}

function resolveExecutionContext(
  options: ExtensionHostClientOptions,
): ExecutionContextSnapshot | null {
  const snapshot = options.getExecutionContext?.();
  return snapshot ?? null;
}

export async function extensionHostGetApiSchema(): Promise<ExtensionHostApiSchema> {
  return unwrapTauriResult(await commands.extensionHostGetApiSchema());
}

export async function extensionHostCall(
  request: ExtensionHostCallRequest,
): Promise<ExtensionHostCallResponse> {
  return unwrapTauriResult(
    await commands.extensionHostCall({
      callerPluginId: request.callerPluginId ?? null,
      callerRuntimeId: request.callerRuntimeId ?? null,
      methodId: request.methodId,
      payloadJson: request.payloadJson ?? null,
      executionContext: request.executionContext ?? null,
    }),
  );
}

export async function inspectExtensionSource(
  request: ExtensionInspectRequest,
): Promise<ExtensionInspection> {
  return unwrapTauriResult(await commands.extensionInspect(request));
}

export async function buildExtensionSource(
  request: ExtensionBuildRequest,
): Promise<ExtensionBuildResult> {
  return unwrapTauriResult(
    await commands.extensionBuild({
      sourceDirectory: request.sourceDirectory,
      outputDirectory: request.outputDirectory ?? null,
      includeDebugSources: request.includeDebugSources === true,
    }),
  );
}

export async function packExtensionSource(
  request: ExtensionPackRequest,
): Promise<ExtensionPackResult> {
  return unwrapTauriResult(
    await commands.extensionPack({
      sourceDirectory: request.sourceDirectory,
      outputPath: request.outputPath ?? null,
      includeDebugSources: request.includeDebugSources === true,
    }),
  );
}

export async function installExtensionBundle(
  request: ExtensionInstallRequest,
): Promise<ExtensionInstallResult> {
  return unwrapTauriResult(
    await commands.extensionInstall({
      bundlePath: request.bundlePath,
      replaceExisting: request.replaceExisting === true,
    }),
  );
}

export async function callExtensionHostMethod<TResult = unknown, TPayload = unknown>(
  methodId: string,
  payload: TPayload | undefined,
  options: ExtensionHostClientOptions = {},
): Promise<TResult> {
  const response = await extensionHostCall({
    callerPluginId: options.callerPluginId ?? null,
    callerRuntimeId: options.callerRuntimeId ?? null,
    methodId,
    payloadJson: encodePayload(payload),
    executionContext: resolveExecutionContext(options),
  });
  return decodePayload<TResult>(response.resultJson);
}

export interface ExtensionHostClient {
  call<TResult = unknown, TPayload = unknown>(
    methodId: string,
    payload?: TPayload,
  ): Promise<TResult>;
  host: {
    getApiSchema: () => Promise<ExtensionHostApiSchema>;
  };
  selection: {
    getSnapshot: () => Promise<ExecutionContextSnapshot>;
  };
  preview: {
    getSession: () => Promise<ExecutionContextPreviewSession | null>;
  };
  files: {
    readText: (path: string) => Promise<string>;
    writeText: (path: string, content: string) => Promise<void>;
    listDirectory: (
      path: string,
      showHidden?: boolean,
    ) => Promise<ExtensionHostExplorerLocationListing>;
    stat: (path: string) => Promise<ExtensionHostFileStat>;
  };
  explorer: {
    listLocation: (
      path: string,
      showHidden?: boolean,
    ) => Promise<ExtensionHostExplorerLocationListing>;
    openPath: (path: string) => Promise<void>;
  };
  repo: {
    exec: (args: string[], repoPath?: string | null) => Promise<string>;
  };
  tasks: {
    runCommand: (
      request: ExtensionHostTaskRunCommandRequest,
    ) => Promise<ExtensionHostTaskRunCommandResult>;
  };
  terminal: {
    openExternal: (request: ExternalTerminalRequest) => Promise<void>;
  };
}

export function createExtensionHostClient(
  options: ExtensionHostClientOptions = {},
): ExtensionHostClient {
  const call = <TResult = unknown, TPayload = unknown>(
    methodId: string,
    payload?: TPayload,
  ) => callExtensionHostMethod<TResult, TPayload>(methodId, payload, options);

  return {
    call,
    host: {
      getApiSchema: () => call<ExtensionHostApiSchema>('host.get_api_schema'),
    },
    selection: {
      getSnapshot: () =>
        call<ExecutionContextSnapshot>('selection.get_snapshot'),
    },
    preview: {
      getSession: () =>
        call<ExecutionContextPreviewSession | null>('preview.get_session'),
    },
    files: {
      readText: (path) => call<string, { path: string }>('files.read_text', { path }),
      writeText: async (path, content) => {
        await call<null, { path: string; content: string }>('files.write_text', {
          path,
          content,
        });
      },
      listDirectory: (path, showHidden = false) =>
        call<
          ExtensionHostExplorerLocationListing,
          { path: string; showHidden: boolean }
        >('files.list_directory', {
          path,
          showHidden,
        }),
      stat: (path) => call<ExtensionHostFileStat, { path: string }>('files.stat', { path }),
    },
    explorer: {
      listLocation: (path, showHidden = false) =>
        call<
          ExtensionHostExplorerLocationListing,
          { path: string; showHidden: boolean }
        >('explorer.list_location', {
          path,
          showHidden,
        }),
      openPath: async (path) => {
        await call<null, { path: string }>('explorer.open_path', { path });
      },
    },
    repo: {
      exec: (args, repoPath = null) =>
        call<string, { repoPath?: string | null; args: string[] }>('repo.exec', {
          repoPath,
          args,
        }),
    },
    tasks: {
      runCommand: (request) =>
        call<ExtensionHostTaskRunCommandResult, ExtensionHostTaskRunCommandRequest>(
          'tasks.run_command',
          request,
        ),
    },
    terminal: {
      openExternal: async (request) => {
        await call<null, ExternalTerminalRequest>('terminal.open_external', request);
      },
    },
  };
}
