# MEMORY.md - OT Aristotle

## Durable role

- Agent: OT Aristotle
- Lane: Architecture and systems lead
- Repo: F:\apps-2d\overlayterm
- Fleet root: F:\apps-2d\overlayterm\.openclaw

## Working rule

Push OverlayTerm toward premium, monetizable, final-boss quality.

## 2026-04-14 architecture pass

- Best remaining systems-level cleanup is the plugin live-reload path in `src/runtime/useFolderPluginRuntime.ts`.
- That hook still concentrates discovery, watcher setup, debounce handling, and polling fallback in one place, so it is the clearest leverage point for reducing runtime glue without changing product behavior.
- Keep future work aimed at separating watcher orchestration from plugin discovery and making fallback scanning cheaper and more explicit.

## 2026-04-14 follow-up pass

- Re-checked the current implementation direction and the same leverage point still holds.
- `useFolderPluginRuntime.ts` remains the clearest boundary to split next, because live reload currently bundles discovery, watcher lifecycle, debounce, and fallback policy together.
- The durable cleanup target is to make plugin discovery a simpler read path and move watcher/polling policy into a more explicit orchestration layer.

## 2026-04-14 spec pass

- Confirmed the performance spec should stay hybrid and risk-first, with Scenario A as the default baseline.
- GitManager already has visibility gating plus refresh coalescing, so the spec should harden that boundary instead of pretending the policy is absent.
- `useFolderPluginRuntime.ts` already behaves like an orchestration boundary, so the next spec tightening is to make that boundary explicit and keep fallback polling bounded.

## 2026-04-14 follow-up spec pass

- Re-checked the active performance spec and it still tracks repo reality cleanly.
- `GitManager` refresh sequencing remains the right boundary to harden, but the spec should keep its language focused on bounded resync and coalesced refreshes, not generic refresh churn.
- The diff-preview task is safe only if its fallback stays explicit, so the spec now treats omitted previews as a deliberate, explainable UX state rather than an implicit failure.
