from pathlib import Path
p = Path(r'F:\apps-2d\overlayterm\.openclaw\OT_WAVE_HANDOFF.md')
text = p.read_text(encoding='utf-8')
text = text.replace('Last updated: 2026-04-14T12:44:00Z', 'Last updated: 2026-04-14T12:46:00Z')
p.write_text(text, encoding='utf-8')
print('timestamp updated')
