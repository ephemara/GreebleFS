import { runFrontendWorkerTask } from './workerHost';
import {
  computeExplorerBaseVisibleEntries,
  EXPLORER_VISIBLE_ENTRIES_WORKER_TASK_TYPE,
  type ExplorerVisibleEntriesComputeInput,
} from './explorerVisibleEntries';
import type { ExplorerFileEntry as FileEntry } from './explorerBackend';

export async function computeExplorerBaseVisibleEntriesInBackground<
  TEntry extends FileEntry,
>(
  input: ExplorerVisibleEntriesComputeInput<TEntry>,
): Promise<TEntry[]> {
  return runFrontendWorkerTask({
    laneId: 'explorer-compute',
    taskType: EXPLORER_VISIBLE_ENTRIES_WORKER_TASK_TYPE,
    payload: input,
    fallback: async () => computeExplorerBaseVisibleEntries(input),
  });
}
