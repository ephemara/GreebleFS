# Design: Overlayterm Performance 60Fps

**Spec Type:** standard  
**Slug:** `overlayterm-performance-60fps`  
**Created:** 2026-04-14

## Overview

This design attacks the current performance ceiling through a hybrid plan: instrument the highest-cost flows first, harden the native git execution path, reduce repeated refresh work in GitManager and explorer-adjacent panels, bound preview and diff memory cost, tighten runtime asset reload loops, and improve terminal throughput. The solution keeps OverlayTerm’s premium shell shape intact by reducing unnecessary work rather than stripping capabilities.

## Requirements Traceability

- REQ-1 -> Native git execution path, repo refresh policy, visibility-aware resync behavior
- REQ-2 -> Preview and diff guardrails, backend file-read thresholds, UI fallback states
- REQ-3 -> Runtime content reload policy, developer-mode gating, targeted invalidation
- REQ-4 -> Terminal backend throughput and shell handoff behavior
- REQ-5 -> Hot-path instrumentation and validation workflows
- REQ-6 -> Degradation rules, UX-preserving fallbacks, rollout notes
- NFR-1 -> Async/off-thread execution, visible-only refresh policy, incremental reloads
- NFR-2 -> Timeouts, fallback states, error visibility, recovery behavior
- NFR-3 -> Validation tasks, benchmarks, profiling checklist, traceability

## Architecture

### System Overview

The optimization work spans five existing boundaries:

1. **Native backend in `src-tauri/src/`**
   Owns `git_exec`, preview file reads, PTY behavior, and native watchers or process work.
2. **Generated bridge in `src/generated/tauri.ts` plus runtime wrappers**
   Carries typed commands into the frontend without ad hoc invoke sprawl.
3. **Frontend orchestration in `src/components/GitManager.tsx`, `src/components/FileExplorer.tsx`, `src/App.tsx`, and related runtime helpers**
   Owns refresh policy, visibility handling, preview behavior, and runtime content loading.
4. **State and configuration layers in `src/store/` and `src/config/`**
   Carry persisted preferences such as `developerMode` and explorer session behavior.
5. **Validation and profiling scripts/tests**
   Provide targeted proof that hot paths improved.

### Component Boundaries

- **Git execution boundary**
  - Files: `src-tauri/src/fs_commands.rs`, `src/generated/tauri.ts`, `src/components/GitManager.tsx`
  - Responsibility: run git subprocess work safely, expose bounded results, and avoid excessive refresh loops.
- **Preview boundary**
  - Files: `src-tauri/src/fs_commands.rs`, `src/components/FileExplorer.tsx`
  - Responsibility: load previewable content safely, reject oversized or unsupported content cheaply, and degrade gracefully.
- **Runtime content reload boundary**
  - Files: `src/App.tsx`, plugin runtime helpers, shader/animation loaders, `src/store/settingsStore.ts`
  - Responsibility: keep live reload useful while avoiding broad scans and unnecessary idle churn.
- **Terminal boundary**
  - Files: `src-tauri/src/terminal.rs`, terminal frontend/runtime code, explorer-to-terminal handoff code
  - Responsibility: maintain responsive PTY behavior under bursty output and common shell workflows.
- **Instrumentation boundary**
  - Files: targeted hot-path helpers, logs, tests, and optional lightweight counters
  - Responsibility: make improvement claims measurable and repeatable.

### Data Flow

1. User-visible explorer, git, or terminal actions trigger frontend orchestration.
2. Frontend runtime decides whether work is necessary based on visibility, staleness, active scope, and mode.
3. Required expensive work crosses the typed Tauri boundary into Rust.
4. Rust executes subprocess, file-read, watcher, or PTY work off the critical interaction path where possible.
5. Results return with enough metadata to drive bounded UI refresh, fallback states, and instrumentation.
6. Validation paths compare targeted before-and-after hot-path behavior.

## Components and Interfaces

### Git execution path
- Purpose: Make source-control refresh safe, bounded, and visibility-aware.
- Inputs: repo path, git args, panel visibility, refresh reason, invalidation events.
- Outputs: structured git result or actionable timeout/failure state, plus timing metadata where feasible.
- Dependencies: `git_exec` in Rust, GitManager orchestration, typed invoke layer.

#### Design notes
- Keep subprocess execution asynchronous and timeout-protected.
- Reduce repeated refresh work for hidden or inactive views.
- Resync on visibility restore with one bounded refresh rather than catch-up churn.
- Prefer explicit invalidation reasons such as focus change, manual refresh, repo mutation, or visibility restore.

### Preview and diff guardrails
- Purpose: Prevent previews from dominating memory or stalling the shell.
- Inputs: selected file entry, file metadata, preview mode, diff request.
- Outputs: inline preview data, metadata fallback, non-text fallback, or actionable error.
- Dependencies: `fs_read_file_base64`, preview logic in `FileExplorer.tsx`, GitManager diff helpers.

#### Design notes
- Preserve current safe-size checks and tighten UI-side fallback behavior where needed.
- Avoid generating text previews or diffs for non-text and oversized content.
- Keep preview failure isolated to the preview surface.

### Runtime reload policy
- Purpose: Keep plugins, shaders, animations, and similar runtime content fresh without broad background tax.
- Inputs: file change events, developer mode, runtime root availability, watcher health.
- Outputs: targeted invalidation and reload actions, backoff polling when watchers are unavailable.
- Dependencies: `App.tsx`, plugin runtime helpers, `settingsStore` developer mode.

