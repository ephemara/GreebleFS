# Validation: Overlayterm Performance 60Fps

**Spec Type:** standard  
**Slug:** `overlayterm-performance-60fps`  
**Created:** 2026-04-14

## Checklist

- [x] Spec level is appropriate for scope and risk
- [x] Required artifacts are present
- [x] Required headings are complete
- [x] Requirements are testable and unambiguous
- [x] Design traces to requirements
- [x] Tasks trace to requirements

## Baseline Validation Scenarios

### Scenario A: Git-heavy repository responsiveness
- Surface: GitManager plus explorer-adjacent repo workflows
- Goal: detect command churn, hidden-state refresh waste, and slow subprocess handling
- Expected evidence: reduced redundant git executions, bounded visibility-restore resync, safe timeout behavior

### Scenario B: Large and mixed file preview behavior
- Surface: FileExplorer preview and diff flows
- Goal: prove oversized or binary content degrades safely without stalling the shell
- Expected evidence: explicit fallback states, no full inline preview for oversized content, stable explorer interaction

### Scenario C: Runtime content reload behavior
- Surface: plugin, shader, and animation live-reload paths
- Goal: verify developer-mode authoring remains useful while steady-state background tax is bounded
- Expected evidence: watcher-driven or targeted reloads, bounded fallback polling, reduced broad rescans

### Scenario D: Terminal throughput and handoff
- Surface: PTY backend plus explorer-to-terminal handoff
- Goal: verify burst output and contextual shell handoff stay responsive
- Expected evidence: reduced flush or lock pressure, preserved command correctness, actionable failures when things go wrong

## Traceability Checks

- REQ-1 -> Design: Git execution path, visibility-aware resync -> Tasks: 2.1, 2.2, 2.3
- REQ-2 -> Design: Preview and diff guardrails -> Tasks: 3.1, 3.2
- REQ-3 -> Design: Runtime reload policy -> Tasks: 4.1, 4.2
- REQ-4 -> Design: Terminal throughput path -> Tasks: 5.1, 5.2
- REQ-5 -> Design: Instrumentation and validation layer -> Tasks: 1.1, 1.2, 2.2, 3.2, 4.2, 5.1, 6.1, 6.2
- REQ-6 -> Design: Degradation rules and rollout -> Tasks: 2.3, 3.1, 4.1, 5.2, 6.1, 6.2
- NFR-1 -> Design: async/off-thread work, visible-only policies -> Tasks: 1.1, 2.1, 2.2, 4.1, 4.2, 5.1
- NFR-2 -> Design: fallbacks and recovery -> Tasks: 2.1, 2.3, 3.1, 3.2, 4.1, 5.1, 5.2
- NFR-3 -> Design: validation and traceability -> Tasks: 1.1, 1.2, 2.2, 3.2, 4.2, 6.1, 6.2

## Open Issues

- The exact default 60 FPS comparison baseline still needs to be chosen from the documented scenarios.
- Some performance proof will likely require manual desktop-runtime checks, not only headless test coverage.
- Existing local dependency or environment issues may block some test commands, and those blockers must be recorded honestly in execution notes.

## Approval

- Reviewer: OT Cleo / OverlayTerm coordination lane
- Status: Draft
- Notes: Initial standard spec created from live repo architecture and current `SHIPPLAN.md` priorities. Ready for execution and refinement during implementation.
