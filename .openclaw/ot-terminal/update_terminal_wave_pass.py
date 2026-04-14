from pathlib import Path

wave = Path(r'F:\apps-2d\overlayterm\.openclaw\OT_WAVE_HANDOFF.md')
text = wave.read_text(encoding='utf-8')
text = text.replace('Last updated: 2026-04-14T11:44:00Z', 'Last updated: 2026-04-14T12:46:00Z')
old = """### ot-terminal -> ot-explorer
- Objective: hand off the verified explorer-to-terminal route, with no terminal backend reopen required in this wave.
- Exact files reviewed: `src/App.tsx`, `src/components/TerminalOverlay.tsx`, `src/components/terminalCommandUtils.ts`, `src/components/FileExplorer.tsx`, `src-tauri/src/terminal.rs`.
- Tests run: `bun test src/test/terminalCommandUtils.test.ts` (pass).
- Blockers: `cargo test --manifest-path src-tauri/Cargo.toml terminal::tests:: -- --nocapture` is still blocked by the local mingw linker missing `-lgcc_eh` / `-lgcc`, and broader Vitest runs remain blocked by unresolved `vitest` / `@vitejs/plugin-react` packages.
- Next steps: explorer lane should check any remaining `onOpenInTerminal` UI labels or documentation only if needed, then stop unless it finds a concrete regression gap.
"""
new = """### ot-terminal -> ot-explorer
- Objective: hand off the verified explorer-to-terminal route, with no terminal backend reopen required in this wave.
- Exact files reviewed: `src/App.tsx`, `src/components/TerminalOverlay.tsx`, `src/components/terminalCommandUtils.ts`, `src/components/FileExplorer.tsx`, `src-tauri/src/terminal.rs`, `src/test/terminalCommandUtils.test.ts`.
- Tests run: `bun test src/test/terminalCommandUtils.test.ts` (pass, current rerun confirmed the PowerShell-args, cmd, and unix path cases).
- Blockers: `cargo test --manifest-path src-tauri/Cargo.toml terminal::tests:: -- --nocapture` is still blocked by the local mingw linker missing `-lgcc_eh` / `-lgcc`, and broader Vitest runs remain blocked by unresolved `vitest` / `@vitejs/plugin-react` packages.
- Next steps: explorer lane only needs a label or docs sanity check around `Open in Terminal` if it finds one, otherwise stop and keep the wave closed.
"""
if old not in text:
    raise SystemExit('target block not found')
text = text.replace(old, new, 1)
# make the ot-runtime -> ot-terminal note reflect the rerun as a follow-through, without reopening code
old2 = """### ot-runtime -> ot-terminal
- Objective: keep terminal follow-through narrow, and only reopen code if a concrete regression gap appears in the shell-aware handoff path.
- Exact files reviewed: `src/components/TerminalOverlay.tsx`, `src/components/terminalCommandUtils.ts`, `src/App.tsx`, `src-tauri/src/terminal.rs`, `src/test/terminalCommandUtils.test.ts`.
- Tests run: `bun test src/test/terminalCommandUtils.test.ts`.
- Result: the shell-aware explorer-to-terminal path is still intact, and the command utility test passed cleanly.
- Blockers: broader Rust validation remains blocked by the local mingw linker missing `-lgcc_eh` / `-lgcc`, and full Vitest/UI runs still fail in this environment because `vitest` / `@vitejs/plugin-react` are unresolved.
- Next move: hand terminal lane off to explorer with the verified path, and do not reopen terminal code unless explorer finds a real regression gap.
"""
new2 = """### ot-runtime -> ot-terminal
- Objective: keep terminal follow-through narrow, and only reopen code if a concrete regression gap appears in the shell-aware handoff path.
- Exact files reviewed: `src/components/TerminalOverlay.tsx`, `src/components/terminalCommandUtils.ts`, `src/App.tsx`, `src-tauri/src/terminal.rs`, `src/test/terminalCommandUtils.test.ts`.
- Tests run: `bun test src/test/terminalCommandUtils.test.ts`.
- Result: the shell-aware explorer-to-terminal path is still intact, and the rerun kept the utility test green.
- Blockers: broader Rust validation remains blocked by the local mingw linker missing `-lgcc_eh` / `-lgcc`, and full Vitest/UI runs still fail in this environment because `vitest` / `@vitejs/plugin-react` are unresolved.
- Next move: hand terminal lane off to explorer with the verified path, and do not reopen terminal code unless explorer finds a real regression gap.
"""
if old2 in text:
    text = text.replace(old2, new2, 1)
wave.write_text(text, encoding='utf-8')

mem = Path(r'F:\apps-2d\overlayterm\.openclaw\ot-terminal\MEMORY.md')
text = mem.read_text(encoding='utf-8')
addition = """

## Hourly wave note

- `bun test src/test/terminalCommandUtils.test.ts` is green again, including the PowerShell-args path case, so the explorer-to-terminal handoff remains verified for this wave closeout.
"""
if addition.strip() not in text:
    text = text.rstrip() + addition + "\n"
mem.write_text(text, encoding='utf-8')
print('updated wave handoff and memory')
