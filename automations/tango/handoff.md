# Tango Handoff

## Current Status

- Initial performance telemetry slice is complete.
- Explorer hot-path metrics now record:
  - navigation
  - search
  - entry-size batches
  - native icon batches
  - first interactive readiness
- Telemetry source of truth:
  - `M:\OverlayTerm\src\config\performanceTelemetry.ts`
- Runtime sample persistence:
  - localStorage key `overlayterm-explorer-performance-v1`
- Verification completed:
  - `npm run test:unit -- src/test/performanceTelemetry.test.ts`
  - `npm run build`

## First Recommended Slice

- Use the new telemetry baseline to attack the highest-cost cold path in the native filesystem pipeline.
- First target: `fs_list_dir` and adjacent metadata/sorting overhead in `M:\OverlayTerm\src-tauri\src\fs_commands.rs`.

## Ranked Builder Queue

1. Add performance timing hooks and a compact budget table.
   - Files likely involved:
     - `M:\OverlayTerm\src-tauri\src\fs_commands.rs`
     - `M:\OverlayTerm\src\components\FileExplorer.tsx`
     - `M:\OverlayTerm\automations\tango\report.md`
   - Exit criteria:
     - Timings are recorded or observable.
     - The lane has named budgets or baseline numbers.
2. Reduce `fs_list_dir` and adjacent native listing overhead.
   - Focus:
     - cold navigation latency
     - metadata cost
     - sorting overhead
     - unnecessary repeated work
   - Exit criteria:
     - measurable reduction or clearer instrumentation proving the next constraint.
3. Harden recursive search.
   - Focus:
     - cancellation
     - stale result suppression
     - lower live traversal cost
   - Exit criteria:
     - search behaves predictably under repeated queries and large trees.
4. Push size/icon/preview hydration further off the hot path.
   - Exit criteria:
     - explorer feels responsive before secondary metadata finishes.
5. Split or isolate hot-path UI state.
   - Focus:
     - `src\App.tsx`
     - `src\components\FileExplorer.tsx`
   - Exit criteria:
     - reduced rerender pressure or clearer subsystem boundaries.
6. Harden for release.
   - Focus:
     - tests
     - smoke checks
     - crash/error handling
     - packaging confidence

## Validator Queue

1. Verify the most recent builder slice with targeted checks.
2. Tighten defects in the same area if safe.
3. Update `report.md` with exact release impact.
4. If the builder left weak state, convert it into a precise next action instead of a vague note.

## Expected Output Per Run

- Summary of code or validation work completed.
- Exact files changed or inspected.
- Verification performed.
- Remaining blockers or defects.
- The single highest-value next step for the next tango run.
