export type FrontendWorkerLaneId = 'runtime-module' | 'explorer-compute';

export interface FrontendWorkerLaneTelemetry {
  activeTaskCount: number;
  completedTaskCount: number;
  errorCount: number;
  fallbackCount: number;
  lastDurationMs: number | null;
  lastError: string | null;
  workerAvailable: boolean;
}

export interface FrontendWorkerTelemetrySnapshot {
  lanes: Record<FrontendWorkerLaneId, FrontendWorkerLaneTelemetry>;
}

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

interface PendingWorkerTask {
  startedAt: number;
  resolve: (value: unknown) => void;
  reject: (error: unknown) => void;
}

interface WorkerLaneDefinition {
  createWorker: () => Worker;
}

const workerLaneDefinitions: Record<FrontendWorkerLaneId, WorkerLaneDefinition> = {
  'runtime-module': {
    createWorker: () => new Worker(new URL('./moduleRuntime.worker.ts', import.meta.url), { type: 'module' }),
  },
  'explorer-compute': {
    createWorker: () => new Worker(new URL('./explorerVisibleEntries.worker.ts', import.meta.url), { type: 'module' }),
  },
};

const workerTelemetryListeners = new Set<(snapshot: FrontendWorkerTelemetrySnapshot) => void>();

function createEmptyLaneTelemetry(): FrontendWorkerLaneTelemetry {
  return {
    activeTaskCount: 0,
    completedTaskCount: 0,
    errorCount: 0,
    fallbackCount: 0,
    lastDurationMs: null,
    lastError: null,
    workerAvailable: typeof Worker !== 'undefined' && !isWorkerRuntimeDisabled(),
  };
}

let workerTelemetrySnapshot: FrontendWorkerTelemetrySnapshot = {
  lanes: {
    'runtime-module': createEmptyLaneTelemetry(),
    'explorer-compute': createEmptyLaneTelemetry(),
  },
};

function getPerformanceNow(): number {
  return typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();
}

function isWorkerRuntimeDisabled(): boolean {
  const env = (import.meta as unknown as { env?: Record<string, unknown> }).env;
  return env?.MODE === 'test' || Boolean(env?.VITEST);
}

function updateLaneTelemetry(
  laneId: FrontendWorkerLaneId,
  updater: (current: FrontendWorkerLaneTelemetry) => FrontendWorkerLaneTelemetry,
): void {
  workerTelemetrySnapshot = {
    lanes: {
      ...workerTelemetrySnapshot.lanes,
      [laneId]: updater(workerTelemetrySnapshot.lanes[laneId]),
    },
  };

  for (const listener of workerTelemetryListeners) {
    listener(readFrontendWorkerTelemetrySnapshot());
  }
}

class WorkerLaneRuntime {
  private readonly definition: WorkerLaneDefinition;

  private worker: Worker | null = null;

  private bootFailed = false;

  private nextRequestId = 1;

  private readonly pendingTasks = new Map<number, PendingWorkerTask>();

  constructor(
    private readonly laneId: FrontendWorkerLaneId,
    definition: WorkerLaneDefinition,
  ) {
    this.definition = definition;
  }

  async runTask<Result>(taskType: string, payload: unknown, fallback: () => Promise<Result>): Promise<Result> {
    if (typeof Worker === 'undefined' || isWorkerRuntimeDisabled()) {
      return this.runFallbackTask(fallback, null);
    }

    const worker = this.getOrCreateWorker();
    if (!worker) {
      return this.runFallbackTask(fallback, null);
    }

    const requestId = this.nextRequestId;
    this.nextRequestId += 1;

    updateLaneTelemetry(this.laneId, current => ({
      ...current,
      activeTaskCount: current.activeTaskCount + 1,
      workerAvailable: true,
    }));

    const result = await new Promise<Result>((resolve, reject) => {
      this.pendingTasks.set(requestId, {
        startedAt: getPerformanceNow(),
        resolve: value => resolve(value as Result),
        reject,
      });
      const message: WorkerRequestEnvelope = {
        kind: 'request',
        requestId,
        taskType,
        payload,
      };
      worker.postMessage(message);
    });

    return result;
  }

