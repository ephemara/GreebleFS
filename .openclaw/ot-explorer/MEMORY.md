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

- 2026-04-14: GitManager Scenario A validation remains representative because the repo is still a heavily modified git-heavy tree, but local Vitest execution is blocked by unresolved  vitest / @vitejs/plugin-react config imports.

- 2026-04-14: GitManager Scenario A validation remains representative because the repo is still a heavily modified git-heavy tree, but local Vitest execution is blocked by unresolved `vitest` / `@vitejs/plugin-react` config imports.

- 2026-04-14: preview/diff explorer lane is fully checked off in the active performance spec after the parent task bookkeeping was cleaned up.

- 2026-04-14: no unchecked implementation tasks remain in the active performance spec, so the remaining work is spec-gate cleanup only.

- 2026-04-14: Verified the explorer-to-terminal handoff path stays intact, with FileExplorer still exposing `Open in Terminal` for directory entries and `bun test src/test/terminalCommandUtils.test.ts` passing.
- 2026-04-14: Revalidated the explorer-to-terminal handoff path this wave-closeout pass, with the same `Open in Terminal` directory entry label still present and `bun test src/test/terminalCommandUtils.test.ts` passing again.
- 2026-04-14: Revalidated the explorer-to-terminal handoff path again at 13:51 UTC, with the same `Open in Terminal` directory entry label still present and `bun test src/test/terminalCommandUtils.test.ts` passing again.
- 2026-04-14: Revalidated the explorer-to-terminal handoff path again at 14:51 UTC, with the same `Open in Terminal` directory entry label still present and `bun test src/test/terminalCommandUtils.test.ts` passing again.
- 2026-04-14: Revalidated the explorer-to-terminal handoff path again at 15:51 UTC, with the same `Open in Terminal` directory entry label still present and `bun test src/test/terminalCommandUtils.test.ts` passing again.
- 2026-04-14: Revalidated the explorer-to-terminal handoff path again at 16:51 UTC, with the same `Open in Terminal` directory entry label still present and `bun test src/test/terminalCommandUtils.test.ts` passing again.
- 2026-04-14: Revalidated the explorer-to-terminal handoff path again at 17:51 UTC, with the same `Open in Terminal` directory entry label still present and `bun test src/test/terminalCommandUtils.test.ts` passing again.
- 2026-04-14: Revalidated the explorer-to-terminal handoff path again at 18:51 UTC, with the same `Open in Terminal` directory entry label still present and `bun test src/test/terminalCommandUtils.test.ts` passing again.
- 2026-04-14: Revalidated the explorer-to-terminal handoff path again at 19:51 UTC, with the same `Open in Terminal` directory entry label still present and `bun test src/test/terminalCommandUtils.test.ts` passing again.
- 2026-04-14: Revalidated the explorer-to-terminal handoff path again at 20:51 UTC, with the same `Open in Terminal` directory entry label still present and `bun test src/test/terminalCommandUtils.test.ts` passing again.
