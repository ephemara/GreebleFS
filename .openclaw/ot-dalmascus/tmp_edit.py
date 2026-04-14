from pathlib import Path
path = Path(r'F:\apps-2d\overlayterm\src\config\performanceTelemetry.ts')
text = path.read_text()
old = """  overlay_frame_time: {
    label: 'Overlay Frame p95',
    targetMs: 8.3,
    description: 'p95 requestAnimationFrame delta collected while the overlay is visible.',
  },
} as const;
"""
new = """  overlay_frame_time: {
    label: 'Overlay Frame p95',
    targetMs: 8.3,
    description: 'p95 requestAnimationFrame delta collected while the overlay is visible.',
  },
  git_repo_state_load: {
    label: 'Git Repo State Load',
    targetMs: 250,
    description: 'GitManager repo-state refresh from trigger to status payload acceptance.',
  },
  git_repo_badge_sync: {
    label: 'Git Repo Badge Sync',
    targetMs: 120,
    description: 'GitManager badge refresh pass for the active or background repo set.',
  },
} as const;
"""
if old not in text:
    raise SystemExit('pattern not found')
path.write_text(text.replace(old, new))
