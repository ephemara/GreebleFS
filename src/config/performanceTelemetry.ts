const PERFORMANCE_HISTORY_VERSION = 1;
const MAX_SAMPLES_PER_METRIC = 40;
const PERFORMANCE_PERSIST_DEBOUNCE_MS = (() => {
  const env = (import.meta as unknown as { env?: Record<string, unknown> }).env;
  const isTest = env?.MODE === 'test' || Boolean(env?.VITEST);
  return isTest ? 0 : 180;
})();

export const EXPLORER_PERFORMANCE_HISTORY_KEY = 'overlayterm-explorer-performance-v1';

export const explorerPerformanceBudgets = {
  explorer_navigation: {
    label: 'Explorer Navigation',
    targetMs: 120,
    description: 'Navigation request start to directory entries becoming available to render.',
  },
  explorer_search: {
    label: 'Explorer Search',
    targetMs: 180,
    description: 'Search request start to current-query results being accepted.',
  },
  explorer_entry_size_batch: {
    label: 'Entry Size Batch',
    targetMs: 160,
    description: 'A single `fs_measure_entry_sizes` batch resolving for the visible viewport.',
  },
  explorer_native_icon_batch: {
    label: 'Native Icon Batch',
    targetMs: 140,
    description: 'A single `fs_resolve_native_icons` batch resolving for the visible viewport.',
  },
  explorer_first_interactive: {
    label: 'Explorer First Interactive',
    targetMs: 350,
    description: 'Explorer mount to the first completed interactive directory state.',
  },
  overlay_frame_time: {
    label: 'Overlay Frame p95',
    targetMs: 8.3,
    description: 'p95 requestAnimationFrame delta collected while the overlay is visible.',
  },
  git_repo_state_load: {
    label: 'Git Repo State Load',
    targetMs: 250,
    description: 'GitManager repo-state refresh from trigger to status payload acceptance.',
  },
  git_repo_badge_sync: {
    label: 'Git Repo Badge Sync',
    targetMs: 120,
    description: 'GitManager badge refresh pass for the active or background repo set.',
  },
} as const;

export type ExplorerPerformanceMetricId = keyof typeof explorerPerformanceBudgets;

export type ExplorerPerformanceMetadataValue = string | number | boolean | null;
export type ExplorerPerformanceMetadata = Record<string, ExplorerPerformanceMetadataValue>;

export interface ExplorerPerformanceSample {
  metricId: ExplorerPerformanceMetricId;
  durationMs: number;
  recordedAt: number;
  metadata: ExplorerPerformanceMetadata;
}

export interface ExplorerPerformanceSnapshot {
  version: number;
  samples: Record<ExplorerPerformanceMetricId, ExplorerPerformanceSample[]>;
}

export interface ExplorerPerformanceSummary {
  metricId: ExplorerPerformanceMetricId;
  label: string;
  targetMs: number;
  count: number;
  latestMs: number | null;
  avgMs: number | null;
  p95Ms: number | null;
  bestMs: number | null;
  worstMs: number | null;
  overBudgetCount: number;
  latestAt: number | null;
  latestMetadata: ExplorerPerformanceMetadata;
}

let cachedSnapshot: ExplorerPerformanceSnapshot | null = null;
let persistTimer: ReturnType<typeof setTimeout> | null = null;

export function loadExplorerPerformanceSnapshot(storage: Storage | null = getStorage()): ExplorerPerformanceSnapshot {
  if (cachedSnapshot) {
    return cloneSnapshot(cachedSnapshot);
  }

  if (!storage) {
    cachedSnapshot = createDefaultExplorerPerformanceSnapshot();
    return cloneSnapshot(cachedSnapshot);
  }

  const raw = storage.getItem(EXPLORER_PERFORMANCE_HISTORY_KEY);
  if (!raw) {
    cachedSnapshot = createDefaultExplorerPerformanceSnapshot();
    return cloneSnapshot(cachedSnapshot);
  }

  try {
    const parsed = JSON.parse(raw) as Partial<ExplorerPerformanceSnapshot>;
    cachedSnapshot = normalizeExplorerPerformanceSnapshot(parsed);
    return cloneSnapshot(cachedSnapshot);
  } catch {
    cachedSnapshot = createDefaultExplorerPerformanceSnapshot();
    return cloneSnapshot(cachedSnapshot);
  }
}

