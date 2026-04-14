# OverlayTerm Fleet

This folder holds the dedicated OverlayTerm OpenClaw fleet.

## Live fleet

- `ot-cleo` - boss, routing, shipping pressure
- `ot-dalmascus` - core implementation strike lead
- `ot-aristotle` - architecture and systems lead
- `ot-explorer` - file explorer parity and UX
- `ot-terminal` - terminal overhaul and shell integration
- `ot-qa` - quality, perf, regressions, crash hardening
- `ot-native` - Rust, Tauri, PTY, watcher, and native systems strike lead
- `ot-runtime` - frontend runtime, settings, stores, and orchestration lead

## Parked specialty lanes

These remain on disk for possible reuse, but are not part of the active OT strike team right now.

- `ot-plugins` - plugin platform and ecosystem
- `ot-themes` - themes, layouts, motion, premium presentation
- `ot-forge` - workflow tooling and fleet acceleration
- `ot-labs` - next-gen feature R&D
- `ot-git` - source-control UX, GitManager behavior, and repo telemetry lead
- `ot-preview` - preview, diff, large-file, and content-inspection lead
- `ot-release` - build, packaging, startup, integration, and shipping-readiness lead

## Shared operating model

- Shared repo, aggressive coding, no branch babysitting by default.
- Avoid overlapping file ownership during simultaneous passes.
- Make big moves, but verify meaningful changes before declaring wins.
- Favor product leverage over local elegance.
- Explorer, terminal, plugin system, theming, and workflow acceleration are the core lanes.
- Use the `spec-process-guide` pipeline as the planning front door for meaningful work.
- Put repo-wide guidance in `.specs/steering/` and active feature plans in `.specs/<slug>/`.
- Use `micro` or `quick` specs for small work, `standard` for most multi-day OverlayTerm features, and `full` for major redesigns or risky migrations.
- OT Cleo owns spec selection and orchestration, OT Aristotle pressure-tests design, and implementation agents execute from tasks instead of freestyle replanning.
