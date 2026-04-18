import { invoke } from '@tauri-apps/api/core';
import { useSettingsStore } from '../store/settingsStore';

export type TelemetryLayer =
  | 'ui'
  | 'runtime'
  | 'tauri-bridge'
  | 'rust'
  | 'worker'
  | 'plugin'
  | 'renderer'
  | 'startup';

export type TelemetryKind =
  | 'action'
  | 'command'
  | 'event'
  | 'metric'
  | 'error'
  | 'lifecycle'
  | 'span-start'
  | 'span-end';

export type TelemetryStatus = 'ok' | 'error' | 'cancelled' | 'started';
export type TelemetryMetadataValue = string | number | boolean | null | undefined;
export type TelemetryMetadata = Record<string, TelemetryMetadataValue>;

export interface FrontendTelemetryErrorRecord {
  message: string;
  code: string | null;
}

export interface FrontendTelemetryRecord {
  traceId: string;
  spanId: string | null;
  parentSpanId: string | null;
  recordedAt: number;
  startedAt: number | null;
  endedAt: number | null;
  durationMs: number | null;
  layer: string;
  kind: string;
  name: string;
  status: string;
  metadata: Record<string, string>;
  error: FrontendTelemetryErrorRecord | null;
}

export interface FrontendTelemetrySpan {
  traceId: string;
  spanId: string;
  parentSpanId: string | null;
  name: string;
  layer: TelemetryLayer;
  kind: TelemetryKind;
  startedAt: number;
  metadata: TelemetryMetadata;
}

const TRACE_ID = createTelemetryId();
const MAX_METADATA_VALUE_LENGTH = 240;
const MAX_PENDING_RECORDS = 250;
const FRONTEND_BATCH_COMMAND = 'telemetry_record_frontend_batch';
const SOURCE_TRACE_STACK_LINE_LIMIT = 6;

let pendingRecords: FrontendTelemetryRecord[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let browserObserversInstalled = false;

function getPerformanceNow(): number {
  return typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();
}

function getRecordedAt(): number {
  return Date.now();
}

function telemetryEnabled(): boolean {
  const system = useSettingsStore.getState().settings.system;
  return system.developerTelemetryEnabled || system.consumerDiagnosticsEnabled;
}

function sourceTraceEnabled(): boolean {
  const system = useSettingsStore.getState().settings.system;
  const sourceTraceAllowed = Boolean(import.meta.env.DEV) || system.developerMode;
  return sourceTraceAllowed && system.sourceTraceModeEnabled;
}

function includePayloadMetadata(): boolean {
  return useSettingsStore.getState().settings.system.developerTelemetryPayloadMode === 'metadata+small-payloads';
}

function createTelemetryId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `telemetry-${Math.random().toString(36).slice(2)}-${Date.now()}`;
}

function summarizeMetadataValue(value: TelemetryMetadataValue): string {
  if (value == null) {
    return 'null';
  }

  if (typeof value === 'string') {
    return value.length > MAX_METADATA_VALUE_LENGTH
      ? `${value.slice(0, MAX_METADATA_VALUE_LENGTH)}…`
      : value;
  }

  return String(value);
}

function normalizeMetadata(metadata: TelemetryMetadata = {}): Record<string, string> {
  return Object.fromEntries(
    Object.entries(metadata)
      .filter(([key, value]) => key.trim().length > 0 && value !== undefined)
      .map(([key, value]) => [key.trim(), summarizeMetadataValue(value)]),
  );
}

function normalizeError(error: unknown): FrontendTelemetryErrorRecord | null {
  if (!error) {
    return null;
  }

  if (error instanceof Error) {
    return {
      message: error.message,
      code: null,
    };
  }

  return {
    message: String(error),
    code: null,
  };
}

function collectSourceTraceMetadata(): TelemetryMetadata {
  if (!sourceTraceEnabled()) {
    return {};
  }

  const rawStack = new Error().stack;
  if (!rawStack) {
    return {};
  }

  const stackLines = rawStack
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .filter((line) => !line.includes('/runtime/telemetry.ts'))
    .slice(0, SOURCE_TRACE_STACK_LINE_LIMIT);
  if (stackLines.length === 0) {
    return {};
  }

  return {
    sourceTraceTopFrame: stackLines[0] ?? null,
    sourceTraceStack: stackLines.join(' | '),
  };
}

function queueRecord(record: FrontendTelemetryRecord): void {
  if (!telemetryEnabled()) {
    return;
  }

  pendingRecords.push(record);
  if (pendingRecords.length > MAX_PENDING_RECORDS) {
    void flushTelemetryQueue();
    return;
  }

  if (flushTimer != null) {
    return;
  }

  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flushTelemetryQueue();
  }, 120);
}

