import { isTauri } from '@tauri-apps/api/core';
import { useEffect } from 'react';
import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import {
  cancelExplorerTask,
  clearExplorerTaskHistory,
  listExplorerTasks,
  listenToExplorerTaskProgress,
  retryExplorerTask,
  type ExplorerTaskHistoryScope,
  type ExplorerTaskSnapshot,
} from '../runtime/explorerBackend';

type ExplorerTaskStoreStatus = 'idle' | 'loading' | 'ready' | 'error';

interface ExplorerTaskStoreState {
  tasks: Record<string, ExplorerTaskSnapshot>;
  taskOrder: string[];
  subscriptionState: ExplorerTaskStoreStatus;
  subscriptionError: string | null;
  hydrationState: ExplorerTaskStoreStatus;
  hydrationError: string | null;
  isTaskCenterOpen: boolean;
  replaceTasks: (tasks: ExplorerTaskSnapshot[]) => void;
  upsertTask: (task: ExplorerTaskSnapshot) => void;
  pruneTasks: (scope: ExplorerTaskHistoryScope) => void;
  setSubscriptionError: (message: string | null) => void;
  setSubscriptionState: (state: ExplorerTaskStoreStatus) => void;
  setHydrationError: (message: string | null) => void;
  setHydrationState: (state: ExplorerTaskStoreStatus) => void;
  setTaskCenterOpen: (open: boolean) => void;
}

let subscriptionPromise: Promise<void> | null = null;
let hydrationPromise: Promise<void> | null = null;
let subscriptionReady = false;

function sortExplorerTasks(tasks: ExplorerTaskSnapshot[]): ExplorerTaskSnapshot[] {
  return [...tasks].sort((left, right) => {
    const leftRunning = left.status === 'running';
    const rightRunning = right.status === 'running';
    if (leftRunning !== rightRunning) {
      return leftRunning ? -1 : 1;
    }

    const leftTime = leftRunning ? left.startedAt : (left.finishedAt ?? left.startedAt);
    const rightTime = rightRunning ? right.startedAt : (right.finishedAt ?? right.startedAt);
    return rightTime - leftTime;
  });
}

function normalizeTaskCollection(tasks: ExplorerTaskSnapshot[]): Pick<ExplorerTaskStoreState, 'tasks' | 'taskOrder'> {
  const orderedTasks = sortExplorerTasks(tasks);
  return {
    tasks: orderedTasks.reduce<Record<string, ExplorerTaskSnapshot>>((result, task) => {
      result[task.id] = task;
      return result;
    }, {}),
    taskOrder: orderedTasks.map((task) => task.id),
  };
}

function shouldPruneTask(task: ExplorerTaskSnapshot, scope: ExplorerTaskHistoryScope): boolean {
  switch (scope) {
    case 'completed':
      return task.status === 'succeeded';
    case 'failed':
      return task.status === 'failed' || task.status === 'cancelled';
    case 'finished':
      return task.status !== 'running';
    default:
      return false;
  }
}

export const useExplorerTaskStore = create<ExplorerTaskStoreState>((set) => ({
  tasks: {},
  taskOrder: [],
  subscriptionState: 'idle',
  subscriptionError: null,
  hydrationState: 'idle',
  hydrationError: null,
  isTaskCenterOpen: false,
  replaceTasks: (tasks) => set(normalizeTaskCollection(tasks)),
  upsertTask: (task) => set((state) => normalizeTaskCollection([
    ...state.taskOrder
      .map((taskId) => state.tasks[taskId])
      .filter((candidate): candidate is ExplorerTaskSnapshot => Boolean(candidate && candidate.id !== task.id)),
    task,
  ])),
  pruneTasks: (scope) => set((state) => normalizeTaskCollection(
    state.taskOrder
      .map((taskId) => state.tasks[taskId])
      .filter((task): task is ExplorerTaskSnapshot => Boolean(task))
      .filter((task) => !shouldPruneTask(task, scope)),
  )),
  setSubscriptionError: (message) => set({
    subscriptionError: message,
    subscriptionState: message ? 'error' : 'ready',
  }),
  setSubscriptionState: (subscriptionState) => set({ subscriptionState }),
  setHydrationError: (message) => set({
    hydrationError: message,
    hydrationState: message ? 'error' : 'ready',
  }),
  setHydrationState: (hydrationState) => set({ hydrationState }),
  setTaskCenterOpen: (isTaskCenterOpen) => set({ isTaskCenterOpen }),
}));

