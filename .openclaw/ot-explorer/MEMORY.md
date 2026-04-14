# MEMORY.md - OT Explorer

## Durable role

- Agent: OT Explorer
- Lane: File explorer parity and UX lead
- Repo: F:\apps-2d\overlayterm
- Fleet root: F:\apps-2d\overlayterm\.openclaw

## Working rule

Push OverlayTerm toward premium, monetizable, final-boss quality.

### 2026-04-14
- Explorer workspace UX pass: empty-pane and new-tab actions now prefer cloning from the nearest live tab instead of always falling back to the primary instance, which makes dual-pane/tab spawning feel less dead-ended.
- Explorer workspace polish pass: pane path text is now click-to-copy, giving the tab chrome a faster local affordance without adding more buttons.

- 2026-04-14: GitManager refresh policy got a visibility-aware pass, hidden repo-state refreshes now queue until restore, and visibility regain performs one bounded repo-state resync instead of letting refresh churn stack.

- 2026-04-14: GitManager Scenario A validation remains representative because the repo is still a heavily modified git-heavy tree, but local Vitest execution is blocked by unresolved itest / @vitejs/plugin-react config imports.
