import type {
  ExecutionContextPreviewSession,
  ExecutionContextSnapshot,
  ExtensionBuildResult,
  ExtensionHostFileWatchEvent,
  ExtensionHostFileWatchHandle,
  ExtensionHostTaskHandle,
  ExtensionHostTaskOutputEvent,
  ExtensionHostTaskProgressEvent,
  ExtensionHostApiSchema,
  ExtensionInspection,
  ExtensionInstallResult,
  ExtensionPackResult,
  HostContextSyncRequest,
  HostEventEnvelope,
  HostPublishEventRequest,
  HostSubscription,
  HostSubscriptionRequest,
  HostTopicDescriptor,
  IpcStreamHandle,
  ExternalTerminalRequest,
  ExplorerSemanticFindSimilarRequest,
  ExplorerSemanticIndexBuildRequest,
  ExplorerSemanticIndexBuildStartResponse,
  ExplorerSemanticIndexSummary,
  ExplorerSemanticSearchRequest,
  ExplorerSemanticSearchResponse,
  GlobalSearchIndexQueryRequest,
  GlobalSearchResultEntry,
  GlobalSearchScanSettings,
  GlobalSearchStatus,
  TerminalShellIntegrationRequest,
  TerminalShellIntegrationState,
  TerminalWriteRequest,
} from '../generated/tauri';
import { subscribeIpcStream } from './ipc/streams';
import { commands, unwrapTauriResult } from './tauriClient';

