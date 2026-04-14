# MEMORY.md - OT Native

## Durable role

- Agent: OT Native
- Lane: Rust, Tauri, PTY, watcher, and native systems strike lead
- Repo: F:\apps-2d\overlayterm
- Fleet root: F:\apps-2d\overlayterm\.openclaw

## Working rule

Push OverlayTerm toward premium, monetizable, final-boss quality.

## 2026-04-14 terminal throughput note

- The remaining PTY hot spot is the shared terminal map mutex around lookup and resize, not per-write flushing.
- Terminal instances now get cloned out of the map as `Arc<Mutex<TerminalInstance>>`, so blocking PTY work stays behind the per-terminal mutex.
- Local Rust validation is currently blocked by the mingw linker missing `-lgcc_eh` / `-lgcc`.

## 2026-04-14 shell-handoff note

- `buildTerminalCdCommand` now strips shell arguments before matching shell type, so `pwsh.exe -NoLogo` still gets the PowerShell-safe `Set-Location -LiteralPath` form.
- `TerminalManager::get_shell` now does the same token-first parsing on the Rust side, so shell overrides with wrapper args stay on the intended executable path.
- Targeted Bun validation passed for `src/test/terminalCommandUtils.test.ts`.
- Rust validation is still blocked by the mingw linker missing `-lgcc_eh` / `-lgcc`.
