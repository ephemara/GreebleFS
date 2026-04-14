from pathlib import Path
import re

p = Path(r'F:\apps-2d\overlayterm\.openclaw\OT_WAVE_HANDOFF.md')
text = p.read_text(encoding='utf-8')
text = text.replace('Last updated: 2026-04-14T11:32:00Z', 'Last updated: 2026-04-14T11:44:00Z')
pattern = re.compile(r"### ot-runtime -> ot-terminal\n- Pending update\.\n\n### ot-terminal -> ot-explorer\n- Pending update\.", re.S)
replacement = """### ot-runtime -> ot-terminal
- Objective: keep terminal follow-through narrow, and only reopen code if a concrete regression gap appears in the shell-aware handoff path.
- Exact files reviewed: `src/components/TerminalOverlay.tsx`, `src/components/terminalCommandUtils.ts`, `src/App.tsx`, `src-tauri/src/terminal.rs`, `src/test/terminalCommandUtils.test.ts`.
- Tests run: `bun test src/test/terminalCommandUtils.test.ts`.
- Result: the shell-aware explorer-to-terminal path is still intact, and the command utility test passed cleanly.
- Blockers: broader Rust validation remains blocked by the local mingw linker missing `-lgcc_eh` / `-lgcc`, and full Vitest/UI runs still fail in this environment because `vitest` / `@vitejs/plugin-react` are unresolved.
- Next move: hand terminal lane off to explorer with the verified path, and do not reopen terminal code unless explorer finds a real regression gap.

### ot-terminal -> ot-explorer
- Objective: hand off the verified explorer-to-terminal route, with no terminal backend reopen required in this wave.
- Exact files reviewed: `src/App.tsx`, `src/components/TerminalOverlay.tsx`, `src/components/terminalCommandUtils.ts`, `src/components/FileExplorer.tsx`, `src-tauri/src/terminal.rs`.
- Tests run: `bun test src/test/terminalCommandUtils.test.ts` (pass).
- Blockers: `cargo test --manifest-path src-tauri/Cargo.toml terminal::tests:: -- --nocapture` is still blocked by the local mingw linker missing `-lgcc_eh` / `-lgcc`, and broader Vitest runs remain blocked by unresolved `vitest` / `@vitejs/plugin-react` packages.
- Next steps: explorer lane should check any remaining `onOpenInTerminal` UI labels or documentation only if needed, then stop unless it finds a concrete regression gap.
"""
if not pattern.search(text):
    raise SystemExit('target block not found')
text = pattern.sub(replacement, text, count=1)
p.write_text(text, encoding='utf-8')
print('updated', p)
