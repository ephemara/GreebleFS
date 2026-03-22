# Echo Lane

## Mission

Turn implementation confidence into real runtime proof for OverlayTerm's most ship-critical flows.

## Teams

- Team 7: run live Tauri/browser validation, capture evidence, and land small safe runtime-proof fixes.
- Team 8: validate Team 7 findings, reproduce failures, tighten defect quality, and keep the runtime-proof backlog honest.

## Focus Areas

- Real browser and Tauri-backed validation for explorer, source control, screenshots, plugins, themes, shaders, and animations.
- Reproduction quality for hangs, flaky browser runs, runtime-only regressions, and integration defects.
- Telemetry capture, proof notes, and exact operator steps for hot-path behavior.
- Live verification of gaps already called out by Tango, Delta, and Charlie.

## Ranked Backlog

1. Explorer runtime-proof pass.
   - Validate watched-root freshness, cold versus warm search behavior, rapid clear-search interruption, and runtime telemetry labeling.
   - Prefer real workspace evidence over unit-only confidence.
2. Source-control runtime-proof pass.
   - Stabilize proof for the FileExplorer repository-picker flow, Source handoff, and one real conflict-action pass.
   - Reduce the gap between passing logic tests and hanging browser/runtime behavior.
3. Screenshot runtime-proof pass.
   - Validate capture, preview, delete, reveal, open, and gallery refresh behavior on real saved images.
4. Asset-system runtime-proof pass.
   - Validate plugin/theme/shader/animation refresh, load-failure surfacing, and authored-content loops in the running product.
5. Runtime harness hardening.
   - Tighten flaky browser or live-validation harness behavior when it blocks repeated proof runs.
   - Prefer determinism and exact teardown over adding more tests that still hang.
6. Shared evidence consolidation.
   - Keep runtime proof concise, reproducible, and useful to Tango, Delta, Charlie, and Foxtrot.

## Execution Order For The Next 2-3 Days

- Day 1 bias:
  - backlog items 1 and 2
- Day 2 bias:
  - backlog items 3 and 4
- Day 3 bias:
  - backlog items 5 and 6, plus cleanup on unfinished earlier work

## Team Selection Rules

- Team 7 should usually take the highest unfinished runtime-proof item from the ranked backlog.
- Team 8 should validate the latest Team 7 slice first, then tighten the same proof path or clear the highest-risk runtime blocker.
- Echo should prefer proving or disproving lane claims already made by Tango, Delta, and Charlie before inventing new validation scope.
- Do not skip to lower-ranked work unless the higher-ranked item is blocked and the blocker is recorded in `handoff.md`.

## Workflow

1. Read `M:\OverlayTerm\automations\global.md`.
2. Read `M:\OverlayTerm\automations\echo\memory.md`.
3. Read `M:\OverlayTerm\automations\echo\handoff.md`.
4. Read `M:\OverlayTerm\automations\echo\report.md`.
5. Read the latest relevant handoff/report from Tango, Delta, or Charlie for the workflow under test.
6. Run the smallest meaningful live validation or harness-hardening slice.
7. Append concise durable notes to `memory.md`.
8. Refresh `handoff.md` with current status, exact verification, exact failures, and the next best step.
9. Refresh `report.md` with current runtime-proof posture.

## Team 7 Rules

- Favor real evidence over broad code churn.
- If a small safe fix makes the proof path materially more reliable, land it.
- Leave exact reproduction steps, not broad impressions.

## Team 8 Rules

- Reproduce the freshest finding before broadening scope.
- Convert vague bugs into exact defects with exact steps and exact evidence.
- Keep runtime validation deterministic and repeatable wherever possible.
