import { randomUUID } from 'node:crypto';
import process from 'node:process';

import { createMcpExpressApp } from '@modelcontextprotocol/sdk/server/express.js';
import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest, type CallToolResult, type ContentBlock } from '@modelcontextprotocol/sdk/types.js';
import * as z from 'zod/v4';

import {
  GreeblefsAutomationRuntime,
  type GreeblefsUiTarget,
} from './runtime/greeblefsAutomationRuntime.js';

const DEFAULT_HTTP_PORT = 4281;
const MAX_JSON_PREVIEW_CHARS = 20_000;
const AGENT_USAGE_MANUAL_WORKSPACE_PATH = 'MCP/greeblefs-dev-mcp/AGENT_USAGE.md';
const AGENT_USAGE_MANUAL_RESOURCE_URI = 'manual://gfs-dev-mcp/how-to-use';
const KAIN_GUIDES_ROOT = 'src-kain/guides';
const KAIN_FFI_EXAMPLES_ROOT = 'src-kain/ffi/examples';
const KAIN_QUICKSTART_PATH = `${KAIN_GUIDES_ROOT}/quickstart.md`;
const KAIN_GUIDES_README_PATH = `${KAIN_GUIDES_ROOT}/README.md`;
const KAIN_DOCS_EXAMPLES_VALIDATOR_PATH = `${KAIN_GUIDES_ROOT}/examples/validate_examples.py`;
const KAIN_DEFAULT_CLI_TIMEOUT_MS = 30_000;
const KAIN_MAX_CLI_TIMEOUT_MS = 180_000;
const KAIN_SEARCH_MAX_FILE_BYTES = 320_000;
const KAIN_TEXT_EXTENSIONS = new Set([
  '.md',
  '.kn',
  '.toml',
  '.json',
  '.rs',
  '.py',
  '.ts',
  '.tsx',
  '.mjs',
  '.js',
  '.c',
  '.h',
  '.bat',
  '.ps1',
  '.sh',
]);
const KAIN_CONTENT_ROOTS = {
  guides: KAIN_GUIDES_ROOT,
  ffi_examples: KAIN_FFI_EXAMPLES_ROOT,
} as const;
const KAIN_LONG_RUNNING_ARGS = new Set(['lsp', 'watch', '--watch', '-w', 'bridge']);

const uiTargetSchema = z.object({
  selector: z.string().optional(),
  role: z.string().optional(),
  name: z.string().optional(),
  text: z.string().optional(),
  exact: z.boolean().optional(),
  agentId: z.string().optional(),
  actionId: z.string().optional(),
}).superRefine((value, context) => {
  if (!value.selector && !value.role && !value.text && !value.agentId && !value.actionId) {
    context.addIssue({
      code: 'custom',
      message: 'A UI target requires selector, role, text, agentId, or actionId.',
    });
  }
});

const hostEventRequestSchema = z.record(z.string(), z.unknown());
const hostEventSubscriptionIdSchema = z.string().min(1);

interface HostApiMethodDescriptor {
  methodId: string;
  namespace: string;
  summary: string;
  requiredPermissions?: string[];
}

interface HostApiSchemaRecord {
  apiVersion?: string;
  transport?: string;
  methods?: HostApiMethodDescriptor[];
}

interface SessionServerContext {
  runtime: GreeblefsAutomationRuntime;
  server: McpServer;
}

function parseCliArguments(argv: string[]): {
  transport: 'stdio' | 'http';
  port: number;
  doctor: boolean;
  doctorAttachProbe: boolean;
} {
  let transport: 'stdio' | 'http' = 'stdio';
  let port = DEFAULT_HTTP_PORT;
  let doctor = false;
  let doctorAttachProbe = false;

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--doctor') {
      doctor = true;
      continue;
    }
    if (value === '--attach-probe') {
      doctorAttachProbe = true;
      continue;
    }
    if (value === '--transport' && argv[index + 1]) {
      const transportValue = argv[index + 1];
      if (transportValue === 'stdio' || transportValue === 'http') {
        transport = transportValue;
      }
      index += 1;
      continue;
    }
    if (value === '--port' && argv[index + 1]) {
      const portValue = Number.parseInt(argv[index + 1], 10);
      if (Number.isFinite(portValue) && portValue > 0) {
        port = portValue;
      }
      index += 1;
    }
  }

  return {
    transport,
    port,
    doctor,
    doctorAttachProbe,
  };
}

function safeJsonText(value: unknown): string {
  const raw = JSON.stringify(value, null, 2);
  if (raw.length <= MAX_JSON_PREVIEW_CHARS) {
    return `${raw}\n`;
  }
  return `${raw.slice(0, MAX_JSON_PREVIEW_CHARS)}\n...truncated...\n`;
}

function buildMarkdownToolResult(markdown: string, structuredContent: Record<string, unknown>): CallToolResult {
  return {
    content: [
      {
        type: 'text' as const,
        text: markdown,
      },
    ],
    structuredContent,
  };
}

function buildJsonToolResult(summary: string, data: Record<string, unknown>, options: { isError?: boolean } = {}): CallToolResult {
  return {
    content: [
      {
        type: 'text' as const,
        text: `${summary}\n\n${safeJsonText(data)}`,
      },
    ],
    structuredContent: data,
    isError: options.isError === true,
  };
}

function buildUiTarget(value: z.infer<typeof uiTargetSchema>): GreeblefsUiTarget {
  return {
    selector: value.selector,
    role: value.role,
    name: value.name,
    text: value.text,
    exact: value.exact,
    agentId: value.agentId,
    actionId: value.actionId,
  };
}

function normalizeHostApiSchema(value: unknown): HostApiSchemaRecord | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const methods = Array.isArray((value as HostApiSchemaRecord).methods)
    ? ((value as HostApiSchemaRecord).methods ?? []).filter((method): method is HostApiMethodDescriptor => (
      Boolean(method)
      && typeof method?.methodId === 'string'
      && typeof method?.namespace === 'string'
      && typeof method?.summary === 'string'
    ))
    : [];
  if (methods.length === 0) {
    return null;
  }
  return {
    apiVersion: typeof (value as HostApiSchemaRecord).apiVersion === 'string'
      ? (value as HostApiSchemaRecord).apiVersion
      : undefined,
    transport: typeof (value as HostApiSchemaRecord).transport === 'string'
      ? (value as HostApiSchemaRecord).transport
      : undefined,
    methods,
  };
}

const compactToolCatalog = {
  gfs_how_to_use: {
    commands: ['all', 'overview', 'quick_start', 'tool_map', 'recipes', 'payloads', 'host_methods', 'kain', 'validation', 'troubleshooting'],
    summary: 'Read the markdown-backed agent manual for this compact MCP surface.',
  },
  gfs_help: {
    commands: ['all', 'how_to_use', 'app', 'ui_snapshot', 'ui_act', 'ui_capture', 'host', 'events', 'code', 'kain', 'validate', 'host_commands'],
    summary: 'Show compact MCP command groups and, on demand, the rich host API method catalog.',
  },
  gfs_app: {
    commands: ['status', 'doctor', 'start', 'stop', 'wait_ready', 'attach', 'log', 'windows'],
    summary: 'Control and inspect the live GreebleFS dev app/session.',
  },
  gfs_ui_snapshot: {
    commands: ['snapshot', 'actions', 'console', 'telemetry', 'performance', 'flow', 'profile'],
    summary: 'Read app/UI state and backend performance flow without driving the surface.',
  },
  gfs_ui_act: {
    commands: ['click', 'hover', 'type', 'key', 'select', 'drag', 'invoke_action', 'evaluate', 'console_clear'],
    summary: 'Drive the attached UI surface through Playwright/CDP.',
  },
  gfs_ui_capture: {
    commands: ['screenshot', 'native_window_screenshot', 'accessibility'],
    summary: 'Capture screenshots or accessibility trees from the live app/window.',
  },
  gfs_host: {
    commands: ['schema', 'call', 'context', 'selection', 'preview'],
    summary: 'Use the extension-host API through one router tool instead of one MCP tool per host method.',
  },
  gfs_events: {
    commands: ['describe', 'snapshot', 'subscribe', 'read', 'unsubscribe', 'publish'],
    summary: 'Read or subscribe to host event topics.',
  },
  gfs_code: {
    commands: [
      'agent_context',
      'git_status',
      'git_branch',
      'git_recent_commits',
      'git_changed_files',
      'git_diff',
      'git_show',
      'memory_recent',
      'memory_search',
      'architecture',
      'lessons',
      'workspace_read',
      'workspace_write',
      'workspace_list',
      'workspace_stat',
      'workspace_delete',
      'workspace_run',
    ],
    summary: 'Compact coding context, git, memory, architecture, and repo workspace operations.',
  },
  gfs_kain: {
    commands: ['overview', 'guide', 'search', 'examples', 'cli', 'doctor', 'run', 'validate_examples'],
    summary: 'Kain language guide, docs/examples search, FFI example discovery, and local .cargo/bin Kain CLI execution.',
  },
  gfs_validate: {
    commands: ['plan', 'run', 'typecheck', 'test_file', 'rust_test', 'smoke', 'smoke_screenshot', 'runtime_stack_quick', 'native_ring_benchmark'],
    summary: 'Plan and run focused validation commands, including native performance probes.',
  },
} as const;

function registerHostEventResources(server: McpServer, runtime: GreeblefsAutomationRuntime): void {
  server.registerResource(
    'host-events-subscription',
    new ResourceTemplate('host-events://subscription/{subscriptionId}', {
      list: undefined,
    }),
    {
      title: 'Host Event Subscription',
      description: 'Current retained event state for one live host-event subscription.',
      mimeType: 'application/json',
    },
    async (_uri, variables) => {
      const subscriptionId = String(variables.subscriptionId ?? '').trim();
      const state = await runtime.readHostEventSubscription(subscriptionId);
      return {
        contents: [
          {
            uri: runtime.getHostEventsResourceUri(subscriptionId),
            mimeType: 'application/json',
            text: safeJsonText(state),
          },
        ],
      };
    },
  );
}

function wrapToolHandler(
  toolName: string,
  handler: (args: any) => Promise<CallToolResult>,
) {
  return async (...callbackArgs: any[]): Promise<CallToolResult> => {
    const args = callbackArgs[0] ?? {};
    try {
      return await handler(args);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return buildJsonToolResult(`${toolName} failed`, {
        toolName,
        error: message,
      }, { isError: true });
    }
  };
}

