from pathlib import Path
path = Path(r'F:\apps-2d\overlayterm\src\components\GitManager.tsx')
text = path.read_text()
text = text.replace("recordGitMetric('git_repo_badge_sync', performance.now() - startedAt, { repoCount: 1, selectedRepo: path === selectedRepo });", "recordGitMetric('git_repo_badge_sync', performance.now() - startedAt, { repoCount: 1 });")
text = text.replace("recordGitMetric('git_repo_badge_sync', performance.now() - startedAt, { repoCount: 1, selectedRepo: path === selectedRepo, error: true });", "recordGitMetric('git_repo_badge_sync', performance.now() - startedAt, { repoCount: 1, error: true });")
text = text.replace("  }, [runGit]);\n", "  }, [runGit, recordGitMetric]);\n", 1)
text = text.replace("  }, [runGit, safeGit, selectedRepo]);\n", "  }, [runGit, safeGit, recordGitMetric]);\n")
path.write_text(text)
