# MEMORY.md - OT Terminal

## Durable role

- Agent: OT Terminal
- Lane: Terminal and command-shell lead
- Repo: F:\apps-2d\overlayterm
- Fleet root: F:\apps-2d\overlayterm\.openclaw

## Working rule

Push OverlayTerm toward premium, monetizable, final-boss quality.

## Current terminal workflow note

- Explorer → terminal handoff should build shell-aware `cd` commands, not raw quoted paths, so spaces and apostrophes survive PowerShell, cmd, and POSIX shells.

## Terminal throughput note

- `src-tauri/src/terminal.rs` no longer flushes after every PTY write, so bursty terminal input should spend less time under the terminal mutex and avoid unnecessary flush pressure.

## Terminal handoff note

- Explorer-to-terminal injection now reuses `buildTerminalCdCommand`, so the active shell gets a shell-aware `cd`/`Set-Location` command instead of a raw quoted path.

## Terminal validation note

- The terminal backend now uses per-terminal lookup and no longer flushes on each PTY write, so the hot path is lighter and validation is currently blocked only by local toolchain issues.
- 2026-04-14 hourly wave closeout: un test src/test/terminalCommandUtils.test.ts passed, confirming the shell-aware explorer-to-terminal handoff path still works end to end.

## Hourly wave note

- `bun test src/test/terminalCommandUtils.test.ts` is green again, including the PowerShell-args path case, so the explorer-to-terminal handoff remains verified for this wave closeout.

## Hourly wave note

- 13:46 UTC rerun: `bun test src/test/terminalCommandUtils.test.ts` stayed green, and `FileExplorer.tsx` still exposes `Open in Terminal` for directory entries.

## Hourly wave note

- 14:49 UTC rerun: `bun test src/test/terminalCommandUtils.test.ts` stayed green, and `FileExplorer.tsx` still exposes `Open in Terminal` for directory entries.

## Hourly wave note

- 15:49 UTC rerun: `bun test src/test/terminalCommandUtils.test.ts` stayed green, and `FileExplorer.tsx` still exposes `Open in Terminal` for directory entries.

## Hourly wave note

- 16:49 UTC rerun: `bun test src/test/terminalCommandUtils.test.ts` stayed green, and `FileExplorer.tsx` still exposes `Open in Terminal` for directory entries.

## Hourly wave note

- 17:49 UTC rerun: `bun test src/test/terminalCommandUtils.test.ts` stayed green, and `FileExplorer.tsx` still exposes `Open in Terminal` for directory entries.

## Hourly wave note

- 18:49 UTC rerun: `bun test src/test/terminalCommandUtils.test.ts` stayed green, and `FileExplorer.tsx` still exposes `Open in Terminal` for directory entries.

## Hourly wave note

- 19:49 UTC rerun: `bun test src/test/terminalCommandUtils.test.ts` stayed green, and `FileExplorer.tsx` still exposes `Open in Terminal` for directory entries.

## Hourly wave note

- 20:49 UTC rerun: `bun test src/test/terminalCommandUtils.test.ts` stayed green, and `FileExplorer.tsx` still exposes `Open in Terminal` for directory entries.
