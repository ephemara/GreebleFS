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
