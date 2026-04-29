import type { OverlayPluginApi } from '../../components/pluginRuntime';
import type {
  ExecutionContextPreviewSession,
  ExecutionContextSnapshot,
  ExtensionHostApiSchema,
} from '../../runtime/extensionHostApi';

function createEmptyExecutionContextSnapshot(
  executionContext: ExecutionContextSnapshot | null,
): ExecutionContextSnapshot {
  return executionContext ?? {
    roots: [],
    activeDirectory: null,
    cwd: null,
    focusedEntry: null,
    selectedEntries: [],
    previewSession: null,
    paneId: null,
    workspaceTabId: null,
    repoContext: null,
    activeFileType: null,
    revision: 'test-revision',
  };
}

function createMockHostApiSchema(): ExtensionHostApiSchema {
  return {
    apiVersion: 'test',
    transport: 'test',
    methods: [],
  };
}

function createMockExplorerListing(path: string) {
  return {
    kind: 'directory',
    path,
    parentPath: null,
    breadcrumbs: [],
    entries: [],
  };
}

export function createMockOverlayPluginApi(
  executionContext: ExecutionContextSnapshot | null = null,
): OverlayPluginApi {
  const boundExecutionContext = createEmptyExecutionContextSnapshot(
    executionContext,
  );

  return {
    invoke: async <T,>() => null as T,
    event: {} as never,
    window: {} as never,
    fs: {} as never,
    notification: {} as never,
    host: {
      call: async <TResult = unknown,>(_methodId?: string, _payload?: unknown) =>
        null as TResult,
      context: {
        syncSnapshot: async () => undefined,
      },
      host: {
        getApiSchema: async () => createMockHostApiSchema(),
      },
      selection: {
        getSnapshot: async () => boundExecutionContext,
      },
      preview: {
        getSession: async () =>
          (boundExecutionContext.previewSession ??
            null) as ExecutionContextPreviewSession | null,
      },
      index: {
        init: async () => ({
          isScanInProgress: false,
          isCommitting: false,
          isParallelScan: false,
          lastScanTime: null,
          indexedItemCount: 0,
          indexSizeBytes: 0,
          currentDriveRoot: null,
          driveScanErrors: [],
          isIndexValid: false,
          scannedDrivesCount: 0,
          totalDrivesCount: 0,
        }),
        getStatus: async () => ({
          isScanInProgress: false,
          isCommitting: false,
          isParallelScan: false,
          lastScanTime: null,
          indexedItemCount: 0,
          indexSizeBytes: 0,
          currentDriveRoot: null,
          driveScanErrors: [],
          isIndexValid: false,
          scannedDrivesCount: 0,
          totalDrivesCount: 0,
        }),
        startScan: async () => undefined,
        cancelScan: async () => undefined,
        search: async () => [],
      },
      semantic: {
        getSummary: async (rootPath) => ({
          rootPath,
          indexed: false,
          stale: false,
          fileCount: 0,
          chunkCount: 0,
          indexedAt: null,
          modelId: null,
          backendKind: null,
          providerKind: null,
          lastError: null,
        }),
        build: async (request) => ({
          taskId: 'mock-semantic-index-task',
          rootPath: request.rootPath,
        }),
        search: async () => ({
          results: [],
          diagnostics: {
            queryKind: 'query',
            backendKind: 'mock',
            providerKind: 'mock',
            modelId: 'mock',
            indexedFileCount: 0,
            indexedChunkCount: 0,
            staleIndex: false,
            resultLimit: 0,
            forceCpu: false,
          },
        }),
        findSimilar: async () => ({
          results: [],
          diagnostics: {
            queryKind: 'similarity',
            backendKind: 'mock',
            providerKind: 'mock',
            modelId: 'mock',
            indexedFileCount: 0,
            indexedChunkCount: 0,
            staleIndex: false,
            resultLimit: 0,
            forceCpu: false,
          },
        }),
      },
      events: {
        describeTopics: async () => [],
        subscribe: async () => ({
          subscription: {
            subscriptionId: 'mock-subscription',
            topics: [],
            transport: 'mock',
            supported: true,
            streamHandle: null,
          },
          unsubscribe: async () => undefined,
        }),
        unsubscribe: async () => null,
        getSnapshot: async () => [],
        publish: async () => ({
          eventId: 'mock-event',
          subscriptionId: null,
          topic: 'ext.mock.test',
          sequence: 1,
          emittedAtMs: 0,
          delivery: 'realtime',
          scope: {
            paneId: null,
            workspaceTabId: null,
            path: null,
            taskId: null,
            runtimeId: null,
            extensionId: null,
          },
          payloadJson: null,
          executionContext: boundExecutionContext,
          snapshot: false,
        }),
      },
      files: {
        readText: async () => '',
        writeText: async () => undefined,
        listDirectory: async (path: string) => createMockExplorerListing(path),
        stat: async (path: string) => ({
          path,
          exists: false,
          isDirectory: false,
          size: 0,
          modifiedMs: null,
          extension: null,
        }),
        watch: async (request) => ({
          watchId: `watch:${request.path}`,
          path: request.path,
          recursive: request.recursive ?? true,
        }),
        unwatch: async () => null,
      },
      explorer: {
        listLocation: async (path: string) => createMockExplorerListing(path),
        openPath: async () => undefined,
      },
      repo: {
        exec: async () => '',
      },
      tasks: {
        runCommand: async () => ({
          status: 0,
          stdout: '',
          stderr: '',
        }),
        startProcess: async (request) => ({
          taskId: `task:${request.program}`,
          program: request.program,
          workingDirectory:
            request.workingDirectory ??
            boundExecutionContext.cwd ??
            boundExecutionContext.activeDirectory ??
            '',
        }),
        stopProcess: async () => true,
      },
      terminal: {
        spawn: async () => undefined,
        write: async () => undefined,
        writeMany: async () => undefined,
        resize: async () => undefined,
        kill: async () => undefined,
        openOutputStream: async () => ({
          id: 'mock-terminal-stream',
          kind: 'terminal-output',
          eventName: 'ipc-stream-terminal-output-mock-terminal',
        }),
        registerShellIntegration: async () => ({
          shellKind: 'unknown',
          supportsAutoCd: true,
          atPrompt: true,
          reportedCwd: null,
          pendingCwd: null,
          lastSyncedCwd: null,
        }),
        syncCwd: async () => ({
          shellKind: 'unknown',
          supportsAutoCd: true,
          atPrompt: true,
          reportedCwd: null,
          pendingCwd: null,
          lastSyncedCwd: null,
        }),
        setPromptState: async () => ({
          shellKind: 'unknown',
          supportsAutoCd: true,
          atPrompt: true,
          reportedCwd: null,
          pendingCwd: null,
          lastSyncedCwd: null,
        }),
        openExternal: async () => undefined,
      },
    },
    index: {
      global: {
        init: async () => ({
          isScanInProgress: false,
          isCommitting: false,
          isParallelScan: false,
          lastScanTime: null,
          indexedItemCount: 0,
          indexSizeBytes: 0,
          currentDriveRoot: null,
          driveScanErrors: [],
          isIndexValid: false,
          scannedDrivesCount: 0,
          totalDrivesCount: 0,
        }),
        getStatus: async () => ({
          isScanInProgress: false,
          isCommitting: false,
          isParallelScan: false,
          lastScanTime: null,
          indexedItemCount: 0,
          indexSizeBytes: 0,
          currentDriveRoot: null,
          driveScanErrors: [],
          isIndexValid: false,
          scannedDrivesCount: 0,
          totalDrivesCount: 0,
        }),
        startScan: async () => undefined,
        cancelScan: async () => undefined,
        search: async () => [],
        searchUnderPath: async () => [],
        query: async () => [],
        findByExtensions: async () => [],
      },
      semantic: {
        getSummary: async (rootPath) => ({
          rootPath,
          indexed: false,
          stale: false,
          fileCount: 0,
          chunkCount: 0,
          indexedAt: null,
          modelId: null,
          backendKind: null,
          providerKind: null,
          lastError: null,
        }),
        build: async (request) => ({
          taskId: 'mock-semantic-index-task',
          rootPath: request.rootPath,
        }),
        search: async () => ({
          results: [],
          diagnostics: {
            queryKind: 'query',
            backendKind: 'mock',
            providerKind: 'mock',
            modelId: 'mock',
            indexedFileCount: 0,
            indexedChunkCount: 0,
            staleIndex: false,
            resultLimit: 0,
            forceCpu: false,
          },
        }),
        findSimilar: async () => ({
          results: [],
          diagnostics: {
            queryKind: 'similarity',
            backendKind: 'mock',
            providerKind: 'mock',
            modelId: 'mock',
            indexedFileCount: 0,
            indexedChunkCount: 0,
            staleIndex: false,
            resultLimit: 0,
            forceCpu: false,
          },
        }),
      },
      media: {
        findPictures: async () => [],
      },
    },
    settings: {
      pluginId: 'mock-plugin',
      getStoredValues: () => ({}),
      getValue: (_settingId, fallbackValue) => fallbackValue ?? null,
      setValue: () => undefined,
      patchValues: () => undefined,
      resetValues: () => undefined,
      subscribe: () => () => undefined,
    },
    refreshPlugins: async () => undefined,
    openPluginsFolder: async () => undefined,
    runBackend: async () => ({ stdout: '', stderr: '', status: 0 }),
    bindExecutionContext: (nextExecutionContext) =>
      createMockOverlayPluginApi(nextExecutionContext),
  };
}
