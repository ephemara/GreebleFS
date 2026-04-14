from pathlib import Path
path = Path(r'F:\apps-2d\overlayterm\src\components\GitManager.tsx')
text = path.read_text()
text = text.replace("  }, [runGit, recordGitMetric]);\n\n  const resolveRepoRoot = useCallback(async (path: string) => {", "  }, [runGit]);\n\n  const resolveRepoRoot = useCallback(async (path: string) => {")
text = text.replace("  }, [runGit]);\n\n  const loadRepoBadge = useCallback(async (path: string): Promise<RepoBadgeState> => {", "  }, [runGit, recordGitMetric]);\n\n  const loadRepoBadge = useCallback(async (path: string): Promise<RepoBadgeState> => {")
text = text.replace("  }, [runGit, recordGitMetric]);\n\n  const resolveRepoRoot = useCallback(async (path: string) => {", "  }, [runGit]);\n\n  const resolveRepoRoot = useCallback(async (path: string) => {")
text = text.replace("  }, [runGit, recordGitMetric]);\n\n  const safeGit = useCallback(async (repo: string, args: string[], fallback = '') => {", "  }, [runGit]);\n\n  const safeGit = useCallback(async (repo: string, args: string[], fallback = '') => {")
path.write_text(text)
