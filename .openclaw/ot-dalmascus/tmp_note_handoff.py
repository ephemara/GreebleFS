from pathlib import Path
path = Path(r'F:\apps-2d\overlayterm\.specs\overlayterm-performance-60fps\validation.md')
text = path.read_text()
insert = """- 2026-04-14, explorer-to-terminal handoff verification pass: confirmed the handoff command builder already emits PowerShell literal-path, cmd /d, and POSIX-safe cd forms, with quote escaping covered by unit tests.
"""
marker = "- 2026-04-14, terminal lock-pressure pass: confirmed the terminal manager already releases the map mutex before PTY reads and keeps lookup/resize paths scoped to the smallest possible critical section.\n"
if insert.strip() in text:
    raise SystemExit('already inserted')
text = text.replace(marker, marker + insert)
path.write_text(text)
