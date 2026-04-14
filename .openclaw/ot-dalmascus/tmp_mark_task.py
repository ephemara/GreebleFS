from pathlib import Path
path = Path(r'F:\apps-2d\overlayterm\.specs\overlayterm-performance-60fps\tasks.md')
text = path.read_text()
text = text.replace('- [ ] 2.1 Finish hardening the `git_exec` backend path', '- [x] 2.1 Finish hardening the `git_exec` backend path')
path.write_text(text)
