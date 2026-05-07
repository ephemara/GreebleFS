import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { chromium, type Browser, type Locator, type Page } from 'playwright';
import {
  captureWindowsDesktopWindowScreenshot,
  listWindowsDesktopWindows,
  type WindowsDesktopWindowRecord,
} from './windowsDesktopWindowCapture.js';

const thisFilePath = fileURLToPath(import.meta.url);
const runtimeDirectory = path.dirname(thisFilePath);
const packageRoot = path.resolve(runtimeDirectory, '..', '..');
const repoRoot = path.resolve(packageRoot, '..', '..');
const mcpRoot = path.join(repoRoot, 'MCP');
const mcpStateDirectory = path.join(mcpRoot, '.state');
const screenshotDirectory = path.join(mcpStateDirectory, 'screenshots');
const tauriDevStatusPath = path.join(mcpStateDirectory, 'tauri-dev-session.json');
const tauriDevLogPath = path.join(mcpStateDirectory, 'tauri-dev.log');
const nativeAutomationSessionPath = path.join(mcpStateDirectory, 'greeblefs-native-automation.json');
const tauronWebviewDiagnosticsPath = path.join(mcpStateDirectory, 'tauron-webview2-session.json');
const fallbackBrowserProfileDirectory = path.join(mcpStateDirectory, 'fallback-browser-profile');
const preferredPlaywrightLaunchChannels = [
  process.env.GREEBLEFS_MCP_PLAYWRIGHT_CHANNEL?.trim(),
  process.env.PLAYWRIGHT_CHANNEL?.trim(),
  'msedge',
  'chrome',
].filter((value): value is string => Boolean(value));
const preferredFallbackBrowserExecutables = [
  process.env.GREEBLEFS_MCP_BROWSER_EXECUTABLE?.trim(),
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?.trim(),
  process.platform === 'win32' ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' : null,
  process.platform === 'win32' ? 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe' : null,
  process.platform === 'win32' ? 'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe' : null,
].filter((value): value is string => Boolean(value));

export interface GreeblefsTauriDevSessionRecord {
  version: number;
  product: string;
  command: string;
  cwd: string;
  running: boolean;
  status: string;
  tauriCommand: string;
  pid: number | null;
  exitCode: number | null;
  signal?: string | null;
  startedAt: string;
  updatedAt: string;
  endedAt?: string | null;
  error?: string | null;
  lastOutputAt?: string | null;
  frontendDevUrl?: string | null;
  webviewDebugPort?: string | null;
  tauronWebviewDiagnosticsPath?: string | null;
  nativeAutomationFilePath?: string | null;
  logFilePath?: string | null;
  statusFilePath?: string | null;
}

export interface GreeblefsNativeAutomationCapabilities {
  health?: boolean;
  hostApi?: boolean;
  hostEvents?: boolean;
  telemetry?: boolean;
  usrProfiles?: boolean;
  windowMetadata?: boolean;
}

export interface GreeblefsNativeAutomationSessionRecord {
  version: number;
  pid: number;
  startedAtUnixMs: number;
  updatedAtUnixMs: number;
  filePath: string;
  baseUrl: string;
  healthUrl: string;
  rpcUrl: string;
  hostEventsSubscribeUrl: string;
  hostEventsReadUrl: string;
  hostEventsUnsubscribeUrl: string;
  authToken: string;
  capabilities?: GreeblefsNativeAutomationCapabilities;
}

export interface GreeblefsNativeAutomationWindowRecord {
  windowLabel: string;
  title: string;
  visible?: boolean | null;
  secondaryWindowId?: string | null;
  secondaryWindowKind?: string | null;
}

export interface GreeblefsNativeAutomationHealth {
  ok: boolean;
  pid?: number;
  startedAtUnixMs?: number;
  updatedAtUnixMs?: number;
  windows?: GreeblefsNativeAutomationWindowRecord[];
  subscriptionCount?: number;
  capabilities?: GreeblefsNativeAutomationCapabilities;
}

export interface GreeblefsHostEventsSubscriptionSummary {
  subscriptionId: string;
  hostSubscriptionId: string;
  createdAtUnixMs: number;
  updatedAtUnixMs: number;
  droppedEvents: number;
  latestSequence?: number | null;
}

export interface GreeblefsHostEventsReadResult {
  subscription: GreeblefsHostEventsSubscriptionSummary;
  events: Array<Record<string, unknown>>;
}

export interface TauronWebviewDiagnosticsWebviewRecord {
  label?: string;
  status?: string;
  url?: string;
  dataDirectory?: string | null;
  resolvedAdditionalBrowserArgs?: string | null;
  requestedAdditionalBrowserArgs?: string | null;
  rawWebview2AdditionalBrowserArgumentsEnv?: string | null;
  remoteDebuggingPort?: number | null;
  browserExtensionsEnabled?: boolean;
  devtoolsEnabled?: boolean;
  customEnvironmentProvided?: boolean;
  reusedExistingWebContext?: boolean;
  windowTheme?: string | null;
  configurationWarnings?: string[];
  lastError?: string | null;
}

export interface TauronWebviewDiagnosticsEventRecord {
  name?: string;
  detail?: string | null;
  unixMs?: number | null;
}

export interface TauronWebviewDiagnosticsSession {
  version?: number;
  runtime?: string;
  platform?: string;
  pid?: number;
  processPath?: string | null;
  webviewRuntimeInstalled?: boolean;
  webviewRuntimeVersion?: string | null;
  diagnosticsFilePath?: string | null;
  sessionStartedAtUnixMs?: number;
  updatedAtUnixMs?: number;
  lastEvent?: string | null;
  lastError?: string | null;
  recentEvents?: TauronWebviewDiagnosticsEventRecord[];
  webviews?: Record<string, TauronWebviewDiagnosticsWebviewRecord>;
}

export type GreeblefsAutomationStartupPhase =
  | 'not-started'
  | 'launching'
  | 'cargo-compiling'
  | 'frontend-dev-server-ready'
  | 'runtime-initialized'
  | 'webview-launching'
  | 'webview-created'
  | 'cdp-ready'
  | 'bridge-ready'
  | 'exited'
  | 'failed';

export interface GreeblefsAutomationStatus {
  repoRoot: string;
  statusFilePath: string;
  logFilePath: string;
  nativeAutomationSessionFilePath: string;
  tauronWebviewDiagnosticsFilePath: string;
  session: GreeblefsTauriDevSessionRecord | null;
  nativeAutomationSession: GreeblefsNativeAutomationSessionRecord | null;
  sessionFileExists: boolean;
  pidRunning: boolean;
  devUrlReachable: boolean;
  cdpReachable: boolean;
  nativeAutomationReachable: boolean;
  cdpVersion: string | null;
  tauronWebviewDiagnostics: TauronWebviewDiagnosticsSession | null;
  attachMode: 'native-cdp' | 'browser-dev-url' | null;
  attachedPageUrl: string | null;
  bridgeReady: boolean;
  startupPhase: GreeblefsAutomationStartupPhase;
  startupHint: string | null;
  recentLogActivity: string | null;
  attachProbeDeferredReason: string | null;
  lastAttachError: string | null;
}

export interface GreeblefsUiTarget {
  selector?: string;
  role?: string;
  name?: string;
  text?: string;
  exact?: boolean;
  agentId?: string;
  actionId?: string;
}

interface BrowserAttachmentOptions {
  preferNative?: boolean;
  allowFallbackBrowser?: boolean;
  windowLabel?: string;
  secondaryWindowKind?: string;
}

export interface GreeblefsWorkspaceDirectoryEntry {
  name: string;
  absolutePath: string;
  relativePath: string;
  isDirectory: boolean;
  size: number;
  modifiedAt: string | null;
}

export interface GreeblefsWorkspaceStatResult {
  requestedPath: string;
  resolvedPath: string;
  exists: boolean;
  isDirectory: boolean;
  size: number;
  modifiedAt: string | null;
}

export interface GreeblefsWorkspaceCommandResult {
  command: string;
  cwd: string;
  exitCode: number;
  stdout: string;
  stderr: string;
}

export interface GreeblefsNativeWindowScreenshotResult {
  imagePath: string;
  base64Png?: string | null;
  window: WindowsDesktopWindowRecord & {
    bounds?: {
      left: number;
      top: number;
      width: number;
      height: number;
    };
  };
}

interface NativeAutomationRpcEnvelope<T> {
  ok: boolean;
  result?: T;
  error?: string;
}

interface HostEventSubscriptionRuntimeRecord {
  subscriptionId: string;
  request: Record<string, unknown>;
  resourceUri: string;
  latestState: GreeblefsHostEventsReadResult;
  latestSequence: number | null;
  listeners: Set<(state: GreeblefsHostEventsReadResult) => void>;
  disposed: boolean;
  pollTimer: ReturnType<typeof setTimeout> | null;
}

