from pathlib import Path
path = Path(r'F:\apps-2d\overlayterm\.specs\overlayterm-performance-60fps\tasks.md')
text = path.read_text()
text = text.replace('- [ ] 5.2 Verify explorer-to-terminal handoff remains fast and correct', '- [x] 5.2 Verify explorer-to-terminal handoff remains fast and correct')
path.write_text(text)