async function buildDoctorReport(
  runtime: GreeblefsAutomationRuntime,
  options: { includeAttachProbe?: boolean } = {},
): Promise<Record<string, unknown>> {
  const status = await runtime.getStatus({ includeAttachProbe: options.includeAttachProbe === true });
  const logTail = await runtime.readDevLogTail(80);
  let bridgeStatus: unknown = null;
  let hostApiSchema: unknown = null;
  let snapshotSummary: unknown = null;
  let nativeWindows: unknown[] = [];

  try {
    nativeWindows = await runtime.listNativeWindows();
  } catch (error) {
    nativeWindows = [
      {
        unavailable: true,
        reason: error instanceof Error ? error.message : String(error),
      },
    ];
  }

  try {
    if (status.nativeAutomationReachable || status.bridgeReady) {
      hostApiSchema = await runtime.getHostApiSchema();
    } else {
      hostApiSchema = {
        unavailable: true,
        reason: 'Native automation and attached bridge are unavailable; doctor skipped bridge attach by default.',
      };
    }
  } catch (error) {
    hostApiSchema = {
      unavailable: true,
      reason: error instanceof Error ? error.message : String(error),
    };
  }

  if (status.bridgeReady) {
    bridgeStatus = await runtime.getBridgeStatus();
    const snapshot = await runtime.getBridgeSnapshot({
      includeDom: true,
      includeThemeVariables: true,
      includeTelemetryRecords: true,
      telemetryLimit: 25,
      consoleLimit: 40,
    }) as Record<string, unknown>;
    snapshotSummary = {
      status: snapshot.status ?? null,
      domNodeCount: Array.isArray(snapshot.domNodes) ? snapshot.domNodes.length : 0,
      themeVariableCount: snapshot.themeVariables && typeof snapshot.themeVariables === 'object'
        ? Object.keys(snapshot.themeVariables as Record<string, unknown>).length
        : 0,
      consoleEntryCount: Array.isArray(snapshot.consoleEntries) ? snapshot.consoleEntries.length : 0,
      errorCount: Array.isArray(snapshot.errors) ? snapshot.errors.length : 0,
    };
  }

  return {
    generatedAt: new Date().toISOString(),
    status,
    startup: {
      phase: status.startupPhase,
      hint: status.startupHint,
      recentLogActivity: status.recentLogActivity,
      attachProbeDeferredReason: status.attachProbeDeferredReason,
    },
    nativeAutomation: {
      reachable: status.nativeAutomationReachable,
      session: status.nativeAutomationSession,
    },
    frameworkDiagnostics: status.tauronWebviewDiagnostics,
    bridgeStatus,
    hostApiSchema,
    snapshotSummary,
    nativeWindows,
    logTail,
  };
}

function registerResources(server: McpServer, runtime: GreeblefsAutomationRuntime): void {
  server.registerResource(
    'agent-usage-manual',
    AGENT_USAGE_MANUAL_RESOURCE_URI,
    {
      title: 'GreebleFS Dev MCP Agent Manual',
      description: 'Markdown instructions for using the compact GreebleFS dev MCP router tools.',
      mimeType: 'text/markdown',
    },
    async () => {
      const manual = await readAgentUsageManual(runtime);
      return {
        contents: [
          {
            uri: AGENT_USAGE_MANUAL_RESOURCE_URI,
            mimeType: 'text/markdown',
            text: manual,
          },
        ],
      };
    },
  );

  server.registerResource(
    'status-current',
    'status://app',
    {
      title: 'App Status',
      description: 'Current GreebleFS dev-session status, attach state, and bridge readiness.',
      mimeType: 'application/json',
    },
    async () => {
      const status = await runtime.getStatus({ includeAttachProbe: true });
      return {
        contents: [
          {
            uri: 'status://app',
            mimeType: 'application/json',
            text: safeJsonText(status),
          },
        ],
      };
    },
  );

  server.registerResource(
    'snapshot-current',
    'snapshot://app',
    {
      title: 'UI Snapshot',
      description: 'Current semantic UI snapshot from the in-app dev MCP bridge.',
      mimeType: 'application/json',
    },
    async () => {
      const snapshot = await runtime.getBridgeSnapshot({
        includeDom: true,
        includeThemeVariables: true,
        includeTelemetryRecords: true,
        telemetryLimit: 40,
        consoleLimit: 60,
      });
      return {
        contents: [
          {
            uri: 'snapshot://app',
            mimeType: 'application/json',
            text: safeJsonText(snapshot),
          },
        ],
      };
    },
  );

  server.registerResource(
    'theme-current',
    'theme://current',
    {
      title: 'Theme Snapshot',
      description: 'Resolved theme variables and visible-node color data from the current app surface.',
      mimeType: 'application/json',
    },
    async () => {
      const snapshot = await runtime.getBridgeSnapshot({
        includeDom: true,
        includeThemeVariables: true,
        includeTelemetryRecords: false,
        consoleLimit: 20,
      }) as Record<string, unknown>;
      return {
        contents: [
          {
            uri: 'theme://current',
            mimeType: 'application/json',
            text: safeJsonText({
              themeVariables: snapshot.themeVariables ?? {},
              domNodes: snapshot.domNodes ?? [],
              focusedElement: snapshot.focusedElement ?? null,
            }),
          },
        ],
      };
    },
  );

  server.registerResource(
    'profile-current',
    'profile://current',
    {
      title: 'USR Profile Snapshot',
      description: 'Current USR profile runtime snapshot from the active app window.',
      mimeType: 'application/json',
    },
    async () => {
      const profileSnapshot = await runtime.getUsrProfileSnapshot();
      return {
        contents: [
          {
            uri: 'profile://current',
            mimeType: 'application/json',
            text: safeJsonText(profileSnapshot),
          },
        ],
      };
    },
  );

  server.registerResource(
    'telemetry-current',
    'telemetry://recent',
    {
      title: 'Telemetry Recent',
      description: 'Recent telemetry status and retained records from the active app window.',
      mimeType: 'application/json',
    },
    async () => {
      const telemetryStatus = await runtime.getTelemetryStatus();
      const telemetryRecords = await runtime.getTelemetryRecords(50);
      return {
        contents: [
          {
            uri: 'telemetry://recent',
            mimeType: 'application/json',
            text: safeJsonText({
              telemetryStatus,
              telemetryRecords,
            }),
          },
        ],
      };
    },
  );

  server.registerResource(
    'performance-current',
    'performance://current',
    {
      title: 'Performance Snapshot',
      description: 'Explorer performance snapshot and summary from the current app surface.',
      mimeType: 'application/json',
    },
    async () => {
      const performance = await runtime.getPerformanceSnapshot();
      return {
        contents: [
          {
            uri: 'performance://current',
            mimeType: 'application/json',
            text: safeJsonText(performance),
          },
        ],
      };
    },
  );

  server.registerResource(
    'console-current',
    'console://recent',
    {
      title: 'Recent Console Entries',
      description: 'Recent frontend console and runtime error entries retained by the dev bridge.',
      mimeType: 'application/json',
    },
    async () => {
      const consoleEntries = await runtime.getConsoleEntries(120);
      return {
        contents: [
          {
            uri: 'console://recent',
            mimeType: 'application/json',
            text: safeJsonText(consoleEntries),
          },
        ],
      };
    },
  );

  server.registerResource(
    'host-schema-current',
    'host-schema://current',
    {
      title: 'Host API Schema',
      description: 'Current extension-host method schema from the running app.',
      mimeType: 'application/json',
    },
    async () => {
      let hostApiSchema: unknown;
      try {
        hostApiSchema = await runtime.getHostApiSchema();
      } catch (error) {
        hostApiSchema = {
          unavailable: true,
          reason: error instanceof Error ? error.message : String(error),
        };
      }
      return {
        contents: [
          {
            uri: 'host-schema://current',
            mimeType: 'application/json',
            text: safeJsonText(hostApiSchema),
          },
        ],
      };
    },
  );

  registerHostEventResources(server, runtime);
}

function clampPositiveInt(value: unknown, fallback: number, max: number): number {
  const numeric = typeof value === 'number' ? Math.trunc(value) : Number.NaN;
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return fallback;
  }
  return Math.min(numeric, max);
}

function shellQuote(value: string): string {
  if (process.platform === 'win32') {
    return `'${value.replace(/'/g, "''")}'`;
  }
  return `'${value.replace(/'/g, "'\\''")}'`;
}

function requireString(value: unknown, fieldName: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`${fieldName} is required.`);
  }
  return value;
}

function requireTarget(value: z.infer<typeof uiTargetSchema> | undefined, fieldName = 'target'): z.infer<typeof uiTargetSchema> {
  if (!value) {
    throw new Error(`${fieldName} is required.`);
  }
  return value;
}

function textTailByLines(text: string, limitLines: number): string {
  const lines = text.split(/\r?\n/);
  return lines.slice(Math.max(0, lines.length - limitLines)).join('\n');
}

function textHeadByLines(text: string, limitLines: number): string {
  return text.split(/\r?\n/).slice(0, limitLines).join('\n');
}

function searchTextLines(text: string, query: string, limit: number): Array<{ line: number; text: string }> {
  const normalizedQuery = query.toLowerCase();
  const matches: Array<{ line: number; text: string }> = [];
  const lines = text.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    if (!lines[index].toLowerCase().includes(normalizedQuery)) {
      continue;
    }
    matches.push({
      line: index + 1,
      text: lines[index],
    });
    if (matches.length >= limit) {
      break;
    }
  }
  return matches;
}

async function readWorkspaceTextIfAvailable(
  runtime: GreeblefsAutomationRuntime,
  pathLike: string,
): Promise<{ available: true; path: string; content: string } | { available: false; path: string; reason: string }> {
  try {
    const result = await runtime.readWorkspaceText(pathLike);
    return {
      available: true,
      path: result.resolvedPath,
      content: result.content,
    };
  } catch (error) {
    return {
      available: false,
      path: pathLike,
      reason: error instanceof Error ? error.message : String(error),
    };
  }
}

function summarizeHostApiSchema(hostApiSchema: HostApiSchemaRecord | null): Record<string, unknown> {
  const methods = hostApiSchema?.methods ?? [];
  const namespaces = new Map<string, HostApiMethodDescriptor[]>();
  for (const method of methods) {
    const namespaceMethods = namespaces.get(method.namespace) ?? [];
    namespaceMethods.push(method);
    namespaces.set(method.namespace, namespaceMethods);
  }
  return {
    apiVersion: hostApiSchema?.apiVersion ?? null,
    transport: hostApiSchema?.transport ?? null,
    methodCount: methods.length,
    namespaces: Array.from(namespaces.entries()).map(([namespace, namespaceMethods]) => ({
      namespace,
      methodCount: namespaceMethods.length,
      methods: namespaceMethods.map((method) => ({
        methodId: method.methodId,
        summary: method.summary,
        requiredPermissions: method.requiredPermissions ?? [],
      })),
    })),
  };
}

function normalizeManualSectionId(value: unknown): string {
  return typeof value === 'string' && value.length > 0 ? value : 'all';
}

function markdownSectionTitleFromId(sectionId: string): string | null {
  switch (sectionId) {
    case 'overview':
      return 'Overview';
    case 'quick_start':
      return 'Quick Start';
    case 'tool_map':
      return 'Tool Map';
    case 'recipes':
      return 'Recipes';
    case 'payloads':
      return 'Payloads';
    case 'host_methods':
      return 'Host Methods';
    case 'kain':
      return 'Kain';
    case 'validation':
      return 'Validation';
    case 'troubleshooting':
      return 'Troubleshooting';
    default:
      return null;
  }
}

function extractMarkdownSection(markdown: string, sectionId: string): string {
  if (sectionId === 'all') {
    return markdown;
  }
  const title = markdownSectionTitleFromId(sectionId);
  if (!title) {
    return markdown;
  }
  const lines = markdown.split(/\r?\n/);
  const heading = `## ${title}`;
  const startIndex = lines.findIndex((line) => line.trim() === heading);
  if (startIndex < 0) {
    return markdown;
  }
  let endIndex = lines.length;
  for (let index = startIndex + 1; index < lines.length; index += 1) {
    if (/^##\s+/.test(lines[index])) {
      endIndex = index;
      break;
    }
  }
  const titleLine = lines.find((line) => line.startsWith('# ')) ?? '# GreebleFS Dev MCP Agent Manual';
  return [
    titleLine,
    '',
    ...lines.slice(startIndex, endIndex),
  ].join('\n').trimEnd() + '\n';
}

async function readAgentUsageManual(runtime: GreeblefsAutomationRuntime): Promise<string> {
  const result = await runtime.readWorkspaceText(AGENT_USAGE_MANUAL_WORKSPACE_PATH);
  return result.content;
}

