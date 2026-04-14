from pathlib import Path
path = Path(r'F:\apps-2d\overlayterm\.specs\overlayterm-performance-60fps\validation.md')
text = path.read_text()
insert = """- 2026-04-14, 6.1 validation pass: attempted direct validation of the modified hot paths, but the local Rust toolchain is still blocked by `x86_64-w64-mingw32-gcc` missing `-lgcc_eh` / `-lgcc` before the tests can execute.
- Validation attempt: `cargo test --manifest-path src-tauri/Cargo.toml git_exec -- --nocapture` failed for the linker reason above.
- Validation attempt: `cargo test --manifest-path src-tauri/Cargo.toml terminal::tests::command_exists_uses_path_and_pathext_lookup -- --nocapture` failed for the linker reason above.
"""
marker = "- Validation attempt: `cargo test --manifest-path src-tauri/Cargo.toml git_exec -- --nocapture` failed in the local environment because `x86_64-w64-mingw32-gcc` could not link `-lgcc_eh` / `-lgcc`.\n"
if insert.strip() in text:
    raise SystemExit('already inserted')
text = text.replace(marker, marker + insert)
path.write_text(text)