  private getOrCreateWorker(): Worker | null {
    if (this.bootFailed) {
      return null;
    }

    if (this.worker) {
      return this.worker;
    }

    try {
      const worker = this.definition.createWorker();
      worker.addEventListener('message', this.handleMessage);
      worker.addEventListener('error', this.handleError);
      this.worker = worker;
      updateLaneTelemetry(this.laneId, current => ({
        ...current,
        workerAvailable: true,
      }));
      return worker;
    } catch (error) {
      this.bootFailed = true;
      updateLaneTelemetry(this.laneId, current => ({
        ...current,
        workerAvailable: false,
        lastError: String(error),
      }));
      return null;
    }
  }

  private readonly handleMessage = (event: MessageEvent<WorkerResponseEnvelope>) => {
    const message = event.data;
    if (!message || message.kind !== 'response') {
      return;
    }

    const pendingTask = this.pendingTasks.get(message.requestId);
    if (!pendingTask) {
      return;
    }

    this.pendingTasks.delete(message.requestId);
    const durationMs = getPerformanceNow() - pendingTask.startedAt;
    updateLaneTelemetry(this.laneId, current => ({
      ...current,
      activeTaskCount: Math.max(0, current.activeTaskCount - 1),
      completedTaskCount: current.completedTaskCount + 1,
      errorCount: message.success ? current.errorCount : current.errorCount + 1,
      lastDurationMs: durationMs,
      lastError: message.success ? current.lastError : (message.error ?? 'Unknown worker error'),
      workerAvailable: true,
    }));

    if (message.success) {
      pendingTask.resolve(message.payload);
      return;
    }

    pendingTask.reject(new Error(message.error ?? 'Unknown worker error'));
  };

  private readonly handleError = (event: ErrorEvent) => {
    this.bootFailed = true;
    this.worker?.removeEventListener('message', this.handleMessage);
    this.worker?.removeEventListener('error', this.handleError);
    this.worker = null;

    updateLaneTelemetry(this.laneId, current => ({
      ...current,
      workerAvailable: false,
      lastError: event.message || 'Worker runtime failed',
    }));

    for (const [requestId, pendingTask] of this.pendingTasks) {
      this.pendingTasks.delete(requestId);
      pendingTask.reject(new Error(event.message || 'Worker runtime failed'));
    }
  };

  private async runFallbackTask<Result>(fallback: () => Promise<Result>, error: unknown): Promise<Result> {
    updateLaneTelemetry(this.laneId, current => ({
      ...current,
      fallbackCount: current.fallbackCount + 1,
      workerAvailable: false,
      lastError: error == null ? current.lastError : String(error),
    }));
    return fallback();
  }
}

const laneRuntimes: Record<FrontendWorkerLaneId, WorkerLaneRuntime> = {
  'runtime-module': new WorkerLaneRuntime('runtime-module', workerLaneDefinitions['runtime-module']),
  'explorer-compute': new WorkerLaneRuntime('explorer-compute', workerLaneDefinitions['explorer-compute']),
};

export async function runFrontendWorkerTask<Result>(args: {
  laneId: FrontendWorkerLaneId;
  taskType: string;
  payload: unknown;
  fallback: () => Promise<Result>;
}): Promise<Result> {
  try {
    return await laneRuntimes[args.laneId].runTask(args.taskType, args.payload, args.fallback);
  } catch (error) {
    updateLaneTelemetry(args.laneId, current => ({
      ...current,
      fallbackCount: current.fallbackCount + 1,
      errorCount: current.errorCount + 1,
      workerAvailable: false,
      lastError: String(error),
    }));
    return args.fallback();
  }
}

export function readFrontendWorkerTelemetrySnapshot(): FrontendWorkerTelemetrySnapshot {
  return {
    lanes: {
      'runtime-module': { ...workerTelemetrySnapshot.lanes['runtime-module'] },
      'explorer-compute': { ...workerTelemetrySnapshot.lanes['explorer-compute'] },
    },
  };
}

export function subscribeFrontendWorkerTelemetry(
  listener: (snapshot: FrontendWorkerTelemetrySnapshot) => void,
): () => void {
  workerTelemetryListeners.add(listener);
  listener(readFrontendWorkerTelemetrySnapshot());
  return () => {
    workerTelemetryListeners.delete(listener);
  };
}

export function resetFrontendWorkerTelemetryForTests(): void {
  workerTelemetrySnapshot = {
    lanes: {
      'runtime-module': createEmptyLaneTelemetry(),
      'explorer-compute': createEmptyLaneTelemetry(),
    },
  };
}