export type {
  ExecutionContextPreviewSession,
  ExecutionContextSnapshot,
  ExtensionBuildResult,
  ExtensionHostFileWatchEvent,
  ExtensionHostFileWatchHandle,
  ExtensionHostTaskHandle,
  ExtensionHostTaskOutputEvent,
  ExtensionHostTaskProgressEvent,
  ExtensionHostApiSchema,
  ExplorerSemanticIndexSummary,
  ExplorerSemanticSearchResponse,
  GlobalSearchResultEntry,
  GlobalSearchStatus,
  ExtensionInspection,
  ExtensionInstallResult,
  ExtensionPackResult,
  HostEventEnvelope,
  HostSubscription,
  HostSubscriptionRequest,
  HostTopicDescriptor,
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

export interface ExtensionHostTaskStartProcessRequest {
  program: string;
  args?: string[];
  workingDirectory?: string | null;
  environment?: Record<string, string> | null;
}

export interface ExtensionHostTerminalSpawnRequest {
  id: string;
  workingDir?: string | null;
  shell?: string | null;
  rows?: number | null;
  cols?: number | null;
}

export interface ExtensionHostTerminalResizeRequest {
  id: string;
  rows: number;
  cols: number;
}

export interface ExtensionHostTerminalSyncCwdRequest {
  id: string;
  cwd: string;
}

export interface ExtensionHostTerminalSetPromptStateRequest {
  id: string;
  atPrompt: boolean;
  reportedCwd?: string | null;
}

export interface ExtensionHostFileWatchRequest {
  path: string;
  recursive?: boolean;
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

export function decodeExtensionHostEventPayload<TResult>(
  event: Pick<HostEventEnvelope, 'payloadJson'>,
): TResult | null {
  if (!event.payloadJson) {
    return null;
  }
  return JSON.parse(event.payloadJson) as TResult;
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
  context: {
    syncSnapshot: (request: HostContextSyncRequest) => Promise<void>;
  };
  host: {
    getApiSchema: () => Promise<ExtensionHostApiSchema>;
  };
  selection: {
    getSnapshot: () => Promise<ExecutionContextSnapshot>;
  };
  preview: {
    getSession: () => Promise<ExecutionContextPreviewSession | null>;
  };
  index: {
    init: () => Promise<GlobalSearchStatus>;
    getStatus: () => Promise<GlobalSearchStatus>;
    startScan: (settings: GlobalSearchScanSettings) => Promise<void>;
    cancelScan: () => Promise<void>;
    search: (
      request: GlobalSearchIndexQueryRequest,
    ) => Promise<GlobalSearchResultEntry[]>;
  };
  semantic: {
    getSummary: (rootPath: string) => Promise<ExplorerSemanticIndexSummary>;
    build: (
      request: ExplorerSemanticIndexBuildRequest,
    ) => Promise<ExplorerSemanticIndexBuildStartResponse>;
    search: (
      request: ExplorerSemanticSearchRequest,
    ) => Promise<ExplorerSemanticSearchResponse>;
    findSimilar: (
      request: ExplorerSemanticFindSimilarRequest,
    ) => Promise<ExplorerSemanticSearchResponse>;
  };
  events: {
    describeTopics: () => Promise<HostTopicDescriptor[]>;
    subscribe: (
      request: HostSubscriptionRequest,
      listener: (event: HostEventEnvelope) => void,
    ) => Promise<{
      subscription: HostSubscription;
      unsubscribe: () => Promise<void>;
    }>;
    unsubscribe: (subscriptionId: string) => Promise<HostSubscription | null>;
    getSnapshot: (request: HostSubscriptionRequest) => Promise<HostEventEnvelope[]>;
    publish: (topic: string, payload?: unknown) => Promise<HostEventEnvelope>;
  };
  files: {
    readText: (path: string) => Promise<string>;
    writeText: (path: string, content: string) => Promise<void>;
    listDirectory: (
      path: string,
      showHidden?: boolean,
    ) => Promise<ExtensionHostExplorerLocationListing>;
    stat: (path: string) => Promise<ExtensionHostFileStat>;
    watch: (
      request: ExtensionHostFileWatchRequest,
    ) => Promise<ExtensionHostFileWatchHandle>;
    unwatch: (watchId: string) => Promise<ExtensionHostFileWatchHandle | null>;
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
    startProcess: (
      request: ExtensionHostTaskStartProcessRequest,
    ) => Promise<ExtensionHostTaskHandle>;
    stopProcess: (taskId: string) => Promise<boolean>;
  };
  terminal: {
    spawn: (request: ExtensionHostTerminalSpawnRequest) => Promise<void>;
    write: (request: TerminalWriteRequest) => Promise<void>;
    writeMany: (writes: TerminalWriteRequest[]) => Promise<void>;
    resize: (request: ExtensionHostTerminalResizeRequest) => Promise<void>;
    kill: (id: string) => Promise<void>;
    openOutputStream: (id: string) => Promise<IpcStreamHandle>;
    registerShellIntegration: (
      request: TerminalShellIntegrationRequest,
    ) => Promise<TerminalShellIntegrationState>;
    syncCwd: (
      request: ExtensionHostTerminalSyncCwdRequest,
    ) => Promise<TerminalShellIntegrationState>;
    setPromptState: (
      request: ExtensionHostTerminalSetPromptStateRequest,
    ) => Promise<TerminalShellIntegrationState>;
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
    context: {
      syncSnapshot: async (request) => {
        await call<null, HostContextSyncRequest>('context.sync_snapshot', request);
      },
    },
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
    index: {
      init: () => call<GlobalSearchStatus>('index.init'),
      getStatus: () => call<GlobalSearchStatus>('index.get_status'),
      startScan: async (settings) => {
        await call<null, GlobalSearchScanSettings>('index.start_scan', settings);
      },
      cancelScan: async () => {
        await call<null>('index.cancel_scan');
      },
      search: (request) =>
        call<GlobalSearchResultEntry[], GlobalSearchIndexQueryRequest>(
          'index.search',
          request,
        ),
    },
    semantic: {
      getSummary: (rootPath) =>
        call<ExplorerSemanticIndexSummary, { rootPath: string }>(
          'semantic.get_summary',
          { rootPath },
        ),
      build: (request) =>
        call<
          ExplorerSemanticIndexBuildStartResponse,
          ExplorerSemanticIndexBuildRequest
        >('semantic.build', request),
      search: (request) =>
        call<ExplorerSemanticSearchResponse, ExplorerSemanticSearchRequest>(
          'semantic.search',
          request,
        ),
      findSimilar: (request) =>
        call<
          ExplorerSemanticSearchResponse,
          ExplorerSemanticFindSimilarRequest
        >('semantic.find_similar', request),
    },
    events: {
      describeTopics: () => call<HostTopicDescriptor[]>('events.describe_topics'),
      subscribe: async (request, listener) => {
        const subscription = await call<HostSubscription, HostSubscriptionRequest>(
          'events.subscribe',
          request,
        );
        const snapshots =
          request.includeSnapshot === true || request.replayFrom != null
            ? await call<HostEventEnvelope[], HostSubscriptionRequest>(
                'events.get_snapshot',
                request,
              )
            : [];
        snapshots.forEach((event) => {
          listener({
            ...event,
            subscriptionId: event.subscriptionId ?? subscription.subscriptionId,
          });
        });

        const stopStream = subscription.streamHandle
          ? await subscribeIpcStream<HostEventEnvelope>(
              subscription.streamHandle,
              listener,
              { releaseOnUnsubscribe: false },
            )
          : () => undefined;

        return {
          subscription,
          unsubscribe: async () => {
            await stopStream();
            await call<HostSubscription | null, { subscriptionId: string }>(
              'events.unsubscribe',
              { subscriptionId: subscription.subscriptionId },
            ).catch(() => null);
          },
        };
      },
      unsubscribe: (subscriptionId) =>
        call<HostSubscription | null, { subscriptionId: string }>(
          'events.unsubscribe',
          { subscriptionId },
        ),
      getSnapshot: (request) =>
        call<HostEventEnvelope[], HostSubscriptionRequest>('events.get_snapshot', request),
      publish: (topic, payload) =>
        call<HostEventEnvelope, HostPublishEventRequest>('events.publish', {
          topic,
          payloadJson: encodePayload(payload),
        }),
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
      watch: (request) =>
        call<ExtensionHostFileWatchHandle, ExtensionHostFileWatchRequest>(
          'files.watch',
          request,
        ),
      unwatch: (watchId) =>
        call<ExtensionHostFileWatchHandle | null, { watchId: string }>('files.unwatch', {
          watchId,
        }),
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
      startProcess: (request) =>
        call<ExtensionHostTaskHandle, ExtensionHostTaskStartProcessRequest>(
          'tasks.start_process',
          request,
        ),
      stopProcess: (taskId) =>
        call<boolean, { taskId: string }>('tasks.stop_process', { taskId }),
    },
    terminal: {
      spawn: async (request) => {
        await call<null, ExtensionHostTerminalSpawnRequest>('terminal.spawn', request);
      },
      write: async (request) => {
        await call<null, TerminalWriteRequest>('terminal.write', request);
      },
      writeMany: async (writes) => {
        await call<null, TerminalWriteRequest[]>('terminal.write_many', writes);
      },
      resize: async (request) => {
        await call<null, ExtensionHostTerminalResizeRequest>('terminal.resize', request);
      },
      kill: async (id) => {
        await call<null, { id: string }>('terminal.kill', { id });
      },
      openOutputStream: (id) =>
        call<IpcStreamHandle, { id: string }>('terminal.open_output_stream', { id }),
      registerShellIntegration: (request) =>
        call<TerminalShellIntegrationState, TerminalShellIntegrationRequest>(
          'terminal.register_shell_integration',
          request,
        ),
      syncCwd: (request) =>
        call<TerminalShellIntegrationState, ExtensionHostTerminalSyncCwdRequest>(
          'terminal.sync_cwd',
          request,
        ),
      setPromptState: (request) =>
        call<TerminalShellIntegrationState, ExtensionHostTerminalSetPromptStateRequest>(
          'terminal.set_prompt_state',
          request,
        ),
      openExternal: async (request) => {
        await call<null, ExternalTerminalRequest>('terminal.open_external', request);
      },
    },
  };
}
