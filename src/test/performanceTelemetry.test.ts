import {
  EXPLORER_PERFORMANCE_HISTORY_KEY,
  loadExplorerPerformanceSnapshot,
  recordExplorerPerformanceSample,
  resetExplorerPerformanceSnapshot,
  summarizeExplorerPerformance,
} from '../config/performanceTelemetry';

function createInMemoryStorage(): Storage {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear: () => {
      store.clear();
    },
    getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    removeItem: (key: string) => {
      store.delete(key);
    },
    setItem: (key: string, value: string) => {
      store.set(key, String(value));
    },
  };
}

// Vitest's Node environment does not provide a full localStorage implementation.
const memoryStorage = createInMemoryStorage();
globalThis.window ??= {} as typeof window;
globalThis.window.localStorage = memoryStorage;

describe('performanceTelemetry', () => {
  beforeEach(() => {
    memoryStorage.clear();
    resetExplorerPerformanceSnapshot(memoryStorage);
  });

  it('records samples by metric and persists them', () => {
    recordExplorerPerformanceSample({
      metricId: 'explorer_navigation',
      durationMs: 98.45,
      metadata: { pathDepth: 3, source: 'unit-test' },
    }, memoryStorage);

    const stored = memoryStorage.getItem(EXPLORER_PERFORMANCE_HISTORY_KEY);
    expect(stored).toBeTruthy();

    const snapshot = loadExplorerPerformanceSnapshot(memoryStorage);
    expect(snapshot.samples.explorer_navigation).toHaveLength(1);
    expect(snapshot.samples.explorer_navigation[0]?.durationMs).toBe(98.45);
    expect(snapshot.samples.explorer_navigation[0]?.metadata.pathDepth).toBe(3);
  });

  it('summarizes explorer metrics against their budgets', () => {
    recordExplorerPerformanceSample({ metricId: 'explorer_search', durationMs: 100 }, memoryStorage);
    recordExplorerPerformanceSample({ metricId: 'explorer_search', durationMs: 220 }, memoryStorage);
    recordExplorerPerformanceSample({ metricId: 'explorer_search', durationMs: 180 }, memoryStorage);

    const summary = summarizeExplorerPerformance(loadExplorerPerformanceSnapshot(memoryStorage));
    expect(summary.explorer_search.count).toBe(3);
    expect(summary.explorer_search.latestMs).toBe(180);
    expect(summary.explorer_search.bestMs).toBe(100);
    expect(summary.explorer_search.worstMs).toBe(220);
    expect(summary.explorer_search.overBudgetCount).toBe(1);
  });

  it('resets persisted telemetry cleanly', () => {
    recordExplorerPerformanceSample({ metricId: 'explorer_first_interactive', durationMs: 310 }, memoryStorage);
    expect(loadExplorerPerformanceSnapshot(memoryStorage).samples.explorer_first_interactive).toHaveLength(1);

    resetExplorerPerformanceSnapshot(memoryStorage);

    expect(memoryStorage.getItem(EXPLORER_PERFORMANCE_HISTORY_KEY)).toBeNull();
    expect(loadExplorerPerformanceSnapshot(memoryStorage).samples.explorer_first_interactive).toHaveLength(0);
  });
});
