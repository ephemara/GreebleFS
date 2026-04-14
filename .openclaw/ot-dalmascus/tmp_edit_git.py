from pathlib import Path
path = Path(r'F:\apps-2d\overlayterm\src\components\GitManager.tsx')
text = path.read_text()
text = text.replace("""import { multiplyColorAlpha, type ResolvedOverlayAppearance } from '../config/appearance';
""", """import { multiplyColorAlpha, type ResolvedOverlayAppearance } from '../config/appearance';
import { recordExplorerPerformanceSample } from '../config/performanceTelemetry';
""")
text = text.replace("""  const runGit = useCallback(async (repo: string, args: string[]) => {
    return commands.gitExec(repo, args).then(unwrapTauriResult);
  }, []);
""", """  const runGit = useCallback(async (repo: string, args: string[]) => {
    return commands.gitExec(repo, args).then(unwrapTauriResult);
  }, []);

  const recordGitMetric = useCallback((metricId: 'git_repo_state_load' | 'git_repo_badge_sync', durationMs: number, metadata: Record<string, string | number | boolean | null> = {}) => {
    recordExplorerPerformanceSample({ metricId, durationMs, metadata });
  }, []);
""")
text = text.replace("""  const loadRepoBadge = useCallback(async (path: string): Promise<RepoBadgeState> => {
    try {
      const statusText = await runGit(path, ['status', '--porcelain']);
      return buildRepoBadgeState(parseGitStatus(statusText));
    } catch (loadError) {
""", """  const loadRepoBadge = useCallback(async (path: string): Promise<RepoBadgeState> => {
    const startedAt = performance.now();
    try {
      const statusText = await runGit(path, ['status', '--porcelain']);
      const badgeState = buildRepoBadgeState(parseGitStatus(statusText));
      recordGitMetric('git_repo_badge_sync', performance.now() - startedAt, { repoCount: 1, selectedRepo: path === selectedRepo });
      return badgeState;
    } catch (loadError) {
      recordGitMetric('git_repo_badge_sync', performance.now() - startedAt, { repoCount: 1, selectedRepo: path === selectedRepo, error: true });
""")
text = text.replace("""  const loadRepoState = useCallback(async (path: string) => {
    const currentLoad = repoStateLoadInFlightRef.current;
""", """  const loadRepoState = useCallback(async (path: string) => {
    const startedAt = performance.now();
    const currentLoad = repoStateLoadInFlightRef.current;
""")
text = text.replace("""        setRepoBadges(current => ({ ...current, [path]: buildRepoBadgeState(status) }));
""", """        setRepoBadges(current => ({ ...current, [path]: buildRepoBadgeState(status) }));
        recordGitMetric('git_repo_state_load', performance.now() - startedAt, {
          repoPathLength: path.length,
          statusCount: status.length,
          hadBranch: branch.trim() ? true : false,
        });
""")
text = text.replace("""        setRepoBadges(current => ({
          ...current,
          [path]: {
""", """        recordGitMetric('git_repo_state_load', performance.now() - startedAt, {
          repoPathLength: path.length,
          error: true,
        });
        setRepoBadges(current => ({
          ...current,
          [path]: {
""")
path.write_text(text)
