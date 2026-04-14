from pathlib import Path

updates = [
    (Path(r'F:\apps-2d\overlayterm\.openclaw\ot-terminal\MEMORY.md'), "\n\n## Terminal throughput note\n\n- `src-tauri/src/terminal.rs` no longer flushes after every PTY write, so bursty terminal input should spend less time under the terminal mutex and avoid unnecessary flush pressure.\n"),
    (Path(r'F:\apps-2d\overlayterm\SHIPPLAN.md'), "\n### 2026-04-14 terminal throughput\n- Removed per-write PTY flushes in the native terminal manager so the hot input path is lighter under bursty shell activity.\n- Validation attempt: `cargo test --manifest-path src-tauri/Cargo.toml terminal::tests:: -- --nocapture` was blocked by the local `x86_64-w64-mingw32-gcc` linker missing `-lgcc_eh` / `-lgcc`.\n"),
    (Path(r'F:\apps-2d\overlayterm\.specs\overlayterm-performance-60fps\validation.md'), "\n## Execution Notes\n\n- 2026-04-14, terminal throughput pass: removed per-write flushes from `src-tauri/src/terminal.rs` to reduce PTY write pressure.\n- Validation attempt: `cargo test --manifest-path src-tauri/Cargo.toml terminal::tests:: -- --nocapture` failed in the local environment because `x86_64-w64-mingw32-gcc` could not link `-lgcc_eh` / `-lgcc`.\n")
]

for path, addition in updates:
    text = path.read_text(encoding='utf-8')
    if addition.strip() not in text:
        path.write_text(text.rstrip() + addition, encoding='utf-8')
        print('updated', path)
    else:
        print('already had', path)
