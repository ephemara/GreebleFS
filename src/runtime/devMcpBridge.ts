import { isTauri } from '@tauri-apps/api/core';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';

import type {
  HostEventEnvelope,
  HostSubscriptionRequest,
} from './extensionHostApi';
import {
  createExtensionHostClient,
} from './extensionHostApi';
import {
  getRecentTelemetryRecords,
  getTelemetryStatus,
} from './telemetryBackend';
import {
  loadExplorerPerformanceSnapshot,
  summarizeExplorerPerformance,
} from '../config/performanceTelemetry';
import {
  getCurrentSecondaryWindowDescriptor,
} from './secondaryWindows';
import {
  getUsrProfileRuntimeSnapshot,
} from './usrProfiles';
import { useSettingsStore } from '../store/settingsStore';

const DEV_MCP_BRIDGE_VERSION = 1;
const MAX_CONSOLE_ENTRIES = 400;
const MAX_DOM_NODES = 250;
const ENABLE_DEV_MCP_BRIDGE = (() => {
  const env = (import.meta as unknown as {
    env?: {
      DEV?: boolean;
      MODE?: string;
      VITE_GREEBLEFS_MCP_ENABLED?: string;
    };
  }).env;
  return env?.DEV === true || env?.MODE === 'development' || env?.VITE_GREEBLEFS_MCP_ENABLED === '1';
})();

type ConsoleEntryLevel = 'debug' | 'info' | 'log' | 'warn' | 'error';

interface DevMcpBridgeConsoleEntry {
  id: string;
  level: ConsoleEntryLevel;
  source: 'console' | 'window-error' | 'unhandled-rejection';
  createdAt: number;
  message: string;
  values: unknown[];
}

interface DevMcpBridgeDomNodeSnapshot {
  path: string;
  tagName: string;
  role: string | null;
  accessibleName: string | null;
  text: string | null;
  title: string | null;
  inputType: string | null;
  disabled: boolean;
  checked: boolean | null;
  expanded: boolean | null;
  selected: boolean | null;
  agentId: string | null;
  actionId: string | null;
  visible: boolean;
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  colors: {
    foreground: string;
    background: string;
    border: string;
    opacity: string;
  };
}

interface DevMcpBridgeStatus {
  bridgeVersion: number;
  installedAt: number;
  rootRendered: boolean;
  tauriAvailable: boolean;
  documentTitle: string;
  locationHref: string;
  windowLabel: string | null;
  secondaryWindowKind: string | null;
  consoleEntryCount: number;
  capabilities: {
    hostBridge: boolean;
    telemetry: boolean;
    performance: boolean;
    usrProfiles: boolean;
  };
}

interface DevMcpBridgeSnapshotOptions {
  includeDom?: boolean;
  includeThemeVariables?: boolean;
  includeTelemetryRecords?: boolean;
  telemetryLimit?: number;
  consoleLimit?: number;
}

interface DevMcpBridgeSnapshot {
  status: DevMcpBridgeStatus;
  selectionSnapshot: unknown | null;
  previewSession: unknown | null;
  hostTopics: unknown[];
  usrProfileSnapshot: unknown | null;
  settingsExcerpt: Record<string, unknown>;
  performance: {
    snapshot: ReturnType<typeof loadExplorerPerformanceSnapshot>;
    summary: ReturnType<typeof summarizeExplorerPerformance>;
  };
  telemetryStatus: unknown | null;
  telemetryRecords: unknown[];
  domNodes: DevMcpBridgeDomNodeSnapshot[];
  themeVariables: Record<string, string>;
  focusedElement: {
    tagName: string | null;
    role: string | null;
    accessibleName: string | null;
    path: string | null;
  };
  consoleEntries: DevMcpBridgeConsoleEntry[];
  errors: string[];
}

