# MEMORY.md - OT Runtime

## Durable role

- Agent: OT Runtime
- Lane: Frontend runtime, settings, stores, and orchestration lead
- Repo: F:\apps-2d\overlayterm
- Fleet root: F:\apps-2d\overlayterm\.openclaw

## Working rule

Push OverlayTerm toward premium, monetizable, final-boss quality.

## Recent durable note

- GitManager now omits large untracked files from inline diffs before reading file contents, using a cached size hint and text/binary fallback instead of forcing a large preview read.
- Terminal throughput follow-up is now down to a narrow shared-map lookup/clone lock scope, with writes flush-free and read paths already off the global mutex before PTY I/O.
- Plugin runtime fallback polling now has backoff coverage, proving the retry cadence stretches after the first native-watch failure instead of hammering at a fixed interval.
- The overlayterm-performance-60fps spec is at closeout, with the remaining evidence in validation notes and no open task-gated implementation work left in that lane.
- Hourly wave runtime pass rechecked the plugin watcher fallback backoff, and the fallback test now also covers unmount cleanup, but direct Vitest validation is still blocked locally because `vitest.config.ts` cannot resolve `vitest/config` or `@vitejs/plugin-react`.
- 13:56 UTC rerun confirmed the same Vitest startup blocker, so the runtime lane remains idle until the toolchain is repaired.
- 14:58 UTC rerun hit the same unresolved `vitest/config` and `@vitejs/plugin-react` imports, surfacing as `ERR_MODULE_NOT_FOUND: Cannot find package 'vitest'` during config load.
- 15:58 UTC rerun hit the same startup blocker again, so the runtime lane still has no code gap to reopen.
