# Tango Lane

## Mission

Drive OverlayTerm toward elite performance and production readiness.

## Teams

- Team 1: implement performance, architecture, and robustness improvements.
- Team 2: validate Team 1 work, polish rough edges, run checks, and keep release-readiness honest.

## Focus Areas

- Explorer responsiveness.
- Rust filesystem throughput.
- Search latency.
- Native icon and preview hydration cost.
- App-shell rerender pressure.
- Release blockers, crash paths, test gaps, and operational fragility.

## Ranked Backlog

1. Baseline instrumentation and performance budget setup.
   - Add measurable timings around explorer navigation, search, entry-size hydration, native icon hydration, and first interactive paint.
   - Define a compact budget table in `report.md` so later runs can prove improvement instead of claiming it.
2. Native explorer hot-path reduction.
   - Attack repeated cold work in `src-tauri/src/fs_commands.rs`.
   - Prioritize faster directory listing, reduced metadata churn, and safer batching/cancellation.
3. Search pipeline hardening.
   - Reduce recursive live-search cost and move toward indexed, incremental, or at least cancelable native search flows.
   - Make stale-search races and repeated scans harder to trigger.
4. Async enrichment isolation.
   - Move directory-size, native icon, and preview enrichment further off the primary interaction path.
   - Prefer eventual-consistency UI over blocking accuracy.
5. Explorer/UI state isolation.
   - Reduce rerender pressure and coordination bloat from `src/App.tsx` and `src/components/FileExplorer.tsx`.
   - Split hot-path logic into clearer controller/store boundaries when it materially helps performance.
6. Release hardening.
   - Tighten tests, smoke coverage, error handling, and packaging confidence around the performance work.

## Execution Order For The Next 2-3 Days

- Day 1 bias:
  - backlog items 1 and 2
- Day 2 bias:
  - backlog items 2, 3, and 4
- Day 3 bias:
  - backlog items 4, 5, and 6

## Team Selection Rules

- Team 1 should usually take the highest unfinished builder item from the ranked backlog.
- Team 2 should validate the latest Team 1 slice first, then either harden the same area or clear the next blocker in the ranked backlog.
- Do not jump to lower-ranked work unless the higher-ranked item is blocked and the blocker is recorded in `handoff.md`.

## Workflow

1. Read `M:\OverlayTerm\automations\global.md`.
2. Read `M:\OverlayTerm\automations\tango\memory.md`.
3. Read `M:\OverlayTerm\automations\tango\handoff.md`.
4. Read `M:\OverlayTerm\automations\tango\report.md`.
5. Pick the highest-value open item that moves performance or ship-readiness forward.
6. Make code changes or validation updates.
7. Append concise durable notes to `memory.md`.
8. Refresh `handoff.md` with current status, what changed, what was verified, and the next best step.
9. Refresh `report.md` with current release-risk posture.

## Team 1 Rules

- Prioritize structural wins over cosmetic optimization.
- Favor indexed, batched, incremental, native-backed solutions.
- Leave measurable outcomes or clear follow-up targets.

## Team 2 Rules

- Verify with tests, targeted inspection, and release-risk review.
- Tighten docs, state, and polish rather than reopening broad scope.
- If Team 1 introduced risk, record it sharply and hand back an actionable defect list.
