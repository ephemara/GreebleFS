# Tango Report

## Release Readiness

- Status: not yet shippable.

## Current Known Gaps

- Explorer performance is still bounded by live filesystem work and React-side orchestration.
- Performance budgets are now formalized in `src/config/performanceTelemetry.ts`, but real runtime baselines still need to accumulate across interactive runs.
- The app shell still carries too much coordination load in the top-level React component.

## Ranked Release Risks

1. Native explorer operations still do too much cold filesystem work per interaction.
2. Recursive search is still expensive and likely to degrade on large trees.
3. Secondary metadata work still competes too directly with primary navigation responsiveness.
4. Hot-path UI logic is concentrated in very large React files.
5. Release-readiness evidence is still thin.

## Budget Targets

- Explorer navigation:
  - target: 120 ms
- Explorer search:
  - target: 180 ms
- Entry-size batch:
  - target: 160 ms
- Native icon batch:
  - target: 140 ms
- Explorer first interactive:
  - target: 350 ms

## Baseline Source

- Code:
  - `M:\OverlayTerm\src\config\performanceTelemetry.ts`
  - `M:\OverlayTerm\src\components\FileExplorer.tsx`
- Runtime storage:
  - localStorage key `overlayterm-explorer-performance-v1`
- Current state:
  - instrumentation landed
  - baseline collection is now active

## Current Execution Bias

- First priority is reducing the native listing hot path now that measurement is in place.
- After that, the lane should shift into search hardening and metadata isolation.

## Goal

- Convert performance work into measured, validated, release-oriented progress over repeated hourly runs.
