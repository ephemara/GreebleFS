import {
  EXPLORER_PERFORMANCE_HISTORY_KEY,
  loadExplorerPerformanceSnapshot,
  recordExplorerPerformanceSample,
  resetExplorerPerformanceSnapshot,
  summarizeExplorerPerformance,
} from '../config/performanceTelemetry';

describe('performanceTelemetry', () => {
  beforeEach(() => {
    window.localStorage.clear();
    resetExplorerPerformanceSnapshot(window.localStorage);
  });

  it('records samples by metric and persists them', () => {
    recordExplorerPerformanceSample({
      metricId: 'explorer_navigation',
      durationMs: 98.45,
      metadata: { pathDepth: 3, source: 'unit-test' },
    }, window.localStorage);

    const stored = window.localStorage.getItem(EXPLORER_PERFORMANCE_HISTORY_KEY);
    expect(stored).toBeTruthy();

    const snapshot = loadExplorerPerformanceSnapshot(window.localStorage);
    expect(snapshot.samples.explorer_navigation).toHaveLength(1);
    expect(snapshot.samples.explorer_navigation[0]?.durationMs).toBe(98.45);
    expect(snapshot.samples.explorer_navigation[0]?.metadata.pathDepth).toBe(3);
  });

  it('summarizes explorer metrics against their budgets', () => {
    recordExplorerPerformanceSample({ metricId: 'explorer_search', durationMs: 100 }, window.localStorage);
    recordExplorerPerformanceSample({ metricId: 'explorer_search', durationMs: 220 }, window.localStorage);
    recordExplorerPerformanceSample({ metricId: 'explorer_search', durationMs: 180 }, window.localStorage);

    const summary = summarizeExplorerPerformance(loadExplorerPerformanceSnapshot(window.localStorage));
    expect(summary.explorer_search.count).toBe(3);
    expect(summary.explorer_search.latestMs).toBe(180);
    expect(summary.explorer_search.bestMs).toBe(100);
    expect(summary.explorer_search.worstMs).toBe(220);
    expect(summary.explorer_search.overBudgetCount).toBe(1);
  });

  it('resets persisted telemetry cleanly', () => {
    recordExplorerPerformanceSample({ metricId: 'explorer_first_interactive', durationMs: 310 }, window.localStorage);
    expect(loadExplorerPerformanceSnapshot(window.localStorage).samples.explorer_first_interactive).toHaveLength(1);

    resetExplorerPerformanceSnapshot(window.localStorage);

    expect(window.localStorage.getItem(EXPLORER_PERFORMANCE_HISTORY_KEY)).toBeNull();
    expect(loadExplorerPerformanceSnapshot(window.localStorage).samples.explorer_first_interactive).toHaveLength(0);
  });
});
