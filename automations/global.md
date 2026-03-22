# OverlayTerm Automation Control Plane

This directory is the shared control plane for the OverlayTerm closed-loop automation factory.

## Operating Model

- `tango` is the performance and ship-readiness lane.
- `delta` is the general feature-completion and missing-implementation lane.
- `charlie` is the asset-systems lane for plugins, themes, shaders, and animations.
- `echo` is the runtime-proof and live-validation lane.
- `foxtrot` is the release-engineering and packaging lane.
- Each lane has a builder team followed by a validator/polish team.
- Builders make concrete code and system changes.
- Validators verify, harden, document, and either clear work for carry-forward or push it back with precise defects.
- Every automation must leave the lane in a better state than it found it.

## Hourly Cadence

- Stage 1 runs at minute `15`: Tango Team 1 builds performance and robustness work.
- Stage 2 runs at minute `22`: Tango Team 2 validates, polishes, and updates release readiness.
- Stage 3 runs at minute `36`: Delta Team 3 builds missing features and shippable implementations.
- Stage 4 runs at minute `43`: Delta Team 4 validates, integrates, and polishes feature work.
- Stage 5 runs at minute `50`: Charlie Team 5 builds plugin, theme, shader, and animation workflow improvements.
- Stage 6 runs at minute `57`: Charlie Team 6 validates, hardens, and polishes asset-system work.
- Stage 7 runs every 2 hours at minute `05`: Echo Team 7 runs live runtime validation and captures proof.
- Stage 8 runs every 2 hours at minute `12`: Echo Team 8 validates the latest runtime-proof work and tightens defects.
- Stage 9 runs every 4 hours at minute `28`: Foxtrot Team 9 advances packaging, release docs, and ship-candidate readiness.
- Stage 10 runs every 4 hours at minute `35`: Foxtrot Team 10 validates release artifacts, checklist state, and remaining blockers.

## Shared Rules

- Read this file first, then read the lane README, memory, handoff, and report files before changing code.
- Keep work inside `M:\OverlayTerm`.
- Prefer shipping slices over broad speculative rewrites.
- Favor performance, correctness, reliability, and release readiness over novelty.
- If the lane is blocked, record the blocker, preserve state, and move the next step forward anyway.
- Do not erase history. Append new run notes instead of replacing useful context.

## Required Lane Artifacts

- `README.md`: lane mission, rules, and workflow.
- `memory.md`: durable carry-forward knowledge.
- `handoff.md`: current active run handoff and next actions.
- `report.md`: latest validation and release-readiness summary.

## Release Standard

- The app should trend toward a shippable Tauri release, not a demo-only state.
- High-cost filesystem paths should move toward indexed, incremental, and cancelable native flows.
- New work should reduce fragility in `src/App.tsx`, `src/components/FileExplorer.tsx`, and `src-tauri/src/fs_commands.rs`.
- Asset-system work should reduce fragility in `src/App.tsx`, `src/components/PluginsManager.tsx`, `src/config/pluginPackages.ts`, `src/config/themePackages.ts`, `src/components/shaderRuntime.tsx`, and `src/components/animationRuntime.tsx`.
- Runtime-proof work should convert unit confidence into real browser or Tauri evidence whenever the lane reports still call out live-validation gaps.
- Release-engineering work should keep `package.json`, `src-tauri/tauri.conf.json`, release docs, bundle warnings, and ship checklists aligned with the actual product state.
- Validation runs should call out exact risks, exact tests run, and exact remaining blockers.
