from pathlib import Path
path = Path(r'F:\apps-2d\overlayterm\src\components\GitManager.tsx')
text = path.read_text()
text = text.replace("  }, [runGit, recordGitMetric]);\n\n  const resolveRepoRoot", "  }, [runGit]);\n\n  const resolveRepoRoot")
text = text.replace("  }, [runGit]);\n\n  const loadRepoState", "  }, [runGit, recordGitMetric]);\n\n  const loadRepoState")
text = text.replace("  }, [runGit]);\n\n  const resolveRepoRoot", "  }, [runGit]);\n\n  const resolveRepoRoot")
text = text.replace("  }, [runGit]);\n\n  const safeGit", "  }, [runGit]);\n\n  const safeGit")
# restore recordGitMetric dependency for loadRepoBadge by targeting the function block directly if needed
old = """  const loadRepoBadge = useCallback(async (path: string): Promise<RepoBadgeState> => {
    const startedAt = performance.now();
    try {
      const statusText = await runGit(path, ['status', '--porcelain']);
      const badgeState = buildRepoBadgeState(parseGitStatus(statusText));
      recordGitMetric('git_repo_badge_sync', performance.now() - startedAt, { repoCount: 1 });
      return badgeState;
    } catch (loadError) {
      recordGitMetric('git_repo_badge_sync', performance.now() - startedAt, { repoCount: 1, error: true });
      return {
        changeCount: 0,
        conflictedCount: 0,
        loadedAt: Date.now(),
        error: String(loadError),
      };
    }
  }, [runGit]);
"""
new = """  const loadRepoBadge = useCallback(async (path: string): Promise<RepoBadgeState> => {
    const startedAt = performance.now();
    try {
      const statusText = await runGit(path, ['status', '--porcelain']);
      const badgeState = buildRepoBadgeState(parseGitStatus(statusText));
      recordGitMetric('git_repo_badge_sync', performance.now() - startedAt, { repoCount: 1 });
      return badgeState;
    } catch (loadError) {
      recordGitMetric('git_repo_badge_sync', performance.now() - startedAt, { repoCount: 1, error: true });
      return {
        changeCount: 0,
        conflictedCount: 0,
        loadedAt: Date.now(),
        error: String(loadError),
      };
    }
  }, [runGit, recordGitMetric]);
"""
if old not in text:
    raise SystemExit('loadRepoBadge block not found')
text = text.replace(old, new)
path.write_text(text)
