import process from 'node:process';

import { createMcpExpressApp } from '@modelcontextprotocol/sdk/server/express.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { CallToolResult, ContentBlock } from '@modelcontextprotocol/sdk/types.js';
import * as z from 'zod/v4';

import {
  GreeblefsAutomationRuntime,
  type GreeblefsUiTarget,
} from './runtime/greeblefsAutomationRuntime.js';

const DEFAULT_HTTP_PORT = 4281;
const MAX_JSON_PREVIEW_CHARS = 20_000;

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

function parseCliArguments(argv: string[]): {
  transport: 'stdio' | 'http';
  port: number;
  doctor: boolean;
} {
  let transport: 'stdio' | 'http' = 'stdio';
  let port = DEFAULT_HTTP_PORT;
  let doctor = false;

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--doctor') {
      doctor = true;
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
  };
}

function safeJsonText(value: unknown): string {
  const raw = JSON.stringify(value, null, 2);
  if (raw.length <= MAX_JSON_PREVIEW_CHARS) {
    return `${raw}\n`;
  }
  return `${raw.slice(0, MAX_JSON_PREVIEW_CHARS)}\n...truncated...\n`;
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

async function buildDoctorReport(runtime: GreeblefsAutomationRuntime): Promise<Record<string, unknown>> {
  const status = await runtime.getStatus({ includeAttachProbe: true });
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

  if (status.bridgeReady) {
    bridgeStatus = await runtime.getBridgeStatus();
    const hostBridgeAvailable = Boolean(
      bridgeStatus
      && typeof bridgeStatus === 'object'
      && (bridgeStatus as { capabilities?: { hostBridge?: boolean } }).capabilities?.hostBridge,
    );
    if (hostBridgeAvailable) {
      hostApiSchema = await runtime.getHostApiSchema();
    } else {
      hostApiSchema = {
        unavailable: true,
        reason: 'Host bridge APIs are unavailable on browser-dev-url fallback attachments.',
      };
    }
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
    bridgeStatus,
    hostApiSchema,
    snapshotSummary,
    nativeWindows,
    logTail,
  };
}

function registerResources(server: McpServer, runtime: GreeblefsAutomationRuntime): void {
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
      const bridgeStatus = await runtime.getBridgeStatus() as {
        capabilities?: { hostBridge?: boolean };
      };
      const hostApiSchema = bridgeStatus.capabilities?.hostBridge
        ? await runtime.getHostApiSchema()
        : {
            unavailable: true,
            reason: 'Host bridge APIs are unavailable on browser-dev-url fallback attachments.',
          };
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
}

function registerTools(server: McpServer, runtime: GreeblefsAutomationRuntime): void {
  server.registerTool(
    'app_status',
    {
      title: 'App Status',
      description: 'Report whether the GreebleFS Tauri dev app is running, attachable, and bridge-ready.',
      inputSchema: z.object({
        includeAttachProbe: z.boolean().optional(),
      }),
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
      },
    },
    wrapToolHandler('app_status', async ({ includeAttachProbe }) => {
      const status = await runtime.getStatus({
        includeAttachProbe: includeAttachProbe === true,
      });
      return buildJsonToolResult('App status', { status });
    }),
  );

  server.registerTool(
    'app_doctor',
    {
      title: 'App Doctor',
      description: 'Run a higher-signal diagnostic sweep for the current GreebleFS Tauri dev session.',
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
      },
    },
    wrapToolHandler('app_doctor', async () => {
      const report = await buildDoctorReport(runtime);
      return buildJsonToolResult('App doctor report', report);
    }),
  );

  server.registerTool(
    'app_start_tauri_dev',
    {
      title: 'Start Tauri Dev',
      description: 'Start `bun run tauri dev` from the GreebleFS repo root and wait for the session file to appear.',
      annotations: {
        readOnlyHint: false,
        idempotentHint: false,
      },
    },
    wrapToolHandler('app_start_tauri_dev', async () => {
      const status = await runtime.startTauriDev();
      return buildJsonToolResult('Started Tauri dev session', { status });
    }),
  );

  server.registerTool(
    'app_stop_tauri_dev',
    {
      title: 'Stop Tauri Dev',
      description: 'Stop the currently running GreebleFS Tauri dev session tracked by the MCP status file.',
      annotations: {
        destructiveHint: true,
        idempotentHint: false,
      },
    },
    wrapToolHandler('app_stop_tauri_dev', async () => {
      const status = await runtime.stopTauriDev();
      return buildJsonToolResult('Stopped Tauri dev session', { status });
    }),
  );

  server.registerTool(
    'app_wait_ready',
    {
      title: 'Wait For Ready',
      description: 'Poll until the current GreebleFS dev session is running, reachable, and optionally bridge-ready.',
      inputSchema: z.object({
        timeoutMs: z.number().int().positive().optional(),
        requireBridge: z.boolean().optional(),
        requireCdp: z.boolean().optional(),
      }),
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
      },
    },
    wrapToolHandler('app_wait_ready', async ({ timeoutMs, requireBridge, requireCdp }) => {
      const status = await runtime.waitForReady({
        timeoutMs,
        requireBridge,
        requireCdp,
      });
      return buildJsonToolResult('Waited for app readiness', { status });
    }),
  );

  server.registerTool(
    'app_attach',
    {
      title: 'Attach To App',
      description: 'Attach Playwright to the running Tauri WebView through CDP, or fall back to the frontend dev URL.',
      inputSchema: z.object({
        preferNative: z.boolean().optional(),
        allowFallbackBrowser: z.boolean().optional(),
      }),
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
      },
    },
    wrapToolHandler('app_attach', async ({ preferNative, allowFallbackBrowser }) => {
      const attachment = await runtime.attachApp({
        preferNative,
        allowFallbackBrowser,
      });
      return buildJsonToolResult('Attached to app surface', { attachment });
    }),
  );

  server.registerTool(
    'app_read_dev_log',
    {
      title: 'Read Dev Log',
      description: 'Read the retained `bun run tauri dev` log tail published for MCP diagnostics.',
      inputSchema: z.object({
        limitLines: z.number().int().positive().optional(),
      }),
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
      },
    },
    wrapToolHandler('app_read_dev_log', async ({ limitLines }) => {
      const logTail = await runtime.readDevLogTail(limitLines ?? 200);
      return buildJsonToolResult('Read dev log tail', { logTail });
    }),
  );

  server.registerTool(
    'app_list_native_windows',
    {
      title: 'List Native Windows',
      description: 'List visible desktop windows for the running `greeblefs.exe` processes so agents can target the real native app surface.',
      inputSchema: z.object({
        processName: z.string().optional(),
      }),
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
      },
    },
    wrapToolHandler('app_list_native_windows', async ({ processName }) => {
      const windows = await runtime.listNativeWindows(processName ?? 'greeblefs');
      return buildJsonToolResult('Listed native desktop windows', { windows });
    }),
  );

  server.registerTool(
    'ui_snapshot',
    {
      title: 'UI Snapshot',
      description: 'Capture the current semantic UI snapshot including visible nodes, theme variables, perf, telemetry, and profile state.',
      inputSchema: z.object({
        includeDom: z.boolean().optional(),
        includeThemeVariables: z.boolean().optional(),
        includeTelemetryRecords: z.boolean().optional(),
        telemetryLimit: z.number().int().positive().optional(),
        consoleLimit: z.number().int().positive().optional(),
      }),
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
      },
    },
    wrapToolHandler('ui_snapshot', async (args) => {
      const snapshot = await runtime.getBridgeSnapshot(args);
      return buildJsonToolResult('Captured UI snapshot', { snapshot });
    }),
  );

  server.registerTool(
    'ui_screenshot',
    {
      title: 'UI Screenshot',
      description: 'Capture a PNG screenshot of the current live app surface.',
      inputSchema: z.object({
        fullPage: z.boolean().optional(),
        pathHint: z.string().optional(),
      }),
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
      },
    },
    wrapToolHandler('ui_screenshot', async ({ fullPage, pathHint }) => {
      const screenshot = await runtime.captureScreenshot({
        fullPage,
        pathHint,
      });
      return {
        content: [
          {
            type: 'text' as const,
            text: `Captured screenshot via ${screenshot.attachMode ?? 'unknown'} at ${screenshot.pageUrl}\nSaved to ${screenshot.imagePath}`,
          },
          {
            type: 'image' as const,
            data: screenshot.base64Png,
            mimeType: 'image/png',
          },
        ] satisfies ContentBlock[],
        structuredContent: {
          screenshot: {
            imagePath: screenshot.imagePath,
            attachMode: screenshot.attachMode,
            pageUrl: screenshot.pageUrl,
          },
        },
      };
    }),
  );

  server.registerTool(
    'ui_native_window_screenshot',
    {
      title: 'Native Window Screenshot',
      description: 'Capture a PNG screenshot from a live native desktop window for `greeblefs.exe`, even when WebView/CDP attachment is unavailable.',
      inputSchema: z.object({
        processName: z.string().optional(),
        handle: z.string().optional(),
        processId: z.number().int().positive().optional(),
        titleContains: z.string().optional(),
        pathHint: z.string().optional(),
      }),
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
      },
    },
    wrapToolHandler('ui_native_window_screenshot', async ({
      processName,
      handle,
      processId,
      titleContains,
      pathHint,
    }) => {
      const screenshot = await runtime.captureNativeWindowScreenshot({
        processName,
        handle,
        processId,
        titleContains,
        pathHint,
      });
      return {
        content: [
          {
            type: 'text' as const,
            text: `Captured native window screenshot for ${screenshot.window.processName} (${screenshot.window.handle}) at ${screenshot.imagePath}`,
          },
          {
            type: 'image' as const,
            data: screenshot.base64Png,
            mimeType: 'image/png',
          },
        ] satisfies ContentBlock[],
        structuredContent: {
          screenshot,
        },
      };
    }),
  );

  server.registerTool(
    'ui_accessibility_snapshot',
    {
      title: 'Accessibility Snapshot',
      description: 'Capture the Playwright accessibility tree for the current live app surface.',
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
      },
    },
    wrapToolHandler('ui_accessibility_snapshot', async () => {
      const accessibilitySnapshot = await runtime.getAccessibilitySnapshot();
      return buildJsonToolResult('Captured accessibility snapshot', {
        accessibilitySnapshot,
      });
    }),
  );

  server.registerTool(
    'ui_list_actions',
    {
      title: 'List Visible Actions',
      description: 'List visible nodes that expose stable `agentId` or `actionId` metadata on the current app surface.',
      inputSchema: z.object({
        includeUnnamed: z.boolean().optional(),
      }),
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
      },
    },
    wrapToolHandler('ui_list_actions', async ({ includeUnnamed }) => {
      const actions = await runtime.listVisibleActions({ includeUnnamed });
      return buildJsonToolResult('Listed visible actions', { actions });
    }),
  );

  server.registerTool(
    'ui_click',
    {
      title: 'Click UI Element',
      description: 'Click a visible UI element by selector, role, text, agentId, or actionId.',
      inputSchema: z.object({
        target: uiTargetSchema,
        button: z.enum(['left', 'right', 'middle']).optional(),
        timeoutMs: z.number().int().positive().optional(),
      }),
      annotations: {
        readOnlyHint: false,
        idempotentHint: false,
      },
    },
    wrapToolHandler('ui_click', async ({ target, button, timeoutMs }) => {
      const result = await runtime.click(buildUiTarget(target), {
        button,
        timeoutMs,
      });
      return buildJsonToolResult('Clicked UI element', { result });
    }),
  );

  server.registerTool(
    'ui_hover',
    {
      title: 'Hover UI Element',
      description: 'Hover a visible UI element by selector, role, text, agentId, or actionId.',
      inputSchema: z.object({
        target: uiTargetSchema,
        timeoutMs: z.number().int().positive().optional(),
      }),
      annotations: {
        readOnlyHint: false,
        idempotentHint: false,
      },
    },
    wrapToolHandler('ui_hover', async ({ target, timeoutMs }) => {
      const result = await runtime.hover(buildUiTarget(target), timeoutMs);
      return buildJsonToolResult('Hovered UI element', { result });
    }),
  );

  server.registerTool(
    'ui_type',
    {
      title: 'Type Into UI',
      description: 'Type text into a visible UI input or editor target.',
      inputSchema: z.object({
        target: uiTargetSchema,
        text: z.string(),
        clear: z.boolean().optional(),
        pressEnter: z.boolean().optional(),
        timeoutMs: z.number().int().positive().optional(),
      }),
      annotations: {
        readOnlyHint: false,
        idempotentHint: false,
      },
    },
    wrapToolHandler('ui_type', async ({ target, text, clear, pressEnter, timeoutMs }) => {
      const result = await runtime.typeText(buildUiTarget(target), text, {
        clear,
        pressEnter,
        timeoutMs,
      });
      return buildJsonToolResult('Typed into UI element', { result });
    }),
  );

  server.registerTool(
    'ui_press_key',
    {
      title: 'Press Key',
      description: 'Press a keyboard chord against the currently attached app surface.',
      inputSchema: z.object({
        key: z.string(),
      }),
      annotations: {
        readOnlyHint: false,
        idempotentHint: false,
      },
    },
    wrapToolHandler('ui_press_key', async ({ key }) => {
      const result = await runtime.pressKey(key);
      return buildJsonToolResult('Pressed key', { result });
    }),
  );

  server.registerTool(
    'ui_select_option',
    {
      title: 'Select Option',
      description: 'Select an option on a visible `<select>` element.',
      inputSchema: z.object({
        target: uiTargetSchema,
        option: z.string(),
      }),
      annotations: {
        readOnlyHint: false,
        idempotentHint: false,
      },
    },
    wrapToolHandler('ui_select_option', async ({ target, option }) => {
      const result = await runtime.selectOption(buildUiTarget(target), option);
      return buildJsonToolResult('Selected option', { result });
    }),
  );

  server.registerTool(
    'ui_drag',
    {
      title: 'Drag Element',
      description: 'Drag from one visible UI element to another.',
      inputSchema: z.object({
        source: uiTargetSchema,
        target: uiTargetSchema,
      }),
      annotations: {
        readOnlyHint: false,
        idempotentHint: false,
      },
    },
    wrapToolHandler('ui_drag', async ({ source, target }) => {
      const result = await runtime.drag(buildUiTarget(source), buildUiTarget(target));
      return buildJsonToolResult('Dragged UI element', { result });
    }),
  );

  server.registerTool(
    'ui_invoke_action',
    {
      title: 'Invoke Action',
      description: 'Invoke a visible action primarily by `actionId` or `agentId`, falling back to other UI targeting fields if needed.',
      inputSchema: uiTargetSchema,
      annotations: {
        readOnlyHint: false,
        idempotentHint: false,
      },
    },
    wrapToolHandler('ui_invoke_action', async (target) => {
      const result = await runtime.click(buildUiTarget(target));
      return buildJsonToolResult('Invoked visible action', { result });
    }),
  );

  server.registerTool(
    'ui_evaluate_script',
    {
      title: 'Evaluate Script',
      description: 'Run an arbitrary script inside the current live app page. Dangerous but useful for deep inspection.',
      inputSchema: z.object({
        script: z.string(),
        argument: z.unknown().optional(),
      }),
      annotations: {
        destructiveHint: true,
        openWorldHint: true,
        idempotentHint: false,
      },
    },
    wrapToolHandler('ui_evaluate_script', async ({ script, argument }) => {
      const result = await runtime.evaluateInApp(script, argument);
      return buildJsonToolResult('Evaluated in-app script', { result });
    }),
  );

  server.registerTool(
    'host_api_schema',
    {
      title: 'Host API Schema',
      description: 'Read the extension-host API schema exposed by the running GreebleFS app.',
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
      },
    },
    wrapToolHandler('host_api_schema', async () => {
      const bridgeStatus = await runtime.getBridgeStatus() as {
        capabilities?: { hostBridge?: boolean };
      };
      const hostApiSchema = bridgeStatus.capabilities?.hostBridge
        ? await runtime.getHostApiSchema()
        : {
            unavailable: true,
            reason: 'Host bridge APIs are unavailable on browser-dev-url fallback attachments.',
          };
      return buildJsonToolResult('Read host API schema', { hostApiSchema });
    }),
  );

  server.registerTool(
    'host_call',
    {
      title: 'Host Method Call',
      description: 'Call any extension-host method id through the running GreebleFS app.',
      inputSchema: z.object({
        methodId: z.string(),
        payload: z.unknown().optional(),
      }),
      annotations: {
        destructiveHint: true,
        openWorldHint: true,
        idempotentHint: false,
      },
    },
    wrapToolHandler('host_call', async ({ methodId, payload }) => {
      const result = await runtime.callHostMethod(methodId, payload);
      return buildJsonToolResult('Called host method', {
        methodId,
        result,
      });
    }),
  );

  server.registerTool(
    'host_events_snapshot',
    {
      title: 'Host Events Snapshot',
      description: 'Read retained host events for a topic via the running GreebleFS app.',
      inputSchema: z.object({
        request: z.record(z.string(), z.unknown()),
      }),
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
      },
    },
    wrapToolHandler('host_events_snapshot', async ({ request }) => {
      const events = await runtime.getHostEventsSnapshot(request);
      return buildJsonToolResult('Read host event snapshot', { events });
    }),
  );

  server.registerTool(
    'telemetry_recent',
    {
      title: 'Telemetry Recent',
      description: 'Read recent telemetry status and retained records from the running app.',
      inputSchema: z.object({
        limit: z.number().int().positive().optional(),
      }),
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
      },
    },
    wrapToolHandler('telemetry_recent', async ({ limit }) => {
      const telemetryStatus = await runtime.getTelemetryStatus();
      const telemetryRecords = await runtime.getTelemetryRecords(limit ?? 60);
      return buildJsonToolResult('Read telemetry records', {
        telemetryStatus,
        telemetryRecords,
      });
    }),
  );

  server.registerTool(
    'performance_snapshot',
    {
      title: 'Performance Snapshot',
      description: 'Read the current explorer performance snapshot and summary from the running app.',
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
      },
    },
    wrapToolHandler('performance_snapshot', async () => {
      const performance = await runtime.getPerformanceSnapshot();
      return buildJsonToolResult('Read performance snapshot', { performance });
    }),
  );

  server.registerTool(
    'profile_snapshot',
    {
      title: 'Profile Snapshot',
      description: 'Read the current USR profile snapshot from the running app.',
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
      },
    },
    wrapToolHandler('profile_snapshot', async () => {
      const profileSnapshot = await runtime.getUsrProfileSnapshot();
      return buildJsonToolResult('Read profile snapshot', { profileSnapshot });
    }),
  );

  server.registerTool(
    'console_recent',
    {
      title: 'Console Recent',
      description: 'Read retained frontend console entries and runtime errors from the current app window.',
      inputSchema: z.object({
        limit: z.number().int().positive().optional(),
      }),
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
      },
    },
    wrapToolHandler('console_recent', async ({ limit }) => {
      const consoleEntries = await runtime.getConsoleEntries(limit ?? 120);
      return buildJsonToolResult('Read recent console entries', { consoleEntries });
    }),
  );

  server.registerTool(
    'console_clear',
    {
      title: 'Clear Console Retention',
      description: 'Clear the retained frontend console/error buffer in the current app window.',
      annotations: {
        destructiveHint: true,
        idempotentHint: false,
      },
    },
    wrapToolHandler('console_clear', async () => {
      const result = await runtime.clearConsoleEntries();
      return buildJsonToolResult('Cleared retained console entries', { result });
    }),
  );

  server.registerTool(
    'workspace_read_text',
    {
      title: 'Read Workspace Text',
      description: 'Read a UTF-8 text file inside the GreebleFS repo root.',
      inputSchema: z.object({
        path: z.string(),
      }),
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
      },
    },
    wrapToolHandler('workspace_read_text', async ({ path }) => {
      const result = await runtime.readWorkspaceText(path);
      return buildJsonToolResult('Read workspace text file', { result });
    }),
  );

  server.registerTool(
    'workspace_write_text',
    {
      title: 'Write Workspace Text',
      description: 'Write or create a UTF-8 text file inside the GreebleFS repo root.',
      inputSchema: z.object({
        path: z.string(),
        content: z.string(),
      }),
      annotations: {
        destructiveHint: true,
        idempotentHint: false,
      },
    },
    wrapToolHandler('workspace_write_text', async ({ path, content }) => {
      const result = await runtime.writeWorkspaceText(path, content);
      return buildJsonToolResult('Wrote workspace text file', { result });
    }),
  );

  server.registerTool(
    'workspace_list_directory',
    {
      title: 'List Workspace Directory',
      description: 'List one directory inside the GreebleFS repo root.',
      inputSchema: z.object({
        path: z.string().optional(),
      }),
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
      },
    },
    wrapToolHandler('workspace_list_directory', async ({ path }) => {
      const result = await runtime.listWorkspaceDirectory(path ?? '.');
      return buildJsonToolResult('Listed workspace directory', { result });
    }),
  );

  server.registerTool(
    'workspace_stat',
    {
      title: 'Workspace Stat',
      description: 'Inspect one file or directory inside the GreebleFS repo root.',
      inputSchema: z.object({
        path: z.string(),
      }),
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
      },
    },
    wrapToolHandler('workspace_stat', async ({ path }) => {
      const result = await runtime.statWorkspacePath(path);
      return buildJsonToolResult('Read workspace path metadata', { result });
    }),
  );

  server.registerTool(
    'workspace_delete_path',
    {
      title: 'Delete Workspace Path',
      description: 'Delete a file or directory inside the GreebleFS repo root.',
      inputSchema: z.object({
        path: z.string(),
      }),
      annotations: {
        destructiveHint: true,
        idempotentHint: false,
      },
    },
    wrapToolHandler('workspace_delete_path', async ({ path }) => {
      const result = await runtime.deleteWorkspacePath(path);
      return buildJsonToolResult('Deleted workspace path', { result });
    }),
  );

  server.registerTool(
    'workspace_run_command',
    {
      title: 'Run Workspace Command',
      description: 'Run a shell command from the GreebleFS repo root or a repo-relative working directory.',
      inputSchema: z.object({
        command: z.string(),
        cwd: z.string().optional(),
      }),
      annotations: {
        destructiveHint: true,
        openWorldHint: true,
        idempotentHint: false,
      },
    },
    wrapToolHandler('workspace_run_command', async ({ command, cwd }) => {
      const result = await runtime.runWorkspaceCommand(command, { cwd });
      return buildJsonToolResult('Ran workspace command', { result });
    }),
  );
}