function normalizeWindowsPathForJson(value: string): string {
  return value.replace(/\\/g, '/');
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildIsoTimestamp(): string {
  return new Date().toISOString();
}

function parseIsoTimestampToUnixMs(value: string | null | undefined): number | null {
  if (!value) {
    return null;
  }
  const unixMs = Date.parse(value);
  return Number.isFinite(unixMs) ? unixMs : null;
}

function stripAnsiControlSequences(value: string): string {
  return value.replace(/\u001b\[[0-9;?]*[ -/]*[@-~]/g, '');
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function readJsonFile<T>(filePath: string): Promise<T | null> {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function writeTextFile(filePath: string, content: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, 'utf8');
}

async function appendTextFile(filePath: string, content: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.appendFile(filePath, content, 'utf8');
}

function escapeCssAttributeValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function resolvePathInsideRepo(pathLike: string): string {
  const resolvedPath = path.isAbsolute(pathLike)
    ? path.resolve(pathLike)
    : path.resolve(repoRoot, pathLike);
  const normalizedRepoRoot = path.resolve(repoRoot);
  const normalizedResolvedPath = path.resolve(resolvedPath);
  const relativePath = path.relative(normalizedRepoRoot, normalizedResolvedPath);
  if (
    relativePath === '..'
    || relativePath.startsWith(`..${path.sep}`)
    || path.isAbsolute(relativePath)
  ) {
    throw new Error(
      `Workspace path ${normalizeWindowsPathForJson(normalizedResolvedPath)} escapes the GreebleFS repo root ${normalizeWindowsPathForJson(normalizedRepoRoot)}.`,
    );
  }
  return normalizedResolvedPath;
}

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      return null;
    }
    return await response.json() as T;
  } catch {
    return null;
  }
}

async function fetchJsonWithHeaders<T>(
  url: string,
  headers: Record<string, string>,
): Promise<T | null> {
  try {
    const response = await fetch(url, {
      headers,
    });
    if (!response.ok) {
      return null;
    }
    return await response.json() as T;
  } catch {
    return null;
  }
}

async function postJson<T>(
  url: string,
  payload: unknown,
  headers: Record<string, string> = {},
): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(payload ?? null),
  });
  const responseText = await response.text();
  let decoded: T | null = null;
  if (responseText.trim()) {
    decoded = JSON.parse(responseText) as T;
  }
  if (!response.ok) {
    const message = decoded && typeof decoded === 'object' && decoded !== null && 'error' in decoded
      ? String((decoded as { error?: unknown }).error ?? response.statusText)
      : response.statusText;
    throw new Error(message || `HTTP ${response.status}`);
  }
  return decoded as T;
}

function formatErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function findAvailableLocalPort(preferredPorts: number[]): Promise<number> {
  for (const preferredPort of preferredPorts) {
    const resolvedPort = await new Promise<number | null>((resolve) => {
      const server = net.createServer();
      server.unref();
      server.once('error', () => resolve(null));
      server.listen(preferredPort, '127.0.0.1', () => {
        const address = server.address();
        const port = address && typeof address === 'object' ? address.port : preferredPort;
        server.close(() => resolve(port));
      });
    });
    if (resolvedPort) {
      return resolvedPort;
    }
  }

  return new Promise<number>((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address !== 'object') {
        server.close(() => reject(new Error('Could not resolve a free localhost port for browser fallback.')));
        return;
      }
      const port = address.port;
      server.close(() => resolve(port));
    });
  });
}

function isSessionRunning(session: GreeblefsTauriDevSessionRecord | null): boolean {
  return Boolean(session?.running && session.pid && session.status !== 'exited' && session.status !== 'failed');
}

function isPublishedSessionNewerThanBaseline(
  publishedSession: GreeblefsTauriDevSessionRecord | null,
  baselineSession: GreeblefsTauriDevSessionRecord | null,
): boolean {
  if (!publishedSession) {
    return false;
  }
  if (!baselineSession) {
    return true;
  }

  if (publishedSession.pid && baselineSession.pid && publishedSession.pid !== baselineSession.pid) {
    return true;
  }

  if (publishedSession.startedAt && publishedSession.startedAt !== baselineSession.startedAt) {
    return true;
  }

  const publishedUpdatedAtUnixMs = parseIsoTimestampToUnixMs(publishedSession.updatedAt);
  const baselineUpdatedAtUnixMs = parseIsoTimestampToUnixMs(baselineSession.updatedAt);
  if (
    publishedUpdatedAtUnixMs !== null
    && baselineUpdatedAtUnixMs !== null
    && publishedUpdatedAtUnixMs > baselineUpdatedAtUnixMs
  ) {
    return true;
  }

  const publishedLastOutputAtUnixMs = parseIsoTimestampToUnixMs(publishedSession.lastOutputAt ?? null);
  const baselineLastOutputAtUnixMs = parseIsoTimestampToUnixMs(baselineSession.lastOutputAt ?? null);
  if (
    publishedLastOutputAtUnixMs !== null
    && baselineLastOutputAtUnixMs !== null
    && publishedLastOutputAtUnixMs > baselineLastOutputAtUnixMs
  ) {
    return true;
  }

  return !baselineSession.running && publishedSession.running;
}

export class GreeblefsAutomationRuntime {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private attachMode: 'native-cdp' | 'browser-dev-url' | null = null;
  private attachFingerprint = '';
  private lastAttachError: string | null = null;
  private startedChildPid: number | null = null;
  private launchedFallbackBrowserPid: number | null = null;
  private hostEventSubscriptions = new Map<string, HostEventSubscriptionRuntimeRecord>();

  getRepoRoot(): string {
    return repoRoot;
  }

  getTauriDevStatusPath(): string {
    return tauriDevStatusPath;
  }

  getTauronWebviewDiagnosticsPath(): string {
    return tauronWebviewDiagnosticsPath;
  }

  async readTauriDevSession(): Promise<GreeblefsTauriDevSessionRecord | null> {
    return readJsonFile<GreeblefsTauriDevSessionRecord>(tauriDevStatusPath);
  }

  async readTauronWebviewDiagnostics(
    session: GreeblefsTauriDevSessionRecord | null = null,
  ): Promise<TauronWebviewDiagnosticsSession | null> {
    const diagnosticsFilePath = session?.tauronWebviewDiagnosticsPath?.trim()
      || tauronWebviewDiagnosticsPath;
    return readJsonFile<TauronWebviewDiagnosticsSession>(diagnosticsFilePath);
  }

  async readNativeAutomationSession(
    session: GreeblefsTauriDevSessionRecord | null = null,
  ): Promise<GreeblefsNativeAutomationSessionRecord | null> {
    const sessionFilePath = session?.nativeAutomationFilePath?.trim()
      || nativeAutomationSessionPath;
    return readJsonFile<GreeblefsNativeAutomationSessionRecord>(sessionFilePath);
  }

  getHostEventsResourceUri(subscriptionId: string): string {
    return `host-events://subscription/${encodeURIComponent(subscriptionId)}`;
  }

  async isPidRunning(pid: number | null | undefined): Promise<boolean> {
    if (!pid || pid <= 0) {
      return false;
    }
    try {
      process.kill(pid, 0);
      return true;
    } catch {
      return false;
    }
  }

  private async readHealthyNativeAutomationSession(
    session: GreeblefsTauriDevSessionRecord | null = null,
  ): Promise<{
    sessionRecord: GreeblefsNativeAutomationSessionRecord | null;
    health: GreeblefsNativeAutomationHealth | null;
  }> {
    const sessionRecord = await this.readNativeAutomationSession(session);
    if (!sessionRecord?.healthUrl || !sessionRecord.authToken) {
      return {
        sessionRecord,
        health: null,
      };
    }
    const health = await fetchJsonWithHeaders<GreeblefsNativeAutomationHealth>(
      sessionRecord.healthUrl,
      {
        'x-greeblefs-dev-token': sessionRecord.authToken,
      },
    );
    return {
      sessionRecord,
      health,
    };
  }

  private async invokeNativeAutomationRpc<T>(
    method: string,
    payload?: unknown,
  ): Promise<T> {
    const tauriSession = await this.readTauriDevSession();
    const { sessionRecord, health } = await this.readHealthyNativeAutomationSession(tauriSession);
    if (!sessionRecord || !health?.ok) {
      throw new Error('The native dev automation lane is unavailable.');
    }
    const response = await postJson<NativeAutomationRpcEnvelope<T>>(
      sessionRecord.rpcUrl,
      {
        method,
        payload,
      },
      {
        'x-greeblefs-dev-token': sessionRecord.authToken,
      },
    );
    if (!response.ok) {
      throw new Error(response.error || `Native automation RPC failed for ${method}.`);
    }
    return response.result as T;
  }

