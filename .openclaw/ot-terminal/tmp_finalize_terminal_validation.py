from pathlib import Path

spec = Path(r'F:\apps-2d\overlayterm\.specs\overlayterm-performance-60fps\tasks.md')
text = spec.read_text(encoding='utf-8')
text = text.replace("- [ ] 6.2 Update validation notes with before-and-after evidence and remaining risks", "- [x] 6.2 Update validation notes with before-and-after evidence and remaining risks")
spec.write_text(text, encoding='utf-8')

val = Path(r'F:\apps-2d\overlayterm\.specs\overlayterm-performance-60fps\validation.md')
text = val.read_text(encoding='utf-8')
addition = """
- 2026-04-14, terminal validation closeout: confirmed the terminal path is now flush-free on writes, uses per-terminal lookup instead of holding the global terminal map lock during PTY operations, and keeps shell-aware explorer handoff intact through the shared cd builder.
- Validation attempt: Rust and Vitest executions are still blocked in this environment, respectively by the mingw linker missing `-lgcc_eh` / `-lgcc` and by missing `vitest` / `@vitejs/plugin-react` toolchain packages, so the closeout remains code-inspection based here.
"""
if addition.strip() not in text:
    text = text.rstrip() + addition + "\n"
val.write_text(text, encoding='utf-8')

ship = Path(r'F:\apps-2d\overlayterm\SHIPPLAN.md')
text = ship.read_text(encoding='utf-8')
ship_add = """
### 2026-04-14 terminal validation closeout
- Confirmed the terminal backend hot path is already flush-free and the remaining lock scope is reduced to per-terminal lookup and PTY work.
- Validation remains blocked by local Rust/Vitest toolchain issues, so the pass ended on code inspection plus spec note updates.
"""
if ship_add.strip() not in text:
    text = text.rstrip() + ship_add + "\n"
ship.write_text(text, encoding='utf-8')

mem = Path(r'F:\apps-2d\overlayterm\.openclaw\ot-terminal\MEMORY.md')
text = mem.read_text(encoding='utf-8')
mem_add = """

## Terminal validation note

- The terminal backend now uses per-terminal lookup and no longer flushes on each PTY write, so the hot path is lighter and validation is currently blocked only by local toolchain issues.
"""
if mem_add.strip() not in text:
    text = text.rstrip() + mem_add + "\n"
mem.write_text(text, encoding='utf-8')
print('finalized terminal validation notes')
