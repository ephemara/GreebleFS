from pathlib import Path
path = Path(r'F:\apps-2d\overlayterm\src\components\GitManager.tsx')
text = path.read_text()
text = text.replace("  }, [runGit, recordGitMetric]);\n\n  const resolveRepoRoot", "  }, [runGit]);\n\n  const resolveRepoRoot")
path.write_text(text)