function buildServer(runtime: GreeblefsAutomationRuntime): McpServer {
  const server = new McpServer(
    {
      name: '@greeblefs/dev-mcp',
      version: '0.1.0',
    },
    {
      capabilities: {
        logging: {},
        tools: {},
        resources: {},
      },
    },
  );

  registerResources(server, runtime);
  registerTools(server, runtime);
  return server;
}

async function runDoctorMode(runtime: GreeblefsAutomationRuntime): Promise<void> {
  const report = await buildDoctorReport(runtime);
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

async function runStdioServer(runtime: GreeblefsAutomationRuntime): Promise<void> {
  const server = buildServer(runtime);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

async function runHttpServer(runtime: GreeblefsAutomationRuntime, port: number): Promise<void> {
  const app = createMcpExpressApp({
    host: '127.0.0.1',
  });

  app.post('/mcp', async (req: any, res: any) => {
    const server = buildServer(runtime);
    try {
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
      });
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
      res.on('close', () => {
        void transport.close();
        void server.close();
      });
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

  app.get('/mcp', async (_req: any, res: any) => {
    res.writeHead(405).end(JSON.stringify({
      jsonrpc: '2.0',
      error: {
        code: -32000,
        message: 'Method not allowed.',
      },
      id: null,
    }));
  });

  app.delete('/mcp', async (_req: any, res: any) => {
    res.writeHead(405).end(JSON.stringify({
      jsonrpc: '2.0',
      error: {
        code: -32000,
        message: 'Method not allowed.',
      },
      id: null,
    }));
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
      await runDoctorMode(runtime);
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
