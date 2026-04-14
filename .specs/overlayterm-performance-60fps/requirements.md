# Requirements: Overlayterm Performance 60Fps

**Spec Type:** standard  
**Slug:** `overlayterm-performance-60fps`  
**Created:** 2026-04-14

## Overview

OverlayTerm is in performance-first mode. The goal of this spec is to remove the highest-leverage sources of UI churn, background tax, and native blocking work so the app can sustain a credible path toward 60 FPS during common explorer, terminal, plugin, and shell interactions. The scope covers the current high-cost paths called out in `SHIPPLAN.md`: git process churn, preview memory spikes, runtime asset scanning, plugin reload overhead, terminal throughput, and missing performance instrumentation.

## User Roles

- **Power user** - Needs explorer, terminal, and source-control workflows to feel fast and stable under real project-sized usage.
- **Theme or plugin author** - Needs live-reload behavior during development without paying unnecessary background cost in normal use.
- **OverlayTerm maintainer** - Needs measurable hot paths, reliable failure handling, and targeted validation so performance fixes do not silently regress.

## Requirements

### REQ-1: Keep repo and git refresh work off the user-critical path
**User Story:** As a power user, I want source-control status and repository refresh work to stay responsive, so that explorer and git surfaces do not hitch during normal navigation.

**Acceptance Criteria**
1. WHEN GitManager or related repo status flows refresh repository state THEN the system SHALL avoid repeated full refresh work for hidden, inactive, or unchanged views unless a user action or explicit invalidation requires it.
2. WHEN `git_exec` or related git subprocess work runs THEN the system SHALL execute it without blocking latency-sensitive UI flows on long-running process waits.
3. IF a git subprocess exceeds the allowed execution window THEN the system SHALL time out the work, terminate or abandon the stuck subprocess safely, and surface actionable error information.
4. WHEN repository state becomes visible again after being backgrounded THEN the system SHALL perform a bounded resync instead of replaying every missed poll cycle.

**Edge Cases**
- Large repositories with frequent file changes.
- Repositories that are temporarily unavailable, slow, or on network-backed paths.
- Repeated visibility toggles between hidden and visible panels.

### REQ-2: Bound preview and diff memory cost
**User Story:** As a power user, I want file previews and untracked diff views to remain useful without causing memory spikes or stalls, so that browsing large projects stays smooth.

**Acceptance Criteria**
1. WHEN a file preview would require loading content beyond the safe inline threshold THEN the system SHALL refuse the full inline preview and provide a clear fallback state or metadata summary.
2. WHEN an untracked diff preview targets non-text or oversized content THEN the system SHALL use a non-text or metadata fallback instead of attempting expensive text diff generation.
3. WHEN preview content is unsupported, binary, or too large THEN the system SHALL present a clear reason and preserve explorer responsiveness.
4. IF preview loading fails at the backend or bridge layer THEN the system SHALL keep the rest of the explorer usable and SHALL not leave the preview pane in a broken busy state.

**Edge Cases**
- Large binary assets.
- Huge generated text files.
- Files that change during preview or save.

### REQ-3: Reduce runtime background tax from plugins, shaders, animations, and scans
**User Story:** As a maintainer or content author, I want runtime asset discovery and live reload to be incremental and mode-aware, so that development remains productive without taxing normal app sessions.

**Acceptance Criteria**
1. WHEN plugin, shader, animation, or related runtime content changes THEN the system SHALL prefer targeted invalidation or file watching over broad full rescans where the runtime supports it.
2. IF watcher-based reload is unavailable or unstable THEN the system SHALL use bounded fallback polling with backoff instead of tight repeat scans.
3. WHEN developer-only live reload behavior is not needed THEN the system SHALL gate expensive watcher or polling behavior behind explicit developer-mode checks or equivalent runtime controls.
4. WHEN runtime content reload occurs THEN the system SHALL reload only the changed surface or the smallest safe dependent scope.