function buildValidationPlan(files: string[]): Array<{ reason: string; command: string }> {
  const normalizedFiles = files.map((file) => file.replace(/\\/g, '/'));
  const commands: Array<{ reason: string; command: string }> = [];
  const pushCommand = (reason: string, command: string) => {
    if (!commands.some((entry) => entry.command === command)) {
      commands.push({ reason, command });
    }
  };

  if (normalizedFiles.some((file) => file.startsWith('MCP/greeblefs-dev-mcp/'))) {
    pushCommand('Dev MCP TypeScript changed.', 'bun run --cwd MCP/greeblefs-dev-mcp typecheck');
  }
  if (normalizedFiles.some((file) => file.endsWith('.test.ts') || file.endsWith('.test.tsx'))) {
    const testFiles = normalizedFiles
      .filter((file) => file.endsWith('.test.ts') || file.endsWith('.test.tsx'))
      .map(shellQuote)
      .join(' ');
    pushCommand('Focused Vitest files changed.', `bunx vitest run ${testFiles}`);
  }
  if (normalizedFiles.some((file) => file.startsWith('src-tauri/') || file.startsWith('crates/'))) {
    pushCommand('Rust/native files changed.', 'cargo test --manifest-path src-tauri/Cargo.toml --lib');
  }
  if (normalizedFiles.some((file) => file.startsWith('src/') && /\.(ts|tsx)$/.test(file))) {
    pushCommand('Frontend TypeScript changed.', 'bunx tsc -p tsconfig.json --noEmit --pretty false');
  }
  if (normalizedFiles.some((file) => file.startsWith('src-go/'))) {
    pushCommand('Go runtime files changed.', 'bash scripts/go/check.sh');
  }
  if (normalizedFiles.some((file) => file.startsWith('src-kain/') || file.startsWith('toolchains/kain/'))) {
    pushCommand('Kain runtime/toolchain files changed.', 'node scripts/kain/stage-kain-toolchain.mjs --verify-only');
    pushCommand('Kain CLI surface should resolve from the active local binary.', `${shellQuote(getKainBinaryPath('kain'))} doctor`);
  }
  if (commands.length === 0) {
    pushCommand('Default quick repo sanity.', 'git status --short --branch');
  }
  return commands;
}

async function collectChangedFiles(runtime: GreeblefsAutomationRuntime): Promise<string[]> {
  const status = await runtime.runWorkspaceCommand('git status --short --untracked-files=all');
  return status.stdout
    .split(/\r?\n/)
    .map((line) => line.slice(3).trim())
    .filter(Boolean)
    .map((line) => line.includes(' -> ') ? line.split(' -> ').pop() ?? line : line);
}

async function buildAgentContext(runtime: GreeblefsAutomationRuntime, limit: number): Promise<Record<string, unknown>> {
  const [
    appStatus,
    gitStatus,
    gitBranch,
    gitRecentCommits,
    changedFiles,
    memory,
    architecture,
  ] = await Promise.all([
    runtime.getStatus({ includeAttachProbe: false }).catch((error) => ({
      unavailable: true,
      reason: error instanceof Error ? error.message : String(error),
    })),
    runtime.runWorkspaceCommand('git status --short --branch'),
    runtime.runWorkspaceCommand('git branch --show-current'),
    runtime.runWorkspaceCommand(`git log -n ${limit} --pretty=format:"%h %ad %s" --date=short`),
    collectChangedFiles(runtime).catch(() => []),
    readWorkspaceTextIfAvailable(runtime, 'memory.md'),
    readWorkspaceTextIfAvailable(runtime, 'ARCHITECTURE.md'),
  ]);

  const memoryRecent = memory.available
    ? textTailByLines(memory.content, 80)
    : memory;
  const architecturePointers = architecture.available
    ? searchTextLines(architecture.content, 'MCP', 18)
    : architecture;

  return {
    generatedAt: new Date().toISOString(),
    appStatus,
    git: {
      status: gitStatus.stdout,
      branch: gitBranch.stdout.trim(),
      recentCommits: gitRecentCommits.stdout,
      changedFiles,
    },
    memoryRecent,
    architecturePointers,
    recommendedValidation: buildValidationPlan(changedFiles),
  };
}

type KainContentRootKey = keyof typeof KAIN_CONTENT_ROOTS;
type KainBinaryName = 'kain' | 'kain-pro' | 'kn';

interface KainListedFile {
  path: string;
  displayPath: string;
  size: number;
  modifiedAt: string | null;
}

