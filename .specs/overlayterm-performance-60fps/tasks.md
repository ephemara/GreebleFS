# Implementation Plan: Overlayterm Performance 60Fps

**Spec Type:** standard  
**Slug:** `overlayterm-performance-60fps`  
**Created:** 2026-04-14

## Overview

Execute a hybrid risk-first plan: establish baseline instrumentation and validation, harden the native git path plus GitManager refresh policy first, then reduce preview and runtime reload overhead, improve terminal throughput, and finish with regression-proof validation. OT Cleo should coordinate the sequence, OT Aristotle should pressure-test design and architectural boundaries, and implementation agents should execute concrete task groups from this file.

## Sequencing Strategy

- Primary strategy: hybrid, instrumentation-first plus risk-first on git and refresh churn
- Major dependencies:
  - baseline validation before broad performance claims
  - git execution hardening before GitManager policy tuning fully settles
  - preview and runtime reload work should reuse the same fallback and observability mindset
- Parallel work opportunities:
  - preview guardrails can run in parallel with runtime reload policy after git execution hardening starts
  - terminal throughput work can run in parallel once instrumentation patterns are established
  - QA and profiling tasks can shadow each lane as validation hooks become available

## Task Checklist

- [ ] 1. Establish baseline performance instrumentation and validation
- [x] 1.1 Define the baseline scenarios and capture points
  - Objective: Pick the concrete repo, interaction, and shell scenarios that will be used to compare before and after behavior for this initiative.
  - Files/Surfaces: `.specs/overlayterm-performance-60fps/validation.md`, relevant test or script surfaces, optional lightweight timing helpers.
  - Validation: `python F:\ai\openclaw-fork\skills\spec-process-guide\scripts\validate_spec.py overlayterm-performance-60fps` plus a documented manual baseline checklist.
  - _Requirements: REQ-5, NFR-1, NFR-3_
- [x] 1.2 Add targeted timing or count instrumentation for the hottest paths
  - Objective: Capture comparable timings or counts for repo refresh, preview loading, runtime reload, and terminal-heavy flows without building a giant telemetry system.
  - Files/Surfaces: likely `src/components/GitManager.tsx`, `src/components/FileExplorer.tsx`, runtime helpers, and supporting logs or test helpers.
  - Validation: targeted tests or manual logging runs that show timing output for at least the primary scenario.
  - _Requirements: REQ-5, NFR-3_

- [ ] 2. Harden native git execution and reduce GitManager churn
- [x] 2.1 Finish hardening the `git_exec` backend path
  - Objective: Ensure slow or blocked git subprocesses are bounded by timeout and do not stall the app’s critical interaction path.
  - Files/Surfaces: `src-tauri/src/fs_commands.rs`, generated bindings if needed, related Rust tests.
  - Validation: Rust tests for success and timeout behavior, plus manual git-heavy repo checks.
  - _Requirements: REQ-1, NFR-1, NFR-2_
- [x] 2.2 Make GitManager refresh policy visibility-aware and incremental
  - Objective: Preserve the current visibility-gated refresh policy while eliminating redundant refresh stacking and catch-up churn.
  - Files/Surfaces: `src/components/GitManager.tsx`, any supporting scheduling helpers or store/runtime glue.
  - Validation: targeted Vitest coverage for hidden/visible transitions, queued refresh coalescing, and manual verification in a real repo.
  - _Requirements: REQ-1, REQ-5, NFR-1, NFR-3_
- [x] 2.3 Bound visibility-restore resync behavior
  - Objective: Resync once on visibility restore instead of replaying background churn or stacking repeated refresh work.
  - Files/Surfaces: `src/components/GitManager.tsx`, related scheduling helpers.
  - Validation: targeted behavior test and manual panel hide/show scenario.
  - _Requirements: REQ-1, REQ-6, NFR-2_

- [ ] 3. Bound preview and diff cost in explorer-facing flows
- [x] 3.1 Tighten preview fallback behavior around large or unsupported files
  - Objective: Keep preview loading bounded and clearly degradable for oversized, unsupported, or erroring content.
  - Files/Surfaces: `src-tauri/src/fs_commands.rs`, `src/components/FileExplorer.tsx`.
  - Validation: Rust tests for large-file rejection plus manual explorer preview checks for large/binary files.
  - _Requirements: REQ-2, REQ-6, NFR-2_
