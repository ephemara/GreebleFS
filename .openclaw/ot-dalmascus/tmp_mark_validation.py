from pathlib import Path
path = Path(r'F:\apps-2d\overlayterm\.specs\overlayterm-performance-60fps\tasks.md')
text = path.read_text()
text = text.replace('- [ ] 6.1 Run targeted validation across each modified hot path', '- [x] 6.1 Run targeted validation across each modified hot path')
path.write_text(text)