  private async subscribeNativeHostEvents(
    request: Record<string, unknown>,
  ): Promise<GreeblefsHostEventsReadResult> {
    const tauriSession = await this.readTauriDevSession();
    const { sessionRecord, health } = await this.readHealthyNativeAutomationSession(tauriSession);
    if (!sessionRecord || !health?.ok) {
      throw new Error('Native host-event subscriptions require the native automation lane.');
    }
    return postJson<GreeblefsHostEventsReadResult>(
      sessionRecord.hostEventsSubscribeUrl,
      request,
      {
        'x-greeblefs-dev-token': sessionRecord.authToken,
      },
    );
  }

  private async readNativeHostEvents(
    subscriptionId: string,
    afterSequence?: number | null,
  ): Promise<GreeblefsHostEventsReadResult> {
    const tauriSession = await this.readTauriDevSession();
    const { sessionRecord, health } = await this.readHealthyNativeAutomationSession(tauriSession);
    if (!sessionRecord || !health?.ok) {
      throw new Error('The native dev automation lane is unavailable.');
    }
    const url = new URL(sessionRecord.hostEventsReadUrl);
    url.searchParams.set('subscriptionId', subscriptionId);
    if (typeof afterSequence === 'number' && Number.isFinite(afterSequence)) {
      url.searchParams.set('afterSequence', String(afterSequence));
    }
    const response = await fetchJsonWithHeaders<GreeblefsHostEventsReadResult>(
      url.toString(),
      {
        'x-greeblefs-dev-token': sessionRecord.authToken,
      },
    );
    if (!response) {
      throw new Error(`Failed to read native host-event subscription ${subscriptionId}.`);
    }
    return response;
  }

  private async unsubscribeNativeHostEvents(subscriptionId: string): Promise<unknown> {
    const tauriSession = await this.readTauriDevSession();
    const { sessionRecord, health } = await this.readHealthyNativeAutomationSession(tauriSession);
    if (!sessionRecord || !health?.ok) {
      throw new Error('The native dev automation lane is unavailable.');
    }
    return postJson<unknown>(
      sessionRecord.hostEventsUnsubscribeUrl,
      {
        subscriptionId,
      },
      {
        'x-greeblefs-dev-token': sessionRecord.authToken,
      },
    );
  }

  async getStatus(options: { includeAttachProbe?: boolean } = {}): Promise<GreeblefsAutomationStatus> {
    const session = await this.readTauriDevSession();
    const sessionFileExists = await pathExists(tauriDevStatusPath);
    const pidRunning = await this.isPidRunning(session?.pid);
    const nativeAutomationSessionFilePath = session?.nativeAutomationFilePath?.trim()
      || nativeAutomationSessionPath;
    const {
      sessionRecord: nativeAutomationSession,
      health: nativeAutomationHealth,
    } = await this.readHealthyNativeAutomationSession(session);
    const devUrl = session?.frontendDevUrl?.trim() || null;
    const devUrlReachable = devUrl ? await this.checkUrlReachable(devUrl) : false;
    const logTail = await this.readDevLogTail(80);
    const tauronWebviewDiagnostics = await this.readTauronWebviewDiagnostics(session);
    const resolvedDiagnosticsRemoteDebuggingPort = this.getRemoteDebuggingPortFromDiagnostics(
      tauronWebviewDiagnostics,
    );
    const resolvedWebviewDebugPort = session?.webviewDebugPort?.trim()
      || resolvedDiagnosticsRemoteDebuggingPort
      || null;
    const cdpVersionPayload = resolvedWebviewDebugPort
      ? await fetchJson<{ Browser?: string; ProtocolVersion?: string }>(
          `http://127.0.0.1:${resolvedWebviewDebugPort}/json/version`,
        )
      : null;
    let bridgeReady = false;
    let attachedPageUrl: string | null = null;
    let attachProbeDeferredReason: string | null = null;
    let reportedAttachError: string | null = this.lastAttachError;
    const recentLogActivity = this.getRecentLogActivity(logTail.lines);
    const shouldAttemptAttachProbe = options.includeAttachProbe
      ? this.shouldAttemptAttachProbe({
          cdpReachable: Boolean(cdpVersionPayload),
        })
      : false;
    if (options.includeAttachProbe && shouldAttemptAttachProbe) {
      try {
        const page = await this.ensureAppPage();
        await page.waitForFunction(() => Boolean((window as Window & {
          __GREEBLEFS_DEV_MCP__?: unknown;
        }).__GREEBLEFS_DEV_MCP__), undefined, { timeout: 5000 });
        bridgeReady = true;
        attachedPageUrl = page.url();
        this.lastAttachError = null;
        reportedAttachError = null;
      } catch (error) {
        this.lastAttachError = error instanceof Error ? error.message : String(error);
        reportedAttachError = this.lastAttachError;
      }
    } else if (options.includeAttachProbe) {
      attachProbeDeferredReason = this.buildAttachProbeDeferredReason({
        sessionFileExists,
        session,
        pidRunning,
        devUrlReachable,
        cdpReachable: Boolean(cdpVersionPayload),
        tauronWebviewDiagnostics,
        recentLogActivity,
      });
      reportedAttachError = null;
    } else if (this.page && !this.page.isClosed()) {
      attachedPageUrl = this.page.url();
      try {
        bridgeReady = await this.page.evaluate(() => Boolean((window as Window & {
          __GREEBLEFS_DEV_MCP__?: unknown;
        }).__GREEBLEFS_DEV_MCP__));
      } catch {
        bridgeReady = false;
      }
    }
    const startupState = this.deriveStartupState({
      sessionFileExists,
      session,
      pidRunning,
      devUrlReachable,
      cdpReachable: Boolean(cdpVersionPayload),
      bridgeReady,
      tauronWebviewDiagnostics,
      recentLogActivity,
    });

    return {
      repoRoot: normalizeWindowsPathForJson(repoRoot),
      statusFilePath: normalizeWindowsPathForJson(tauriDevStatusPath),
      logFilePath: normalizeWindowsPathForJson(tauriDevLogPath),
      nativeAutomationSessionFilePath: normalizeWindowsPathForJson(nativeAutomationSessionFilePath),
      tauronWebviewDiagnosticsFilePath: normalizeWindowsPathForJson(
        session?.tauronWebviewDiagnosticsPath?.trim() || tauronWebviewDiagnosticsPath,
      ),
      session,
      nativeAutomationSession,
      sessionFileExists,
      pidRunning,
      devUrlReachable,
      cdpReachable: Boolean(cdpVersionPayload),
      nativeAutomationReachable: Boolean(nativeAutomationHealth?.ok),
      cdpVersion: cdpVersionPayload?.Browser ?? cdpVersionPayload?.ProtocolVersion ?? null,
      tauronWebviewDiagnostics,
      attachMode: this.attachMode,
      attachedPageUrl,
      bridgeReady,
      startupPhase: startupState.phase,
      startupHint: startupState.hint,
      recentLogActivity,
      attachProbeDeferredReason,
      lastAttachError: reportedAttachError,
    };
  }

  async startTauriDev(): Promise<GreeblefsAutomationStatus> {
    const existingStatus = await this.getStatus();
    if (existingStatus.pidRunning && existingStatus.session?.running) {
      return existingStatus;
    }
    const baselineSession = existingStatus.session;

    const bunCommand = process.platform === 'win32' ? 'bun.exe' : 'bun';
    const child = spawn(bunCommand, ['run', 'tauri', 'dev'], {
      cwd: repoRoot,
      detached: true,
      stdio: 'ignore',
      shell: false,
    });
    child.unref();
    this.startedChildPid = child.pid ?? null;

    const startDeadline = Date.now() + 30_000;
    while (Date.now() < startDeadline) {
      const nextStatus = await this.getStatus();
      const publishedFreshSession = isPublishedSessionNewerThanBaseline(
        nextStatus.session,
        baselineSession,
      );
      if (
        nextStatus.pidRunning
        && nextStatus.session?.running
        && publishedFreshSession
      ) {
        return nextStatus;
      }
      await sleep(500);
    }

    return this.getStatus();
  }

  async stopTauriDev(): Promise<GreeblefsAutomationStatus> {
    const session = await this.readTauriDevSession();
    const pid = session?.pid ?? this.startedChildPid;
    if (!pid) {
      return this.getStatus();
    }

    if (process.platform === 'win32') {
      await new Promise<void>((resolve) => {
        const child = spawn('taskkill', ['/PID', String(pid), '/T', '/F'], {
          stdio: 'ignore',
          shell: false,
        });
        child.on('exit', () => resolve());
        child.on('error', () => resolve());
      });
    } else {
      try {
        process.kill(pid, 'SIGTERM');
      } catch {
        // Ignore kill failures. Status probing below is the truth source.
      }
    }

    await this.closeBrowser();
    const stopDeadline = Date.now() + 10_000;
    while (Date.now() < stopDeadline) {
      const running = await this.isPidRunning(pid);
      if (!running) {
        break;
      }
      await sleep(250);
    }
    return this.getStatus();
  }