export function resetExplorerPerformanceSnapshot(storage: Storage | null = getStorage()): ExplorerPerformanceSnapshot {
  if (persistTimer !== null) {
    clearTimeout(persistTimer);
    persistTimer = null;
  }

  cachedSnapshot = createDefaultExplorerPerformanceSnapshot();
  storage?.removeItem(EXPLORER_PERFORMANCE_HISTORY_KEY);
  return cloneSnapshot(cachedSnapshot);
}

export function recordExplorerPerformanceSample(
  input: {
    metricId: ExplorerPerformanceMetricId;
    durationMs: number;
    recordedAt?: number;
    metadata?: ExplorerPerformanceMetadata;
  },
  storage: Storage | null = getStorage(),
): ExplorerPerformanceSnapshot {
  const base = loadExplorerPerformanceSnapshot(storage);
  const metricSamples = base.samples[input.metricId] ?? [];
  const normalizedSample: ExplorerPerformanceSample = {
    metricId: input.metricId,
    durationMs: normalizeDurationMs(input.durationMs),
    recordedAt: normalizeRecordedAt(input.recordedAt),
    metadata: normalizeMetadata(input.metadata),
  };

  const nextSnapshot: ExplorerPerformanceSnapshot = {
    version: PERFORMANCE_HISTORY_VERSION,
    samples: {
      ...base.samples,
      [input.metricId]: [...metricSamples, normalizedSample].slice(-MAX_SAMPLES_PER_METRIC),
    },
  };

  cachedSnapshot = cloneSnapshot(nextSnapshot);
  schedulePersist(storage);
  return cloneSnapshot(nextSnapshot);
}

export function summarizeExplorerPerformance(
  snapshot: ExplorerPerformanceSnapshot = loadExplorerPerformanceSnapshot(),
): Record<ExplorerPerformanceMetricId, ExplorerPerformanceSummary> {
  return createMetricRecord((metricId) => summarizeMetric(metricId, snapshot.samples[metricId] ?? []));
}

function summarizeMetric(
  metricId: ExplorerPerformanceMetricId,
  samples: ExplorerPerformanceSample[],
): ExplorerPerformanceSummary {
  const budget = explorerPerformanceBudgets[metricId];
  if (samples.length === 0) {
    return {
      metricId,
      label: budget.label,
      targetMs: budget.targetMs,
      count: 0,
      latestMs: null,
      avgMs: null,
      p95Ms: null,
      bestMs: null,
      worstMs: null,
      overBudgetCount: 0,
      latestAt: null,
      latestMetadata: {},
    };
  }

  const durations = samples.map((sample) => sample.durationMs).sort((left, right) => left - right);
  const total = durations.reduce((sum, duration) => sum + duration, 0);
  const latest = samples[samples.length - 1] ?? null;
  const p95Index = Math.min(
    durations.length - 1,
    Math.max(0, Math.ceil(durations.length * 0.95) - 1),
  );

  return {
    metricId,
    label: budget.label,
    targetMs: budget.targetMs,
    count: samples.length,
    latestMs: latest?.durationMs ?? null,
    avgMs: roundMetric(total / durations.length),
    p95Ms: roundMetric(durations[p95Index] ?? durations[durations.length - 1] ?? 0),
    bestMs: durations[0] ?? null,
    worstMs: durations[durations.length - 1] ?? null,
    overBudgetCount: samples.filter((sample) => sample.durationMs > budget.targetMs).length,
    latestAt: latest?.recordedAt ?? null,
    latestMetadata: latest?.metadata ?? {},
  };
}