#### Design notes
- Prefer watcher-driven reload over repeat scans.
- Keep broad fallback polling developer-mode aware.
- Reload the smallest dependent scope possible.

### Terminal throughput path
- Purpose: Improve command-shell responsiveness under sustained output or rapid interaction.
- Inputs: PTY write bursts, explorer handoff commands, terminal session state.
- Outputs: responsive display updates, bounded backend work, actionable failures.
- Dependencies: `src-tauri/src/terminal.rs`, terminal frontend bindings, shell handoff helpers.

#### Design notes
- Reduce unnecessary flushes or lock contention.
- Preserve correct explorer-to-terminal handoff semantics while avoiding extra work.
- Keep failures recoverable without collapsing the rest of the shell.

### Instrumentation and validation layer
- Purpose: Make hot-path work measurable.
- Inputs: git refreshes, previews, runtime reloads, terminal bursts, manual profiling scenarios.
- Outputs: timings, counts, or validation artifacts tied to spec tasks.
- Dependencies: existing logging/test surfaces plus any added lightweight counters.

#### Design notes
- Use the least invasive instrumentation that still makes regressions visible.
- Prefer targeted measurements over giant generic telemetry systems.

## Data Models

### RefreshReason
- Fields: reason id, visibility state, repo path or surface id, timestamp.
- Validation: reason id must come from a bounded set such as `manual`, `visible-resume`, `repo-change`, `focus-change`, `startup`.
- Relationships: drives when GitManager and related refresh work are allowed to run.

### CommandExecutionResult
- Fields: stdout or payload, optional stderr/error detail, duration, timeout flag, exit state.
- Validation: timeout and failure states must be explicit, not inferred from missing output.
- Relationships: returned from native execution into frontend orchestration.

### ReloadPolicyState
- Fields: watcher active flag, fallback mode flag, backoff interval, developer-mode eligibility.
- Validation: fallback polling must stay bounded; developer-only behavior must respect current settings.
- Relationships: used by plugin, shader, and animation reload flows.

### PerfValidationScenario
- Fields: scenario id, target surface, validation command or manual steps, expected observation.
- Validation: each scenario must map back to one or more requirement IDs.
- Relationships: referenced by tasks and validation artifacts.

## Error Handling

- **Validation failures**: oversized or unsupported preview/diff requests return explicit fallback states instead of partial reads.
- **Dependency failures**: missing watcher support or unstable reload behavior falls back to bounded polling with backoff.
- **Subprocess failures**: git subprocess errors return structured failure information and honor timeout rules.
- **Terminal failures**: PTY or shell errors surface as recoverable session-level errors where possible instead of crashing surrounding UI.
- **Recovery**: visibility restore and retry flows use one bounded refresh or reload pass rather than unbounded catch-up behavior.
- **User-visible errors**: errors should name the blocked capability, why it degraded, and what the user can do next when applicable.

## Testing Strategy

- **Unit**
  - Rust tests for `git_exec` timeout and preview size limits.
  - TS tests for refresh gating, diff fallback logic, and any new scheduling helpers.
- **Integration**
  - GitManager behavior tests covering hidden-to-visible resync and reduced command churn.
  - Plugin/runtime reload tests covering watcher and fallback modes where practical.
- **Scenario or end-to-end**
  - Manual desktop checks for explorer responsiveness, overlay mode, preview behavior, and terminal throughput.
- **Performance and reliability**
  - Targeted profiling scenarios for repo refresh, preview loading, runtime content reload, and terminal bursts.
  - Before/after timing capture for the hottest modified path in each task group.

## Rollout and Operations

- **Configuration**
  - Reuse existing `settings.system.developerMode` for expensive development-only watchers.
  - Avoid introducing broad new feature flags unless a change proves risky enough to require staged exposure.
- **Observability**
  - Add targeted timing/count data for the modified hot paths.
  - Keep validation notes in the spec package for any manual-only checks.
- **Rollout**
  - Land the work in task order so instrumentation and git hardening happen before broader tuning.
  - Prefer small validated slices even within the performance initiative.
- **Rollback**
  - Revert the affected task slice if a performance fix destabilizes shell behavior.
  - Keep degradation logic explicit so fallback states remain safe during rollback.

## Decisions

### Decision: Use a hybrid risk-first sequence
- Context: Git refresh churn and native subprocess behavior are likely the highest leverage performance risks, but the work also needs a reusable validation backbone.
- Options: pure foundation-first, pure feature-slice, pure risk-first, hybrid.
- Decision: Use a hybrid plan that adds instrumentation first, tackles git and refresh risk next, then expands to previews, reload loops, terminal throughput, and validation closure.
- Rationale: This gives fast leverage while keeping future claims measurable.
- Tradeoffs: Some task groups will touch different layers earlier than a neat subsystem-by-subsystem plan would.

### Decision: Preserve feature richness and degrade selectively
- Context: OverlayTerm’s value comes from premium shell behavior, not from becoming a stripped-down file manager.
- Options: remove expensive features aggressively, keep everything with bounded fallbacks, postpone optimization and accept jank.
- Decision: Keep flagship surfaces intact and use bounded fallbacks, targeted invalidation, and execution hardening.
- Rationale: This aligns with the product goal while still attacking real performance cost.
- Tradeoffs: Some fixes require deeper coordination across Rust, TS runtime, and UI layers instead of simply disabling behavior.
