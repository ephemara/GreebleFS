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
    repoContext: null,
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
      call: async <TResult = unknown,>() => null as TResult,
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
      },
      terminal: {
        openExternal: async () => undefined,
      },
    },
    refreshPlugins: async () => undefined,
    openPluginsFolder: async () => undefined,
    runBackend: async () => ({ stdout: '', stderr: '', status: 0 }),
    bindExecutionContext: (nextExecutionContext) =>
      createMockOverlayPluginApi(nextExecutionContext),
  };
}
