import { create } from "zustand";
import { useShallow } from "zustand/react/shallow";

export type ExplorerActionRunStatus = "succeeded" | "failed" | "launched";

export interface ExplorerActionRunRecord {
  id: string;
  packId: string;
  actionId: string;
  actionTitle: string;
  actionDirectory: string;
  currentLocation: string;
  selectedPaths: string[];
  outputTarget:
    | "task-center"
    | "preview-terminal"
    | "native-terminal"
    | "silent";
  status: ExplorerActionRunStatus;
  startedAt: number;
  finishedAt: number;
  exitCode: number | null;
  timedOut: boolean;
  runtimeUsed: string;
  commandDisplay: string;
  workingDirectory: string;
  stdout: string;
  stderr: string;
  launchedInNativeTerminal: boolean;
}

interface ExplorerActionRunStoreState {
  runs: Record<string, ExplorerActionRunRecord>;
  runOrder: string[];
  upsertRun: (run: ExplorerActionRunRecord) => void;
  clearRuns: () => void;
}

const EXPLORER_ACTION_RUN_HISTORY_LIMIT = 40;

function normalizeActionRunCollection(
  runs: ExplorerActionRunRecord[],
): Pick<ExplorerActionRunStoreState, "runs" | "runOrder"> {
  const orderedRuns = [...runs]
    .sort((left, right) => right.finishedAt - left.finishedAt)
    .slice(0, EXPLORER_ACTION_RUN_HISTORY_LIMIT);

  return {
    runs: orderedRuns.reduce<Record<string, ExplorerActionRunRecord>>(
      (result, run) => {
        result[run.id] = run;
        return result;
      },
      {},
    ),
    runOrder: orderedRuns.map((run) => run.id),
  };
}

export const useExplorerActionRunStore = create<ExplorerActionRunStoreState>(
  (set) => ({
    runs: {},
    runOrder: [],
    upsertRun: (run) =>
      set((state) =>
        normalizeActionRunCollection([
          ...state.runOrder
            .map((runId) => state.runs[runId])
            .filter(
              (candidate): candidate is ExplorerActionRunRecord =>
                Boolean(candidate && candidate.id !== run.id),
            ),
          run,
        ]),
      ),
    clearRuns: () => set({ runs: {}, runOrder: [] }),
  }),
);

export function recordExplorerActionRun(run: ExplorerActionRunRecord): void {
  useExplorerActionRunStore.getState().upsertRun(run);
}

export function clearExplorerActionRuns(): void {
  useExplorerActionRunStore.getState().clearRuns();
}

export function useExplorerActionRunSnapshots(): ExplorerActionRunRecord[] {
  return useExplorerActionRunStore(
    useShallow((state) =>
      state.runOrder
        .map((runId) => state.runs[runId])
        .filter(
          (run): run is ExplorerActionRunRecord =>
            Boolean(run),
        ),
    ),
  );
}
