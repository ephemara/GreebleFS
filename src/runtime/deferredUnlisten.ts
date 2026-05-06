export type UnlistenCallback = () => void;

export interface DeferredUnlistenOptions {
  onError?: (error: unknown) => void;
  registerOnPageUnload?: boolean;
}

function reportDeferredUnlistenError(
  error: unknown,
  options: DeferredUnlistenOptions,
): void {
  options.onError?.(error);
}

let pageUnloadListenerInstalled = false;
let pageUnloadStarted = false;
const pendingPageUnloadCleanups = new Set<UnlistenCallback>();

function handlePageUnload(): void {
  if (pageUnloadStarted) {
    return;
  }

  pageUnloadStarted = true;
  const cleanups = Array.from(pendingPageUnloadCleanups);
  pendingPageUnloadCleanups.clear();
  for (const cleanup of cleanups) {
    cleanup();
  }
}

function ensurePageUnloadListener(): void {
  if (pageUnloadListenerInstalled || typeof window === 'undefined') {
    return;
  }

  pageUnloadListenerInstalled = true;
  window.addEventListener('beforeunload', handlePageUnload, { capture: true });
  window.addEventListener('pagehide', handlePageUnload, { capture: true });
}

function registerPageUnloadCleanup(cleanup: UnlistenCallback): UnlistenCallback {
  ensurePageUnloadListener();
  pendingPageUnloadCleanups.add(cleanup);
  return () => {
    pendingPageUnloadCleanups.delete(cleanup);
  };
}

export function resetDeferredUnlistenForTests(): void {
  pendingPageUnloadCleanups.clear();
  pageUnloadStarted = false;
}

export function bindDeferredUnlisten(
  unlistenPromise: Promise<UnlistenCallback>,
  options: DeferredUnlistenOptions = {},
): UnlistenCallback {
  let disposed = false;
  let resolvedUnlisten: UnlistenCallback | null = null;
  let releasePageUnloadCleanup: UnlistenCallback | null = null;

  const cleanupResolvedUnlisten = (): void => {
    const unlisten = resolvedUnlisten;
    resolvedUnlisten = null;
    if (!unlisten) {
      return;
    }

    try {
      unlisten();
    } catch (error) {
      reportDeferredUnlistenError(error, options);
    }
  };

  const cleanup = (): void => {
    disposed = true;
    releasePageUnloadCleanup?.();
    releasePageUnloadCleanup = null;
    cleanupResolvedUnlisten();
  };

  void unlistenPromise
    .then((unlisten) => {
      if (disposed || pageUnloadStarted) {
        try {
          unlisten();
        } catch (error) {
          reportDeferredUnlistenError(error, options);
        }
        return;
      }

      resolvedUnlisten = unlisten;
      if (options.registerOnPageUnload ?? true) {
        releasePageUnloadCleanup = registerPageUnloadCleanup(cleanup);
      }
    })
    .catch((error) => {
      if (!disposed) {
        reportDeferredUnlistenError(error, options);
      }
    });

  return cleanup;
}
