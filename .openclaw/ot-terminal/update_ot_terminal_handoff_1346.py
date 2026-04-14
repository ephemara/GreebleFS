from pathlib import Path

wave = Path(r'F:\apps-2d\overlayterm\.openclaw\OT_WAVE_HANDOFF.md')
text = wave.read_text(encoding='utf-8')
text = text.replace('Last updated: 2026-04-14T13:44:00Z', 'Last updated: 2026-04-14T13:46:00Z')
old = """### ot-terminal -> ot-explorer
- Objective: hand off the verified explorer-to-terminal route, with no terminal backend reopen required in this wave.
- Exact files reviewed: `src/App.tsx`, `src/components/TerminalOverlay.tsx`, `src/components/terminalCommandUtils.ts`, `src/components/FileExplorer.tsx`, `src-tauri/src/terminal.rs`, `src/test/terminalCommandUtils.test.ts`.
- Tests run: `bun test src/test/terminalCommandUtils.test.ts` (pass, current rerun confirmed the PowerShell-args, cmd, and unix path cases).
- Blockers: `cargo test --manifest-path src-tauri/Cargo.toml terminal::tests:: -- --nocapture` is still blocked by the local mingw linker missing `-lgcc_eh` / `-lgcc`, and broader Vitest runs remain blocked by unresolved `vitest` / `@vitejs/plugin-react` packages.
- Next steps: explorer lane only needs a label or docs sanity check around `Open in Terminal` if it finds one, otherwise stop and keep the wave closed.
"""
new = """### ot-terminal -> ot-explorer
- Objective: hand off the verified explorer-to-terminal route, with no terminal backend reopen required in this wave.
- Exact files reviewed: `src/App.tsx`, `src/components/TerminalOverlay.tsx`, `src/components/terminalCommandUtils.ts`, `src/components/FileExplorer.tsx`, `src-tauri/src/terminal.rs`, `src/test/terminalCommandUtils.test.ts`.
- Tests run: `bun test src/test/terminalCommandUtils.test.ts` (pass, rerun at 13:46 UTC confirmed the PowerShell-args, cmd, and unix path cases).
- Direct check: `FileExplorer.tsx` still exposes `Open in Terminal` for directory entries, so the explorer entry point remains in place.
- Blockers: `cargo test --manifest-path src-tauri/Cargo.toml terminal::tests:: -- --nocapture` is still blocked by the local mingw linker missing `-lgcc_eh` / `-lgcc`, and broader Vitest runs remain blocked by unresolved `vitest` / `@vitejs/plugin-react` packages.
- Next steps: explorer lane only needs a label or docs sanity check around `Open in Terminal` if it finds one, otherwise stop and keep the wave closed.
"""
if old not in text:
    raise SystemExit('target block not found')
text = text.replace(old, new, 1)
wave.write_text(text, encoding='utf-8')

mem = Path(r'F:\apps-2d\overlayterm\.openclaw\ot-terminal\MEMORY.md')
text = mem.read_text(encoding='utf-8')
entry = """

## Hourly wave note

- 13:46 UTC rerun: `bun test src/test/terminalCommandUtils.test.ts` stayed green, and `FileExplorer.tsx` still exposes `Open in Terminal` for directory entries.
"""
if '13:46 UTC rerun' not in text:
    text = text.rstrip() + entry + "\n"
mem.write_text(text, encoding='utf-8')
print('updated wave handoff and memory')
