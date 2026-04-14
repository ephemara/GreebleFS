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
- The next native pass should revisit terminal backend validation once the toolchain is repaired.
- Repeat check on 2026-04-14: Bun terminal command utility tests still pass, and the Rust shell-resolution target remains blocked by missing `-lgcc_eh` / `-lgcc`.
- Preview sanity check on 2026-04-14: the Rust `fs_read_file_base64` size cap already has direct tests, but direct explorer UI validation is still blocked locally by unresolved `react/jsx-dev-runtime`.
- Hourly wave handoff on 2026-04-14: the plugin watcher fallback path uses a self-scheduling polling loop with exponential backoff capped by `fallbackScanMaxIntervalMs`, and the unmount cleanup branch is covered by the fallback test; direct Vitest execution still fails because `vitest.config.ts` cannot resolve `vitest/config` and `@vitejs/plugin-react` here.
- 2026-04-14, 16:35 UTC pass: rechecked `src/runtime/useFolderPluginRuntime.ts` and `src/test/useFolderPluginRuntime.fallback.test.tsx`; the same Vitest config blocker remains, so the runtime handoff stays validation-only until the toolchain is repaired.