function schedulePersist(storage: Storage | null): void {
  if (!storage) {
    return;
  }

  if (PERFORMANCE_PERSIST_DEBOUNCE_MS <= 0) {
    persistSnapshot(storage);
    return;
  }

  if (persistTimer !== null) {
    clearTimeout(persistTimer);
  }

  persistTimer = setTimeout(() => {
    persistTimer = null;
    persistSnapshot(storage);
  }, PERFORMANCE_PERSIST_DEBOUNCE_MS);
}

function persistSnapshot(storage: Storage): void {
  if (!cachedSnapshot) {
    return;
  }

  try {
    storage.setItem(EXPLORER_PERFORMANCE_HISTORY_KEY, JSON.stringify(cachedSnapshot));
  } catch {
    // Ignore storage failures. Telemetry is best-effort only.
  }
}

function createDefaultExplorerPerformanceSnapshot(): ExplorerPerformanceSnapshot {
  return {
    version: PERFORMANCE_HISTORY_VERSION,
    samples: createMetricRecord(() => []),
  };
}

function normalizeExplorerPerformanceSnapshot(value: Partial<ExplorerPerformanceSnapshot> | null | undefined): ExplorerPerformanceSnapshot {
  const source = value && typeof value === 'object' ? value : {};
  const normalizedSamples = createMetricRecord((metricId) => normalizeSamples(source.samples?.[metricId], metricId));
  return {
    version: PERFORMANCE_HISTORY_VERSION,
    samples: normalizedSamples,
  };
}

function normalizeSamples(value: unknown, metricId: ExplorerPerformanceMetricId): ExplorerPerformanceSample[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => normalizeSample(entry, metricId))
    .filter((entry): entry is ExplorerPerformanceSample => Boolean(entry))
    .slice(-MAX_SAMPLES_PER_METRIC);
}

function normalizeSample(value: unknown, metricId: ExplorerPerformanceMetricId): ExplorerPerformanceSample | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const source = value as Partial<ExplorerPerformanceSample>;
  const durationMs = normalizeDurationMs(source.durationMs);
  return {
    metricId,
    durationMs,
    recordedAt: normalizeRecordedAt(source.recordedAt),
    metadata: normalizeMetadata(source.metadata),
  };
}

function normalizeDurationMs(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? roundMetric(Math.max(0, value))
    : 0;
}

function normalizeRecordedAt(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.trunc(value)
    : Date.now();
}

function normalizeMetadata(value: unknown): ExplorerPerformanceMetadata {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([, entryValue]) => isMetadataValue(entryValue))
      .map(([key, entryValue]) => [key, entryValue as ExplorerPerformanceMetadataValue]),
  );
}

function isMetadataValue(value: unknown): value is ExplorerPerformanceMetadataValue {
  return value === null
    || typeof value === 'string'
    || typeof value === 'number'
    || typeof value === 'boolean';
}

function cloneSnapshot(snapshot: ExplorerPerformanceSnapshot): ExplorerPerformanceSnapshot {
  return {
    version: snapshot.version,
    samples: createMetricRecord((metricId) => [...snapshot.samples[metricId]]),
  };
}

function roundMetric(value: number): number {
  return Math.round(value * 100) / 100;
}

function getStorage(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

function createMetricRecord<T>(factory: (metricId: ExplorerPerformanceMetricId) => T): Record<ExplorerPerformanceMetricId, T> {
  return {
    explorer_navigation: factory('explorer_navigation'),
    explorer_search: factory('explorer_search'),
    explorer_entry_size_batch: factory('explorer_entry_size_batch'),
    explorer_native_icon_batch: factory('explorer_native_icon_batch'),
    explorer_first_interactive: factory('explorer_first_interactive'),
    overlay_frame_time: factory('overlay_frame_time'),
    git_repo_state_load: factory('git_repo_state_load'),
    git_repo_badge_sync: factory('git_repo_badge_sync'),
  };
}
