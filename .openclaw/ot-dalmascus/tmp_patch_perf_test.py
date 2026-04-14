from pathlib import Path
path = Path(r'F:\apps-2d\overlayterm\src\test\performanceTelemetry.test.ts')
text = path.read_text()
insert = """
  it('tracks git manager telemetry budgets', () => {
    recordExplorerPerformanceSample({ metricId: 'git_repo_state_load', durationMs: 180, metadata: { repoCount: 1 } }, memoryStorage);
    recordExplorerPerformanceSample({ metricId: 'git_repo_badge_sync', durationMs: 75, metadata: { repoCount: 4 } }, memoryStorage);

    const summary = summarizeExplorerPerformance(loadExplorerPerformanceSnapshot(memoryStorage));
    expect(summary.git_repo_state_load.count).toBe(1);
    expect(summary.git_repo_state_load.latestMetadata.repoCount).toBe(1);
    expect(summary.git_repo_badge_sync.count).toBe(1);
    expect(summary.git_repo_badge_sync.latestMetadata.repoCount).toBe(4);
  });
"""
marker = "  it('keeps latest metadata for overlay frame telemetry samples', () => {\n"
if insert.strip() in text:
    raise SystemExit('already inserted')
text = text.replace(marker, insert + "\n" + marker)
path.write_text(text)
