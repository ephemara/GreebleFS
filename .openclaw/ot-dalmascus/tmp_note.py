from pathlib import Path
path = Path(r'F:\apps-2d\overlayterm\.specs\overlayterm-performance-60fps\validation.md')
text = path.read_text()
insert = """- 2026-04-14, git_exec hardening verification pass: confirmed the backend already enforces a 20s timeout, returns exit code plus stderr/stdout context on failure, and runs in `spawn_blocking` so the UI thread stays clear.
- Validation attempt: `cargo test --manifest-path src-tauri/Cargo.toml git_exec -- --nocapture` failed in the local environment because `x86_64-w64-mingw32-gcc` could not link `-lgcc_eh` / `-lgcc`.
"""
marker = "- Validation attempt: `bunx vitest run src/test/performanceTelemetry.test.ts` failed locally because the repo environment could not resolve `vitest` from `vitest.config.ts`.\n"
if insert.strip() in text:
    raise SystemExit('already inserted')
text = text.replace(marker, marker + insert)
path.write_text(text)