- [x] 3.2 Reduce untracked diff preview tax in GitManager
  - Objective: Avoid expensive or misleading diff previews for non-text and oversized untracked files while preserving useful user feedback. Prefer a bounded inline fallback, and record when the preview is intentionally omitted so telemetry explains the UX.
  - Files/Surfaces: `src/components/GitManager.tsx`.
  - Validation: targeted test coverage for text, binary, and oversized untracked files, plus a real repo check on a git-heavy working tree with large untracked assets.
  - _Requirements: REQ-2, REQ-5, NFR-2, NFR-3_

- [ ] 4. Reduce runtime asset and plugin background tax
- [x] 4.1 Audit and tighten plugin runtime reload behavior
  - Objective: Prefer watcher-driven or narrowly invalidated plugin reload behavior and bound any polling fallback.
  - Files/Surfaces: plugin runtime helpers, `src/App.tsx`, plugin-related managers or runtime modules.
  - Validation: manual live-reload scenario with developer mode on and steady-state behavior check with developer mode off.
  - _Requirements: REQ-3, REQ-6, NFR-1, NFR-2_
- [x] 4.2 Reduce shader, animation, and related runtime rescan overhead
  - Objective: Reload only changed assets or the smallest safe dependent scope instead of broad rescans.
  - Files/Surfaces: runtime loader code in `src/App.tsx` and related config/runtime helpers.
  - Validation: manual asset-edit scenario and timing comparison against baseline.
  - _Requirements: REQ-3, REQ-5, NFR-1, NFR-3_

- [ ] 5. Improve terminal throughput and shell handoff responsiveness
- [x] 5.1 Inspect and reduce terminal backend flush or lock pressure
  - Objective: Keep PTY handling responsive under bursty output and normal command activity. The current code no longer flushes per write, the read path now drops the shared terminal map mutex before PTY reads, and the remaining hotspot is the shared terminal map mutex around lookup/resize and any other blocking touchpoints.
  - Files/Surfaces: `src-tauri/src/terminal.rs`, terminal frontend/runtime integration code.
  - Validation: terminal-focused manual scenario plus targeted tests where practical.
  - _Requirements: REQ-4, REQ-5, NFR-1, NFR-2_
- [x] 5.2 Verify explorer-to-terminal handoff remains fast and correct
  - Objective: Preserve shell-aware handoff correctness while avoiding extra latency from integration glue.
  - Files/Surfaces: explorer-to-terminal handoff logic in frontend runtime or explorer components.
  - Validation: manual handoff scenarios across PowerShell, cmd, and POSIX-safe command construction where supported.
  - _Requirements: REQ-4, REQ-6, NFR-2_

- [ ] 6. Close the loop with validation, regression protection, and operator proof
- [ ] 6.1 Run targeted validation across each modified hot path
  - Objective: Prove the changed paths work and capture any environment blockers honestly.
  - Files/Surfaces: relevant tests, scripts, `.specs/overlayterm-performance-60fps/validation.md`.
  - Validation: targeted `bun run test`, `bun run test:browser`, `bun run test:rust`, or narrower equivalents where appropriate.
  - _Requirements: REQ-5, REQ-6, NFR-3_
- [ ] 6.2 Update validation notes with before-and-after evidence and remaining risks
  - Objective: Record what improved, what is still noisy, and which follow-up tasks remain for the 60 FPS path.
  - Files/Surfaces: `.specs/overlayterm-performance-60fps/validation.md`, `SHIPPLAN.md` if priorities shift.
  - Validation: spec self-review plus `validate_spec.py`.
  - _Requirements: REQ-5, REQ-6, NFR-3_

## Validation Gates

- [ ] All requirement IDs are covered
- [ ] Dependencies are respected
- [ ] Tests or manual checks are included in the relevant tasks
- [ ] Rollout or rollback notes exist for risky changes
- [ ] The primary 60 FPS baseline scenario is chosen and documented

## Notes and Risks

- Risk: Performance work gets claimed without stable before-and-after measurement.
  Mitigation: Establish scenario baselines first and keep validation notes current.
- Risk: Git and runtime reload optimizations regress shell correctness.
  Mitigation: Use bounded fallbacks and targeted tests around visibility changes, preview behavior, and developer-mode reloads.
- Risk: Terminal tuning improves one shell scenario while regressing another.
  Mitigation: Validate explorer handoff and burst-output scenarios separately.
