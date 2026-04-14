from pathlib import Path
path = Path(r'F:\apps-2d\overlayterm\.specs\overlayterm-performance-60fps\tasks.md')
text = path.read_text()
text = text.replace('- [ ] 5.1 Inspect and reduce terminal backend flush or lock pressure', '- [x] 5.1 Inspect and reduce terminal backend flush or lock pressure')
path.write_text(text)