  async readDevLogTail(limitLines = 200): Promise<{ logPath: string; lines: string[] }> {
    const logExists = await pathExists(tauriDevLogPath);
    if (!logExists) {
      return {
        logPath: normalizeWindowsPathForJson(tauriDevLogPath),
        lines: [],
      };
    }
    const raw = await fs.readFile(tauriDevLogPath, 'utf8');
    const lines = raw
      .replace(/\r\n/g, '\n')
      .split('\n')
      .filter(Boolean)
      .slice(-Math.max(1, limitLines));
    return {
      logPath: normalizeWindowsPathForJson(tauriDevLogPath),
      lines,
    };
  }

  async waitForReady(options: {
    timeoutMs?: number;
    requireBridge?: boolean;
    requireCdp?: boolean;
  } = {}): Promise<GreeblefsAutomationStatus> {
    const timeoutMs = options.timeoutMs ?? 45_000;
    const deadline = Date.now() + Math.max(1_000, timeoutMs);
    let lastStatus = await this.getStatus({
      includeAttachProbe: options.requireBridge !== false,
    });
    while (Date.now() < deadline) {
      const cdpReady = options.requireCdp === true ? lastStatus.cdpReachable : true;
      const bridgeReady = options.requireBridge === false ? true : lastStatus.bridgeReady;
      if (
        lastStatus.pidRunning
        && lastStatus.devUrlReachable
        && cdpReady
        && bridgeReady
      ) {
        return lastStatus;
      }
      await sleep(500);
      lastStatus = await this.getStatus({
        includeAttachProbe: options.requireBridge !== false,
      });
    }
    return lastStatus;
  }

  async attachApp(options: BrowserAttachmentOptions = {}): Promise<{
    attachMode: 'native-cdp' | 'browser-dev-url' | null;
    pageUrl: string;
    bridgeReady: boolean;
  }> {
    const page = await this.ensureAppPage(options);
    let bridgeReady = false;
    try {
      await this.waitForBridgeReady(page);
      bridgeReady = true;
    } catch {
      bridgeReady = false;
    }
    return {
      attachMode: this.attachMode,
      pageUrl: page.url(),
      bridgeReady,
    };
  }

  async ensureAppPage(options: BrowserAttachmentOptions = {}): Promise<Page> {
    const session = await this.readTauriDevSession();
    const tauronWebviewDiagnostics = await this.readTauronWebviewDiagnostics(session);
    let nativeWindowMetadata: GreeblefsNativeAutomationWindowRecord[] = [];
    try {
      nativeWindowMetadata = await this.getNativeWindowMetadata();
    } catch {
      nativeWindowMetadata = [];
    }
    const resolvedWebviewDebugPort = session?.webviewDebugPort?.trim()
      || this.getRemoteDebuggingPortFromDiagnostics(tauronWebviewDiagnostics)
      || null;
    const sessionFingerprint = [
      session?.pid ?? 'none',
      resolvedWebviewDebugPort ?? 'none',
      session?.frontendDevUrl ?? 'none',
      options.windowLabel ?? 'default-window',
      options.secondaryWindowKind ?? 'default-kind',
    ].join(':');
    const preferNative = options.preferNative !== false;
    const allowFallbackBrowser = options.allowFallbackBrowser !== false;

    if (
      this.page
      && !this.page.isClosed()
      && this.browser
      && this.attachFingerprint === sessionFingerprint
    ) {
      return this.page;
    }

    await this.closeBrowser();

    if (preferNative && resolvedWebviewDebugPort) {
      try {
        const cdpEndpoint = `http://127.0.0.1:${resolvedWebviewDebugPort}`;
        this.browser = await chromium.connectOverCDP(cdpEndpoint);
        this.page = await this.resolveBrowserPage(this.browser, {
          expectedUrl: session?.frontendDevUrl ?? undefined,
          windowLabel: options.windowLabel,
          secondaryWindowKind: options.secondaryWindowKind,
          nativeWindows: nativeWindowMetadata,
          tauronWebviewDiagnostics,
        });
        this.attachMode = 'native-cdp';
        this.attachFingerprint = sessionFingerprint;
        this.lastAttachError = null;
        await this.waitForBridgeReady(this.page);
        return this.page;
      } catch (error) {
        this.lastAttachError = error instanceof Error ? error.message : String(error);
        await this.closeBrowser();
      }
    }

    if (!allowFallbackBrowser) {
      throw new Error(
        this.lastAttachError || 'Native WebView attach failed and browser fallback is disabled.',
      );
    }

    const frontendDevUrl = session?.frontendDevUrl?.trim();
    if (!frontendDevUrl) {
      throw new Error(
        this.lastAttachError || 'No frontend dev URL was published by the Tauri dev launcher.',
      );
    }

    const fallbackAttachment = await this.attachFallbackBrowserPage(
      frontendDevUrl,
      options,
      nativeWindowMetadata,
      tauronWebviewDiagnostics,
    );
    this.browser = fallbackAttachment.browser;
    this.page = fallbackAttachment.page;
    this.attachMode = 'browser-dev-url';
    this.attachFingerprint = sessionFingerprint;
    try {
      await this.waitForBridgeReady(this.page);
    } catch {
      // The fallback browser does not have Tauri, so bridge readiness is best-effort only.
    }
    return this.page;
  }

  private getRemoteDebuggingPortFromDiagnostics(
    diagnostics: TauronWebviewDiagnosticsSession | null,
  ): string | null {
    const webviews = diagnostics?.webviews && typeof diagnostics.webviews === 'object'
      ? Object.values(diagnostics.webviews)
      : [];
    for (const webview of webviews) {
      if (typeof webview?.remoteDebuggingPort === 'number' && Number.isFinite(webview.remoteDebuggingPort)) {
        return String(webview.remoteDebuggingPort);
      }
    }
    return null;
  }

  private shouldAttemptAttachProbe(options: { cdpReachable: boolean }): boolean {
    if (this.page && !this.page.isClosed()) {
      return true;
    }
    return options.cdpReachable;
  }

  private deriveStartupState(input: {
    sessionFileExists: boolean;
    session: GreeblefsTauriDevSessionRecord | null;
    pidRunning: boolean;
    devUrlReachable: boolean;
    cdpReachable: boolean;
    bridgeReady: boolean;
    tauronWebviewDiagnostics: TauronWebviewDiagnosticsSession | null;
    recentLogActivity: string | null;
  }): { phase: GreeblefsAutomationStartupPhase; hint: string | null } {
    const {
      sessionFileExists,
      session,
      pidRunning,
      devUrlReachable,
      cdpReachable,
      bridgeReady,
      tauronWebviewDiagnostics,
      recentLogActivity,
    } = input;
    const frameworkLastError = tauronWebviewDiagnostics?.lastError?.trim() || null;
    const webviewRecords = tauronWebviewDiagnostics?.webviews && typeof tauronWebviewDiagnostics.webviews === 'object'
      ? Object.values(tauronWebviewDiagnostics.webviews)
      : [];
    const hasCreatedWebview = webviewRecords.some((record) => record?.status === 'created');
    const hasLaunchingWebview = webviewRecords.some((record) => record?.status === 'launching');

    if (!sessionFileExists || !session) {
      return {
        phase: 'not-started',
        hint: 'No tauri dev session file has been published yet.',
      };
    }

    if (session.status === 'failed') {
      return {
        phase: 'failed',
        hint: session.error?.trim() || frameworkLastError || 'The tauri dev launcher reported a failure.',
      };
    }

    if (!pidRunning && (session.status === 'exited' || session.status === 'terminated')) {
      return {
        phase: 'exited',
        hint: frameworkLastError || `The tauri dev process is no longer running (status=${session.status}).`,
      };
    }

    if (bridgeReady) {
      return {
        phase: 'bridge-ready',
        hint: 'The real app page is attached and the in-app automation bridge is live.',
      };
    }

    if (cdpReachable) {
      return {
        phase: 'cdp-ready',
        hint: 'The WebView2 CDP endpoint is reachable and ready for browser attachment.',
      };
    }

    if (hasCreatedWebview || tauronWebviewDiagnostics?.lastEvent === 'webview-create-success') {
      return {
        phase: 'webview-created',
        hint: 'The desktop WebView exists, but the CDP endpoint is not reachable yet.',
      };
    }

    if (hasLaunchingWebview || tauronWebviewDiagnostics?.lastEvent === 'webview-create-start') {
      return {
        phase: 'webview-launching',
        hint: 'Tauron has started creating the first desktop WebView.',
      };
    }

    if (tauronWebviewDiagnostics?.lastEvent === 'runtime-initialized') {
      return {
        phase: 'runtime-initialized',
        hint: 'The tauron runtime initialized before the first desktop WebView was created.',
      };
    }

    if (recentLogActivity === 'cargo-compiling') {
      return {
        phase: 'cargo-compiling',
        hint: 'Cargo is still compiling the desktop app, so no real window exists yet.',
      };
    }

    if (devUrlReachable) {
      return {
        phase: 'frontend-dev-server-ready',
        hint: 'The frontend dev server is up, but the desktop runtime has not published a WebView session yet.',
      };
    }

    if (pidRunning) {
      return {
        phase: 'launching',
        hint: 'The tauri dev process is running, but the frontend and desktop runtime are still starting.',
      };
    }

    return {
      phase: 'not-started',
      hint: 'The tauri dev session is not active.',
    };
  }