function normalizeWorkspacePathText(pathLike: string): string {
  return pathLike.replace(/\\/g, '/').replace(/^\/+/, '').replace(/^\.\//, '');
}

function assertNoParentTraversal(pathLike: string): void {
  if (pathLike.split('/').some((segment) => segment === '..')) {
    throw new Error(`Path is not allowed to traverse outside Kain roots: ${pathLike}`);
  }
}

function normalizeKainContentPath(pathLike: string | undefined, defaultRoot: KainContentRootKey): string {
  let normalized = normalizeWorkspacePathText(pathLike?.trim() || '');
  const defaultRootPath = KAIN_CONTENT_ROOTS[defaultRoot];
  if (!normalized) {
    return defaultRootPath;
  }
  if (normalized === 'guides') {
    normalized = KAIN_GUIDES_ROOT;
  } else if (normalized === 'ffi_examples' || normalized === 'examples') {
    normalized = KAIN_FFI_EXAMPLES_ROOT;
  } else if (normalized.startsWith('guides/')) {
    normalized = `${KAIN_GUIDES_ROOT}/${normalized.slice('guides/'.length)}`;
  } else if (normalized.startsWith('ffi_examples/')) {
    normalized = `${KAIN_FFI_EXAMPLES_ROOT}/${normalized.slice('ffi_examples/'.length)}`;
  }
  const allowedRoot = Object.values(KAIN_CONTENT_ROOTS)
    .some((rootPath) => normalized === rootPath || normalized.startsWith(`${rootPath}/`));
  if (!allowedRoot) {
    normalized = `${defaultRootPath}/${normalized}`;
  }
  normalized = normalizeWorkspacePathText(normalized);
  assertNoParentTraversal(normalized);
  if (!Object.values(KAIN_CONTENT_ROOTS).some((rootPath) => normalized === rootPath || normalized.startsWith(`${rootPath}/`))) {
    throw new Error(`Kain content path must stay under ${KAIN_GUIDES_ROOT} or ${KAIN_FFI_EXAMPLES_ROOT}.`);
  }
  return normalized;
}

function normalizeKainSourcePath(pathLike: string): string {
  const normalized = normalizeWorkspacePathText(pathLike.trim());
  if (!normalized) {
    throw new Error('path is required.');
  }
  assertNoParentTraversal(normalized);
  if (normalized.startsWith('src-kain/')) {
    return normalized;
  }
  return `${KAIN_GUIDES_ROOT}/examples/${normalized}`;
}

function kainDisplayPath(pathLike: string): string {
  const normalized = normalizeWorkspacePathText(pathLike);
  if (normalized === KAIN_GUIDES_ROOT) {
    return 'guides/';
  }
  if (normalized === KAIN_FFI_EXAMPLES_ROOT) {
    return 'ffi_examples/';
  }
  if (normalized.startsWith(`${KAIN_GUIDES_ROOT}/`)) {
    return `guides/${normalized.slice(KAIN_GUIDES_ROOT.length + 1)}`;
  }
  if (normalized.startsWith(`${KAIN_FFI_EXAMPLES_ROOT}/`)) {
    return `ffi_examples/${normalized.slice(KAIN_FFI_EXAMPLES_ROOT.length + 1)}`;
  }
  return normalized;
}

function getKainFileExtension(pathLike: string): string {
  const name = normalizeWorkspacePathText(pathLike).split('/').pop() ?? '';
  const dotIndex = name.lastIndexOf('.');
  return dotIndex >= 0 ? name.slice(dotIndex).toLowerCase() : '';
}

function shouldSkipKainTraversal(pathLike: string): boolean {
  const segments = normalizeWorkspacePathText(pathLike).split('/');
  return segments.some((segment) => (
    segment === '.git'
    || segment === 'node_modules'
    || segment === 'target'
    || segment === '.kain'
    || segment === 'outputs'
    || segment === 'generated_native_host'
  ));
}

async function listKainTextFiles(
  runtime: GreeblefsAutomationRuntime,
  roots: KainContentRootKey[],
  limit: number,
): Promise<{ files: KainListedFile[]; truncated: boolean }> {
  const files: KainListedFile[] = [];
  const queue: string[] = roots.map((root) => KAIN_CONTENT_ROOTS[root]);
  let truncated = false;

  while (queue.length > 0) {
    const currentPath = queue.shift() ?? '';
    if (!currentPath || shouldSkipKainTraversal(currentPath)) {
      continue;
    }
    const listing = await runtime.listWorkspaceDirectory(currentPath);
    for (const entry of listing.entries) {
      const relativePath = normalizeWorkspacePathText(entry.relativePath);
      if (shouldSkipKainTraversal(relativePath)) {
        continue;
      }
      if (entry.isDirectory) {
        queue.push(relativePath);
        continue;
      }
      if (!KAIN_TEXT_EXTENSIONS.has(getKainFileExtension(relativePath))) {
        continue;
      }
      files.push({
        path: relativePath,
        displayPath: kainDisplayPath(relativePath),
        size: entry.size,
        modifiedAt: entry.modifiedAt,
      });
      if (files.length >= limit) {
        truncated = true;
        return { files, truncated };
      }
    }
  }
  files.sort((left, right) => left.path.localeCompare(right.path));
  return { files, truncated };
}

async function readKainContent(
  runtime: GreeblefsAutomationRuntime,
  pathLike: string | undefined,
  defaultRoot: KainContentRootKey,
  limitLines: number,
): Promise<Record<string, unknown>> {
  const contentPath = normalizeKainContentPath(pathLike, defaultRoot);
  const stat = await runtime.statWorkspacePath(contentPath);
  if (!stat.exists) {
    throw new Error(`Kain content path does not exist: ${contentPath}`);
  }
  if (stat.isDirectory) {
    const listing = await runtime.listWorkspaceDirectory(contentPath);
    const readmePath = `${contentPath}/README.md`;
    const readme = await readWorkspaceTextIfAvailable(runtime, readmePath);
    return {
      requestedPath: pathLike ?? '',
      resolvedPath: contentPath,
      displayPath: kainDisplayPath(contentPath),
      kind: 'directory',
      entries: listing.entries.map((entry) => ({
        name: entry.name,
        path: kainDisplayPath(entry.relativePath),
        isDirectory: entry.isDirectory,
        size: entry.size,
        modifiedAt: entry.modifiedAt,
      })),
      readme: readme.available ? textHeadByLines(readme.content, limitLines) : readme,
    };
  }
  if (!KAIN_TEXT_EXTENSIONS.has(getKainFileExtension(contentPath))) {
    throw new Error(`Kain content reader only returns text-like files: ${contentPath}`);
  }
  const result = await runtime.readWorkspaceText(contentPath);
  return {
    requestedPath: pathLike ?? '',
    resolvedPath: result.resolvedPath,
    displayPath: kainDisplayPath(contentPath),
    kind: 'file',
    content: textHeadByLines(result.content, limitLines),
    totalLines: result.content.split(/\r?\n/).length,
    truncated: result.content.split(/\r?\n/).length > limitLines,
  };
}

async function searchKainContent(
  runtime: GreeblefsAutomationRuntime,
  query: string,
  roots: KainContentRootKey[],
  limit: number,
): Promise<Record<string, unknown>> {
  const files = await listKainTextFiles(runtime, roots, 1_200);
  const matches: Array<{ path: string; line: number; text: string }> = [];
  const skippedLargeFiles: string[] = [];
  const normalizedQuery = query.toLowerCase();

  for (const file of files.files) {
    if (file.size > KAIN_SEARCH_MAX_FILE_BYTES) {
      skippedLargeFiles.push(file.displayPath);
      continue;
    }
    const content = await runtime.readWorkspaceText(file.path).catch(() => null);
    if (!content) {
      continue;
    }
    const lines = content.content.split(/\r?\n/);
    for (let index = 0; index < lines.length; index += 1) {
      if (!lines[index].toLowerCase().includes(normalizedQuery)) {
        continue;
      }
      matches.push({
        path: file.displayPath,
        line: index + 1,
        text: lines[index],
      });
      if (matches.length >= limit) {
        return {
          query,
          roots,
          matches,
          searchedFileCount: files.files.length,
          skippedLargeFiles,
          truncated: true,
        };
      }
    }
  }
  return {
    query,
    roots,
    matches,
    searchedFileCount: files.files.length,
    skippedLargeFiles,
    truncated: files.truncated,
  };
}

async function buildKainExampleIndex(runtime: GreeblefsAutomationRuntime, limit: number): Promise<Record<string, unknown>> {
  const summaries: Array<Record<string, unknown>> = [];
  const queue = [KAIN_FFI_EXAMPLES_ROOT];
  let visitedDirectoryCount = 0;

  while (queue.length > 0 && summaries.length < limit) {
    const currentPath = queue.shift() ?? '';
    if (!currentPath || shouldSkipKainTraversal(currentPath)) {
      continue;
    }
    visitedDirectoryCount += 1;
    const listing = await runtime.listWorkspaceDirectory(currentPath).catch(() => null);
    if (!listing) {
      continue;
    }
    const files = listing.entries.filter((entry) => !entry.isDirectory);
    const directories = listing.entries.filter((entry) => entry.isDirectory);
    const readme = files.find((entry) => entry.name.toLowerCase() === 'readme.md');
    const smokeFiles = files.filter((entry) => entry.name.endsWith('.kn') && entry.name.toLowerCase().includes('smoke'));
    const runScripts = files.filter((entry) => /^run_|^build_|^launch_|^capture_|^refresh_|^generate_/i.test(entry.name));
    const manifests = files.filter((entry) => /^KAIN/i.test(entry.name) || entry.name.endsWith('_manifest.json') || entry.name === 'pipeline_manifest.json');
    if (currentPath !== KAIN_FFI_EXAMPLES_ROOT && (readme || smokeFiles.length > 0 || runScripts.length > 0 || manifests.length > 0)) {
      summaries.push({
        path: kainDisplayPath(currentPath),
        readme: readme ? kainDisplayPath(readme.relativePath) : null,
        smokeFiles: smokeFiles.map((entry) => kainDisplayPath(entry.relativePath)),
        runScripts: runScripts.map((entry) => kainDisplayPath(entry.relativePath)),
        manifests: manifests.map((entry) => kainDisplayPath(entry.relativePath)),
      });
    }
    for (const directory of directories) {
      queue.push(normalizeWorkspacePathText(directory.relativePath));
    }
  }

  return {
    root: kainDisplayPath(KAIN_FFI_EXAMPLES_ROOT),
    visitedDirectoryCount,
    examples: summaries,
    truncated: summaries.length >= limit,
  };
}

function getKainCargoBinDirectory(): string {
  const override = process.env.GREEBLEFS_KAIN_CARGO_BIN_DIR?.trim();
  if (override) {
    return override;
  }
  const userProfile = process.env.USERPROFILE?.trim() || 'C:\\Users\\Admin';
  return `${userProfile}\\.cargo\\bin`;
}

function getKainBinaryPath(binaryName: KainBinaryName = 'kain'): string {
  const executable = binaryName === 'kain-pro'
    ? 'kain-pro.exe'
    : binaryName === 'kn'
      ? 'kn.exe'
      : 'kain.exe';
  return `${getKainCargoBinDirectory()}\\${executable}`;
}

function buildKainCommandEnvironment(): Record<string, string> {
  const userProfile = process.env.USERPROFILE?.trim() || 'C:\\Users\\Admin';
  const cargoBinDirectory = getKainCargoBinDirectory();
  const pythonDirectory = `${userProfile}\\AppData\\Local\\Programs\\Python\\Python311`;
  const pathValue = process.env.PATH ?? process.env.Path ?? '';
  const pathSegments = [cargoBinDirectory, pythonDirectory, `${pythonDirectory}\\Scripts`, pathValue]
    .filter((segment) => segment.length > 0);
  const pathWithTooling = Array.from(new Map(
    pathSegments.map((segment) => [segment.toLowerCase(), segment] as const),
  ).values()).join(';');
  return {
    USERPROFILE: userProfile,
    HOME: process.env.HOME?.trim() || userProfile,
    HOMEDRIVE: process.env.HOMEDRIVE?.trim() || 'C:',
    HOMEPATH: process.env.HOMEPATH?.trim() || '\\Users\\Admin',
    APPDATA: process.env.APPDATA?.trim() || `${userProfile}\\AppData\\Roaming`,
    LOCALAPPDATA: process.env.LOCALAPPDATA?.trim() || `${userProfile}\\AppData\\Local`,
    TEMP: process.env.TEMP?.trim() || `${userProfile}\\AppData\\Local\\Temp`,
    TMP: process.env.TMP?.trim() || `${userProfile}\\AppData\\Local\\Temp`,
    CARGO_HOME: process.env.CARGO_HOME?.trim() || `${userProfile}\\.cargo`,
    KAIN_ROOT: process.env.KAIN_ROOT?.trim() || 'M:\\Kain-Lang\\kain-private\\kain',
    KAIN_STDLIB_PATH: process.env.KAIN_STDLIB_PATH?.trim() || 'M:\\Code\\Kain\\stdlib',
    KAIN_RUNTIME_C_PATH: process.env.KAIN_RUNTIME_C_PATH?.trim() || 'M:\\Code\\Kain\\runtime\\kain_runtime.c',
    KAIN_RUNTIME_MANIFEST_PATH: process.env.KAIN_RUNTIME_MANIFEST_PATH?.trim() || 'M:\\Code\\Kain\\runtime\\native_runtime.toml',
    KAIN_CLANG_PATH: process.env.KAIN_CLANG_PATH?.trim() || 'M:\\Code\\Kain\\toolchain\\llvm\\bin\\clang.exe',
    COMSPEC: process.env.COMSPEC?.trim() || 'C:\\Windows\\System32\\cmd.exe',
    SystemRoot: process.env.SystemRoot?.trim() || 'C:\\Windows',
    WINDIR: process.env.WINDIR?.trim() || 'C:\\Windows',
    PATHEXT: process.env.PATHEXT?.trim() || '.COM;.EXE;.BAT;.CMD;.VBS;.VBE;.JS;.JSE;.WSF;.WSH;.MSC;.CPL',
    PATH: pathWithTooling,
    Path: pathWithTooling,
  };
}

function normalizeKainCliArgs(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((item) => String(item)).filter((item) => item.length > 0);
}

function assertKainCliArgsAllowed(args: string[], allowLongRunning: boolean): void {
  if (allowLongRunning) {
    return;
  }
  const blocked = args.find((arg) => KAIN_LONG_RUNNING_ARGS.has(arg.toLowerCase()));
  if (blocked) {
    throw new Error(`Kain CLI arg "${blocked}" can be long-running. Set allowLongRunning=true and timeoutMs explicitly if you really need it.`);
  }
}

function buildKainCliCommand(binaryName: KainBinaryName, args: string[]): string {
  const binaryPath = getKainBinaryPath(binaryName);
  const executable = process.platform === 'win32'
    ? `& ${shellQuote(binaryPath)}`
    : shellQuote(binaryPath);
  return [executable, ...args.map(shellQuote)].join(' ');
}

async function runKainCli(
  runtime: GreeblefsAutomationRuntime,
  binaryName: KainBinaryName,
  args: string[],
  options: { cwd?: string; timeoutMs?: number; allowLongRunning?: boolean } = {},
): Promise<Record<string, unknown>> {
  assertKainCliArgsAllowed(args, options.allowLongRunning === true);
  const timeoutMs = Math.min(
    clampPositiveInt(options.timeoutMs, KAIN_DEFAULT_CLI_TIMEOUT_MS, KAIN_MAX_CLI_TIMEOUT_MS),
    KAIN_MAX_CLI_TIMEOUT_MS,
  );
  const command = buildKainCliCommand(binaryName, args);
  const result = await runtime.runWorkspaceCommand(command, {
    cwd: options.cwd,
    env: buildKainCommandEnvironment(),
    timeoutMs,
  });
  return {
    binary: binaryName,
    binaryPath: getKainBinaryPath(binaryName),
    args,
    timeoutMs,
    result,
  };
}

async function buildKainOverview(runtime: GreeblefsAutomationRuntime, limitLines: number): Promise<Record<string, unknown>> {
  const [guideReadme, quickstart, cliHelp, doctor] = await Promise.all([
    readWorkspaceTextIfAvailable(runtime, KAIN_GUIDES_README_PATH),
    readWorkspaceTextIfAvailable(runtime, KAIN_QUICKSTART_PATH),
    runKainCli(runtime, 'kain', ['--help'], { timeoutMs: 15_000 }).catch((error) => ({
      unavailable: true,
      reason: error instanceof Error ? error.message : String(error),
    })),
    runKainCli(runtime, 'kain', ['doctor'], { timeoutMs: 20_000 }).catch((error) => ({
      unavailable: true,
      reason: error instanceof Error ? error.message : String(error),
    })),
  ]);

  return {
    generatedAt: new Date().toISOString(),
    purpose: 'Agent-facing Kain orientation for the private language surface embedded in GreebleFS.',
    docRoots: [
      {
        id: 'guides',
        path: KAIN_GUIDES_ROOT,
        useFor: 'Canonical Kain language, CLI, runtime, target, and troubleshooting docs.',
      },
      {
        id: 'ffi_examples',
        path: KAIN_FFI_EXAMPLES_ROOT,
        useFor: 'Current proof lanes for Python, Node, C, Rust crate, GPU, UI, Fabric, and 3D FFI workflows.',
      },
    ],
    localCli: {
      cargoBinDirectory: getKainCargoBinDirectory(),
      defaultBinary: getKainBinaryPath('kain'),
      proBinary: getKainBinaryPath('kain-pro'),
      knLauncher: getKainBinaryPath('kn'),
      cliHelp,
      doctor,
    },
    quickstart: quickstart.available ? textHeadByLines(quickstart.content, limitLines) : quickstart,
    guideMap: guideReadme.available ? textHeadByLines(guideReadme.content, limitLines) : guideReadme,
    recommendedFlow: [
      { tool: 'gfs_kain', payload: { command: 'overview' } },
      { tool: 'gfs_kain', payload: { command: 'guide', path: 'quickstart.md' } },
      { tool: 'gfs_kain', payload: { command: 'search', query: 'feature or error text', roots: ['guides', 'ffi_examples'] } },
      { tool: 'gfs_kain', payload: { command: 'cli', args: ['doctor'] } },
      { tool: 'gfs_kain', payload: { command: 'validate_examples', path: '00_hello_and_cli.kn' } },
    ],
  };
}

function normalizeKainRoots(value: unknown): KainContentRootKey[] {
  if (!Array.isArray(value) || value.length === 0) {
    return ['guides', 'ffi_examples'];
  }
  const roots = value.filter((item): item is KainContentRootKey => item === 'guides' || item === 'ffi_examples');
  return roots.length > 0 ? Array.from(new Set(roots)) : ['guides', 'ffi_examples'];
}

function basenameFromPath(pathLike: string): string {
  return normalizeWorkspacePathText(pathLike).split('/').filter(Boolean).pop() ?? pathLike;
}

function buildKainDocsExampleValidationCommand(pathLike: string | undefined, validationClass: string | undefined, keepOutput: boolean): string {
  const args = [
    shellQuote(KAIN_DOCS_EXAMPLES_VALIDATOR_PATH),
    '--kain',
    shellQuote(getKainBinaryPath('kain')),
  ];
  if (pathLike) {
    args.push('--only', shellQuote(basenameFromPath(pathLike)));
  }
  if (validationClass) {
    args.push('--class', shellQuote(validationClass));
  }
  if (keepOutput) {
    args.push('--keep-output');
  }
  const pythonExecutable = process.env.GREEBLEFS_KAIN_PYTHON?.trim()
    || `${process.env.USERPROFILE?.trim() || 'C:\\Users\\Admin'}\\AppData\\Local\\Programs\\Python\\Python311\\python.exe`;
  const pythonLauncher = process.platform === 'win32' ? `& ${shellQuote(pythonExecutable)}` : 'python3';
  return [pythonLauncher, ...args].join(' ');
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function readPath(root: unknown, pathSegments: string[]): unknown {
  let cursor: unknown = root;
  for (const segment of pathSegments) {
    const record = asRecord(cursor);
    if (!record || !(segment in record)) {
      return undefined;
    }
    cursor = record[segment];
  }
  return cursor;
}

function readNumberPath(root: unknown, pathSegments: string[]): number | null {
  const value = readPath(root, pathSegments);
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function collectPerformanceFlowSignals(nativeFlow: unknown, frontendPerformance: unknown): Array<Record<string, unknown>> {
  const signals: Array<Record<string, unknown>> = [];
  const pushSignal = (severity: 'info' | 'warn' | 'critical', area: string, message: string, value?: unknown) => {
    signals.push({ severity, area, message, value });
  };

  if (asRecord(nativeFlow)?.unavailable === true) {
    pushSignal('critical', 'native-automation', 'Native performance flow is unavailable; backend truth cannot be assessed from this snapshot.', asRecord(nativeFlow)?.reason);
    return signals;
  }

  const nativeQueueDepth = readNumberPath(nativeFlow, ['nativeTaskGraph', 'telemetry', 'queueDepth']) ?? 0;
  const nativeActiveTasks = readNumberPath(nativeFlow, ['nativeTaskGraph', 'telemetry', 'activeTasks']) ?? 0;
  const nativeRejectedTasks = readNumberPath(nativeFlow, ['nativeTaskGraph', 'telemetry', 'rejectedTasks']) ?? 0;
  const nativeFailedTasks = readNumberPath(nativeFlow, ['nativeTaskGraph', 'telemetry', 'failedTasks']) ?? 0;
  const nativeStaleCancelledTasks = readNumberPath(nativeFlow, ['nativeTaskGraph', 'telemetry', 'staleCancelledTasks']) ?? 0;
  if (nativeQueueDepth > 0 || nativeActiveTasks > 0) {
    pushSignal('info', 'native-task-graph', 'Native task graph has live queued or active work.', { queueDepth: nativeQueueDepth, activeTasks: nativeActiveTasks });
  }
  if (nativeRejectedTasks > 0) {
    pushSignal('critical', 'native-task-graph', 'Native task graph rejected work; inspect lane caps, stale cancellation, and queue pressure.', nativeRejectedTasks);
  }
  if (nativeFailedTasks > 0) {
    pushSignal('warn', 'native-task-graph', 'Native task graph has failed work in this session.', nativeFailedTasks);
  }
  if (nativeStaleCancelledTasks > 0) {
    pushSignal('info', 'native-task-graph', 'Stale native work was cancelled, which is expected during fast navigation but useful for regression analysis.', nativeStaleCancelledTasks);
  }

  const nativeBufferPool = readPath(nativeFlow, ['nativeBuffers', 'nativeBufferPool']);
  const inFlightBuffers = readNumberPath(nativeBufferPool, ['inFlight']) ?? 0;
  const bufferWaitCount = readNumberPath(nativeBufferPool, ['waitCount']) ?? 0;
  const generationMismatchCount = readNumberPath(nativeBufferPool, ['generationMismatchCount']) ?? 0;
  if (inFlightBuffers > 0) {
    pushSignal('info', 'native-buffer-pool', 'Native shared buffers are currently in flight.', inFlightBuffers);
  }
  if (bufferWaitCount > 0) {
    pushSignal('warn', 'native-buffer-pool', 'Native buffer pool waited for slots; this can indicate payload pressure or slow JS release.', bufferWaitCount);
  }
  if (generationMismatchCount > 0) {
    pushSignal('critical', 'native-buffer-pool', 'Native buffer pool saw generation mismatches; inspect JS release ordering.', generationMismatchCount);
  }

  const nativeByteStream = readPath(nativeFlow, ['nativeBuffers', 'nativeByteStream']);
  const streamPostFailures = readNumberPath(nativeByteStream, ['postFailures']) ?? 0;
  const streamDroppedBytes = readNumberPath(nativeByteStream, ['droppedBytes']) ?? 0;
  const unavailableSubscriptions = readNumberPath(nativeByteStream, ['unavailableSubscriptions']) ?? 0;
  if (streamPostFailures > 0 || unavailableSubscriptions > 0) {
    pushSignal('warn', 'native-byte-stream', 'Native byte streams had failed or unavailable subscribers.', { postFailures: streamPostFailures, unavailableSubscriptions });
  }
  if (streamDroppedBytes > 0) {
    pushSignal('warn', 'native-byte-stream', 'Native byte stream payloads were dropped before delivery.', streamDroppedBytes);
  }

  const telemetryRingOverflow = readPath(nativeFlow, ['messageRings', 'telemetryRecentRecords', 'overflow']);
  if (asRecord(telemetryRingOverflow)?.overflowed === true) {
    pushSignal('warn', 'message-rings', 'Telemetry recent-record ring overflowed; older diagnostics were evicted.', telemetryRingOverflow);
  }
  const hostEventTopics = readPath(nativeFlow, ['messageRings', 'hostEvents', 'topics']);
  if (Array.isArray(hostEventTopics)) {
    for (const topic of hostEventTopics) {
      const topicName = String(readPath(topic, ['topic']) ?? 'unknown');
      const overflow = readPath(topic, ['telemetry', 'overflow']);
      if (asRecord(overflow)?.overflowed === true) {
        pushSignal('warn', 'host-event-rings', `Host event ring overflowed for ${topicName}.`, overflow);
      }
    }
  }

  const frontendStatus = asRecord(frontendPerformance);
  if (frontendStatus?.unavailable === true) {
    pushSignal('info', 'frontend-performance', 'Frontend performance bridge snapshot is unavailable; backend-native flow is still authoritative for native changes.', frontendStatus.reason);
  }

  if (signals.length === 0) {
    pushSignal('info', 'performance-flow', 'No obvious native queue, buffer, stream, or ring pressure is visible in this snapshot.');
  }
  return signals;
}

async function buildPerformanceFlowReport(runtime: GreeblefsAutomationRuntime, limit: number): Promise<Record<string, unknown>> {
  const [
    appStatus,
    nativeFlow,
    frontendPerformance,
    telemetryStatus,
    telemetryRecords,
    gitStatus,
    gitRecentCommits,
    changedFiles,
  ] = await Promise.all([
    runtime.getStatus({ includeAttachProbe: false }).catch((error) => ({
      unavailable: true,
      reason: error instanceof Error ? error.message : String(error),
    })),
    runtime.getNativePerformanceFlowSnapshot().catch((error) => ({
      unavailable: true,
      reason: error instanceof Error ? error.message : String(error),
    })),
    runtime.getPerformanceSnapshot().catch((error) => ({
      unavailable: true,
      reason: error instanceof Error ? error.message : String(error),
    })),
    runtime.getTelemetryStatus().catch((error) => ({
      unavailable: true,
      reason: error instanceof Error ? error.message : String(error),
    })),
    runtime.getTelemetryRecords(limit).catch((error) => ({
      unavailable: true,
      reason: error instanceof Error ? error.message : String(error),
    })),
    runtime.runWorkspaceCommand('git status --short --branch').catch((error) => ({
      command: 'git status --short --branch',
      cwd: runtime.getRepoRoot(),
      exitCode: 1,
      stdout: '',
      stderr: error instanceof Error ? error.message : String(error),
    })),
    runtime.runWorkspaceCommand(`git log -n ${limit} --pretty=format:"%h %ad %s" --date=short`).catch((error) => ({
      command: 'git log',
      cwd: runtime.getRepoRoot(),
      exitCode: 1,
      stdout: '',
      stderr: error instanceof Error ? error.message : String(error),
    })),
    collectChangedFiles(runtime).catch(() => []),
  ]);

  return {
    generatedAt: new Date().toISOString(),
    purpose: 'Agent-facing performance flow snapshot for verifying whether recent code changes are visible in the live native/backend path.',
    appStatus,
    recentChanges: {
      gitStatus: gitStatus.stdout,
      recentCommits: gitRecentCommits.stdout,
      changedFiles,
    },
    nativeFlow,
    frontendPerformance,
    telemetry: {
      status: telemetryStatus,
      records: telemetryRecords,
    },
    signals: collectPerformanceFlowSignals(nativeFlow, frontendPerformance),
    followupTools: {
      nativeRingBenchmark: {
        tool: 'gfs_validate',
        payload: {
          command: 'native_ring_benchmark',
          windowLabel: 'main',
          packets: 256,
          packetBytes: 4096,
          capacity: 4194304,
        },
      },
      hostEventReplay: {
        tool: 'gfs_events',
        payload: {
          command: 'snapshot',
          request: {
            replayFrom: 0,
          },
        },
      },
    },
  };
}

function registerCompactTools(server: McpServer, runtime: GreeblefsAutomationRuntime): void {
  const uiSnapshotCache = new Map<string, {
    revision: number;
    snapshot: Record<string, unknown>;
  }>();

  server.registerTool(
    'gfs_how_to_use',
    {
      title: 'GreebleFS MCP How To Use',
      description: 'Read the markdown-backed agent manual for this MCP server. Use sections to avoid pulling the full manual.',
      inputSchema: z.object({
        section: z.enum(compactToolCatalog.gfs_how_to_use.commands).optional(),
        includeHostCommands: z.boolean().optional(),
      }),
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
      },
    },
    wrapToolHandler('gfs_how_to_use', async ({ section, includeHostCommands }) => {
      const sectionId = normalizeManualSectionId(section);
      const manual = await readAgentUsageManual(runtime);
      const markdown = extractMarkdownSection(manual, sectionId);
      let hostCommands: unknown = null;
      if (includeHostCommands === true) {
        const hostApiSchema = normalizeHostApiSchema(await runtime.getHostApiSchema());
        hostCommands = summarizeHostApiSchema(hostApiSchema);
      }
      return buildMarkdownToolResult(markdown, {
        manualPath: AGENT_USAGE_MANUAL_WORKSPACE_PATH,
        resourceUri: AGENT_USAGE_MANUAL_RESOURCE_URI,
        section: sectionId,
        sections: compactToolCatalog.gfs_how_to_use.commands,
        hostCommands,
      });
    }),
  );

  server.registerTool(
    'gfs_help',
    {
      title: 'GreebleFS MCP Help',
      description: 'List the compact router tools and command names. Use `category: "host_commands"` or `includeHostCommands: true` to discover extension-host method ids.',
      inputSchema: z.object({
        category: z.enum(compactToolCatalog.gfs_help.commands).optional(),
        includeHostCommands: z.boolean().optional(),
      }),
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
      },
    },
    wrapToolHandler('gfs_help', async ({ category, includeHostCommands }) => {
      let hostCommands: unknown = null;
      if (includeHostCommands === true || category === 'host_commands') {
        const hostApiSchema = normalizeHostApiSchema(await runtime.getHostApiSchema());
        hostCommands = summarizeHostApiSchema(hostApiSchema);
      }
      const selectedToolName = category === 'host_commands' ? 'gfs_host' : `gfs_${category}`;
      const toolEntries = Object.entries(compactToolCatalog)
        .filter(([toolName]) => !category || category === 'all' || toolName === selectedToolName)
        .map(([toolName, definition]) => ({
          toolName,
          summary: definition.summary,
          commands: definition.commands,
        }));
      return buildJsonToolResult('GreebleFS compact MCP help', {
        defaultToolCount: Object.keys(compactToolCatalog).length,
        hostMethodFlow: 'use gfs_help category=host_commands or gfs_host command=schema to discover ids, then gfs_host command=call to execute one',
        tools: toolEntries,
        hostCommands,
      });
    }),
  );

  server.registerTool(
    'gfs_app',
    {
      title: 'GreebleFS App',
      description: 'Router for app/session commands: status, doctor, start, stop, wait_ready, attach, log, windows.',
      inputSchema: z.object({
        command: z.enum(compactToolCatalog.gfs_app.commands),
        includeAttachProbe: z.boolean().optional(),
        timeoutMs: z.number().int().positive().optional(),
        requireBridge: z.boolean().optional(),
        requireCdp: z.boolean().optional(),
        preferNative: z.boolean().optional(),
        allowFallbackBrowser: z.boolean().optional(),
        windowLabel: z.string().optional(),
        secondaryWindowKind: z.string().optional(),
        limitLines: z.number().int().positive().optional(),
        processName: z.string().optional(),
      }),
      annotations: {
        destructiveHint: true,
        idempotentHint: false,
      },
    },
    wrapToolHandler('gfs_app', async (args) => {
      switch (args.command) {
        case 'status':
          return buildJsonToolResult('App status', {
            status: await runtime.getStatus({ includeAttachProbe: args.includeAttachProbe === true }),
          });
        case 'doctor':
          return buildJsonToolResult('App doctor report', await buildDoctorReport(runtime, {
            includeAttachProbe: args.includeAttachProbe === true,
          }));
        case 'start':
          return buildJsonToolResult('Started Tauri dev session', {
            status: await runtime.startTauriDev(),
          });
        case 'stop':
          return buildJsonToolResult('Stopped Tauri dev session', {
            status: await runtime.stopTauriDev(),
          });
        case 'wait_ready':
          return buildJsonToolResult('Waited for app readiness', {
            status: await runtime.waitForReady({
              timeoutMs: args.timeoutMs,
              requireBridge: args.requireBridge,
              requireCdp: args.requireCdp,
            }),
          });
        case 'attach':
          return buildJsonToolResult('Attached to app surface', {
            attachment: await runtime.attachApp({
              preferNative: args.preferNative,
              allowFallbackBrowser: args.allowFallbackBrowser,
              windowLabel: args.windowLabel,
              secondaryWindowKind: args.secondaryWindowKind,
            }),
          });
        case 'log':
          return buildJsonToolResult('Read dev log tail', {
            logTail: await runtime.readDevLogTail(args.limitLines ?? 200),
          });
        case 'windows':
          return buildJsonToolResult('Listed native desktop windows', {
            windows: await runtime.listNativeWindows(args.processName ?? 'greeblefs'),
          });
        default:
          throw new Error(`Unknown gfs_app command: ${String(args.command)}`);
      }
    }),
  );

  server.registerTool(
    'gfs_ui_snapshot',
    {
      title: 'GreebleFS UI Snapshot',
      description: 'Router for read-only UI state: snapshot, actions, console, telemetry, performance, native flow, profile.',
      inputSchema: z.object({
        command: z.enum(compactToolCatalog.gfs_ui_snapshot.commands).default('snapshot'),
        includeDom: z.boolean().optional(),
        includeThemeVariables: z.boolean().optional(),
        includeTelemetryRecords: z.boolean().optional(),
        telemetryLimit: z.number().int().positive().optional(),
        consoleLimit: z.number().int().positive().optional(),
        sinceRevision: z.number().int().nonnegative().optional(),
        limit: z.number().int().positive().optional(),
        includeUnnamed: z.boolean().optional(),
      }),
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
      },
    },
    wrapToolHandler('gfs_ui_snapshot', async (args) => {
      switch (args.command) {
        case 'snapshot': {
          const { sinceRevision, command: _command, limit: _limit, includeUnnamed: _includeUnnamed, ...snapshotOptions } = args;
          const snapshot = await runtime.getBridgeSnapshot(snapshotOptions) as Record<string, unknown>;
          const cacheKey = JSON.stringify(snapshotOptions);
          const previous = uiSnapshotCache.get(cacheKey);
          const revision = (previous?.revision ?? 0) + 1;
          uiSnapshotCache.set(cacheKey, { revision, snapshot });
          if (typeof sinceRevision === 'number' && previous && sinceRevision === previous.revision) {
            const changedKeys: string[] = [];
            const delta: Record<string, unknown> = {};
            for (const [key, value] of Object.entries(snapshot)) {
              if (JSON.stringify(previous.snapshot[key]) !== JSON.stringify(value)) {
                changedKeys.push(key);
                delta[key] = value;
              }
            }
            return buildJsonToolResult('Captured UI snapshot delta', {
              revision,
              sinceRevision,
              changedKeys,
              snapshot: delta,
              fullSnapshot: false,
            });
          }
          return buildJsonToolResult('Captured UI snapshot', {
            revision,
            snapshot,
            fullSnapshot: true,
          });
        }
        case 'actions':
          return buildJsonToolResult('Listed visible actions', {
            actions: await runtime.listVisibleActions({ includeUnnamed: args.includeUnnamed }),
          });
        case 'console':
          return buildJsonToolResult('Read recent console entries', {
            consoleEntries: await runtime.getConsoleEntries(args.limit ?? 120),
          });
        case 'telemetry':
          return buildJsonToolResult('Read telemetry records', {
            telemetryStatus: await runtime.getTelemetryStatus(),
            telemetryRecords: await runtime.getTelemetryRecords(args.limit ?? 60),
          });
        case 'performance':
          return buildJsonToolResult('Read performance snapshot', {
            performance: await runtime.getPerformanceSnapshot(),
          });
        case 'flow':
          return buildJsonToolResult('Read native performance flow snapshot', {
            performanceFlow: await buildPerformanceFlowReport(runtime, args.limit ?? 40),
          });
        case 'profile':
          return buildJsonToolResult('Read profile snapshot', {
            profileSnapshot: await runtime.getUsrProfileSnapshot(),
          });
        default:
          throw new Error(`Unknown gfs_ui_snapshot command: ${String(args.command)}`);
      }
    }),
  );

  server.registerTool(
    'gfs_ui_act',
    {
      title: 'GreebleFS UI Act',
      description: 'Router for UI actions: click, hover, type, key, select, drag, invoke_action, evaluate, console_clear.',
      inputSchema: z.object({
        command: z.enum(compactToolCatalog.gfs_ui_act.commands),
        target: uiTargetSchema.optional(),
        source: uiTargetSchema.optional(),
        text: z.string().optional(),
        key: z.string().optional(),
        option: z.string().optional(),
        button: z.enum(['left', 'right', 'middle']).optional(),
        timeoutMs: z.number().int().positive().optional(),
        clear: z.boolean().optional(),
        pressEnter: z.boolean().optional(),
        script: z.string().optional(),
        argument: z.unknown().optional(),
      }),
      annotations: {
        destructiveHint: true,
        openWorldHint: true,
        idempotentHint: false,
      },
    },
    wrapToolHandler('gfs_ui_act', async (args) => {
      switch (args.command) {
        case 'click':
          return buildJsonToolResult('Clicked UI element', {
            result: await runtime.click(buildUiTarget(requireTarget(args.target)), {
              button: args.button,
              timeoutMs: args.timeoutMs,
            }),
          });
        case 'hover':
          return buildJsonToolResult('Hovered UI element', {
            result: await runtime.hover(buildUiTarget(requireTarget(args.target)), args.timeoutMs),
          });
        case 'type':
          return buildJsonToolResult('Typed into UI element', {
            result: await runtime.typeText(
              buildUiTarget(requireTarget(args.target)),
              requireString(args.text, 'text'),
              {
                clear: args.clear,
                pressEnter: args.pressEnter,
                timeoutMs: args.timeoutMs,
              },
            ),
          });
        case 'key':
          return buildJsonToolResult('Pressed key', {
            result: await runtime.pressKey(requireString(args.key, 'key')),
          });
        case 'select':
          return buildJsonToolResult('Selected option', {
            result: await runtime.selectOption(
              buildUiTarget(requireTarget(args.target)),
              requireString(args.option, 'option'),
            ),
          });
        case 'drag':
          return buildJsonToolResult('Dragged UI element', {
            result: await runtime.drag(
              buildUiTarget(requireTarget(args.source, 'source')),
              buildUiTarget(requireTarget(args.target, 'target')),
            ),
          });
        case 'invoke_action':
          return buildJsonToolResult('Invoked visible action', {
            result: await runtime.click(buildUiTarget(requireTarget(args.target))),
          });
        case 'evaluate':
          return buildJsonToolResult('Evaluated in-app script', {
            result: await runtime.evaluateInApp(requireString(args.script, 'script'), args.argument),
          });
        case 'console_clear':
          return buildJsonToolResult('Cleared retained console entries', {
            result: await runtime.clearConsoleEntries(),
          });
        default:
          throw new Error(`Unknown gfs_ui_act command: ${String(args.command)}`);
      }
    }),
  );

  server.registerTool(
    'gfs_ui_capture',
    {
      title: 'GreebleFS UI Capture',
      description: 'Router for capture commands: screenshot, native_window_screenshot, accessibility.',
      inputSchema: z.object({
        command: z.enum(compactToolCatalog.gfs_ui_capture.commands),
        fullPage: z.boolean().optional(),
        pathHint: z.string().optional(),
        includeImageData: z.boolean().optional(),
        processName: z.string().optional(),
        handle: z.string().optional(),
        processId: z.number().int().positive().optional(),
        titleContains: z.string().optional(),
      }),
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
      },
    },
    wrapToolHandler('gfs_ui_capture', async (args) => {
      switch (args.command) {
        case 'screenshot': {
          const screenshot = await runtime.captureScreenshot({
            fullPage: args.fullPage,
            pathHint: args.pathHint,
            includeImageData: args.includeImageData !== false,
          });
          const content: ContentBlock[] = [{
            type: 'text' as const,
            text: `Captured screenshot via ${screenshot.attachMode ?? 'unknown'} at ${screenshot.pageUrl}\nSaved to ${screenshot.imagePath}`,
          }];
          if (screenshot.base64Png) {
            content.push({ type: 'image' as const, data: screenshot.base64Png, mimeType: 'image/png' });
          }
          return {
            content,
            structuredContent: {
              screenshot: {
                imagePath: screenshot.imagePath,
                attachMode: screenshot.attachMode,
                pageUrl: screenshot.pageUrl,
                imageDataIncluded: Boolean(screenshot.base64Png),
              },
            },
          };
        }
        case 'native_window_screenshot': {
          const screenshot = await runtime.captureNativeWindowScreenshot({
            processName: args.processName,
            handle: args.handle,
            processId: args.processId,
            titleContains: args.titleContains,
            pathHint: args.pathHint,
            includeImageData: args.includeImageData !== false,
          });
          const content: ContentBlock[] = [{
            type: 'text' as const,
            text: `Captured native window screenshot for ${screenshot.window.processName} (${screenshot.window.handle}) at ${screenshot.imagePath}`,
          }];
          if (screenshot.base64Png) {
            content.push({ type: 'image' as const, data: screenshot.base64Png, mimeType: 'image/png' });
          }
          return {
            content,
            structuredContent: {
              screenshot: {
                ...screenshot,
                imageDataIncluded: Boolean(screenshot.base64Png),
              },
            },
          };
        }
        case 'accessibility':
          return buildJsonToolResult('Captured accessibility snapshot', {
            accessibilitySnapshot: await runtime.getAccessibilitySnapshot(),
          });
        default:
          throw new Error(`Unknown gfs_ui_capture command: ${String(args.command)}`);
      }
    }),
  );

  server.registerTool(
    'gfs_host',
    {
      title: 'GreebleFS Host',
      description: 'Router for extension-host API: schema, call, context, selection, preview.',
      inputSchema: z.object({
        command: z.enum(compactToolCatalog.gfs_host.commands),
        methodId: z.string().optional(),
        payload: z.unknown().optional(),
        executionContext: z.unknown().optional(),
      }),
      annotations: {
        destructiveHint: true,
        openWorldHint: true,
        idempotentHint: false,
      },
    },
    wrapToolHandler('gfs_host', async (args) => {
      switch (args.command) {
        case 'schema':
          return buildJsonToolResult('Read host API schema', {
            hostApiSchema: await runtime.getHostApiSchema(),
          });
        case 'call': {
          const methodId = requireString(args.methodId, 'methodId');
          return buildJsonToolResult('Called host method', {
            methodId,
            result: await runtime.callHostMethod(methodId, args.payload, { executionContext: args.executionContext }),
          });
        }
        case 'context':
          return buildJsonToolResult('Synced host context snapshot', {
            result: await runtime.callHostMethod('context.sync_snapshot', args.payload, { executionContext: args.executionContext }),
          });
        case 'selection':
          return buildJsonToolResult('Read host selection snapshot', {
            result: await runtime.callHostMethod('selection.get_snapshot', args.payload, { executionContext: args.executionContext }),
          });
        case 'preview':
          return buildJsonToolResult('Read host preview session', {
            result: await runtime.callHostMethod('preview.get_session', args.payload, { executionContext: args.executionContext }),
          });
        default:
          throw new Error(`Unknown gfs_host command: ${String(args.command)}`);
      }
    }),
  );

  server.registerTool(
    'gfs_events',
    {
      title: 'GreebleFS Events',
      description: 'Router for host events: describe, snapshot, subscribe, read, unsubscribe, publish.',
      inputSchema: z.object({
        command: z.enum(compactToolCatalog.gfs_events.commands),
        request: hostEventRequestSchema.optional(),
        subscriptionId: hostEventSubscriptionIdSchema.optional(),
        afterSequence: z.number().int().nonnegative().optional(),
        payload: z.unknown().optional(),
        executionContext: z.unknown().optional(),
      }),
      annotations: {
        destructiveHint: true,
        idempotentHint: false,
      },
    },
    wrapToolHandler('gfs_events', async (args) => {
      switch (args.command) {
        case 'describe':
          return buildJsonToolResult('Read host event topics', {
            topics: await runtime.callHostMethod('events.describe_topics', args.payload, { executionContext: args.executionContext }),
          });
        case 'snapshot':
          return buildJsonToolResult('Read host event snapshot', {
            events: await runtime.getHostEventsSnapshot(args.request ?? {}),
          });
        case 'subscribe': {
          const subscription = await runtime.subscribeHostEvents(args.request ?? {}, {
            onUpdate: (state) => {
              void server.server.sendResourceUpdated({
                uri: runtime.getHostEventsResourceUri(state.subscription.subscriptionId),
              }).catch(() => {});
            },
          });
          return buildJsonToolResult('Subscribed to host events', {
            subscriptionId: subscription.subscriptionId,
            resourceUri: subscription.resourceUri,
            state: subscription.state,
          });
        }
        case 'read': {
          const subscriptionId = requireString(args.subscriptionId, 'subscriptionId');
          return buildJsonToolResult('Read host-event subscription state', {
            subscriptionId,
            state: await runtime.readHostEventSubscription(subscriptionId, args.afterSequence),
          });
        }
        case 'unsubscribe': {
          const subscriptionId = requireString(args.subscriptionId, 'subscriptionId');
          return buildJsonToolResult('Unsubscribed from host events', {
            subscriptionId,
            result: await runtime.unsubscribeHostEvents(subscriptionId),
          });
        }
        case 'publish':
          return buildJsonToolResult('Published host event', {
            result: await runtime.callHostMethod('events.publish', args.payload, { executionContext: args.executionContext }),
          });
        default:
          throw new Error(`Unknown gfs_events command: ${String(args.command)}`);
      }
    }),
  );

  server.registerTool(
    'gfs_code',
    {
      title: 'GreebleFS Code',
      description: 'Router for compact coding context, git, memory, architecture, and workspace operations.',
      inputSchema: z.object({
        command: z.enum(compactToolCatalog.gfs_code.commands),
        path: z.string().optional(),
        content: z.string().optional(),
        query: z.string().optional(),
        ref: z.string().optional(),
        limit: z.number().int().positive().optional(),
        cwd: z.string().optional(),
        shellCommand: z.string().optional(),
      }),
      annotations: {
        destructiveHint: true,
        openWorldHint: true,
        idempotentHint: false,
      },
    },
    wrapToolHandler('gfs_code', async (args) => {
      const limit = clampPositiveInt(args.limit, 8, 80);
      switch (args.command) {
        case 'agent_context':
          return buildJsonToolResult('Built agent coding context', await buildAgentContext(runtime, limit));
        case 'git_status':
          return buildJsonToolResult('Read git status', {
            result: await runtime.runWorkspaceCommand('git status --short --branch'),
          });
        case 'git_branch':
          return buildJsonToolResult('Read git branch', {
            result: await runtime.runWorkspaceCommand('git branch --show-current'),
          });
        case 'git_recent_commits':
          return buildJsonToolResult('Read recent git commits', {
            result: await runtime.runWorkspaceCommand(`git log -n ${limit} --pretty=format:"%h %ad %s" --date=short`),
          });
        case 'git_changed_files':
          return buildJsonToolResult('Read changed files', {
            changedFiles: await collectChangedFiles(runtime),
          });
        case 'git_diff': {
          const suffix = args.path ? ` -- ${shellQuote(args.path)}` : '';
          return buildJsonToolResult('Read git diff', {
            result: await runtime.runWorkspaceCommand(`git diff${suffix}`),
          });
        }
        case 'git_show': {
          const ref = args.ref ? shellQuote(args.ref) : 'HEAD';
          return buildJsonToolResult('Read git show', {
            result: await runtime.runWorkspaceCommand(`git show --stat --oneline --decorate ${ref}`),
          });
        }
        case 'memory_recent': {
          const memory = await readWorkspaceTextIfAvailable(runtime, 'memory.md');
          return buildJsonToolResult('Read recent memory', {
            memory: memory.available ? textTailByLines(memory.content, clampPositiveInt(args.limit, 120, 500)) : memory,
          });
        }
        case 'memory_search': {
          const query = requireString(args.query, 'query');
          const memory = await readWorkspaceTextIfAvailable(runtime, 'memory.md');
          return buildJsonToolResult('Searched memory', {
            query,
            matches: memory.available ? searchTextLines(memory.content, query, clampPositiveInt(args.limit, 30, 200)) : [],
            memoryAvailable: memory.available,
          });
        }
        case 'architecture': {
          const architecture = await readWorkspaceTextIfAvailable(runtime, 'ARCHITECTURE.md');
          return buildJsonToolResult('Read architecture context', {
            architecture: architecture.available ? textTailByLines(architecture.content, clampPositiveInt(args.limit, 160, 600)) : architecture,
          });
        }
        case 'lessons': {
          const architecture = await readWorkspaceTextIfAvailable(runtime, 'ARCHITECTURE.md');
          const lessons = architecture.available
            ? searchTextLines(architecture.content, 'Lesson', clampPositiveInt(args.limit, 40, 160))
            : [];
          const commonErrors = architecture.available
            ? searchTextLines(architecture.content, 'Common Errors', 20)
            : [];
          return buildJsonToolResult('Read architecture lessons', {
            lessons,
            commonErrors,
            architectureAvailable: architecture.available,
          });
        }
        case 'workspace_read':
          return buildJsonToolResult('Read workspace text file', {
            result: await runtime.readWorkspaceText(requireString(args.path, 'path')),
          });
        case 'workspace_write':
          return buildJsonToolResult('Wrote workspace text file', {
            result: await runtime.writeWorkspaceText(requireString(args.path, 'path'), requireString(args.content, 'content')),
          });
        case 'workspace_list':
          return buildJsonToolResult('Listed workspace directory', {
            result: await runtime.listWorkspaceDirectory(args.path ?? '.'),
          });
        case 'workspace_stat':
          return buildJsonToolResult('Read workspace path metadata', {
            result: await runtime.statWorkspacePath(requireString(args.path, 'path')),
          });
        case 'workspace_delete':
          return buildJsonToolResult('Deleted workspace path', {
            result: await runtime.deleteWorkspacePath(requireString(args.path, 'path')),
          });
        case 'workspace_run':
          return buildJsonToolResult('Ran workspace command', {
            result: await runtime.runWorkspaceCommand(requireString(args.shellCommand, 'shellCommand'), { cwd: args.cwd }),
          });
        default:
          throw new Error(`Unknown gfs_code command: ${String(args.command)}`);
      }
    }),
  );

  server.registerTool(
    'gfs_kain',
    {
      title: 'GreebleFS Kain',
      description: 'Router for Kain language docs, FFI examples, local .cargo/bin CLI commands, run smokes, and docs-example validation.',
      inputSchema: z.object({
        command: z.enum(compactToolCatalog.gfs_kain.commands),
        path: z.string().optional(),
        query: z.string().optional(),
        roots: z.array(z.enum(['guides', 'ffi_examples'])).optional(),
        binary: z.enum(['kain', 'kain-pro', 'kn']).optional(),
        args: z.array(z.string()).optional(),
        cwd: z.string().optional(),
        limit: z.number().int().positive().optional(),
        timeoutMs: z.number().int().positive().optional(),
        allowLongRunning: z.boolean().optional(),
        keepOutput: z.boolean().optional(),
        filter: z.string().optional(),
      }),
      annotations: {
        destructiveHint: true,
        openWorldHint: true,
        idempotentHint: false,
      },
    },
    wrapToolHandler('gfs_kain', async (args) => {
      const limit = clampPositiveInt(args.limit, 80, 600);
      switch (args.command) {
        case 'overview':
          return buildJsonToolResult('Read Kain overview', {
            kain: await buildKainOverview(runtime, limit),
          });
        case 'guide': {
          const guide = await readKainContent(runtime, args.path ?? 'quickstart.md', 'guides', limit);
          return buildJsonToolResult('Read Kain guide content', {
            guide,
          });
        }
        case 'search': {
          const query = requireString(args.query, 'query');
          return buildJsonToolResult('Searched Kain docs and examples', {
            search: await searchKainContent(runtime, query, normalizeKainRoots(args.roots), limit),
          });
        }
        case 'examples': {
          if (args.path) {
            return buildJsonToolResult('Read Kain FFI example content', {
              example: await readKainContent(runtime, args.path, 'ffi_examples', limit),
            });
          }
          const [rootReadme, examples] = await Promise.all([
            readKainContent(runtime, undefined, 'ffi_examples', limit),
            buildKainExampleIndex(runtime, limit),
          ]);
          return buildJsonToolResult('Listed Kain FFI examples', {
            rootReadme,
            examples,
          });
        }
        case 'cli': {
          const binary = args.binary ?? 'kain';
          const cliArgs = normalizeKainCliArgs(args.args);
          return buildJsonToolResult('Ran Kain CLI command', {
            cli: await runKainCli(runtime, binary, cliArgs.length > 0 ? cliArgs : ['--help'], {
              cwd: args.cwd,
              timeoutMs: args.timeoutMs,
              allowLongRunning: args.allowLongRunning,
            }),
          });
        }
        case 'doctor':
          return buildJsonToolResult('Ran Kain doctor', {
            cli: await runKainCli(runtime, args.binary ?? 'kain', ['doctor'], {
              cwd: args.cwd,
              timeoutMs: args.timeoutMs ?? 20_000,
            }),
          });
        case 'run': {
          const sourcePath = normalizeKainSourcePath(requireString(args.path, 'path'));
          const extraArgs = normalizeKainCliArgs(args.args);
          return buildJsonToolResult('Ran Kain source file', {
            sourcePath,
            cli: await runKainCli(runtime, args.binary ?? 'kain', ['run', sourcePath, ...extraArgs], {
              cwd: args.cwd,
              timeoutMs: args.timeoutMs ?? 60_000,
              allowLongRunning: args.allowLongRunning,
            }),
          });
        }
        case 'validate_examples': {
          const command = buildKainDocsExampleValidationCommand(args.path, args.filter, args.keepOutput === true);
          return buildJsonToolResult('Ran Kain docs example validator', {
            command,
            result: await runtime.runWorkspaceCommand(command, {
              env: buildKainCommandEnvironment(),
              timeoutMs: Math.min(clampPositiveInt(args.timeoutMs, 120_000, KAIN_MAX_CLI_TIMEOUT_MS), KAIN_MAX_CLI_TIMEOUT_MS),
            }),
          });
        }
        default:
          throw new Error(`Unknown gfs_kain command: ${String(args.command)}`);
      }
    }),
  );

  server.registerTool(
    'gfs_validate',
    {
      title: 'GreebleFS Validate',
      description: 'Router for focused validation: plan, run, typecheck, test_file, rust_test, smoke, smoke_screenshot, runtime_stack_quick, native_ring_benchmark.',
      inputSchema: z.object({
        command: z.enum(compactToolCatalog.gfs_validate.commands),
        files: z.array(z.string()).optional(),
        path: z.string().optional(),
        filter: z.string().optional(),
        shellCommand: z.string().optional(),
        cwd: z.string().optional(),
        target: z.enum(['repo', 'mcp']).optional(),
        windowLabel: z.string().optional(),
        ringId: z.string().optional(),
        packets: z.number().int().positive().optional(),
        packetBytes: z.number().int().positive().optional(),
        capacity: z.number().int().positive().optional(),
      }),
      annotations: {
        destructiveHint: true,
        openWorldHint: true,
        idempotentHint: false,
      },
    },
    wrapToolHandler('gfs_validate', async (args) => {
      switch (args.command) {
        case 'plan': {
          const files = args.files ?? await collectChangedFiles(runtime);
          return buildJsonToolResult('Planned focused validation', {
            files,
            plan: buildValidationPlan(files),
          });
        }
        case 'run':
          return buildJsonToolResult('Ran validation command', {
            result: await runtime.runWorkspaceCommand(requireString(args.shellCommand, 'shellCommand'), { cwd: args.cwd }),
          });
        case 'typecheck': {
          const command = args.target === 'mcp'
            ? 'bun run --cwd MCP/greeblefs-dev-mcp typecheck'
            : 'bunx tsc -p tsconfig.json --noEmit --pretty false';
          return buildJsonToolResult('Ran typecheck', {
            result: await runtime.runWorkspaceCommand(command),
          });
        }
        case 'test_file': {
          const pathLike = requireString(args.path, 'path');
          const normalizedPath = pathLike.replace(/\\/g, '/');
          const command = normalizedPath.startsWith('MCP/greeblefs-dev-mcp/')
            ? 'bun run --cwd MCP/greeblefs-dev-mcp typecheck'
            : /\.(test|spec)\.(ts|tsx)$/.test(normalizedPath)
              ? `bunx vitest run ${shellQuote(pathLike)}`
              : normalizedPath.endsWith('.rs')
                ? 'cargo test --manifest-path src-tauri/Cargo.toml --lib'
                : `bunx tsc -p tsconfig.json --noEmit --pretty false`;
          return buildJsonToolResult('Ran focused file validation', {
            command,
            result: await runtime.runWorkspaceCommand(command),
          });
        }
        case 'rust_test': {
          const filter = args.filter ? ` ${shellQuote(args.filter)}` : '';
          const command = `cargo test --manifest-path src-tauri/Cargo.toml${filter} --lib`;
          return buildJsonToolResult('Ran Rust validation', {
            command,
            result: await runtime.runWorkspaceCommand(command),
          });
        }
        case 'smoke':
          return buildJsonToolResult('Ran MCP smoke', {
            result: await runtime.runWorkspaceCommand('bun run mcp:smoke'),
          });
        case 'smoke_screenshot':
          return buildJsonToolResult('Ran MCP screenshot smoke', {
            result: await runtime.runWorkspaceCommand('bun run --cwd MCP/greeblefs-dev-mcp smoke:screenshot'),
          });
        case 'runtime_stack_quick':
          return buildJsonToolResult('Ran runtime stack quick validation', {
            result: await runtime.runWorkspaceCommand('bun run test:runtime-stack:quick'),
          });
        case 'native_ring_benchmark':
          return buildJsonToolResult('Ran native ring benchmark', {
            result: await runtime.runNativeRingBenchmark({
              webviewLabel: args.windowLabel,
              ringId: args.ringId,
              packets: args.packets,
              packetBytes: args.packetBytes,
              capacity: args.capacity,
            }),
          });
        default:
          throw new Error(`Unknown gfs_validate command: ${String(args.command)}`);
      }
    }),
  );
}

