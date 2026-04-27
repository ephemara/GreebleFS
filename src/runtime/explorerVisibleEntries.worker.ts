import {
  computeExplorerBaseVisibleEntries,
  EXPLORER_VISIBLE_ENTRIES_WORKER_TASK_TYPE,
  type ExplorerVisibleEntriesComputeInput,
} from './explorerVisibleEntries';

interface WorkerRequestEnvelope {
  kind: 'request';
  requestId: number;
  taskType: string;
  payload: unknown;
}

interface WorkerResponseEnvelope {
  kind: 'response';
  requestId: number;
  success: boolean;
  payload?: unknown;
  error?: string;
}

function isExplorerVisibleEntriesComputeInput(
  value: unknown,
): value is ExplorerVisibleEntriesComputeInput {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    Array.isArray(record.entries) &&
    Array.isArray(record.activeTagFilterIds) &&
    Array.isArray(record.pathTagAssignments) &&
    typeof record.sortBy === 'string' &&
    (record.sortOrder === 'asc' || record.sortOrder === 'desc')
  );
}

async function handleRequest(
  message: WorkerRequestEnvelope,
): Promise<WorkerResponseEnvelope> {
  switch (message.taskType) {
    case EXPLORER_VISIBLE_ENTRIES_WORKER_TASK_TYPE: {
      if (!isExplorerVisibleEntriesComputeInput(message.payload)) {
        throw new Error('Invalid explorer visible-entries payload.');
      }

      return {
        kind: 'response',
        requestId: message.requestId,
        success: true,
        payload: computeExplorerBaseVisibleEntries(message.payload),
      };
    }
    default:
      throw new Error(
        `Unsupported explorer worker task "${message.taskType}".`,
      );
  }
}

self.addEventListener('message', (event: MessageEvent<WorkerRequestEnvelope>) => {
  const message = event.data;
  if (!message || message.kind !== 'request') {
    return;
  }

  void handleRequest(message)
    .then(response => {
      self.postMessage(response);
    })
    .catch(error => {
      const response: WorkerResponseEnvelope = {
        kind: 'response',
        requestId: message.requestId,
        success: false,
        error: String(error),
      };
      self.postMessage(response);
    });
});