async function flushTelemetryQueue(): Promise<void> {
  if (pendingRecords.length === 0) {
    return;
  }

  const records = pendingRecords;
  pendingRecords = [];

  try {
    await invoke(FRONTEND_BATCH_COMMAND, { records });
  } catch {
    // Best-effort only. Avoid recursive logging on telemetry failure.
  }
}

export function installFrontendTelemetryObservers(): void {
  if (browserObserversInstalled || typeof window === 'undefined') {
    return;
  }

  browserObserversInstalled = true;

  window.addEventListener('error', (event) => {
    recordFrontendTelemetry({
      layer: 'ui',
      kind: 'error',
      name: 'window.error',
      status: 'error',
      metadata: {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      },
      error: event.error ?? event.message,
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    recordFrontendTelemetry({
      layer: 'runtime',
      kind: 'error',
      name: 'window.unhandledrejection',
      status: 'error',
      metadata: {},
      error: event.reason,
    });
  });
}

export function startTelemetrySpan(input: {
  name: string;
  layer: TelemetryLayer;
  kind?: TelemetryKind;
  metadata?: TelemetryMetadata;
  parentSpanId?: string | null;
}): FrontendTelemetrySpan {
  const span: FrontendTelemetrySpan = {
    traceId: TRACE_ID,
    spanId: createTelemetryId(),
    parentSpanId: input.parentSpanId ?? null,
    name: input.name,
    layer: input.layer,
    kind: input.kind ?? 'action',
    startedAt: getPerformanceNow(),
    metadata: {
      ...collectSourceTraceMetadata(),
      ...(input.metadata ?? {}),
    },
  };

  recordFrontendTelemetry({
    traceId: span.traceId,
    spanId: span.spanId,
    parentSpanId: span.parentSpanId,
    layer: span.layer,
    kind: 'span-start',
    name: span.name,
    status: 'started',
    startedAt: span.startedAt,
    metadata: span.metadata,
  });

  return span;
}

export function finishTelemetrySpan(
  span: FrontendTelemetrySpan,
  input: {
    status: Exclude<TelemetryStatus, 'started'>;
    metadata?: TelemetryMetadata;
    error?: unknown;
  },
): void {
  const endedAt = getPerformanceNow();
  recordFrontendTelemetry({
    traceId: span.traceId,
    spanId: span.spanId,
    parentSpanId: span.parentSpanId,
    layer: span.layer,
    kind: 'span-end',
    name: span.name,
    status: input.status,
    startedAt: span.startedAt,
    endedAt,
    durationMs: Math.max(0, endedAt - span.startedAt),
    metadata: {
      ...span.metadata,
      ...(input.metadata ?? {}),
    },
    error: input.error,
  });
}

export function recordFrontendTelemetry(input: {
  traceId?: string;
  spanId?: string | null;
  parentSpanId?: string | null;
  layer: TelemetryLayer;
  kind: TelemetryKind;
  name: string;
  status?: TelemetryStatus;
  metadata?: TelemetryMetadata;
  startedAt?: number | null;
  endedAt?: number | null;
  durationMs?: number | null;
  error?: unknown;
}): void {
  if (!telemetryEnabled()) {
    return;
  }

  const metadata = normalizeMetadata({
    ...collectSourceTraceMetadata(),
    ...(input.metadata ?? {}),
  });
  const shouldDropPayload =
    !includePayloadMetadata()
    && Object.keys(metadata).some((key) => key.includes('payload') || key.includes('args'));
  const normalizedMetadata = shouldDropPayload
    ? Object.fromEntries(Object.entries(metadata).filter(([key]) => !key.includes('payload') && !key.includes('args')))
    : metadata;

  queueRecord({
    traceId: input.traceId ?? TRACE_ID,
    spanId: input.spanId ?? null,
    parentSpanId: input.parentSpanId ?? null,
    recordedAt: getRecordedAt(),
    startedAt: input.startedAt ?? null,
    endedAt: input.endedAt ?? null,
    durationMs: input.durationMs ?? null,
    layer: input.layer,
    kind: input.kind,
    name: input.name,
    status: input.status ?? 'ok',
    metadata: normalizedMetadata,
    error: normalizeError(input.error),
  });
}

export function summarizeTelemetryValue(value: unknown, label: string): TelemetryMetadataValue {
  if (value == null) {
    return null;
  }

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  if (Array.isArray(value)) {
    return `${label}[${value.length}]`;
  }

  if (typeof value === 'object') {
    return `${label}{${Object.keys(value as Record<string, unknown>).slice(0, 4).join(',')}}`;
  }

  return String(value);
}
