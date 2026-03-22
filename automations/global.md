# OverlayTerm Automation Control Plane

This directory is the shared control plane for the OverlayTerm closed-loop automation factory.

## Operating Model

- `tango` is the performance and ship-readiness lane.
- `delta` is the general feature-completion and missing-implementation lane.
- `charlie` is the asset-systems lane for plugins, themes, shaders, and animations.
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
- Validation runs should call out exact risks, exact tests run, and exact remaining blockers.