async function buildServer(runtime: GreeblefsAutomationRuntime): Promise<McpServer> {
  const server = new McpServer(
    {
      name: '@greeblefs/dev-mcp',
      version: '0.1.0',
    },
    {
      capabilities: {
        logging: {},
        tools: {},
        resources: {
          subscribe: true,
        },
      },
    },
  );

  registerResources(server, runtime);
  registerCompactTools(server, runtime);
  return server;
}

async function runDoctorMode(
  runtime: GreeblefsAutomationRuntime,
  options: { includeAttachProbe?: boolean } = {},
): Promise<void> {
  const report = await buildDoctorReport(runtime, options);
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

async function runStdioServer(runtime: GreeblefsAutomationRuntime): Promise<void> {
  const server = await buildServer(runtime);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

async function runHttpServer(_runtime: GreeblefsAutomationRuntime, port: number): Promise<void> {
  const app = createMcpExpressApp({
    host: '127.0.0.1',
  });
  const sessions = new Map<string, {
    context: SessionServerContext;
    transport: StreamableHTTPServerTransport;
  }>();

  const readSessionIdHeader = (req: any): string | null => {
    const rawValue = req.headers['mcp-session-id'];
    if (typeof rawValue === 'string' && rawValue.trim()) {
      return rawValue.trim();
    }
    return null;
  };

  const closeSession = async (sessionId: string): Promise<void> => {
    const record = sessions.get(sessionId);
    if (!record) {
      return;
    }
    sessions.delete(sessionId);
    await record.transport.close().catch(() => {});
    await record.context.server.close().catch(() => {});
    await record.context.runtime.close().catch(() => {});
  };

  app.post('/mcp', async (req: any, res: any) => {
    try {
      const existingSessionId = readSessionIdHeader(req);
      let record = existingSessionId ? sessions.get(existingSessionId) : undefined;
      if (!record) {
        if (!isInitializeRequest(req.body)) {
          res.status(400).json({
            jsonrpc: '2.0',
            error: {
              code: -32000,
              message: 'Initialize must be the first request for a new HTTP MCP session.',
            },
            id: null,
          });
          return;
        }
        const runtime = new GreeblefsAutomationRuntime();
        const server = await buildServer(runtime);
        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
        });
        transport.onclose = () => {
          const sessionId = transport.sessionId;
          if (sessionId) {
            void closeSession(sessionId);
          }
        };
        await server.connect(transport);
        await transport.handleRequest(req, res, req.body);
        if (!transport.sessionId) {
          await server.close().catch(() => {});
          await runtime.close().catch(() => {});
          return;
        }
        record = {
          context: { runtime, server },
          transport,
        };
        sessions.set(transport.sessionId, record);
        return;
      }
      await record.transport.handleRequest(req, res, req.body);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: '2.0',
          error: {
            code: -32603,
            message,
          },
          id: null,
        });
      }
    }
  });

  app.get('/mcp', async (req: any, res: any) => {
    const sessionId = readSessionIdHeader(req);
    const record = sessionId ? sessions.get(sessionId) : undefined;
    if (!record) {
      res.status(400).send('Invalid or missing MCP session id.');
      return;
    }
    await record.transport.handleRequest(req, res);
  });

  app.delete('/mcp', async (req: any, res: any) => {
    const sessionId = readSessionIdHeader(req);
    const record = sessionId ? sessions.get(sessionId) : undefined;
    if (!record) {
      res.status(400).send('Invalid or missing MCP session id.');
      return;
    }
    await record.transport.handleRequest(req, res);
    if (sessionId) {
      await closeSession(sessionId);
    }
  });

  await new Promise<void>((resolve, reject) => {
    app.listen(port, '127.0.0.1', (error?: Error) => {
      if (error) {
        reject(error);
        return;
      }
      process.stdout.write(`GreebleFS Dev MCP listening on http://127.0.0.1:${port}/mcp\n`);
      resolve();
    });
  });
}

async function main(): Promise<void> {
  const cli = parseCliArguments(process.argv.slice(2));
  const runtime = new GreeblefsAutomationRuntime();

  const shutdown = async () => {
    await runtime.close();
  };

  process.on('SIGINT', () => {
    void shutdown().finally(() => process.exit(0));
  });
  process.on('SIGTERM', () => {
    void shutdown().finally(() => process.exit(0));
  });

  try {
    if (cli.doctor) {
      await runDoctorMode(runtime, {
        includeAttachProbe: cli.doctorAttachProbe,
      });
      await runtime.close();
      return;
    }

    if (cli.transport === 'http') {
      await runHttpServer(runtime, cli.port);
      return;
    }

    await runStdioServer(runtime);
  } catch (error) {
    await runtime.close().catch(() => {});
    const message = error instanceof Error ? error.stack ?? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exit(1);
  }
}

void main();