**Edge Cases**
- Watcher instability on specific platforms.
- Burst edits during theme or plugin authoring.
- Missing runtime roots or transient filesystem errors.

### REQ-4: Improve terminal throughput and shell responsiveness
**User Story:** As a power user, I want terminal interaction to stay fluid under sustained output and command activity, so that OverlayTerm feels like a real shell workbench instead of a laggy panel.

**Acceptance Criteria**
1. WHEN the terminal processes sustained output or rapid write bursts THEN the system SHALL avoid unnecessary flush pressure, redundant redraw work, or lock contention that degrades responsiveness.
2. WHEN explorer actions hand off context into terminal workflows THEN the system SHALL preserve correct command behavior without introducing avoidable latency.
3. IF terminal backend work fails or stalls THEN the system SHALL surface recoverable errors and preserve the surrounding shell state where possible.

**Edge Cases**
- High-volume command output.
- Multiple terminal sessions or tabs.
- Slow shell startup or blocked backend writes.

### REQ-5: Add measurable performance observability for hot paths
**User Story:** As an OverlayTerm maintainer, I want hot paths to be instrumented and comparable across passes, so that performance work is guided by evidence instead of guesswork.

**Acceptance Criteria**
1. WHEN high-cost flows such as repo refresh, preview loading, runtime rescans, or terminal bursts execute THEN the system SHALL expose timing or count data sufficient to compare before and after behavior.
2. WHEN a performance fix lands THEN the repo SHALL provide a targeted validation path, benchmark scenario, or profiling checklist that proves the intended hot path improved or at least did not regress.
3. IF a path cannot be fully automated in tests THEN the system SHALL document the manual validation scenario in the spec or matching validation notes.

**Edge Cases**
- Timing noise across machines.
- Native and frontend timing disagreement.
- Flows that are only reproducible in desktop runtime, not headless tests.

### REQ-6: Preserve premium shell behavior while reducing background churn
**User Story:** As a power user, I want OverlayTerm to keep its premium shell features without feeling heavy, so that performance work improves the product instead of stripping its character.

**Acceptance Criteria**
1. WHEN performance fixes reduce background work THEN the system SHALL preserve core shell behavior across explorer, terminal, themes, and plugins rather than removing flagship capabilities outright.
2. WHEN a feature must degrade for safety or speed THEN the system SHALL do so explicitly, predictably, and only as much as needed to protect responsiveness.
3. IF a performance change affects user-visible shell behavior THEN the system SHALL document the intended behavior change and validation path.

**Edge Cases**
- Overlay mode versus full window mode.
- Theme-heavy configurations.
- Mixed workloads using explorer, terminal, and plugin surfaces together.

## Non-Functional Requirements

### NFR-1: 60 FPS-oriented execution budget
- The design SHALL prefer async, batched, visible-only, incremental, or watcher-driven work so common interactive flows can realistically target a 16.7 ms frame budget instead of repeated background saturation.

### NFR-2: Graceful degradation and recoverability
- Timeouts, oversized previews, watcher failures, and runtime scan failures SHALL degrade to bounded fallbacks or actionable errors rather than freezing the shell.

### NFR-3: Traceable validation
- Every major performance task SHALL include a direct validation step, and the spec SHALL preserve traceability from requirements through design and tasks.

## Out of Scope

- Full explorer parity initiatives unrelated to current performance hotspots.
- Large visual redesign work that does not materially affect runtime cost.
- Plugin marketplace or theme ecosystem expansion outside the performance implications of their runtime loaders.
- Deep engine-level Yazi rewrites unless app-layer fixes prove insufficient.

## Open Questions

- Which profiling scenario should become the default 60 FPS comparison baseline: large git repo navigation, heavy preview browsing, overlay-mode shell usage, or a mixed scenario?
- Which instrumentation surface is best for durable timing data: structured logs, dev-only panel diagnostics, or lightweight counters exposed through existing stores?
