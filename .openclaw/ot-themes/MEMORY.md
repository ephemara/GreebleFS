# MEMORY.md - OT Themes

## Durable role

- Agent: OT Themes
- Lane: Theme, layout, and presentation lead
- Repo: F:\apps-2d\overlayterm
- Fleet root: F:\apps-2d\overlayterm\.openclaw

## Working rule

Push OverlayTerm toward premium, monetizable, final-boss quality.

## 2026-04-14 presentation pass

- Tightened `src/config/explorerTheme.ts` base explorer surfaces so default workbench explorer chrome inherits subtle depth instead of fully flat panels.
- Added a regression test in `src/test/explorerTheme.test.ts` for the default layered explorer surface contract.
- Local verification hit an environment issue, `bunx vitest run src/test/explorerTheme.test.ts` could not load `vitest` / `@vitejs/plugin-react` from this workspace, so the change was validated by diff review only.

## 2026-04-14 runtime-content reload pass

- Added developer-mode polling for `src/config/themePackages.ts` so theme package changes now auto-refresh the discovered theme list plus contributed shader and animation inventories.
- `src/App.tsx` now coalesces theme-package rescans behind a queued refresh path, matching the existing authored shader/animation reload pattern and avoiding stacked reloads while a scan is in flight.
- The theme-package polling interval now sits at 5s to reduce steady-state background tax while keeping visible-overlay live reload responsive.
- Validation remains environment-limited here, because the repo’s spec validator still cannot run without `python3` on PATH.
