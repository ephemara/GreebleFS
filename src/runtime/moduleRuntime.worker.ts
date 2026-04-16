import { transpileRuntimeModuleSourceLocal } from './moduleRuntimeCore';

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

interface TranspileRuntimeModuleSourceTask {
  source: string;
  prependCode?: string;
}

function isTranspileRuntimeModuleSourceTask(value: unknown): value is TranspileRuntimeModuleSourceTask {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const record = value as Record<string, unknown>;
  return typeof record.source === 'string'
    && (record.prependCode === undefined || typeof record.prependCode === 'string');
}

async function handleRequest(message: WorkerRequestEnvelope): Promise<WorkerResponseEnvelope> {
  switch (message.taskType) {
    case 'transpile-runtime-module-source': {
      if (!isTranspileRuntimeModuleSourceTask(message.payload)) {
        throw new Error('Invalid runtime-module transpile payload.');
      }

      const result = await transpileRuntimeModuleSourceLocal(
        message.payload.source,
        message.payload.prependCode ?? '',
      );
      return {
        kind: 'response',
        requestId: message.requestId,
        success: true,
        payload: result,
      };
    }
    default:
      throw new Error(`Unsupported runtime worker task "${message.taskType}".`);
  }
}

self.addEventListener('message', (event: MessageEvent<WorkerRequestEnvelope>) => {
  const message = event.data;
  if (!message || message.kind !== 'request') {
    return;
  }

  void handleRequest(message)
    .then((response) => {
      self.postMessage(response);
    })
    .catch((error) => {
      const response: WorkerResponseEnvelope = {
        kind: 'response',
        requestId: message.requestId,
        success: false,
        error: String(error),
      };
      self.postMessage(response);
    });
});