interface DevMcpBridgeApi {
  version: number;
  markRootRendered: () => void;
  getStatus: () => Promise<DevMcpBridgeStatus>;
  getConsoleEntries: (limit?: number) => DevMcpBridgeConsoleEntry[];
  clearConsoleEntries: () => void;
  getHostApiSchema: () => Promise<unknown>;
  getTelemetryStatus: typeof getTelemetryStatus;
  getTelemetryRecords: (limit?: number) => Promise<unknown[]>;
  getUsrProfileSnapshot: () => unknown | null;
  getPerformanceSnapshot: () => DevMcpBridgeSnapshot['performance'];
  callHostMethod: (methodId: string, payload?: unknown) => Promise<unknown>;
  getHostEventsSnapshot: (request: HostSubscriptionRequest) => Promise<HostEventEnvelope[]>;
  getSnapshot: (options?: DevMcpBridgeSnapshotOptions) => Promise<DevMcpBridgeSnapshot>;
}

declare global {
  interface Window {
    __GREEBLEFS_DEV_MCP__?: DevMcpBridgeApi;
    __GREEBLEFS_DEV_MCP_ROOT_RENDERED__?: boolean;
  }
}

let installedBridge: DevMcpBridgeApi | null = null;
let installedAtMs = Date.now();
let consoleEntrySequence = 0;
const consoleEntries: DevMcpBridgeConsoleEntry[] = [];

function nextConsoleEntryId(): string {
  consoleEntrySequence += 1;
  return `gfs-dev-mcp-console-${consoleEntrySequence}`;
}

function appendConsoleEntry(entry: Omit<DevMcpBridgeConsoleEntry, 'id'>): void {
  consoleEntries.push({
    id: nextConsoleEntryId(),
    ...entry,
  });
  if (consoleEntries.length > MAX_CONSOLE_ENTRIES) {
    consoleEntries.splice(0, consoleEntries.length - MAX_CONSOLE_ENTRIES);
  }
}

function summarizeUnknownValue(value: unknown, depth = 0): unknown {
  if (value == null) {
    return value;
  }
  if (typeof value === 'string') {
    return value.length > 400 ? `${value.slice(0, 397)}...` : value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'bigint') {
    return value.toString();
  }
  if (typeof value === 'function') {
    return `[function ${value.name || 'anonymous'}]`;
  }
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack ?? null,
    };
  }
  if (Array.isArray(value)) {
    if (depth >= 2) {
      return `[array(${value.length})]`;
    }
    return value.slice(0, 12).map((entry) => summarizeUnknownValue(entry, depth + 1));
  }
  if (value instanceof HTMLElement) {
    return {
      tagName: value.tagName.toLowerCase(),
      id: value.id || null,
      className: value.className || null,
      text: value.innerText?.trim().slice(0, 200) || null,
    };
  }
  if (typeof value === 'object') {
    if (depth >= 2) {
      return '[object]';
    }
    const record = value as Record<string, unknown>;
    return Object.fromEntries(
      Object.entries(record)
        .slice(0, 20)
        .map(([key, entryValue]) => [key, summarizeUnknownValue(entryValue, depth + 1)]),
    );
  }
  return String(value);
}

function buildConsoleMessage(values: unknown[]): string {
  return values
    .map((value) => {
      if (typeof value === 'string') {
        return value;
      }
      try {
        return JSON.stringify(summarizeUnknownValue(value));
      } catch {
        return String(value);
      }
    })
    .join(' ');
}

