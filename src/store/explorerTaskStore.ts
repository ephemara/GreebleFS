import { isTauri } from '@tauri-apps/api/core';
import { useEffect } from 'react';
import { create } from 'zustand';
import {
  isExplorerTaskFinished,
  listenToExplorerTaskProgress,
  type ExplorerTaskProgress,
} from '../runtime/explorerBackend';

const EXPLORER_TASK_CLEAR_DELAY_MS = 4_000;

interface ExplorerTaskStoreState {
  tasks: Record<string, ExplorerTaskProgress>;
  taskOrder: string[];
  subscriptionState: 'idle' | 'listening' | 'error';
  subscriptionError: string | null;
  upsertTask: (taskProgress: ExplorerTaskProgress) => void;
  clearTask: (taskId: string) => void;
  setSubscriptionError: (message: string | null) => void;
  setSubscriptionState: (state: ExplorerTaskStoreState['subscriptionState']) => void;
}

const taskClearTimers = new Map<string, number>();
let subscriptionPromise: Promise<void> | null = null;
let subscriptionReady = false;

export const useExplorerTaskStore = create<ExplorerTaskStoreState>((set) => ({
  tasks: {},
  taskOrder: [],
  subscriptionState: 'idle',
  subscriptionError: null,
  upsertTask: (taskProgress) => {
    set((state) => {
      const nextOrder = state.taskOrder.filter((taskId) => taskId !== taskProgress.taskId);
      nextOrder.push(taskProgress.taskId);
      return {
        tasks: {
          ...state.tasks,
          [taskProgress.taskId]: taskProgress,
        },
        taskOrder: nextOrder,
      };
    });
  },
  clearTask: (taskId) => {
    set((state) => {
      if (!state.tasks[taskId]) {
        return state;
      }

      const nextTasks = { ...state.tasks };
      delete nextTasks[taskId];
      return {
        tasks: nextTasks,
        taskOrder: state.taskOrder.filter((candidate) => candidate !== taskId),
      };
    });
  },
  setSubscriptionError: (message) => set({
    subscriptionError: message,
    subscriptionState: message ? 'error' : 'listening',
  }),
  setSubscriptionState: (subscriptionState) => set({ subscriptionState }),
}));

function scheduleExplorerTaskClear(taskId: string) {
  const existingTimer = taskClearTimers.get(taskId);
  if (existingTimer != null) {
    window.clearTimeout(existingTimer);
  }

  const timer = window.setTimeout(() => {
    taskClearTimers.delete(taskId);
    useExplorerTaskStore.getState().clearTask(taskId);
  }, EXPLORER_TASK_CLEAR_DELAY_MS);

  taskClearTimers.set(taskId, timer);
}

function cancelExplorerTaskClear(taskId: string) {
  const existingTimer = taskClearTimers.get(taskId);
  if (existingTimer == null) {
    return;
  }

  window.clearTimeout(existingTimer);
  taskClearTimers.delete(taskId);
}

function shouldAutoClearExplorerTask(taskProgress: ExplorerTaskProgress): boolean {
  switch (taskProgress.task.prog.kind) {
    case 'fileCopy':
    case 'fileCut':
    case 'fileDelete':
    case 'fileDownload':
    case 'fileHardlink':
    case 'fileLink':
    case 'fileTrash':
    case 'fileUpload':
      return isExplorerTaskFinished(taskProgress.task);
    default:
      return false;
  }
}

async function ensureExplorerTaskProgressSubscription(): Promise<void> {
  if (!isTauri() || subscriptionReady) {
    return;
  }

  if (subscriptionPromise) {
    return subscriptionPromise;
  }

  const store = useExplorerTaskStore.getState();
  store.setSubscriptionState('listening');
  store.setSubscriptionError(null);

  subscriptionPromise = listenToExplorerTaskProgress((taskProgress) => {
    cancelExplorerTaskClear(taskProgress.taskId);
    useExplorerTaskStore.getState().upsertTask(taskProgress);

    if (shouldAutoClearExplorerTask(taskProgress)) {
      scheduleExplorerTaskClear(taskProgress.taskId);
    }
  })
    .then(() => {
      subscriptionReady = true;
      useExplorerTaskStore.getState().setSubscriptionState('listening');
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

export function useExplorerTaskProgressFeed(): void {
  useEffect(() => {
    if (typeof window !== 'undefined') {
      void ensureExplorerTaskProgressSubscription();
    }
  }, []);
}

export function useCurrentExplorerTaskProgress(): ExplorerTaskProgress | null {
  return useExplorerTaskStore((state) => {
    const currentTaskId = state.taskOrder[state.taskOrder.length - 1];
    return currentTaskId ? state.tasks[currentTaskId] ?? null : null;
  });
}
