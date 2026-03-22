# Charlie Lane

## Mission

Make OverlayTerm's plugins, themes, shaders, and animations coherent, debuggable, and shippable.

## Teams

- Team 5: implement asset-system workflow, runtime, and diagnostics improvements.
- Team 6: validate Team 5 work, polish operator experience, and keep asset-system release risk honest.

## Focus Areas

- Plugin package discovery, folder-plugin loading, and plugin-manager usability.
- Theme package loading, previews, icons, fonts, and contribution wiring.
- Shader runtime safety, controls, diagnostics, and shell-surface behavior.
- Animation runtime safety, reload behavior, and app open/close polish.
- Refresh, watch, rescan, and folder-open loops across plugin, theme, shader, and animation surfaces.
- Author-facing and operator-facing clarity so drop-in asset workflows feel credible instead of experimental.

## Ranked Backlog

1. Asset-pipeline diagnostics and operator clarity.
   - Tighten how load errors, warnings, and capability summaries surface across `src/components/PluginsManager.tsx`, `src/config/pluginPackages.ts`, and `src/config/themePackages.ts`.
   - Make it obvious which asset or contribution failed, where it came from, and what the operator should do next.
2. Refresh, watch, and reload loop hardening.
   - Tighten the rescan and watcher paths in `src/App.tsx` for plugins, themes, shaders, and animations.
   - Reduce silent no-op reloads, stale signature behavior, and confusing refresh outcomes.
3. Plugin workflow completion.
   - Make the `PluginsManager` preview surface, empty state, load state, and failure handling feel complete and trustworthy.
   - Prefer integrated plugin workflows over “open the folder and guess.”
4. Theme package workflow completion.
   - Tighten manifest handling, preview assets, icon themes, fonts, and package capability reporting.
   - Make theme contributions feel predictable whether they come from the theme folder or plugin packages.
5. Shader and animation runtime polish.
   - Improve invalid-definition handling, fallback behavior, control normalization, and runtime isolation in `src/components/shaderRuntime.tsx` and `src/components/animationRuntime.tsx`.
   - Reduce the chance that custom authored content silently fails or degrades without explanation.
6. Starter content and release proof.
   - Ensure starter folders, examples, and lane docs make author onboarding believable for a ship candidate.
   - Leave concrete validation notes for real plugin/theme/shader/animation authoring loops.

## Execution Order For The Next 2-3 Days

- Day 1 bias:
  - backlog items 1 and 2
- Day 2 bias:
  - backlog items 3, 4, and 5
- Day 3 bias:
  - backlog items 5 and 6, plus cleanup on unfinished earlier work

## Team Selection Rules

- Team 5 should usually take the highest unfinished builder item from the ranked backlog.
- Team 6 should validate the latest Team 5 slice first, then tighten the same workflow or clear the highest-risk remaining blocker.
- Charlie owns plugin/theme/shader/animation core workflow work; Delta should only overlap when a broader app-shell release issue demands it.
- Do not skip to lower-ranked work unless the higher-ranked item is blocked and the blocker is recorded in `handoff.md`.

## Workflow

1. Read `M:\OverlayTerm\automations\global.md`.
2. Read `M:\OverlayTerm\automations\charlie\memory.md`.
3. Read `M:\OverlayTerm\automations\charlie\handoff.md`.
4. Read `M:\OverlayTerm\automations\charlie\report.md`.
5. Pick the highest-value open item that improves asset-system shippability.
6. Make code changes or validation updates.
7. Append concise durable notes to `memory.md`.
8. Refresh `handoff.md` with current status, what changed, what was verified, and the next best step.
9. Refresh `report.md` with current release-risk posture.

## Team 5 Rules

- Prefer integrated asset workflow wins over isolated runtime cleverness.
- Keep solutions data-driven and package-friendly so drop-in content scales.
- Leave precise diagnostics, not mysterious failure states.

## Team 6 Rules

- Verify with targeted tests, live inspection when practical, and release-risk review.
- Tighten docs, diagnostics, fallbacks, and operator affordances rather than reopening broad scope.
- If Team 5 introduced risk, record it sharply and hand back an actionable defect list.