  private buildAttachProbeDeferredReason(input: {
    sessionFileExists: boolean;
    session: GreeblefsTauriDevSessionRecord | null;
    pidRunning: boolean;
    devUrlReachable: boolean;
    cdpReachable: boolean;
    tauronWebviewDiagnostics: TauronWebviewDiagnosticsSession | null;
    recentLogActivity: string | null;
  }): string {
    const startupState = this.deriveStartupState({
      ...input,
      bridgeReady: false,
    });
    return `Attach probing was deferred while startupPhase=${startupState.phase}: ${startupState.hint ?? 'the app is not ready for a reliable attach attempt yet.'}`;
  }

  private getRecentLogActivity(lines: string[]): string | null {
    for (let index = lines.length - 1; index >= 0; index -= 1) {
      const normalizedLine = stripAnsiControlSequences(lines[index] ?? '').trim();
      if (!normalizedLine) {
        continue;
      }
      if (/\bCompiling\b|\bBuilding\b/.test(normalizedLine)) {
        return 'cargo-compiling';
      }
      if (/tauron\.webview2\./.test(normalizedLine)) {
        return 'tauron-webview2-runtime';
      }
      if (/Running DevCommand/i.test(normalizedLine) || /cargo run /i.test(normalizedLine)) {
        return 'desktop-dev-command-running';
      }
      if (/Local:\s+http/i.test(normalizedLine) || /http:\/\/localhost:1420/i.test(normalizedLine)) {
        return 'frontend-dev-server-ready';
      }
      if (/Finished `dev` profile/i.test(normalizedLine) || /greeblefs\.exe/i.test(normalizedLine)) {
        return 'desktop-binary-launching';
      }
      if (/error[:\]]/i.test(normalizedLine)) {
        return 'error';
      }
    }
    return null;
  }

  async getBridgeSnapshot(options: Record<string, unknown> = {}): Promise<unknown> {
    return this.invokeBridgeMethod('getSnapshot', options);
  }

  async getBridgeStatus(): Promise<unknown> {
    return this.invokeBridgeMethod('getStatus');
  }

  async getConsoleEntries(limit = 120): Promise<unknown> {
    return this.invokeBridgeMethod('getConsoleEntries', { limit });
  }

  async clearConsoleEntries(): Promise<unknown> {
    return this.invokeBridgeMethod('clearConsoleEntries');
  }

  async getHostApiSchema(): Promise<unknown> {
    try {
      return await this.invokeNativeAutomationRpc('host.get_api_schema');
    } catch {
      return this.invokeBridgeMethod('getHostApiSchema');
    }
  }

  async getTelemetryStatus(): Promise<unknown> {
    try {
      return await this.invokeNativeAutomationRpc('telemetry.get_status');
    } catch {
      return this.invokeBridgeMethod('getTelemetryStatus');
    }
  }

  async getTelemetryRecords(limit = 60): Promise<unknown> {
    try {
      return await this.invokeNativeAutomationRpc('telemetry.get_recent_records', { limit });
    } catch {
      return this.invokeBridgeMethod('getTelemetryRecords', { limit });
    }
  }

  async getUsrProfileSnapshot(): Promise<unknown> {
    try {
      return await this.invokeNativeAutomationRpc('usr_profiles.get_runtime_snapshot');
    } catch {
      return this.invokeBridgeMethod('getUsrProfileSnapshot');
    }
  }

  async getPerformanceSnapshot(): Promise<unknown> {
    return this.invokeBridgeMethod('getPerformanceSnapshot');
  }

  async listVisibleActions(options: { includeUnnamed?: boolean } = {}): Promise<unknown[]> {
    const snapshot = await this.getBridgeSnapshot({
      includeDom: true,
      includeThemeVariables: false,
      includeTelemetryRecords: false,
      consoleLimit: 25,
    }) as {
      domNodes?: Array<Record<string, unknown>>;
    };
    const domNodes = Array.isArray(snapshot?.domNodes) ? snapshot.domNodes : [];
    return domNodes.filter((node) => {
      const actionId = typeof node.actionId === 'string' ? node.actionId : '';
      const agentId = typeof node.agentId === 'string' ? node.agentId : '';
      const accessibleName = typeof node.accessibleName === 'string' ? node.accessibleName : '';
      if (actionId || agentId) {
        return true;
      }
      return options.includeUnnamed === true && Boolean(accessibleName);
    });
  }

  async readWorkspaceText(pathLike: string): Promise<{ requestedPath: string; resolvedPath: string; content: string }> {
    const resolvedPath = resolvePathInsideRepo(pathLike);
    const content = await fs.readFile(resolvedPath, 'utf8');
    return {
      requestedPath: pathLike,
      resolvedPath: normalizeWindowsPathForJson(resolvedPath),
      content,
    };
  }

  async writeWorkspaceText(pathLike: string, content: string): Promise<{ requestedPath: string; resolvedPath: string; bytesWritten: number }> {
    const resolvedPath = resolvePathInsideRepo(pathLike);
    await fs.mkdir(path.dirname(resolvedPath), { recursive: true });
    await fs.writeFile(resolvedPath, content, 'utf8');
    return {
      requestedPath: pathLike,
      resolvedPath: normalizeWindowsPathForJson(resolvedPath),
      bytesWritten: Buffer.byteLength(content, 'utf8'),
    };
  }

  async listWorkspaceDirectory(pathLike = '.'): Promise<{
    requestedPath: string;
    resolvedPath: string;
    entries: GreeblefsWorkspaceDirectoryEntry[];
  }> {
    const resolvedPath = resolvePathInsideRepo(pathLike);
    const directoryEntries = await fs.readdir(resolvedPath, { withFileTypes: true });
    const entries = await Promise.all(
      directoryEntries.map(async (entry) => {
        const absolutePath = path.join(resolvedPath, entry.name);
        const metadata = await fs.stat(absolutePath);
        return {
          name: entry.name,
          absolutePath: normalizeWindowsPathForJson(absolutePath),
          relativePath: normalizeWindowsPathForJson(path.relative(repoRoot, absolutePath) || '.'),
          isDirectory: metadata.isDirectory(),
          size: metadata.size,
          modifiedAt: Number.isFinite(metadata.mtimeMs) ? new Date(metadata.mtimeMs).toISOString() : null,
        } satisfies GreeblefsWorkspaceDirectoryEntry;
      }),
    );
    entries.sort((left, right) => {
      if (left.isDirectory !== right.isDirectory) {
        return left.isDirectory ? -1 : 1;
      }
      return left.name.localeCompare(right.name);
    });
    return {
      requestedPath: pathLike,
      resolvedPath: normalizeWindowsPathForJson(resolvedPath),
      entries,
    };
  }

  async statWorkspacePath(pathLike: string): Promise<GreeblefsWorkspaceStatResult> {
    const resolvedPath = resolvePathInsideRepo(pathLike);
    try {
      const metadata = await fs.stat(resolvedPath);
      return {
        requestedPath: pathLike,
        resolvedPath: normalizeWindowsPathForJson(resolvedPath),
        exists: true,
        isDirectory: metadata.isDirectory(),
        size: metadata.size,
        modifiedAt: Number.isFinite(metadata.mtimeMs) ? new Date(metadata.mtimeMs).toISOString() : null,
      };
    } catch {
      return {
        requestedPath: pathLike,
        resolvedPath: normalizeWindowsPathForJson(resolvedPath),
        exists: false,
        isDirectory: false,
        size: 0,
        modifiedAt: null,
      };
    }
  }

  async deleteWorkspacePath(pathLike: string): Promise<{ requestedPath: string; resolvedPath: string; deleted: boolean }> {
    const resolvedPath = resolvePathInsideRepo(pathLike);
    await fs.rm(resolvedPath, {
      recursive: true,
      force: false,
    });
    return {
      requestedPath: pathLike,
      resolvedPath: normalizeWindowsPathForJson(resolvedPath),
      deleted: true,
    };
  }

  async runWorkspaceCommand(command: string, options: { cwd?: string } = {}): Promise<GreeblefsWorkspaceCommandResult> {
    const cwd = options.cwd ? resolvePathInsideRepo(options.cwd) : repoRoot;
    const shellCommand = process.platform === 'win32' ? 'powershell.exe' : '/bin/sh';
    const shellArgs = process.platform === 'win32'
      ? ['-NoProfile', '-Command', command]
      : ['-lc', command];
    return new Promise((resolve, reject) => {
      const child = spawn(shellCommand, shellArgs, {
        cwd,
        env: process.env,
        shell: false,
      });
      const stdoutChunks: Buffer[] = [];
      const stderrChunks: Buffer[] = [];
      child.stdout?.on('data', (chunk) => {
        stdoutChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      });
      child.stderr?.on('data', (chunk) => {
        stderrChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      });
      child.on('error', reject);
      child.on('exit', (code) => {
        resolve({
          command,
          cwd: normalizeWindowsPathForJson(cwd),
          exitCode: code ?? 0,
          stdout: Buffer.concat(stdoutChunks).toString('utf8'),
          stderr: Buffer.concat(stderrChunks).toString('utf8'),
        });
      });
    });
  }

  async listNativeWindows(processName = 'greeblefs'): Promise<WindowsDesktopWindowRecord[]> {
    return listWindowsDesktopWindows(processName);
  }

  async getNativeWindowMetadata(): Promise<GreeblefsNativeAutomationWindowRecord[]> {
    return this.invokeNativeAutomationRpc<GreeblefsNativeAutomationWindowRecord[]>('windows.get_metadata');
  }

  async captureNativeWindowScreenshot(options: {
    processName?: string;
    handle?: string;
    processId?: number;
    titleContains?: string;
    pathHint?: string;
    includeImageData?: boolean;
  } = {}): Promise<GreeblefsNativeWindowScreenshotResult> {
    await fs.mkdir(screenshotDirectory, { recursive: true });
    const fileStem = (options.pathHint?.trim() || `greeblefs-native-window-${Date.now()}`)
      .replace(/[^a-z0-9._-]+/gi, '-')
      .replace(/^-+|-+$/g, '')
      || `greeblefs-native-window-${Date.now()}`;
    const imagePath = path.join(screenshotDirectory, `${fileStem}.png`);
    const screenshotRecord = await captureWindowsDesktopWindowScreenshot({
      processName: options.processName,
      handle: options.handle,
      processId: options.processId,
      titleContains: options.titleContains,
      imagePath,
    });
    return {
      imagePath: normalizeWindowsPathForJson(imagePath),
      base64Png: options.includeImageData === true
        ? (await fs.readFile(imagePath)).toString('base64')
        : null,
      window: {
        processId: screenshotRecord.processId,
        processName: screenshotRecord.processName,
        title: screenshotRecord.title,
        handle: screenshotRecord.handle,
        startTime: screenshotRecord.startTime,
        bounds: screenshotRecord.bounds,
      },
    };
  }

  async callHostMethod(
    methodId: string,
    payload?: unknown,
    options: { executionContext?: unknown } = {},
  ): Promise<unknown> {
    try {
      return await this.invokeNativeAutomationRpc('host.call', {
        methodId,
        payload,
        executionContext: options.executionContext,
      });
    } catch (nativeError) {
      if (typeof options.executionContext !== 'undefined') {
        throw nativeError;
      }
      return this.invokeBridgeMethod('callHostMethod', { methodId, payload });
    }
  }

  async getHostEventsSnapshot(request: Record<string, unknown>): Promise<unknown> {
    try {
      return await this.invokeNativeAutomationRpc('host.events.get_snapshot', request);
    } catch {
      return this.invokeBridgeMethod('getHostEventsSnapshot', { request });
    }
  }

  async captureScreenshot(options: {
    fullPage?: boolean;
    pathHint?: string;
    includeImageData?: boolean;
  } = {}): Promise<{
    imagePath: string;
    base64Png?: string | null;
    attachMode: 'native-cdp' | 'browser-dev-url' | null;
    pageUrl: string;
  }> {
    const page = await this.ensureAppPage();
    await fs.mkdir(screenshotDirectory, { recursive: true });
    const fileStem = (options.pathHint?.trim() || `greeblefs-ui-${Date.now()}`)
      .replace(/[^a-z0-9._-]+/gi, '-')
      .replace(/^-+|-+$/g, '')
      || `greeblefs-ui-${Date.now()}`;
    const targetPath = path.join(screenshotDirectory, `${fileStem}.png`);
    await page.screenshot({
      fullPage: options.fullPage === true,
      path: targetPath,
      type: 'png',
    });
    return {
      imagePath: normalizeWindowsPathForJson(targetPath),
      base64Png: options.includeImageData === true
        ? (await fs.readFile(targetPath)).toString('base64')
        : null,
      attachMode: this.attachMode,
      pageUrl: page.url(),
    };
  }

  async subscribeHostEvents(
    request: Record<string, unknown>,
    options: {
      onUpdate?: (state: GreeblefsHostEventsReadResult) => void;
    } = {},
  ): Promise<{
    subscriptionId: string;
    resourceUri: string;
    state: GreeblefsHostEventsReadResult;
  }> {
    const initialState = await this.subscribeNativeHostEvents(request);
    const subscriptionId = initialState.subscription.subscriptionId;
    const resourceUri = this.getHostEventsResourceUri(subscriptionId);
    const listeners = new Set<(state: GreeblefsHostEventsReadResult) => void>();
    if (options.onUpdate) {
      listeners.add(options.onUpdate);
    }
    const record: HostEventSubscriptionRuntimeRecord = {
      subscriptionId,
      request,
      resourceUri,
      latestState: initialState,
      latestSequence: initialState.subscription.latestSequence ?? null,
      listeners,
      disposed: false,
      pollTimer: null,
    };
    this.hostEventSubscriptions.set(subscriptionId, record);
    this.scheduleHostEventPoll(subscriptionId, true);
    return {
      subscriptionId,
      resourceUri,
      state: initialState,
    };
  }

  async readHostEventSubscription(
    subscriptionId: string,
    afterSequence?: number | null,
  ): Promise<GreeblefsHostEventsReadResult> {
    if (typeof afterSequence === 'number' && Number.isFinite(afterSequence)) {
      return this.readNativeHostEvents(subscriptionId, afterSequence);
    }
    const cached = this.hostEventSubscriptions.get(subscriptionId);
    if (cached) {
      return cached.latestState;
    }
    return this.readNativeHostEvents(subscriptionId, null);
  }

  async unsubscribeHostEvents(subscriptionId: string): Promise<unknown> {
    const record = this.hostEventSubscriptions.get(subscriptionId);
    if (record?.pollTimer) {
      clearTimeout(record.pollTimer);
    }
    if (record) {
      record.disposed = true;
      this.hostEventSubscriptions.delete(subscriptionId);
    }
    return this.unsubscribeNativeHostEvents(subscriptionId);
  }

  async getAccessibilitySnapshot(): Promise<unknown> {
    const page = await this.ensureAppPage();
    return page.locator('body').ariaSnapshot();
  }

  async click(target: GreeblefsUiTarget, options: { button?: 'left' | 'right' | 'middle'; timeoutMs?: number } = {}): Promise<{ pageUrl: string }> {
    const locator = await this.resolveLocator(target, options.timeoutMs);
    await locator.click({
      button: options.button ?? 'left',
      timeout: options.timeoutMs ?? 15_000,
    });
    return {
      pageUrl: locator.page().url(),
    };
  }

  async hover(target: GreeblefsUiTarget, timeoutMs = 15_000): Promise<{ pageUrl: string }> {
    const locator = await this.resolveLocator(target, timeoutMs);
    await locator.hover({ timeout: timeoutMs });
    return {
      pageUrl: locator.page().url(),
    };
  }

  async typeText(target: GreeblefsUiTarget, text: string, options: { clear?: boolean; pressEnter?: boolean; timeoutMs?: number } = {}): Promise<{ value: string }> {
    const locator = await this.resolveLocator(target, options.timeoutMs);
    if (options.clear !== false) {
      await locator.fill('', { timeout: options.timeoutMs ?? 15_000 });
    }
    await locator.fill(text, { timeout: options.timeoutMs ?? 15_000 });
    if (options.pressEnter) {
      await locator.press('Enter', { timeout: options.timeoutMs ?? 15_000 });
    }
    const value = await locator.inputValue().catch(() => text);
    return { value };
  }

  async pressKey(key: string): Promise<{ key: string }> {
    const page = await this.ensureAppPage();
    await page.keyboard.press(key);
    return { key };
  }

  async selectOption(target: GreeblefsUiTarget, option: string): Promise<{ option: string }> {
    const locator = await this.resolveLocator(target, 15_000);
    await locator.selectOption(option);
    return { option };
  }

  async drag(source: GreeblefsUiTarget, target: GreeblefsUiTarget): Promise<{ ok: true }> {
    const page = await this.ensureAppPage();
    const sourceLocator = await this.resolveLocator(source, 15_000);
    const targetLocator = await this.resolveLocator(target, 15_000);
    const sourceBox = await sourceLocator.boundingBox();
    const targetBox = await targetLocator.boundingBox();
    if (!sourceBox || !targetBox) {
      throw new Error('Could not resolve drag bounds for the requested source or target element.');
    }
    await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, {
      steps: 12,
    });
    await page.mouse.up();
    return { ok: true };
  }

  async evaluateInApp(script: string, argument?: unknown): Promise<unknown> {
    const page = await this.ensureAppPage();
    return page.evaluate(
      ({ source, arg }) => {
        const fn = new Function('arg', source);
        return fn(arg);
      },
      {
        source: script,
        arg: argument,
      },
    );
  }

  async close(): Promise<void> {
    await this.closeHostEventSubscriptions();
    await this.closeBrowser();
  }

  private async checkUrlReachable(url: string): Promise<boolean> {
    try {
      const response = await fetch(url);
      return response.ok;
    } catch {
      return false;
    }
  }

  private async waitForBridgeReady(page: Page): Promise<void> {
    await page.waitForLoadState('domcontentloaded', { timeout: 15_000 });
    await page.waitForFunction(
      () => Boolean((window as Window & { __GREEBLEFS_DEV_MCP__?: unknown }).__GREEBLEFS_DEV_MCP__),
      undefined,
      { timeout: 15_000 },
    );
  }

  private async attachFallbackBrowserPage(
    frontendDevUrl: string,
    options: BrowserAttachmentOptions,
    nativeWindows: GreeblefsNativeAutomationWindowRecord[],
    tauronWebviewDiagnostics: TauronWebviewDiagnosticsSession | null,
  ): Promise<{ browser: Browser; page: Page }> {
    const systemBrowserErrors: string[] = [];

    try {
      return await this.launchSystemBrowserAndConnect(
        frontendDevUrl,
        options,
        nativeWindows,
        tauronWebviewDiagnostics,
      );
    } catch (error) {
      systemBrowserErrors.push(formatErrorMessage(error));
    }

    const browser = await this.launchFallbackBrowser();
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(frontendDevUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    return { browser, page };
  }

  private async launchFallbackBrowser(): Promise<Browser> {
    const launchErrors: string[] = [];
    for (const channel of preferredPlaywrightLaunchChannels) {
      try {
        return await chromium.launch({
          channel,
          headless: true,
        });
      } catch (error) {
        launchErrors.push(`channel ${channel}: ${formatErrorMessage(error)}`);
      }
    }

    try {
      return await chromium.launch({ headless: true });
    } catch (error) {
      launchErrors.push(`bundled playwright browser: ${formatErrorMessage(error)}`);
    }

    throw new Error(
      `Unable to launch a Playwright fallback browser. Tried ${preferredPlaywrightLaunchChannels.join(', ') || 'no explicit channels'} and the bundled Playwright browser.\n${launchErrors.join('\n')}`,
    );
  }

  private async launchSystemBrowserAndConnect(
    frontendDevUrl: string,
    options: BrowserAttachmentOptions,
    nativeWindows: GreeblefsNativeAutomationWindowRecord[],
    tauronWebviewDiagnostics: TauronWebviewDiagnosticsSession | null,
  ): Promise<{ browser: Browser; page: Page }> {
    if (preferredFallbackBrowserExecutables.length === 0) {
      throw new Error('No installed Chrome/Edge executable candidate was configured for browser fallback.');
    }

    const executablePath = await this.resolveSystemBrowserExecutable();
    const debugPort = await findAvailableLocalPort([9333, 9334, 9335, 19333]);
    const browserUserDataDirectory = path.join(fallbackBrowserProfileDirectory, `port-${debugPort}`);
    await fs.mkdir(browserUserDataDirectory, { recursive: true });

    const browserProcess = spawn(
      executablePath,
      [
        '--headless=new',
        '--disable-gpu',
        '--no-first-run',
        '--no-default-browser-check',
        '--remote-allow-origins=*',
        `--remote-debugging-port=${debugPort}`,
        `--user-data-dir=${browserUserDataDirectory}`,
        frontendDevUrl,
      ],
      {
        cwd: repoRoot,
        detached: true,
        shell: false,
        stdio: 'ignore',
      },
    );
    browserProcess.unref();
    this.launchedFallbackBrowserPid = browserProcess.pid ?? null;

    const cdpEndpoint = `http://127.0.0.1:${debugPort}`;
    const readyDeadline = Date.now() + 15_000;
    while (Date.now() < readyDeadline) {
      const versionPayload = await fetchJson<{ Browser?: string }>(`${cdpEndpoint}/json/version`);
      if (versionPayload?.Browser) {
        const browser = await chromium.connectOverCDP(cdpEndpoint);
        const page = await this.resolveBrowserPage(browser, {
          expectedUrl: frontendDevUrl,
          windowLabel: options.windowLabel,
          secondaryWindowKind: options.secondaryWindowKind,
          nativeWindows,
          tauronWebviewDiagnostics,
        });
        return { browser, page };
      }
      await sleep(250);
    }

    throw new Error(
      `Installed browser fallback did not expose a CDP endpoint at ${cdpEndpoint} after launch from ${normalizeWindowsPathForJson(executablePath)}.`,
    );
  }

  private async resolveSystemBrowserExecutable(): Promise<string> {
    for (const executablePath of preferredFallbackBrowserExecutables) {
      if (await pathExists(executablePath)) {
        return executablePath;
      }
    }
    throw new Error(
      `Could not find an installed Chrome/Edge executable for browser fallback. Checked: ${preferredFallbackBrowserExecutables.join(', ')}`,
    );
  }

  private async resolveBrowserPage(browser: Browser, options: {
    expectedUrl?: string;
    windowLabel?: string;
    secondaryWindowKind?: string;
    nativeWindows?: GreeblefsNativeAutomationWindowRecord[];
    tauronWebviewDiagnostics?: TauronWebviewDiagnosticsSession | null;
  } = {}): Promise<Page> {
    const deadline = Date.now() + 15_000;
    const expectedUrl = options.expectedUrl;
    const requestedWindow = options.nativeWindows?.find((windowRecord) => {
      if (options.windowLabel && windowRecord.windowLabel !== options.windowLabel) {
        return false;
      }
      if (options.secondaryWindowKind && windowRecord.secondaryWindowKind !== options.secondaryWindowKind) {
        return false;
      }
      return true;
    }) ?? null;
    const diagnosticsRecords = options.tauronWebviewDiagnostics?.webviews
      ? Object.values(options.tauronWebviewDiagnostics.webviews)
      : [];
    const requestedDiagnosticsRecord = diagnosticsRecords.find((record) => {
      if (options.windowLabel && record?.label !== options.windowLabel) {
        return false;
      }
      return true;
    }) ?? null;

    while (Date.now() < deadline) {
      const allPages = browser.contexts().flatMap((context) => context.pages());
      const candidatePages = allPages.filter((page) => {
        const pageUrl = page.url();
        return Boolean(pageUrl) && !pageUrl.startsWith('devtools://');
      });
      const scoredCandidates = await Promise.all(candidatePages.map(async (page) => {
        const pageUrl = page.url();
        let title = '';
        try {
          title = await page.title();
        } catch {
          title = '';
        }
        let score = 0;
        if (expectedUrl && pageUrl.startsWith(expectedUrl)) {
          score += 40;
        } else if (pageUrl.startsWith('http://localhost:1420') || pageUrl.startsWith('http://127.0.0.1:1420')) {
          score += 10;
        }
        if (requestedWindow) {
          if (title && title === requestedWindow.title) {
            score += 80;
          } else if (
            title
            && requestedWindow.title
            && (title.includes(requestedWindow.title) || requestedWindow.title.includes(title))
          ) {
            score += 45;
          }
        }
        if (requestedDiagnosticsRecord?.url && pageUrl === requestedDiagnosticsRecord.url) {
          score += 55;
        } else if (requestedDiagnosticsRecord?.url && pageUrl.startsWith(requestedDiagnosticsRecord.url)) {
          score += 35;
        }
        return {
          page,
          pageUrl,
          title,
          score,
        };
      }));
      scoredCandidates.sort((left, right) => right.score - left.score);
      const winningCandidate = scoredCandidates[0];
      if (winningCandidate && winningCandidate.score > 0) {
        return winningCandidate.page;
      }
      const directExpectedUrlMatch = candidatePages.find((page) => {
        const pageUrl = page.url();
        return expectedUrl
          ? pageUrl.startsWith(expectedUrl)
          : pageUrl.startsWith('http://localhost:1420') || pageUrl.startsWith('http://127.0.0.1:1420');
      });
      if (directExpectedUrlMatch) {
        return directExpectedUrlMatch;
      }
      if (candidatePages.length === 1) {
        return candidatePages[0];
      }
      if (
        candidatePages.length > 0
        && !options.windowLabel
        && !options.secondaryWindowKind
      ) {
        return candidatePages[0];
      }
      await sleep(250);
    }

    throw new Error('Connected to the browser, but no app page target was discovered.');
  }

  private async invokeBridgeMethod(method: string, args?: Record<string, unknown>): Promise<unknown> {
    const page = await this.ensureAppPage();
    return page.evaluate(
      async ({ selectedMethod, selectedArgs }) => {
        const bridge = (window as Window & {
          __GREEBLEFS_DEV_MCP__?: {
            getStatus?: () => Promise<unknown>;
            getSnapshot?: (options?: Record<string, unknown>) => Promise<unknown>;
            getConsoleEntries?: (limit?: number) => unknown;
            clearConsoleEntries?: () => void;
            getHostApiSchema?: () => Promise<unknown>;
            getTelemetryStatus?: () => Promise<unknown>;
            getTelemetryRecords?: (limit?: number) => Promise<unknown>;
            getUsrProfileSnapshot?: () => unknown;
            getPerformanceSnapshot?: () => unknown;
            callHostMethod?: (methodId: string, payload?: unknown) => Promise<unknown>;
            getHostEventsSnapshot?: (request: Record<string, unknown>) => Promise<unknown>;
          };
        }).__GREEBLEFS_DEV_MCP__;
        if (!bridge) {
          throw new Error('The GreebleFS dev MCP bridge is not installed in the current window.');
        }
        switch (selectedMethod) {
          case 'getStatus':
            return bridge.getStatus?.();
          case 'getSnapshot':
            return bridge.getSnapshot?.(selectedArgs);
          case 'getConsoleEntries':
            return bridge.getConsoleEntries?.(Number(selectedArgs?.limit ?? 120));
          case 'clearConsoleEntries':
            bridge.clearConsoleEntries?.();
            return { ok: true };
          case 'getHostApiSchema':
            return bridge.getHostApiSchema?.();
          case 'getTelemetryStatus':
            return bridge.getTelemetryStatus?.();
          case 'getTelemetryRecords':
            return bridge.getTelemetryRecords?.(Number(selectedArgs?.limit ?? 60));
          case 'getUsrProfileSnapshot':
            return bridge.getUsrProfileSnapshot?.();
          case 'getPerformanceSnapshot':
            return bridge.getPerformanceSnapshot?.();
          case 'callHostMethod':
            if (!selectedArgs?.methodId || typeof selectedArgs.methodId !== 'string') {
              throw new Error('callHostMethod requires a string methodId.');
            }
            return bridge.callHostMethod?.(selectedArgs.methodId, selectedArgs.payload);
          case 'getHostEventsSnapshot':
            return bridge.getHostEventsSnapshot?.(selectedArgs?.request as Record<string, unknown>);
          default:
            throw new Error(`Unsupported bridge method: ${selectedMethod}`);
        }
      },
      {
        selectedMethod: method,
        selectedArgs: args ?? {},
      },
    );
  }

  private scheduleHostEventPoll(subscriptionId: string, immediate = false): void {
    const record = this.hostEventSubscriptions.get(subscriptionId);
    if (!record || record.disposed) {
      return;
    }
    if (record.pollTimer) {
      clearTimeout(record.pollTimer);
    }
    record.pollTimer = setTimeout(() => {
      void this.pollHostEventSubscription(subscriptionId);
    }, immediate ? 0 : 350);
  }

  private async pollHostEventSubscription(subscriptionId: string): Promise<void> {
    const record = this.hostEventSubscriptions.get(subscriptionId);
    if (!record || record.disposed) {
      return;
    }
    try {
      const update = await this.readNativeHostEvents(subscriptionId, record.latestSequence);
      const nextSequence = update.subscription.latestSequence ?? record.latestSequence;
      if (update.events.length > 0 || nextSequence !== record.latestSequence) {
        record.latestSequence = nextSequence;
        record.latestState = {
          subscription: update.subscription,
          events: [...record.latestState.events, ...update.events],
        };
        for (const listener of record.listeners) {
          try {
            listener(record.latestState);
          } catch {
            // Ignore listener failures so polling stays alive.
          }
        }
      } else {
        record.latestState = {
          subscription: update.subscription,
          events: record.latestState.events,
        };
      }
    } catch {
      // Keep polling alive across transient native-lane failures.
    } finally {
      this.scheduleHostEventPoll(subscriptionId);
    }
  }

  private async resolveLocator(target: GreeblefsUiTarget, timeoutMs = 15_000): Promise<Locator> {
    const page = await this.ensureAppPage();
    let locator: Locator | null = null;
    if (target.agentId) {
      locator = page.locator([
        `[data-gfs-agent-id="${escapeCssAttributeValue(target.agentId)}"]`,
        `[data-agent-id="${escapeCssAttributeValue(target.agentId)}"]`,
        `#${escapeCssAttributeValue(target.agentId)}`,
      ].join(', '));
    } else if (target.actionId) {
      locator = page.locator(`[data-action-id="${escapeCssAttributeValue(target.actionId)}"]`);
    } else if (target.selector) {
      locator = page.locator(target.selector);
    } else if (target.role) {
      locator = page.getByRole(target.role as never, {
        name: target.name ?? target.text,
        exact: target.exact === true,
      });
    } else if (target.text) {
      locator = page.getByText(target.text, {
        exact: target.exact === true,
      });
    }
    if (!locator) {
      throw new Error('A UI target requires selector, role, text, agentId, or actionId.');
    }
    await locator.first().waitFor({
      state: 'visible',
      timeout: timeoutMs,
    });
    return locator.first();
  }

  private async closeBrowser(): Promise<void> {
    try {
      await this.page?.context().close();
    } catch {
      // Ignore page-context close failures.
    }
    try {
      await this.browser?.close();
    } catch {
      // Ignore browser close failures.
    }
    if (this.launchedFallbackBrowserPid) {
      if (process.platform === 'win32') {
        await new Promise<void>((resolve) => {
          const child = spawn('taskkill', ['/PID', String(this.launchedFallbackBrowserPid), '/T', '/F'], {
            stdio: 'ignore',
            shell: false,
          });
          child.on('exit', () => resolve());
          child.on('error', () => resolve());
        });
      } else {
        try {
          process.kill(this.launchedFallbackBrowserPid, 'SIGTERM');
        } catch {
          // Ignore fallback-browser kill failures.
        }
      }
    }
    this.page = null;
    this.browser = null;
    this.attachMode = null;
    this.attachFingerprint = '';
    this.launchedFallbackBrowserPid = null;
  }

  private async closeHostEventSubscriptions(): Promise<void> {
    const subscriptionIds = [...this.hostEventSubscriptions.keys()];
    for (const subscriptionId of subscriptionIds) {
      const record = this.hostEventSubscriptions.get(subscriptionId);
      if (record?.pollTimer) {
        clearTimeout(record.pollTimer);
      }
      if (record) {
        record.disposed = true;
      }
      this.hostEventSubscriptions.delete(subscriptionId);
      try {
        await this.unsubscribeNativeHostEvents(subscriptionId);
      } catch {
        // Ignore host-event unsubscribe failures during shutdown.
      }
    }
  }
}

export async function writeSmokeLog(message: string): Promise<void> {
  await appendTextFile(
    tauriDevLogPath,
    `[${buildIsoTimestamp()}] [greeblefs-dev-mcp] ${message}\n`,
  );
}

export async function writeSmokeStatus(message: string): Promise<void> {
  const current = await readJsonFile<Record<string, unknown>>(tauriDevStatusPath);
  await writeTextFile(
    tauriDevStatusPath,
    `${JSON.stringify({
      ...(current ?? {}),
      lastMcpTouchAt: buildIsoTimestamp(),
      lastMcpTouchMessage: message,
    }, null, 2)}\n`,
  );
}
