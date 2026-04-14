from pathlib import Path
path = Path(r'F:\apps-2d\overlayterm\.specs\overlayterm-performance-60fps\tasks.md')
text = path.read_text()
text = text.replace('- [ ] 6.2 Update validation notes with before-and-after evidence and remaining risks', '- [x] 6.2 Update validation notes with before-and-after evidence and remaining risks')
path.write_text(text)