function installConsoleCapture(): void {
  const consoleMethods: ConsoleEntryLevel[] = ['debug', 'info', 'log', 'warn', 'error'];
  for (const level of consoleMethods) {
    const original = console[level].bind(console);
    console[level] = (...values: unknown[]) => {
      appendConsoleEntry({
        level,
        source: 'console',
        createdAt: Date.now(),
        message: buildConsoleMessage(values),
        values: values.map((value) => summarizeUnknownValue(value)),
      });
      original(...values);
    };
  }

  window.addEventListener('error', (event) => {
    appendConsoleEntry({
      level: 'error',
      source: 'window-error',
      createdAt: Date.now(),
      message: `${event.message || 'Unhandled window error'}${event.filename ? ` @ ${event.filename}:${event.lineno}:${event.colno}` : ''}`,
      values: [
        summarizeUnknownValue(event.error ?? {
          message: event.message,
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
        }),
      ],
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    appendConsoleEntry({
      level: 'error',
      source: 'unhandled-rejection',
      createdAt: Date.now(),
      message: 'Unhandled promise rejection',
      values: [summarizeUnknownValue(event.reason)],
    });
  });
}

function buildElementPath(element: Element): string {
  const segments: string[] = [];
  let current: Element | null = element;
  while (current && segments.length < 6) {
    if (current instanceof HTMLElement) {
      const explicitId = current.getAttribute('data-gfs-agent-id')
        || current.getAttribute('data-agent-id')
        || current.id;
      if (explicitId) {
        segments.unshift(`${current.tagName.toLowerCase()}#${explicitId}`);
        break;
      }
    }
    const tagName = current.tagName.toLowerCase();
    const parent: HTMLElement | null = current.parentElement;
    if (!parent) {
      segments.unshift(tagName);
      break;
    }
    const currentTagName = current.tagName;
    const siblings = Array.from(parent.children).filter(
      (candidate): candidate is Element => candidate.tagName === currentTagName,
    );
    const siblingIndex = siblings.indexOf(current) + 1;
    segments.unshift(`${tagName}:nth-of-type(${Math.max(siblingIndex, 1)})`);
    current = parent;
  }
  return segments.join(' > ');
}

function readAccessibleName(element: Element): string | null {
  if (!(element instanceof HTMLElement)) {
    return null;
  }
  const ariaLabel = element.getAttribute('aria-label')?.trim();
  if (ariaLabel) {
    return ariaLabel;
  }
  const labelledById = element.getAttribute('aria-labelledby')?.trim();
  if (labelledById) {
    const labelText = labelledById
      .split(/\s+/)
      .map((id) => document.getElementById(id)?.textContent?.trim() ?? '')
      .filter(Boolean)
      .join(' ');
    if (labelText) {
      return labelText;
    }
  }
  if ('labels' in element) {
    const labels = Array.from((element as HTMLInputElement).labels ?? []);
    const labelText = labels
      .map((label) => label.textContent?.trim() ?? '')
      .filter(Boolean)
      .join(' ');
    if (labelText) {
      return labelText;
    }
  }
  const placeholder = element.getAttribute('placeholder')?.trim();
  if (placeholder) {
    return placeholder;
  }
  const title = element.getAttribute('title')?.trim();
  if (title) {
    return title;
  }
  const text = element.innerText?.trim();
  return text ? text.slice(0, 200) : null;
}

function isElementVisible(element: HTMLElement): boolean {
  const style = window.getComputedStyle(element);
  if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
    return false;
  }
  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

function collectThemeVariables(): Record<string, string> {
  const style = window.getComputedStyle(document.documentElement);
  const variables: Record<string, string> = {};
  for (const name of Array.from(style)) {
    if (!name.startsWith('--gfs-') && !name.startsWith('--overlayterm-')) {
      continue;
    }
    const value = style.getPropertyValue(name).trim();
    if (value) {
      variables[name] = value;
    }
  }
  return variables;
}

function collectDomNodes(): DevMcpBridgeDomNodeSnapshot[] {
  const selector = [
    'button',
    'a[href]',
    'input',
    'select',
    'textarea',
    '[role]',
    '[aria-label]',
    '[title]',
    '[data-gfs-agent-id]',
    '[data-agent-id]',
    '[data-action-id]',
  ].join(',');
  const nodes: DevMcpBridgeDomNodeSnapshot[] = [];
  const elements = Array.from(document.querySelectorAll<HTMLElement>(selector)).slice(0, MAX_DOM_NODES * 3);
  for (const element of elements) {
    const visible = isElementVisible(element);
    if (!visible && !element.matches('[aria-hidden="false"]')) {
      continue;
    }
    const computedStyle = window.getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    nodes.push({
      path: buildElementPath(element),
      tagName: element.tagName.toLowerCase(),
      role: element.getAttribute('role'),
      accessibleName: readAccessibleName(element),
      text: element.innerText?.trim().slice(0, 200) || null,
      title: element.getAttribute('title'),
      inputType: element instanceof HTMLInputElement ? element.type : null,
      disabled: 'disabled' in element ? Boolean((element as HTMLButtonElement | HTMLInputElement).disabled) : false,
      checked: 'checked' in element ? Boolean((element as HTMLInputElement).checked) : null,
      expanded: element.getAttribute('aria-expanded') === null ? null : element.getAttribute('aria-expanded') === 'true',
      selected: element.getAttribute('aria-selected') === null ? null : element.getAttribute('aria-selected') === 'true',
      agentId: element.getAttribute('data-gfs-agent-id') || element.getAttribute('data-agent-id'),
      actionId: element.getAttribute('data-action-id'),
      visible,
      bounds: {
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      },
      colors: {
        foreground: computedStyle.color,
        background: computedStyle.backgroundColor,
        border: computedStyle.borderColor,
        opacity: computedStyle.opacity,
      },
    });
    if (nodes.length >= MAX_DOM_NODES) {
      break;
    }
  }
  return nodes;
}

function createSettingsExcerpt(): Record<string, unknown> {
  const settings = useSettingsStore.getState().settings as unknown as Record<string, unknown> | undefined;
  if (!settings) {
    return {};
  }
  const pickedKeys = [
    'appearance',
    'presentation',
    'dock',
    'explorer',
    'layout',
    'terminal',
    'system',
    'plugins',
  ];
  return Object.fromEntries(
    pickedKeys
      .filter((key) => key in settings)
      .map((key) => [key, summarizeUnknownValue(settings[key])]),
  );
}

async function resolveWindowLabel(): Promise<string | null> {
  if (!isTauri()) {
    return null;
  }
  try {
    return getCurrentWebviewWindow().label ?? null;
  } catch {
    return null;
  }
}

async function resolveSecondaryWindowKind(): Promise<string | null> {
  if (!isTauri()) {
    return null;
  }
  try {
    const descriptor = await getCurrentSecondaryWindowDescriptor();
    return descriptor?.surfaceKind ?? null;
  } catch {
    return null;
  }
}

async function buildBridgeStatus(): Promise<DevMcpBridgeStatus> {
  return {
    bridgeVersion: DEV_MCP_BRIDGE_VERSION,
    installedAt: installedAtMs,
    rootRendered: window.__GREEBLEFS_DEV_MCP_ROOT_RENDERED__ === true,
    tauriAvailable: isTauri(),
    documentTitle: document.title,
    locationHref: window.location.href,
    windowLabel: await resolveWindowLabel(),
    secondaryWindowKind: await resolveSecondaryWindowKind(),
    consoleEntryCount: consoleEntries.length,
    capabilities: {
      hostBridge: isTauri(),
      telemetry: isTauri(),
      performance: true,
      usrProfiles: true,
    },
  };
}

async function createBridgeSnapshot(
  options: DevMcpBridgeSnapshotOptions = {},
): Promise<DevMcpBridgeSnapshot> {
  const errors: string[] = [];
  const hostClient = isTauri() ? createExtensionHostClient() : null;
  let selectionSnapshot: unknown | null = null;
  let previewSession: unknown | null = null;
  let hostTopics: unknown[] = [];
  let telemetryStatus: unknown | null = null;
  let telemetryRecords: unknown[] = [];

  if (hostClient) {
    try {
      selectionSnapshot = await hostClient.selection.getSnapshot();
    } catch (error) {
      errors.push(`selection.getSnapshot failed: ${error instanceof Error ? error.message : String(error)}`);
    }
    try {
      previewSession = await hostClient.preview.getSession();
    } catch (error) {
      errors.push(`preview.getSession failed: ${error instanceof Error ? error.message : String(error)}`);
    }
    try {
      hostTopics = await hostClient.events.describeTopics();
    } catch (error) {
      errors.push(`events.describeTopics failed: ${error instanceof Error ? error.message : String(error)}`);
    }
    try {
      telemetryStatus = await getTelemetryStatus();
    } catch (error) {
      errors.push(`getTelemetryStatus failed: ${error instanceof Error ? error.message : String(error)}`);
    }
    if (options.includeTelemetryRecords !== false) {
      try {
        telemetryRecords = await getRecentTelemetryRecords(options.telemetryLimit ?? 60);
      } catch (error) {
        errors.push(`getRecentTelemetryRecords failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  const focusedElement = document.activeElement instanceof HTMLElement
    ? {
        tagName: document.activeElement.tagName.toLowerCase(),
        role: document.activeElement.getAttribute('role'),
        accessibleName: readAccessibleName(document.activeElement),
        path: buildElementPath(document.activeElement),
      }
    : {
        tagName: null,
        role: null,
        accessibleName: null,
        path: null,
      };

  return {
    status: await buildBridgeStatus(),
    selectionSnapshot,
    previewSession,
    hostTopics,
    usrProfileSnapshot: getUsrProfileRuntimeSnapshot(),
    settingsExcerpt: createSettingsExcerpt(),
    performance: {
      snapshot: loadExplorerPerformanceSnapshot(),
      summary: summarizeExplorerPerformance(),
    },
    telemetryStatus,
    telemetryRecords,
    domNodes: options.includeDom === false ? [] : collectDomNodes(),
    themeVariables: options.includeThemeVariables === false ? {} : collectThemeVariables(),
    focusedElement,
    consoleEntries: consoleEntries.slice(-Math.max(1, Math.min(MAX_CONSOLE_ENTRIES, options.consoleLimit ?? 120))),
    errors,
  };
}

function createBridgeApi(): DevMcpBridgeApi {
  const hostClient = createExtensionHostClient();
  return {
    version: DEV_MCP_BRIDGE_VERSION,
    markRootRendered: () => {
      window.__GREEBLEFS_DEV_MCP_ROOT_RENDERED__ = true;
    },
    getStatus: () => buildBridgeStatus(),
    getConsoleEntries: (limit = 120) => consoleEntries.slice(-Math.max(1, Math.min(MAX_CONSOLE_ENTRIES, limit))),
    clearConsoleEntries: () => {
      consoleEntries.splice(0, consoleEntries.length);
    },
    getHostApiSchema: async () => {
      if (!isTauri()) {
        throw new Error('getHostApiSchema requires a running Tauri webview.');
      }
      return hostClient.host.getApiSchema();
    },
    getTelemetryStatus,
    getTelemetryRecords: async (limit = 60) => getRecentTelemetryRecords(limit),
    getUsrProfileSnapshot: () => getUsrProfileRuntimeSnapshot(),
    getPerformanceSnapshot: () => ({
      snapshot: loadExplorerPerformanceSnapshot(),
      summary: summarizeExplorerPerformance(),
    }),
    callHostMethod: async (methodId, payload) => {
      if (!isTauri()) {
        throw new Error('callHostMethod requires a running Tauri webview.');
      }
      return hostClient.call(methodId, payload);
    },
    getHostEventsSnapshot: async (request) => {
      if (!isTauri()) {
        throw new Error('getHostEventsSnapshot requires a running Tauri webview.');
      }
      return hostClient.events.getSnapshot(request);
    },
    getSnapshot: async (options) => createBridgeSnapshot(options),
  };
}

export async function installGreeblefsDevMcpBridge(): Promise<void> {
  if (!ENABLE_DEV_MCP_BRIDGE || typeof window === 'undefined') {
    return;
  }
  if (installedBridge) {
    return;
  }
  installedAtMs = Date.now();
  installConsoleCapture();
  installedBridge = createBridgeApi();
  window.__GREEBLEFS_DEV_MCP__ = installedBridge;
  appendConsoleEntry({
    level: 'info',
    source: 'console',
    createdAt: Date.now(),
    message: 'Installed GreebleFS dev MCP bridge',
    values: [
      {
        bridgeVersion: DEV_MCP_BRIDGE_VERSION,
        tauriAvailable: isTauri(),
      },
    ],
  });
}

export function markGreeblefsDevMcpBridgeRenderComplete(): void {
  if (!ENABLE_DEV_MCP_BRIDGE || typeof window === 'undefined') {
    return;
  }
  window.__GREEBLEFS_DEV_MCP_ROOT_RENDERED__ = true;
  window.__GREEBLEFS_DEV_MCP__?.markRootRendered();
}