async function ensureExplorerTaskHydration(): Promise<void> {
  if (!isTauri()) {
    return;
  }

  if (hydrationPromise) {
    return hydrationPromise;
  }

  const store = useExplorerTaskStore.getState();
  store.setHydrationState('loading');
  store.setHydrationError(null);

  hydrationPromise = listExplorerTasks()
    .then((tasks) => {
      useExplorerTaskStore.getState().replaceTasks(tasks);
      useExplorerTaskStore.getState().setHydrationState('ready');
    })
    .catch((error) => {
      useExplorerTaskStore
        .getState()
        .setHydrationError(error instanceof Error ? error.message : String(error));
    })
    .finally(() => {
      hydrationPromise = null;
    });

  return hydrationPromise;
}

async function ensureExplorerTaskProgressSubscription(): Promise<void> {
  if (!isTauri() || subscriptionReady) {
    return;
  }

  if (subscriptionPromise) {
    return subscriptionPromise;
  }

  const store = useExplorerTaskStore.getState();
  store.setSubscriptionState('loading');
  store.setSubscriptionError(null);

  subscriptionPromise = listenToExplorerTaskProgress((taskProgress) => {
    useExplorerTaskStore.getState().upsertTask(taskProgress.task);
  })
    .then(() => {
      subscriptionReady = true;
      useExplorerTaskStore.getState().setSubscriptionState('ready');
    })
    .catch((error) => {
      useExplorerTaskStore
        .getState()
        .setSubscriptionError(error instanceof Error ? error.message : String(error));
    })
    .finally(() => {
      subscriptionPromise = null;
    });

  return subscriptionPromise;
}

async function ensureExplorerTaskFeed(): Promise<void> {
  await ensureExplorerTaskHydration();
  await ensureExplorerTaskProgressSubscription();
}

export function useExplorerTaskProgressFeed(): void {
  useEffect(() => {
    if (typeof window !== 'undefined') {
      void ensureExplorerTaskFeed();
    }
  }, []);
}

export function useExplorerTaskSnapshots(): ExplorerTaskSnapshot[] {
  return useExplorerTaskStore(useShallow((state) => state.taskOrder
    .map((taskId) => state.tasks[taskId])
    .filter((task): task is ExplorerTaskSnapshot => Boolean(task))));
}

export function useExplorerTaskCenterOpen(): boolean {
  return useExplorerTaskStore((state) => state.isTaskCenterOpen);
}

export function openExplorerTaskCenter(): void {
  useExplorerTaskStore.getState().setTaskCenterOpen(true);
}

export function closeExplorerTaskCenter(): void {
  useExplorerTaskStore.getState().setTaskCenterOpen(false);
}

export function toggleExplorerTaskCenter(): void {
  const state = useExplorerTaskStore.getState();
  state.setTaskCenterOpen(!state.isTaskCenterOpen);
}

export async function retryExplorerTaskById(taskId: string): Promise<ExplorerTaskSnapshot> {
  const task = await retryExplorerTask(taskId);
  useExplorerTaskStore.getState().upsertTask(task);
  return task;
}

export async function cancelExplorerTaskById(taskId: string): Promise<ExplorerTaskSnapshot> {
  const task = await cancelExplorerTask(taskId);
  useExplorerTaskStore.getState().upsertTask(task);
  return task;
}

export async function clearExplorerTaskHistoryInStore(scope: ExplorerTaskHistoryScope): Promise<void> {
  await clearExplorerTaskHistory(scope);
  useExplorerTaskStore.getState().pruneTasks(scope);
}

export async function retryFailedExplorerTasks(): Promise<ExplorerTaskSnapshot[]> {
  const failedTasks = useExplorerTaskStore
    .getState()
    .taskOrder
    .map((taskId) => useExplorerTaskStore.getState().tasks[taskId])
    .filter((task): task is ExplorerTaskSnapshot => Boolean(task))
    .filter((task) => task.canRetry && (task.status === 'failed' || task.status === 'cancelled'));

  const retriedTasks: ExplorerTaskSnapshot[] = [];
  for (const task of failedTasks) {
    retriedTasks.push(await retryExplorerTaskById(task.id));
  }
  return retriedTasks;
}

export async function clearCompletedExplorerTasks(): Promise<void> {
  await clearExplorerTaskHistoryInStore('completed');
}
